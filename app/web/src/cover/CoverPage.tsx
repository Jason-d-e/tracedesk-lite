import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { IconArrowUpRight, IconCheck, IconClock } from '@tabler/icons-react'
import Logo from '../components/Logo'
import { LanguageSwitch } from '../components/TopBar'
import './cover.css'

// The real documents the demo answers from (data/knowledge.json): shown as-is, in English, because they are the source.
const DOC = {
  contact: 'The fictional support address is help@democlub.invalid. Support hours are Monday to Friday, 10:00 to 18:00 MYT. The target first response time is two business days.',
  before: 'To cancel an Intro to AI Tools workshop registration, ',
  mark: 'reply to the confirmation email before 11 November 2026 at 18:00 MYT',
  after: '. Cancellation releases a place to the waiting list. Transfers to a different person are not supported.',
}
const BEFORE_SECTIONS = [
  { title: 'DemoClub support guide, D02, cancellation', text: 'To cancel an Intro to AI Tools workshop registration, reply to the confirmation email before 11 November 2026 at 18:00 MYT. Cancellation releases a place to the waiting list. Transfers to a different person are not supported.' },
]
const BEFORE_WORDS = BEFORE_SECTIONS.reduce((n, s) => n + s.text.split(/\s+/).length, 0)
const SHOTS = ['answer', 'focus', 'settings', 'clarify'] as const
const REPO = 'https://github.com/Jason-d-e/tracedesk-lite'

function shot(lang: string, name: string) {
  return `/shots/${lang === 'zh' ? 'zh' : 'en'}/${name}.webp`
}

/** Scrolls to a section on the cover without touching the hash router. */
function jump(id: string) {
  return (e: MouseEvent) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }
}

/** The bar retracts while reading down and returns on the way up (passive, frame-throttled listener). */
function useRetractingBar() {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    let last = window.scrollY
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        setHidden(y > 160 && y > last)
        last = y
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return hidden
}

/** Which "moment" panel is in the middle of the screen, so the pinned screen can follow it. */
function useActivePanel(count: number) {
  const refs = useRef<(HTMLElement | null)[]>([])
  const [active, setActive] = useState(0)
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(Number((e.target as HTMLElement).dataset.index))),
      { rootMargin: '-45% 0px -45% 0px' },
    )
    refs.current.slice(0, count).forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [count])
  return { refs, active }
}

function DeskScene() {
  const { t, i18n } = useTranslation()
  return (
    <figure className="hm-figure">
      <div className="hm-scene desk" style={{ borderRadius: 'var(--radius-card)' }}>
        <article className="stock hm-sheet" lang="en" aria-label={t('cover.desk.doc')}>
          <header>
            <span className="hm-sheet-title">{t('cover.desk.doc')}</span>
            <span className="hm-sheet-meta" lang={i18n.language === 'zh' ? 'zh-CN' : 'en'}>{t('cover.desk.docMeta')}</span>
          </header>
          <p>{DOC.contact}</p>
          <p>
            {DOC.before}
            <span className="hm-mark">{DOC.mark}</span>
            {DOC.after}
          </p>
        </article>
        <div className="stock hm-card">
          <div className="hm-card-label"><span className="td-num" aria-hidden>1</span>{t('cover.desk.cardLabel')}</div>
          <p className="hm-card-answer">{t('cover.desk.answer')}</p>
          <div className="hm-check">
            <span className="hm-box" aria-hidden><IconCheck stroke={3} /></span>
            <span>{t('cover.desk.step')}</span>
          </div>
          <span className="hm-deadline"><IconClock aria-hidden />{t('cover.desk.deadline')}</span>
          <span className="hm-stamp">{t('cover.desk.stamp')}</span>
        </div>
      </div>
      <figcaption>{t('cover.desk.caption')}</figcaption>
    </figure>
  )
}

function BeforeAfter() {
  const { t, i18n } = useTranslation()
  const [view, setView] = useState<'doc' | 'answer'>('doc')
  return (
    <>
      <div className="hm-switch" role="group" aria-label={t('cover.before.title')}>
        {(['doc', 'answer'] as const).map((v) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
            {t(`cover.before.tabs.${v}`)}
          </button>
        ))}
      </div>
      <div className="hm-ba">
        <div key={view} className="hm-ba-panel">
          {view === 'doc' ? (
            <article className="stock hm-ba-sheet" lang="en">
              {BEFORE_SECTIONS.map((s) => (
                <div key={s.title}>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              ))}
            </article>
          ) : (
            <div className="hm-ba-shot">
              <img src={shot(i18n.language, 'answer')} alt={t('cover.before.alt')} width={1600} height={1200} loading="lazy" />
            </div>
          )}
        </div>
        <div className="hm-ba-count" aria-live="polite">
          {view === 'doc' ? (
            <>
              <span className="fig">{BEFORE_WORDS}</span>
              <p className="small">{t('cover.before.docWords')}</p>
            </>
          ) : (
            <>
              <span className="fig">1 + 1</span>
              <p className="small">{t('cover.before.answerWords')}</p>
            </>
          )}
        </div>
      </div>
    </>
  )
}

