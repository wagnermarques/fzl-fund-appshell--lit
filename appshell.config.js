// Config declarativa do appshell para a demo deste repositório — e o modelo
// para os apps: o lugar central de todos os *valores* do app. Lida pelo
// vite.config.js (build), que a entrega ao navegador; o createAppShell() do
// main.js a recebe sozinho e fica só com o que é código.
//
// Só valores simples aqui (sem lit/html``/funções): o vite.config.js roda
// no Node. Nada de segredos: este arquivo vai para o git e para o
// navegador. O que muda por ambiente vem de variável (VITE_APPSHELL_*, ver
// .env.example e src/app-config.js).
// Opções e referências de acessibilidade: documentation/acessibilidade.org.
import { defineAppShellConfig } from './src/config.js'

export default defineAppShellConfig({
  title: 'Fund Appshell',
  // Sem storagePrefix, vale o name do package.json.
  accessibility: {
    fonts: ['atkinson', 'opendyslexic'],
    themes: ['light', 'dark', 'high-contrast-light', 'high-contrast-dark'],
    textScale: { min: 1, max: 2 },
    defaults: { font: 'system', theme: 'system', textScale: 1 },
  },
  // Cada app aponta para a sua própria propriedade do GA4 — o id vem do
  // ambiente (VITE_APPSHELL_ANALYTICS_ID); sem ele, o analytics não liga.
  analytics: {
    requireConsent: true,
  },
  // Chave *pública* VAPID, do ambiente (VITE_APPSHELL_PUSH_VAPID_PUBLIC_KEY);
  // sem ela o push fica desligado. A privada nunca vem para cá.
  push: {
    vapidPublicKey: '',
  },
})
