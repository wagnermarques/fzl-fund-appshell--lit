import { describe, expect, it } from 'vitest'
import {
  CONFIG_FILE,
  applyEnvOverrides,
  configSource,
  envName,
  mergeAppConfig,
  resolveAppConfig,
  validateAppConfig,
} from './app-config.js'

describe('validateAppConfig', () => {
  it('aceita a config da demo e as opções conhecidas', () => {
    const config = {
      title: 'App',
      storagePrefix: 'app',
      accessibility: false,
      analytics: { id: 'G-ABC123', requireConsent: true, privacyUrl: '#/p' },
      push: { vapidPublicKey: 'BAbc_-' },
      debug: true,
      manifest: { theme_color: '#000' },
    }
    expect(validateAppConfig(config)).toBe(config)
  })

  it('opção desconhecida quebra (um "titulo" não pode sumir em silêncio)', () => {
    expect(() => validateAppConfig({ titulo: 'X' })).toThrow(/"titulo" não é uma opção conhecida/)
    expect(() => validateAppConfig({ analytics: { measurementId: 'G-1' } })).toThrow(/analytics: "measurementId"/)
  })

  it('recusa segredos em qualquer nível', () => {
    expect(() => validateAppConfig({ push: { vapidPrivateKey: 'x' } })).toThrow(/push.vapidPrivateKey" parece um segredo/)
    expect(() => validateAppConfig({ manifest: { clientSecret: 'x' } })).toThrow(/segredo/)
    expect(() => validateAppConfig({ workbox: { runtimeCaching: [{ password: 'x' }] } })).toThrow(/runtimeCaching.0.password/)
  })

  it('valida os tipos e formatos', () => {
    expect(() => validateAppConfig({ title: 1 })).toThrow(/"title" deve ser texto/)
    expect(() => validateAppConfig({ storagePrefix: '' })).toThrow(/não pode ser vazio/)
    expect(() => validateAppConfig({ debug: 'sim' })).toThrow(/"debug"/)
    expect(() => validateAppConfig({ analytics: { id: 'UA-123' } })).toThrow(/não é um Measurement ID/)
    expect(() => validateAppConfig({ push: { vapidPublicKey: 'não é chave' } })).toThrow(/base64url/)
  })
})

describe('variáveis de ambiente', () => {
  it('nome = VITE_APPSHELL_ + caminho em MAIÚSCULAS_COM_SUBLINHADO', () => {
    expect(envName('title')).toBe('VITE_APPSHELL_TITLE')
    expect(envName('push.vapidPublicKey')).toBe('VITE_APPSHELL_PUSH_VAPID_PUBLIC_KEY')
    expect(envName('backends.meu-api.url')).toBe('VITE_APPSHELL_BACKENDS_MEU_API_URL')
  })

  it('sobrescreve o arquivo, criando o caminho se preciso, e diz de onde veio cada valor', () => {
    const file = { title: 'Do arquivo', push: { vapidPublicKey: '' } }
    const env = { VITE_APPSHELL_ANALYTICS_ID: 'G-ENV1', VITE_APPSHELL_PUSH_VAPID_PUBLIC_KEY: 'BKey' }
    const { config, sources } = applyEnvOverrides(file, env)
    expect(config).toEqual({ title: 'Do arquivo', analytics: { id: 'G-ENV1' }, push: { vapidPublicKey: 'BKey' } })
    expect(sources).toEqual({
      title: CONFIG_FILE,
      'analytics.id': 'VITE_APPSHELL_ANALYTICS_ID',
      'push.vapidPublicKey': 'VITE_APPSHELL_PUSH_VAPID_PUBLIC_KEY',
    })
    expect(file.push.vapidPublicKey).toBe('') // não altera o original
  })

  it('nome antigo vale, mas abaixo do novo; variável vazia não apaga o padrão', () => {
    const legacy = applyEnvOverrides({}, { VITE_GA4_MEASUREMENT_ID: 'G-OLD' })
    expect(legacy.config.analytics.id).toBe('G-OLD')
    expect(legacy.sources['analytics.id']).toBe('VITE_GA4_MEASUREMENT_ID')
    const both = applyEnvOverrides({}, { VITE_GA4_MEASUREMENT_ID: 'G-OLD', VITE_APPSHELL_ANALYTICS_ID: 'G-NEW' })
    expect(both.config.analytics.id).toBe('G-NEW')
    expect(applyEnvOverrides({ title: 'Arquivo' }, { VITE_APPSHELL_TITLE: '' }).config.title).toBe('Arquivo')
  })

  it('resolveAppConfig valida o resultado: id errado vindo do ambiente quebra o build', () => {
    expect(() => resolveAppConfig({}, { env: { VITE_APPSHELL_ANALYTICS_ID: 'errado' } })).toThrow(/Measurement ID/)
  })

  it('resolveAppConfig tira as opções de build e resolve o storagePrefix', () => {
    const { config } = resolveAppConfig(
      { title: 'X', manifest: { a: 1 }, workbox: {}, accessibility: false },
      { packageName: 'meu-app' },
    )
    expect(config).toEqual({ title: 'X', storagePrefix: 'meu-app' })
    expect(resolveAppConfig({ storagePrefix: 'px' }, { packageName: 'meu-app' }).config.storagePrefix).toBe('px')
  })

  it('configSource lê de onde veio um valor', () => {
    const resolved = { config: {}, sources: { title: CONFIG_FILE } }
    expect(configSource('title', resolved)).toBe(CONFIG_FILE)
    expect(configSource('analytics.id', resolved)).toBe(null)
  })
})

describe('mergeAppConfig', () => {
  const file = {
    title: 'Do arquivo',
    storagePrefix: 'app',
    analytics: { id: 'G-1', requireConsent: true },
    push: { vapidPublicKey: 'BKey' },
  }

  it('o arquivo preenche o que o main.js não disse; cookiePrefix padrão = storagePrefix', () => {
    const onSubscribe = () => {}
    expect(mergeAppConfig({ mount: '#app', push: { onSubscribe } }, file)).toEqual({
      mount: '#app',
      title: 'Do arquivo',
      analytics: { id: 'G-1', requireConsent: true, cookiePrefix: 'app' },
      push: { vapidPublicKey: 'BKey', onSubscribe },
    })
  })

  it('o main.js vence campo a campo, e null desliga o que o arquivo ligou', () => {
    const merged = mergeAppConfig({ title: 'Do main', analytics: { id: 'G-2' }, push: null }, file)
    expect(merged.title).toBe('Do main')
    expect(merged.analytics.id).toBe('G-2')
    expect(merged.analytics.requireConsent).toBe(true)
    expect(merged.push).toBe(null)
    expect(mergeAppConfig({ analytics: null }, file).analytics).toBe(null)
  })

  it('sem arquivo, a config passa como veio', () => {
    const config = { title: 'X' }
    expect(mergeAppConfig(config, {})).toEqual(config)
  })
})
