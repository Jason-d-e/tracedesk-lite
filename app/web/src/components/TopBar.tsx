import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActionIcon, Burger, Button, Group, SegmentedControl, Text, Tooltip } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconAdjustmentsHorizontal, IconLayoutDashboard, IconMessageQuestion, IconPlugConnected, IconPlugConnectedX } from '@tabler/icons-react'
import { LANGS, setLang, type Lang } from '../i18n'
import { api } from '../api'
import SettingsDrawer from './SettingsDrawer'
import Logo from './Logo'

type ModelState = 'checking' | 'connected' | 'offline' | 'unreachable' | 'local'

export function LanguageSwitch() {
  const { t, i18n } = useTranslation()
  return (
    <SegmentedControl
      size="xs"
      value={i18n.language as Lang}
      onChange={(v) => setLang(v as Lang)}
      data={LANGS.map((l) => ({ value: l.value, label: l.label }))}
      aria-label={t('app.language')}
    />
  )
}

export default function TopBar({ page, navOpened, onNavToggle }: { page: 'reader' | 'organiser'; navOpened?: boolean; onNavToggle?: () => void }) {
  const { t } = useTranslation()
  const [settingsOpen, settings] = useDisclosure(false)
  const [model, setModel] = useState<ModelState>('checking')

  useEffect(() => {
    api
      .status()
      // Without a key the local engine answers, which is a state of its own, not a fault.
      .then((s) => setModel(s.model_configured ? 'connected' : s.engines?.local ? 'local' : 'offline'))
      .catch(() => setModel('unreachable'))
  }, [])

  const other = page === 'reader'
    ? { href: '#/organiser', label: t('app.navOrganiser'), icon: <IconLayoutDashboard size={18} /> }
    : { href: '#/ask', label: t('app.navAsk'), icon: <IconMessageQuestion size={18} /> }

  return (
    <Group h="100%" px="md" justify="space-between" wrap="nowrap">
      <Group gap="sm" wrap="nowrap">
        {onNavToggle && <Burger opened={!!navOpened} onClick={onNavToggle} hiddenFrom="sm" size="sm" aria-label={t('organiser.title')} />}
        <Logo tagline />
      </Group>

      <Group gap="xs" wrap="nowrap">
        {model !== 'checking' && (
          <Group gap={6} visibleFrom="sm" className="hide-in-focus" wrap="nowrap">
            {model === 'connected' || model === 'local' ? <IconPlugConnected size={16} aria-hidden /> : <IconPlugConnectedX size={16} aria-hidden color="var(--mantine-color-red-light-color)" />}
            <Text size="xs" c={model === 'connected' || model === 'local' ? 'dimmed' : 'red'}>{t(`app.model.${model}`)}</Text>
          </Group>
        )}
        <LanguageSwitch />
        <Tooltip label={t('settings.open')} openDelay={800}>
          <ActionIcon variant="default" size="lg" onClick={settings.open} aria-label={t('settings.open')} className="td-press">
            <IconAdjustmentsHorizontal size={20} />
          </ActionIcon>
        </Tooltip>
        <Button component="a" href={other.href} variant="subtle" leftSection={other.icon} visibleFrom="sm" className={page === 'reader' ? 'hide-in-focus' : undefined}>
          {other.label}
        </Button>
        <Tooltip label={other.label} openDelay={800}>
          <ActionIcon component="a" href={other.href} variant="subtle" size="lg" hiddenFrom="sm" className="hide-in-focus" aria-label={other.label}>
            {other.icon}
          </ActionIcon>
        </Tooltip>
      </Group>
      <SettingsDrawer opened={settingsOpen} onClose={settings.close} />
    </Group>
  )
}
