// Auth session — token + user live in localStorage. Provider adapters
// (Google / phone OTP) are thin client-side seams; /auth/login + tenant
// resolution are real.
const KEY = 'sahayak_session'

export const session = {
  get: () => { try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null } },
  set: (s) => localStorage.setItem(KEY, JSON.stringify(s)),
  clear: () => localStorage.removeItem(KEY),
}

export const isAuthed = () => !!session.get()?.token
