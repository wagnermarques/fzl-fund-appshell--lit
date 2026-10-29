import { html } from 'lit'
import '../src/styles/theme.css'
import './home-view.js'
import './showcase-view.js'
import { SHOWCASE_COMPONENTS } from './showcase-view.js'
import { createAppShell, pattern } from '../src/index.js'

// Só o que é código. Título, analytics, chave do push... estão no
// appshell.config.js, e o createAppShell() os recebe pelo build.
createAppShell({
  mount: '#app',
  home: () => html`<home-view></home-view>`,
  drawer: {
    sections: [
      {
        id: 'showcase',
        label: 'Web Components Showcase',
        items: [
          { label: 'Visão Geral (Catálogo)', icon: 'widgets', href: '#/showcase' },
          ...SHOWCASE_COMPONENTS.map((comp) => ({
            label: comp.name,
            icon: comp.icon,
            href: `#/showcase/${comp.id}`,
          })),
        ],
      },
    ],
  },
  routes: [
    {
      name: 'showcase',
      match: pattern('showcase'),
      title: 'Web Components Showcase',
      crumb: [{ label: 'Web Components Showcase' }],
      render: () => html`<showcase-view></showcase-view>`,
    },
    {
      name: 'showcase-component',
      match: pattern('showcase/:id'),
      title: ({ params }) => {
        const comp = SHOWCASE_COMPONENTS.find((c) => c.id === params.id)
        return comp ? `${comp.name} — Showcase` : 'Web Components Showcase'
      },
      crumb: ({ params }) => {
        const comp = SHOWCASE_COMPONENTS.find((c) => c.id === params.id)
        return [
          { label: 'Web Components Showcase', href: '#/showcase' },
          { label: comp ? comp.name : params.id },
        ]
      },
      render: ({ params }) => html`<showcase-view .componentId=${params.id}></showcase-view>`,
    },
  ],
  // A demo não tem backend — onSubscribe só mostra a inscrição que um app
  // de verdade enviaria ao servidor. Para testar a chegada de um push, use
  // o botão "Push" do Chrome DevTools (Application > Service workers) no
  // `npm run serve`.
  push: {
    onSubscribe: (subscription) => console.log('[demo] guardar no backend:', subscription),
    onUnsubscribe: (subscription) => console.log('[demo] apagar do backend:', subscription.endpoint),
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
    'push:permission-change': ({ permission }) => console.log(`[demo] permissão de push: ${permission}`),
    'push:subscribed': () => console.log('[demo] push ativado'),
    'push:unsubscribed': () => console.log('[demo] push desativado'),
    'push:subscription-change': () => console.log('[demo] inscrição de push renovada'),
    'push:received': ({ title, body }) => console.log(`[demo] push recebido: ${title} — ${body}`),
    'push:clicked': ({ url, action }) => console.log(`[demo] push clicado (url: ${url}, ação: ${action})`),
    'backend:reachable': ({ backend }) => console.log(`[demo] backend ${backend} respondendo`),
    'backend:unreachable': ({ backend, error }) => console.log(`[demo] backend ${backend} fora: ${error}`),
    'backend:unauthorized': ({ backend }) => console.log(`[demo] backend ${backend}: 401, mandar para o login`),
  },
})
