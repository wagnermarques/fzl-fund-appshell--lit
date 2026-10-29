import { LitElement, html, css } from 'lit'
import '../src/webcomponents/app-button.js'
import '../src/webcomponents/app-crumb.js'
import '../src/webcomponents/connection-status.js'
import '../src/webcomponents/app-clock.js'
import '../src/webcomponents/app-version.js'
import '../src/webcomponents/nav-accordion.js'
import '../src/webcomponents/app-header.js'
import '../src/webcomponents/app-footer.js'
import '../src/webcomponents/consent-banner.js'
import '../src/webcomponents/user-status.js'
import { notificationService } from '../src/services/notification-service.js'

export const SHOWCASE_COMPONENTS = [
  {
    id: 'button',
    name: 'Button',
    tag: '<fzl-lit-button> / <fzl-es6-button> / <fzl-ng-button>',
    package: '@fzl/webcomponents-*',
    category: 'FZL UI Widgets',
    status: 'Pronto (Lit / ES6 / Angular)',
    icon: 'smart_button',
    summary:
      'Botão interativo padronizado, acessível e tematizável via Design Tokens (--fzl-*), com suporte a variantes (primary, secondary, danger), escalas de tamanho (sm, md, lg) e estado desabilitado.',
    attributes: [
      { attr: 'variant', prop: 'variant', type: "'primary' | 'secondary' | 'danger'", default: "'primary'", desc: 'Variante visual do botão.' },
      { attr: 'size', prop: 'size', type: "'sm' | 'md' | 'lg'", default: "'md'", desc: 'Escala de tamanho do botão.' },
      { attr: 'disabled', prop: 'disabled', type: 'boolean', default: 'false', desc: 'Desabilita cliques e ativação por teclado.' },
      { attr: 'type', prop: 'type', type: "'button' | 'submit' | 'reset'", default: "'button'", desc: 'Comportamento em formulários HTML.' },
    ],
    events: [
      { name: 'fzl-click', detail: 'CustomEvent<{ originalEvent: MouseEvent }>', desc: 'Disparado quando o botão é clicado ou ativado pelo teclado.' },
    ],
    parts: [
      { kind: 'Slot', name: '(padrão)', desc: 'Rótulo ou ícone exibido dentro do botão.' },
      { kind: 'CSS Part', name: '::part(button)', desc: 'Elemento <button> nativo interno.' },
    ],
    codeHtml: `<fzl-lit-button variant="primary" size="md">Salvar</fzl-lit-button>
<fzl-es6-button variant="secondary">Cancelar</fzl-es6-button>
<fzl-ng-button variant="danger" size="sm">Excluir</fzl-ng-button>`,
    codeLit: `html\`
  <fzl-lit-button
    variant="primary"
    size="md"
    ?disabled=\${this.saving}
    @fzl-click=\${this._onSave}
  >
    Confirmar
  </fzl-lit-button>
\``,
  },
  {
    id: 'crumb',
    name: 'Crumb (Breadcrumb & Voltar)',
    tag: '<fzl-lit-crumb> / <fzl-es6-crumb> / <fzl-ng-crumb>',
    package: '@fzl/webcomponents-*',
    category: 'FZL UI Widgets',
    status: 'Pronto & Integrado no Appshell',
    icon: 'linear_scale',
    summary:
      'Barra de localização estrutural (WCAG 2.4.8) que exibe o caminho completo da visão atual na navegação e oferece o botão "Voltar" para retornar à visão anterior.',
    attributes: [
      { attr: 'items', prop: 'items', type: 'FzlCrumbItem[] | string', default: '[]', desc: 'Lista estruturada de passos ({ label, href?, id? }) ou string JSON/delimitada.' },
      { attr: 'path', prop: 'path', type: 'string', default: "''", desc: 'Atalho em texto para a trilha (ex.: "Início / Config / Backend").' },
      { attr: 'separator', prop: 'separator', type: 'string', default: "'›'", desc: 'Separador visual entre os itens (oculto de leitores de tela via aria-hidden).' },
      { attr: 'show-back', prop: 'showBack', type: 'boolean', default: 'true', desc: 'Exibe ou oculta o botão de retorno (Voltar).' },
      { attr: 'back-disabled', prop: 'backDisabled', type: 'boolean', default: 'false', desc: 'Desabilita o botão Voltar (ex.: quando na raiz sem histórico anterior).' },
      { attr: 'back-label', prop: 'backLabel', type: 'string', default: "'Voltar'", desc: 'Texto e rótulo acessível do botão de retorno.' },
      { attr: 'back-href', prop: 'backHref', type: 'string', default: "''", desc: 'Destino explícito opcional ao acionar o botão Voltar.' },
      { attr: 'aria-label', prop: 'ariaLabel', type: 'string', default: "'Navegação estrutural'", desc: 'Rótulo acessível da região <nav>.' },
    ],
    events: [
      { name: 'fzl-back', detail: 'CustomEvent<{ backHref: string, originalEvent: MouseEvent }>', desc: 'Disparado ao clicar no botão Voltar (cancelável com preventDefault()).' },
      { name: 'fzl-navigate', detail: 'CustomEvent<{ item: FzlCrumbItem, index: number, href?: string, originalEvent: MouseEvent }>', desc: 'Disparado ao clicar em um item ancestral da trilha.' },
    ],
    parts: [
      { kind: 'CSS Part', name: '::part(nav)', desc: 'Elemento <nav> externo.' },
      { kind: 'CSS Part', name: '::part(back-button)', desc: 'Botão <button> de retorno à visão anterior.' },
      { kind: 'CSS Part', name: '::part(list)', desc: 'Lista ordenada <ol> da trilha.' },
      { kind: 'CSS Part', name: '::part(item)', desc: 'Cada item <li> da trilha.' },
      { kind: 'CSS Part', name: '::part(link)', desc: 'Link <a> clicável de itens ancestrais.' },
      { kind: 'CSS Part', name: '::part(separator)', desc: 'Separador visual <span> entre os itens.' },
      { kind: 'CSS Part', name: '::part(current)', desc: 'Elemento <span aria-current="page"> da visão atual.' },
    ],
    codeHtml: `<fzl-lit-crumb path="Início / Config / Backend" back-label="Voltar"></fzl-lit-crumb>
<fzl-es6-crumb items='[{"label":"Início","href":"#/"},{"label":"Conta"},{"label":"Minha conta"}]'></fzl-es6-crumb>`,
    codeLit: `html\`
  <fzl-lit-crumb
    .items=\${[
      { label: 'Início', href: '#/' },
      { label: 'Web Components Showcase', href: '#/showcase' },
      { label: 'Crumb' },
    ]}
    ?back-disabled=\${!this.canGoBack}
    @fzl-back=\${this._handleBack}
  ></fzl-lit-crumb>
\``,
  },
  {
    id: 'connection-status',
    name: 'Connection Status',
    tag: '<connection-status>',
    package: 'fzl-fund-appshell--lit',
    category: 'Appshell Genérico',
    status: 'Ativo no Appshell (Candidato à migração)',
    icon: 'wifi',
    summary:
      'Indicador reativo do estado da conexão de rede (Online / Offline) e do tipo de enlace (Wi-Fi, 4G, etc.) fornecido pelo networkService, anunciando quedas e retornos de rede para leitores de tela (WCAG 4.1.3).',
    attributes: [],
    events: [
      { name: 'network:online / network:offline', detail: 'Via shellEvents / networkService', desc: 'Reflete automaticamente mudanças de conectividade do navegador.' },
    ],
    parts: [],
    codeHtml: `<connection-status></connection-status>`,
    codeLit: `import 'fzl-fund-appshell--lit/webcomponents/connection-status.js'

html\`<connection-status></connection-status>\``,
  },
  {
    id: 'app-clock',
    name: 'App Clock',
    tag: '<app-clock>',
    package: 'fzl-fund-appshell--lit',
    category: 'Appshell Genérico',
    status: 'Ativo no Appshell (Candidato à migração)',
    icon: 'schedule',
    summary:
      'Exibe o dia da semana, data e hora local formatados em pt-BR com algarismos tabulares (tabular-nums), atualizando a cada segundo.',
    attributes: [],
    events: [],
    parts: [],
    codeHtml: `<app-clock></app-clock>`,
    codeLit: `import 'fzl-fund-appshell--lit/webcomponents/app-clock.js'

html\`<app-clock></app-clock>\``,
  },
  {
    id: 'app-version',
    name: 'App Version',
    tag: '<app-version>',
    package: 'fzl-fund-appshell--lit',
    category: 'Appshell Genérico',
    status: 'Ativo no Appshell (Candidato à migração)',
    icon: 'tag',
    summary:
      'Exibe a versão empacotada da aplicação (injetada em tempo de build a partir do package.json via __APP_VERSION__), facilitando o diagnóstico e suporte de PWAs instalados.',
    attributes: [],
    events: [],
    parts: [],
    codeHtml: `<app-version></app-version>`,
    codeLit: `import 'fzl-fund-appshell--lit/webcomponents/app-version.js'

html\`<app-version></app-version>\``,
  },
  {
    id: 'nav-accordion',
    name: 'Nav Accordion',
    tag: '<nav-accordion>',
    package: 'fzl-fund-appshell--lit',
    category: 'Appshell Genérico',
    status: 'Ativo no Appshell (Candidato à migração)',
    icon: 'expand_more',
    summary:
      'Grupo expansível para menus de navegação lateral (drawer). Encapsula <details> e <summary> nativos para acessibilidade por teclado e leitores de tela, suportando aninhamento.',
    attributes: [
      { attr: 'label', prop: 'label', type: 'string', default: "''", desc: 'Título exibido no cabeçalho do acordeão.' },
      { attr: 'expanded', prop: 'expanded', type: 'boolean', default: 'false', desc: 'Indica se o acordeão inicia aberto.' },
      { attr: 'nested', prop: 'nested', type: 'boolean', default: 'false', desc: 'Aplica recuo adicional para sub-acordeões aninhados.' },
    ],
    events: [],
    parts: [
      { kind: 'Slot', name: '(padrão)', desc: 'Lista <md-list> ou sub-acordeões exibidos quando expandido.' },
      { kind: 'Método', name: 'collapse()', desc: 'Fecha programaticamente o acordeão.' },
    ],
    codeHtml: `<nav-accordion label="Seção do Menu" expanded>
  <md-list>
    <md-list-item type="link" href="#/">Início</md-list-item>
  </md-list>
</nav-accordion>`,
    codeLit: `html\`
  <nav-accordion label="Configurações" ?expanded=\${true}>
    <md-list>
      <md-list-item type="button">Item 1</md-list-item>
    </md-list>
  </nav-accordion>
\``,
  },
  {
    id: 'app-header',
    name: 'App Header',
    tag: '<app-header>',
    package: 'fzl-fund-appshell--lit',
    category: 'Appshell Layout',
    status: 'Ativo no Appshell (Visual + Cola)',
    icon: 'web_asset',
    summary:
      'Cabeçalho superior do appshell: contém o botão de abertura do menu lateral, o título clicável da aplicação, um <slot> para ações rápidas do app consumidor e o componente <user-status>.',
    attributes: [
      { attr: 'heading', prop: 'heading', type: 'string', default: "'Fund Appshell'", desc: 'Título principal exibido na barra superior.' },
    ],
    events: [
      { name: 'menu-toggle', detail: 'CustomEvent<void>', desc: 'Disparado quando o usuário clica no botão de menu (hambúrguer).' },
    ],
    parts: [
      { kind: 'Slot', name: '(padrão)', desc: 'Ações rápidas customizadas posicionadas à esquerda do <user-status>.' },
    ],
    codeHtml: `<app-header heading="Meu Aplicativo"></app-header>`,
    codeLit: `html\`
  <app-header .heading=\${'Meu App'} @menu-toggle=\${this._toggleDrawer}>
    <md-icon-button aria-label="Buscar"><md-icon>search</md-icon></md-icon-button>
  </app-header>
\``,
  },
  {
    id: 'app-footer',
    name: 'App Footer',
    tag: '<app-footer>',
    package: 'fzl-fund-appshell--lit',
    category: 'Appshell Layout',
    status: 'Ativo no Appshell (Visual + Cola)',
    icon: 'bottom_panel_open',
    summary:
      'Rodapé fixo do appshell que reúne <connection-status>, <app-clock>, um <slot> para indicadores extras do aplicativo consumidor e <app-version>.',
    attributes: [],
    events: [],
    parts: [
      { kind: 'Slot', name: '(padrão)', desc: 'Itens extras inseridos no lado direito antes da versão.' },
    ],
    codeHtml: `<app-footer>
  <span>Ambiente: Demo</span>
</app-footer>`,
    codeLit: `html\`
  <app-footer>
    <span>Sincronizado</span>
  </app-footer>
\``,
  },
  {
    id: 'consent-banner',
    name: 'Consent Banner (LGPD)',
    tag: '<consent-banner>',
    package: 'fzl-fund-appshell--lit',
    category: 'Appshell Privacidade',
    status: 'Ativo no Appshell (Visual + Cola)',
    icon: 'cookie',
    summary:
      'Banner de consentimento para medição de uso (Google Analytics 4 / Consent Mode v2). Segue a LGPD dando o mesmo peso visual para "Recusar" e "Aceitar".',
    attributes: [
      { attr: 'privacyUrl', prop: 'privacyUrl', type: 'string', default: 'undefined', desc: 'URL opcional para a política de privacidade ("Saiba mais").' },
    ],
    events: [
      { name: 'consent:change', detail: "Via consentService ('granted' | 'denied')", desc: 'Atualiza o consentimento salvo e notifica o analyticsService.' },
    ],
    parts: [],
    codeHtml: `<consent-banner privacyUrl="#/config/privacidade"></consent-banner>`,
    codeLit: `html\`<consent-banner .privacyUrl=\${'#/config/privacidade'}></consent-banner>\``,
  },
  {
    id: 'user-status',
    name: 'User Status & Notifications',
    tag: '<user-status> / <user-notifications>',
    package: 'fzl-fund-appshell--lit',
    category: 'Appshell Conta & Avisos',
    status: 'Ativo no Appshell (Visual + Cola)',
    icon: 'notifications',
    summary:
      'Exibe o botão "Entrar" quando deslogado ou, quando autenticado, o sino de notificações (<user-notifications>) com contador de avisos não lidos e o avatar com menu da conta.',
    attributes: [],
    events: [
      { name: 'notification:new', detail: 'Via notificationService.notify({ title, body })', desc: 'Adiciona aviso ao sino de notificações.' },
    ],
    parts: [],
    codeHtml: `<user-status></user-status>
<user-notifications></user-notifications>`,
    codeLit: `import { notificationService } from 'fzl-fund-appshell--lit'

notificationService.notify({
  title: 'Processo atualizado',
  body: 'O parecer técnico foi anexado.',
})`,
  },
]

