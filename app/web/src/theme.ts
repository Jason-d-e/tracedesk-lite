import { Badge, createTheme, darken, DEFAULT_THEME, toRgba, type CSSVariablesResolver } from '@mantine/core'

/*
 * Contrast (WCAG 2.2 AA asks for 4.5:1 for normal text). axe-core showed that Mantine's tinted
 * ("light") buttons, badges and nav links reach only about 4.3:1 on white, even with the darkest
 * shade. Instead of hand-picking colours, we darken each palette colour step by step until it
 * passes, using the WCAG relative-luminance formula. A small margin (4.8) absorbs rounding.
 */
const TARGET = 4.8
const channel = (v: number) => {
  const s = v / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const luminance = (color: string) => {
  const { r, g, b } = toRgba(color)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
/** The colour as it looks when painted at `alpha` over white (how Mantine's light variants render). */
const tint = (color: string, alpha: number) => {
  const { r, g, b } = toRgba(color)
  const mix = (x: number) => Math.round(255 * (1 - alpha) + x * alpha)
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}
const darkEnough = (color: string, background: string) => {
  let amount = 0
  while (ratio(darken(color, amount), background) < TARGET && amount < 0.9) amount += 0.05
  return darken(color, amount)
}

const PALETTE = ['teal', 'orange', 'blue', 'red', 'gray', 'yellow', 'green', 'cyan', 'grape', 'violet'] as const

const lightOverrides: Record<string, string> = { '--mantine-color-dimmed': 'var(--mantine-color-gray-7)' }
const darkOverrides: Record<string, string> = { '--mantine-color-dimmed': 'var(--mantine-color-dark-1)' }
for (const name of PALETTE) {
  const base = DEFAULT_THEME.colors[name][9]
  // Solid ("filled") buttons, tabs and badges carry white text in both colour schemes, so the solid
  // colour must be dark enough for white text. Mantine's dark scheme would otherwise use a light shade.
  const filled = darkEnough(base, '#ffffff')
  for (const target of [lightOverrides, darkOverrides]) {
    target[`--mantine-color-${name}-filled`] = filled
    target[`--mantine-color-${name}-filled-hover`] = darken(filled, 0.1)
  }
  lightOverrides[`--mantine-color-${name}-light-color`] = darkEnough(base, tint(base, 0.15))
}

export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: lightOverrides,
  dark: darkOverrides,
})

// Calm, high-contrast palette; system fonts so Chinese and English both render well.
export const theme = createTheme({
  primaryColor: 'teal',
  primaryShade: { light: 9, dark: 4 },
  defaultRadius: 'md',
  fontFamily:
    'system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif',
  headings: {
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif',
    fontWeight: '700',
  },
  respectReducedMotion: true,
  cursorType: 'pointer',
  components: {
    // All-caps labels are harder to read (and turn dates into shouting); keep normal case.
    // Badges wrap onto a second line instead of cutting text off with "…" on narrow screens.
    Badge: Badge.extend({
      styles: {
        root: { height: 'auto', minHeight: 'var(--badge-height)', paddingBlock: 2, maxWidth: '100%' },
        label: { textTransform: 'none', whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', lineHeight: 1.35 },
      },
    }),
  },
})
