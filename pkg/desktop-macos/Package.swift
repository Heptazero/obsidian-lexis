// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "LexisDesktop",
    platforms: [.macOS(.v13)],
    products: [.executable(name: "LexisDesktop", targets: ["LexisDesktop"])],
    targets: [
        .target(name: "LexisCore"),
        .executableTarget(name: "LexisDesktop", dependencies: ["LexisCore"]),
        .executableTarget(name: "LexisChecks", dependencies: ["LexisCore"], path: "Tests/LexisCoreTests")
    ]
)
