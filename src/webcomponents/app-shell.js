import { LitElement, html, css } from 'lit'
import { registerSW } from 'virtual:pwa-register'
import './config-rest-services-view.js'
import './nav-accordion.js'
import './app-footer.js'
import './app-header.js'
import './auth-view.js'
import './not-found-view.js'
import { authService } from '../services/auth-service.js'
import {
  NOT_FOUND,
  createRouter,
  navigateToAccount,
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
    _route: { state: true },
    _drawerOpen: { state: true },
    _updateAvailable: { state: true },
    _user: { state: true },
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
       coisa da página por trás enquanto o drawer estiver aberto. A
       página continua visível (escurecida pelo scrim) — quem precisar
       de uma ação clicável ali deve usar texto/link simples, não um
       componente com camadas internas próprias (ex.: md-text-button),
       que pode escapar do empilhamento do drawer. */
    main[inert],
    app-footer[inert] {
      pointer-events: none;
    }
    md-navigation-drawer-modal {
      --md-navigation-drawer-modal-scrim-color: #000;
      --md-navigation-drawer-modal-scrim-opacity: 0.32;
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
    this._route = { name: 'home' }
    this._drawerOpen = false
    this._updateAvailable = false
    this._user = null
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
    this._unsubscribe = createRouter(
      (route) => {
        this._route = route
        this._drawerOpen = false
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
                <nav-accordion label="Conta" expanded>
                  <md-list>${this._renderAccountItems()}</md-list>
                </nav-accordion>
              `
            : ''}
          ${this.drawer.shellSections.config
            ? html`
                <nav-accordion label="Config">
                  <nav-accordion label="Backend" nested expanded>
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
                </nav-accordion>
              `
            : ''}
        </div>
      </md-navigation-drawer-modal>

      <main ?inert=${this._drawerOpen}>${this._renderRoute()}</main>

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
      <md-list-item type="button" @click=${() => this._selectDrawerItem(navigateToSignup)}>
        <md-icon slot="start">person_add</md-icon>
        Criar conta
      </md-list-item>
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
      case 'conta':
        return html`<auth-view></auth-view>`
      case 'config-backend-servicos-rest':
        return html`<config-rest-services-view></config-rest-services-view>`
      case NOT_FOUND:
      default:
        return html`<not-found-view .path=${this._route.segments.join('/')}></not-found-view>`
    }
  }
}

customElements.define('app-shell', AppShell)
