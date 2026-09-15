import { LitElement, html, css } from 'lit'
import { navigateHome } from '../router.js'

/** Exibida quando o hash não casa com nenhuma rota — em vez de cair
 *  silenciosamente na home, mostra o endereço pedido e um caminho de volta. */
export class NotFoundView extends LitElement {
  static properties = {
    path: {},
  }

  static styles = css`
    :host {
      display: block;
      max-width: 640px;
      margin: 0 auto;
      padding: 16px 24px 64px;
    }
    h1 {
      font-size: 1.5rem;
      margin: 0 0 8px;
    }
    p {
      color: var(--md-sys-color-on-surface-variant);
    }
    code {
      background: var(--md-sys-color-surface-variant);
      color: var(--md-sys-color-on-surface-variant);
      padding: 1px 4px;
      border-radius: 4px;
      overflow-wrap: anywhere;
    }
  `

  constructor() {
    super()
    this.path = ''
  }

  render() {
    return html`
      <h1>Página não encontrada</h1>
      <p>Não existe nada no endereço <code>#/${this.path}</code>.</p>
      <md-filled-button @click=${navigateHome}>Ir para o início</md-filled-button>
    `
  }
}

customElements.define('not-found-view', NotFoundView)
