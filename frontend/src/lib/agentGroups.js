// Sidebar grouping for the agent roster — shared by Workspace and AppShell.
// Partition, not independent filters: each agent lands in the FIRST group it
// matches, leftovers fall through to "Other" — no agent appears twice.
export const GROUP_ORDER = [['Money', a => ['vasool', 'khata'].includes(a.id)],
                            ['Procurement', a => a.id === 'sourcer'],
                            ['Hired by AI', a => a.created_by === 'factory']]

export function groupAgents(agents) {
  const placed = new Set()
  const groups = GROUP_ORDER
    .map(([label, match]) => [label, agents.filter(a => !placed.has(a.id) && match(a) && placed.add(a.id))])
    .filter(([, l]) => l.length)
  const rest = agents.filter(a => !placed.has(a.id))
  if (rest.length) groups.push(['Other', rest])
  return groups
}
