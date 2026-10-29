import { LitElement, html, css } from 'lit'
import { NOT_FOUND } from '../router.js'

export function parseFzlCrumbItems(items, pathStr) {
  if (Array.isArray(items) && items.length > 0) {
    return items.map((it) => (typeof it === 'string' ? { label: it } : it))
  }
  const raw = typeof items === 'string' && items.trim() ? items.trim() : (pathStr ?? '').trim()
  if (!raw) return []
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.map((it) =>
          typeof it === 'string' ? { label: it } : { label: String(it.label ?? ''), href: it.href, id: it.id },
        )
      }
    } catch {
      // Fallback para separadores de caminho
    }
  }
  return raw
    .split(/\s*(?:\/|›|>)\s*/)
    .filter(Boolean)
    .map((segment, idx, arr) => ({
      label: segment,
      href:
        idx === 0 &&
        arr.length > 1 &&
        (segment.toLowerCase() === 'início' ||
          segment.toLowerCase() === 'inicio' ||
          segment.toLowerCase() === 'home')
          ? '#/'
          : undefined,
    }))
}

export class FzlLitCrumb extends LitElement {
  static properties = {
    items: {
      converter: {
        fromAttribute: (value) => parseFzlCrumbItems(value),
      },
    },
    path: { type: String, reflect: true },
    separator: { type: String, reflect: true },
    showBack: { type: Boolean, attribute: 'show-back', reflect: true },
    backDisabled: { type: Boolean, attribute: 'back-disabled', reflect: true },
    backLabel: { type: String, attribute: 'back-label', reflect: true },
    backHref: { type: String, attribute: 'back-href', reflect: true },
    ariaLabel: { type: String, attribute: 'aria-label', reflect: true },
  }

  static styles = css`
    :host {
      --_fzl-font-family: var(--fzl-font-family, var(--md-ref-typeface-plain, system-ui, sans-serif));
      --_fzl-color-primary: var(--fzl-color-primary, var(--md-sys-color-primary, #6750a4));
      --_fzl-color-primary-hover: var(--fzl-color-primary-hover, var(--md-sys-color-primary, #6750a4));
      --_fzl-color-surface: var(--fzl-color-surface, var(--md-sys-color-surface, #fffbfe));
      --_fzl-color-surface-muted: var(--fzl-color-surface-muted, var(--md-sys-color-surface-container-low, #f8f2fa));
      --_fzl-color-border: var(--fzl-color-border, var(--md-sys-color-outline-variant, #cac4cf));
      --_fzl-color-text: var(--fzl-color-text, var(--md-sys-color-on-surface, #1c1b1f));
      --_fzl-color-text-muted: var(--fzl-color-text-muted, var(--md-sys-color-on-surface-variant, #49454f));
      --_fzl-color-disabled-text: var(--fzl-color-disabled-text, var(--md-sys-color-outline, #79747e));
      --_fzl-focus-ring: var(--fzl-focus-ring, 0 0 0 3px rgba(103, 80, 164, 0.3));
      --_fzl-transition-fast: var(--fzl-transition-fast, 150ms cubic-bezier(0.4, 0, 0.2, 1));
      display: block;
      font-family: var(--_fzl-font-family);
    }

    nav {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 1rem;
      background-color: var(--_fzl-color-surface-muted);
      border-bottom: 1px solid var(--_fzl-color-border);
      color: var(--_fzl-color-text-muted);
      font-size: 0.875rem;
      line-height: 1.5;
      min-height: 2.5rem;
      box-sizing: border-box;
    }

    .back-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.5rem;
      font-family: inherit;
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--_fzl-color-primary);
      background-color: transparent;
      border: 1px solid var(--_fzl-color-border);
      border-radius: 0.375rem;
      cursor: pointer;
      transition:
        background-color var(--_fzl-transition-fast),
        border-color var(--_fzl-transition-fast),
        color var(--_fzl-transition-fast);
      flex-shrink: 0;
      user-select: none;
    }

    .back-btn:hover:not(:disabled) {
      background-color: var(--_fzl-color-surface);
      border-color: var(--_fzl-color-primary);
      color: var(--_fzl-color-primary-hover);
    }

    .back-btn:focus-visible {
      outline: none;
      box-shadow: var(--_fzl-focus-ring);
    }

    .back-btn:disabled {
      color: var(--_fzl-color-disabled-text);
      border-color: var(--_fzl-color-border);
      background-color: transparent;
      cursor: not-allowed;
      opacity: 0.6;
    }

    .back-icon {
      width: 0.875rem;
      height: 0.875rem;
      fill: currentColor;
      flex-shrink: 0;
    }

    ol {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem;
      list-style: none;
      margin: 0;
      padding: 0;
      min-width: 0;
    }

    li {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      min-width: 0;
    }

    a.crumb-link {
      color: var(--_fzl-color-primary);
      text-decoration: none;
      font-weight: 500;
      border-radius: 0.25rem;
      padding: 0.125rem 0.25rem;
      transition:
        color var(--_fzl-transition-fast),
        background-color var(--_fzl-transition-fast);
    }

    a.crumb-link:hover {
      color: var(--_fzl-color-primary-hover);
      text-decoration: underline;
    }

    a.crumb-link:focus-visible {
      outline: none;
      box-shadow: var(--_fzl-focus-ring);
    }

    .crumb-text {
      color: var(--_fzl-color-text-muted);
      padding: 0.125rem 0.25rem;
    }

    .crumb-current {
      color: var(--_fzl-color-text);
      font-weight: 600;
      padding: 0.125rem 0.25rem;
    }

    .separator {
      color: var(--_fzl-color-text-muted);
      user-select: none;
      padding: 0 0.125rem;
    }
  `

