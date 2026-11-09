import { useTranslation } from 'react-i18next'
import { Alert, AppShell, Container, NavLink, Stack, Text, Title } from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { IconArrowLeft, IconBooks, IconChartBar, IconInbox, IconInfoCircle, IconLayoutDashboard, IconPuzzle } from '@tabler/icons-react'
import TopBar from '../components/TopBar'
import { Docs, Gaps, Overview, Quality, Queue } from './sections'

const SECTIONS = [
  { key: 'overview', icon: IconLayoutDashboard, Comp: Overview },
  { key: 'queue', icon: IconInbox, Comp: Queue },
  { key: 'gaps', icon: IconPuzzle, Comp: Gaps },
  { key: 'docs', icon: IconBooks, Comp: Docs },
  { key: 'quality', icon: IconChartBar, Comp: Quality },
] as const

export default function OrganiserPage({ section }: { section: string }) {
  const { t } = useTranslation()
  const [opened, { toggle, close }] = useDisclosure(false)
  const phone = useMediaQuery('(max-width: 48em)')
  const current = SECTIONS.find((s) => s.key === section) ?? SECTIONS[0]
  const Comp = current.Comp

  return (
    <AppShell header={{ height: 64 }} navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !opened } }} padding="md">
      <AppShell.Header>
        <TopBar page="organiser" navOpened={opened} onNavToggle={toggle} />
      </AppShell.Header>

      {/* On phones the closed menu slides off screen; hiding it also keeps keyboard focus out of links nobody can see. */}
      <AppShell.Navbar p="sm" aria-label={t('organiser.title')} style={phone && !opened ? { visibility: 'hidden' } : undefined}>
        <Stack gap={4}>
          {SECTIONS.map(({ key, icon: Icon }) => (
            <NavLink
              key={key}
              href={`#/organiser/${key}`}
              label={t(`organiser.nav.${key}`)}
              leftSection={<Icon size={18} />}
              active={current.key === key}
              onClick={close}
              variant="light"
              style={{ borderRadius: 8 }}
            />
          ))}
          <NavLink href="#/ask" label={t('organiser.back')} leftSection={<IconArrowLeft size={18} />} mt="md" style={{ borderRadius: 8 }} />
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Container size="lg" py="md">
          <Stack gap="lg">
            <div>
              <Title order={1} size="h2">{t(`organiser.nav.${current.key}`)}</Title>
              <Text c="dimmed">{t('organiser.subtitle')}</Text>
            </div>
            <Alert icon={<IconInfoCircle />} p="xs">
              <Text size="sm">{t('organiser.localNote')}</Text>
            </Alert>
            <Comp />
          </Stack>
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}
