import { lazy, Suspense, useEffect, useState } from 'react'
import { Center, Loader } from '@mantine/core'
import { PrefsProvider } from './prefs'
import ReaderPage from './reader/ReaderPage'

// The dashboard (with its charts) is only downloaded when an organiser opens it.
const OrganiserPage = lazy(() => import('./organiser/OrganiserPage'))

/** Tiny hash router: '#/organiser/<section>' shows the dashboard, anything else the help desk. */
function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  const parts = hash.replace(/^#\/?/, '').split('/')
  return { page: parts[0] === 'organiser' ? 'organiser' : 'reader', section: parts[1] || 'overview' }
}

export default function App() {
  const { page, section } = useHashRoute()
  return (
    <PrefsProvider>
      {/* The help desk stays mounted (just hidden) while the dashboard is open, so a reader who
          peeks at the dashboard comes back to the same answer and question history. */}
      <div style={{ display: page === 'reader' ? undefined : 'none' }}>
        <ReaderPage />
      </div>
      {page === 'organiser' && (
        <Suspense fallback={<Center h="100vh"><Loader /></Center>}>
          <OrganiserPage section={section} />
        </Suspense>
      )}
    </PrefsProvider>
  )
}
