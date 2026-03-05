import Cocoa

// MARK: - Settings Model

struct Settings: Codable {
    var scriptNames: [String]
    var autoRestart: Bool
    var maxCrashCount: Int
    var notifications: Bool
    var launchAtLogin: Bool
    var globalShortcut: String
    var maxLogLines: Int
    var savedFolders: [String]
    var favoriteEditor: String

    static let defaults = Settings(
        scriptNames: ["dev", "start"],
        autoRestart: true,
        maxCrashCount: 50,
        notifications: true,
        launchAtLogin: false,
        globalShortcut: "CommandOrControl+Shift+S",
        maxLogLines: 5000,
        savedFolders: [],
        favoriteEditor: "code"
    )
}

let settingsPath: String = {
    let home = FileManager.default.homeDirectoryForCurrentUser.path
    return "\(home)/.config/suparun/settings.json"
}()

func loadSettings() -> Settings {
    guard let data = FileManager.default.contents(atPath: settingsPath),
          let settings = try? JSONDecoder().decode(Settings.self, from: data) else {
        return Settings.defaults
    }
    return settings
}

func saveSettings(_ settings: Settings) {
    let dir = (settingsPath as NSString).deletingLastPathComponent
    try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
    if let data = try? JSONEncoder().encode(settings) {
        let json = try? JSONSerialization.jsonObject(with: data)
        if let pretty = try? JSONSerialization.data(withJSONObject: json as Any, options: .prettyPrinted) {
            FileManager.default.createFile(atPath: settingsPath, contents: pretty)
        }
    }
}

// MARK: - Editors

let editors: [(label: String, value: String)] = [
    ("VS Code", "code"),
    ("Cursor", "cursor"),
    ("Zed", "zed"),
    ("WebStorm", "webstorm"),
    ("Sublime Text", "subl"),
]

// MARK: - App & Window

