import Foundation

public struct Word: Decodable, Identifiable, Sendable {
    public var id: String { key }
    public let key: String
    public let word: String
    public let file: String?
    public let inline: Bool?
}

public struct WordList: Decodable, Sendable {
    public let ok: Bool
    public let words: [Word]
    public let styleConfig: StyleConfig
    public struct StyleConfig: Decodable, Sendable {
        public let dicts: [String]
    }
}

public struct WordDetail: Decodable, Sendable {
    public let ok: Bool
    public let title: String?
    public let word: String?
    public let subtitle: String?
    public let file: String
    public let vault: String
    public let html: String
    public let mathCss: String?
}

public struct MutationResult: Decodable, Sendable {
    public let ok: Bool
    public let created: Bool?
    public let file: String?
}

public struct AddWord: Encodable, Sendable {
    public let word: String
    public let folder: String
    public let sentence: String
    public init(word: String, folder: String, sentence: String) {
        self.word = word; self.folder = folder; self.sentence = sentence
    }
}

public enum LexisError: Error, LocalizedError {
    case invalidPort, missingToken, unauthorized, notLexis, notFound, invalidResponse
    case server(String)
    public var errorDescription: String? {
        switch self {
        case .invalidPort: return "端口应为 1–65535。"
        case .missingToken: return "请先在连接设置中填写 Obsidian 的 Lexis 令牌。"
        case .unauthorized: return "令牌不正确，请核对 Obsidian 的桥接设置。"
        case .notLexis: return "这个端口不是 Lexis 桥接服务。"
        case .notFound: return "词条不存在或已从词库移除。"
        case .invalidResponse: return "桥接返回的数据无法读取。"
        case .server(let reason): return "Lexis 未完成操作：\(reason)"
        }
    }
}

public enum WordSearch {
    public static func normalize(_ text: String) -> String {
        text.precomposedStringWithCanonicalMapping.lowercased()
            .split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
    }
    public static func matches(_ query: String, in words: [Word], limit: Int = 20) -> [Word] {
        let key = normalize(query)
        guard !key.isEmpty, limit > 0 else { return [] }
        var ranked: [(Int, Word)] = []
        for word in words {
            let name = normalize(word.word)
            let index = normalize(word.key)
            let score: Int
            if name == key || index == key { score = 0 }
            else if name.hasPrefix(key) || index.hasPrefix(key) { score = 1 }
            else if name.contains(key) || index.contains(key) { score = 2 }
            else { continue }
            ranked.append((score, word))
        }
        return ranked.sorted {
            if $0.0 != $1.0 { return $0.0 < $1.0 }
            return $0.1.word.localizedStandardCompare($1.1.word) == .orderedAscending
        }.prefix(limit).map { $0.1 }
    }
}

public enum NoteLink {
    public static func url(vault: String, file: String) -> URL? {
        var parts = URLComponents()
        parts.scheme = "obsidian"; parts.host = "open"
        parts.queryItems = [URLQueryItem(name: "vault", value: vault), URLQueryItem(name: "file", value: file)]
        return parts.url
    }
    public static func allowed(_ url: URL) -> Bool {
        if url.scheme?.lowercased() == "obsidian" { return url.host == "open" }
        return ["https", "http"].contains(url.scheme?.lowercased() ?? "")
    }
}
