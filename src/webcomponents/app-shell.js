import { LitElement, html, css } from 'lit'
import { registerSW } from 'virtual:pwa-register'
import './config-accessibility-view.js'
import './config-notifications-view.js'
import './config-privacy-view.js'
import './config-backend-view.js'
import './consent-banner.js'
import './nav-accordion.js'
import './app-footer.js'
import './app-header.js'
import './app-crumb.js'
import './auth-view.js'
import './not-found-view.js'
import { resolveRouteCrumbs } from './app-crumb.js'
import { announce, focusElement, setDocumentTitle } from '../a11y/index.js'
import { analyticsService } from '../services/analytics-service.js'
import { authService } from '../services/auth-service.js'
import { accessibilityService } from '../services/accessibility-service.js'
import { consentService } from '../services/consent-service.js'
import { pushService } from '../services/push-service.js'
import { shellEvents } from '../services/shell-events.js'
import {
  NOT_FOUND,
  createRouter,
  navigateHome,
  navigateToAccount,
  navigateToConfigAccessibility,
  navigateToConfigNotifications,
  navigateToConfigPrivacy,
  navigateToConfigBackend,
  navigateToLogin,
  navigateToSignup,
} from '../router.js'

/** Título da aba (WCAG 2.4.2) de cada rota do shell; as rotas do app
 *  trazem o seu em route.title. Home fica só com o título do app. */
const SHELL_ROUTE_TITLES = {
  'conta-entrar': 'Entrar',
  'conta-cadastro': 'Criar conta',
  'conta-esqueci-senha': 'Esqueci minha senha',
  'conta-redefinir-senha': 'Criar nova senha',
  'conta-alterar-senha': 'Alterar senha',
  conta: 'Minha conta',
  'config-backend': 'Backend',
  'config-acessibilidade': 'Acessibilidade',
  'config-privacidade': 'Privacidade',
  'config-notificacoes': 'Notificações',
  [NOT_FOUND]: 'Página não encontrada',
}

