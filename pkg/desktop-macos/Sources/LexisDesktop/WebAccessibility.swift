import ApplicationServices
import AppKit

enum WebAccessibility {
    private static let lock = NSLock()
    private static var attempted: Set<String> = []
    static func requestIfSupported(pid: pid_t) -> Bool {
        guard AXIsProcessTrusted(), let app = NSRunningApplication(processIdentifier: pid) else { return false }
        let key = "\(pid):\(app.launchDate?.timeIntervalSince1970 ?? 0)"
        lock.lock()
        let first = attempted.insert(key).inserted
        lock.unlock()
        guard first else { return false }
        let element = AXUIElementCreateApplication(pid)
        AXUIElementSetMessagingTimeout(element, 0.2)
        let attribute = "AXManualAccessibility" as CFString
        var settable: DarwinBoolean = false
        guard AXUIElementIsAttributeSettable(element, attribute, &settable) == .success, settable.boolValue else { return false }
        var current: CFTypeRef?
        if AXUIElementCopyAttributeValue(element, attribute, &current) == .success,
           let enabled = current as? Bool, enabled { return false }
        return AXUIElementSetAttributeValue(element, attribute, kCFBooleanTrue) == .success
    }
}
