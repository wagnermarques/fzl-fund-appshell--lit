import { LitElement, html, css } from 'lit'

/** Bolinha + rótulo com o estado de rede: online/offline (via navigator.onLine
 *  + os eventos 'online'/'offline') e, quando o navegador expõe a Network
 *  Information API (hoje só browsers baseados em Chromium — Firefox/Safari
 *  não implementam), o tipo de conexão (wifi, cellular, 4g...). */
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
    this._online = navigator.onLine
    this._kind = this._readConnectionKind()
  }

  _readConnectionKind() {
    // `type` (wifi/cellular/ethernet...) responde exatamente "que tipo de
    // rede", mas muitos browsers só implementam `effectiveType` (a
    // categoria de velocidade: 4g/3g/2g/slow-2g) por razão de privacidade.
    const conn = navigator.connection
    return conn?.type && conn.type !== 'unknown' ? conn.type : conn?.effectiveType ?? null
  }

  connectedCallback() {
    super.connectedCallback()
    this._onOnline = () => {
      this._online = true
      this._kind = this._readConnectionKind()
    }
    this._onOffline = () => {
      this._online = false
    }
    this._onConnectionChange = () => {
      this._kind = this._readConnectionKind()
    }
    window.addEventListener('online', this._onOnline)
    window.addEventListener('offline', this._onOffline)
    navigator.connection?.addEventListener('change', this._onConnectionChange)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    window.removeEventListener('online', this._onOnline)
    window.removeEventListener('offline', this._onOffline)
    navigator.connection?.removeEventListener('change', this._onConnectionChange)
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
