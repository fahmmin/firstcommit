// DiceBear moods — seeded per agent so each specialist gets a stable face.
export const avatarUrl = (seed) =>
  `https://api.dicebear.com/10.x/moods/svg?seed=${encodeURIComponent(seed || 'sahayak')}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`

export function AgentAvatar({ seed, size = 32, className = '' }) {
  return (
    <img src={avatarUrl(seed)} alt={seed}
      width={size} height={size}
      className={`rounded-xl bg-sky/30 shrink-0 ${className}`}
      loading="lazy" />
  )
}
