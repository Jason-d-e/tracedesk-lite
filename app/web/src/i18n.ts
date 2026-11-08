import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en'
import zh from './locales/zh'

export const LANGS = [
  { value: 'zh', label: '中文', html: 'zh-CN' },
  { value: 'en', label: 'EN', html: 'en' },
] as const
export type Lang = (typeof LANGS)[number]['value']

const KEY = 'tracedesk-lang'

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'en' || saved === 'zh') return saved
  } catch {
    /* storage unavailable */
  }
  return navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export function setLang(lang: Lang) {
  void i18n.changeLanguage(lang)
  try {
    localStorage.setItem(KEY, lang)
  } catch {
    /* ignore */
  }
}

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = LANGS.find((l) => l.value === lng)?.html ?? 'en'
})

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, zh: { translation: zh } },
  lng: initialLang(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnObjects: true,
})

export default i18n
