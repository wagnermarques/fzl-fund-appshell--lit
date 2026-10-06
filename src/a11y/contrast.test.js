import { describe, expect, it } from 'vitest'
import { contrastRatio, meetsContrast, relativeLuminance } from './contrast.js'

describe('contraste (fórmula da WCAG 2.x)', () => {
  it('preto sobre branco é 21:1, e a ordem das cores não importa', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5)
  })

  it('valores de referência', () => {
    expect(relativeLuminance('#fff')).toBeCloseTo(1, 5)
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
  })

  it('#777 sobre branco falha no AA por pouco, mas passa como texto grande', () => {
    expect(meetsContrast('#777777', '#ffffff', 'AA')).toBe(false)
    expect(meetsContrast('#777777', '#ffffff', 'AA-large')).toBe(true)
  })

  it('cor ou nível inválido é erro', () => {
    expect(() => contrastRatio('red', '#fff')).toThrow(/red/)
    expect(() => meetsContrast('#000', '#fff', 'AAAA')).toThrow(/AAAA/)
  })
})
