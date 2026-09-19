// Accessibility + appearance store — persists to localStorage and applies
// via data-* attributes on <html>; index.css owns the visual rules.
// theme: light | dark   font: normal | large | xl   contrast: normal | high
// motion: full | reduced
const KEY = 'sahayak_a11y'

const DEFAULTS = { theme: 'light', font: 'normal', contrast: 'normal', motion: 'full' }

export const a11y = {
  get() {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') } }
    catch { return { ...DEFAULTS } }
  },
  set(patch) {
    const v = { ...a11y.get(), ...patch }
    localStorage.setItem(KEY, JSON.stringify(v))
    a11y.apply(v)
    return v
  },
  apply(v = a11y.get()) {
    const r = document.documentElement
    r.dataset.theme = v.theme
    r.dataset.font = v.font
    r.dataset.contrast = v.contrast
    r.dataset.motion = v.motion
  },
  toggleTheme() {
    return a11y.set({ theme: a11y.get().theme === 'dark' ? 'light' : 'dark' }).theme
  },
}
