import { LitElement, html, css } from 'lit'

const DATE_FORMAT = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
const TIME_FORMAT = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** Dia da semana + data + hora, atualizando a cada segundo. */
export class AppClock extends LitElement {
  static properties = {
    _now: { state: true },
  }

  static styles = css`
    :host {
      display: inline-flex;
      font-variant-numeric: tabular-nums;
    }
  `

  constructor() {
    super()
    this._now = new Date()
  }

  connectedCallback() {
    super.connectedCallback()
    this._timer = setInterval(() => {
      this._now = new Date()
    }, 1000)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    clearInterval(this._timer)
  }

  render() {
    return html`<span>${DATE_FORMAT.format(this._now)} · ${TIME_FORMAT.format(this._now)}</span>`
  }
}

customElements.define('app-clock', AppClock)
