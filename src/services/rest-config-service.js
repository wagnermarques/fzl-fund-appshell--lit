// Configuração de acesso aos serviços REST do backend.
//
// A variável de ambiente VITE_REST_API_BASE_URL é a fonte da verdade: o que
// aparece em Config > Backend > Serviços REST é sempre o valor lido de
// import.meta.env, nunca um valor editado pela UI (ainda não é possível
// alterar essa configuração pela interface — ver roadmap.org).
export const restConfigService = {
  getBaseUrl() {
    return import.meta.env.VITE_REST_API_BASE_URL ?? ''
  },
}
