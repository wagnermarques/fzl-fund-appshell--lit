import { LitElement, html, css } from 'lit'
import { restConfigService } from '../services/rest-config-service.js'

/** Página inicial: explica o propósito do appshell e resume os parâmetros
 *  de configuração atuais (lidos das variáveis de ambiente). */
export class HomeView extends LitElement {
  static styles = css`
    :host {
      display: block;
      max-width: 720px;
      margin: 0 auto;
      padding: 16px 24px 64px;
    }
    h1 {
      font-size: 1.6rem;
      margin: 0 0 4px;
    }
    .subtitle {
      color: var(--md-sys-color-on-surface-variant);
      margin: 0 0 24px;
    }
    h2 {
      font-size: 1.05rem;
      margin: 32px 0 8px;
    }
    p {
      line-height: 1.6;
      color: var(--md-sys-color-on-surface);
    }
    ul {
      line-height: 1.6;
      padding-left: 20px;
    }
    .config-card {
      margin-top: 12px;
      padding: 16px;
      border: 1px solid var(--md-sys-color-outline);
      border-radius: 12px;
      background: var(--md-sys-color-surface-variant);
    }
    .config-card dl {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 4px 16px;
      margin: 0;
    }
    .config-card dt {
      color: var(--md-sys-color-on-surface-variant);
      font-size: 0.85rem;
    }
    .config-card dd {
      margin: 0;
      font-family: monospace;
      word-break: break-all;
    }
    .config-card dd.unset {
      font-family: inherit;
      font-style: italic;
      color: var(--md-sys-color-error);
    }
    .config-card a {
      display: inline-block;
      margin-top: 12px;
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
      <h1>Fund Appshell</h1>
      <p class="subtitle">Casca de aplicação de referência da família fzlbpms-funds</p>

      <p>
        Este projeto não é um aplicativo de negócio — é um <strong>appshell</strong>: uma base
        comum, já pronta e testada, para começar rapidamente qualquer novo projeto da família
        <strong>fzlbpms-funds</strong> sem precisar decidir de novo a stack, a navegação, o tema
        ou a configuração de acesso ao backend.
      </p>

      <p>
        É construído com <strong>Web Components</strong> (<a href="https://lit.dev" target="_blank" rel="noopener">Lit</a>
        + <a href="https://github.com/material-components/material-web" target="_blank" rel="noopener">Material Web</a>,
        Material&nbsp;3), empacotado com <a href="https://vitejs.dev" target="_blank" rel="noopener">Vite</a>, e
        instalável como <strong>PWA</strong> — funciona offline depois do primeiro carregamento e
        pode ser adicionado à tela inicial do celular ou do desktop.
      </p>

      <h2>Parâmetros de configuração</h2>
      <p>
        A configuração deste appshell vem das variáveis de ambiente do build (arquivos
        <code>.env.local</code> / <code>.env.example</code>) — elas são a <strong>fonte da
        verdade</strong>. A tela em <em>Config → Backend → Serviços REST</em> só exibe o valor
        atual; ainda não é possível editá-lo pela interface.
      </p>

      <div class="config-card">
        <dl>
          <dt>Serviços REST — base path</dt>
          <dd class=${baseUrl ? '' : 'unset'}>
            ${baseUrl || 'não definido — configure VITE_REST_API_BASE_URL em .env.local'}
          </dd>
        </dl>
        <a href="#/config/backend/servicos-rest">Ver em Config → Backend → Serviços REST</a>
      </div>
    `
  }
}

customElements.define('home-view', HomeView)
