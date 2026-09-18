import { html } from 'lit'
import '../src/styles/theme.css'
import './home-view.js'
import { createAppShell } from '../src/index.js'

createAppShell({
  mount: '#app',
  title: 'Fund Appshell',
  home: () => html`<home-view></home-view>`,
  // Cada app consumidor aponta para a sua própria propriedade do GA4. Sem
  // a variável definida (o caso deste repo rodando como demo), o analytics
  // simplesmente não liga.
  analytics: {
    id: import.meta.env.VITE_GA4_MEASUREMENT_ID,
    cookiePrefix: __APP_STORAGE_PREFIX__,
  },
})
