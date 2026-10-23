import SwiftUI
import LexisCore

struct ConnectionView: View {
    @State var port: String
    @State var token: String
    @State var shortcut: String
    @State var automaticSelection: Bool
    @State var excludedApplications: [ExcludedApplication]
    @State private var message = ""
    let save: (Int, String, String, Bool, [ExcludedApplication]) throws -> Void
    let close: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Lexis 设置").font(.title2)
            Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 12) {
                GridRow { Text("端口"); TextField("12345", text: $port).frame(width: 110) }
                GridRow { Text("令牌"); SecureField("粘贴 Lexis 桥接令牌", text: $token).frame(minWidth: 280) }
                GridRow {
                    Text("查词快捷键")
                    Picker("查词快捷键", selection: $shortcut) {
                        ForEach(GlobalShortcut.choices, id: \.self) { Text(GlobalShortcut.label($0)).tag($0) }
                    }.labelsHidden()
                }
            }
            Text("仅连接 127.0.0.1。请打开 Obsidian 的 Lexis 桥接，填入相同端口与令牌。令牌保存在系统钥匙串。").font(.callout).foregroundStyle(.secondary)
            Button("授权读取选中文字") { SelectionReader.requestPermission() }
            Divider()
            Toggle("划词后显示药丸", isOn: $automaticSelection)
            ExcludedApplicationsView(applications: $excludedApplications)
                .disabled(!automaticSelection)
            Text("默认不排除任何外部 App。拖选或双击选词后显示药丸；不扫描屏幕、不自动复制，读不到选区时可按快捷键或手动粘贴。").font(.caption).foregroundStyle(.secondary)
            if !message.isEmpty { Text(message).font(.callout).foregroundStyle(.red) }
            HStack {
                Spacer()
                Button("取消", action: close).keyboardShortcut(.cancelAction)
                Button("保存") {
                    guard let value = Int(port), (1...65535).contains(value) else { message = "端口应为 1–65535。"; return }
                    do { try save(value, token, shortcut, automaticSelection, excludedApplications); close() }
                    catch { message = error.localizedDescription }
                }.keyboardShortcut(.defaultAction)
            }
        }.padding(24).frame(width: 460)
    }
}
