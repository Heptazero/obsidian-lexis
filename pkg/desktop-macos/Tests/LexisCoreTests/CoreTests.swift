import Foundation
import CoreGraphics
import LexisCore

// Standalone runner; no XCTest installation or package downloads required.
private struct CheckFailure: Error { let message: String }
private func expect(_ value: @autoclosure () -> Bool, _ message: String) throws {
    if !value() { throw CheckFailure(message: message) }
}
private func fails<T>(_ body: () async throws -> T, _ predicate: (LexisError) -> Bool) async throws {
    do { _ = try await body(); throw CheckFailure(message: "Expected failure") }
    catch let error as LexisError { try expect(predicate(error), "Wrong failure") }
}
private final class MockProtocol: URLProtocol, @unchecked Sendable {
    static var status = 200, body = "", count = 0, delay = 0.0
    static var received: URLRequest?
    private var work: DispatchWorkItem?
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.received = request; Self.count += 1
        let status = Self.status, body = Self.body
        let item = DispatchWorkItem { [weak self] in
            guard let self else { return }
            let response = HTTPURLResponse(url: self.request.url!, statusCode: status, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": "application/json"])!
            self.client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            self.client?.urlProtocol(self, didLoad: Data(body.utf8))
            self.client?.urlProtocolDidFinishLoading(self)
        }
        work = item
        DispatchQueue.global().asyncAfter(deadline: .now() + Self.delay, execute: item)
    }
    override func stopLoading() { work?.cancel() }
}

