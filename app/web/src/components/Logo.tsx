import { useTranslation } from 'react-i18next'
import { Text } from '@mantine/core'
import { IconShieldCheck } from '@tabler/icons-react'

/** The wordmark: an ink-board tile with the shield mark, and the name. Links back to the cover. */
export default function Logo({ tagline = false }: { tagline?: boolean }) {
  const { t } = useTranslation()
  return (
    <a href="#/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit', flexShrink: 0 }} aria-label={t('app.home')}>
      <span
        aria-hidden
        style={{
          display: 'inline-grid', placeItems: 'center', width: 34, height: 34, borderRadius: 8, flexShrink: 0,
          background: 'var(--color-board)', color: 'var(--color-board-type)', boxShadow: 'var(--cast-stock)',
        }}
      >
        <IconShieldCheck size={20} stroke={1.75} />
      </span>
      <div>
        <Text fw={600} size="lg" lh={1.1} style={{ letterSpacing: '-0.02em' }}>
          {t('app.name')}
        </Text>
        {tagline && (
          <Text size="xs" c="dimmed" visibleFrom="md" className="hide-in-focus">
            {t('app.tagline')}
          </Text>
        )}
      </div>
    </a>
  )
}
