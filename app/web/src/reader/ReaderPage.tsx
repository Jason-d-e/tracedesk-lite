import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert, AppShell, Box, Button, Card, Container, Grid, Group, Paper, Skeleton, Stack, Tabs, Text, Textarea, Title, UnstyledButton,
} from '@mantine/core'
import {
  IconAlertTriangle, IconCalendarEvent, IconClipboardList, IconFlask, IconHistory, IconInfoCircle, IconLifebuoy, IconSend, IconUserCheck,
} from '@tabler/icons-react'
import TopBar from '../components/TopBar'
import AnswerCard from './AnswerCard'
import { api, RequestError } from '../api'
import { usePrefs } from '../prefs'
import type { AnswerResult, ApiError, AskPayload } from '../types'

const TOPICS = [
  { key: 'dates', icon: IconCalendarEvent },
  { key: 'register', icon: IconClipboardList },
  { key: 'eligibility', icon: IconUserCheck },
  { key: 'support', icon: IconLifebuoy },
  { key: 'tricky', icon: IconFlask },
] as const

interface Turn {
  id: number
  payload: AskPayload
  result?: AnswerResult
  error?: ApiError
}

export default function ReaderPage() {
  const { t } = useTranslation()
  const { prefs } = usePrefs()
  const [question, setQuestion] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const answerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const active = turns.find((x) => x.id === activeId) ?? null

  async function ask(payload: AskPayload) {
    const id = Date.now()
    setTurns((prev) => [{ id, payload }, ...prev].slice(0, 12))
    setActiveId(id)
    setBusy(true)
    requestAnimationFrame(() => answerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    try {
      const result = await api.ask(payload)
      setTurns((prev) => prev.map((x) => (x.id === id ? { ...x, result } : x)))
    } catch (e) {
      const error = e instanceof RequestError ? e.info : { message: 'generic', retryable: true }
      setTurns((prev) => prev.map((x) => (x.id === id ? { ...x, error } : x)))
    } finally {
      setBusy(false)
    }
  }

  function submit(text = question) {
    const q = text.trim()
    if (!q) return setInputError(t('ask.empty'))
    if (q.length > 500) return setInputError(t('ask.tooLong'))
    setInputError(null)
    setQuestion(q)
    void ask({ question: q })
  }

  function errorMessage(err: ApiError) {
    if (err.code === 'network') return t('errors.network')
    if (err.code === 'model_not_configured') return t('errors.model_not_configured')
    return err.message && err.message !== 'generic' ? err.message : t('errors.generic')
  }

  return (
    <AppShell header={{ height: 64 }} padding="md">
      <AppShell.Header>
        <TopBar page="reader" />
      </AppShell.Header>

      <AppShell.Main>
        <Container size="lg" py="md">
          <Grid gap="xl">
            <Grid.Col span={{ base: 12, md: prefs.focus ? 12 : 8 }}>
              <Stack gap="lg">
                <Alert variant="light" color="yellow" icon={<IconInfoCircle />} className="hide-in-focus" p="sm">
                  <Text size="sm">{t('app.demo')}</Text>
                </Alert>

                {/* 1. Ask */}
                <Card withBorder radius="lg" padding="xl" shadow="sm">
                  <Stack gap="sm">
                    <Title order={1} size="h2">{t('ask.title')}</Title>
                    <Text c="dimmed">{t('ask.subtitle')}</Text>
                    <Textarea
                      ref={inputRef}
                      label={t('ask.label')}
                      placeholder={t('ask.placeholder')}
                      autosize
                      minRows={2}
                      maxRows={6}
                      size="md"
                      value={question}
                      error={inputError}
                      onChange={(e) => setQuestion(e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit()
                      }}
                      maxLength={500}
                    />
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">
                        {t('ask.counter', { count: question.length })} · {t('ask.shortcut')}
                      </Text>
                      <Button size="md" leftSection={<IconSend size={18} />} onClick={() => submit()} loading={busy}>
                        {t('ask.submit')}
                      </Button>
                    </Group>
                  </Stack>
                </Card>

                {/* 2. Suggestions, grouped by topic */}
                <Box className="hide-in-focus">
                  <Text fw={600} mb="xs">{t('ask.suggestionsTitle')}</Text>
                  <Tabs defaultValue="dates" variant="pills" radius="xl">
                    <Tabs.List mb="sm">
                      {TOPICS.map(({ key, icon: Icon }) => (
                        <Tabs.Tab key={key} value={key} leftSection={<Icon size={16} />}>
                          {t(`topics.${key}.label`)}
                        </Tabs.Tab>
                      ))}
                    </Tabs.List>
                    {TOPICS.map(({ key }) => (
                      <Tabs.Panel key={key} value={key}>
                        {key === 'tricky' && <Text size="sm" c="dimmed" mb="xs">{t('topics.tricky.hint')}</Text>}
                        <Group gap="xs">
                          {(t(`topics.${key}.questions`, { returnObjects: true }) as string[]).map((q) => (
                            <Button
                              key={q}
                              variant="light"
                              radius="xl"
                              size="sm"
                              onClick={() => submit(q)}
                              disabled={busy}
                              // Long questions wrap onto a second line on phones instead of being cut off.
                              styles={{ root: { height: 'auto', minHeight: 36, paddingBlock: 6, maxWidth: '100%' }, label: { whiteSpace: 'normal', textAlign: 'left', lineHeight: 1.35 } }}
                            >
                              {q}
                            </Button>
                          ))}
                        </Group>
                      </Tabs.Panel>
                    ))}
                  </Tabs>
                </Box>

                {/* 3. Answer */}
                <div ref={answerRef} aria-live="polite" aria-busy={busy}>
                  {active && !active.result && !active.error && (
                    <Card withBorder radius="lg" padding="xl">
                      <Text fw={600}>{t('loading.title')}</Text>
                      <Text size="sm" c="dimmed" mb="md">{t('loading.hint')}</Text>
                      <Skeleton height={28} radius="sm" mb="sm" />
                      <Skeleton height={14} radius="sm" mb={6} />
                      <Skeleton height={14} radius="sm" width="70%" />
                    </Card>
                  )}
                  {active?.error && (
                    <Alert color="red" variant="light" icon={<IconAlertTriangle />} title={t('errors.title')} role="alert">
                      <Text size="sm" mb={active.error.retryable === false ? 0 : 'sm'}>{errorMessage(active.error)}</Text>
                      {active.error.retryable !== false && (
                        <Button size="xs" variant="white" color="red" onClick={() => ask(active.payload)}>
                          {t('errors.retry')}
                        </Button>
                      )}
                    </Alert>
                  )}
                  {active?.result && (
                    <AnswerCard
                      payload={active.payload}
                      result={active.result}
                      onReply={(reply, clarifying) => ask({ question: reply, context: { previous_question: active.payload.question, clarifying_question: clarifying } })}
                      onNew={() => {
                        setQuestion('')
                        inputRef.current?.focus()
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                    />
                  )}
                </div>
              </Stack>
            </Grid.Col>

            {/* 4. Recent questions */}
            {!prefs.focus && (
              <Grid.Col span={{ base: 12, md: 4 }} className="hide-in-focus">
                <Paper withBorder radius="lg" p="md" pos="sticky" top={80}>
                  <Group gap="xs" mb={4}>
                    <IconHistory size={18} />
                    <Text fw={600}>{t('history.title')}</Text>
                  </Group>
                  <Text size="xs" c="dimmed" mb="sm">{t('history.hint')}</Text>
                  {turns.length === 0 ? (
                    <Text size="sm" c="dimmed">{t('history.empty')}</Text>
                  ) : (
                    <Stack gap={4}>
                      {turns.map((x) => (
                        <UnstyledButton
                          key={x.id}
                          onClick={() => setActiveId(x.id)}
                          p="xs"
                          style={{ borderRadius: 8, background: x.id === activeId ? 'var(--mantine-color-teal-light)' : undefined }}
                          aria-current={x.id === activeId}
                        >
                          <Text size="sm" lineClamp={2}>{x.payload.question}</Text>
                          <Text size="xs" c="dimmed">
                            {x.result ? t(`organiser.statusShort.${x.result.status}`) : x.error ? t('errors.title') : '…'}
                          </Text>
                        </UnstyledButton>
                      ))}
                    </Stack>
                  )}
                </Paper>
              </Grid.Col>
            )}
          </Grid>
          <Text size="xs" c="dimmed" ta="center" mt="xl" className="hide-in-focus">{t('app.footer')}</Text>
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}
