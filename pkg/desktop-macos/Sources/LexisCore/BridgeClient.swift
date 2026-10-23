import Foundation

public struct BridgeConfiguration: Sendable {
    public let port: Int
    public let token: String
    public init(port: Int, token: String) throws {
        guard (1...65535).contains(port) else { throw LexisError.invalidPort }
        guard !token.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw LexisError.missingToken }
        self.port = port
        self.token = token.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    public func request(path: String, key: String? = nil) -> URLRequest {
        var parts = URLComponents()
        parts.scheme = "http"; parts.host = "127.0.0.1"; parts.port = port; parts.path = path
        if let key { parts.queryItems = [URLQueryItem(name: "key", value: key)] }
        var request = URLRequest(url: parts.url!)
        request.timeoutInterval = 15
        request.cachePolicy = .reloadIgnoringLocalCacheData
        if path != "/ping" { request.setValue(token, forHTTPHeaderField: "X-Lexis-Token") }
        return request
    }
}

// Never forward a local authentication token to a redirect destination.
private final class NoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

public final class BridgeClient: @unchecked Sendable {
    private struct Envelope: Decodable { let ok: Bool; let error: String? }
    private let configuration: BridgeConfiguration
    private let session: URLSession
    public init(configuration: BridgeConfiguration, sessionConfiguration: URLSessionConfiguration = .ephemeral) {
        self.configuration = configuration
        let settings = sessionConfiguration
        settings.httpCookieStorage = nil
        settings.urlCache = nil
        settings.timeoutIntervalForResource = 20
        settings.connectionProxyDictionary = [:]
        session = URLSession(configuration: settings, delegate: NoRedirect(), delegateQueue: nil)
    }
    deinit { session.invalidateAndCancel() }

    private func send<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: request)
        try Task.checkCancellation()
        guard let http = response as? HTTPURLResponse else { throw LexisError.invalidResponse }
        if http.statusCode == 401 { throw LexisError.unauthorized }
        guard data.count <= 32 * 1024 * 1024 else { throw LexisError.invalidResponse }
        let envelope = try? JSONDecoder().decode(Envelope.self, from: data)
        guard http.statusCode == 200, envelope?.ok == true else {
            if envelope?.error == "not-found" { throw LexisError.notFound }
            throw LexisError.server(envelope?.error ?? "HTTP \(http.statusCode)")
        }
        do { return try JSONDecoder().decode(T.self, from: data) }
        catch { throw LexisError.invalidResponse }
    }
    public func verify() async throws -> String {
        struct Ping: Decodable { let ok: Bool; let app: String; let vault: String }
        let ping: Ping = try await send(configuration.request(path: "/ping"))
        guard ping.app == "lexis" else { throw LexisError.notLexis }
        return ping.vault
    }
    public func words() async throws -> WordList {
        try await send(configuration.request(path: "/words"))
    }
    public func detail(key: String) async throws -> WordDetail {
        try await send(configuration.request(path: "/word", key: key))
    }
    public func add(_ payload: AddWord) async throws -> MutationResult {
        var request = configuration.request(path: "/add")
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(payload)
        return try await send(request)
    }
}
