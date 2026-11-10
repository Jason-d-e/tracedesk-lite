import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Accordion, Alert, Box, Button, Card, Checkbox, CopyButton, Divider, Group, Highlight, Stack, Text, Textarea,
} from '@mantine/core'
import {
  IconAlertTriangle, IconCheck, IconCircleCheck, IconClock, IconCopy, IconFileText, IconFlag, IconHelpCircle, IconListDetails, IconMailForward,
  IconMessageCircleQuestion, IconPlayerStop, IconPlus, IconQuote, IconSearchOff, IconShieldX, IconVolume,
} from '@tabler/icons-react'
import { Readable, speak, stopSpeaking } from '../reading'
import { usePrefs } from '../prefs'
import type { AnswerResult, AskPayload, Citation, EmailDraft, Status } from '../types'
import ReportModal from './ReportModal'
import KeySentence from './KeySentence'

// Status is an ink outline (Coral). Only a verified answer spends the coral, as a pressed stamp.
const STATUS_ICON: Record<Status, { icon: ReactNode; tone: string }> = {
  answered: { icon: <IconCircleCheck />, tone: 'var(--color-paid)' },
  insufficient_evidence: { icon: <IconSearchOff />, tone: 'var(--color-ink)' },
  needs_clarification: { icon: <IconHelpCircle />, tone: 'var(--color-ink)' },
  withheld: { icon: <IconShieldX />, tone: 'var(--mantine-color-red-light-color)' },
}

function NumberDot({ n }: { n: number }) {
  return <span className="td-num" aria-hidden>{n}</span>
}

/** The numbered label of an answer section: a real heading, so screen readers can jump between sections. */
function SectionLabel({ n, id, children }: { n: number; id: string; children: ReactNode }) {
  return (
    <Group gap={8} mb={8} wrap="nowrap">
      <NumberDot n={n} />
      <Text component="h2" id={id} size="sm" fw={500} c="dimmed" m={0}>
        {children}
      </Text>
    </Group>
  )
}

/** One well per source section; every quoted passage from it is underlined in place. */
interface SourceGroup {
  source_id: string
  title?: string
  version?: string
  effective_date?: string
  source_text?: string
  highlights: string[]
  unverified: string[]
}

function groupBySource(citations: Citation[]): SourceGroup[] {
  const groups = new Map<string, SourceGroup>()
  for (const c of citations) {
    const g = groups.get(c.source_id) ?? {
      source_id: c.source_id, title: c.title, version: c.version, effective_date: c.effective_date, source_text: c.source_text, highlights: [], unverified: [],
    }
    if (c.verified && c.span && c.source_text) g.highlights.push(c.source_text.slice(c.span.start, c.span.end))
    if (!c.verified) g.unverified.push(c.quote)
    groups.set(c.source_id, g)
  }
  return [...groups.values()]
}

function Evidence({ g }: { g: SourceGroup }) {
  const { t } = useTranslation()
  const ok = g.unverified.length === 0
  return (
    <Box className="td-well" p="md">
      <Group justify="space-between" mb={4} wrap="wrap" gap={6}>
        <Group gap={6}>
          <IconFileText size={16} aria-hidden />
          <Text fw={600} size="sm">{g.title ?? g.source_id}</Text>
        </Group>
        <span className={ok ? 'td-tag' : 'td-tag td-tag--bad'}>
          {ok ? <IconCheck size={14} aria-hidden /> : <IconAlertTriangle size={14} aria-hidden />}
          {ok ? t('answer.verified') : t('answer.notFound')}
        </span>
      </Group>
      {g.version && (
        <Text size="xs" c="dimmed" mb={8}>
          {t('answer.docMeta', { id: g.source_id, version: g.version, date: g.effective_date })}
          {g.highlights.length > 0 && `${t('punct.sep')}${t('answer.quotesHighlighted', { count: g.highlights.length })}`}
        </Text>
      )}
      {g.source_text && (
        <Highlight highlight={g.highlights} size="sm" lang="en" className="wrap-anywhere td-quote" lh={1.65}>
          {g.source_text}
        </Highlight>
      )}
      {g.unverified.map((q) => (
        <Text key={q} size="sm" c="red" mt={6}>{t('answer.notFoundText', { quote: q })}</Text>
      ))}
    </Box>
  )
}

