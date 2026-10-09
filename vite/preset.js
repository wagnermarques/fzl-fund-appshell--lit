import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { a11yFontsPlugin, resolveAccessibility } from '../src/a11y/vite.js'
import { resolveAppConfig } from '../src/app-config.js'

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
 * - acessibilidade (a opção `accessibility` do appshell.config.js — ver
 *   src/a11y/config.js): validada aqui, entregue ao navegador como
 *   __APPSHELL_ACCESSIBILITY__ e usada para gerar 'virtual:appshell-fonts'
 *   (plugin de src/a11y/vite.js), que importa só as fontes habilitadas. Fonte desligada não entra no
 *   bundle nem no precache do PWA (que pega todo *.woff2 do dist);
 * - VitePWA com registerType: 'prompt' e injectRegister: null (nunca troca
 *   a versão em uso sem avisar — app-shell.js registra manualmente e
 *   mostra o toast de atualização) e os campos de manifest comuns já
 *   preenchidos;
 * - __APPSHELL_CONFIG__: o resto do appshell.config.js (título, analytics,
 *   push...) com as variáveis de ambiente do modo atual já aplicadas
 *   (VITE_APPSHELL_*, ver src/app-config.js), que o createAppShell()
 *   mescla sozinho;
 * - o Web Push no service worker: src/pwa/push-sw.js sai no build como
 *   appshell-push-sw.js e entra no sw.js por importScripts. Vai sempre (é
 *   pequeno e inerte): quem liga o push é createAppShell({ push }).
 */

const PUSH_SW_FILE = 'appshell-push-sw.js'
const PUSH_SW_SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), '../src/pwa/push-sw.js')

/** Define __APPSHELL_CONFIG__. Plugin (e não um define direto) porque as
 *  variáveis de ambiente dependem do modo (.env.production...), que só se
 *  conhece no hook config. */
function appConfigPlugin(appshell, packageName) {
  return {
    name: 'appshell:config',
    config(userConfig, { mode }) {
      const envDir = userConfig.envDir ?? userConfig.root ?? process.cwd()
      const resolved = resolveAppConfig(appshell, { env: loadEnv(mode, envDir, 'VITE_'), packageName })
      return { define: { __APPSHELL_CONFIG__: JSON.stringify(resolved) } }
    },
  }
}

/** Publica o script de push do service worker na raiz do build. */
function pushServiceWorkerPlugin() {
  return {
    name: 'appshell:push-sw',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: PUSH_SW_FILE, source: readFileSync(PUSH_SW_SOURCE, 'utf-8') })
    },
  }
}

/** Recebe o appshell.config.js inteiro (normalmente com o manifest do
 *  app junto: appshellConfig({ ...appshell, manifest })). */
export function appshellConfig(appshell = {}) {
  const { base, manifest = {}, storagePrefix, includeAssets = ['favicon.svg'], workbox = {}, accessibility, title } = appshell
  const a11y = resolveAccessibility(accessibility)
  const { name, version } = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'))

  return {
    base,
    define: {
      __APP_VERSION__: JSON.stringify(version),
      __APP_STORAGE_PREFIX__: JSON.stringify(storagePrefix ?? name),
      __APPSHELL_ACCESSIBILITY__: JSON.stringify(a11y),
    },
    resolve: {
      dedupe: ['lit', '@material/web'],
    },
    plugins: [
      appConfigPlugin(appshell, name),
      a11yFontsPlugin(a11y, { id: 'virtual:appshell-fonts' }),
      pushServiceWorkerPlugin(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: null,
        includeAssets,
        manifest: {
          lang: 'pt-BR',
          start_url: '.',
          display: 'standalone',
          ...(title ? { name: title, short_name: title } : {}),
          ...manifest,
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,json,webmanifest,woff2}'],
          ...workbox,
          importScripts: [PUSH_SW_FILE, ...(workbox.importScripts ?? [])],
        },
      }),
    ],
  }
}
