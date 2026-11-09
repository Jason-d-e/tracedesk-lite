import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Logo from '../components/Logo'
import { LanguageSwitch } from '../components/TopBar'
import './cover.css'

const REPO = 'https://github.com/Jason-d-e/tracedesk-lite'

/** Where the fine print lives (as in mature products): one page, linked from the footers, not banners on every screen. */
export default function AboutPage() {
  const { t } = useTranslation()
  const sections = t('about.sections', { returnObjects: true }) as { title: string; text: string }[]

  useEffect(() => {
    document.title = `${t('about.title')} · TraceDesk Lite`
    return () => { document.title = 'TraceDesk Lite' }
  }, [t])

  return (
    <div className="hm">
      <nav className="hm-bar" aria-label="TraceDesk">
        <div className="container hm-bar-inner">
          <Logo />
          <div className="hm-links">
            <a href="#/">{t('about.back')}</a>
          </div>
          <LanguageSwitch />
          <a className="btn btn--ink" href="#/ask">{t('cover.nav.start')}</a>
        </div>
      </nav>
      <main className="hm-section">
        <div className="container">
          <article className="hm-about">
            <h1>{t('about.title')}</h1>
            {sections.map((s) => (
              <section key={s.title} aria-labelledby={`about-${s.title}`}>
                <h2 id={`about-${s.title}`}>{s.title}</h2>
                <p>{s.text}</p>
              </section>
            ))}
            <p><a href={REPO} rel="noreferrer">{t('about.source')}</a></p>
          </article>
        </div>
      </main>
    </div>
  )
}
