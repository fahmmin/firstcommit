// Real brand marks for connectors/MCP — Simple Icons where they exist,
// hand-drawn SVG for brands simple-icons dropped (Slack, Excel) or lacks (Tally).
import {
  SiWhatsapp, SiGmail, SiGoogledrive, SiGooglecalendar, SiAirtable,
  SiRazorpay, SiGooglesheets, SiGoogledocs, SiNotion, SiShopify, SiZapier, SiPhonepe,
  SiFacebook, SiInstagram, SiPerplexity, SiMeta,
} from 'react-icons/si'
import { Server, PlugZap } from 'lucide-react'

const SlackMark = ({ size = 14 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}>
    <rect x="9" y="1.5" width="6" height="4" rx="2" fill="#36C5F0" />
    <rect x="1.5" y="9" width="4" height="6" rx="2" fill="#36C5F0" transform="rotate(0)" />
    <rect x="5.5" y="5.5" width="4" height="6" rx="2" fill="#E01E5A" />
    <rect x="1.5" y="1.5" width="6" height="4" rx="2" fill="#E01E5A" />
    <rect x="18.5" y="9" width="4" height="6" rx="2" fill="#2EB67D" />
    <rect x="14.5" y="5.5" width="6" height="4" rx="2" fill="#2EB67D" />
    <rect x="5.5" y="14.5" width="6" height="4" rx="2" fill="#ECB22E" />
    <rect x="9" y="18.5" width="6" height="4" rx="2" fill="#ECB22E" transform="rotate(0)" />
    <rect x="14.5" y="14.5" width="4" height="6" rx="2" fill="#36C5F0" />
    <rect x="5.5" y="9" width="4" height="6" rx="2" fill="#E01E5A" transform="rotate(0)" />
  </svg>
)

const ExcelMark = ({ size = 14 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}>
    <rect x="2" y="2" width="20" height="20" rx="3" fill="#217346" />
    <path d="M8 7.5l4 4.5-4 4.5h2.6l2.7-3.1 2.7 3.1h2.6l-4-4.5 4-4.5h-2.6l-2.7 3.1-2.7-3.1z" fill="#fff" />
  </svg>
)

const LetterMark = (ch, bg) => ({ size = 14 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}>
    <rect x="1" y="1" width="22" height="22" rx="5" fill={bg} />
    <text x="12" y="16.5" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff" fontFamily="inherit">{ch}</text>
  </svg>
)

const TallyMark = LetterMark('T', '#1b4f9c')

// IndiaMART has no icon mark — official wordmark is styled text.
const IndiaMartMark = ({ size = 14 }) => (
  <svg viewBox="0 0 48 24" width={size * 2} height={size}>
    <text x="2" y="17" fontSize="12" fontWeight="800" fontFamily="inherit">
      <tspan fill="#2e3192">India</tspan><tspan fill="#e31e24">MART</tspan>
    </text>
  </svg>
)

const BRANDS = {
  facebook: { C: SiFacebook, color: '#1877F2' },
  instagram: { C: SiInstagram, color: '#E4405F' },
  meta: { C: SiMeta, color: '#0082FB' },
  perplexity: { C: SiPerplexity, color: '#20808D' },
  indiamart: { C: IndiaMartMark, color: '#2e3192' },
  whatsapp: { C: SiWhatsapp, color: '#25D366' },
  gmail: { C: SiGmail, color: '#EA4335' },
  google_drive: { C: SiGoogledrive, color: '#34A853' },
  google_calendar: { C: SiGooglecalendar, color: '#4285F4' },
  airtable: { C: SiAirtable, color: '#FCBF00' },
  razorpay: { C: SiRazorpay, color: '#2B5CF6' },
  excel: { C: ExcelMark, color: '#217346' },
  sheets: { C: SiGooglesheets, color: '#0F9D58' },
  google_sheets: { C: SiGooglesheets, color: '#0F9D58' },
  google_docs: { C: SiGoogledocs, color: '#4285F4' },
  slack: { C: SlackMark, color: '#611f69' },
  tally: { C: TallyMark, color: '#1b4f9c' },
  notion: { C: SiNotion, color: '#000' },
  shopify: { C: SiShopify, color: '#95BF47' },
  zapier: { C: SiZapier, color: '#FF4A00' },
  phonepe: { C: SiPhonepe, color: '#5F259F' },
  mcp: { C: Server, color: '#64748b' },
}

export function BrandIcon({ id, size = 15, className = '' }) {
  const b = BRANDS[id] || BRANDS[String(id || '').toLowerCase()]
  if (!b) return <PlugZap size={size} className={className} />
  const { C, color } = b
  return <C size={size} color={color} className={className} />
}
