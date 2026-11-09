import { useTranslation } from 'react-i18next'
import { Drawer, Group, SegmentedControl, Slider, Stack, Switch, Text, useMantineColorScheme, type MantineColorScheme } from '@mantine/core'
import { usePrefs, type TextSize } from '../prefs'

export default function SettingsDrawer({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const { prefs, set } = usePrefs()
  const { colorScheme, setColorScheme } = useMantineColorScheme()

  return (
    <Drawer opened={opened} onClose={onClose} title={<Text fw={600} size="lg">{t('settings.title')}</Text>} position="right" size="sm" padding="lg">
      <Stack gap="xl">
        <Text size="sm" c="dimmed">{t('settings.intro')}</Text>

        <Switch
          size="md"
          checked={prefs.focus}
          onChange={(e) => set({ focus: e.currentTarget.checked })}
          label={t('settings.focus')}
          description={t('settings.focusHint')}
        />

        <Stack gap={6}>
          <Text fw={500} size="sm" id="size-label">{t('settings.size')}</Text>
          <SegmentedControl
            fullWidth
            value={prefs.textSize}
            onChange={(v) => set({ textSize: v as TextSize })}
            data={(['md', 'lg', 'xl'] as const).map((s) => ({ value: s, label: t(`settings.sizes.${s}`) }))}
            aria-labelledby="size-label"
          />
        </Stack>

        <Switch
          size="md"
          checked={prefs.bionic}
          onChange={(e) => set({ bionic: e.currentTarget.checked })}
          label={t('settings.bionic')}
          description={t('settings.bionicHint')}
        />

        <Stack gap={6}>
          <Text fw={500} size="sm" id="rate-label">{t('settings.rate')}</Text>
          <Slider
            min={0.7}
            max={1.3}
            step={0.05}
            value={prefs.rate}
            onChange={(v) => set({ rate: v })}
            label={(v) => `${v.toFixed(2)}×`}
            marks={[{ value: 0.7 }, { value: 1 }, { value: 1.3 }]}
            aria-labelledby="rate-label"
          />
          {/* End labels sit under the slider, inside the drawer's padding (slider mark labels overflow it). */}
          <Group justify="space-between" aria-hidden>
            <Text size="xs" c="dimmed">{t('settings.rateSlow')}</Text>
            <Text size="xs" c="dimmed">{t('settings.rateFast')}</Text>
          </Group>
        </Stack>

        <Stack gap={6}>
          <Text fw={500} size="sm" id="theme-label">{t('settings.theme')}</Text>
          <SegmentedControl
            fullWidth
            value={colorScheme}
            onChange={(v) => setColorScheme(v as MantineColorScheme)}
            data={(['auto', 'light', 'dark'] as const).map((s) => ({ value: s, label: t(`settings.themes.${s}`) }))}
            aria-labelledby="theme-label"
          />
        </Stack>
      </Stack>
    </Drawer>
  )
}
