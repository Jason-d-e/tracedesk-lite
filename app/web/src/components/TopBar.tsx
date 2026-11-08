import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActionIcon, Badge, Burger, Button, Group, SegmentedControl, Text, ThemeIcon, Tooltip } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconAdjustmentsHorizontal, IconLayoutDashboard, IconMessageQuestion, IconShieldCheck } from '@tabler/icons-react'
import { LANGS, setLang, type Lang } from '../i18n'
import { api } from '../api'
import SettingsDrawer from './SettingsDrawer'

type ModelState = 'checking' | 'connected' | 'offline' | 'unreachable'

export default function TopBar({ page, navOpened, onNavToggle }: { page: 'reader' | 'organiser'; navOpened?: boolean; onNavToggle?: () => void }) {
  const { t, i18n } = useTranslation()
  const [settingsOpen, settings] = useDisclosure(false)
  const [model, setModel] = useState<ModelState>('checking')

  useEffect(() => {
    api
      .status()
      .then((s) => setModel(s.model_configured ? 'connected' : 'offline'))
      .catch(() => setModel('unreachable'))
  }, [])

  const modelColor = model === 'connected' ? 'teal' : model === 'checking' ? 'gray' : 'orange'

  return (
    <Group h="100%" px="md" justify="space-between" wrap="nowrap">
      <Group gap="sm" wrap="nowrap">
        {onNavToggle && <Burger opened={!!navOpened} onClick={onNavToggle} hiddenFrom="sm" size="sm" aria-label={t('organiser.title')} />}
        <ThemeIcon size={36} radius="md" variant="gradient" gradient={{ from: 'teal.7', to: 'cyan.6', deg: 135 }} aria-hidden>
          <IconShieldCheck size={22} />
        </ThemeIcon>
        <div>
          <Text fw={800} size="lg" lh={1.1}>
            {t('app.name')}
          </Text>
          <Text size="xs" c="dimmed" visibleFrom="md" className="hide-in-focus">
            {t('app.tagline')}
          </Text>
        </div>
      </Group>

      <Group gap="xs" wrap="nowrap">
        {model !== 'checking' && (
          <Badge variant="dot" color={modelColor} visibleFrom="sm" className="hide-in-focus">
            {t(`app.model.${model}`)}
          </Badge>
        )}
        <SegmentedControl
          size="xs"
          value={i18n.language as Lang}
          onChange={(v) => setLang(v as Lang)}
          data={LANGS.map((l) => ({ value: l.value, label: l.label }))}
          aria-label={t('app.language')}
        />
        <Tooltip label={t('settings.open')}>
          <ActionIcon variant="light" size="lg" onClick={settings.open} aria-label={t('settings.open')}>
            <IconAdjustmentsHorizontal size={20} />
          </ActionIcon>
        </Tooltip>
        {page === 'reader' ? (
          <Button component="a" href="#/organiser" variant="subtle" leftSection={<IconLayoutDashboard size={18} />} visibleFrom="sm" className="hide-in-focus">
            {t('app.navOrganiser')}
          </Button>
        ) : (
          <Button component="a" href="#/" variant="subtle" leftSection={<IconMessageQuestion size={18} />} visibleFrom="sm">
            {t('app.navAsk')}
          </Button>
        )}
        <Tooltip label={page === 'reader' ? t('app.navOrganiser') : t('app.navAsk')}>
          <ActionIcon
            component="a"
            href={page === 'reader' ? '#/organiser' : '#/'}
            variant="subtle"
            size="lg"
            hiddenFrom="sm"
            className="hide-in-focus"
            aria-label={page === 'reader' ? t('app.navOrganiser') : t('app.navAsk')}
          >
            {page === 'reader' ? <IconLayoutDashboard size={20} /> : <IconMessageQuestion size={20} />}
          </ActionIcon>
        </Tooltip>
      </Group>
      <SettingsDrawer opened={settingsOpen} onClose={settings.close} />
    </Group>
  )
}