/** When the documents do not answer: the email the reader would send, drafted from the documents' own contact. Copy it or open it; nothing is sent from here. */
function EmailDraftBox({ email }: { email: EmailDraft }) {
  const { t } = useTranslation()
  const text = `${email.to ? `${t('email.to')}${t('punct.colon')}${email.to}\n` : ''}${t('email.subject')}${t('punct.colon')}${email.subject}\n\n${email.body}`
  return (
    <Box className="td-well" p="md" mt="md" component="section" aria-labelledby="sec-email">
      <Group gap={6} mb={4}>
        <IconMailForward size={16} aria-hidden />
        <Text component="h2" id="sec-email" size="sm" fw={600} m={0}>{t('email.title')}</Text>
      </Group>
      <Text size="sm" c="dimmed" mb="sm">{t('email.lead')}{t('email.join')}{email.note}</Text>
      {email.to && <Text size="sm"><Text span fw={600}>{t('email.to')}{t('punct.colon')}</Text>{email.to}</Text>}
      <Text size="sm" mb="xs"><Text span fw={600}>{t('email.subject')}{t('punct.colon')}</Text><span lang="en">{email.subject}</span></Text>
      <Text size="sm" lang="en" className="td-quote" style={{ whiteSpace: 'pre-wrap' }} lh={1.6}>{email.body}</Text>
      <Group gap="xs" mt="sm">
        <CopyButton value={text} timeout={2000}>
          {({ copied, copy }) => (
            <Button size="sm" variant="default" leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />} onClick={copy}>
              {copied ? t('email.copied') : t('email.copy')}
            </Button>
          )}
        </CopyButton>
        <Button component="a" href={email.mailto} size="sm" variant="light" leftSection={<IconMailForward size={16} />}>{t('email.open')}</Button>
      </Group>
    </Box>
  )
}

