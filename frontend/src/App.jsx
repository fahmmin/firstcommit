import { useEffect, useState } from 'react'
import Landing from './pages/Landing.jsx'
import Docs from './pages/Docs.jsx'
import Workspace from './pages/Workspace.jsx'
import Settings from './pages/Settings.jsx'

// hash router — no deps, works on any static host (Amplify, S3+CF, file://)
const routes = { '': Landing, docs: Docs, app: Workspace, settings: Settings }

export default function App() {
  const [route, setRoute] = useState(location.hash.replace(/^#\/?/, ''))
  useEffect(() => {
    const onHash = () => setRoute(location.hash.replace(/^#\/?/, ''))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const Page = routes[route.split('/')[0]] || Landing
  return <Page />
}
