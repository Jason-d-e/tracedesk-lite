import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Accordion, Alert, Badge, Button, Card, Checkbox, CopyButton, Divider, Group, Highlight, Paper, Stack, Text, Textarea, ThemeIcon, Title,
} from '@mantine/core'
import {
  IconAlertTriangle, IconCheck, IconCircleCheck, IconClock, IconCopy, IconFileText, IconFlag, IconHelpCircle, IconListDetails, IconMessageCircleQuestion,
  IconPlayerStop, IconPlus, IconQuote, IconSearchOff, IconShieldX, IconVolume,
} from '@tabler/icons-react'
import { Readable, speak, stopSpeaking } from '../reading'
import { usePrefs } from '../prefs'
import type { AnswerResult, AskPayload, Citation, Status } from '../types'
import ReportModal from './ReportModal'

const STATUS_STYLE: Record<Status, { color: string; icon: ReactNode }> = {
  answered: { color: 'teal', icon: <IconCircleCheck /> },
  insufficient_evidence: { color: 'orange', icon: <IconSearchOff /> },
  needs_clarification: { color: 'blue', icon: <IconHelpCircle /> },
  withheld: { color: 'red', icon: <IconShieldX /> },
}

function NumberDot({ n }: { n: number }) {
  return (
    <ThemeIcon size={22} radius="xl" variant="light" aria-hidden>
      <Text size="xs" fw={700}>{n}</Text>
    </ThemeIcon>
  )
}

function SectionLabel({ n, children }: { n: number; children: ReactNode }) {
  return (
    <Group gap={8} mb={6}>
      <NumberDot n={n} />
      <Text size="sm" fw={700} c="dimmed">
        {children}
      </Text>
    </Group>
  )
}

