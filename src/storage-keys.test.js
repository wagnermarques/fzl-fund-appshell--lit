import { describe, expect, it } from 'vitest'
import { prefixKey, storageKey } from './storage-keys.js'

describe('prefixKey', () => {
  it('junta prefixo e sufixo com ":"', () => {
    expect(prefixKey('legisreader', 'auth:session')).toBe('legisreader:auth:session')
  })

  it('prefixos diferentes nunca colidem na mesma chave para o mesmo sufixo', () => {
    expect(prefixKey('legisreader', 'auth:session')).not.toBe(prefixKey('bibliapp', 'auth:session'))
  })
})

describe('storageKey', () => {
  it('usa o prefixo de build (__APP_STORAGE_PREFIX__)', () => {
    expect(storageKey('auth:session')).toBe(`${__APP_STORAGE_PREFIX__}:auth:session`)
  })
})
