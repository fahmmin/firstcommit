// Prompt templates — one-click starting points for owners.
// Clicking a card drops its prompt into the composer for editing before Generate.
import {
  FileWarning, BarChart3, Truck, Bot, PackageSearch, Scale,
  CalendarClock, Users, IndianRupee, Store, Globe,
} from 'lucide-react'

export const TEMPLATES = [
  {
    id: 'hire-presence',
    icon: Globe, tint: 'text-blue-600 bg-blue-50', featured: true,
    title: 'Digital presence agent',
    desc: 'Facebook Marketplace, IndiaMART, Shopify store + SEO/GEO — one agent',
    prompt: 'I want to sell online. Hire an agent that publishes my products to Facebook Marketplace and IndiaMART, builds me a web storefront, and keeps my listings SEO-optimized.',
  },
  {
    id: 'chase-overdue',
    icon: FileWarning, tint: 'text-rose-500 bg-rose-50',
    title: 'Chase overdue payments',
    desc: 'Vasool finds what is late and drafts the reminder',
    prompt: 'Show my overdue invoices and draft a polite reminder for the oldest one.',
  },
  {
    id: 'aging-report',
    icon: BarChart3, tint: 'text-sky-600 bg-sky-50',
    title: 'Receivables aging report',
    desc: '0–30 / 31–60 / 61–90 / 90+ day buckets',
    prompt: 'Give me my receivables aging report — who owes what and how late.',
  },
  {
    id: 'terms-advisor',
    icon: Scale, tint: 'text-violet-600 bg-violet-50',
    title: 'Should I take 90-day terms?',
    desc: 'Khata weighs a big order against cash flow',
    prompt: 'A buyer offers 90-day payment terms on a ₹2 lakh order. Should I take it?',
  },
  {
    id: 'cashflow-gap',
    icon: IndianRupee, tint: 'text-emerald-600 bg-emerald-50',
    title: 'Cash-flow check',
    desc: 'Next 30 days of inflows vs payables',
    prompt: 'Show my cash flow for the next 30 days and warn me where money gets tight.',
  },
  {
    id: 'track-order',
    icon: Truck, tint: 'text-amber-600 bg-amber-50',
    title: 'Track an incoming order',
    desc: 'Logistics agent keeps a shipment on watch',
    prompt: 'My order is on the way — keep it on track. Which carrier is bringing it and when will it reach?',
  },
  {
    id: 'hire-logistics',
    icon: Bot, tint: 'text-magenta bg-magenta/10',
    title: 'Hire a logistics agent',
    desc: 'The magic moment — Nirmata builds one live',
    prompt: 'Mera transporter nahi aaya, mera order stranded hai. I need someone to handle pickups and deliveries.',
  },
  {
    id: 'hire-festival',
    icon: Store, tint: 'text-orange-600 bg-orange-50',
    title: 'Hire a festival-stock agent',
    desc: 'An agent that watches stock before Diwali',
    prompt: 'Diwali is coming and I keep running out of fast-moving stock. Hire an agent who watches inventory and tells me what to order early.',
  },
  {
    id: 'compare-suppliers',
    icon: PackageSearch, tint: 'text-blue-600 bg-blue-50',
    title: 'Compare suppliers',
    desc: 'Sourcer ranks price vs trust score',
    prompt: 'I need 50 kg of steel rods. Compare my suppliers — cheapest trustworthy option?',
  },
  {
    id: 'moq-pool',
    icon: Users, tint: 'text-teal-600 bg-teal-50',
    title: 'Beat the MOQ',
    desc: 'Pool a small order with other buyers',
    prompt: 'I only need 20 units but the supplier MOQ is 50. Can I pool with other buyers?',
  },
  {
    id: 'schedule-reminder',
    icon: CalendarClock, tint: 'text-slate-600 bg-slate-100',
    title: 'Auto-remind before due date',
    desc: 'Set a trigger — human approves before send',
    prompt: 'Remind Sharma Traders 3 days before their invoice is due, every time.',
  },
]
