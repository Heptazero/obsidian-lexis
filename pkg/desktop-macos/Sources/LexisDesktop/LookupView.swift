import SwiftUI
import LexisCore

struct LookupView: View {
    @ObservedObject var model: LookupModel
    let settings: () -> Void
    @FocusState private var searchFocused: Bool
    private var queryBinding: Binding<String> {
        Binding(get: { model.query }, set: { model.editQuery(); model.query = $0 })
    }
    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                TextField("查词", text: queryBinding)
                    .textFieldStyle(.plain).font(.title3).focused($searchFocused)
                    .onSubmit { model.lookup() }
                if model.loading { ProgressView().controlSize(.small) }
                Button { model.lookup() } label: { Image(systemName: "arrow.turn.down.left") }
                    .help("查词").accessibilityLabel("查词").disabled(model.loading || model.saving)
                Button {
                    if let value = NSPasteboard.general.string(forType: .string) { model.lookup(String(value.prefix(4096))) }
                } label: { Image(systemName: "doc.on.clipboard") }
                    .help("粘贴并查词（仅此时读取剪贴板）").accessibilityLabel("粘贴并查词")
                    .disabled(model.saving)
                Button(action: settings) { Image(systemName: "gearshape") }
                    .help("连接、快捷键与划词").accessibilityLabel("连接、快捷键与划词").disabled(model.saving)
            }.padding(16)
            Divider()
            if !model.matches.isEmpty {
                ScrollView(.horizontal) {
                    HStack(spacing: 6) {
                        ForEach(model.matches) { word in
                            Button(word.word) { model.choose(word) }
                                .tint(model.selectedKey == word.key ? .accentColor : .secondary)
                                .disabled(model.saving)
                        }
                    }.padding(.horizontal, 16).padding(.vertical, 8)
                }.frame(maxHeight: 50)
                Divider()
            }
            if let detail = model.detail {
                HStack(alignment: .firstTextBaseline) {
                    Text(detail.title ?? detail.word ?? model.query).font(.title2).textSelection(.enabled)
                    if let subtitle = detail.subtitle, !subtitle.isEmpty {
                        Text(subtitle).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                    }
                    Spacer()
                    Button { model.openNote() } label: { Image(systemName: "arrow.up.right") }
                        .help("在 Obsidian 打开").accessibilityLabel("在 Obsidian 打开")
                }.padding(.horizontal, 16).padding(.top, 12)
                CardWebView(detail: detail).frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "text.book.closed").font(.system(size: 32)).foregroundStyle(.secondary)
                    Text(model.loading ? "正在查词…" : "Lexis").font(.title2)
                    if !SelectionReader.authorized {
                        Button("允许读取选中文字") { SelectionReader.requestPermission() }
                        Text("也可以直接输入；不会自动读取剪贴板。").font(.caption).foregroundStyle(.secondary)
                    }
                }.frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            if !model.message.isEmpty {
                Text(model.message).font(.callout).foregroundStyle(.secondary)
                    .textSelection(.enabled).frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16).padding(.vertical, 8)
            }
            Divider()
            VStack(alignment: .leading, spacing: 10) {
                Text(model.selectionStatus).font(.caption).foregroundStyle(.secondary)
                    .lineLimit(2).textSelection(.enabled)
                HStack {
                    Circle().fill(model.connected ? Color.green : Color.secondary).frame(width: 6, height: 6)
                    Text(model.connected ? model.vault : "未连接").font(.caption).foregroundStyle(.secondary)
                    Spacer()
                    Button { model.refresh() } label: { Image(systemName: "arrow.clockwise") }
                        .help("刷新词库 / 测试连接").accessibilityLabel("刷新词库 / 测试连接")
                        .disabled(model.loading || model.saving)
                    Button { model.showAdd.toggle() } label: { Image(systemName: model.showAdd ? "minus" : "plus") }
                        .help("添加词条或出处").accessibilityLabel("添加词条或出处")
                }
                if model.showAdd {
                    HStack {
                        TextField("词条", text: queryBinding).disabled(model.saving)
                        Picker("词典", selection: $model.folder) {
                            ForEach(model.folders, id: \.self) { folder in Text(folder.isEmpty ? "/" : folder).tag(folder) }
                        }.labelsHidden().frame(maxWidth: 240).disabled(model.saving || model.folders.isEmpty)
                    }
                    TextField("出处原文（可选，不会自动抓取当前软件的内容）", text: $model.sentence, axis: .vertical)
                        .lineLimit(2...4).disabled(model.saving)
                    HStack {
                        if model.folders.isEmpty { Text("先连接，并在 Obsidian 设置可保存新词的文件夹。").font(.caption).foregroundStyle(.secondary) }
                        Spacer()
                        Button(model.saving ? "保存中…" : "保存到 Obsidian") { model.add() }
                            .disabled(!model.connected || model.loading || model.saving || model.query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !model.folders.contains(model.folder))
                    }
                }
            }.padding(14).background(.bar)
        }
        .frame(minWidth: 440, minHeight: 400)
        .onAppear { searchFocused = true }
        .onExitCommand { NSApp.keyWindow?.close() }
        .disabled(model.saving)
    }
}
