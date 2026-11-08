import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert, Badge, Button, Card, Center, Group, Loader, Paper, SegmentedControl, SimpleGrid, Stack, Table, Text, Textarea, ThemeIcon, Title,
} from '@mantine/core'
import { BarChart, DonutChart } from '@mantine/charts'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle, IconCheck, IconCircleCheck, IconClock, IconDownload, IconInbox, IconMessageQuestion, IconSearchOff,
} from '@tabler/icons-react'
import { api } from '../api'
import type { DocInfo, Insights, Quality as QualityData, ReviewItem, Status } from '../types'

const STATUS_COLOR: Record<Status, string> = {
  answered: 'teal.6',
  insufficient_evidence: 'orange.6',
  needs_clarification: 'blue.6',
  withheld: 'red.6',
}

function useLoad<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState(false)
  const reload = useCallback(() => {
    fn().then(setData).catch(() => setError(true))
  }, [fn])
  useEffect(reload, [reload])
  return { data, error, reload }
}

function Loading({ error }: { error: boolean }) {
  const { t } = useTranslation()
  return error ? (
    <Alert color="red" icon={<IconAlertCircle />}>{t('errors.network')}</Alert>
  ) : (
    <Center py="xl"><Loader /></Center>
  )
}

const when = (iso: string, lang: string) => (iso ? new Date(iso).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '')

function Stat({ label, value, icon, color }: { label: string; value: ReactNode; icon: ReactNode; color: string }) {
  return (
    <Paper withBorder radius="lg" p="md">
      {/* nowrap keeps the icon on the right even when a long label wraps; labels stay in normal case (easier to read than capitals). */}
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
        <div style={{ minWidth: 0 }}>
          <Text size="sm" c="dimmed" fw={600}>{label}</Text>
          <Text fw={800} fz={32} lh={1.2}>{value}</Text>
        </div>
        <ThemeIcon size={42} radius="md" variant="light" color={color} aria-hidden style={{ flexShrink: 0 }}>{icon}</ThemeIcon>
      </Group>
    </Paper>
  )
}

/* ---------------- Overview ---------------- */
const loadOverview = () => Promise.all([api.insights(), api.reviews('pending')])

export function Overview() {
  const { t } = useTranslation()
  const { data, error } = useLoad(loadOverview)
  if (!data) return <Loading error={error} />
  const [ins, rev] = data as [Insights, { counts: { pending: number } }]
  const total = ins.questions_answered_by_app
  const pct = (n = 0) => (total ? `${Math.round((100 * n) / total)}%` : '–')
  const donut = (Object.keys(STATUS_COLOR) as Status[])
    .filter((s) => ins.by_status[s])
    .map((s) => ({ name: t(`organiser.statusShort.${s}`), value: ins.by_status[s] ?? 0, color: STATUS_COLOR[s] }))
  // Axis labels wrap onto several lines, so questions are shown in full unless they are very long.
  const bars = ins.top_gaps.slice(0, 6).map((g) => ({ question: g.question.length > 70 ? `${g.question.slice(0, 69)}…` : g.question, count: g.asked + g.reported }))

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
        <Stat label={t('organiser.overview.questions')} value={total} icon={<IconMessageQuestion />} color="teal" />
        <Stat label={t('organiser.overview.answered')} value={pct(ins.by_status.answered)} icon={<IconCircleCheck />} color="teal" />
        <Stat label={t('organiser.overview.notCovered')} value={pct(ins.by_status.insufficient_evidence)} icon={<IconSearchOff />} color="orange" />
        <Stat label={t('organiser.overview.openReports')} value={rev.counts.pending} icon={<IconInbox />} color="blue" />
      </SimpleGrid>
      {total === 0 ? (
        <Alert color="gray">{t('organiser.overview.noData')}</Alert>
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <Card withBorder radius="lg" padding="lg">
            <Title order={2} size="h4" mb="md">{t('organiser.overview.statusChart')}</Title>
            <Center>
              <DonutChart data={donut} withLabels withLabelsLine withTooltip size={180} thickness={28} chartLabel={total} />
            </Center>
            <Group justify="center" gap="md" mt="md">
              {donut.map((d) => (
                <Group key={d.name} gap={6}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: `var(--mantine-color-${d.color.replace('.', '-')})` }} aria-hidden />
                  <Text size="sm">{d.name} · {d.value}</Text>
                </Group>
              ))}
            </Group>
          </Card>
          <Card withBorder radius="lg" padding="lg">
            <Title order={2} size="h4" mb="md">{t('organiser.overview.gapsChart')}</Title>
            {bars.length ? (
              <BarChart h={280} data={bars} dataKey="question" orientation="vertical" yAxisProps={{ width: 200, interval: 0 }} barProps={{ maxBarSize: 34, radius: 6 }} series={[{ name: 'count', label: t('organiser.overview.times'), color: 'orange.6' }]} gridAxis="none" />
            ) : (
              <Text c="dimmed">{t('organiser.gaps.empty')}</Text>
            )}
          </Card>
        </SimpleGrid>
      )}
    </Stack>
  )
}

