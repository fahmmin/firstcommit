import { useEffect, useState } from 'react'
import Landing from './pages/Landing.jsx'
import Docs from './pages/Docs.jsx'
import Workspace from './pages/Workspace.jsx'
import Settings from './pages/Settings.jsx'
import Login from './pages/Login.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Search from './pages/Search.jsx'
import ArtifactView from './pages/ArtifactView.jsx'
import Marketplace from './pages/Marketplace.jsx'
import Context from './pages/Context.jsx'
import Templates from './pages/Templates.jsx'
import Calendar from './pages/Calendar.jsx'
import Logs from './pages/Logs.jsx'
import Artifacts from './pages/Artifacts.jsx'
import Notifications from './pages/Notifications.jsx'
import People from './pages/People.jsx'
import Analytics from './pages/Analytics.jsx'
import { Toasts } from './components/Toasts.jsx'
import { isAuthed } from './lib/auth.js'

// hash router — no deps, works on any static host (Amplify, S3+CF, file://)
const routes = {
  '': Landing, docs: Docs, app: Workspace, settings: Settings,
  login: Login, onboarding: Onboarding, search: Search, a: ArtifactView,
  marketplace: Marketplace, context: Context, templates: Templates, calendar: Calendar, logs: Logs,
  artifacts: Artifacts, notifications: Notifications, people: People,
  analytics: Analytics,
}

export default function App() {
  const [route, setRoute] = useState(location.hash.replace(/^#\/?/, ''))
  useEffect(() => {
    const onHash = () => setRoute(location.hash.replace(/^#\/?/, ''))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const [key, param] = route.split('/')
  // landing, docs, login and artifact share links are public
  const PUBLIC = ['', 'docs', 'login', 'a']
  if (!PUBLIC.includes(key) && !isAuthed()) {
    location.hash = '#/login'
    return null
  }
  const Page = routes[key] || Landing
  return <><Page param={param} /><Toasts /></>
}
