import { PT } from './pt';

/**
 * Minimal i18n. English source text is the key; Portuguese (Brazil) comes from ./pt.ts.
 * Missing translations fall back to English. The locale is fixed for the page's lifetime —
 * switching language reloads the app, so module-level labels can be translated at load.
 */
export type Locale = 'en' | 'pt';

function detect(): Locale {
  try {
    const stored = globalThis.localStorage?.getItem('micenae:locale');
    if (stored === 'en' || stored === 'pt') return stored;
  } catch {
    /* storage unavailable */
  }
  const lang = (globalThis.navigator?.language ?? 'en').toLowerCase();
  return lang.startsWith('pt') ? 'pt' : 'en';
}

export const LOCALE: Locale = detect();
/** BCP-47 tag for speech recognition and number/date formatting */
export const LANG_TAG = LOCALE === 'pt' ? 'pt-BR' : 'en';

export function setLocale(l: Locale) {
  try {
    localStorage.setItem('micenae:locale', l);
  } catch {
    /* ignore */
  }
  location.reload();
}

export function t(s: string, vars?: Record<string, string | number>): string {
  const out = LOCALE === 'pt' ? PT[s] ?? s : s;
  return vars ? out.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`)) : out;
}

/** "Upper A — Heavy" → each part translated */
/** Feminine form where the language needs one: Portuguese "Lavradora" for "Farmer" (key "Farmer (f)"). */
export const tFem = (s: string) => (LOCALE === 'pt' ? PT[`${s} (f)`] ?? PT[s] ?? s : s);
export const tTitle = (title: string) => title.split(' — ').map((p) => t(p)).join(' — ');

/** For the AI prompts */
export const replyLanguage = () => (LOCALE === 'pt' ? 'Brazilian Portuguese' : 'English');
