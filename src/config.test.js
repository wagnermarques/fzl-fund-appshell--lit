import { describe, expect, it } from 'vitest'
import { defineAppShellConfig } from './config.js'

describe('defineAppShellConfig', () => {
  it('devolve a config como veio', () => {
    const config = { title: 'X', accessibility: { fonts: ['atkinson'] } }
    expect(defineAppShellConfig(config)).toBe(config)
  })

  it('valida a acessibilidade já na definição', () => {
    expect(() => defineAppShellConfig({ accessibility: { fonts: ['arial'] } })).toThrow(/arial/)
  })

  it('valida o resto do arquivo também (opções desconhecidas, segredos)', () => {
    expect(() => defineAppShellConfig({ titulo: 'X' })).toThrow(/titulo/)
    expect(() => defineAppShellConfig({ push: { vapidPrivateKey: 'x' } })).toThrow(/segredo/)
  })
})