export default function AnswerCard({
  payload, result, onReply, onNew,
}: {
  payload: AskPayload
  result: AnswerResult
  onReply: (reply: string, clarifying: string) => void
  onNew: () => void
}) {
  const { t } = useTranslation()
  const { prefs } = usePrefs()
  const [done, setDone] = useState<Record<number, boolean>>({})
  const [speaking, setSpeaking] = useState(false)
  const [speechError, setSpeechError] = useState(false)
  const [reply, setReply] = useState('')
  const [reportOpen, setReportOpen] = useState(false)

  const status = STATUS_ICON[result.status]
  const withheld = result.status === 'withheld'
  const clarify = result.status === 'needs_clarification'
  const steps = withheld ? [] : result.next_steps
  const bottomLine = clarify ? result.clarifying_question || result.answer : result.key_point
  const evidence = groupBySource([...result.citations, ...steps])
  const quoteCount = result.citations.length + steps.length
  const verifiedCount = result.checks.citations_verified + result.checks.steps_verified
  // Only what the server verified word for word may back an emphasised date, time, place or contact.
  const verifiedQuotes = useMemo(() => [...result.citations, ...steps].filter((c) => c.verified).map((c) => c.quote), [result.citations, steps])
  let n = 0

  const checklistText = steps
    .filter((s) => s.verified)
    .map((s, i) => `${i + 1}. ${s.action}${s.deadline ? ` (${s.deadline})` : ''}`)
    .join('\n')

  async function listen() {
    if (speaking) {
      stopSpeaking()
      setSpeaking(false)
      return
    }
    const text = [bottomLine, ...steps.filter((s) => s.verified).map((s, i) => `${i + 1}. ${s.action}${s.deadline ? `, ${s.deadline}` : ''}`)].join('. ')
    setSpeaking(true)
    const ok = await speak(text, prefs.rate)
    setSpeaking(false)
    if (!ok) setSpeechError(true)
  }

  return (
    <Card radius="md" padding="xl" className="answer-card td-arrive">
      <Text size="sm" c="dimmed" mb="xs">
        {t('answer.youAsked')}{t('punct.colon')}<Text span fs="italic" inherit>{payload.question}</Text>
      </Text>

      <Alert
        icon={<span style={{ color: status.tone, display: 'inline-flex' }}>{status.icon}</span>}
        title={
          <Group gap="sm" wrap="wrap">
            <span>{t(`status.${result.status}.title`)}</span>
            {result.status === 'answered' && <span className="td-stamp"><IconCheck size={12} aria-hidden />{t('answer.verified')}</span>}
            <span className="td-tag">{t(`engine.badge.${result.meta.engine ?? 'model'}`)}</span>
          </Group>
        }
        mb="lg"
      >
        {t(`status.${result.status}.desc`)}
      </Alert>

      {/* ① In one sentence */}
      {!withheld && bottomLine && (
        <section aria-labelledby="sec-bottom">
          <SectionLabel n={++n} id="sec-bottom">{clarify ? t('answer.clarifyHeading') : t(result.meta.engine === 'local' ? 'answer.bottomLineLocal' : 'answer.bottomLine')}</SectionLabel>
          <KeySentence text={bottomLine} sources={verifiedQuotes} />
          <Group mt="sm" gap="xs">
            <Button variant="light" size="sm" leftSection={speaking ? <IconPlayerStop size={16} /> : <IconVolume size={16} />} onClick={listen}>
              {speaking ? t('answer.stop') : t('answer.listen')}
            </Button>
            {speechError && <Text size="xs" c="dimmed">{t('answer.speechUnavailable')}</Text>}
          </Group>
        </section>
      )}

      {/* Clarification reply */}
      {clarify && (
        <Stack gap="xs" mt="md">
          <Textarea
            label={t('answer.clarifyLabel')}
            value={reply}
            onChange={(e) => setReply(e.currentTarget.value)}
            autosize
            minRows={2}
            maxLength={500}
          />
          <Group justify="flex-end">
            <Button leftSection={<IconMessageCircleQuestion size={16} />} disabled={!reply.trim()} onClick={() => onReply(reply.trim(), result.clarifying_question || result.answer)}>
              {t('answer.clarifySend')}
            </Button>
          </Group>
        </Stack>
      )}

      {/* Missing information: a tinted well, not a box in the card */}
      {result.status === 'insufficient_evidence' && result.missing_info && (
        <Box className="td-well" p="md" mt="md">
          <Text size="sm" fw={600}>{t('answer.missing')}</Text>
          <Text size="sm"><Readable text={result.missing_info} bionic={prefs.bionic} /></Text>
        </Box>
      )}

      {result.email && <EmailDraftBox email={result.email} />}

      {/* ② What to do: rows parted by hairlines */}
      {steps.length > 0 && (
        <section aria-labelledby="sec-todo" style={{ marginTop: 'var(--mantine-spacing-xl)' }}>
          <SectionLabel n={++n} id="sec-todo">{t('answer.todo')}</SectionLabel>
          <Text size="xs" c="dimmed" mb={4}>{t('answer.todoHint')}</Text>
          <div>
            {steps.map((s, i) => (
              <div key={i} className={['td-step', done[i] ? 'step-done' : '', !s.verified ? 'td-step--bad' : ''].join(' ')}>
                <Checkbox
                  size="md"
                  checked={!!done[i]}
                  onChange={(e) => setDone((d) => ({ ...d, [i]: e.currentTarget.checked }))}
                  label={
                    <Stack gap={6}>
                      <Text fw={600} className="step-action"><Readable text={s.action} bionic={prefs.bionic} /></Text>
                      {s.deadline && (
                        // Not a Badge: badges cut long text off with "…", and the deadline must always be readable in full.
                        <span className={s.deadline_supported === false ? 'td-deadline td-deadline--bad' : 'td-deadline'}>
                          <IconClock size={16} aria-hidden />
                          <span>{t('answer.deadline')}{t('punct.colon')}{s.deadline}</span>
                        </span>
                      )}
                      {s.deadline && s.deadline_supported === false && <Text size="xs" c="red">{t('answer.deadlineWarn')}</Text>}
                      {s.verified ? (
                        <Text size="xs" c="dimmed">{t('answer.stepSource', { title: s.title ?? s.source_id })}</Text>
                      ) : (
                        <Text size="xs" c="red">{t('answer.stepUnverified')}</Text>
                      )}
                    </Stack>
                  }
                />
              </div>
            ))}
          </div>
          <CopyButton value={checklistText} timeout={2000}>
            {({ copied, copy }) => (
              <Button mt="xs" size="sm" variant="subtle" leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />} onClick={copy}>
                {copied ? t('answer.copied') : t('answer.copySteps')}
              </Button>
            )}
          </CopyButton>
        </section>
      )}

      {/* ③ More detail and ④ evidence, folded so the page stays calm */}
      {!withheld && (result.answer && !clarify || evidence.length > 0) && (
        <Accordion multiple radius="md" mt="xl" defaultValue={prefs.focus ? [] : ['evidence']}>
          {result.answer && !clarify && (
            <Accordion.Item value="details">
              <Accordion.Control icon={<NumberDot n={++n} />}>
                <Group gap="xs">
                  <IconListDetails size={18} aria-hidden />
                  <Text fw={600}>{t('answer.details')}</Text>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Text className="measure"><Readable text={result.answer} bionic={prefs.bionic} /></Text>
              </Accordion.Panel>
            </Accordion.Item>
          )}
          {evidence.length > 0 && (
            <Accordion.Item value="evidence">
              <Accordion.Control icon={<NumberDot n={++n} />}>
                <Group gap="sm" wrap="wrap">
                  <IconQuote size={18} aria-hidden />
                  <Text fw={600}>{t('answer.evidence')}</Text>
                  <span className={verifiedCount === quoteCount ? 'td-tag' : 'td-tag td-tag--bad'}>
                    {t('answer.verified')} <span className="td-figure">{verifiedCount}/{quoteCount}</span>
                  </span>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Text size="xs" c="dimmed" mb="sm">{t('answer.evidenceNote')}</Text>
                <Stack gap="sm">
                  {evidence.map((g) => <Evidence key={g.source_id} g={g} />)}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          )}
        </Accordion>
      )}

      <Divider my="lg" color="var(--color-rule)" />
      <Group justify="space-between" wrap="wrap" gap="xs">
        <Group gap="xs">
          <Button
            variant="default"
            size="sm"
            leftSection={result.status === 'insufficient_evidence' ? <IconPlus size={16} /> : <IconFlag size={16} />}
            onClick={() => setReportOpen(true)}
          >
            {result.status === 'insufficient_evidence' ? t('report.askAdd') : t('report.problem')}
          </Button>
          <Button variant="subtle" size="sm" onClick={onNew}>{t('answer.newQuestion')}</Button>
        </Group>
        <Text size="xs" c="dimmed" className="hide-in-focus">
          {result.meta.engine === 'local' ? t('answer.metaLocal') : t('answer.meta', { model: result.meta.model_served, seconds: (result.meta.latency_ms / 1000).toFixed(1) })}
        </Text>
      </Group>

      <ReportModal opened={reportOpen} onClose={() => setReportOpen(false)} payload={payload} result={result} />
    </Card>
  )
}
