import { LitElement, html, css } from 'lit'
import { registerSW } from 'virtual:pwa-register'
import './config-privacy-view.js'
import './config-rest-services-view.js'
import './consent-banner.js'
import './nav-accordion.js'
import './app-footer.js'
import './app-header.js'
import './auth-view.js'
import './not-found-view.js'
import { analyticsService } from '../services/analytics-service.js'
import { authService } from '../services/auth-service.js'
import { consentService } from '../services/consent-service.js'
import {
  NOT_FOUND,
  createRouter,
  navigateToAccount,
  navigateToConfigPrivacy,
  navigateToConfigRestServices,
  navigateToLogin,
  navigateToSignup,
} from '../router.js'

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
    /* Cinto e suspensório: além do z-index abaixo (que resolve o
       empilhamento visual do drawer em si), bloqueia clique em qualquer
       coisa da página por trás enquanto o drawer estiver aberto — o
       scrim opaco já a esconde, mas um componente com camadas internas
       próprias (ex.: md-text-button) pode escapar do empilhamento do
       drawer e continuar clicável. */
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
    this._route = { name: 'home' }
    this._drawerOpen = false
    this._updateAvailable = false
    this._user = null
    this._consent = null
    this._swRegistration = null
    this._updateSW = registerSW({
      onNeedRefresh: () => {
        this._updateAvailable = true
      },
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
        this._route = route
        this._drawerOpen = false
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
      }
    }
    document.addEventListener('visibilitychange', this._onVisibilityChange)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._unsubscribe?.()
    this._unsubscribeAuth?.()
    this._unsubscribeConsent?.()
    document.removeEventListener('visibilitychange', this._onVisibilityChange)
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
  }

  _selectDrawerItem(navigate) {
    navigate()
    this._drawerOpen = false
  }

  render() {
    return html`
      <app-header .heading=${this.title} @menu-toggle=${() => (this._drawerOpen = !this._drawerOpen)}>
        ${this.headerActions ? this.headerActions() : ''}
      </app-header>

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
                  <nav-accordion label="Backend" nested>
                    <md-list>
                      <md-list-item
                        type="button"
                        @click=${() => this._selectDrawerItem(navigateToConfigRestServices)}
                      >
                        <md-icon slot="start">dns</md-icon>
                        Serviços REST
                      </md-list-item>
                    </md-list>
                  </nav-accordion>
                  ${this._asksConsent()
                    ? html`
                        <md-list>
                          <md-list-item type="button" @click=${() => this._selectDrawerItem(navigateToConfigPrivacy)}>
                            <md-icon slot="start">privacy_tip</md-icon>
                            Privacidade
                          </md-list-item>
                        </md-list>
                      `
                    : ''}
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

  /** Uma seção do drawer é { id, label, expanded? } + ou items: [{ label,
   *  icon?, href, visible(user)? }] (lista simples) ou render: () => html``
   *  (conteúdo livre, para uma árvore de navegação própria do domínio). */
  _renderDrawerSection(section) {
    if (section.render) {
      return html`
        <nav-accordion label=${section.label} ?expanded=${!!section.expanded}>${section.render()}</nav-accordion>
      `
    }
    const items = section.items.filter((item) => !item.visible || item.visible(this._user))
    return html`
      <nav-accordion label=${section.label} ?expanded=${!!section.expanded}>
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
      case 'config-backend-servicos-rest':
        return html`<config-rest-services-view></config-rest-services-view>`
      case 'config-privacidade':
        // Sem GA4 (ou com requireConsent: false) não há o que configurar.
        if (this._asksConsent()) {
          return html`<config-privacy-view .privacyUrl=${this.analytics.privacyUrl}></config-privacy-view>`
        }
        return html`<not-found-view .path=${this._route.segments.join('/')}></not-found-view>`
      case NOT_FOUND:
      default:
        return html`<not-found-view .path=${this._route.segments.join('/')}></not-found-view>`
    }
  }
}

customElements.define('app-shell', AppShell)
