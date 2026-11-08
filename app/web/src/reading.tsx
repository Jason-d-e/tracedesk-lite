// Reading aids reused from open source: easy-speech (read aloud) and text-vide (bold word starts).
import EasySpeech from 'easy-speech'
import { textVide } from 'text-vide'
import type { ReactNode } from 'react'

const CJK = /[぀-ヿ㐀-鿿가-힯]/
const OPEN = '\u0001'
const CLOSE = '\u0002'

/** Bold the start of each English word when enabled; Chinese text is returned unchanged. Never uses HTML injection. */
export function Readable({ text, bionic }: { text: string; bionic: boolean }): ReactNode {
  if (!bionic || CJK.test(text)) return text
  const marked = textVide(text, { sep: [OPEN, CLOSE] })
  return marked.split(OPEN).map((part, i) => {
    const [bold, rest] = part.includes(CLOSE) ? part.split(CLOSE) : [null, part]
    return (
      <span key={i}>
        {bold && <b className="vide">{bold}</b>}
        {rest}
      </span>
    )
  })
}

let ready: Promise<boolean> | null = null
function init(): Promise<boolean> {
  if (!ready) {
    ready = (async () => {
      if (!EasySpeech.detect().speechSynthesis) return false
      try {
        await EasySpeech.init({ maxTimeout: 5000, interval: 250 })
        return true
      } catch {
        return false
      }
    })()
  }
  return ready
}

export async function speak(text: string, rate: number): Promise<boolean> {
  if (!(await init())) return false
  EasySpeech.cancel()
  const lang = CJK.test(text) ? 'zh' : 'en'
  const voice = EasySpeech.voices().find((v) => v.lang?.toLowerCase().startsWith(lang))
  try {
    await EasySpeech.speak({ text, voice, rate, pitch: 1, volume: 1 })
  } catch {
    /* cancelled or interrupted */
  }
  return true
}

export function stopSpeaking() {
  try {
    EasySpeech.cancel()
  } catch {
    /* not initialised */
  }
}