export class AppShell extends LitElement {
  static properties = {
    routes: { attribute: false },
    home: { attribute: false },
    title: { attribute: false },
    drawer: { attribute: false },
    headerActions: { attribute: false },
    footerItems: { attribute: false },
    analytics: { attribute: false },
    _route: { state: true },
    _drawerOpen: { state: true },
    _updateAvailable: { state: true },
    _user: { state: true },
    _consent: { state: true },
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    main {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
    }
    /* O foco vai para o <main> por script (link "Ir para o conteúdo" e
       troca de rota) só para o leitor de tela começar dali; o anel em
       volta da tela inteira não ajuda ninguém. */
    main:focus {
      outline: none;
    }
    /* Link "Ir para o conteúdo" (WCAG 2.4.1) — o mesmo de .a11y-skip-link
       em src/a11y/a11y.css, repetido porque o CSS do documento não entra
       no shadow DOM. Invisível até receber foco pelo teclado. */
    .skip-link {
      position: absolute;
      top: 8px;
      left: 8px;
      z-index: 1000;
      padding: 12px 16px;
      border-radius: 4px;
      background: var(--md-sys-color-inverse-surface);
      color: var(--md-sys-color-inverse-on-surface);
      font-weight: 700;
      transform: translateY(-200%);
    }
    .skip-link:focus {
      transform: none;
      outline: 2px solid var(--md-sys-color-inverse-primary);
      outline-offset: 2px;
    }
    /* Cada região da página vira seu próprio contexto de empilhamento:
       um z-index qualquer lá dentro (ex.: tooltip de gráfico com
       z-index: 1, cabeçalho sticky de tabela) passa a valer só entre os
       vizinhos da região, sem poder empatar com o z-index do drawer e
       aparecer por cima dele. isolation não cria bloco de contenção, então
       position: fixed dentro das views continua relativo à viewport. */
    app-header,
    fzl-lit-crumb,
    main,
    consent-banner,
    app-footer {
      isolation: isolate;
    }
    /* Cinto e suspensório: além do isolamento acima e do z-index do
       drawer (ver firstUpdated), bloqueia clique em qualquer coisa da
       página por trás enquanto o drawer estiver aberto — o
       scrim opaco já a esconde, mas um componente com camadas internas
       próprias (ex.: md-text-button) pode escapar do empilhamento do
       drawer e continuar clicável. */
    fzl-lit-crumb[inert],
    main[inert],
    consent-banner[inert],
    app-footer[inert] {
      pointer-events: none;
    }
    md-navigation-drawer-modal {
      /* Scrim opaco (não os 32% do Material): com o drawer aberto, nada
         da página por trás fica visível ao lado do painel. */
      --md-navigation-drawer-modal-scrim-color: #000;
      --md-navigation-drawer-modal-scrim-opacity: 1;
      /* Sem isso, o painel do drawer cai no fallback interno do componente
         (branco fixo, #fff) em vez de usar a cor de superfície do tema —
         em tema escuro isso destoa e pode ser lido como "sem fundo
         próprio". Usa a superfície do app para garantir um painel sólido
         e coerente com claro/escuro. */
      --md-navigation-drawer-modal-container-color: var(--md-sys-color-surface);
    }
    .drawer-content {
      padding-top: 8px;
    }
    .update-toast {
      position: fixed;
      left: 50%;
      bottom: 16px;
      transform: translateX(-50%);
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 8px;
      max-width: calc(100% - 32px);
      padding: 8px 8px 8px 16px;
      border-radius: 4px;
      background: var(--md-sys-color-inverse-surface);
      color: var(--md-sys-color-inverse-on-surface);
      box-shadow: 0 3px 5px rgba(0, 0, 0, 0.2), 0 1px 10px rgba(0, 0, 0, 0.12);
    }
    .update-toast span {
      font-size: 0.875rem;
    }
    .update-toast md-text-button {
      --md-text-button-label-text-color: var(--md-sys-color-inverse-primary);
      flex-shrink: 0;
    }
  `

  constructor() {
    super()
    this.routes = []
    this.title = ''
    this.drawer = { sections: [], shellSections: { conta: true, config: true } }
    this.headerActions = null
    this.footerItems = null
    this.analytics = { provider: 'none' }
    this.share = {
      enabled: true,
      title: 'Compartilhar este app',
      networks: ['whatsapp', 'telegram', 'facebook', 'x', 'linkedin', 'copy'],
      text: '',
      url: '',
    }
    this._copied = false
    this._route = { name: 'home' }
    this._history = []
    this._goingBack = false
    this._routed = false
    this._drawerOpen = false
    this._updateAvailable = false
    this._user = null
    this._consent = null
    this._swRegistration = null
    this._updateSW = registerSW({
      onNeedRefresh: () => {
        this._updateAvailable = true
        shellEvents.emit('pwa:update-available')
      },
      onOfflineReady: () => shellEvents.emit('pwa:offline-ready'),
      onRegisteredSW: (_url, registration) => {
        this._swRegistration = registration
        registration?.update()
      },
    })
  }

  connectedCallback() {
    super.connectedCallback()

    // Antes do createRouter(): o callback dele dispara já na carga inicial,
    // e é esse primeiro disparo que vira o page_view da tela de entrada.
    // Sem consentimento ainda, o page_view fica guardado e só sai se o
    // usuário aceitar no banner.
    this._consent = consentService.get()
    analyticsService.init(this.analytics, { consent: this._consent })
    this._unsubscribeConsent = consentService.subscribe((value) => {
      this._consent = value
      analyticsService.setConsent(value)
    })

    this._unsubscribe = createRouter(
      (route) => {
        const currentHash = typeof location !== 'undefined' ? location.hash || '#/' : '#/'
        if (this._goingBack) {
          this._goingBack = false
        } else if (this._history.at(-1) !== currentHash) {
          this._history = [...this._history, currentHash]
        }
        this._route = route
        this._drawerOpen = false
        setDocumentTitle(this._routeTitle(route), this.title)
        // Na carga inicial o navegador já começa do topo; nas trocas de
        // rota seguintes, o foco ficaria onde estava (num drawer que acabou
        // de fechar) — leva-o à tela nova (WCAG 2.4.3).
        if (this._routed) this.updateComplete.then(() => this._focusMain())
        shellEvents.emit('route:change', {
          name: route.name,
          params: route.params,
          query: route.query,
          initial: !this._routed,
        })
        this._routed = true
        // Um page_view por rota resolvida. O gtag sozinho só contaria a
        // carga da página (ver analytics-service.js): como as rotas vivem
        // no hash, toda navegação depois da primeira seria invisível.
        analyticsService.trackPageView(route, this.title)
      },
      { routes: this.routes },
    )
    this._unsubscribeAuth = authService.subscribe((user) => (this._user = user))

    // Android PWAs são normalmente retomadas da memória em vez de
    // reiniciadas, então a checagem de atualização do próprio navegador
    // pode nunca rodar de novo depois do primeiro lançamento — checa
    // explicitamente sempre que o app volta a ficar visível.
    this._onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        this._swRegistration?.update()
        shellEvents.emit('app:visible')
      } else {
        shellEvents.emit('app:hidden')
      }
    }
    document.addEventListener('visibilitychange', this._onVisibilityChange)
    this._onAppInstalled = () => shellEvents.emit('pwa:installed')
    window.addEventListener('appinstalled', this._onAppInstalled)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._unsubscribe?.()
    this._unsubscribeAuth?.()
    this._unsubscribeConsent?.()
    document.removeEventListener('visibilitychange', this._onVisibilityChange)
    window.removeEventListener('appinstalled', this._onAppInstalled)
  }

  firstUpdated() {
    // md-navigation-drawer-modal's own panel/scrim have no positioned
    // ancestor of their own, so their containing block escapes all the way
    // to the viewport — and in that situation, any relatively positioned
    // descendant deep inside <main> (e.g. a ripple/focus-ring layer) paints
    // above them despite DOM order suggesting otherwise, making the drawer
    // look like it has no solid background. There's no exposed CSS custom
    // property for this, so patch it directly — both elements are already
    // position: absolute, so adding a z-index doesn't change their layout.
    const drawer = this.shadowRoot.querySelector('md-navigation-drawer-modal')
    const style = document.createElement('style')
    style.textContent = `
      .md3-navigation-drawer-modal,
      .md3-navigation-drawer-modal__scrim {
        z-index: 1;
      }
    `
    drawer.shadowRoot.appendChild(style)

    shellEvents.emit('shell:ready', { shell: this })
  }

  updated(changed) {
    // Toda vez que o drawer abre, todos os acordeões aparecem fechados —
    // inclusive os que o usuário expandiu da última vez. Roda no mesmo
    // update que abre o drawer, então o primeiro quadro já sai fechado.
    if (changed.has('_drawerOpen') && this._drawerOpen) {
      this.shadowRoot.querySelectorAll('nav-accordion').forEach((accordion) => accordion.collapse())
    }
  }

  _routeTitle(route) {
    const appRoute = this.routes.find((r) => r.name === route.name)
    if (!appRoute) return SHELL_ROUTE_TITLES[route.name] ?? ''
    const { title } = appRoute
    return typeof title === 'function' ? title({ params: route.params, query: route.query }) : title
  }

  _focusMain() {
    focusElement(this.shadowRoot.querySelector('main'))
  }

  _selectDrawerItem(navigate) {
    navigate()
    this._drawerOpen = false
  }

  _canGoBack() {
    return this._history.length > 1 || (this._route?.name && this._route.name !== 'home')
  }

  _handleBack(e) {
    e?.preventDefault()
    if (this._history.length > 1) {
      this._history = this._history.slice(0, -1)
      const previousHash = this._history.at(-1) || '#/'
      this._goingBack = true
      location.hash = previousHash
      return
    }
    const crumbs = resolveRouteCrumbs(this._route, this.routes)
    const parentWithHref = [...crumbs.slice(0, -1)].reverse().find((c) => c.href)
    if (parentWithHref?.href) {
      location.hash = parentWithHref.href
    } else {
      navigateHome()
    }
  }

  render() {
    return html`
      <a
        class="skip-link"
        href="#"
        @click=${(e) => {
          e.preventDefault()
          this._focusMain()
        }}
        >Ir para o conteúdo</a
      >

      <app-header .heading=${this.title} @menu-toggle=${() => (this._drawerOpen = !this._drawerOpen)}>
        ${this.headerActions ? this.headerActions() : ''}
      </app-header>

      <fzl-lit-crumb
        ?inert=${this._drawerOpen}
        .items=${resolveRouteCrumbs(this._route, this.routes)}
        ?back-disabled=${!this._canGoBack()}
        @fzl-back=${(e) => this._handleBack(e)}
      ></fzl-lit-crumb>

      <md-navigation-drawer-modal
        .opened=${this._drawerOpen}
        @navigation-drawer-changed=${(e) => (this._drawerOpen = e.detail.opened)}
      >
        <div class="drawer-content">
          ${this.drawer.sections.map((section) => this._renderDrawerSection(section))}
          ${this.drawer.shellSections.conta
            ? html`
                <nav-accordion label="Conta">
                  <md-list>${this._renderAccountItems()}</md-list>
                </nav-accordion>
              `
            : ''}
          ${this.drawer.shellSections.config
            ? html`
                <nav-accordion label="Config">
                  <md-list>
                    <md-list-item type="button" @click=${() => this._selectDrawerItem(navigateToConfigBackend)}>
                      <md-icon slot="start">dns</md-icon>
                      Backend
                    </md-list-item>
                    ${accessibilityService.config.enabled
                      ? html`
                          <md-list-item
                            type="button"
                            @click=${() => this._selectDrawerItem(navigateToConfigAccessibility)}
                          >
                            <md-icon slot="start">accessibility_new</md-icon>
                            Acessibilidade
                          </md-list-item>
                        `
                      : ''}
                    ${pushService.isConfigured()
                      ? html`
                          <md-list-item
                            type="button"
                            @click=${() => this._selectDrawerItem(navigateToConfigNotifications)}
                          >
                            <md-icon slot="start">notifications_active</md-icon>
                            Notificações
                          </md-list-item>
                        `
                      : ''}
                    ${this._asksConsent()
                      ? html`
                          <md-list-item type="button" @click=${() => this._selectDrawerItem(navigateToConfigPrivacy)}>
                            <md-icon slot="start">privacy_tip</md-icon>
                            Privacidade
                          </md-list-item>
                        `
                      : ''}
                  </md-list>
                </nav-accordion>
              `
            : ''}
          ${this._isShareEnabled()
            ? html`
                <nav-accordion label=${this.share?.title || 'Compartilhar este app'}>
                  <md-list>${this._renderShareItems()}</md-list>
                </nav-accordion>
              `
            : ''}
        </div>
      </md-navigation-drawer-modal>

      <main ?inert=${this._drawerOpen}>${this._renderRoute()}</main>

      ${this._asksConsent() && this._consent === null
        ? html`<consent-banner ?inert=${this._drawerOpen} .privacyUrl=${this.analytics.privacyUrl}></consent-banner>`
        : ''}

      <app-footer ?inert=${this._drawerOpen}>${this.footerItems ? this.footerItems() : ''}</app-footer>

      ${this._updateAvailable
        ? html`
            <div class="update-toast" role="status">
              <span>Uma nova versão está disponível.</span>
              <md-text-button @click=${() => this._updateSW(true)}>Atualizar</md-text-button>
            </div>
          `
        : ''}
    `
  }

  /** Uma seção do drawer é { id, label } + ou items: [{ label,
   *  icon?, href, visible(user)? }] (lista simples) ou render: () => html``
   *  (conteúdo livre, para uma árvore de navegação própria do domínio). */
  _renderDrawerSection(section) {
    if (section.render) {
      return html`
        <nav-accordion label=${section.label}>${section.render()}</nav-accordion>
      `
    }
    const items = section.items.filter((item) => !item.visible || item.visible(this._user))
    return html`
      <nav-accordion label=${section.label}>
        <md-list>
          ${items.map(
            (item) => html`
              <md-list-item type="link" href=${item.href}>
                ${item.icon ? html`<md-icon slot="start">${item.icon}</md-icon>` : ''}
                ${item.label}
              </md-list-item>
            `,
          )}
        </md-list>
      </nav-accordion>
    `
  }

  /** O app tem GA4 ligado e quer pedir consentimento (o padrão). */
  _asksConsent() {
    return this.analytics.provider === 'ga4' && this.analytics.requireConsent !== false
  }

  _renderAccountItems() {
    if (this._user) {
      return html`
        <md-list-item type="button" @click=${() => this._selectDrawerItem(navigateToAccount)}>
          <md-icon slot="start">account_circle</md-icon>
          <div slot="headline">Minha conta</div>
          <div slot="supporting-text">${this._user.email}</div>
        </md-list-item>
        <md-list-item type="button" @click=${() => this._selectDrawerItem(() => authService.signOut())}>
          <md-icon slot="start">logout</md-icon>
          Sair
        </md-list-item>
      `
    }
    return html`
      <md-list-item type="button" @click=${() => this._selectDrawerItem(navigateToLogin)}>
        <md-icon slot="start">login</md-icon>
        Entrar
      </md-list-item>
      ${authService.supports('signUp')
        ? html`<md-list-item type="button" @click=${() => this._selectDrawerItem(navigateToSignup)}>
            <md-icon slot="start">person_add</md-icon>
            Criar conta
          </md-list-item>`
        : ''}
    `
  }

  _isShareEnabled() {
    if (this.drawer.shellSections?.compartilhar === false || this.drawer.shellSections?.share === false) {
      return false
    }
    return Boolean(this.share?.enabled && this.share?.networks?.length > 0)
  }

  _share(network) {
    const url = this.share?.url || (typeof window !== 'undefined' ? window.location.href : '')
    const text = this.share?.text || this.title || ''

    shellEvents.emit('share:click', { network, url })
    analyticsService.track('share', { method: network, content_type: 'app' })

    if (network === 'copy') {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard
          .writeText(url)
          .then(() => {
            announce('Link copiado para a área de transferência')
            this._copied = true
            this.requestUpdate()
            setTimeout(() => {
              this._copied = false
              this.requestUpdate()
            }, 2000)
          })
          .catch(() => {})
      }
      return
    }

    if (network === 'native') {
      if (typeof navigator !== 'undefined' && navigator.share) {
        navigator.share({ title: this.title, text, url }).catch(() => {})
      }
      this._drawerOpen = false
      return
    }

    const shareUrls = {
      whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(text ? `${text} ${url}` : url)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}${text ? `&text=${encodeURIComponent(text)}` : ''}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      x: `https://x.com/intent/tweet?url=${encodeURIComponent(url)}${text ? `&text=${encodeURIComponent(text)}` : ''}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      email: `mailto:?subject=${encodeURIComponent(this.title)}&body=${encodeURIComponent(text ? `${text} - ${url}` : url)}`,
    }

