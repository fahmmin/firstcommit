// Tiny toast bus — push({text, kind}) renders in the <Toasts/> container.
import { useSyncExternalStore } from 'react'

let toasts = []
let seq = 0
const listeners = new Set()
const emit = () => listeners.forEach(fn => fn())

export const toast = {
  push(text, kind = 'ok') {
    const id = ++seq
    toasts = [...toasts, { id, text, kind }]
    emit()
    setTimeout(() => { toasts = toasts.filter(t => t.id !== id); emit() }, 3200)
  },
  subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn) },
  getAll: () => toasts,
}

export function useToasts() {
  return useSyncExternalStore(toast.subscribe, toast.getAll)
}
