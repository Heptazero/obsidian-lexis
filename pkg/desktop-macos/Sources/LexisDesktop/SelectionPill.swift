import AppKit
import LexisCore

@MainActor final class SelectionPill {
    private final class Panel: NSPanel {
        override var canBecomeKey: Bool { false }
        override var canBecomeMain: Bool { false }
    }
    private final class Button: NSButton {
        override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
        override var acceptsFirstResponder: Bool { false }
    }
    private let panel: NSPanel
    private var text = ""
    var action: ((String, Bool) -> Void)?
    var frame: CGRect? { panel.isVisible ? panel.frame : nil }

    init() {
        panel = Panel(contentRect: NSRect(x: 0, y: 0, width: 84, height: 34),
                      styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.level = .popUpMenu
        panel.isOpaque = false; panel.backgroundColor = .clear; panel.hasShadow = true
        panel.hidesOnDeactivate = false; panel.isReleasedWhenClosed = false
        panel.collectionBehavior = [.fullScreenAuxiliary, .canJoinAllSpaces]
        let background = NSVisualEffectView(frame: NSRect(x: 0, y: 0, width: 84, height: 34))
        background.material = .popover; background.state = .active
        background.wantsLayer = true; background.layer?.cornerRadius = 10
        background.layer?.masksToBounds = true
        let search = button("text.magnifyingglass", label: "查词", selector: #selector(lookup))
        let add = button("plus", label: "添加词条", selector: #selector(addWord))
        search.frame = NSRect(x: 4, y: 2, width: 36, height: 30)
        add.frame = NSRect(x: 44, y: 2, width: 36, height: 30)
        background.addSubview(search); background.addSubview(add)
        panel.contentView = background
    }
    private func button(_ image: String, label: String, selector: Selector) -> NSButton {
        let button = Button(image: NSImage(systemSymbolName: image, accessibilityDescription: label)!, target: self, action: selector)
        button.isBordered = false; button.bezelStyle = .inline
        button.toolTip = label; button.setAccessibilityLabel(label)
        return button
    }
    func show(text: String, point: CGPoint) {
        guard let screen = NSScreen.screens.first(where: { $0.frame.contains(point) }) else { return }
        self.text = text
        panel.setFrame(SelectionPolicy.pillFrame(point: point, screen: screen.visibleFrame,
                                               size: CGSize(width: 84, height: 34)), display: false)
        panel.orderFrontRegardless() // Do not activate Lexis or clear the source selection.
    }
    func hide() { panel.orderOut(nil); text = "" }
    @objc private func lookup() { perform(add: false) }
    @objc private func addWord() { perform(add: true) }
    private func perform(add: Bool) {
        let selected = text
        hide()
        if !selected.isEmpty { action?(selected, add) }
    }
}
