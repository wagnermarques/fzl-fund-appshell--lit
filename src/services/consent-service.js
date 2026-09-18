/**
 * Consentimento do usuário para o analytics (LGPD).
 *
 * Três estados: 'granted', 'denied' ou null (ainda não respondeu). Só
 * 'granted' libera o GA4 — enquanto a resposta não vem, o analytics-service
 * nem carrega o gtag.js (ver lá o porquê do modo "básico" do Consent Mode).
 * A escolha fica no localStorage com o prefixo do app, então dois apps na
 * mesma origem pedem e guardam o consentimento cada um por si.
 *
 * Revogar tem que ser tão fácil quanto aceitar (LGPD, art. 8º §5º): a
 * resposta pode ser trocada a qualquer momento em Config > Privacidade.
 */
import { storageKey } from '../storage-keys.js'

export const CONSENT_VALUES = ['granted', 'denied']

const listeners = new Set()

function key() {
  return storageKey('consent:analytics')
}

function defaultStorage() {
  return globalThis.localStorage ?? null
}

/** Lê a escolha salva; qualquer valor inesperado conta como "não respondeu". */
export function readConsent(storage = defaultStorage()) {
  try {
    const value = storage?.getItem(key())
    return CONSENT_VALUES.includes(value) ? value : null
  } catch {
    return null
  }
}

export const consentService = {
  get(storage) {
    return readConsent(storage)
  },

  /** Salva a escolha e avisa os inscritos. */
  set(value, storage = defaultStorage()) {
    if (!CONSENT_VALUES.includes(value)) {
      throw new Error(`consentService.set: valor inválido "${value}" (use "granted" ou "denied")`)
    }
    try {
      storage?.setItem(key(), value)
    } catch {
      // Storage indisponível (aba anônima com cota zero etc.): a escolha
      // vale para esta sessão, que é o melhor possível.
    }
    listeners.forEach((fn) => fn(value))
  },

  /** Chama o callback a cada mudança (não na inscrição). */
  subscribe(callback) {
    listeners.add(callback)
    return () => listeners.delete(callback)
  },
}
