import SwiftUI
import WebKit
import LexisCore

struct CardWebView: NSViewRepresentable {
    let detail: WordDetail
    func makeCoordinator() -> Coordinator { Coordinator() }
    func makeNSView(context: Context) -> WKWebView {
        let settings = WKWebViewConfiguration()
        settings.defaultWebpagePreferences.allowsContentJavaScript = false
        settings.websiteDataStore = .nonPersistent()
        let web = WKWebView(frame: .zero, configuration: settings)
        web.navigationDelegate = context.coordinator
        return web
    }
    func updateNSView(_ web: WKWebView, context: Context) {
        let html = CardDocument.make(title: detail.title ?? detail.word ?? "Lexis",
                                     html: detail.html, mathCSS: detail.mathCss ?? "")
        guard context.coordinator.document != html else { return }
        context.coordinator.document = html
        web.loadHTMLString(html, baseURL: nil)
    }
    static func dismantleNSView(_ web: WKWebView, coordinator: Coordinator) {
        web.stopLoading(); web.navigationDelegate = nil
    }
    final class Coordinator: NSObject, WKNavigationDelegate {
        var document = ""
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if action.navigationType == .linkActivated, let url = action.request.url {
                if url.fragment != nil && url.scheme == "about" { decisionHandler(.allow); return }
                if NoteLink.allowed(url) { NSWorkspace.shared.open(url) }
                decisionHandler(.cancel); return
            }
            // Only allow the in-memory document load, never a form, iframe, or redirect.
            decisionHandler(action.request.url?.absoluteString == "about:blank" ? .allow : .cancel)
        }
    }
}
