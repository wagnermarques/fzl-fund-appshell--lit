/**
 * Preferências de acessibilidade do usuário: tema, fonte e tamanho do texto.
 *
 * O que o usuário *pode* escolher vem da config resolvida por
 * resolveAccessibility() (./config.js). O que ele *escolheu* fica no
 * storage, sob a chave que quem usa passar — com o prefixo do app, para
 * dois apps na mesma origem guardarem cada um o seu.
 *
 * Aplicar = marcar o <html>: data-theme e data-font (lidos pelo CSS — ver
 * ./a11y.css) e --a11y-text-scale (o font-size da raiz, de que todo rem
 * depende). Escolha "system" remove o atributo, e aí o CSS segue as
 * preferências do sistema operacional (prefers-color-scheme,
 * prefers-contrast).
 */
import { ACCESSIBILITY_DISABLED, resolveAccessibility } from './config.js'

export const TEXT_SCALE_PROPERTY = '--a11y-text-scale'

function defaultStorage() {
  return globalThis.localStorage ?? null
}

function defaultRoot() {
  return globalThis.document?.documentElement ?? null
}

/** Mantém só valores que a config permite; o resto volta ao padrão do app.
 *  Protege contra storage adulterado e contra o app ter tirado, numa versão
 *  nova, uma opção que o usuário tinha escolhido. */
export function sanitizePreferences(prefs, config) {
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

export function readPreferences(storage, key, config) {
  if (!config.enabled) return { ...ACCESSIBILITY_DISABLED.defaults }
  try {
    const raw = storage?.getItem(key)
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
  if (prefs.textScale === 1) root.style.removeProperty(TEXT_SCALE_PROPERTY)
  else root.style.setProperty(TEXT_SCALE_PROPERTY, String(prefs.textScale))
}

/**
 * Cria o serviço de preferências de um app.
 *
 *   const prefs = createPreferences({
 *     config: resolveAccessibility({ fonts: ['atkinson'] }),
 *     key: 'meuapp:a11y:preferences',
 *   })
 *   prefs.apply()   // o mais cedo possível, antes de o app montar
 *
 * key pode ser uma função, chamada a cada leitura — para quando o prefixo
 * só existe depois do import. storage e root são injetáveis (testes, SSR).
 */
export function createPreferences({
  config = resolveAccessibility(),
  key = 'a11y:preferences',
  storage = defaultStorage(),
  root = defaultRoot(),
} = {}) {
  const listeners = new Set()
  const storageKey = typeof key === 'function' ? key : () => key
  const read = () => readPreferences(storage, storageKey(), config)

  const notify = (prefs) => {
    applyPreferences(prefs, root)
    listeners.forEach((fn) => fn(prefs))
    return prefs
  }

  return {
    config,

    /** A chave em uso no storage (com o prefixo, se houver). */
    get key() {
      return storageKey()
    },

    get: read,

    /** Salva uma ou mais preferências (as outras ficam como estão), aplica e
     *  avisa os inscritos. Valor que a config não permite é erro. */
    set(changes) {
      const next = { ...read(), ...changes }
      const clean = sanitizePreferences(next, config)
      for (const field of Object.keys(changes)) {
        if (clean[field] !== next[field]) {
          throw new Error(`preferências de acessibilidade: "${field}" não aceita "${changes[field]}" nesta config`)
        }
      }
      try {
        storage?.setItem(storageKey(), JSON.stringify(clean))
      } catch {
        // Storage indisponível: a escolha vale só para esta sessão.
      }
      return notify(clean)
    },

    /** Volta aos padrões do app. */
    reset() {
      try {
        storage?.removeItem(storageKey())
      } catch {
        // idem set()
      }
      return notify(read())
    },

    /** Aplica o que está salvo, sem avisar os inscritos — para chamar antes
     *  de o app montar, e a tela não piscar no tema padrão. */
    apply() {
      applyPreferences(read(), root)
    },

    /** Chama o callback a cada mudança (não na inscrição). */
    subscribe(callback) {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
  }
}