class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    var settings: Settings!

    // Controls
    var editorPopup: NSPopUpButton!
    var autoRestartCheckbox: NSButton!
    var notificationsCheckbox: NSButton!
    var launchAtLoginCheckbox: NSButton!
    var maxCrashField: NSTextField!
    var scriptTagsField: NSTextField!

    func applicationDidFinishLaunching(_ notification: Notification) {
        settings = loadSettings()

        let width: CGFloat = 420
        let height: CGFloat = 380
        let rect = NSRect(x: 0, y: 0, width: width, height: height)

        window = NSWindow(
            contentRect: rect,
            styleMask: [.titled, .closable],
            backing: .buffered,
            defer: false
        )
        window.title = "Suparun Settings"
        window.center()
        window.isReleasedWhenClosed = false

        let contentView = NSView(frame: rect)
        window.contentView = contentView

        var y: CGFloat = height - 50
        let labelX: CGFloat = 24
        let controlX: CGFloat = 180
        let controlWidth: CGFloat = 200
        let rowHeight: CGFloat = 32

        // --- Favorite Editor ---
        addLabel("Favorite Editor:", at: NSPoint(x: labelX, y: y), in: contentView)
        editorPopup = NSPopUpButton(frame: NSRect(x: controlX, y: y - 2, width: controlWidth, height: 26))
        editorPopup.removeAllItems()
        for editor in editors {
            editorPopup.addItem(withTitle: editor.label)
        }
        if let idx = editors.firstIndex(where: { $0.value == settings.favoriteEditor }) {
            editorPopup.selectItem(at: idx)
        }
        editorPopup.target = self
        editorPopup.action = #selector(editorChanged)
        contentView.addSubview(editorPopup)

        y -= rowHeight + 12

        // --- Auto-restart ---
        autoRestartCheckbox = NSButton(checkboxWithTitle: "Auto-restart on crash", target: self, action: #selector(autoRestartChanged))
        autoRestartCheckbox.frame = NSRect(x: labelX, y: y, width: 300, height: 20)
        autoRestartCheckbox.state = settings.autoRestart ? .on : .off
        contentView.addSubview(autoRestartCheckbox)

        y -= rowHeight

        // --- Notifications ---
        notificationsCheckbox = NSButton(checkboxWithTitle: "Notifications", target: self, action: #selector(notificationsChanged))
        notificationsCheckbox.frame = NSRect(x: labelX, y: y, width: 300, height: 20)
        notificationsCheckbox.state = settings.notifications ? .on : .off
        contentView.addSubview(notificationsCheckbox)

        y -= rowHeight

        // --- Launch at Login ---
        launchAtLoginCheckbox = NSButton(checkboxWithTitle: "Launch at login", target: self, action: #selector(launchAtLoginChanged))
        launchAtLoginCheckbox.frame = NSRect(x: labelX, y: y, width: 300, height: 20)
        launchAtLoginCheckbox.state = settings.launchAtLogin ? .on : .off
        contentView.addSubview(launchAtLoginCheckbox)

        y -= rowHeight + 12

        // --- Max Crash Count ---
        addLabel("Max crash restarts:", at: NSPoint(x: labelX, y: y), in: contentView)
        maxCrashField = NSTextField(frame: NSRect(x: controlX, y: y - 2, width: 60, height: 22))
        maxCrashField.stringValue = "\(settings.maxCrashCount)"
        maxCrashField.formatter = NumberFormatter()
        maxCrashField.target = self
        maxCrashField.action = #selector(maxCrashChanged)
        contentView.addSubview(maxCrashField)

        y -= rowHeight + 12

        // --- Script Names ---
        addLabel("Script names:", at: NSPoint(x: labelX, y: y), in: contentView)
        scriptTagsField = NSTextField(frame: NSRect(x: controlX, y: y - 2, width: controlWidth, height: 22))
        scriptTagsField.stringValue = settings.scriptNames.joined(separator: ", ")
        scriptTagsField.placeholderString = "dev, start, build"
        scriptTagsField.target = self
        scriptTagsField.action = #selector(scriptNamesChanged)
        contentView.addSubview(scriptTagsField)

        y -= rowHeight

        let hint = NSTextField(labelWithString: "Comma-separated list of script names to scan")
        hint.frame = NSRect(x: controlX, y: y, width: controlWidth, height: 16)
        hint.font = NSFont.systemFont(ofSize: 10)
        hint.textColor = .secondaryLabelColor
        contentView.addSubview(hint)

        y -= rowHeight + 8

        // --- Global Shortcut (read-only) ---
        addLabel("Global shortcut:", at: NSPoint(x: labelX, y: y), in: contentView)
        let shortcutLabel = NSTextField(labelWithString: settings.globalShortcut)
        shortcutLabel.frame = NSRect(x: controlX, y: y, width: controlWidth, height: 18)
        shortcutLabel.textColor = .secondaryLabelColor
        shortcutLabel.font = NSFont.monospacedSystemFont(ofSize: 12, weight: .regular)
        contentView.addSubview(shortcutLabel)

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func addLabel(_ text: String, at point: NSPoint, in view: NSView) {
        let label = NSTextField(labelWithString: text)
        label.frame = NSRect(x: point.x, y: point.y, width: 150, height: 18)
        label.font = NSFont.systemFont(ofSize: 13)
        label.textColor = .labelColor
        view.addSubview(label)
    }

    // MARK: - Actions

    @objc func editorChanged() {
        let idx = editorPopup.indexOfSelectedItem
        if idx >= 0 && idx < editors.count {
            settings.favoriteEditor = editors[idx].value
            saveSettings(settings)
        }
    }

    @objc func autoRestartChanged() {
        settings.autoRestart = autoRestartCheckbox.state == .on
        saveSettings(settings)
    }

    @objc func notificationsChanged() {
        settings.notifications = notificationsCheckbox.state == .on
        saveSettings(settings)
    }

    @objc func launchAtLoginChanged() {
        settings.launchAtLogin = launchAtLoginCheckbox.state == .on
        saveSettings(settings)
    }

    @objc func maxCrashChanged() {
        if let val = Int(maxCrashField.stringValue), val > 0 {
            settings.maxCrashCount = val
            saveSettings(settings)
        }
    }

    @objc func scriptNamesChanged() {
        let names = scriptTagsField.stringValue
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        settings.scriptNames = names
        saveSettings(settings)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
}

// MARK: - Main

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
