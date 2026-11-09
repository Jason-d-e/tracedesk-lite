import * as chrono from 'chrono-node'

/*
 * Key facts in the bottom line (date, time, place, contact), found with chrono-node (dates and times,
 * Chinese and English) plus two small patterns (online/on-campus, email). A fact is only emphasised
 * when the same values appear in a verified quote: chrono parses the English source too, so
 * "2026年11月12日 19:00" in a Chinese answer is matched against "12 November 2026 ... 19:00".
 */

export type FactKind = 'date' | 'time' | 'place' | 'contact'

export interface FactSpan {
  start: number
  end: number
  kinds: FactKind[]
}

export interface FactChip {
  kind: FactKind
  value: string
}

export interface KeyFacts {
  spans: FactSpan[]
  chips: FactChip[]
}

const REF = new Date(2026, 10, 9)
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const LEAD = /^(on|at|from|by|before|after|until|in)\s+/i
const PLACE = /\b(online|on campus|in person)\b|线上|在线|线下|校内/gi
const PLACE_SOURCE: Record<string, string> = { 线上: 'online', 在线: 'online', 线下: 'in person', 校内: 'on campus' }
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g

type Unit = 'year' | 'month' | 'day' | 'hour' | 'minute'
type Known = Partial<Record<Unit, number>>

/** Only the values the text states outright (chrono also fills in implied ones, which must not count). */
function known(c: chrono.ParsedComponents | null | undefined): Known {
  const k: Known = {}
  if (!c) return k
  for (const u of ['year', 'month', 'day', 'hour', 'minute'] as Unit[]) {
    if (c.isCertain(u)) k[u] = c.get(u) ?? undefined
  }
  return k
}

const pad = (n: number) => String(n).padStart(2, '0')
const dateKey = (k: Known) => (k.month && k.day ? `${k.month}-${k.day}` : null)
const timeKey = (k: Known) => (k.hour !== undefined ? `${k.hour}:${pad(k.minute ?? 0)}` : null)

/** Everything the verified quotes state, in parsed form. */
function evidence(sources: string[]) {
  const dates = new Set<string>()
  const years = new Set<number>()
  const times = new Set<string>()
  const text = sources.join(' \n ').toLowerCase()
  for (const src of sources) {
    for (const r of chrono.en.parse(src, REF)) {
      for (const c of [r.start, r.end]) {
        if (!c) continue
        const k = known(c)
        const d = dateKey(k)
        if (d) dates.add(d)
        if (k.year) years.add(k.year)
        const t = timeKey(k)
        if (t) times.add(t)
      }
    }
  }
  return { dates, years, times, text }
}

export function findKeyFacts(sentence: string, lang: string, sources: string[]): KeyFacts {
  if (!sentence) return { spans: [], chips: [] }
  const ev = evidence(sources)
  const spans: FactSpan[] = []
  const chips: FactChip[] = []
  const parser = /[一-鿿]/.test(sentence) ? chrono.zh.hans : chrono.en

  for (const r of parser.parse(sentence, REF)) {
    const s = known(r.start)
    const e = known(r.end)
    const hasDate = !!dateKey(s)
    const hasTime = timeKey(s) !== null
    const dateOk = !hasDate || (ev.dates.has(dateKey(s)!) && (!s.year || ev.years.has(s.year)))
    const timeOk = !hasTime || (ev.times.has(timeKey(s)!) && (timeKey(e) === null || ev.times.has(timeKey(e)!)))
    if (!(hasDate || hasTime) || !dateOk || !timeOk) continue

    const lead = r.text.match(LEAD)?.[0].length ?? 0
    const kinds: FactKind[] = []
    if (hasDate) {
      kinds.push('date')
      chips.push({
        kind: 'date',
        value: lang === 'zh' ? `${s.year ? `${s.year}年` : ''}${s.month}月${s.day}日` : `${s.day} ${MONTHS_EN[s.month! - 1]}${s.year ? ` ${s.year}` : ''}`,
      })
    }
    if (hasTime) {
      kinds.push('time')
      const zone = /MYT/i.test(r.text) ? ' MYT' : ''
      const endTime = timeKey(e)
      chips.push({ kind: 'time', value: `${timeKey(s)}${endTime ? `–${endTime}` : ''}${zone}` })
    }
    // Keep a trailing time zone inside the highlight ("18:00 MYT").
    let end = r.index + r.text.length
    const tail = sentence.slice(end).match(/^\s*MYT/i)
    if (tail) end += tail[0].length
    spans.push({ start: r.index + lead, end, kinds })
  }

  for (const m of sentence.matchAll(PLACE)) {
    const word = m[0]
    const source = PLACE_SOURCE[word] ?? word.toLowerCase()
    if (!ev.text.includes(source)) continue
    spans.push({ start: m.index!, end: m.index! + word.length, kinds: ['place'] })
    chips.push({ kind: 'place', value: lang === 'zh' ? word : word[0].toUpperCase() + word.slice(1) })
  }

  for (const m of sentence.matchAll(EMAIL)) {
    if (!ev.text.includes(m[0].toLowerCase())) continue
    spans.push({ start: m.index!, end: m.index! + m[0].length, kinds: ['contact'] })
    chips.push({ kind: 'contact', value: m[0] })
  }

  spans.sort((a, b) => a.start - b.start)
  // Drop overlaps (a date inside an already-taken span).
  const clean: FactSpan[] = []
  for (const sp of spans) if (!clean.length || sp.start >= clean[clean.length - 1].end) clean.push(sp)
  const seen = new Set<string>()
  return { spans: clean, chips: chips.filter((c) => !seen.has(c.kind + c.value) && seen.add(c.kind + c.value)) }
}
