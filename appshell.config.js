// Config declarativa do appshell para a demo deste repositório — e o modelo
// para os apps: lida pelo vite.config.js (build) e pelo demo/main.js.
// Só valores simples aqui (sem lit/html``): o vite.config.js roda no Node.
// Opções e referências de acessibilidade: documentation/acessibilidade.org.
import { defineAppShellConfig } from './src/config.js'

export default defineAppShellConfig({
  title: 'Fund Appshell',
  accessibility: {
    fonts: ['atkinson', 'opendyslexic'],
    themes: ['light', 'dark', 'high-contrast-light', 'high-contrast-dark'],
    textScale: { min: 1, max: 2 },
    defaults: { font: 'system', theme: 'system', textScale: 1 },
  },
})