export class ShowcaseView extends LitElement {
  static properties = {
    componentId: {},
    _logs: { state: true },
    _crumbSeparator: { state: true },
    _crumbShowBack: { state: true },
    _crumbBackDisabled: { state: true },
  }

  static styles = css`
    :host {
      display: block;
      max-width: 920px;
      margin: 0 auto;
      padding: 20px 24px 64px;
    }

    h1 {
      font-size: 1.65rem;
      margin: 0 0 6px;
      color: var(--md-sys-color-on-surface);
    }

    .subtitle {
      color: var(--md-sys-color-on-surface-variant);
      margin: 0 0 24px;
      line-height: 1.5;
    }

    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      background: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-on-primary-container);
    }

    .badge.secondary {
      background: var(--md-sys-color-secondary-container);
      color: var(--md-sys-color-on-secondary-container);
    }

    .badge.code {
      font-family: monospace;
      font-size: 0.8rem;
      background: var(--md-sys-color-surface-variant);
      color: var(--md-sys-color-on-surface-variant);
    }

    .catalog-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
      gap: 16px;
      margin-top: 16px;
    }

    .catalog-card {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 16px;
      border: 1px solid var(--md-sys-color-outline-variant);
      border-radius: 12px;
      background: var(--md-sys-color-surface-container-low);
      color: var(--md-sys-color-on-surface);
      text-decoration: none;
      transition:
        border-color 150ms ease,
        background-color 150ms ease,
        transform 150ms ease;
    }

    .catalog-card:hover {
      border-color: var(--md-sys-color-primary);
      background: var(--md-sys-color-surface-container);
      transform: translateY(-2px);
    }

    .catalog-card-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }

    .catalog-card-header md-icon {
      color: var(--md-sys-color-primary);
    }

    .catalog-card h2 {
      font-size: 1.05rem;
      margin: 0;
    }

    .catalog-card p {
      font-size: 0.875rem;
      color: var(--md-sys-color-on-surface-variant);
      line-height: 1.45;
      margin: 0 0 12px;
    }

    .catalog-card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.75rem;
      color: var(--md-sys-color-primary);
      font-weight: 600;
    }

    section.box {
      margin: 24px 0;
      padding: 20px;
      border: 1px solid var(--md-sys-color-outline-variant);
      border-radius: 12px;
      background: var(--md-sys-color-surface-container-lowest);
    }

    section.box h2 {
      font-size: 1.1rem;
      margin: 0 0 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .demo-stage {
      padding: 16px;
      border: 1px dashed var(--md-sys-color-outline);
      border-radius: 8px;
      background: var(--md-sys-color-surface);
      margin-bottom: 12px;
    }

    .demo-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .demo-row:last-child {
      margin-bottom: 0;
    }

    .demo-label {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--md-sys-color-on-surface-variant);
      margin: 12px 0 6px;
    }

    .demo-label:first-child {
      margin-top: 0;
    }

    .event-log {
      margin-top: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      background: var(--md-sys-color-inverse-surface);
      color: var(--md-sys-color-inverse-on-surface);
      font-family: monospace;
      font-size: 0.8rem;
      max-height: 140px;
      overflow-y: auto;
      white-space: pre-wrap;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }

    th,
    td {
      text-align: left;
      padding: 10px 8px;
      border-bottom: 1px solid var(--md-sys-color-outline-variant);
      vertical-align: top;
    }

    th {
      color: var(--md-sys-color-on-surface-variant);
      font-weight: 600;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    code {
      font-family: monospace;
      font-size: 0.85em;
      background: var(--md-sys-color-surface-variant);
      color: var(--md-sys-color-on-surface-variant);
      padding: 2px 5px;
      border-radius: 4px;
    }

    pre {
      margin: 8px 0 16px;
      padding: 14px;
      border-radius: 8px;
      background: var(--md-sys-color-surface-container);
      color: var(--md-sys-color-on-surface);
      overflow-x: auto;
      font-size: 0.85rem;
      line-height: 1.45;
      border: 1px solid var(--md-sys-color-outline-variant);
    }

    pre code {
      background: none;
      padding: 0;
      color: inherit;
    }

    .pager {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid var(--md-sys-color-outline-variant);
    }

    .pager a {
      color: var(--md-sys-color-primary);
      text-decoration: none;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .pager a:hover {
      text-decoration: underline;
    }
  `

