import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Preset do Vite para quem usa este appshell como submódulo git + npm
 * workspace. Um app combina isto com os seus próprios ajustes via
 * mergeConfig() — ver README (checklist do A1.6).
 *
 * Lê name/version do package.json do diretório onde o Vite está rodando
 * (process.cwd() — o app consumidor; este repositório, quando roda sozinho
 * como demo) e entrega:
 * - define de __APP_VERSION__ e __APP_STORAGE_PREFIX__ (constantes de
 *   *build*, lidas por app-version.js e storage-keys.js — precisam ser
 *   assim porque auth-service lê a sessão no momento do import, antes de
 *   qualquer createAppShell() rodar);
 * - resolve.dedupe para lit/@material/web, proteção extra contra duas
 *   cópias no bundle (o "already been defined" do customElements.define);
 * - VitePWA com registerType: 'prompt' e injectRegister: null (nunca troca
 *   a versão em uso sem avisar — app-shell.js registra manualmente e
 *   mostra o toast de atualização) e os campos de manifest comuns já
 *   preenchidos.
 */
export function appshellConfig({
  base,
  manifest = {},
  storagePrefix,
  includeAssets = ['favicon.svg'],
  workbox = {},
} = {}) {
  const { name, version } = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'))

  return {
    base,
    define: {
      __APP_VERSION__: JSON.stringify(version),
      __APP_STORAGE_PREFIX__: JSON.stringify(storagePrefix ?? name),
    },
    resolve: {
      dedupe: ['lit', '@material/web'],
    },
    plugins: [
      VitePWA({
        registerType: 'prompt',
        injectRegister: null,
        includeAssets,
        manifest: {
          lang: 'pt-BR',
          start_url: '.',
          display: 'standalone',
          ...manifest,
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,json,webmanifest,woff2}'],
          ...workbox,
        },
      }),
    ],
  }
}