  constructor() {
    super()
    this.items = []
    this.path = ''
    this.separator = '›'
    this.showBack = true
    this.backDisabled = false
    this.backLabel = 'Voltar'
    this.backHref = ''
    this.ariaLabel = 'Navegação estrutural'
  }

  _resolvedItems() {
    return parseFzlCrumbItems(this.items, this.path)
  }

  _handleBack(event) {
    if (this.backDisabled) {
      event.preventDefault()
      event.stopImmediatePropagation()
      return
    }
    const customEvent = new CustomEvent('fzl-back', {
      detail: { backHref: this.backHref, originalEvent: event },
      bubbles: true,
      composed: true,
      cancelable: true,
    })
    const dispatched = this.dispatchEvent(customEvent)
    if (dispatched) {
      if (this.backHref) {
        if (this.backHref.startsWith('#')) {
          window.location.hash = this.backHref
        } else {
          window.location.href = this.backHref
        }
      } else if (typeof window !== 'undefined' && window.history.length > 1) {
        window.history.back()
      }
    }
  }

  _handleItemClick(event, item, index) {
    const customEvent = new CustomEvent('fzl-navigate', {
      detail: { item, index, href: item.href, originalEvent: event },
      bubbles: true,
      composed: true,
      cancelable: true,
    })
    const dispatched = this.dispatchEvent(customEvent)
    if (!dispatched) {
      event.preventDefault()
    }
  }

  render() {
    const list = this._resolvedItems()
    const lastIdx = list.length - 1

    return html`
      <nav part="nav" aria-label=${this.ariaLabel || 'Navegação estrutural'}>
        ${this.showBack
          ? html`
              <button
                part="back-button"
                type="button"
                class="back-btn"
                ?disabled=${this.backDisabled}
                aria-label=${this.backLabel}
                @click=${this._handleBack}
              >
                <svg class="back-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                </svg>
                <span>${this.backLabel}</span>
              </button>
            `
          : ''}
        <ol part="list">
          ${list.map((item, idx) => {
            const isLast = idx === lastIdx
            return html`
              <li part="item">
                ${isLast
                  ? html`<span part="current" class="crumb-current" aria-current="page">${item.label}</span>`
                  : item.href
                    ? html`<a
                        part="link"
                        class="crumb-link"
                        href=${item.href}
                        @click=${(e) => this._handleItemClick(e, item, idx)}
                        >${item.label}</a
                      >`
                    : html`<span class="crumb-text">${item.label}</span>`}
                ${!isLast ? html`<span part="separator" class="separator" aria-hidden="true">${this.separator}</span>` : ''}
              </li>
            `
          })}
        </ol>
      </nav>
    `
  }
}

