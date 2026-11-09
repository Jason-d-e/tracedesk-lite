import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/charts/styles.css'
import './styles/tokens.css'
import './styles.css'
import './i18n'
import { theme, cssVariablesResolver } from './theme'
import App from './App'

// Coral is a light paper theme; dark mode is opt-in from Reading settings (Hallmark: derived, never by default).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} defaultColorScheme="light">
      <Notifications position="top-center" />
      <App />
    </MantineProvider>
  </StrictMode>,
)
