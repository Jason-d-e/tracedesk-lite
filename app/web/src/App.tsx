import { lazy, Suspense, useEffect, useState } from 'react'
import { Center, Loader } from '@mantine/core'
import { PrefsProvider } from './prefs'
import ReaderPage from './reader/ReaderPage'
import CoverPage from './cover/CoverPage'
import AboutPage from './cover/AboutPage'

// The dashboard (with its charts) is only downloaded when an organiser opens it.
const OrganiserPage = lazy(() => import('./organiser/OrganiserPage'))

type Page = 'cover' | 'reader' | 'organiser' | 'about'

/** Tiny hash router: '#/' the cover, '#/ask' the help desk, '#/organiser/<section>' the dashboard, '#/about' the fine print. */
function useHashRoute(): { page: Page; section: string } {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  const parts = hash.replace(/^#\/?/, '').split(/[/?]/)
  const page: Page = parts[0] === 'organiser' ? 'organiser' : parts[0] === 'ask' ? 'reader' : parts[0] === 'about' ? 'about' : 'cover'
  return { page, section: parts[1] || 'overview' }
}

export default function App() {
  const { page, section } = useHashRoute()

  // Each page starts at the top, and the document title names where you are.
  useEffect(() => {
    if (page !== 'reader') window.scrollTo(0, 0)
  }, [page])

  return (
    <PrefsProvider>
      {page === 'cover' && <CoverPage />}
      {page === 'about' && <AboutPage />}
      {/* The help desk stays mounted (just hidden) while another page is open, so a reader who
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
