/**
 * defineAppShellConfig() — o equivalente do defineConfig() do Vite para o
 * appshell.config.js de cada app. Não transforma nada: valida cedo (um erro
 * de digitação quebra o `vite build`/`vite dev` na hora) e dá ao editor os
 * tipos abaixo para autocompletar.
 *
 * appshell.config.js é o lugar central das opções *declarativas* do app —
 * nada de lit, html`` ou funções —, porque é lido pelo vite.config.js, que
 * roda no Node:
 *
 *   // appshell.config.js
 *   import { defineAppShellConfig } from 'fzl-fund-appshell--lit/config'
 *   export default defineAppShellConfig({
 *     title: 'Ler-gislação',
 *     storagePrefix: 'legisreader',
 *     accessibility: { fonts: ['atkinson'], defaults: { font: 'atkinson' } },
 *     analytics: { requireConsent: true, privacyUrl: '#/privacidade' },
 *     push: { vapidPublicKey: '' },   // cada ambiente põe a sua (variável de ambiente)
 *   })
 *
 *   // vite.config.js
 *   import appshell from './appshell.config.js'
 *   export default defineConfig(appshellConfig({ ...appshell, manifest: { ... } }))
 *
 * O preset entrega tudo ao navegador (constantes de build) e o
 * createAppShell() mescla sozinho; o main.js fica só com o que é código:
 * rotas, home, drawer, provedor de auth, listeners. Esquema, segredos
 * proibidos e as variáveis de ambiente que sobrescrevem cada valor:
 * src/app-config.js.
 */
import { resolveAccessibility } from './a11y/config.js'
import { validateAppConfig } from './app-config.js'

/**
 * @typedef {'atkinson' | 'opendyslexic'} AppShellFont
 * @typedef {'light' | 'dark' | 'high-contrast-light' | 'high-contrast-dark'} AppShellTheme
 * @typedef {1 | 1.25 | 1.5 | 1.75 | 2} AppShellTextScale
 *
 * @typedef {object} AppShellAccessibility
 * @property {AppShellFont[]} [fonts] Fontes oferecidas além da do sistema (padrão: todas).
 * @property {AppShellTheme[]} [themes] Temas oferecidos além de "sistema" (padrão: todos).
 * @property {{ min?: AppShellTextScale, max?: AppShellTextScale }} [textScale] Faixa do tamanho de texto (padrão: 1 a 2).
 * @property {{ font?: AppShellFont | 'system', theme?: AppShellTheme | 'system', textScale?: AppShellTextScale }} [defaults]
 *   O que vale até o usuário escolher.
 *
 * @typedef {object} AppShellAnalytics
 * @property {'ga4' | 'none'} [provider] Padrão: 'ga4' (sem id, fica desligado).
 * @property {string} [id] Measurement ID (G-XXXXXXXXXX). Por ambiente: VITE_APPSHELL_ANALYTICS_ID.
 * @property {boolean} [requireConsent] Pede consentimento antes do GA4 (padrão: true — LGPD).
 * @property {string} [privacyUrl] Link "Saiba mais" do banner de consentimento.
 * @property {string} [cookiePrefix] Padrão: o storagePrefix.
 * @property {Record<string, unknown>} [params] Parâmetros extras do gtag config.
 *
 * @typedef {object} AppShellPush
 * @property {string} [vapidPublicKey] Chave *pública* VAPID; vazia desliga. Por ambiente: VITE_APPSHELL_PUSH_VAPID_PUBLIC_KEY.
 *
 * @typedef {object} AppShellConfig
 * @property {string} [title] Nome do app. Por ambiente: VITE_APPSHELL_TITLE.
 * @property {string} [storagePrefix] Prefixo do localStorage (padrão: o name do package.json).
 * @property {AppShellAccessibility | boolean} [accessibility] false desliga; ausente = tudo ligado.
 * @property {AppShellAnalytics} [analytics] Google Analytics 4.
 * @property {AppShellPush} [push] Web Push (os callbacks onSubscribe/onUnsubscribe ficam no createAppShell).
 * @property {boolean} [debug] Loga os eventos do shell no console.
 * @property {string} [base] Opção de build: base do Vite.
 * @property {object} [manifest] Opção de build: campos do manifest do PWA (name padrão: title).
 * @property {string[]} [includeAssets] Opção de build: assets extras do PWA.
 * @property {object} [workbox] Opção de build: opções do Workbox.
 */

/**
 * @template {AppShellConfig} T
 * @param {T} config
 * @returns {T}
 */
export function defineAppShellConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('defineAppShellConfig: config deve ser um objeto')
  }
  resolveAccessibility(config.accessibility)
  validateAppConfig(config)
  return config
}

export { FONTS, THEMES, TEXT_SCALES } from './a11y/config.js'