/** One card per source section; every quoted passage from it is highlighted in place. */
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
    <Paper withBorder radius="md" p="sm">
      <Group justify="space-between" mb={4} wrap="wrap" gap={6}>
        <Group gap={6}>
          <IconFileText size={16} aria-hidden />
          <Text fw={600} size="sm">{g.title ?? g.source_id}</Text>
        </Group>
        <Badge color={ok ? 'teal' : 'red'} variant="light" leftSection={ok ? <IconCheck size={12} /> : <IconAlertTriangle size={12} />}>
          {ok ? t('answer.verified') : t('answer.notFound')}
        </Badge>
      </Group>
      {g.version && (
        <Text size="xs" c="dimmed" mb={6}>
          {t('answer.docMeta', { id: g.source_id, version: g.version, date: g.effective_date })}
          {g.highlights.length > 0 && ` · ${t('answer.quotesHighlighted', { count: g.highlights.length })}`}
        </Text>
      )}
      {g.source_text && (
        <Highlight highlight={g.highlights} size="sm" lang="en" className="wrap-anywhere" highlightStyles={{ fontWeight: 600 }}>
          {g.source_text}
        </Highlight>
      )}
      {g.unverified.map((q) => (
        <Text key={q} size="sm" c="red" mt={6}>{t('answer.notFoundText', { quote: q })}</Text>
      ))}
    </Paper>
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

  const style = STATUS_STYLE[result.status]
  const withheld = result.status === 'withheld'
  const clarify = result.status === 'needs_clarification'
  const steps = withheld ? [] : result.next_steps
  const bottomLine = clarify ? result.clarifying_question || result.answer : result.key_point
  const evidence = groupBySource([...result.citations, ...steps])
  const quoteCount = result.citations.length + steps.length
  const verifiedCount = result.checks.citations_verified + result.checks.steps_verified
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
    <Card withBorder radius="lg" padding="xl" shadow="sm" className="answer-card">
      <Text size="sm" c="dimmed" mb="xs">
        {t('answer.youAsked')}{t('punct.colon')}<Text span fs="italic" inherit>{payload.question}</Text>
      </Text>

      <Alert color={style.color} variant="light" icon={style.icon} title={t(`status.${result.status}.title`)} mb="lg">
        {t(`status.${result.status}.desc`)}
      </Alert>

      {/* ① In one sentence */}
      {!withheld && bottomLine && (
        <section aria-labelledby="sec-bottom">
          <SectionLabel n={++n}><span id="sec-bottom">{clarify ? t('answer.clarifyHeading') : t('answer.bottomLine')}</span></SectionLabel>
          <Title order={2} size="h3" fw={700} lh={1.4} className="measure">
            <Readable text={bottomLine} bionic={prefs.bionic} />
          </Title>
          <Group mt="sm" gap="xs">
            <Button variant="light" size="xs" leftSection={speaking ? <IconPlayerStop size={16} /> : <IconVolume size={16} />} onClick={listen}>
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

      {/* Missing information */}
      {result.status === 'insufficient_evidence' && result.missing_info && (
        <Paper withBorder radius="md" p="sm" mt="md" bg="var(--mantine-color-orange-light)">
          <Text size="sm" fw={600}>{t('answer.missing')}</Text>
          <Text size="sm"><Readable text={result.missing_info} bionic={prefs.bionic} /></Text>
        </Paper>
      )}

      {/* ② What to do */}
      {steps.length > 0 && (
        <section aria-labelledby="sec-todo" style={{ marginTop: 'var(--mantine-spacing-xl)' }}>
          <SectionLabel n={++n}><span id="sec-todo">{t('answer.todo')}</span></SectionLabel>
          <Text size="xs" c="dimmed" mb="xs">{t('answer.todoHint')}</Text>
          <Stack gap="xs">
            {steps.map((s, i) => (
              <Paper key={i} withBorder radius="md" p="sm" className={done[i] ? 'step-done' : undefined} style={!s.verified ? { borderColor: 'var(--mantine-color-red-6)' } : undefined}>
                <Checkbox
                  size="md"
                  checked={!!done[i]}
                  onChange={(e) => setDone((d) => ({ ...d, [i]: e.currentTarget.checked }))}
                  label={
                    <Stack gap={6}>
                      <Text fw={600} className="step-action"><Readable text={s.action} bionic={prefs.bionic} /></Text>
                      {s.deadline && (
                        // Not a Badge: badges cut long text off with "…", and the deadline must always be readable in full.
                        <Group
                          gap={6}
                          wrap="nowrap"
                          px="sm"
                          py={4}
                          style={{
                            alignSelf: 'flex-start',
                            maxWidth: '100%',
                            borderRadius: 'var(--mantine-radius-lg)',
                            background: `var(--mantine-color-${s.deadline_supported === false ? 'red' : 'orange'}-light)`,
                            color: `var(--mantine-color-${s.deadline_supported === false ? 'red' : 'orange'}-light-color)`,
                          }}
                        >
                          <IconClock size={16} aria-hidden style={{ flexShrink: 0 }} />
                          <Text component="span" size="sm" fw={700} c="inherit">
                            {t('answer.deadline')}{t('punct.colon')}{s.deadline}
                          </Text>
                        </Group>
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
              </Paper>
            ))}
          </Stack>
          <CopyButton value={checklistText} timeout={2000}>
            {({ copied, copy }) => (
              <Button mt="sm" size="xs" variant="subtle" leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />} onClick={copy}>
                {copied ? t('answer.copied') : t('answer.copySteps')}
              </Button>
            )}
          </CopyButton>
        </section>
      )}

      {/* ③ More detail and ④ evidence, folded so the page stays calm */}
      {!withheld && (result.answer && !clarify || evidence.length > 0) && (
        <Accordion multiple variant="separated" radius="md" mt="xl" defaultValue={prefs.focus ? [] : ['evidence']}>
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
                <Group gap="xs">
                  <IconQuote size={18} aria-hidden />
                  <Text fw={600}>{t('answer.evidence')}</Text>
                  <Badge variant="light" color={verifiedCount === quoteCount ? 'teal' : 'red'}>
                    {t('answer.verified')} {verifiedCount}/{quoteCount}
                  </Badge>
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

      <Divider my="lg" />
      <Group justify="space-between" wrap="wrap" gap="xs">
        <Group gap="xs">
          <Button
            variant="default"
            size="xs"
            leftSection={result.status === 'insufficient_evidence' ? <IconPlus size={16} /> : <IconFlag size={16} />}
            onClick={() => setReportOpen(true)}
          >
            {result.status === 'insufficient_evidence' ? t('report.askAdd') : t('report.problem')}
          </Button>
          <Button variant="subtle" size="xs" onClick={onNew}>{t('answer.newQuestion')}</Button>
        </Group>
        <Text size="xs" c="dimmed" className="hide-in-focus">
          {t('answer.meta', { model: result.meta.model_served, seconds: (result.meta.latency_ms / 1000).toFixed(1) })}
        </Text>
      </Group>

      <ReportModal opened={reportOpen} onClose={() => setReportOpen(false)} payload={payload} result={result} />
    </Card>
  )
}
