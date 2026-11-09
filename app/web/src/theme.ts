import {
  Accordion, Alert, Badge, Button, Card, Checkbox, createTheme, Input, Modal, NavLink, Paper, SegmentedControl, Switch, Tabs,
  type CSSVariablesResolver, type MantineColorsTuple,
} from '@mantine/core'

/*
 * Visual system: Hallmark theme "Coral" (dealt 1/3 for this product, chosen by the team on 2026-11-09).
 * Warm grey paper, cotton stationery, letterpress card controls, General Sans, and one coral ink kept
 * for the settled state (a verified answer), focus and links. The OKLCH tokens live in styles/tokens.css;
 * Mantine needs hex tuples, so the same tokens are converted here (contrast checked: ink on paper 16:1,
 * muted 6.3:1, deep coral 5:1).
 */

// Warm neutrals from paper (0) to ink (9). Used as Mantine's "gray" so every neutral is tinted.
const ink: MantineColorsTuple = ['#f8f4f1', '#f1ece8', '#e8e1dd', '#d9d3cf', '#c7bfba', '#99908c', '#615955', '#433b38', '#312926', '#1d1614']
// Coral, light to deep. 4 is the theme accent, 7 the deep coral used for text and focus.
const coral: MantineColorsTuple = ['#ffeee8', '#fedcd3', '#fbc1b4', '#f7a696', '#ef8b7b', '#dd6b5b', '#ce5245', '#bb3d31', '#9e2d23', '#7f2119']
// Dark mode surfaces, derived from the board: 0 is text, 7 the page.
const board: MantineColorsTuple = ['#f6f3ef', '#e2dcd7', '#c2bab5', '#9b928d', '#5b524e', '#3d3532', '#2f2826', '#221c1a', '#1a1513', '#120e0d']

// Chinese has no glyphs in General Sans, so it falls to Noto Sans SC (loaded as a web font, never the system face).
const FONT = '"General Sans", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", ui-sans-serif, system-ui, sans-serif'

export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {
    '--td-edge-stock': 'var(--edge-stock)',
    '--td-cast': 'var(--cast-stock)',
  },
  light: {
    '--mantine-color-body': 'var(--color-paper)',
    '--mantine-color-text': 'var(--color-ink)',
    '--mantine-color-dimmed': 'var(--color-muted)',
    '--mantine-color-default': 'var(--color-cotton)',
    '--mantine-color-default-hover': 'var(--color-paper-2)',
    '--mantine-color-default-border': 'var(--color-rule-2)',
    '--mantine-color-default-color': 'var(--color-ink)',
    '--mantine-color-placeholder': 'var(--color-muted)',
    '--mantine-color-anchor': 'var(--color-ink)',
    // Tinted ("light") variants: text on the faint tint stays at 4.5:1 or more.
    '--mantine-color-gray-light': 'var(--color-paper-2)',
    '--mantine-color-gray-light-hover': 'var(--color-paper-3)',
    '--mantine-color-gray-light-color': 'var(--color-ink)',
    '--mantine-color-coral-light': '#fbeee9',
    '--mantine-color-coral-light-hover': '#f7e1da',
    '--mantine-color-coral-light-color': '#9e2d23',
    '--mantine-color-coral-filled': '#bb3d31',
    '--mantine-color-coral-filled-hover': '#9e2d23',
    '--mantine-color-red-light-color': '#9e2d23',
    '--mantine-color-red-filled': '#a8322a',
  },
  dark: {
    '--mantine-color-body': 'var(--color-paper)',
    '--mantine-color-text': 'var(--color-ink)',
    '--mantine-color-dimmed': 'var(--color-muted)',
    '--mantine-color-default': 'var(--color-cotton)',
    '--mantine-color-default-hover': 'var(--color-paper-3)',
    '--mantine-color-default-border': 'var(--color-rule-2)',
    '--mantine-color-default-color': 'var(--color-ink)',
    '--mantine-color-anchor': 'var(--color-ink)',
    // In the dark the primary control is the coral ink itself (white text at 5:1), not a dark board.
    '--mantine-color-ink-filled': '#bb3d31',
    '--mantine-color-ink-filled-hover': '#9e2d23',
    '--mantine-color-ink-light': 'var(--color-paper-3)',
    '--mantine-color-ink-light-hover': 'var(--color-rule)',
    '--mantine-color-ink-light-color': 'var(--color-ink)',
    '--mantine-color-gray-light': 'var(--color-paper-3)',
    '--mantine-color-gray-light-color': 'var(--color-ink)',
    '--mantine-color-coral-light': 'rgba(239, 139, 123, 0.14)',
    '--mantine-color-coral-light-color': '#f4ab9e',
    '--mantine-color-coral-filled': '#bb3d31',
    '--mantine-color-red-light-color': '#f4ab9e',
    '--mantine-color-red-filled': '#a8322a',
  },
})

