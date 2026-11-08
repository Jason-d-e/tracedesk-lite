import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Checkbox, Group, Modal, Select, Stack, Text, Textarea } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconCheck } from '@tabler/icons-react'
import { api } from '../api'
import type { AnswerResult, AskPayload, ReviewReason } from '../types'

const REASONS: ReviewReason[] = ['wrong_fact', 'wrong_source', 'missing_information', 'should_have_answered', 'should_have_asked', 'hard_to_follow', 'other']

export default function ReportModal({ opened, onClose, payload, result }: { opened: boolean; onClose: () => void; payload: AskPayload; result: AnswerResult }) {
  const { t } = useTranslation()
  const gap = result.status === 'insufficient_evidence'
  const [reason, setReason] = useState<string | null>(gap ? 'missing_information' : null)
  const [note, setNote] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  async function send() {
    if (!reason) return setError(t('report.needReason'))
    if (!consent) return setError(t('report.needConsent'))
    setError(null)
    setSending(true)
    try {
      const sources = [...new Set([...result.citations, ...result.next_steps].filter((c) => c.verified).map((c) => c.source_id))]
      await api.report({
        question: payload.question,
        answer_status: result.status,
        key_point: result.key_point || result.clarifying_question || '',
        related_sources: sources,
        review_reason: reason,
        note,
        prompt_version: result.meta.prompt_version,
        knowledge_version: result.meta.knowledge_version,
        model: result.meta.model_served,
      })
      notifications.show({ color: 'teal', icon: <IconCheck size={18} />, message: t('report.sent') })
      setNote('')
      setConsent(false)
      onClose()
    } catch {
      setError(t('report.failed'))
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={<Text fw={700}>{gap ? t('report.askAdd') : t('report.title')}</Text>} centered>
      <Stack>
        <Select
          label={t('report.reason')}
          placeholder={t('report.reasonPlaceholder')}
          data={REASONS.map((r) => ({ value: r, label: t(`report.reasons.${r}`) }))}
          value={reason}
          onChange={setReason}
          allowDeselect={false}
          comboboxProps={{ withinPortal: true }}
        />
        <Textarea
          label={t('report.note')}
          description={t('report.noteHint')}
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
          maxLength={300}
          autosize
          minRows={2}
        />
        <Checkbox checked={consent} onChange={(e) => setConsent(e.currentTarget.checked)} label={t('report.consent')} />
        {error && <Text c="red" size="sm" role="alert">{error}</Text>}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>{t('report.cancel')}</Button>
          <Button onClick={send} loading={sending}>{t('report.send')}</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
