import { LitElement, html, css } from 'lit'
import { announce } from '../a11y/index.js'
import { networkService } from '../services/network-service.js'

/** Bolinha + rótulo com o estado de rede: online/offline e, quando o
 *  navegador informa, o tipo de conexão (wifi, cellular, 4g...) — ambos
 *  vindos do networkService.
 *
 *  Cair e voltar a conexão são anunciados a leitores de tela (WCAG 4.1.3)
 *  — só a mudança, não o estado inicial nem a troca de tipo de rede. */
export class ConnectionStatus extends LitElement {
  static properties = {
    _online: { state: true },
    _kind: { state: true },
  }

  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    md-icon {
      --md-icon-size: 16px;
    }
    .offline {
      color: var(--md-sys-color-error);
    }
  `

  constructor() {
    super()
    this._online = networkService.isOnline()
    this._kind = networkService.kind()
  }

  connectedCallback() {
    super.connectedCallback()
    this._online = networkService.isOnline()
    this._kind = networkService.kind()
    this._unsubscribe = networkService.subscribe(({ online, kind, change }) => {
      this._online = online
      this._kind = kind
      if (change === 'online') announce('Conexão restabelecida')
      if (change === 'offline') announce('Sem conexão. O app continua funcionando com o que já está em cache.')
    })
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._unsubscribe?.()
  }

  render() {
    const label = this._online ? (this._kind ? this._kind.toUpperCase() : 'Online') : 'Offline'
    const title = this._online
      ? `Conectado${this._kind ? ` · ${this._kind}` : ''}`
      : 'Sem conexão — o app continua funcionando com o que já está em cache'
    return html`
      <span class=${this._online ? '' : 'offline'} title=${title}>
        <md-icon>${this._online ? 'wifi' : 'wifi_off'}</md-icon>
        ${label}
      </span>
    `
  }
}

customElements.define('connection-status', ConnectionStatus)
