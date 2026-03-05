const { execSync } = require('child_process')
const { join } = require('path')
const { existsSync } = require('fs')

const plistPath = join(__dirname, '..', 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents', 'Info.plist')

if (!existsSync(plistPath)) {
  console.log('[patch] Electron.app Info.plist not found, skipping')
  process.exit(0)
}

const name = 'Suparun'

try {
  execSync(`/usr/libexec/PlistBuddy -c "Set :CFBundleName ${name}" "${plistPath}"`)
  execSync(`/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName ${name}" "${plistPath}"`)
  console.log(`[patch] Electron.app menu bar name set to "${name}"`)
} catch (err) {
  console.error('[patch] Failed to patch Electron.app plist:', err.message)
}
