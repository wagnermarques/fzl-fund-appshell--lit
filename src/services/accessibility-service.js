/**
 * Preferências de acessibilidade do usuário: tema, fonte e tamanho do texto.
 *
 * O que o usuário *pode* escolher vem da opção `accessibility` do
 * appshell.config.js, resolvida no build pelo preset do Vite e entregue
 * aqui como __APPSHELL_ACCESSIBILITY__ (ver src/accessibility-config.js).
 * O que ele *escolheu* fica no localStorage com o prefixo do app, como o
 * consentimento — dois apps na mesma origem guardam cada um o seu.
 *
 * Aplicar = marcar o <html>: data-theme e data-font (lidos por theme.css)
 * e --app-text-scale (o font-size da raiz, de que todo rem depende).
 * Escolha "system" remove o atributo, e aí theme.css segue as preferências
 * do sistema operacional (prefers-color-scheme, prefers-contrast).
 */
import { ACCESSIBILITY_DISABLED, resolveAccessibility } from '../accessibility-config.js'
import { storageKey } from '../storage-keys.js'

/** Config resolvida no build; fora do Vite (ex.: um teste sem o preset)
 *  vale o padrão, tudo ligado. */
export const accessibilityConfig =
  typeof __APPSHELL_ACCESSIBILITY__ !== 'undefined' ? __APPSHELL_ACCESSIBILITY__ : resolveAccessibility()

const listeners = new Set()

function key() {
  return storageKey('a11y:preferences')
}

function defaultStorage() {
  return globalThis.localStorage ?? null
}

function defaultRoot() {
  return globalThis.document?.documentElement ?? null
}

/** Mantém só valores que a config permite; o resto volta ao padrão do app.
 *  Protege contra storage adulterado e contra o app ter tirado, numa versão
 *  nova, uma opção que o usuário tinha escolhido. */
export function sanitizePreferences(prefs, config = accessibilityConfig) {
  const { defaults } = config
  const source = prefs && typeof prefs === 'object' ? prefs : {}
  const allowed = {
    theme: ['system', ...config.themes],
    font: ['system', ...config.fonts],
    textScale: config.textScales,
  }
  return {
    theme: allowed.theme.includes(source.theme) ? source.theme : defaults.theme,
    font: allowed.font.includes(source.font) ? source.font : defaults.font,
    textScale: allowed.textScale.includes(source.textScale) ? source.textScale : defaults.textScale,
  }
}

export function readPreferences(storage = defaultStorage(), config = accessibilityConfig) {
  if (!config.enabled) return { ...ACCESSIBILITY_DISABLED.defaults }
  try {
    const raw = storage?.getItem(key())
    return sanitizePreferences(raw ? JSON.parse(raw) : null, config)
  } catch {
    return sanitizePreferences(null, config)
  }
}

/** Marca o <html> com as preferências. Idempotente. */
export function applyPreferences(prefs, root = defaultRoot()) {
  if (!root) return
  const set = (attr, value) => (value === 'system' ? root.removeAttribute(attr) : root.setAttribute(attr, value))
  set('data-theme', prefs.theme)
  set('data-font', prefs.font)
  if (prefs.textScale === 1) root.style.removeProperty('--app-text-scale')
  else root.style.setProperty('--app-text-scale', String(prefs.textScale))
}

export const accessibilityService = {
  config: accessibilityConfig,

  get(storage) {
    return readPreferences(storage)
  },

  /** Salva uma ou mais preferências (as outras ficam como estão), aplica e
   *  avisa os inscritos. Valor que a config não permite é erro. */
  set(changes, storage = defaultStorage(), root = defaultRoot()) {
    const next = { ...readPreferences(storage), ...changes }
    const clean = sanitizePreferences(next)
    for (const field of Object.keys(changes)) {
      if (clean[field] !== next[field]) {
        throw new Error(`accessibilityService.set: "${field}" não aceita "${changes[field]}" nesta config`)
      }
    }
    try {
      storage?.setItem(key(), JSON.stringify(clean))
    } catch {
      // Storage indisponível: a escolha vale só para esta sessão.
    }
    applyPreferences(clean, root)
    listeners.forEach((fn) => fn(clean))
    return clean
  },

  /** Volta aos padrões do app. */
  reset(storage = defaultStorage(), root = defaultRoot()) {
    try {
      storage?.removeItem(key())
    } catch {
      // idem set()
    }
    const prefs = readPreferences(storage)
    applyPreferences(prefs, root)
    listeners.forEach((fn) => fn(prefs))
    return prefs
  },

  /** Aplica o que está salvo — chamado por index.js o mais cedo possível,
   *  antes do app montar, para a tela não piscar no tema padrão. */
  apply(storage, root) {
    applyPreferences(readPreferences(storage), root)
  },

  /** Chama o callback a cada mudança (não na inscrição). */
  subscribe(callback) {
    listeners.add(callback)
    return () => listeners.delete(callback)
  },
}
