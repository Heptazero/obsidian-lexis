import SwiftUI
import UniformTypeIdentifiers
import LexisCore

struct ExcludedApplicationsView: View {
    @Binding var applications: [ExcludedApplication]
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("不显示药丸的 App").font(.callout)
                Spacer()
                Button { choose() } label: { Image(systemName: "plus") }
                    .help("选择要排除的 App").accessibilityLabel("选择要排除的 App")
            }
            if applications.isEmpty {
                Text("未排除任何 App").font(.caption).foregroundStyle(.secondary)
            } else {
                ScrollView {
                    VStack(spacing: 6) {
                        ForEach(applications) { app in
                            HStack {
                                Text(app.name).lineLimit(1).help(app.bundleID)
                                Spacer()
                                Button { applications.removeAll { $0.id == app.id } } label: { Image(systemName: "xmark") }
                                    .help("取消排除，不删除 App").accessibilityLabel("取消排除 \(app.name)")
                            }
                        }
                    }
                }.frame(maxHeight: 100)
            }
        }
    }
    private func choose() {
        let picker = NSOpenPanel()
        picker.title = "选择不显示 Lexis 药丸的 App"
        picker.allowedContentTypes = [.applicationBundle]
        picker.canChooseFiles = true; picker.canChooseDirectories = false
        picker.allowsMultipleSelection = true; picker.level = .floating
        picker.begin { response in
            guard response == .OK else { return }
            for url in picker.urls {
                guard let bundle = Bundle(url: url), let id = bundle.bundleIdentifier,
                      !applications.contains(where: { $0.id == id }) else { continue }
                let name = FileManager.default.displayName(atPath: url.path).replacingOccurrences(of: ".app", with: "")
                applications.append(ExcludedApplication(bundleID: id, name: name))
            }
        }
    }
}
