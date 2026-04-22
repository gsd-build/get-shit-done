# iOS App Scaffold Reference

Rules and patterns for scaffolding iOS applications. Apply when any plan involves creating a new iOS app target.

---

## Critical Rule: Never Use Package.swift as the Primary Build System for iOS Apps

**NEVER use `Package.swift` with `.executableTarget` (or `.target`) to scaffold an iOS app.** Swift Package Manager executable targets compile as macOS command-line tools — they do not produce `.app` bundles, cannot be signed for iOS devices, and cannot be submitted to the App Store.

**Prohibited pattern:**
```swift
// Package.swift — DO NOT USE for iOS apps
.executableTarget(name: "MyApp", dependencies: [])
// or
.target(name: "MyApp", dependencies: [])
```

Using this pattern produces a macOS CLI binary, not an iOS app. The app will not build for any iOS simulator or device.

---

## Required Pattern: XcodeGen

All iOS app scaffolding MUST use XcodeGen to generate the `.xcodeproj`.

### Step 1 — Install XcodeGen (if not present)

```bash
brew install xcodegen
```

### Step 2 — Create `project.yml`

`project.yml` is the XcodeGen spec that describes the project structure. Minimum viable spec:

```yaml
name: MyApp
options:
  bundleIdPrefix: com.example
  deploymentTarget:
    iOS: "17.0"
settings:
  SWIFT_VERSION: "5.10"
  IPHONEOS_DEPLOYMENT_TARGET: "17.0"
targets:
  MyApp:
    type: application
    platform: iOS
    sources: [Sources/MyApp]
    settings:
      PRODUCT_BUNDLE_IDENTIFIER: com.example.MyApp
      INFOPLIST_FILE: Sources/MyApp/Info.plist
    scheme:
      testTargets:
        - MyAppTests
  MyAppTests:
    type: bundle.unit-test
    platform: iOS
    sources: [Tests/MyAppTests]
    dependencies:
      - target: MyApp
```

### Step 3 — Generate the .xcodeproj

```bash
xcodegen generate
```

This creates `MyApp.xcodeproj` in the project root. Commit `project.yml` but add `*.xcodeproj` to `.gitignore` (regenerate on checkout).

### Step 4 — Standard project layout

```
MyApp/
├── project.yml              # XcodeGen spec — commit this
├── .gitignore               # includes *.xcodeproj
├── Sources/
│   └── MyApp/
│       ├── MyAppApp.swift   # @main entry point
│       ├── ContentView.swift
│       └── Info.plist
└── Tests/
    └── MyAppTests/
        └── MyAppTests.swift
```

---

## iOS Deployment Target Compatibility

Always verify SwiftUI API availability against the project's `IPHONEOS_DEPLOYMENT_TARGET` before using any SwiftUI component.

| API | Minimum iOS |
|-----|-------------|
| `NavigationView` | iOS 13 |
| `NavigationStack` | iOS 16 |
| `NavigationSplitView` | iOS 16 |
| `List(selection:)` with multi-select | iOS 17 |
| `ScrollView` scroll position APIs | iOS 17 |
| `Observable` macro (`@Observable`) | iOS 17 |
| `SwiftData` | iOS 17 |
| `@Bindable` | iOS 17 |
| `TipKit` | iOS 17 |

**Rule:** If a plan requires a SwiftUI API that exceeds the project's deployment target, either:
1. Raise the deployment target in `project.yml` (and document the decision), or
2. Wrap the call in `if #available(iOS NN, *) { ... }` with a fallback implementation.

Do NOT silently use an API that requires a higher iOS version than the declared deployment target — the app will crash at runtime on older devices.

---

## Verification

After running `xcodegen generate`, verify the project builds:

```bash
xcodebuild -project MyApp.xcodeproj -scheme MyApp -destination 'platform=iOS Simulator,name=iPhone 16' build
```

A successful build (exit code 0) confirms the scaffold is valid for iOS.