@main struct CoreChecks {
    static func words() throws -> WordList {
        try JSONDecoder().decode(WordList.self, from: Data("""
        {"ok":true,"words":[
          {"key":"tangent","word":"Tangent","file":"math/Tangent.md"},
          {"key":"tan","word":"Tan","file":"math/Tangent.md"},
          {"key":"cotangent","word":"Cotangent"},
          {"key":"ql 分解","word":"QL 分解","inline":true}
        ],"styleConfig":{"dicts":["10_atom","60_english"]}}
        """.utf8))
    }
    static func api(_ body: String, status: Int = 200, delay: Double = 0) throws -> BridgeClient {
        MockProtocol.body = body; MockProtocol.status = status; MockProtocol.received = nil
        MockProtocol.count = 0; MockProtocol.delay = delay
        let session = URLSessionConfiguration.ephemeral
        session.protocolClasses = [MockProtocol.self]
        return BridgeClient(configuration: try BridgeConfiguration(port: 12345, token: "fixture"), sessionConfiguration: session)
    }
    static func main() async {
        let checks: [(String, () async throws -> Void)] = [
            ("Web text without geometry is still a selection", {
                try expect(SelectionPolicy.nearPointer(CGPoint(x: 50, y: 70), bounds: nil), "Missing web bounds rejected")
                try expect(!SelectionPolicy.nearPointer(CGPoint(x: 500, y: 700), bounds: CGRect(x: 0, y: 0, width: 20, height: 20)), "Unrelated known bounds")
            }),
            ("Text-marker fallback when AXSelectedText is absent", {
                let value = SelectionPolicy.selectedText(plain: nil) { "ChatGPT selection" }
                try expect(value == "ChatGPT selection", "Missing text-marker fallback")
                var markerCalled = false
                let plain = SelectionPolicy.selectedText(plain: "native") { markerCalled = true; return "other" }
                try expect(plain == "native" && !markerCalled, "Plain text should win")
            }),
            ("Text marker respects empty and length limits", {
                try expect(SelectionPolicy.selectedText(plain: nil) { " " } == nil, "Empty marker")
                try expect(SelectionPolicy.selectedText(plain: nil) { String(repeating: "x", count: 4097) } == nil, "Long marker")
            }),
            ("No hardcoded app exclusions", {
                for id in ["com.apple.Safari", "com.google.Chrome", "md.obsidian", "any.new.application"] {
                    try expect(SelectionPolicy.allows(enabled: true, sourcePID: 12, ownPID: 34, bundleID: id, excluded: []), "Unexpected default exclusion")
                }
            }),
            ("Explicit exclusions and disabled mode", {
                let exclusions = [ExcludedApplication(bundleID: "chosen.app", name: "我的选择")]
                try expect(!SelectionPolicy.allows(enabled: true, sourcePID: 12, ownPID: 34, bundleID: "chosen.app", excluded: exclusions), "Excluded app")
                try expect(SelectionPolicy.allows(enabled: true, sourcePID: 12, ownPID: 34, bundleID: "other.app", excluded: exclusions), "Other app")
                try expect(!SelectionPolicy.allows(enabled: false, sourcePID: 12, ownPID: 34, bundleID: nil, excluded: []), "Disabled")
                try expect(!SelectionPolicy.allows(enabled: true, sourcePID: 34, ownPID: 34, bundleID: nil, excluded: []), "Own windows")
            }),
            ("Exclusions round trip", {
                let rows = [ExcludedApplication(bundleID: "raw.bundle.id", name: "自选 App")]
                let data = try JSONEncoder().encode(rows)
                let decoded = try JSONDecoder().decode([ExcludedApplication].self, from: data)
                try expect(decoded == rows, "Exclusion identity changed")
            }),
            ("Reject empty and excessive selections", {
                try expect(SelectionPolicy.text(" \n ") == nil, "Empty selection")
                try expect(SelectionPolicy.text(String(repeating: "字", count: 4097)) == nil, "Do not truncate into a wrong term")
                try expect(SelectionPolicy.text("  Tangent  ") == "Tangent", "Trim")
            }),
            ("Ordinary clicks do not reuse stale selection", {
                var gesture = SelectionGesture()
                let point = CGPoint(x: 40, y: 60)
                gesture.begin(point: point, pid: 12)
                try expect(!gesture.finish(point: point, pid: 12, clicks: 1), "Single click")
                try expect(!gesture.finish(point: CGPoint(x: 80, y: 60), pid: 12, clicks: 2), "Missing mouse-down")
            }),
            ("Drag and double click select", {
                var gesture = SelectionGesture()
                gesture.begin(point: .zero, pid: 12)
                try expect(gesture.finish(point: CGPoint(x: 30, y: 0), pid: 12, clicks: 1), "Drag")
                gesture.begin(point: .zero, pid: 12)
                try expect(gesture.finish(point: .zero, pid: 12, clicks: 2), "Double click")
            }),
            ("Application switch and cancellation discard gesture", {
                var gesture = SelectionGesture()
                gesture.begin(point: .zero, pid: 12)
                try expect(!gesture.finish(point: CGPoint(x: 30, y: 0), pid: 13, clicks: 1), "Different app")
                gesture.begin(point: .zero, pid: 12); gesture.reset()
                try expect(!gesture.finish(point: CGPoint(x: 30, y: 0), pid: 12, clicks: 1), "Reset")
            }),
            ("Pill stays inside normal and secondary screens", {
                let size = CGSize(width: 84, height: 34)
                for screen in [CGRect(x: 0, y: 25, width: 1440, height: 850), CGRect(x: -1280, y: -200, width: 1280, height: 1024)] {
                    for point in [CGPoint(x: screen.minX, y: screen.minY), CGPoint(x: screen.maxX - 1, y: screen.maxY - 1)] {
                        let rect = SelectionPolicy.pillFrame(point: point, screen: screen, size: size)
                        try expect(screen.contains(rect) && rect.size == size, "Off-screen pill")
                    }
                }
            }),
            ("Exact, prefix, substring ranking", {
                let list = try words().words
                try expect(WordSearch.matches("tan", in: list).map(\.key) == ["tan", "tangent", "cotangent"], "Ranking")
                try expect(WordSearch.matches(" TANGENT\n", in: list).first?.key == "tangent", "Case")
            }),
            ("Unicode and whitespace", {
                try expect(WordSearch.normalize(" QL  分解 ") == "ql 分解", "Whitespace")
                try expect(WordSearch.normalize("cafe\u{301}") == WordSearch.normalize("café"), "Unicode")
            }),
            ("Empty query and result limits", {
                let list = try words()
                try expect(WordSearch.matches("", in: list.words).isEmpty, "Empty")
                try expect(WordSearch.matches("tan", in: list.words, limit: 2).count == 2, "Limit")
                try expect(WordSearch.matches("tan", in: list.words, limit: 0).isEmpty, "Zero")
            }),
            ("Bridge metadata", {
                let list = try words()
                try expect(list.words.last?.inline == true, "Inline")
                try expect(list.styleConfig.dicts == ["10_atom", "60_english"], "Folders")
            }),
            ("Invalid ports and missing token", {
                for port in [0, -1, 65536] {
                    try await fails({ try BridgeConfiguration(port: port, token: "fixture") }, { if case .invalidPort = $0 { return true }; return false })
                }
                try await fails({ try BridgeConfiguration(port: 12345, token: " \n ") }, { if case .missingToken = $0 { return true }; return false })
            }),
            ("Loopback and header-only authentication", {
                let config = try BridgeConfiguration(port: 12345, token: " fixture ")
                let request = config.request(path: "/word", key: "A&B#中文?")
                try expect(request.url?.host == "127.0.0.1" && request.url?.port == 12345, "Endpoint")
                try expect(request.value(forHTTPHeaderField: "X-Lexis-Token") == "fixture", "Header")
                try expect(!request.url!.absoluteString.contains("fixture"), "Token in URL")
                try expect(URLComponents(url: request.url!, resolvingAgainstBaseURL: false)?.queryItems?.first?.value == "A&B#中文?", "Query escaping")
                try expect(config.request(path: "/ping").value(forHTTPHeaderField: "X-Lexis-Token") == nil, "Ping")
            }),
            ("Note links and scheme restrictions", {
                let url = NoteLink.url(vault: "myob & 测试", file: "10_atom/QL # 分解.md")!
                try expect(URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.last?.value == "10_atom/QL # 分解.md", "File escaping")
                try expect(NoteLink.allowed(url), "Open note")
                for bad in ["javascript:alert(1)", "file:///etc/hosts", "data:text/html,hello", "remnote://open", "obsidian://lexis-add?word=test"] {
                    try expect(!NoteLink.allowed(URL(string: bad)!), "Unsafe link")
                }
            }),
            ("Safe HTML retains final math and attachments", {
                let html = CardDocument.make(title: "<b>A&B</b>", html: "<mjx-container>formula</mjx-container><img src='data:image/png;base64,AA'>", mathCSS: "@font-face{src:url(data:font/woff;base64,AA)}")
                for value in ["default-src 'none'", "img-src data:", "font-src data:", "&lt;b&gt;A&amp;B&lt;/b&gt;", "<mjx-container>formula</mjx-container>", "color-scheme: light dark", "data:font/woff"] {
                    try expect(html.contains(value), "Missing HTML policy/content")
                }
            }),
            ("Verify Lexis service", {
                let client = try api(#"{"ok":true,"app":"lexis","vault":"myob"}"#)
                let name = try await client.verify()
                try expect(name == "myob", "Vault")
                try expect(MockProtocol.received?.value(forHTTPHeaderField: "X-Lexis-Token") == nil, "Ping token")
            }),
            ("Reject other services", {
                let client = try api(#"{"ok":true,"app":"other","vault":"fixture"}"#)
                try await fails({ try await client.verify() }, { if case .notLexis = $0 { return true }; return false })
            }),
            ("Token failures", {
                let client = try api(#"{"ok":false,"error":"bad-token"}"#, status: 401)
                try await fails({ try await client.words() }, { if case .unauthorized = $0 { return true }; return false })
            }),
            ("Missing entries", {
                let client = try api(#"{"ok":false,"error":"not-found"}"#)
                try await fails({ try await client.detail(key: "missing") }, { if case .notFound = $0 { return true }; return false })
            }),
            ("Malformed response", {
                let client = try api(#"{"ok":true}"#)
                try await fails({ try await client.words() }, { if case .invalidResponse = $0 { return true }; return false })
            }),
            ("Explicit add payload and method", {
                let payload = AddWord(word: "测试", folder: "10_atom", sentence: "原文")
                let encoded = try JSONSerialization.jsonObject(with: JSONEncoder().encode(payload)) as! [String: String]
                try expect(encoded == ["word": "测试", "folder": "10_atom", "sentence": "原文"], "Payload")
                let client = try api(#"{"ok":true,"created":true,"file":"10_atom/test.md"}"#)
                let result = try await client.add(payload)
                try expect(result.created == true, "Added")
                try expect(MockProtocol.received?.httpMethod == "POST" && MockProtocol.received?.url?.path == "/add", "Add route")
            }),
            ("Failed writes not retried", {
                let client = try api(#"{"ok":false,"error":"fixture-failed"}"#, status: 500)
                try await fails({ try await client.add(AddWord(word: "fixture", folder: "test", sentence: "")) }, { if case .server = $0 { return true }; return false })
                try expect(MockProtocol.count == 1, "Unexpected retry")
            }),
            ("Redirect is not success", {
                let client = try api(#"{"ok":true}"#, status: 302)
                try await fails({ try await client.words() }, { if case .server = $0 { return true }; return false })
            }),
            ("Cancelled detail not delivered", {
                let client = try api(#"{"ok":true}"#, delay: 0.3)
                let task = Task { try await client.detail(key: "fixture") }
                try await Task.sleep(nanoseconds: 20_000_000)
                task.cancel()
                do { _ = try await task.value; throw CheckFailure(message: "Cancellation ignored") }
                catch is CancellationError { }
                catch let error as URLError { try expect(error.code == .cancelled, "Wrong cancellation") }
            })
        ]
        var failed = 0
        for (name, check) in checks {
            do { try await check(); print("PASS \(name)") }
            catch { failed += 1; print("FAIL \(name): \(error)") }
        }
        print("\(checks.count - failed)/\(checks.count) checks passed")
        if failed > 0 { exit(1) }
    }
}
