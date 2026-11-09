import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Group, Text, VisuallyHidden } from '@mantine/core'
import { IconCalendarEvent, IconClock, IconMail, IconMapPin } from '@tabler/icons-react'
import { annotate } from 'rough-notation'
import { Readable } from '../reading'
import { usePrefs } from '../prefs'
import { findKeyFacts, type FactKind } from './keyFacts'

const ICONS: Record<FactKind, typeof IconClock> = { date: IconCalendarEvent, time: IconClock, place: IconMapPin, contact: IconMail }

/**
 * The bottom line with its key facts marked: a highlighter stroke (Rough Notation) behind each date,
 * time, place or contact that a verified quote backs, and the same facts as a row of labelled chips.
 */
export default function KeySentence({ text, sources }: { text: string; sources: string[] }) {
  const { t, i18n } = useTranslation()
  const { prefs } = usePrefs()
  const facts = useMemo(() => findKeyFacts(text, i18n.language, sources), [text, i18n.language, sources])
  const marks = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    const still = prefs.focus || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const color = getComputedStyle(document.documentElement).getPropertyValue('--color-marker').trim() || 'rgba(250, 220, 120, 0.7)'
    const notes = marks.current
      .slice(0, facts.spans.length)
      .filter((el): el is HTMLElement => !!el)
      .map((el, i) => {
        const a = annotate(el, { type: 'highlight', color, multiline: true, iterations: 1, padding: [2, 4], animate: !still, animationDuration: 380 + i * 60 })
        a.show()
        // The stroke is decoration: hide it from screen readers.
        const svg = el.previousElementSibling
        if (svg?.classList.contains('rough-annotation')) svg.setAttribute('aria-hidden', 'true')
        return a
      })
    return () => notes.forEach((a) => a.remove())
  }, [facts, prefs.focus, prefs.textSize, i18n.language])

  // Split the sentence into plain runs and marked runs.
  const parts: { text: string; mark: number }[] = []
  let at = 0
  facts.spans.forEach((sp, i) => {
    if (sp.start > at) parts.push({ text: text.slice(at, sp.start), mark: -1 })
    parts.push({ text: text.slice(sp.start, sp.end), mark: i })
    at = sp.end
  })
  if (at < text.length) parts.push({ text: text.slice(at), mark: -1 })

  return (
    <>
      <Text component="p" fz="1.375rem" fw={600} lh={1.45} className="measure td-key-sentence" style={{ letterSpacing: '-0.01em' }}>
        {parts.map((p, i) =>
          p.mark >= 0 ? (
            <strong key={i} className="td-key" ref={(el) => { marks.current[p.mark] = el }}>
              <Readable text={p.text} bionic={prefs.bionic} />
            </strong>
          ) : (
            <Readable key={i} text={p.text} bionic={prefs.bionic} />
          ),
        )}
      </Text>
      {facts.chips.length > 0 && (
        <Group gap="xs" mt="sm" component="ul" className="td-facts" aria-label={t('answer.keyFacts')}>
          {facts.chips.map((c) => {
            const Icon = ICONS[c.kind]
            return (
              <li key={c.kind + c.value} className="td-fact">
                <Icon size={18} aria-hidden />
                <VisuallyHidden>{t(`answer.factKinds.${c.kind}`)}{t('punct.colon')}</VisuallyHidden>
                <span>{c.value}</span>
              </li>
            )
          })}
        </Group>
      )}
    </>
  )
}
