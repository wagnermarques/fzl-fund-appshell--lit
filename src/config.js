/**
 * defineAppShellConfig() — o equivalente do defineConfig() do Vite para o
 * appshell.config.js de cada app. Não transforma nada: valida cedo (um erro
 * de digitação quebra o `vite build`/`vite dev` na hora) e dá ao editor os
 * tipos abaixo para autocompletar.
 *
 * appshell.config.js guarda só opções *declarativas* — nada de lit ou
 * html`` —, porque é lido pelo vite.config.js, que roda no Node:
 *
 *   // appshell.config.js
 *   import { defineAppShellConfig } from 'fzl-fund-appshell--lit/config'
 *   export default defineAppShellConfig({
 *     title: 'Ler-gislação',
 *     accessibility: { fonts: ['atkinson'], defaults: { font: 'atkinson' } },
 *   })
 *
 *   // vite.config.js
 *   import appshell from './appshell.config.js'
 *   export default defineConfig(appshellConfig({ ...appshell, manifest: { ... } }))
 *
 * Rotas, home, drawer e headerActions continuam no createAppShell() do
 * main.js. As opções de acessibilidade chegam ao navegador pelo preset
 * (constante de build), então o main.js não precisa repassá-las.
 */
import { resolveAccessibility } from './accessibility-config.js'

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
 * @typedef {object} AppShellConfig
 * @property {string} [title] Nome do app.
 * @property {AppShellAccessibility | boolean} [accessibility] false desliga; ausente = tudo ligado.
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
  return config
}

export { FONTS, THEMES, TEXT_SCALES } from './accessibility-config.js'
