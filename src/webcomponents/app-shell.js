import { LitElement, html, css } from 'lit'
import { registerSW } from 'virtual:pwa-register'
import './home-view.js'
import './config-rest-services-view.js'
import './nav-accordion.js'
import { createRouter, navigateHome, navigateToConfigRestServices } from '../router.js'

export class AppShell extends LitElement {
  static properties = {
    _route: { state: true },
    _drawerOpen: { state: true },
    _updateAvailable: { state: true },
  }

  static styles = css`
    :host {
      display: block;
      height: 100%;
    }
    .top-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 56px;
      padding: 0 8px;
      background: var(--md-sys-color-surface);
      color: var(--md-sys-color-on-surface);
      border-bottom: 1px solid var(--md-sys-color-outline);
      position: sticky;
      top: 0;
    }
    .top-bar h1 {
      font-size: 1.1rem;
      margin: 0;
      flex: 1;
      cursor: pointer;
    }
    main {
      height: calc(100% - 56px);
      overflow-y: auto;
    }
    /* Cinto e suspensório: além do z-index abaixo (que resolve o
       empilhamento visual do drawer em si), bloqueia clique em qualquer
       coisa da página por trás enquanto o drawer estiver aberto. A
       página continua visível (escurecida pelo scrim) — quem precisar
       de uma ação clicável ali deve usar texto/link simples, não um
       componente com camadas internas próprias (ex.: md-text-button),
       que pode escapar do empilhamento do drawer. */
    main[inert] {
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
    this._route = { name: 'home' }
    this._drawerOpen = false
    this._updateAvailable = false
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
    this._unsubscribe = createRouter((route) => {
      this._route = route
      this._drawerOpen = false
    })

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
      <div class="top-bar">
        <md-icon-button @click=${() => (this._drawerOpen = !this._drawerOpen)} aria-label="Menu">
          <md-icon>menu</md-icon>
        </md-icon-button>
        <h1 @click=${navigateHome}>Fund Appshell</h1>
      </div>

      <md-navigation-drawer-modal
        .opened=${this._drawerOpen}
        @navigation-drawer-changed=${(e) => (this._drawerOpen = e.detail.opened)}
      >
        <div class="drawer-content">
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
        </div>
      </md-navigation-drawer-modal>

      <main ?inert=${this._drawerOpen}>${this._renderRoute()}</main>

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

  _renderRoute() {
    switch (this._route.name) {
      case 'config-backend-servicos-rest':
        return html`<config-rest-services-view></config-rest-services-view>`
      default:
        return html`<home-view></home-view>`
    }
  }
}

customElements.define('app-shell', AppShell)