/* ---------------- Reader reports ---------------- */
function ReviewCard({ item, onSaved }: { item: ReviewItem; onSaved: () => void }) {
  const { t, i18n } = useTranslation()
  const [note, setNote] = useState(item.reviewer_note)
  const [saving, setSaving] = useState(false)
  const done = item.review_status === 'reviewed'

  async function save() {
    setSaving(true)
    try {
      await api.updateReview(item.id, done ? 'pending' : 'reviewed', note)
      notifications.show({ color: 'teal', icon: <IconCheck size={18} />, message: t('organiser.queue.saved') })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card withBorder radius="lg" padding="lg">
      <Group justify="space-between" align="flex-start" mb="xs" wrap="wrap">
        <Text fw={700} size="lg">{item.question}</Text>
        {done ? (
          <Badge color="teal" leftSection={<IconCheck size={12} />}>{t('organiser.queue.done', { date: when(item.reviewed_at, i18n.language) })}</Badge>
        ) : (
          <Badge color="blue" variant="light" leftSection={<IconClock size={12} />}>{t('organiser.queue.filters.pending')}</Badge>
        )}
      </Group>
      <Group gap="xs" mb="sm">
        {item.answer_status && <Badge variant="light" color={STATUS_COLOR[item.answer_status].split('.')[0]}>{t(`organiser.statusShort.${item.answer_status}`)}</Badge>}
        <Badge variant="outline" color="gray">{t(`report.reasons.${item.review_reason}`)}</Badge>
        <Text size="xs" c="dimmed">{t('organiser.queue.reported', { date: when(item.created_at, i18n.language) })}</Text>
      </Group>
      <Stack gap={4} mb="sm">
        {item.key_point && <Text size="sm"><b>{t('organiser.queue.answerGiven')}{t('punct.colon')}</b> {item.key_point}</Text>}
        {item.user_note && <Text size="sm"><b>{t('organiser.queue.readerNote')}{t('punct.colon')}</b> <i>{item.user_note}</i></Text>}
        {item.related_sources.length > 0 && <Text size="xs" c="dimmed">{t('organiser.queue.sources')}{t('punct.colon')}{item.related_sources.join(', ')}</Text>}
      </Stack>
      <Textarea
        label={t('organiser.queue.resolution')}
        placeholder={t('organiser.queue.resolutionPlaceholder')}
        value={note}
        onChange={(e) => setNote(e.currentTarget.value)}
        maxLength={300}
        autosize
        minRows={1}
      />
      <Group justify="flex-end" mt="sm">
        <Button variant={done ? 'default' : 'filled'} onClick={save} loading={saving} leftSection={done ? undefined : <IconCheck size={16} />}>
          {done ? t('organiser.queue.reopen') : t('organiser.queue.markDone')}
        </Button>
      </Group>
    </Card>
  )
}

export function Queue() {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<'pending' | 'reviewed' | 'all'>('pending')
  const loader = useCallback(() => api.reviews(filter === 'all' ? '' : filter), [filter])
  const { data, error, reload } = useLoad(loader)

  return (
    <Stack>
      <Group justify="space-between" wrap="wrap">
        <SegmentedControl
          value={filter}
          onChange={(v) => setFilter(v as typeof filter)}
          data={[
            { value: 'pending', label: `${t('organiser.queue.filters.pending')}${data ? ` (${data.counts.pending})` : ''}` },
            { value: 'reviewed', label: `${t('organiser.queue.filters.reviewed')}${data ? ` (${data.counts.reviewed})` : ''}` },
            { value: 'all', label: t('organiser.queue.filters.all') },
          ]}
        />
        <Button component="a" href={`/api/reviews.csv${filter === 'all' ? '' : `?status=${filter}`}`} variant="light" leftSection={<IconDownload size={16} />}>
          {t('organiser.queue.export')}
        </Button>
      </Group>
      {!data ? (
        <Loading error={error} />
      ) : data.reviews.length === 0 ? (
        <Alert color="gray">{t('organiser.queue.empty')}</Alert>
      ) : (
        data.reviews.map((item) => <ReviewCard key={`${item.id}-${item.review_status}`} item={item} onSaved={reload} />)
      )}
    </Stack>
  )
}

/* ---------------- Knowledge gaps ---------------- */
export function Gaps() {
  const { t } = useTranslation()
  const { data, error } = useLoad(api.insights)
  if (!data) return <Loading error={error} />
  return (
    <Stack>
      <Text>{t('organiser.gaps.intro')}</Text>
      {data.top_gaps.length === 0 ? (
        <Alert color="gray">{t('organiser.gaps.empty')}</Alert>
      ) : (
        data.top_gaps.map((g, i) => (
          <Paper key={g.question} withBorder radius="lg" p="md">
            <Group align="flex-start" wrap="nowrap">
              <ThemeIcon radius="xl" size={32} variant="light" color="orange" aria-hidden><Text fw={800} size="sm">{i + 1}</Text></ThemeIcon>
              <Stack gap={6} style={{ flex: 1 }}>
                <Text fw={700}>{g.question}</Text>
                <Group gap="xs">
                  {g.reported > 0 && <Badge color="orange">{t('organiser.gaps.requested', { count: g.reported })}</Badge>}
                  {g.asked > 0 && <Badge variant="light" color="gray">{t('organiser.gaps.asked', { count: g.asked })}</Badge>}
                </Group>
                {g.missing_info && <Text size="sm"><b>{t('organiser.gaps.missing')}{t('punct.colon')}</b> {g.missing_info}</Text>}
                {g.reader_notes.length > 0 && <Text size="sm" c="dimmed"><b>{t('organiser.gaps.notes')}{t('punct.colon')}</b> {g.reader_notes.slice(0, 3).join(' · ')}</Text>}
              </Stack>
            </Group>
          </Paper>
        ))
      )}
      <Text size="xs" c="dimmed">{t('organiser.gaps.excluded')}</Text>
    </Stack>
  )
}

/* ---------------- Documents ---------------- */
export function Docs() {
  const { t } = useTranslation()
  const { data, error } = useLoad(api.sources)
  if (!data) return <Loading error={error} />
  return (
    <Stack>
      <Text>{t('organiser.docs.intro')}</Text>
      <Text size="xs" c="dimmed">{data.knowledge_version}</Text>
      {/* On phones the table scrolls sideways; tabIndex lets keyboard users focus it and scroll with arrow keys. */}
      <Table.ScrollContainer minWidth={560} type="native" tabIndex={0} role="region" aria-label={t('organiser.nav.docs')}>
        <Table striped highlightOnHover withTableBorder verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              {(['id', 'title', 'version', 'status', 'date', 'sections'] as const).map((c) => <Table.Th key={c}>{t(`organiser.docs.cols.${c}`)}</Table.Th>)}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.documents.map((d: DocInfo) => (
              <Table.Tr key={d.id}>
                <Table.Td><Text ff="monospace" size="sm">{d.id}</Text></Table.Td>
                <Table.Td>{d.title}</Table.Td>
                <Table.Td>{d.version}</Table.Td>
                <Table.Td>
                  {d.status === 'active' ? (
                    <Badge color="teal" variant="light">{t('organiser.docs.current')}</Badge>
                  ) : (
                    <Badge color="gray" variant="light">{t('organiser.docs.superseded', { by: d.superseded_by ?? '?' })}</Badge>
                  )}
                </Table.Td>
                <Table.Td>{d.effective_date}</Table.Td>
                <Table.Td>{d.sections.length}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  )
}

/* ---------------- Answer quality ---------------- */
export function Quality() {
  const { t } = useTranslation()
  const { data, error } = useLoad(api.quality)
  if (!data) return <Loading error={error} />
  const q = data as QualityData
  const rows = Object.entries(q.metrics).map(([key, m]) => ({
    metric: t(`organiser.quality.metrics.${key}`),
    plain: Math.round((100 * m.plain) / m.n),
    ours: Math.round((100 * m.ours) / m.n),
  }))
  const cents = (usd: number) => `${(usd * 100).toFixed(3)} ¢`

  return (
    <Stack gap="lg">
      <Text>{t('organiser.quality.intro')}</Text>
      <Card withBorder radius="lg" padding="lg">
        <Title order={2} size="h4" mb="md">{t('organiser.quality.chart', { n: q.held_out_questions })}</Title>
        {/* Horizontal bars: the check names stay level and readable instead of slanted axis labels. */}
        <BarChart
          h={400}
          data={rows}
          dataKey="metric"
          orientation="vertical"
          withLegend
          legendProps={{ verticalAlign: 'bottom' }}
          xAxisProps={{ domain: [0, 100] }}
          yAxisProps={{ width: 200, interval: 0 }}
          valueFormatter={(v) => `${v}%`}
          barProps={{ maxBarSize: 16, radius: 4 }}
          gridAxis="x"
          series={[
            { name: 'ours', label: t('organiser.quality.ours'), color: 'teal.7' },
            { name: 'plain', label: t('organiser.quality.plain'), color: 'gray.5' },
          ]}
        />
      </Card>
      <Card withBorder radius="lg" padding="lg">
        <Title order={2} size="h4" mb="sm">{t('organiser.quality.runsTitle')}</Title>
        <Table withTableBorder verticalSpacing="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('organiser.quality.runsCols.prompt')}</Table.Th>
              <Table.Th>{t('organiser.quality.runsCols.plain')}</Table.Th>
              <Table.Th>{t('organiser.quality.runsCols.ours')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {q.runs.map((r) => (
              <Table.Tr key={r.prompt}>
                <Table.Td><Text ff="monospace" size="sm">{r.prompt}</Text></Table.Td>
                <Table.Td>{r.plain}/{r.n}</Table.Td>
                <Table.Td><b>{r.ours}/{r.n}</b></Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <Text size="sm" c="dimmed" mt="sm">{t('organiser.quality.variance')}</Text>
      </Card>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <Stat label={`${t('organiser.quality.cost')} · ${t('organiser.quality.ours')}`} value={cents(q.cost_per_question_usd.ours)} icon={<IconCircleCheck />} color="teal" />
        <Stat label={`${t('organiser.quality.latency')} · ${t('organiser.quality.ours')}`} value={`${q.median_latency_s.ours} s`} icon={<IconClock />} color="teal" />
      </SimpleGrid>
      <Alert color="yellow" variant="light" icon={<IconAlertCircle />}>{t('organiser.quality.note')} ({q.run_date})</Alert>
    </Stack>
  )
}