// Letterpress card: cotton stock lit from the left, the cast falling right (Coral controls).
const stock = {
  background: 'var(--color-cotton)',
  boxShadow: 'var(--edge-stock), var(--cast-stock)',
  border: 0,
}

export const theme = createTheme({
  colors: { ink, coral, gray: ink, dark: board },
  primaryColor: 'ink',
  primaryShade: { light: 9, dark: 9 },
  white: '#fdfbf8',
  black: '#1d1614',
  defaultRadius: 'md',
  radius: { xs: '4px', sm: '6px', md: '8px', lg: '8px', xl: '12px' },
  fontFamily: FONT,
  fontFamilyMonospace: '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  headings: { fontFamily: FONT, fontWeight: '600' },
  focusRing: 'auto',
  respectReducedMotion: true,
  cursorType: 'pointer',
  components: {
    // All-caps labels are harder to read; badges wrap instead of cutting text off with "…".
    Badge: Badge.extend({
      defaultProps: { variant: 'outline', color: 'gray', radius: 'sm' },
      styles: {
        root: { height: 'auto', minHeight: 'var(--badge-height)', paddingBlock: 2, maxWidth: '100%', borderColor: 'var(--color-rule-2)' },
        label: { textTransform: 'none', whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', lineHeight: 1.35, fontWeight: 500 },
      },
    }),
    Button: Button.extend({
      defaultProps: { radius: 'md' },
      classNames: { root: 'td-press' },
      vars: (_theme, props) => (props.variant === 'default' || props.variant === 'light' ? { root: { '--button-bd': '0' } } : { root: {} }),
    }),
    Card: Card.extend({ styles: { root: stock } }),
    Paper: Paper.extend({ classNames: { root: 'td-paper' } }),
    Alert: Alert.extend({
      defaultProps: { variant: 'outline', color: 'gray', radius: 'md' },
      styles: { root: { background: 'var(--color-cotton)', borderColor: 'var(--color-rule-2)' }, title: { fontWeight: 600 } },
    }),
    // Field edges need 3:1 against their surface (WCAG 1.4.11): inputs, checkboxes and switch tracks use the muted ink.
    // (styles.css draws them; inline styles here would also override the focus ring.)
    Input: Input.extend({ classNames: { input: 'td-field' } }),
    Checkbox: Checkbox.extend({ defaultProps: { color: 'ink', radius: 'sm' }, classNames: { input: 'td-check' } }),
    Switch: Switch.extend({ defaultProps: { color: 'ink' }, classNames: { track: 'td-switch' } }),
    SegmentedControl: SegmentedControl.extend({
      classNames: { root: 'td-groove', indicator: 'td-groove-card' },
    }),
    Tabs: Tabs.extend({ classNames: { tab: 'td-tab' } }),
    NavLink: NavLink.extend({ classNames: { root: 'td-navlink' } }),
    Accordion: Accordion.extend({ classNames: { item: 'td-acc-item' } }),
    Modal: Modal.extend({ styles: { content: { background: 'var(--color-cotton)' }, header: { background: 'var(--color-cotton)' } } }),
  },
})
