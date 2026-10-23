import AppKit
import Combine
import LexisCore

@MainActor final class LookupModel: ObservableObject {
    @Published var query = ""
    @Published private(set) var words: [Word] = []
    @Published private(set) var folders: [String] = []
    @Published var folder = "" { didSet {
        if !vault.isEmpty { preferences.saveFolder(folder, port: preferences.port, vault: vault) }
    } }
    @Published var sentence = ""
    @Published private(set) var detail: WordDetail?
    @Published private(set) var loading = false
    @Published private(set) var saving = false
    @Published var message = "选中文字后按 ⌃⌥L，或直接输入查词。"
    @Published private(set) var connected = false
    @Published private(set) var vault = ""
    @Published private(set) var selectedKey: String?
    @Published var showAdd = false
    @Published var selectionStatus = "等待划词"
    let preferences = Preferences()
    private var client: BridgeClient?
    private var work: Task<Void, Never>?
    private var revision = UUID()
    var matches: [Word] { WordSearch.matches(query, in: words) }

    func resetConnection() {
        work?.cancel(); revision = UUID(); client = nil; connected = false
        words = []; folders = []; detail = nil; selectedKey = nil; vault = ""
        loading = false; message = "连接设置已保存。请查词或测试连接。"
    }
    func editQuery() {
        work?.cancel(); revision = UUID(); loading = false
        selectedKey = nil; detail = nil; message = ""
    }
    func lookup(_ value: String? = nil) {
        if let value { query = value; sentence = "" }
        start { model, client in
            let key = WordSearch.normalize(model.query)
            guard !key.isEmpty else { model.message = "输入要查询的词。"; return }
            if let exact = model.matches.first(where: {
                WordSearch.normalize($0.key) == key || WordSearch.normalize($0.word) == key
            }) {
                model.selectedKey = exact.key
                let detail = try await client.detail(key: exact.key)
                try Task.checkCancellation(); model.detail = detail
            } else { model.message = model.matches.isEmpty ? "词库里没有这个词，可以添加。" : "选择下方词条查看解释。" }
        }
    }
    func choose(_ word: Word) {
        start { model, client in
            model.selectedKey = word.key
            let detail = try await client.detail(key: word.key)
            try Task.checkCancellation(); model.detail = detail
        }
    }
    func refresh() {
        client = nil
        start { model, _ in model.message = "已连接 \(model.vault) · \(model.words.count) 个索引项" }
    }
    private func start(_ operation: @escaping @MainActor (LookupModel, BridgeClient) async throws -> Void) {
        guard !saving else { return }
        work?.cancel(); let id = UUID(); revision = id
        loading = true; detail = nil; selectedKey = nil; message = ""
        work = Task { [weak self] in
            guard let self else { return }
            defer { if revision == id { loading = false } }
            do {
                let api: BridgeClient
                if let existing = client { api = existing }
                else {
                    api = BridgeClient(configuration: try BridgeConfiguration(port: preferences.port, token: TokenStore.read()))
                    let name = try await api.verify()
                    let list = try await api.words()
                    try Task.checkCancellation()
                    guard revision == id else { return }
                    client = api; vault = name; words = list.words; folders = list.styleConfig.dicts
                    let saved = preferences.folder(port: preferences.port, vault: name)
                    folder = saved.flatMap { self.folders.contains($0) ? $0 : nil } ?? folders.first ?? ""
                    connected = true
                }
                try Task.checkCancellation()
                guard revision == id else { return }
                try await operation(self, api)
            } catch {
                guard revision == id, !Task.isCancelled else { return }
                message = Self.errorMessage(error)
                // The next explicit lookup reconnects, rather than retaining a broken session.
                connected = false; client = nil
            }
        }
    }
    func add() {
        guard let client, connected, !loading, !saving, folders.contains(folder),
              !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        let word = query.trimmingCharacters(in: .whitespacesAndNewlines)
        if matches.contains(where: { WordSearch.normalize($0.key) == WordSearch.normalize(word) && $0.inline == true }) {
            message = "这是单文件词典内的词条，请点击右上角箭头到 Obsidian 编辑。"
            return
        }
        let payload = AddWord(word: word, folder: folder, sentence: sentence)
        saving = true; message = ""
        // Mutations are never queued offline, auto-retried, or cancelled by typing.
        Task { [weak self] in
            guard let self else { return }
            defer { saving = false }
            do {
                let result = try await client.add(payload)
                message = result.created == true ? "已添加到 Obsidian。" : "词条已存在；有填写出处时已追加。"
                // Preserve success even if the subsequent read fails; do not encourage duplicate writes.
                if let list = try? await client.words() { words = list.words }
                if let next = try? await client.detail(key: word) { detail = next }
            } catch {
                message = "未确认保存结果，请先在 Obsidian 检查后再试。\n" + Self.errorMessage(error)
            }
        }
    }
    func openNote() {
        guard let detail, let url = NoteLink.url(vault: detail.vault, file: detail.file) else { return }
        NSWorkspace.shared.open(url)
    }
    static func errorMessage(_ error: Error) -> String {
        if let known = error as? LexisError { return known.localizedDescription }
        if let network = error as? URLError {
            if network.code == .timedOut { return "连接超时，请确认 Obsidian 和 Lexis 桥接已开启。" }
            return "无法连接本机 Lexis。请确认 Obsidian 已打开、桥接已开启且端口一致。"
        }
        return "操作没有完成，请检查连接后重试。"
    }
}
