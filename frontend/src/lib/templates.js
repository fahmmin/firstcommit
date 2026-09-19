// Prompt templates — one-click starting points for owners.
// Clicking a card drops its prompt into the composer for editing before Generate.
// `bg` = CSS mesh-gradient backdrop for the card header band.
import {
  FileWarning, BarChart3, Truck, Bot, PackageSearch, Scale,
  CalendarClock, Users, IndianRupee, Store, Globe,
} from 'lucide-react'

const mesh = (a, b, c) => ({
  background: `radial-gradient(at 15% 25%, ${a} 0, transparent 55%), radial-gradient(at 85% 15%, ${b} 0, transparent 50%), radial-gradient(at 60% 90%, ${c} 0, transparent 55%), linear-gradient(150deg, ${a}44, ${c}33)`,
})

export const TEMPLATES = [
  {
    id: 'hire-presence',
    icon: Globe, tint: 'text-blue-600 bg-white/80', featured: true,
    cat: 'Presence', agent: 'nirmata',
    bg: mesh('#93c5fd', '#c4b5fd', '#fbcfe8'),
    title: 'Digital presence agent',
    desc: 'Facebook Marketplace, IndiaMART, Shopify store + SEO/GEO — one agent',
    prompt: 'I want to sell online. Hire an agent that publishes my products to Facebook Marketplace and IndiaMART, builds me a web storefront, and keeps my listings SEO-optimized.',
  },
  {
    id: 'chase-overdue',
    icon: FileWarning, tint: 'text-rose-500 bg-white/80',
    cat: 'Money', agent: 'vasool',
    bg: mesh('#fda4af', '#fecdd3', '#fff1f2'),
    title: 'Chase overdue payments',
    desc: 'Vasool finds what is late and drafts the reminder',
    prompt: 'Show my overdue invoices and draft a polite reminder for the oldest one.',
  },
  {
    id: 'aging-report',
    icon: BarChart3, tint: 'text-sky-600 bg-white/80',
    cat: 'Money', agent: 'vasool',
    bg: mesh('#7dd3fc', '#bae6fd', '#f0f9ff'),
    title: 'Receivables aging report',
    desc: '0–30 / 31–60 / 61–90 / 90+ day buckets',
    prompt: 'Give me my receivables aging report — who owes what and how late.',
  },
  {
    id: 'terms-advisor',
    icon: Scale, tint: 'text-violet-600 bg-white/80',
    cat: 'Money', agent: 'khata',
    bg: mesh('#c4b5fd', '#ddd6fe', '#f5f3ff'),
    title: 'Should I take 90-day terms?',
    desc: 'Khata weighs a big order against cash flow',
    prompt: 'A buyer offers 90-day payment terms on a ₹2 lakh order. Should I take it?',
  },
  {
    id: 'cashflow-gap',
    icon: IndianRupee, tint: 'text-emerald-600 bg-white/80',
    cat: 'Money', agent: 'khata',
    bg: mesh('#6ee7b7', '#a7f3d0', '#ecfdf5'),
    title: 'Cash-flow check',
    desc: 'Next 30 days of inflows vs payables',
    prompt: 'Show my cash flow for the next 30 days and warn me where money gets tight.',
  },
  {
    id: 'track-order',
    icon: Truck, tint: 'text-amber-600 bg-white/80',
    cat: 'Logistics', agent: 'logistics-agent',
    bg: mesh('#fcd34d', '#fde68a', '#fffbeb'),
    title: 'Track an incoming order',
    desc: 'Logistics agent keeps a shipment on watch',
    prompt: 'My order is on the way — keep it on track. Which carrier is bringing it and when will it reach?',
  },
  {
    id: 'hire-logistics',
    icon: Bot, tint: 'text-magenta bg-white/80',
    cat: 'New agent', agent: 'nirmata',
    bg: mesh('#f0abfc', '#fbcfe8', '#fdf4ff'),
    title: 'Hire a logistics agent',
    desc: 'The magic moment — Nirmata builds one live',
    prompt: 'Mera transporter nahi aaya, mera order stranded hai. I need someone to handle pickups and deliveries.',
  },
  {
    id: 'hire-festival',
    icon: Store, tint: 'text-orange-600 bg-white/80',
    cat: 'New agent', agent: 'nirmata',
    bg: mesh('#fdba74', '#fed7aa', '#fff7ed'),
    title: 'Hire a festival-stock agent',
    desc: 'An agent that watches stock before Diwali',
    prompt: 'Diwali is coming and I keep running out of fast-moving stock. Hire an agent who watches inventory and tells me what to order early.',
  },
  {
    id: 'compare-suppliers',
    icon: PackageSearch, tint: 'text-blue-600 bg-white/80',
    cat: 'Procurement', agent: 'sourcer',
    bg: mesh('#93c5fd', '#bfdbfe', '#eff6ff'),
    title: 'Compare suppliers',
    desc: 'Sourcer ranks price vs trust score',
    prompt: 'I need 50 kg of steel rods. Compare my suppliers — cheapest trustworthy option?',
  },
  {
    id: 'moq-pool',
    icon: Users, tint: 'text-teal-600 bg-white/80',
    cat: 'Procurement', agent: 'sourcer',
    bg: mesh('#5eead4', '#99f6e4', '#f0fdfa'),
    title: 'Beat the MOQ',
    desc: 'Pool a small order with other buyers',
    prompt: 'I only need 20 units but the supplier MOQ is 50. Can I pool with other buyers?',
  },
  {
    id: 'schedule-reminder',
    icon: CalendarClock, tint: 'text-slate-600 bg-white/80',
    cat: 'Money', agent: 'vasool',
    bg: mesh('#cbd5e1', '#e2e8f0', '#f8fafc'),
    title: 'Auto-remind before due date',
    desc: 'Set a trigger — human approves before send',
    prompt: 'Remind Sharma Traders 3 days before their invoice is due, every time.',
  },
]
