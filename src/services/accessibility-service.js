/**
 * Preferências de acessibilidade do appshell — a instância de
 * createPreferences() (src/a11y/preferences.js) ligada às constantes de
 * build do preset:
 *
 * - o que o usuário *pode* escolher vem da opção `accessibility` do
 *   appshell.config.js, resolvida no build pelo preset do Vite e entregue
 *   aqui como __APPSHELL_ACCESSIBILITY__;
 * - o que ele *escolheu* fica no localStorage com o prefixo do app
 *   (__APP_STORAGE_PREFIX__), como o consentimento — dois apps na mesma
 *   origem guardam cada um o seu.
 */
import { createPreferences, resolveAccessibility } from '../a11y/index.js'
import { storageKey } from '../storage-keys.js'

/** Config resolvida no build; fora do Vite (ex.: um teste sem o preset)
 *  vale o padrão, tudo ligado. */
export const accessibilityConfig =
  typeof __APPSHELL_ACCESSIBILITY__ !== 'undefined' ? __APPSHELL_ACCESSIBILITY__ : resolveAccessibility()

export const accessibilityService = createPreferences({
  config: accessibilityConfig,
  key: () => storageKey('a11y:preferences'),
})
