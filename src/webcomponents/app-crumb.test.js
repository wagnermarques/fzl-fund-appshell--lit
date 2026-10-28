import { describe, expect, it } from 'vitest'
import { NOT_FOUND } from '../router.js'
import { parseFzlCrumbItems, resolveRouteCrumbs } from './app-crumb.js'

describe('parseFzlCrumbItems', () => {
  it('converte string delimitada por barra ou seta em itens de crumb', () => {
    expect(parseFzlCrumbItems('Início / Config / Backend')).toEqual([
      { label: 'Início', href: '#/' },
      { label: 'Config', href: undefined },
      { label: 'Backend', href: undefined },
    ])
    expect(parseFzlCrumbItems('Início › Conta › Entrar')).toEqual([
      { label: 'Início', href: '#/' },
      { label: 'Conta', href: undefined },
      { label: 'Entrar', href: undefined },
    ])
  })

  it('converte string JSON em itens de crumb', () => {
    const json = JSON.stringify([
      { label: 'Início', href: '#/' },
      { label: 'Config' },
      { label: 'Acessibilidade' },
    ])
    expect(parseFzlCrumbItems(json)).toEqual([
      { label: 'Início', href: '#/' },
      { label: 'Config', href: undefined, id: undefined },
      { label: 'Acessibilidade', href: undefined, id: undefined },
    ])
  })
})

describe('resolveRouteCrumbs', () => {
  it('resolve as rotas estruturais do shell', () => {
    expect(resolveRouteCrumbs({ name: 'home' })).toEqual([{ label: 'Início', href: '#/' }])
    expect(resolveRouteCrumbs({ name: 'config-backend' })).toEqual([
      { label: 'Início', href: '#/' },
      { label: 'Config' },
      { label: 'Backend' },
    ])
    expect(resolveRouteCrumbs({ name: 'conta-alterar-senha' })).toEqual([
      { label: 'Início', href: '#/' },
      { label: 'Conta', href: '#/conta' },
      { label: 'Alterar senha' },
    ])
    expect(resolveRouteCrumbs({ name: NOT_FOUND })).toEqual([
      { label: 'Início', href: '#/' },
      { label: 'Página não encontrada' },
    ])
  })

  it('resolve rotas do app a partir de crumb explícito ou title', () => {
    const routes = [
      {
        name: 'livro',
        title: ({ params }) => `Livro ${params.id}`,
      },
      {
        name: 'capitulo',
        crumb: ({ params }) => [
          { label: `Livro ${params.livro}`, href: `#/livro/${params.livro}` },
          { label: `Capítulo ${params.cap}` },
        ],
      },
    ]

    expect(resolveRouteCrumbs({ name: 'livro', params: { id: 'gn' } }, routes)).toEqual([
      { label: 'Início', href: '#/' },
      { label: 'Livro gn' },
    ])

    expect(resolveRouteCrumbs({ name: 'capitulo', params: { livro: 'gn', cap: '3' } }, routes)).toEqual([
      { label: 'Início', href: '#/' },
      { label: 'Livro gn', href: '#/livro/gn' },
      { label: 'Capítulo 3' },
    ])
  })
})
