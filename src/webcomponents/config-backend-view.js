import { LitElement, html, css } from 'lit'
import { announce } from '../a11y/index.js'
import { CONFIG_FILE, configSource } from '../app-config.js'
import { backendService } from '../services/backend-service.js'

/** Config > Backend — os backends que o app declarou no appshell.config.js:
 *  endereço, de onde o endereço veio (arquivo ou variável de ambiente), se
 *  manda o login e se está respondendo.
 *
 *  Somente leitura, de propósito: os endereços são do app, fixados no
 *  build. Se o usuário pudesse trocá-los aqui, bastaria convencê-lo a
 *  apontar para outro servidor para o token e os dados dele irem junto. */
export class ConfigBackendView extends LitElement {
  static properties = {
    _tick: { state: true },
    _checking: { state: true },
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
    .hint {
      font-size: 0.85rem;
      color: var(--md-sys-color-on-surface-variant);
    }
    .backend {
      margin: 16px 0;
      padding: 16px;
      border: 1px solid var(--md-sys-color-outline-variant);
      border-radius: 12px;
    }
    h2 {
      font-size: 1.1rem;
      margin: 0 0 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    dl {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 4px 16px;
      margin: 0;
      font-size: 0.9rem;
    }
    dt {
      color: var(--md-sys-color-on-surface-variant);
    }
    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
    code {
      font-size: 0.85em;
    }
    .ok {
      color: var(--md-sys-color-primary);
    }
    .down,
    .unset {
      color: var(--md-sys-color-error);
    }
    md-icon {
      --md-icon-size: 20px;
    }
    md-outlined-button {
      margin-top: 12px;
    }
  `

  constructor() {
    super()
    this._tick = 0
    this._checking = new Set()
  }

  connectedCallback() {
    super.connectedCallback()
    this._unsubscribe = backendService.subscribe(() => this._tick++)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._unsubscribe?.()
  }

  async _check(name) {
    this._checking = new Set([...this._checking, name])
    const { reachable } = await backendService.check(name)
    this._checking = new Set([...this._checking].filter((n) => n !== name))
    announce(`${name}: ${reachable ? 'respondendo' : 'não responde'}`)
  }

  _source(name) {
    const source = configSource(`backends.${name}.url`)
    if (!source) return 'não configurado'
    return source === CONFIG_FILE ? CONFIG_FILE : `variável de ambiente ${source}`
  }

  _status({ name, url, health }) {
    if (!url) return html`<span class="unset">Endereço não configurado</span>`
    if (this._checking.has(name)) return html`Verificando…`
    const { reachable, checkedAt, error } = backendService.status(name)
    const when = checkedAt ? ` · ${new Date(checkedAt).toLocaleTimeString()}` : ''
    if (reachable === true) return html`<span class="ok">Respondendo${when}</span>`
    if (reachable === false) return html`<span class="down">Não responde${error ? ` (${error})` : ''}${when}</span>`
    return health ? 'Ainda não verificado' : 'Sem checagem de saúde (health) — o estado aparece após a primeira chamada'
  }

  _icon(name, url) {
    const { reachable } = backendService.status(name)
    if (!url) return html`<md-icon class="unset">link_off</md-icon>`
    if (reachable === true) return html`<md-icon class="ok">cloud_done</md-icon>`
    if (reachable === false) return html`<md-icon class="down">cloud_off</md-icon>`
    return html`<md-icon>cloud</md-icon>`
  }

  _renderBackend(backend) {
    const { name, url, auth, health, timeoutMs } = backend
    return html`
      <section class="backend" aria-labelledby="b-${name}">
        <h2 id="b-${name}">${this._icon(name, url)} ${name}</h2>
        <dl>
          <dt>Endereço</dt>
          <dd>${url ? html`<code>${url}</code>` : html`<span class="unset">—</span>`}</dd>
          <dt>Definido em</dt>
          <dd>${this._source(name)}</dd>
          <dt>Login</dt>
          <dd>${auth === 'bearer' ? 'Envia o token de quem está logado (Bearer)' : 'Não envia'}</dd>
          <dt>Tempo limite</dt>
          <dd>${timeoutMs / 1000} s</dd>
          <dt>Estado</dt>
          <dd role="status">${this._status(backend)}</dd>
        </dl>
        ${url && health
          ? html`<md-outlined-button ?disabled=${this._checking.has(name)} @click=${() => this._check(name)}
              >Verificar agora</md-outlined-button
            >`
          : ''}
      </section>
    `
  }

  render() {
    const backends = backendService.list()
    return html`
      <p class="breadcrumb">Config &rsaquo; Backend</p>
      <h1>Backend</h1>
      <p class="hint">
        Os servidores que este app usa. Os endereços são definidos pelo app — em
        <code>${CONFIG_FILE}</code> ou, por ambiente, em variáveis
        <code>VITE_APPSHELL_BACKENDS_&lt;NOME&gt;_URL</code> — e não podem ser alterados por aqui.
      </p>
      ${backends.length
        ? backends.map((backend) => this._renderBackend(backend))
        : html`<p>
            Nenhum backend declarado. Declare em <code>backends</code> no
            <code>${CONFIG_FILE}</code>, por exemplo
            <code>backends: { api: { url: 'https://api.exemplo.com', auth: 'bearer', health: '/health' } }</code>.
          </p>`}
    `
  }
}

customElements.define('config-backend-view', ConfigBackendView)
