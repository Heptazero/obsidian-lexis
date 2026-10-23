import AppKit
import Carbon.HIToolbox

final class GlobalShortcut {
    static let choices = ["control-option-l", "control-shift-l", "command-control-l"]
    static func label(_ value: String) -> String {
        switch value {
        case "control-shift-l": return "⌃⇧L"
        case "command-control-l": return "⌘⌃L"
        default: return "⌃⌥L"
        }
    }
    private var hotKey: EventHotKeyRef?
    private var handler: EventHandlerRef?
    private var registeredChoice: String?
    var action: (() -> Void)?

    func register(_ choice: String) -> Bool {
        if hotKey != nil, registeredChoice == choice { return true }
        // Keep the old working registration when a new shortcut is occupied.
        var next: EventHotKeyRef?
        let modifiers: Int
        switch choice {
        case "control-shift-l": modifiers = controlKey | shiftKey
        case "command-control-l": modifiers = cmdKey | controlKey
        default: modifiers = controlKey | optionKey
        }
        let identifier = EventHotKeyID(signature: 0x4C455849, id: 1)
        let result = RegisterEventHotKey(UInt32(kVK_ANSI_L), UInt32(modifiers), identifier,
                                        GetApplicationEventTarget(), 0, &next)
        guard result == noErr else { return false }
        if let previous = hotKey { UnregisterEventHotKey(previous) }
        hotKey = next
        registeredChoice = choice
        if handler == nil {
            var event = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
            let context = Unmanaged.passUnretained(self).toOpaque()
            let installed = InstallEventHandler(GetApplicationEventTarget(), { _, _, context in
                guard let context else { return OSStatus(eventNotHandledErr) }
                let owner = Unmanaged<GlobalShortcut>.fromOpaque(context).takeUnretainedValue()
                owner.action?()
                return noErr
            }, 1, &event, context, &handler)
            if installed != noErr { stop(); return false }
        }
        return true
    }
    func stop() {
        if let hotKey { UnregisterEventHotKey(hotKey) }
        if let handler { RemoveEventHandler(handler) }
        hotKey = nil; handler = nil; registeredChoice = nil
    }
    deinit { stop() }
}
