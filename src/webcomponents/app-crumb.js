import { FzlLitCrumb, parseFzlCrumbItems } from '@fzl/webcomponents-lit/crumb'
import { NOT_FOUND } from '../router.js'

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

if (typeof customElements !== 'undefined' && !customElements.get('app-crumb')) {
  customElements.define('app-crumb', AppCrumb)
}

export { FzlLitCrumb, parseFzlCrumbItems }
