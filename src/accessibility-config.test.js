import { describe, expect, it } from 'vitest'
import { ACCESSIBILITY_DISABLED, FONTS, THEMES, fontImports, resolveAccessibility } from './accessibility-config.js'
import { defineAppShellConfig } from './config.js'

describe('resolveAccessibility', () => {
  it('ausente liga tudo, com os padrões do sistema', () => {
    expect(resolveAccessibility()).toEqual({
      enabled: true,
      fonts: Object.keys(FONTS),
      themes: Object.keys(THEMES),
      textScales: [1, 1.25, 1.5, 1.75, 2],
      defaults: { font: 'system', theme: 'system', textScale: 1 },
    })
  })

  it('false desliga', () => {
    expect(resolveAccessibility(false)).toBe(ACCESSIBILITY_DISABLED)
  })

  it('restringe fontes, temas e a faixa de tamanho', () => {
    const a11y = resolveAccessibility({
      fonts: ['atkinson'],
      themes: ['high-contrast-dark'],
      textScale: { min: 1.25, max: 1.75 },
      defaults: { font: 'atkinson', textScale: 1.5 },
    })
    expect(a11y.fonts).toEqual(['atkinson'])
    expect(a11y.themes).toEqual(['high-contrast-dark'])
    expect(a11y.textScales).toEqual([1.25, 1.5, 1.75])
    expect(a11y.defaults).toEqual({ font: 'atkinson', theme: 'system', textScale: 1.5 })
  })

  it('o tamanho padrão é o menor da faixa quando não informado', () => {
    expect(resolveAccessibility({ textScale: { min: 1.5 } }).defaults.textScale).toBe(1.5)
  })

  it('erro de digitação quebra em vez de sumir em silêncio', () => {
    expect(() => resolveAccessibility({ font: ['atkinson'] })).toThrow(/opção desconhecida "font"/)
    expect(() => resolveAccessibility({ fonts: ['comic-sans'] })).toThrow(/não reconhece "comic-sans"/)
    expect(() => resolveAccessibility({ themes: ['sepia'] })).toThrow(/não reconhece "sepia"/)
  })

  it('o padrão tem de estar entre as opções habilitadas', () => {
    expect(() => resolveAccessibility({ fonts: [], defaults: { font: 'atkinson' } })).toThrow(/defaults.font/)
    expect(() => resolveAccessibility({ themes: ['dark'], defaults: { theme: 'light' } })).toThrow(/defaults.theme/)
    expect(() => resolveAccessibility({ textScale: { max: 1.5 }, defaults: { textScale: 2 } })).toThrow(
      /defaults.textScale/,
    )
  })

  it('faixa de tamanho inválida', () => {
    expect(() => resolveAccessibility({ textScale: { min: 2, max: 1 } })).toThrow(/textScale/)
    expect(() => resolveAccessibility({ textScale: { max: 3 } })).toThrow(/textScale/)
  })
})

describe('fontImports', () => {
  it('importa só as fontes habilitadas, subconjunto latin', () => {
    expect(fontImports(resolveAccessibility({ fonts: ['opendyslexic'] }))).toEqual([
      '@fontsource/opendyslexic/latin-400.css',
      '@fontsource/opendyslexic/latin-700.css',
    ])
    expect(fontImports(resolveAccessibility(false))).toEqual([])
  })
})

describe('defineAppShellConfig', () => {
  it('devolve a config como veio', () => {
    const config = { title: 'X', accessibility: { fonts: ['atkinson'] } }
    expect(defineAppShellConfig(config)).toBe(config)
  })

  it('valida a acessibilidade já na definição', () => {
    expect(() => defineAppShellConfig({ accessibility: { fonts: ['arial'] } })).toThrow(/arial/)
  })
})