const SHELL_ROUTE_CRUMBS = {
  home: [{ label: 'Início', href: '#/' }],
  conta: [{ label: 'Início', href: '#/' }, { label: 'Conta' }, { label: 'Minha conta' }],
  'conta-entrar': [{ label: 'Início', href: '#/' }, { label: 'Conta' }, { label: 'Entrar' }],
  'conta-cadastro': [{ label: 'Início', href: '#/' }, { label: 'Conta' }, { label: 'Criar conta' }],
  'conta-esqueci-senha': [
    { label: 'Início', href: '#/' },
    { label: 'Conta' },
    { label: 'Entrar', href: '#/conta/entrar' },
    { label: 'Esqueci minha senha' },
  ],
  'conta-redefinir-senha': [{ label: 'Início', href: '#/' }, { label: 'Conta' }, { label: 'Criar nova senha' }],
  'conta-alterar-senha': [
    { label: 'Início', href: '#/' },
    { label: 'Conta', href: '#/conta' },
    { label: 'Alterar senha' },
  ],
  'config-backend': [{ label: 'Início', href: '#/' }, { label: 'Config' }, { label: 'Backend' }],
  'config-acessibilidade': [{ label: 'Início', href: '#/' }, { label: 'Config' }, { label: 'Acessibilidade' }],
  'config-privacidade': [{ label: 'Início', href: '#/' }, { label: 'Config' }, { label: 'Privacidade' }],
  'config-notificacoes': [{ label: 'Início', href: '#/' }, { label: 'Config' }, { label: 'Notificações' }],
  [NOT_FOUND]: [{ label: 'Início', href: '#/' }, { label: 'Página não encontrada' }],
}

/**
 * Calcula a trilha de navegação (breadcrumbs) para a rota atual do appshell.
 *
 * @param {{ name: string, params?: object, query?: object, segments?: string[] }} route
 * @param {Array<{ name: string, title?: string | Function, crumb?: Array | Function }>} [appRoutes=[]]
 * @returns {Array<{ label: string, href?: string }>}
 */
export function resolveRouteCrumbs(route, appRoutes = []) {
  if (!route || !route.name) {
    return SHELL_ROUTE_CRUMBS.home
  }

  const appRoute = appRoutes.find((r) => r.name === route.name)
  if (appRoute) {
    if (appRoute.crumb) {
      const raw =
        typeof appRoute.crumb === 'function'
          ? appRoute.crumb({ params: route.params, query: route.query, segments: route.segments })
          : appRoute.crumb
      const items = parseFzlCrumbItems(raw)
      if (items.length > 0) {
        const first = items[0].label.toLowerCase()
        if (first !== 'início' && first !== 'inicio' && first !== 'home') {
          return [{ label: 'Início', href: '#/' }, ...items]
        }
        return items
      }
    }

    const rawTitle =
      typeof appRoute.title === 'function'
        ? appRoute.title({ params: route.params, query: route.query })
        : appRoute.title || route.name
    return [{ label: 'Início', href: '#/' }, { label: String(rawTitle) }]
  }

  return SHELL_ROUTE_CRUMBS[route.name] ?? SHELL_ROUTE_CRUMBS[NOT_FOUND]
}

export class AppCrumb extends FzlLitCrumb {}

if (typeof customElements !== 'undefined') {
  if (!customElements.get('fzl-lit-crumb')) {
    customElements.define('fzl-lit-crumb', FzlLitCrumb)
  }
  if (!customElements.get('app-crumb')) {
    customElements.define('app-crumb', AppCrumb)
  }
}
