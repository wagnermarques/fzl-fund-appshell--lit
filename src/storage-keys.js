/**
 * Chaves de localStorage com o prefixo do app — para que apps diferentes
 * hospedados na mesma origem (ex.: wagnermarques.github.io/<repo>) não
 * compartilhem sessão nem notificações pelo simples fato de usarem o mesmo
 * appshell.
 *
 * O prefixo vem de __APP_STORAGE_PREFIX__, uma constante de *build* (como
 * __APP_VERSION__) — não uma config passada a createAppShell() — porque
 * auth-service lê a sessão no momento do import, antes de qualquer
 * createAppShell() rodar; uma config em runtime chegaria tarde demais.
 */

/** Função pura, sem depender da constante de build: prefixKey('legisreader',
 *  'auth:session') -> 'legisreader:auth:session'. Separada de storageKey()
 *  para poder testar a garantia de isolamento entre prefixos diretamente. */
export function prefixKey(prefix, suffix) {
  return `${prefix}:${suffix}`
}

export function storageKey(suffix) {
  return prefixKey(__APP_STORAGE_PREFIX__, suffix)
}
