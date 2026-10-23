import AppKit
import SwiftUI

@main struct LexisDesktopApp {
    @MainActor static func main() {
        let application = NSApplication.shared
        let delegate = AppDelegate()
        application.delegate = delegate
        application.setActivationPolicy(.accessory)
        withExtendedLifetime(delegate) { application.run() }
    }
}

@MainActor final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    let model = LookupModel()
    let shortcut = GlobalShortcut()
    private var status: NSStatusItem?
    private var panel: NSPanel?
    private var settingsPanel: NSWindow?
    private var selectionTask: Task<Void, Never>?
    private var selectionRevision = UUID()
    private var automatic: AutomaticSelection?
    private var automaticMenuItem: NSMenuItem?

    func applicationDidFinishLaunching(_ notification: Notification) {
        installEditingMenu()
        status = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        status?.button?.image = NSImage(systemSymbolName: "text.book.closed", accessibilityDescription: "Lexis")
        let menu = NSMenu()
        let open = NSMenuItem(title: "打开查词", action: #selector(showLookup), keyEquivalent: "")
        open.target = self; menu.addItem(open)
        let autoItem = NSMenuItem(title: "自动划词药丸", action: #selector(toggleAutomaticSelection), keyEquivalent: "")
        autoItem.target = self
        autoItem.state = model.preferences.automaticSelection ? .on : .off
        menu.addItem(autoItem); automaticMenuItem = autoItem
        let settings = NSMenuItem(title: "设置…", action: #selector(showSettings), keyEquivalent: ",")
        settings.target = self; menu.addItem(settings)
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "退出 Lexis", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        status?.menu = menu
        shortcut.action = { [weak self] in self?.captureSelection() }
        if !shortcut.register(model.preferences.shortcut) {
            model.message = "查词快捷键被占用，请在设置中换一个。"
        }
        let automatic = AutomaticSelection(preferences: model.preferences)
        automatic.onStatus = { [weak self] status in self?.model.selectionStatus = status }
        automatic.onChoose = { [weak self] text, add in
            guard let self, !model.saving else { return }
            model.showAdd = add
            showLookup(); model.lookup(text)
        }
        self.automatic = automatic
        applyAutomaticSelection()
        showLookup()
    }
    @objc private func toggleAutomaticSelection() {
        let enabled = !model.preferences.automaticSelection
        model.preferences.saveAutomaticSelection(enabled, excluded: model.preferences.excludedApplications)
        applyAutomaticSelection()
        if enabled && !SelectionReader.authorized { SelectionReader.requestPermission() }
    }
    private func applyAutomaticSelection() {
        automatic?.stop()
        automaticMenuItem?.state = model.preferences.automaticSelection ? .on : .off
        if model.preferences.automaticSelection { automatic?.start() }
    }
    private func installEditingMenu() {
        // A programmatic menu-bar app still needs responder actions for Cmd+V/C/A.
        let main = NSMenu()
        let appItem = NSMenuItem(); let appMenu = NSMenu()
        appMenu.addItem(NSMenuItem(title: "退出 Lexis", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        appItem.submenu = appMenu; main.addItem(appItem)
        let editItem = NSMenuItem(); let editMenu = NSMenu(title: "编辑")
        for (title, action, key) in [("撤销", "undo:", "z"), ("剪切", "cut:", "x"),
                                      ("复制", "copy:", "c"), ("粘贴", "paste:", "v"), ("全选", "selectAll:", "a")] {
            editMenu.addItem(NSMenuItem(title: title, action: Selector(action), keyEquivalent: key))
        }
        editItem.submenu = editMenu; main.addItem(editItem)
        NSApp.mainMenu = main
    }
    @objc func showLookup() {
        if panel == nil {
            let panel = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 640, height: 580),
                                styleMask: [.titled, .closable, .resizable], backing: .buffered, defer: false)
            panel.title = "Lexis"
            panel.level = .normal
            panel.isFloatingPanel = false
            panel.collectionBehavior = [.fullScreenAuxiliary, .moveToActiveSpace]
            panel.isReleasedWhenClosed = false
            panel.hidesOnDeactivate = false
            panel.contentMinSize = NSSize(width: 440, height: 400)
            panel.contentView = NSHostingView(rootView: LookupView(model: model, settings: { [weak self] in self?.showSettings() }))
            panel.setFrameAutosaveName("LexisLookup")
            if !panel.setFrameUsingName("LexisLookup") { panel.center() }
            panel.delegate = self
            self.panel = panel
        }
        NSApp.activate(ignoringOtherApps: true)
        panel?.makeKeyAndOrderFront(nil)
    }
    private func captureSelection() {
        guard !model.saving else { return }
        automatic?.invalidate()
        selectionTask?.cancel()
        let revision = UUID(); selectionRevision = revision
        guard SelectionReader.authorized else {
            showLookup(); SelectionReader.requestPermission(); return
        }
        guard let app = NSWorkspace.shared.frontmostApplication,
              app.processIdentifier != ProcessInfo.processInfo.processIdentifier else { showLookup(); return }
        let pid = app.processIdentifier
        selectionTask = Task { [weak self] in
            let value = await Task.detached(priority: .userInitiated) { await SelectionReader.readCompatible(pid: pid) }.value
            guard let self, !Task.isCancelled, selectionRevision == revision else { return }
            // Do not bring a late selection from an app the user has already left.
            guard NSWorkspace.shared.frontmostApplication?.processIdentifier == pid else { return }
            showLookup()
            if let value { model.lookup(value) }
            else { model.message = "这个软件没有提供可读取的选区。请直接输入，或复制后点击粘贴。" }
        }
    }
    @objc func showSettings() {
        if model.saving { return }
        if let settingsPanel { settingsPanel.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true); return }
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 510, height: 340),
                              styleMask: [.titled, .closable], backing: .buffered, defer: false)
        window.title = "Lexis 设置"; window.isReleasedWhenClosed = false; window.delegate = self
        window.level = .normal
        window.contentView = NSHostingView(rootView: ConnectionView(
            port: String(model.preferences.port), token: TokenStore.read(), shortcut: model.preferences.shortcut,
            automaticSelection: model.preferences.automaticSelection,
            excludedApplications: model.preferences.excludedApplications,
            save: { [weak self] port, token, choice, enabled, excluded in
                guard let self else { return }
                guard !token.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw SettingsError.emptyToken }
                let previous = model.preferences.shortcut
                if choice != previous && !shortcut.register(choice) { throw SettingsError.shortcutBusy }
                do { try TokenStore.save(token.trimmingCharacters(in: .whitespacesAndNewlines)) }
                catch { if choice != previous { _ = shortcut.register(previous) }; throw error }
                model.preferences.save(port: port, shortcut: choice)
                model.preferences.saveAutomaticSelection(enabled, excluded: excluded)
                applyAutomaticSelection()
                model.resetConnection()
                if choice == previous, !shortcut.register(choice) { model.message = "连接已保存。快捷键若无响应，请换一个组合。" }
            }, close: { [weak self] in self?.settingsPanel?.close() }))
        settingsPanel = window
        window.center(); NSApp.activate(ignoringOtherApps: true); window.makeKeyAndOrderFront(nil)
    }
    func windowWillClose(_ notification: Notification) {
        if let window = notification.object as? NSWindow, window === settingsPanel { settingsPanel = nil }
    }
    func applicationWillTerminate(_ notification: Notification) {
        selectionTask?.cancel(); shortcut.stop(); automatic?.stop()
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
    enum SettingsError: LocalizedError {
        case emptyToken, shortcutBusy
        var errorDescription: String? {
            self == .emptyToken ? "请填写令牌。" : "这个快捷键被占用，请换一个；原设置未更改。"
        }
    }
}