export default function CoverPage() {
  const { t, i18n } = useTranslation()
  const hidden = useRetractingBar()
  const { refs, active } = useActivePanel(SHOTS.length)
  const figures = t('cover.figures.items', { returnObjects: true }) as { value: string; label: string }[]
  const moments = t('cover.moments.items', { returnObjects: true }) as { title: string; text: string }[]
  const alts = t('cover.moments.alts', { returnObjects: true }) as string[]
  const needs = t('cover.needs.items', { returnObjects: true }) as { title: string; text: string }[]
  const questions = t('cover.close.questions', { returnObjects: true }) as string[]
  const lang = i18n.language

  useEffect(() => {
    document.title = 'TraceDesk Lite'
  }, [])

  return (
    <div className="hm">
      <nav className="hm-bar" data-hidden={hidden} aria-label="TraceDesk">
        <div className="container hm-bar-inner">
          <Logo />
          <div className="hm-links">
            <a href="#how" onClick={jump('how')}>{t('cover.nav.how')}</a>
            <a href="#organisers" onClick={jump('organisers')}>{t('cover.nav.organisers')}</a>
          </div>
          <LanguageSwitch />
          <a className="btn btn--ink" href="#/ask">{t('cover.nav.start')}</a>
        </div>
      </nav>

      <main>
        <section className="hm-hero" aria-labelledby="hm-title">
          <div className="container hm-hero-grid">
            <div className="hm-hero-text">
              <h1 id="hm-title">
                {t('cover.hero.title').split('|').map((part, i) => (
                  <span key={i}>{i > 0 && <br />}{part}</span>
                ))}
              </h1>
              <p className="lead">{t('cover.hero.lead')}</p>
              <div className="hm-actions">
                <a className="btn btn--ink" href="#/ask">{t('cover.hero.primary')}</a>
                <a className="btn btn--card" href="#how" onClick={jump('how')}>{t('cover.hero.secondary')}</a>
              </div>
              <p className="small">{t('cover.hero.note')}</p>
            </div>
            <DeskScene />
          </div>
        </section>

        <section id="how" className="hm-section" aria-labelledby="hm-before">
          <div className="container">
            <div className="hm-head">
              <h2 id="hm-before">{t('cover.before.title')}</h2>
              <p className="lead">{t('cover.before.lead')}</p>
            </div>
            <BeforeAfter />
          </div>
        </section>

        <section className="hm-section" aria-labelledby="hm-figures" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="hm-head">
              <h2 id="hm-figures">{t('cover.figures.title')}</h2>
            </div>
            <div className="hm-figures">
              {figures.map((f, i) => (
                <div key={i}>
                  <span className="fig">{f.value}{i < 2 && <sup className="hm-sup"><a href="#hm-notes" aria-label={t('cover.figures.noteLabel')}>1</a></sup>}</span>
                  <p>{f.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="hm-section" aria-labelledby="hm-moments" style={{ background: 'var(--color-paper-2)' }}>
          <div className="container">
            <div className="hm-head">
              <h2 id="hm-moments">{t('cover.moments.title')}</h2>
            </div>
            <div className="hm-pinned">
              <div className="hm-pin" aria-hidden>
                <div className="hm-pin-stack">
                  {SHOTS.map((s, i) => (
                    <img key={s} src={shot(lang, s)} alt="" width={1600} height={1200} loading="lazy" data-on={active === i} />
                  ))}
                </div>
              </div>
              <div className="hm-panels">
                {moments.map((m, i) => (
                  <article key={m.title} className="hm-panel" data-index={i} data-on={active === i} ref={(el) => { refs.current[i] = el }}>
                    <h3>{m.title}</h3>
                    <p>{m.text}</p>
                    <div className="hm-panel-shot">
                      <img src={shot(lang, SHOTS[i])} alt={alts[i]} width={1600} height={1200} loading="lazy" />
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="organisers" className="hm-section" aria-labelledby="hm-org">
          <div className="container">
            <div className="hm-head hm-head--split">
              <h2 id="hm-org">{t('cover.organisers.title')}</h2>
              <div className="hm-head-actions">
                <p className="lead">{t('cover.organisers.lead')}</p>
                <a className="btn btn--card" href="#/organiser">{t('cover.organisers.action')}</a>
              </div>
            </div>
            <div className="hm-show">
              <img src={shot(lang, 'dashboard')} alt={t('cover.organisers.alt')} width={1920} height={1200} loading="lazy" />
            </div>
          </div>
        </section>

        <section className="hm-section" aria-labelledby="hm-needs" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="hm-head">
              <h2 id="hm-needs">{t('cover.needs.title')}</h2>
            </div>
            <div className="hm-rows">
              {needs.map((n) => (
                <div key={n.title} className="hm-row">
                  <h3>{n.title}</h3>
                  <p>{n.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="hm-close board" aria-labelledby="hm-close">
          <div className="container hm-close-grid">
            <div className="hm-head" style={{ marginBottom: 0 }}>
              <h2 id="hm-close">{t('cover.close.title')}</h2>
              <p className="lead">{t('cover.close.lead')}</p>
            </div>
            <div className="hm-questions">
              {questions.map((q) => (
                <a key={q} className="stock hm-q" href={`#/ask?q=${encodeURIComponent(q)}`}>
                  <span>{q}</span>
                  <IconArrowUpRight size={20} aria-hidden />
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="hm-footer">
        <div className="container hm-footer-grid">
          <div className="hm-footer-text">
            <p>{t('cover.footer.colophon')}</p>
            <p id="hm-notes" className="small"><sup>1</sup> {t('cover.figures.note')}</p>
          </div>
          <nav className="hm-footer-links" aria-label={t('cover.footer.links.source')}>
            <a href="#/ask">{t('cover.footer.links.ask')}</a>
            <a href="#/organiser">{t('cover.footer.links.organiser')}</a>
            <a href="#/about">{t('cover.footer.links.about')}</a>
            <a href={REPO} rel="noreferrer">{t('cover.footer.links.source')}</a>
            <a href={`${REPO}/blob/main/EVALUATION.md`} rel="noreferrer">{t('cover.footer.links.evaluation')}</a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
