import { describe, expect, it } from 'vitest'
import { validateConfig } from './create-app-shell.js'

const noop = () => {}

describe('validateConfig', () => {
  it('aceita a config mínima e preenche routes com []', () => {
    expect(validateConfig({ mount: '#app', home: noop })).toEqual({
      mount: '#app',
      routes: [],
      home: noop,
    })
  })

  it('aceita um elemento como mount, não só um seletor', () => {
    const el = {}
    expect(validateConfig({ mount: el, home: noop })).toEqual({ mount: el, routes: [], home: noop })
  })

  it('passa as rotas do app adiante quando válidas', () => {
    const route = { name: 'busca', match: noop, render: noop }
    expect(validateConfig({ mount: '#app', home: noop, routes: [route] }).routes).toEqual([route])
  })

  it('recusa config ausente ou não-objeto', () => {
    expect(() => validateConfig()).toThrow(/config é obrigatório/)
    expect(() => validateConfig('x')).toThrow(/config é obrigatório/)
  })

  it('recusa mount ausente', () => {
    expect(() => validateConfig({ home: noop })).toThrow(/"mount"/)
  })

  it('recusa home ausente ou que não seja função', () => {
    expect(() => validateConfig({ mount: '#app' })).toThrow(/"home"/)
    expect(() => validateConfig({ mount: '#app', home: 'x' })).toThrow(/"home"/)
  })

  it('recusa rota sem name', () => {
    expect(() => validateConfig({ mount: '#app', home: noop, routes: [{ match: noop, render: noop }] })).toThrow(
      /precisa de "name"/,
    )
  })

  it('recusa nomes de rota duplicados', () => {
    const routes = [
      { name: 'busca', match: noop, render: noop },
      { name: 'busca', match: noop, render: noop },
    ]
    expect(() => validateConfig({ mount: '#app', home: noop, routes })).toThrow(/duplicado "busca"/)
  })

  it('recusa rota sem match', () => {
    expect(() => validateConfig({ mount: '#app', home: noop, routes: [{ name: 'busca', render: noop }] })).toThrow(
      /"busca" precisa de "match"/,
    )
  })

  it('recusa rota sem render', () => {
    expect(() => validateConfig({ mount: '#app', home: noop, routes: [{ name: 'busca', match: noop }] })).toThrow(
      /"busca" precisa de "render"/,
    )
  })
})
