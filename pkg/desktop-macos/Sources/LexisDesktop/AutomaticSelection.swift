import AppKit
import LexisCore

/// One AX read at a time. Mouse gestures coalesce; late replies never reopen a pill.
@MainActor final class AutomaticSelection {
    private let preferences: Preferences
    private let pill = SelectionPill()
    private var globalMonitor: Any?, keyMonitor: Any?, localMonitor: Any?, activation: NSObjectProtocol?
    private var gesture = SelectionGesture()
    private var revision = UUID()
    private var debounce: Task<Void, Never>?
    private var reading = false
    private var pending: Request?
    private struct Request { let pid: pid_t; let point: CGPoint; let axPoint: CGPoint; let revision: UUID }
    var onChoose: ((String, Bool) -> Void)? {
        didSet { pill.action = onChoose }
    }
    var onStatus: ((String) -> Void)?
    init(preferences: Preferences) { self.preferences = preferences }
    func start() {
        guard globalMonitor == nil else { return }
        // Mouse observation must not depend on keyboard-monitor authorization.
        globalMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown, .leftMouseUp, .rightMouseDown, .scrollWheel]) { [weak self] event in
            self?.receive(event)
        }
        if SelectionReader.authorized {
            keyMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.keyDown]) { [weak self] _ in self?.invalidate() }
        }
        onStatus?(globalMonitor == nil ? "无法建立鼠标监听：请重新启动 Lexis" : SelectionReader.authorized ? "辅助功能已授权 · 等待划词" : "辅助功能未授权：请在系统设置中允许 Lexis Desktop")
        localMonitor = NSEvent.addLocalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown, .scrollWheel, .keyDown]) { [weak self] event in
            guard let self else { return event }
            if event.type == .scrollWheel || event.type == .keyDown || !(pill.frame?.contains(NSEvent.mouseLocation) ?? false) {
                invalidate()
            }
            return event // Never swallow source-app events or pill clicks.
        }
        activation = NSWorkspace.shared.notificationCenter.addObserver(forName: NSWorkspace.didActivateApplicationNotification, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.invalidate() }
        }
    }
    func invalidate() {
        revision = UUID(); pending = nil; debounce?.cancel(); debounce = nil
        gesture.reset(); pill.hide()
    }
    private func allowed(_ app: NSRunningApplication) -> Bool {
        SelectionReader.authorized && SelectionPolicy.allows(enabled: preferences.automaticSelection,
            sourcePID: app.processIdentifier, ownPID: ProcessInfo.processInfo.processIdentifier,
            bundleID: app.bundleIdentifier, excluded: preferences.excludedApplications)
    }
    private func receive(_ event: NSEvent) {
        guard event.type != .scrollWheel, event.type != .rightMouseDown, event.type != .keyDown else { invalidate(); return }
        guard let app = NSWorkspace.shared.frontmostApplication, allowed(app) else {
            invalidate()
            if !SelectionReader.authorized { onStatus?("辅助功能未授权：更新临时签名后可能需要重新添加授权") }
            return
        }
        let point = NSEvent.mouseLocation
        if event.type == .leftMouseDown {
            invalidate(); gesture.begin(point: point, pid: app.processIdentifier)
        } else if gesture.finish(point: point, pid: app.processIdentifier, clicks: event.clickCount) {
            let top = NSScreen.screens.first?.frame.maxY ?? 0
            pending = Request(pid: app.processIdentifier, point: point,
                              axPoint: CGPoint(x: point.x, y: top - point.y), revision: revision)
            schedule()
        }
    }
    private func schedule() {
        debounce?.cancel()
        debounce = Task { [weak self] in
            do { try await Task.sleep(nanoseconds: 180_000_000) } catch { return }
            self?.readPending()
        }
    }
    private func readPending() {
        guard !reading, let request = pending else { return }
        pending = nil; reading = true
        onStatus?("已检测划词 · 正在读取选区")
        Task { [weak self] in
            let text = await Task.detached(priority: .userInitiated) {
                await SelectionReader.readCompatible(pid: request.pid, at: request.axPoint)
            }.value
            guard let self else { return }
            reading = false
            if revision == request.revision, let app = NSWorkspace.shared.frontmostApplication,
               app.processIdentifier == request.pid, allowed(app), NSEvent.pressedMouseButtons == 0 {
                if let text { pill.show(text: text, point: request.point); onStatus?("已读到选区 · 已显示药丸") }
                else { onStatus?("未读到选区：该文字层未提供可读取选区，可尝试快捷键或手动粘贴") }
            }
            if pending != nil { schedule() }
        }
    }
    func stop() {
        invalidate()
        if let globalMonitor { NSEvent.removeMonitor(globalMonitor) }
        if let keyMonitor { NSEvent.removeMonitor(keyMonitor) }
        if let localMonitor { NSEvent.removeMonitor(localMonitor) }
        if let activation { NSWorkspace.shared.notificationCenter.removeObserver(activation) }
        globalMonitor = nil; keyMonitor = nil; localMonitor = nil; activation = nil
        onStatus?("自动划词已暂停")
    }
}
