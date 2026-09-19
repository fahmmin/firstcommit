// The Sahayak mark — 4-color blob cluster (gumloop-style). One component,
// everywhere: landing, app sidebar, docs, login, onboarding, share pages.
export function Blobs({ size = 'md' }) {
  const s = size === 'lg' ? 'w-6 h-6' : size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'
  return (
    <div className="flex items-end gap-1">
      <span className={`${s} rounded-full bg-[#a325fc]`} />
      <span className={`${s} rounded-full rounded-bl-md bg-[#1aaf50]`} />
      <span className={`${s} rounded-md rotate-12 bg-[#86cefc]`} />
      <span className={`${s} rounded-full rounded-tr-md bg-[#d4428f]`} />
    </div>
  )
}
