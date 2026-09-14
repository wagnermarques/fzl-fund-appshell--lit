import { LitElement, html, css } from 'lit'
import { restConfigService } from '../services/rest-config-service.js'

/** Config > Backend > Serviços REST — exibe o path base configurado via
 *  VITE_REST_API_BASE_URL. Somente leitura por enquanto: a env var é a fonte
 *  da verdade e esta tela ainda não permite editá-la pela interface. */
export class ConfigRestServicesView extends LitElement {
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
    md-outlined-text-field {
      width: 100%;
    }
    .hint {
      margin-top: 8px;
      font-size: 0.8rem;
      color: var(--md-sys-color-on-surface-variant);
    }
    code {
      background: var(--md-sys-color-surface-variant);
      color: var(--md-sys-color-on-surface-variant);
      padding: 1px 4px;
      border-radius: 4px;
    }
  `

  render() {
    const baseUrl = restConfigService.getBaseUrl()
    return html`
      <p class="breadcrumb">Config &rsaquo; Backend &rsaquo; Serviços REST</p>
      <h1>Serviços REST</h1>
      <md-outlined-text-field
        label="Base path"
        value=${baseUrl}
        readonly
        supporting-text=${baseUrl
          ? 'Valor lido de VITE_REST_API_BASE_URL.'
          : 'VITE_REST_API_BASE_URL não está definida — configure em .env.local.'}
      ></md-outlined-text-field>
      <p class="hint">
        Esta configuração ainda não pode ser alterada por aqui. Para trocar o path base usado
        pelo appshell para acessar os serviços REST, edite <code>VITE_REST_API_BASE_URL</code> em
        <code>.env.local</code> (veja <code>.env.example</code>) e reinicie o servidor de
        desenvolvimento.
      </p>
    `
  }
}

customElements.define('config-rest-services-view', ConfigRestServicesView)
