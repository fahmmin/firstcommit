// Sidebar grouping for the agent roster — shared by Workspace and AppShell.
export const GROUP_ORDER = [['Money', a => ['vasool', 'khata'].includes(a.id)],
                            ['Procurement', a => a.id === 'sourcer'],
                            ['Hired by AI', a => a.created_by === 'factory'],
                            ['Other', () => true]]
