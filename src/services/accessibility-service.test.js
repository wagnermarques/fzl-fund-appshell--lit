import { describe, expect, it } from 'vitest'
import { resolveAccessibility } from '../a11y/index.js'
import { accessibilityConfig, accessibilityService } from './accessibility-service.js'

describe('accessibilityService', () => {
  it('a demo habilita tudo (appshell.config.js via preset)', () => {
    expect(accessibilityConfig).toEqual(resolveAccessibility())
    expect(accessibilityService.config).toBe(accessibilityConfig)
  })

  it('guarda as preferências com o prefixo do app', () => {
    expect(accessibilityService.key).toBe(`${__APP_STORAGE_PREFIX__}:a11y:preferences`)
  })
})