  constructor() {
    super()
    this.componentId = null
    this._logs = []
    this._crumbSeparator = '›'
    this._crumbShowBack = true
    this._crumbBackDisabled = false
  }

  willUpdate(changed) {
    if (changed.has('componentId')) {
      this._logs = []
    }
  }

  _log(message) {
    const time = new Date().toLocaleTimeString('pt-BR')
    this._logs = [`[${time}] ${message}`, ...this._logs.slice(0, 9)]
  }

  render() {
    if (!this.componentId) {
      return this._renderCatalog()
    }
    const comp = SHOWCASE_COMPONENTS.find((c) => c.id === this.componentId)
    if (!comp) {
      return this._renderCatalog()
    }
    return this._renderComponentDoc(comp)
  }

  _renderCatalog() {
    return html`
      <h1>Web Components Showcase</h1>
      <p class="subtitle">
        Catálogo interativo e documentação viva dos Web Components da família
        <strong>fzlbpms-funds</strong> (<code>@fzl/webcomponents-lit</code>,
        <code>@fzl/webcomponents-es6</code>, <code>@fzl/webcomponents-angular</code> e
        componentes do <code>fzl-fund-appshell--lit</code>). Selecione um componente abaixo ou
        no menu lateral para testar ao vivo e consultar sua especificação.
      </p>

      <div class="catalog-grid">
        ${SHOWCASE_COMPONENTS.map(
          (c) => html`
            <a class="catalog-card" href="#/showcase/${c.id}">
              <div>
                <div class="catalog-card-header">
                  <md-icon>${c.icon}</md-icon>
                  <h2>${c.name}</h2>
                </div>
                <p>${c.summary}</p>
              </div>
              <div class="catalog-card-footer">
                <span>${c.category}</span>
                <span>Ver demo & docs ›</span>
              </div>
            </a>
          `,
        )}
      </div>
    `
  }

