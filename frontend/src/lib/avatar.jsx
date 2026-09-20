// DiceBear moods — seeded per agent so each specialist gets a stable face.
export const avatarUrl = (seed) =>
  `https://api.dicebear.com/10.x/moods/svg?seed=${encodeURIComponent(seed || 'sahayak')}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`

// Stable accent color per agent — chat attribution, chips, active states.
const AGENT_PALETTE = ['#a325fc', '#1aaf50', '#3b82f6', '#d4428f', '#f59e0b', '#0d9488', '#e11d48', '#7c3aed']
export function agentColor(id) {
  let h = 0
  for (const ch of String(id || 'sahayak')) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AGENT_PALETTE[h % AGENT_PALETTE.length]
}

export function AgentAvatar({ seed, size = 32, className = '' }) {
  return (
    <img src={avatarUrl(seed)} alt={seed}
      width={size} height={size} style={{ width: size, height: size }}
      className={`rounded-xl bg-sky/30 shrink-0 self-start ${className}`}
      loading="lazy" />
  )
}
