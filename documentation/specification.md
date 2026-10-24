# Especificação — Integração com `fzl-fund-ui-widgets-components`

> Status: **rascunho / em planejamento** — nada implementado ainda.
> Branch: `feat/integracao-ui-widgets`

---

## 1. Objetivo

Passar a usar no appshell os web components do projeto irmão
`../fzl-fund-ui-widgets-components` e, no longo prazo, **substituir todos os
componentes visuais do appshell** pelos componentes desse projeto.

A migração é incremental (padrão *strangler fig*): os dois projetos convivem,
cada componente é migrado individualmente e o appshell nunca fica quebrado no
meio do caminho.

O fluxo é de mão dupla:

1. **Levar** — um componente genérico do appshell é movido para o projeto de componentes.
2. **Trazer** — o appshell passa a consumir esse componente a partir do pacote.

---

## 2. Contexto

### 2.1 Appshell (`fzl-fund-appshell--lit`)

- JavaScript (ES modules), Lit 3, `@material/web`, Vite 8.
- Também é uma biblioteca: expõe `exports` (incluindo `./webcomponents/*`) e
  declara `peerDependencies`.
- Componentes atuais em `src/webcomponents/`.

### 2.2 Projeto de componentes (`fzl-fund-ui-widgets-components`)

- Monorepo com npm workspaces:
  - `@fzl/webcomponents-es6` (vanilla)
  - `@fzl/webcomponents-lit`
  - `@fzl/webcomponents-angular` (Angular Elements)
  - `@fzl/design-tokens` (`packages/design-tokens`, variáveis `--fzl-*`)
- TypeScript, Vite 6.
- **Ainda não é um repositório Git.**
- `@fzl/webcomponents-lit` hoje contém apenas o componente `button`.

---

## 3. Decisões tomadas

| Tema | Decisão |
|---|---|
| Forma de consumo | Pacote npm local via link (`file:../fzl-fund-ui-widgets-components/webcomponents-lit` ou `npm link`). **Não** usar submódulo Git. |
| Distribuição (registry) | Adiada. |
| Distribuição do próprio appshell | Adiada. |
| TS × JS | Componentes em TypeScript lá; appshell continua em JavaScript e consome o JS compilado (`dist/`). Os `.d.ts` servem só para autocomplete. |
| Fronteira | **Componente genérico vai para lá. Cola do appshell fica aqui.** |
| Visual | Os componentes de lá também usam Material Design (`@material/web`). |
| Tema | Appshell mantém seu tema (`src/styles/theme.css`, variáveis `--md-sys-*`). Componentes Material Web herdam essas variáveis através do Shadow DOM. |

---

## 4. Fronteira: genérico × cola

Um componente **genérico** não conhece o appshell: recebe dados por
propriedades/atributos e comunica por eventos DOM. Não importa
`appshell.config.js`, `backend()`, eventos `push:*`/`notification:*` etc.

A **cola** é o que liga o componente ao appshell: ler config, assinar eventos
do shell, chamar backends, rotear.

Componentes acoplados podem ser divididos: parte visual vai para lá, parte de
cola fica aqui (wrapper fino).

Classificação inicial (a confirmar):

| Componente | Tendência |
|---|---|
| `app-clock`, `app-version`, `connection-status`, `nav-accordion` | Genéricos — candidatos fáceis |
| `app-header`, `app-footer`, `consent-banner`, `user-status`, `user-notifications` | Dividir visual × cola |
| `app-shell`, `auth-view`, `config-*-view`, `not-found-view` | Cola do appshell — por último ou ficam aqui |
| `md-imports` | Infra do appshell (imports do Material Web) |

---

## 5. Requisitos técnicos

### 5.1 No `@fzl/webcomponents-lit`

1. **Lit externo ao bundle** — hoje `vite.config` tem `external: []` e `lit`
   está em `dependencies`, o que embute uma segunda cópia do Lit. Ajustar para
   `external: [/^lit/, /^@material\/web/]` e mover `lit` (e `@material/web`)
   para `peerDependencies`.
2. **Exports por componente** — além de `"."`, expor cada componente
   individualmente (ex.: `@fzl/webcomponents-lit/connection-status`) para que o
   appshell importe só o que já foi migrado.
3. **`@material/web`** como dependência dos componentes que o usam.

### 5.2 Registro de custom elements

Evitar erro de "already defined" quando appshell e app registram a mesma tag:
usar guarda (`customElements.get(tag)`) ou um único ponto de registro.

### 5.3 Angular Elements

Pesado (runtime Angular + zone.js). No appshell priorizar Lit/ES6; componentes
Angular, se usados, carregados sob demanda via `import()` dinâmico.

### 5.4 Versões

Appshell em Vite 8, projeto de componentes em Vite 6. Como o appshell consome
o `dist/` compilado, não há conflito direto — mas vale alinhar no futuro.

---

## 6. Ciclo de migração de um componente

1. **Levar** — copiar o componente para `webcomponents-lit`, converter para
   TS, remover dependências do appshell (viram propriedades/eventos).
2. **Build** — gerar o `dist/` do pacote.
3. **Trazer** — no appshell, trocar o import para o pacote; o arquivo antigo é
   removido ou vira wrapper de cola.
4. **Validar** — testes (vitest) e verificação visual no app rodando.

Critério de pronto: *a definir*.

---

## 7. Pré-requisitos

- [ ] `git init` + commit inicial no `fzl-fund-ui-widgets-components`.
- [ ] Ajustes do item 5.1.
- [ ] Ligar o appshell ao pacote via `file:` e consumir o `button` existente
      como prova do encanamento.

---

## 8. Em aberto

- **Design tokens** — `@fzl/design-tokens` (`--fzl-*`) e o tema do appshell
  (`--md-sys-*`) convivem sem colisão, mas falta definir a relação entre eles
  (ex.: `--fzl-color-primary` derivar de `--md-sys-color-primary`?).
- **Ordem da migração.**
- **Critério de pronto** por componente.
- **Dependência direta × peer** — com a substituição total planejada, a
  tendência é dependência direta do appshell.
- **Distribuição** (registry) do pacote de componentes e do appshell.
- Onde a mudança no outro projeto é feita: nesta sessão ou na sessão daquele
  projeto.
