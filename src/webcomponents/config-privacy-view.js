import { LitElement, html, css } from 'lit'
import { consentService } from '../services/consent-service.js'

/** Config > Privacidade — onde o usuário revê ou troca a resposta dada no
 *  banner de consentimento. Revogar desliga o GA4 na hora e apaga os
 *  cookies _ga deste app (ver analyticsService.setConsent). */
export class ConfigPrivacyView extends LitElement {
  static properties = {
    privacyUrl: {},
    _consent: { state: true },
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
      margin: 0 0 4px;
    }
    .breadcrumb {
      color: var(--md-sys-color-on-surface-variant);
      font-size: 0.85rem;
      margin: 0 0 24px;
    }
    label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      font-size: 1rem;
    }
    .hint {
      margin-top: 8px;
      font-size: 0.85rem;
      color: var(--md-sys-color-on-surface-variant);
    }
    a {
      color: var(--md-sys-color-primary);
    }
  `

  constructor() {
    super()
    this._consent = consentService.get()
  }

  connectedCallback() {
    super.connectedCallback()
    this._unsubscribe = consentService.subscribe((value) => (this._consent = value))
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._unsubscribe?.()
  }

  _statusText() {
    if (this._consent === 'granted') return 'Você autorizou a medição de uso.'
    if (this._consent === 'denied') return 'Você recusou a medição de uso. Nenhum dado é enviado.'
    return 'Você ainda não respondeu. Enquanto isso, nenhum dado é enviado.'
  }

  render() {
    return html`
      <p class="breadcrumb">Config &rsaquo; Privacidade</p>
      <h1>Privacidade</h1>
      <label>
        Permitir medição de uso (Google Analytics)
        <md-switch
          ?selected=${this._consent === 'granted'}
          @change=${(e) => consentService.set(e.target.selected ? 'granted' : 'denied')}
        ></md-switch>
      </label>
      <p class="hint">
        ${this._statusText()} A medição registra quais telas do app são abertas, para
        sabermos o que melhorar — nunca o conteúdo da sua conta. Ao desligar, os cookies do
        Google Analytics deste app são apagados.
        ${this.privacyUrl
          ? html`<a href=${this.privacyUrl} target="_blank" rel="noopener">Política de privacidade</a>`
          : ''}
      </p>
    `
  }
}

customElements.define('config-privacy-view', ConfigPrivacyView)
