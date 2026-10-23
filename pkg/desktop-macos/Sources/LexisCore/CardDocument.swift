import Foundation

public enum CardDocument {
    public static func make(title: String, html: String, mathCSS: String) -> String {
        // JavaScript also disabled in WKWebView. No background external image/font requests.
        let title = title.replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;").replacingOccurrences(of: ">", with: "&gt;")
        let mathCSS = mathCSS.replacingOccurrences(of: "</style", with: "<\\/style", options: .caseInsensitive)
        return """
        <!doctype html><html><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'">
        <title>\(title)</title><style>
        :root { color-scheme: light dark; }
        body { font: 15px/1.65 -apple-system, BlinkMacSystemFont, sans-serif; margin: 18px;
          background: transparent; color: CanvasText; overflow-wrap: anywhere; }
        a { color: LinkText; } img,svg { max-width:100%; height:auto; }
        p { margin:.65em 0; } h1,h2,h3,h4 { line-height:1.35; margin:1em 0 .5em; }
        pre { overflow:auto; padding:10px; background:color-mix(in srgb, CanvasText 5%, transparent); border-radius:6px; }
        blockquote { margin:1em 0; padding-left:12px; border-left:3px solid GrayText; }
        table { border-collapse:collapse; } td,th { border:1px solid GrayText; padding:4px 8px; }
        mjx-container { overflow:visible; } mjx-container[display="true"] { display:block; overflow-x:auto; overflow-y:hidden; padding:.4em 0; }
        mjx-assistive-mml { position:absolute; width:1px; height:1px; overflow:hidden; }
        .lexis-web-occ-pending { display:none; }
        .lexis-web-sec { margin-top:1em; font-weight:600; }
        .lexis-web-dim,.lexis-web-occ-src { color:GrayText; font-size:.85em; }
        .lexis-web-rel a { display:inline-block; margin-right:.7em; }
        \(mathCSS)
        </style></head><body>\(html)</body></html>
        """
    }
}
