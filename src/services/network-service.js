/**
 * Estado de rede: online/offline (navigator.onLine + os eventos
 * 'online'/'offline') e, quando o navegador expõe a Network Information API
 * (hoje só browsers baseados em Chromium — Firefox/Safari não implementam),
 * o tipo de conexão (wifi, cellular, 4g...).
 *
 * Atenção: "online" quer dizer que o aparelho tem *alguma* rede, não que a
 * internet (ou o backend do app) responde — um Wi-Fi sem saída conta como
 * online. Para saber se o servidor está alcançável, só fazendo a
 * requisição.
 *
 * Vive fora do <connection-status> para os eventos de rede existirem mesmo
 * quando o app esconde o rodapé. Só escuta o navegador enquanto houver
 * inscritos.
 */

function readKind(nav) {
  // `type` (wifi/cellular/ethernet...) responde exatamente "que tipo de
  // rede", mas muitos browsers só implementam `effectiveType` (a
  // categoria de velocidade: 4g/3g/2g/slow-2g) por razão de privacidade.
  const conn = nav?.connection
  return conn?.type && conn.type !== 'unknown' ? conn.type : conn?.effectiveType ?? null
}

export function createNetworkService({ win = globalThis, nav = globalThis.navigator } = {}) {
  const listeners = new Set()
  let online = nav?.onLine ?? true
  let kind = readKind(nav)

  function notify(change) {
    const state = { online, kind, change }
    listeners.forEach((fn) => fn(state))
  }

  const onOnline = () => {
    online = true
    kind = readKind(nav)
    notify('online')
  }
  const onOffline = () => {
    online = false
    notify('offline')
  }
  const onConnectionChange = () => {
    const next = readKind(nav)
    if (next === kind) return
    kind = next
    // Sem rede, a troca de tipo não interessa: o 'online' trará o novo.
    if (online) notify('change')
  }

  function start() {
    // Relê ao começar a escutar: o estado pode ter mudado enquanto ninguém ouvia.
    online = nav?.onLine ?? true
    kind = readKind(nav)
    win.addEventListener?.('online', onOnline)
    win.addEventListener?.('offline', onOffline)
    nav?.connection?.addEventListener?.('change', onConnectionChange)
  }

  function stop() {
    win.removeEventListener?.('online', onOnline)
    win.removeEventListener?.('offline', onOffline)
    nav?.connection?.removeEventListener?.('change', onConnectionChange)
  }

  return {
    isOnline() {
      return listeners.size ? online : nav?.onLine ?? true
    },

    /** Tipo de conexão ('wifi', '4g'...) ou null quando o navegador não diz. */
    kind() {
      return listeners.size ? kind : readKind(nav)
    },

    /** Chama o callback a cada mudança (não na inscrição) com
     *  { online, kind, change }, change = 'online' | 'offline' | 'change'. */
    subscribe(callback) {
      if (!listeners.size) start()
      listeners.add(callback)
      return () => {
        if (listeners.delete(callback) && !listeners.size) stop()
      }
    },
  }
}

export const networkService = createNetworkService()
