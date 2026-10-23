import Foundation
import CoreGraphics

public struct ExcludedApplication: Codable, Identifiable, Equatable, Sendable {
    public var id: String { bundleID }
    public let bundleID: String
    public let name: String
    public init(bundleID: String, name: String) { self.bundleID = bundleID; self.name = name }
}

/// Only a drag or a double/triple click is a selection gesture. Ordinary clicks
/// must not redisplay stale selected text from the focused app.
public struct SelectionGesture {
    private var down: (point: CGPoint, pid: Int32)?
    public init() {}
    public mutating func begin(point: CGPoint, pid: Int32) { down = (point, pid) }
    public mutating func reset() { down = nil }
    public mutating func finish(point: CGPoint, pid: Int32, clicks: Int) -> Bool {
        defer { down = nil }
        guard let down, down.pid == pid else { return false }
        return clicks >= 2 || hypot(point.x - down.point.x, point.y - down.point.y) >= 3
    }
}

public enum SelectionPolicy {
    public static func selectedText(plain: String?, marker: () -> String?) -> String? {
        if let plain, let value = text(plain) { return value }
        return marker().flatMap(text)
    }
    public static func nearPointer(_ point: CGPoint?, bounds: CGRect?) -> Bool {
        // Many web renderers expose text but no AXBoundsForRange.
        guard let point, let bounds, !bounds.isEmpty else { return true }
        return bounds.insetBy(dx: -12, dy: -12).contains(point)
    }
    public static func allows(enabled: Bool, sourcePID: Int32, ownPID: Int32,
                              bundleID: String?, excluded: [ExcludedApplication]) -> Bool {
        enabled && sourcePID != ownPID && !excluded.contains { $0.bundleID == bundleID }
    }
    public static func text(_ value: String) -> String? {
        let text = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return text.isEmpty || text.count > 4096 ? nil : text
    }
    public static func pillFrame(point: CGPoint, screen: CGRect, size: CGSize) -> CGRect {
        let x = min(max(point.x + 10, screen.minX + 6), screen.maxX - size.width - 6)
        var y = point.y - size.height - 12
        if y < screen.minY + 6 { y = point.y + 18 }
        y = min(max(y, screen.minY + 6), screen.maxY - size.height - 6)
        return CGRect(origin: CGPoint(x: x, y: y), size: size)
    }
}
