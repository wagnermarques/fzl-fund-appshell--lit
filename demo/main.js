import { html } from 'lit'
import '../src/styles/theme.css'
import './home-view.js'
import { createAppShell } from '../src/index.js'
import appshell from '../appshell.config.js'

createAppShell({
  mount: '#app',
  title: appshell.title,
  home: () => html`<home-view></home-view>`,
  // Cada app consumidor aponta para a sua própria propriedade do GA4. Sem
  // a variável definida (o caso deste repo rodando como demo), o analytics
  // simplesmente não liga.
  analytics: {
    id: import.meta.env.VITE_GA4_MEASUREMENT_ID,
    cookiePrefix: __APP_STORAGE_PREFIX__,
  },
  // Eventos do shell (lista completa em SHELL_EVENTS). Aqui só logam; um
  // app de verdade carrega/limpa dados do usuário, pausa a fila de
  // sincronização sem rede, recarrega a tela quando o PWA volta ao
  // primeiro plano... `debug: true` loga todos sem precisar listá-los.
  on: {
    'shell:ready': () => console.log('[demo] shell pronto'),
    'auth:login': ({ user, reason }) => console.log(`[demo] login de ${user.email} (${reason})`),
    'auth:logout': ({ user, reason }) => console.log(`[demo] logout de ${user.email} (${reason})`),
    'auth:signup': ({ user }) => console.log(`[demo] conta nova: ${user.email}`),
    'network:online': ({ kind }) => console.log(`[demo] conexão voltou${kind ? ` (${kind})` : ''}`),
    'network:offline': () => console.log('[demo] conexão caiu'),
    'network:change': ({ kind }) => console.log(`[demo] rede agora é ${kind}`),
    'route:change': ({ name, params, initial }) => console.log(`[demo] rota ${name}`, params, initial ? '(inicial)' : ''),
    'app:visible': () => console.log('[demo] app em primeiro plano'),
    'app:hidden': () => console.log('[demo] app em segundo plano'),
    'pwa:update-available': () => console.log('[demo] versão nova disponível'),
    'pwa:offline-ready': () => console.log('[demo] pronto para uso offline'),
    'pwa:installed': () => console.log('[demo] app instalado'),
    'consent:change': ({ consent }) => console.log(`[demo] consentimento: ${consent}`),
    'a11y:change': ({ preferences }) => console.log('[demo] acessibilidade:', preferences),
    'notification:new': ({ notification }) => console.log(`[demo] notificação: ${notification.title}`),
  },
})
