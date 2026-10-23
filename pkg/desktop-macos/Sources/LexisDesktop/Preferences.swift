import Foundation
import Security
import LexisCore

enum TokenStore {
    private static var query: [String: Any] { [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: "com.heptazero.lexis-desktop.bridge",
        kSecAttrAccount as String: "local-bridge"
    ] }
    static func read() -> String {
        var request = query
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        guard SecItemCopyMatching(request as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return "" }
        return String(data: data, encoding: .utf8) ?? ""
    }
    static func save(_ token: String) throws {
        let data = Data(token.utf8)
        var status = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if status == errSecItemNotFound {
            var item = query
            item[kSecValueData as String] = data
            item[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
            status = SecItemAdd(item as CFDictionary, nil)
        }
        guard status == errSecSuccess else { throw StoreError.failed }
    }
    enum StoreError: LocalizedError {
        case failed
        var errorDescription: String? { "无法保存到系统钥匙串，连接设置没有更改。" }
    }
}

struct Preferences {
    let defaults = UserDefaults.standard
    var port: Int {
        let value = defaults.integer(forKey: "bridgePort")
        return value == 0 ? 12345 : value
    }
    var shortcut: String { defaults.string(forKey: "shortcut") ?? "control-option-l" }
    var automaticSelection: Bool {
        defaults.object(forKey: "automaticSelection") == nil || defaults.bool(forKey: "automaticSelection")
    }
    var excludedApplications: [ExcludedApplication] {
        guard let data = defaults.data(forKey: "excludedApplications") else { return [] }
        return (try? JSONDecoder().decode([ExcludedApplication].self, from: data)) ?? []
    }
    func saveAutomaticSelection(_ enabled: Bool, excluded: [ExcludedApplication]) {
        defaults.set(enabled, forKey: "automaticSelection")
        defaults.set(try? JSONEncoder().encode(excluded), forKey: "excludedApplications")
    }
    func save(port: Int, shortcut: String) {
        defaults.set(port, forKey: "bridgePort"); defaults.set(shortcut, forKey: "shortcut")
    }
    // Scope last destination to the vault and bridge port, not a single global folder.
    func folder(port: Int, vault: String) -> String? {
        defaults.string(forKey: "destination:\(port):\(vault)")
    }
    func saveFolder(_ folder: String, port: Int, vault: String) {
        defaults.set(folder, forKey: "destination:\(port):\(vault)")
    }
}