  _renderLiveDemo(comp) {
    switch (comp.id) {
      case 'button':
        return html`
          <div class="demo-stage">
            <div class="demo-label">Variantes (variant)</div>
            <div class="demo-row">
              <fzl-lit-button
                variant="primary"
                @fzl-click=${() => this._log('fzl-click disparado por <fzl-lit-button variant="primary">')}
                >Primary</fzl-lit-button
              >
              <fzl-lit-button
                variant="secondary"
                @fzl-click=${() => this._log('fzl-click disparado por <fzl-lit-button variant="secondary">')}
                >Secondary</fzl-lit-button
              >
              <fzl-lit-button
                variant="danger"
                @fzl-click=${() => this._log('fzl-click disparado por <fzl-lit-button variant="danger">')}
                >Danger</fzl-lit-button
              >
              <fzl-lit-button variant="primary" disabled>Disabled</fzl-lit-button>
            </div>

            <div class="demo-label">Tamanhos (size)</div>
            <div class="demo-row">
              <fzl-lit-button
                size="sm"
                @fzl-click=${() => this._log('fzl-click disparado por <fzl-lit-button size="sm">')}
                >Small (sm)</fzl-lit-button
              >
              <fzl-lit-button
                size="md"
                @fzl-click=${() => this._log('fzl-click disparado por <fzl-lit-button size="md">')}
                >Medium (md)</fzl-lit-button
              >
              <fzl-lit-button
                size="lg"
                @fzl-click=${() => this._log('fzl-click disparado por <fzl-lit-button size="lg">')}
                >Large (lg)</fzl-lit-button
              >
            </div>
          </div>
          <div class="event-log">
            ${this._logs.length
              ? this._logs.join('\n')
              : 'Clique em qualquer botão acima para inspecionar o evento fzl-click...'}
          </div>
        `

      case 'crumb':
        return html`
          <div class="demo-stage">
            <div class="demo-label">1. Trilha estruturada (.items) + controles interativos</div>
            <fzl-lit-crumb
              .items=${[
                { label: 'Início', href: '#/showcase/crumb' },
                { label: 'Web Components Showcase', href: '#/showcase' },
                { label: 'Crumb (fzl-*-crumb)' },
              ]}
              separator=${this._crumbSeparator}
              ?show-back=${this._crumbShowBack}
              ?back-disabled=${this._crumbBackDisabled}
              @fzl-back=${(e) => {
                e.preventDefault()
                this._log('Evento fzl-back recebido (clique no botão Voltar)')
              }}
              @fzl-navigate=${(e) => {
                e.preventDefault()
                this._log(`Evento fzl-navigate recebido: item="${e.detail.item.label}" (index ${e.detail.index})`)
              }}
            ></fzl-lit-crumb>

            <div class="demo-label">2. Atalho por atributo path="Início /Processos / Parecer #42"</div>
            <fzl-lit-crumb
              path="Início / Processos / Parecer #42"
              separator="/"
              back-label="Retornar"
              @fzl-back=${(e) => {
                e.preventDefault()
                this._log('Evento fzl-back recebido (botão Retornar)')
              }}
              @fzl-navigate=${(e) => {
                e.preventDefault()
                this._log(`Evento fzl-navigate recebido: "${e.detail.item.label}"`)
              }}
            ></fzl-lit-crumb>

            <div class="demo-label">Controles do Playground</div>
            <div class="demo-row">
              <fzl-lit-button
                size="sm"
                variant="secondary"
                @fzl-click=${() => (this._crumbSeparator = this._crumbSeparator === '›' ? '/' : '›')}
              >
                Alternar separador (${this._crumbSeparator})
              </fzl-lit-button>
              <fzl-lit-button
                size="sm"
                variant="secondary"
                @fzl-click=${() => (this._crumbShowBack = !this._crumbShowBack)}
              >
                show-back: ${this._crumbShowBack ? 'true' : 'false'}
              </fzl-lit-button>
              <fzl-lit-button
                size="sm"
                variant="secondary"
                @fzl-click=${() => (this._crumbBackDisabled = !this._crumbBackDisabled)}
              >
                back-disabled: ${this._crumbBackDisabled ? 'true' : 'false'}
              </fzl-lit-button>
            </div>
          </div>
          <div class="event-log">
            ${this._logs.length
              ? this._logs.join('\n')
              : 'Clique em "Voltar" ou nos links da trilha acima para ver os eventos fzl-back e fzl-navigate...'}
          </div>
        `

      case 'connection-status':
        return html`
          <div class="demo-stage">
            <div class="demo-row">
              <connection-status></connection-status>
            </div>
          </div>
        `

      case 'app-clock':
        return html`
          <div class="demo-stage">
            <div class="demo-row">
              <app-clock></app-clock>
            </div>
          </div>
        `

      case 'app-version':
        return html`
          <div class="demo-stage">
            <div class="demo-row">
              <app-version></app-version>
            </div>
          </div>
        `

      case 'nav-accordion':
        return html`
          <div class="demo-stage">
            <nav-accordion label="Exemplo de Seção Expansível" expanded>
              <md-list>
                <md-list-item type="button" @click=${() => this._log('Clicou em Item A')}>
                  <md-icon slot="start">folder</md-icon>
                  Item A
                </md-list-item>
                <md-list-item type="button" @click=${() => this._log('Clicou em Item B')}>
                  <md-icon slot="start">description</md-icon>
                  Item B
                </md-list-item>
              </md-list>
            </nav-accordion>
          </div>
          ${this._logs.length ? html`<div class="event-log">${this._logs.join('\n')}</div>` : ''}
        `

      case 'app-header':
        return html`
          <div class="demo-stage" style="padding: 0; overflow: hidden;">
            <app-header
              heading="Título de Demonstração"
              @menu-toggle=${() => this._log('Evento menu-toggle disparado pelo <app-header>')}
            >
              <fzl-lit-button
                size="sm"
                variant="secondary"
                @fzl-click=${() => this._log('Ação rápida no slot do <app-header>')}
              >
                Ação Rápida
              </fzl-lit-button>
            </app-header>
          </div>
          <div class="event-log">
            ${this._logs.length
              ? this._logs.join('\n')
              : 'Clique no ícone de menu ou na Ação Rápida do cabeçalho acima...'}
          </div>
        `

      case 'app-footer':
        return html`
          <div class="demo-stage" style="padding: 0; overflow: hidden;">
            <app-footer>
              <span>Slot customizado · Demo</span>
            </app-footer>
          </div>
        `

      case 'consent-banner':
        return html`
          <div class="demo-stage" style="padding: 0; overflow: hidden;">
            <consent-banner privacyUrl="#/config/privacidade"></consent-banner>
          </div>
        `

      case 'user-status':
        return html`
          <div class="demo-stage">
            <div class="demo-row" style="justify-content: space-between;">
              <user-status></user-status>
              <fzl-lit-button
                size="sm"
                variant="primary"
                @fzl-click=${() => {
                  notificationService.notify({
                    title: 'Notificação de teste',
                    body: `Disparada pelo Showcase às ${new Date().toLocaleTimeString('pt-BR')}`,
                  })
                  this._log('Notificação enviada via notificationService.notify()')
                }}
              >
                Disparar Notificação de Teste
              </fzl-lit-button>
            </div>
          </div>
          ${this._logs.length ? html`<div class="event-log">${this._logs.join('\n')}</div>` : ''}
        `

      default:
        return ''
    }
  }

