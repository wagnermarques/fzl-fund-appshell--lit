import { LitElement, html, css } from 'lit'
import { navigateHome } from '../router.js'
import './user-status.js'

/** Cabeçalho fixo do appshell: botão do menu, título e, à direita, o
 *  <user-status> (Entrar / notificações + conta). Expõe um <slot> para que
 *  um projeto derivado acrescente ações rápidas antes do user-status — sem
 *  precisar editar este arquivo.
 *
 *  Não abre o drawer por conta própria: dispara `menu-toggle` e quem hospeda
 *  (app-shell) decide. */
export class AppHeader extends LitElement {
  static properties = {
    heading: {},
  }

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 0 0 auto;
      min-height: 56px;
      padding: 0 8px;
      background: var(--md-sys-color-surface);
      color: var(--md-sys-color-on-surface);
      border-bottom: 1px solid var(--md-sys-color-outline);
    }
    h1 {
      font-size: 1.1rem;
      margin: 0;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: pointer;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }
  `

  constructor() {
    super()
    this.heading = 'Fund Appshell'
  }

  render() {
    return html`
      <md-icon-button
        aria-label="Menu"
        @click=${() => this.dispatchEvent(new CustomEvent('menu-toggle', { bubbles: true, composed: true }))}
      >
        <md-icon>menu</md-icon>
      </md-icon-button>
      <h1 @click=${navigateHome}>${this.heading}</h1>
      <div class="actions">
        <slot></slot>
        <user-status></user-status>
      </div>
    `
  }
}

customElements.define('app-header', AppHeader)
