#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const assert = require('assert')

const repoRoot = path.resolve(__dirname, '..')

function loadScript(relativePath) {
  const fullPath = path.join(repoRoot, relativePath)
  const src = fs.readFileSync(fullPath, 'utf8')
  vm.runInThisContext(src, { filename: relativePath })
}

function makeChromeStub() {
  const store = {}
  const area = {
    get(keys, cb) {
      if (Array.isArray(keys)) {
        const out = {}
        for (const k of keys) out[k] = store[k]
        cb(out)
        return
      }

      if (typeof keys === 'string') {
        cb({ [keys]: store[keys] })
        return
      }

      if (keys && typeof keys === 'object') {
        const out = {}
        for (const k of Object.keys(keys)) {
          out[k] = (k in store) ? store[k] : keys[k]
        }
        cb(out)
        return
      }

      cb({})
    },
    set(items, cb) {
      Object.assign(store, items)
      cb && cb()
    },
    remove(keys, cb) {
      const arr = Array.isArray(keys) ? keys : [keys]
      for (const k of arr) delete store[k]
      cb && cb()
    }
  }

  return {
    runtime: { lastError: null },
    storage: { sync: area, local: area },
    i18n: { getMessage: (k) => k }
  }
}

global.chrome = makeChromeStub()
global.StringUtils = {
  newUUID() { return 'uuid-test' }
}

global.CSSRule = { STYLE_RULE: 1 }

loadScript('js/shared/chrome_storage.js')
loadScript('js/shared/chrome_highlight_storage.js')

// 1) storage key/default
assert.strictEqual(ChromeStorage.KEYS.FORCE_SAFE_BLEND_MODE, 'forceSafeBlendMode')
assert.strictEqual(ChromeStorage.DEFAULTS[ChromeStorage.KEYS.FORCE_SAFE_BLEND_MODE], false)

// 2) factory defaults
const defaultStyle = HighlightDefinitionFactory.DEFAULT_VALUES[HighlightDefinitionFactory.KEYS.STYLE]
assert.strictEqual(defaultStyle['mix-blend-mode'], 'multiply')
assert.strictEqual(defaultStyle['background-alpha'], 0.7)

// 3) migration backfill
const storage = new ChromeHighlightStorage()
const input = [{
  title: 'Old Style',
  className: 'old-style',
  inherit_style_color: false,
  style: {
    'background-color': '#ff8080',
    'color': '#000000'
  }
}]
const migrated = storage.migrateHighlightDefinitions(input)
assert.strictEqual(migrated.changed, true)
assert.strictEqual(migrated.highlightDefinitions[0].style['mix-blend-mode'], 'multiply')
assert.strictEqual(migrated.highlightDefinitions[0].style['background-alpha'], 0.7)

// 4) locale key presence
const en = JSON.parse(fs.readFileSync(path.join(repoRoot, '_locales/en/messages.json'), 'utf8'))
const enGb = JSON.parse(fs.readFileSync(path.join(repoRoot, '_locales/en_GB/messages.json'), 'utf8'))
for (const key of [
  'highlight_opacity_per_style',
  'highlight_overlap_blend_mode',
  'highlight_overlap_blend_mode_help',
  'highlight_force_safe_blend_mode'
]) {
  assert.ok(en[key], `Missing en key: ${key}`)
  assert.ok(enGb[key], `Missing en_GB key: ${key}`)
}

console.log('All minimal automated checks passed.')