  _renderComponentDoc(comp) {
    const idx = SHOWCASE_COMPONENTS.findIndex((c) => c.id === comp.id)
    const prev = idx > 0 ? SHOWCASE_COMPONENTS[idx - 1] : null
    const next = idx < SHOWCASE_COMPONENTS.length - 1 ? SHOWCASE_COMPONENTS[idx + 1] : null

    return html`
      <div class="badges">
        <span class="badge">${comp.category}</span>
        <span class="badge secondary">${comp.status}</span>
        <span class="badge code">${comp.tag}</span>
      </div>

      <h1>${comp.name}</h1>
      <p class="subtitle">${comp.summary}</p>

      <section class="box">
        <h2><md-icon>play_circle</md-icon> Demonstração Interativa</h2>
        ${this._renderLiveDemo(comp)}
      </section>

      <section class="box">
        <h2><md-icon>tune</md-icon> Atributos & Propriedades</h2>
        ${comp.attributes.length
          ? html`
              <table>
                <thead>
                  <tr>
                    <th>Atributo</th>
                    <th>Propriedade</th>
                    <th>Tipo</th>
                    <th>Padrão</th>
                    <th>Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  ${comp.attributes.map(
                    (a) => html`
                      <tr>
                        <td><code>${a.attr}</code></td>
                        <td><code>${a.prop}</code></td>
                        <td><code>${a.type}</code></td>
                        <td><code>${a.default}</code></td>
                        <td>${a.desc}</td>
                      </tr>
                    `,
                  )}
                </tbody>
              </table>
            `
          : html`<p class="subtitle" style="margin:0">Este componente não requer atributos de configuração.</p>`}
      </section>

      <section class="box">
        <h2><md-icon>bolt</md-icon> Eventos & Integração</h2>
        ${comp.events.length
          ? html`
              <table>
                <thead>
                  <tr>
                    <th>Evento</th>
                    <th>Detalhe (Payload)</th>
                    <th>Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  ${comp.events.map(
                    (e) => html`
                      <tr>
                        <td><code>${e.name}</code></td>
                        <td><code>${e.detail}</code></td>
                        <td>${e.desc}</td>
                      </tr>
                    `,
                  )}
                </tbody>
              </table>
            `
          : html`<p class="subtitle" style="margin:0">Este componente não dispara eventos customizados.</p>`}
      </section>

      ${comp.parts.length
        ? html`
            <section class="box">
              <h2><md-icon>layers</md-icon> Slots, Métodos & CSS Shadow Parts</h2>
              <table>
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Nome</th>
                    <th>Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  ${comp.parts.map(
                    (p) => html`
                      <tr>
                        <td><strong>${p.kind}</strong></td>
                        <td><code>${p.name}</code></td>
                        <td>${p.desc}</td>
                      </tr>
                    `,
                  )}
                </tbody>
              </table>
            </section>
          `
        : ''}

      <section class="box">
        <h2><md-icon>code</md-icon> Exemplos de Uso</h2>
        <div class="demo-label">HTML / Declarativo</div>
        <pre><code>${comp.codeHtml}</code></pre>
        <div class="demo-label">Lit / JavaScript</div>
        <pre><code>${comp.codeLit}</code></pre>
      </section>

      <nav class="pager" aria-label="Navegação entre componentes do showcase">
        <div>
          ${prev
            ? html`<a href="#/showcase/${prev.id}">‹ Anterior: ${prev.name}</a>`
            : html`<a href="#/showcase">‹ Voltar ao Catálogo</a>`}
        </div>
        <div>
          ${next ? html`<a href="#/showcase/${next.id}">Próximo: ${next.name} ›</a>` : ''}
        </div>
      </nav>
    `
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('showcase-view')) {
  customElements.define('showcase-view', ShowcaseView)
}