    const shareUrl = shareUrls[network]
    if (shareUrl) {
      if (typeof window !== 'undefined') {
        window.open(shareUrl, '_blank', 'noopener,noreferrer')
      }
      this._drawerOpen = false
    }
  }

  _renderShareIcon(network) {
    switch (network) {
      case 'whatsapp':
        return html`
          <svg slot="start" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
            <path
              d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.04 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.53 7.34C9.36 7.34 9.09 7.4 8.87 7.65C8.65 7.89 8.02 8.48 8.02 9.7C8.02 10.92 8.91 12.09 9.03 12.26C9.15 12.42 10.74 14.88 13.2 15.94C15.24 16.82 15.66 16.64 16.11 16.6C16.55 16.56 17.54 16.01 17.74 15.44C17.95 14.88 17.95 14.39 17.89 14.29C17.83 14.19 17.66 14.13 17.41 14.01C17.16 13.88 15.93 13.28 15.7 13.2C15.48 13.11 15.31 13.07 15.15 13.32C14.99 13.56 14.52 14.13 14.38 14.29C14.23 14.45 14.09 14.47 13.84 14.35C13.6 14.23 12.79 13.97 11.84 13.12C11.1 12.46 10.6 11.64 10.46 11.39C10.31 11.15 10.44 11.01 10.57 10.89C10.68 10.78 10.82 10.6 10.95 10.45C11.08 10.3 11.12 10.19 11.21 10.03C11.3 9.86 11.25 9.72 11.19 9.6C11.13 9.47 10.64 8.27 10.44 7.77C10.24 7.29 10.04 7.35 9.88 7.35C9.74 7.34 9.57 7.34 9.53 7.34Z"
            />
          </svg>
        `
      case 'telegram':
        return html`
          <svg slot="start" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"
            />
          </svg>
        `
      case 'facebook':
        return html`
          <svg slot="start" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
            <path
              d="M12 2.04C6.5 2.04 2 6.53 2 12.06C2 17.06 5.66 21.21 10.44 21.96V14.96H7.9V12.06H10.44V9.85C10.44 7.34 11.93 5.96 14.22 5.96C15.31 5.96 16.45 6.15 16.45 6.15V8.62H15.19C13.95 8.62 13.56 9.39 13.56 10.18V12.06H16.34L15.89 14.96H13.56V21.96A10 10 0 0 0 22 12.06C22 6.53 17.5 2.04 12 2.04Z"
            />
          </svg>
        `
      case 'x':
        return html`
          <svg slot="start" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
            <path
              d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
            />
          </svg>
        `
      case 'linkedin':
        return html`
          <svg slot="start" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
            <path
              d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"
            />
          </svg>
        `
      case 'copy':
        return html`<md-icon slot="start">content_copy</md-icon>`
      case 'native':
        return html`<md-icon slot="start">share</md-icon>`
      case 'email':
        return html`<md-icon slot="start">mail</md-icon>`
      default:
        return html`<md-icon slot="start">share</md-icon>`
    }
  }

  _shareLabel(network) {
    switch (network) {
      case 'whatsapp':
        return 'WhatsApp'
      case 'telegram':
        return 'Telegram'
      case 'facebook':
        return 'Facebook'
      case 'x':
        return 'X (Twitter)'
      case 'linkedin':
        return 'LinkedIn'
      case 'copy':
        return this._copied ? 'Link copiado!' : 'Copiar link'
      case 'native':
        return 'Mais opções...'
      case 'email':
        return 'E-mail'
      default:
        return network
    }
  }

  _renderShareItems() {
    const networks = this.share?.networks || []
    return networks.map(
      (network) => html`
        <md-list-item type="button" @click=${() => this._share(network)}>
          ${this._renderShareIcon(network)}
          ${this._shareLabel(network)}
        </md-list-item>
      `,
    )
  }

  _renderRoute() {
    const appRoute = this.routes.find((route) => route.name === this._route.name)
    if (appRoute) {
      return appRoute.render({ params: this._route.params, query: this._route.query })
    }

    switch (this._route.name) {
      case 'home':
        return this.home()
      case 'conta-entrar':
        return html`<auth-view mode="signin"></auth-view>`
      case 'conta-cadastro':
        return html`<auth-view mode="signup"></auth-view>`
      case 'conta-esqueci-senha':
        return html`<auth-view mode="forgot"></auth-view>`
      case 'conta-redefinir-senha':
        return html`<auth-view mode="reset" .token=${this._route.query.token ?? null}></auth-view>`
      case 'conta-alterar-senha':
        return html`<auth-view mode="change"></auth-view>`
      case 'conta':
        return html`<auth-view></auth-view>`
      case 'config-backend':
        return html`<config-backend-view></config-backend-view>`
      case 'config-acessibilidade':
        if (accessibilityService.config.enabled) {
          return html`<config-accessibility-view></config-accessibility-view>`
        }
        return html`<not-found-view .path=${this._route.segments.join('/')}></not-found-view>`
      case 'config-privacidade':
        // Sem GA4 (ou com requireConsent: false) não há o que configurar.
        if (this._asksConsent()) {
          return html`<config-privacy-view .privacyUrl=${this.analytics.privacyUrl}></config-privacy-view>`
        }
        return html`<not-found-view .path=${this._route.segments.join('/')}></not-found-view>`
      case 'config-notificacoes':
        // Sem createAppShell({ push }) não há o que configurar. Sem suporte
        // do navegador a tela aparece mesmo assim, para explicar o porquê
        // (ex.: iOS sem o app instalado).
        if (pushService.isConfigured()) {
          return html`<config-notifications-view></config-notifications-view>`
        }
        return html`<not-found-view .path=${this._route.segments.join('/')}></not-found-view>`
      case NOT_FOUND:
      default:
        return html`<not-found-view .path=${this._route.segments.join('/')}></not-found-view>`
    }
  }
}

customElements.define('app-shell', AppShell)
