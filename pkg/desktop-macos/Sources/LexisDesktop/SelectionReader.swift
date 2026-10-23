import AppKit
import ApplicationServices
import LexisCore

enum SelectionReader {
    static var authorized: Bool { AXIsProcessTrusted() }
    static func requestPermission() {
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true]
        _ = AXIsProcessTrustedWithOptions(options as CFDictionary)
    }
    // Called after a selection gesture or hotkey. No copy simulation or full-tree scan.
    // `point` uses Accessibility's top-left screen coordinates.
    static func read(pid: pid_t, at point: CGPoint? = nil) -> String? {
        let application = AXUIElementCreateApplication(pid)
        AXUIElementSetMessagingTimeout(application, 0.2)
        let focused = element(application, kAXFocusedUIElementAttribute)
        if let focused {
            AXUIElementSetMessagingTimeout(focused, 0.15)
            if secure(focused) { return nil }
        }
        if let point {
            var hit: AXUIElement?
            if AXUIElementCopyElementAtPosition(application, Float(point.x), Float(point.y), &hit) == .success {
                var current = hit
                let deadline = Date().addingTimeInterval(0.8)
                // A text hit may expose its selection on a parent text area.
                for _ in 0..<16 {
                    guard let node = current, Date() < deadline else { break }
                    AXUIElementSetMessagingTimeout(node, 0.15)
                    if secure(node) { return nil }
                    if let text = selected(node) {
                        if SelectionPolicy.nearPointer(point, bounds: selectionBounds(node)) { return text }
                    }
                    current = element(node, kAXParentAttribute)
                }
            }
            // A fresh selection gesture is required by the caller. Missing bounds
            // are not evidence that a web renderer's current selection is invalid.
            if let focused, SelectionPolicy.nearPointer(point, bounds: selectionBounds(focused)) {
                return selected(focused)
            }
            return nil
        }
        return focused.flatMap { selected($0) }
    }
    private static func element(_ parent: AXUIElement, _ attribute: String) -> AXUIElement? {
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(parent, attribute as CFString, &value) == .success,
              let value, CFGetTypeID(value) == AXUIElementGetTypeID() else { return nil }
        return unsafeBitCast(value, to: AXUIElement.self)
    }
    private static func secure(_ element: AXUIElement) -> Bool {
        var role: CFTypeRef?
        AXUIElementCopyAttributeValue(element, kAXSubroleAttribute as CFString, &role)
        return (role as? String) == (kAXSecureTextFieldSubrole as String)
    }
    private static func selected(_ element: AXUIElement) -> String? {
        let plain = attribute(element, kAXSelectedTextAttribute) as? String
        return SelectionPolicy.selectedText(plain: plain) {
            guard let range = attribute(element, "AXSelectedTextMarkerRange") else { return nil }
            var text: CFTypeRef?
            guard AXUIElementCopyParameterizedAttributeValue(element, "AXStringForTextMarkerRange" as CFString,
                                                             range, &text) == .success else { return nil }
            return text as? String
        }
    }
    private static func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success else { return nil }
        return value
    }
    private static func selectionBounds(_ element: AXUIElement) -> CGRect? {
        AXUIElementSetMessagingTimeout(element, 0.15)
        var range: CFTypeRef?, bounds: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, kAXSelectedTextRangeAttribute as CFString, &range) == .success,
              let range,
              AXUIElementCopyParameterizedAttributeValue(element, kAXBoundsForRangeParameterizedAttribute as CFString, range, &bounds) == .success,
              let bounds, CFGetTypeID(bounds) == AXValueGetTypeID() else { return nil }
        var rect = CGRect.zero
        guard AXValueGetValue(unsafeBitCast(bounds, to: AXValue.self), .cgRect, &rect), !rect.isEmpty else { return nil }
        return rect
    }
    static func readCompatible(pid: pid_t, at point: CGPoint? = nil) async -> String? {
        if let text = read(pid: pid, at: point) { return text }
        // Electron explicitly exposes this opt-in. Never poke EnhancedUserInterface
        // on arbitrary apps: it can change window-management behavior.
        guard WebAccessibility.requestIfSupported(pid: pid) else { return nil }
        do { try await Task.sleep(nanoseconds: 2_200_000_000) } catch { return nil }
        guard NSWorkspace.shared.frontmostApplication?.processIdentifier == pid else { return nil }
        return read(pid: pid, at: point)
    }
}
