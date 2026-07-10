# Meta Operations OS — Architecture Document

**Status:** Em desenvolvimento. Módulo Asset Manager Engine implementado, atualmente rodando em **Single Operator Mode** (ver nota abaixo) — a arquitetura completa descrita neste documento continua sendo o alvo para quando o sistema for multiusuário/comercializado.
**Escopo deste documento:** desenho completo do sistema — módulos, entidades, relacionamentos, fluxos, banco de dados, segurança e roadmap técnico.

## Nota: Single Operator Mode (fase atual)

A plataforma é usada por uma única pessoa nesta fase. Por decisão explícita, **autenticação, múltiplos usuários, múltiplas empresas, workspaces, permissões, papéis e convites estão desativados** — não removidos da arquitetura, apenas dormentes:

- As tabelas de tenancy (`companies`, `workspaces`, `teams`, `users_profile`, `memberships`) e as políticas de RLS (seção 16) continuam existindo no banco exatamente como desenhadas abaixo.
- A API usa exclusivamente o client de **service role** do Supabase (bypassa RLS por completo) e resolve sempre o mesmo `DEFAULT_WORKSPACE_ID` fixo, em vez de derivar o workspace de um JWT/membership por requisição.
- Não existe tela de login/cadastro; o app abre direto no Dashboard, e nenhuma tela menciona company/workspace/user/membership/team — nem em textos de estado vazio.
- `owner_id` continua existindo como coluna (dormente), mas não é usado em scores, alertas de risco ou contadores de resumo nesta fase — não há seletor de responsável na interface, então tratá-lo como sinal marcaria todo ativo permanentemente sem forma de resolver.
- Consequência de segurança: **a aplicação não tem nenhum controle de acesso** — qualquer pessoa com a URL do deploy consegue usá-la. Mantenha o deploy privado enquanto este modo estiver ativo.

**Reativar o modo multiusuário** (quando o produto for comercializado) significa: trazer de volta Supabase Auth + telas de login/cadastro, resolver o workspace por usuário autenticado em vez de uma constante, e voltar a usar um client escopado por JWT nas rotas (a própria RLS já está pronta para isso). Nenhuma migration de schema é necessária para essa transição — é só reativar o que já existe.

---

## Índice

1. [Visão Geral da Plataforma](#1-visão-geral-da-plataforma)
2. [Objetivos](#2-objetivos)
3. [Filosofia de Arquitetura](#3-filosofia-de-arquitetura)
4. [Arquitetura Completa](#4-arquitetura-completa)
5. [Módulos](#5-módulos)
6. [Responsabilidade de Cada Módulo](#6-responsabilidade-de-cada-módulo)
7. [Fluxo Entre Módulos](#7-fluxo-entre-módulos)
8. [Entidades Principais](#8-entidades-principais)
9. [Relacionamentos](#9-relacionamentos)
10. [Fluxos Internos](#10-fluxos-internos)
11. [Comunicação Entre Componentes](#11-comunicação-entre-componentes)
12. [Stack Recomendada](#12-stack-recomendada)
13. [Estrutura do Banco](#13-estrutura-do-banco)
14. [Escalabilidade](#14-escalabilidade)
15. [Segurança](#15-segurança)
16. [Permissões](#16-permissões)
17. [Auditoria](#17-auditoria)
18. [Sistema de Eventos](#18-sistema-de-eventos)
19. [Estratégia de Logs](#19-estratégia-de-logs)
20. [Roadmap Técnico](#20-roadmap-técnico)

---

## 1. Visão Geral da Plataforma

**Meta Operations OS** (nome provisório) é um sistema operacional para gestão de infraestrutura de ativos dentro do ecossistema Meta (Business Managers, contas de anúncio, pixels, páginas, perfis, domínios, VMs, proxies, etc.).

O produto **não é uma ferramenta de anúncios**. É uma camada de controle operacional que fica acima da operação de mídia paga, respondendo a três perguntas continuamente:

1. **O que existe?** — inventário vivo de todo ativo usado na operação.
2. **Quem depende de quem?** — grafo de relacionamentos entre ativos.
3. **O que fazer quando algo quebra?** — playbooks de recuperação orientados por impacto real.

O sistema se comporta como um **Head de Ad Operations digital**: monitora saúde, calcula risco, detecta incidentes, sugere o caminho de recuperação mais curto e registra tudo de forma auditável.

Projetado para operações que gerenciam de dezenas a milhares de ativos, multiempresa, multiworkspace, multiusuário, com internacionalização nativa (EN padrão, PT e ES secundários).

---

## 2. Objetivos

- Centralizar o inventário de **todo** ativo operacional Meta e de infraestrutura de suporte (VMs, browsers, proxies, VPNs) em uma única fonte de verdade.
- Modelar explicitamente as **dependências** entre ativos (grafo de relacionamento), permitindo análise de impacto antes de qualquer ativo cair.
- Detectar **risco** (ausência de backup, ausência de responsável, documentação desatualizada, criticidade não coberta) de forma proativa, antes do incidente.
- Reduzir o **tempo de recuperação** (MTTR) de qualquer ativo através de playbooks estruturados e específicos ao tipo de incidente/ativo.
- Garantir **rastreabilidade total**: todo ativo tem histórico, responsável, auditoria e eventos.
- Suportar **múltiplas empresas, workspaces e equipes** com isolamento de dados garantido a nível de banco (RLS), não só de aplicação.
- Servir como **memória institucional** da operação — o que hoje vive na cabeça de operadores e em planilhas soltas passa a viver em um sistema com relacionamento, busca e IA.

---

## 3. Filosofia de Arquitetura

### 3.1 Tudo é um Ativo (Asset-Centric Design)

O conceito central do sistema é o **Asset**. Business Manager, Pixel, Conta de Anúncio, Perfil, VM, Proxy, Domínio, Página — todos são instâncias especializadas de um conceito genérico e comum: um **Ativo** com:

`proprietário · relacionamento · dependências · histórico · score de saúde · nível de risco · criticidade · backups · documentação · auditoria · eventos · observações · created_at · updated_at · responsável`

Essa uniformidade é o que permite que Relationship Engine, Health Engine e Incident Engine operem **genericamente** sobre qualquer tipo de ativo, sem precisar de lógica especial para cada um dos 30+ tipos de entidade do domínio.

### 3.2 Class-Table Inheritance (núcleo genérico + extensão especializada)

Cada ativo tem uma linha em uma tabela genérica `assets` (dados comuns a todos) e, quando o tipo exige campos específicos, uma linha correspondente em uma tabela de extensão (`pixels`, `ad_accounts`, `business_managers`, etc.), ligada 1:1 por `asset_id`. Isso evita dois erros comuns: (a) uma tabela `assets` com 200 colunas majoritariamente nulas, ou (b) 30 tabelas desconexas sem possibilidade de consulta/grafo genérico.

### 3.3 Domain-Driven Design onde faz sentido

O domínio é dividido em **Bounded Contexts** claros (Asset Management, Relationship/Graph, Health & Risk, Incident & Recovery, Knowledge, Identity & Access, Automation). Cada contexto tem sua própria linguagem ubíqua e seus próprios agregados. DDD tático completo (agregados com invariantes rígidas, value objects) é aplicado nos contextos de maior complexidade de regras (Incident Engine, Permissões); nos contextos majoritariamente CRUD (Document Center, Settings) usamos um modelo mais simples, evitando over-engineering.

### 3.4 Event-Driven onde há desacoplamento real a ganhar

Mudanças de estado relevantes (ativo criado, ativo caiu, incidente aberto, backup ausente detectado) são publicadas como **eventos de domínio**. Módulos consumidores (Notifications, Health Engine, Audit, Automation Engine) reagem a esses eventos sem acoplamento direto ao módulo que os originou. Dado que a stack obrigatória não inclui um message broker dedicado (Kafka/SQS/RabbitMQ), o Event-Driven é implementado com **Postgres como event log + outbox pattern**, detalhado na seção 18.

### 3.5 Baixo acoplamento, alta coesão, SOLID

Cada módulo expõe uma interface de serviço clara (funções server-side, chamadas via Vercel Functions) e não acessa diretamente as tabelas de outro módulo — passa pelo serviço correspondente. Isso é convenção de código, não isolamento físico (não há microserviços separados nesta stack), mas mantém a possibilidade de extrair um módulo para um serviço próprio no futuro sem reescrita.

### 3.6 Segurança por padrão (RLS-first)

Nenhuma tabela é acessível sem política de RLS explícita. A aplicação nunca é a última linha de defesa — o banco é. Mesmo que uma rota serverless tenha um bug de autorização, o Postgres recusa a linha fora do escopo do usuário.

---

## 4. Arquitetura Completa

### 4.1 Visão em camadas

```
┌──────────────────────────────────────────────────────────────────┐
│  CLIENT LAYER                                                     │
│  React 19 + TypeScript + Vite + Tailwind v4  (SPA)                │
│  - i18n (en/pt/es)  - Design System  - Supabase Realtime client   │
└───────────────────────────────┬────────────────────────────────--┘
                                 │ HTTPS (REST/JSON)        │ WSS (Realtime)
                                 ▼                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  API LAYER — Vercel Serverless Functions (Node/TS)                │
│  /api/assets  /api/relationships  /api/incidents  /api/playbooks  │
│  /api/health  /api/copilot  /api/reports  /api/auth  /api/admin   │
│  - Validation Engine (zod)  - AuthZ middleware  - Rate limiting   │
└───────────────────────────────┬────────────────────────────────--┘
                                 │ (service-role, RLS-aware)
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│  DOMAIN SERVICE LAYER (dentro das functions, organizado por módulo)│
│  Asset Manager · Relationship Engine · Health Engine ·             │
│  Incident Engine · Recovery Engine · Playbook Engine ·             │
│  Automation Engine · AI Copilot · Notifications · Audit            │
└───────────────────────────────┬────────────────────────────────--┘
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│  DATA LAYER — Supabase                                             │
│  PostgreSQL (RLS) · Auth · Storage · Realtime · pgvector           │
│  domain_events (outbox) · audit_log (append-only) · job_queue      │
└──────────────────────────────────────────────────────────────────┘
                                 ▲
                                 │ scheduled invocation
┌──────────────────────────────────────────────────────────────────┐
│  SCHEDULER — Vercel Cron Jobs                                      │
│  Health recalculation · Event dispatch · Incident auto-detect ·   │
│  Job queue worker · Digest notifications                          │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 Princípios de comunicação

- **Frontend → Backend:** sempre via Vercel Functions (nunca acesso direto do client à Service Role Key). O client usa a `anon key` do Supabase apenas para Auth e Realtime subscriptions (protegidas por RLS).
- **Backend → Banco:** as functions usam a Service Role apenas quando a operação exige bypass controlado de RLS (ex.: jobs de sistema); nas rotas normais, propagam o JWT do usuário para que o próprio Postgres aplique RLS.
- **Módulo → Módulo:** nunca acesso cruzado a tabela alheia; sempre via função de serviço do módulo dono, ou via evento de domínio (assíncrono).

### 4.3 Multi-tenancy

Hierarquia: **Company → Workspace → Team → User**. Um usuário pode pertencer a múltiplas empresas/workspaces via tabela de `memberships` com `role`. Todo dado operacional carrega `company_id` e `workspace_id`, usados como filtro obrigatório em toda política de RLS.

---

## 5. Módulos

| # | Módulo | Camada |
|---|--------|--------|
| 1 | **Asset Manager** | Core |
| 2 | **Relationship Engine** | Core |
| 3 | **Health Engine** | Inteligência |
| 4 | **Incident Engine** | Inteligência |
| 5 | **Recovery Engine** | Inteligência |
| 6 | **Playbook Engine** | Inteligência |
| 7 | **Knowledge Base / Document Center** | Suporte |
| 8 | **AI Copilot** | Inteligência |
| 9 | **Dashboard** | Apresentação |
| 10 | **Automation Engine** | Core |
| 11 | **Validation Engine** | Transversal |
| 12 | **Reports & Analytics** | Apresentação |
| 13 | **Notifications** | Transversal |
| 14 | **Identity & Access (Users, Teams, Permissions)** | Core |
| 15 | **Settings** | Suporte |
| 16 | **Audit** | Transversal |
| 17 | **API / Integrations** | Core |
| 18 | **Workspace & Company Management** | Core |
| 19 | **Import / Onboarding Engine** | Suporte |

---

## 6. Responsabilidade de Cada Módulo

**Asset Manager** — CRUD e ciclo de vida de todo ativo (os ~30 tipos listados na visão geral). Único módulo autorizado a escrever na tabela genérica `assets` e nas tabelas de extensão. Emite eventos de domínio em toda mutação relevante.

**Relationship Engine** — mantém o grafo de dependências (`asset_relationships`). Responde a "quem depende de X" e "de que X depende" via travessia recursiva. Calcula **blast radius** (raio de impacto) de qualquer ativo antes de uma queda real ou simulada.

**Health Engine** — calcula, para cada ativo, um **health score** (0–100) e um **nível de risco** (baixo/médio/alto/crítico) com base em regras: ausência de backup, ausência de responsável, documentação desatualizada, incidentes recorrentes, criticidade declarada vs. cobertura real. Roda periodicamente (Vercel Cron) e sob demanda (ao salvar um ativo).

**Incident Engine** — abre, classifica e conduz o ciclo de vida de um incidente (`open → investigating → mitigating → resolved → closed`), vinculado a um ou mais ativos. Pode ser criado automaticamente pelo Health Engine (score cruza limiar crítico) ou manualmente por um operador.

**Recovery Engine** — dado um incidente, cruza o tipo de ativo + tipo de falha + grafo de relacionamento (blast radius) e retorna o **caminho de recuperação recomendado**: qual playbook aplicar, qual ativo de backup ativar, quem notificar.

**Playbook Engine** — CRUD de playbooks (runbooks estruturados em passos, com pré-condições, ações e critério de sucesso), reutilizáveis por tipo de ativo/incidente. Versiona playbooks e rastreia qual versão foi executada em qual incidente.

**Knowledge Base / Document Center** — repositório de documentação livre (Markdown/anexos via Supabase Storage) vinculável a qualquer ativo, empresa ou workspace. Fonte de conteúdo indexado pelo AI Copilot (embeddings via `pgvector`).

**AI Copilot** — camada conversacional (OpenAI API) com acesso de leitura ao estado do sistema (ativos, grafo, incidentes, playbooks, knowledge base) via RAG. Responde perguntas operacionais ("o que quebra se eu perder o BM 4?"), sugere próximos passos e pode propor (nunca executar sozinho) ações de recuperação.

**Dashboard** — visão consolidada de saúde geral da operação: ativos críticos sem backup, incidentes abertos, score médio por workspace, alertas recentes.

**Automation Engine** — regras "se-então" configuráveis (ex.: "se ativo tipo Pixel perder BM associado → abrir incidente P1 automaticamente"). Consome eventos de domínio e dispara ações (criar incidente, notificar, recalcular score).

**Validation Engine** — camada transversal de validação de entrada (schemas `zod` compartilhados entre frontend e Vercel Functions) e de regras de negócio (ex.: um ativo crítico não pode ser salvo sem responsável definido).

**Reports & Analytics** — relatórios agregados e exportáveis (saúde por empresa, MTTR por tipo de incidente, ativos sem backup, produtividade por operador).

**Notifications** — despacha alertas (in-app via Realtime, e-mail via provedor transacional) originados por eventos de domínio, respeitando preferências do usuário.

**Identity & Access** — usuários, times, papéis (roles) e permissões granulares; gestão de convites e membership em empresas/workspaces.

**Settings** — configurações de empresa, workspace, integrações, preferências de notificação, idioma.

**Audit** — grava e expõe o histórico imutável de toda mutação relevante do sistema (quem, o quê, quando, antes/depois).

**API / Integrations** — camada de API pública/interna (Vercel Functions) e conectores externos (ex.: Meta Graph API para leitura de status de ativos reais, quando aplicável).

**Workspace & Company Management** — criação e administração da hierarquia multiempresa/multiworkspace, billing (futuro), limites de plano.

**Import / Onboarding Engine** — importação em massa de ativos existentes (CSV/planilha) no primeiro uso, mapeando para o modelo de `assets` + extensões.

---

## 7. Fluxo Entre Módulos

Exemplo real — **um Pixel perde a conexão com o Business Manager**:

```
1. Integração/rotina detecta mudança de estado do ativo
        → Asset Manager atualiza status do Pixel
        → emite evento `asset.status_changed`

2. Automation Engine consome o evento
        → regra configurada: Pixel órfão = incidente automático
        → chama Incident Engine

3. Incident Engine cria incidente (severidade calculada)
        → consulta Relationship Engine: quem depende deste Pixel?
        → Relationship Engine retorna blast radius
          (BM 4 → 3 contas de anúncio → 12 campanhas ativas)

4. Recovery Engine recebe incidente + blast radius
        → busca Playbook Engine: playbook para "Pixel órfão"
        → retorna passos recomendados + ativo de backup, se existir

5. Notifications despacha alerta ao responsável do ativo
        (Realtime in-app + e-mail)

6. Operador executa o playbook na tela do incidente
        → cada passo concluído gera evento `playbook.step_completed`
        → Audit registra cada ação
        → Health Engine recalcula score do Pixel e ativos dependentes

7. Incidente resolvido → Health Engine reavalia risco geral do grafo
        → Dashboard e Reports refletem o novo estado
```

Esse fluxo ilustra o princípio central: **nenhum módulo decide sozinho** — Asset Manager só é dono do dado, Relationship Engine só é dono do grafo, Incident/Recovery/Playbook cooperam via eventos e chamadas de serviço explícitas.

---

## 8. Entidades Principais

### 8.1 Entidade genérica

- **Asset** (núcleo comum a todos os tipos abaixo)

### 8.2 Ativos Meta / Operacionais (extensões de Asset)

`BusinessManager · Pixel · AdAccount · Profile · ProfileBackup · Admin · Page · InstagramAccount · Domain · Event (pixel event) · Conversion · PaymentMethod · Company (entidade legal, distinta de tenancy Company) · BusinessVerification · IdentityVerification · Campaign · Creative · LandingPage · Audience`

### 8.3 Ativos de Infraestrutura (extensões de Asset)

`VirtualMachine · Browser (perfil de navegador/antidetect) · Proxy · VPN`

### 8.4 Entidades organizacionais (tenancy, não são "Asset")

`Company (tenant) · Workspace · Team · User · Membership · Role · Permission · Partner · Agency`

### 8.5 Entidades de inteligência/operação

`AssetRelationship · HealthScore · Incident · IncidentTimelineEntry · Playbook · PlaybookStep · PlaybookExecution · Document · DomainEvent · AuditLogEntry · Notification · AutomationRule · JobQueueItem`

### 8.6 Entidades de suporte

`Integration · Product · Workspace Settings`

---

## 9. Relacionamentos

### 9.1 Relacionamento organizacional (estrutural, fixo)

```
Company (tenant) 1───N Workspace 1───N Team 1───N Membership N───1 User
```

### 9.2 Relacionamento entre ativos (dinâmico, grafo dirigido)

Modelado como arestas em `asset_relationships`, não como foreign keys fixas — porque o mesmo tipo de ativo pode se relacionar com dezenas de outros tipos, e a cardinalidade é N:N.

```
Pixel ──shared_with──▶ BusinessManager
BusinessManager ──owns──▶ AdAccount
AdAccount ──runs──▶ Campaign
Campaign ──uses──▶ Creative
Campaign ──promotes──▶ LandingPage
Campaign ──targets──▶ Audience
Page ──linked_to──▶ InstagramAccount
Page ──managed_by──▶ BusinessManager
LandingPage ──hosted_on──▶ Domain
Profile ──operates──▶ BusinessManager
Profile ──backed_up_by──▶ ProfileBackup
Profile ──runs_on──▶ VirtualMachine
VirtualMachine ──uses──▶ Proxy
VirtualMachine ──uses──▶ VPN
Profile ──assigned_to──▶ User (operador)
BusinessManager ──verified_by──▶ BusinessVerification
Admin ──administers──▶ BusinessManager
```

Cada aresta tem um `relationship_type` (enum extensível) e uma direção semântica (`depends_on` vs `owns` vs `shared_with`), o que permite ao Relationship Engine diferenciar "dependência crítica" de "associação informativa" ao calcular blast radius.

### 9.3 Relacionamento de auditoria/eventos (todo ativo, transversal)

```
Asset 1───N AuditLogEntry
Asset 1───N DomainEvent
Asset 1───N HealthScore (histórico, não só o atual)
Asset N───N Incident (via IncidentAsset)
Asset 1───N Document (via DocumentAsset)
```

---

## 10. Fluxos Internos

### 10.1 Criação de um ativo

`Validation Engine` valida payload → `Asset Manager` insere em `assets` + tabela de extensão dentro de uma transação → grava `created_by`/`owner_id` → emite `asset.created` → `Health Engine` calcula score inicial → `Audit` registra criação.

### 10.2 Recalculo de saúde (scheduled)

`Vercel Cron` dispara a cada N minutos → `Health Engine` varre ativos com `updated_at` recente ou health TTL expirado → recalcula score e nível de risco → se cruzar limiar crítico, emite `asset.health_critical` → `Automation Engine` avalia regras → pode abrir incidente automaticamente.

### 10.3 Simulação de impacto ("o que quebra se eu desligar X?")

Usuário aciona no Dashboard → chamada a `Relationship Engine.getBlastRadius(assetId)` → travessia recursiva no grafo (profundidade configurável) → retorno hierárquico renderizado como árvore/mapa na UI, sem nenhuma mutação de estado (operação somente leitura).

### 10.4 Execução de Playbook

Operador abre incidente → `Recovery Engine` sugere playbook → operador aceita/ajusta → `Playbook Engine` cria `PlaybookExecution` com passos copiados do template (imutabilidade do template original) → cada passo concluído grava timestamp + operador + evidência opcional (anexo) → ao concluir todos os passos obrigatórios, incidente pode ser marcado `resolved`.

### 10.5 Consulta ao AI Copilot

Usuário pergunta em linguagem natural → API monta contexto (RAG: embeddings da Knowledge Base + snapshot resumido do grafo relevante + incidentes recentes) → chamada à OpenAI API → resposta renderizada com links diretos para os ativos/incidentes citados (nunca texto solto sem referência rastreável).

---

## 11. Comunicação Entre Componentes

| De | Para | Mecanismo |
|----|------|-----------|
| React SPA | Vercel Functions | HTTPS/JSON (REST), autenticado via JWT Supabase |
| React SPA | Supabase | Realtime (WSS) para live updates de incidentes/dashboard; Auth direto para login |
| Vercel Function | Postgres | `supabase-js` server client, RLS aplicado via JWT propagado (ou service role para jobs de sistema) |
| Módulo → Módulo (síncrono) | Chamada de função de serviço TypeScript dentro do mesmo processo/rota | in-process |
| Módulo → Módulo (assíncrono) | `domain_events` (outbox) + Vercel Cron worker | polling table, `FOR UPDATE SKIP LOCKED` |
| Sistema → Usuário | Notifications (Realtime + e-mail) | push in-app / e-mail transacional |
| Sistema → OpenAI | AI Copilot service | REST, chamada server-side apenas (chave nunca exposta ao client) |
| Sistema → Meta (futuro) | Integrations module | Meta Graph API, credenciais em Supabase Vault |

---

## 12. Stack Recomendada

> Stack obrigatória — mantida integralmente, sem propostas alternativas.

| Camada | Tecnologia | Justificativa |
|--------|-----------|----------------|
| **Frontend** | React 19 + TypeScript + Vite + Tailwind CSS v4 | SPA reativa, tipagem forte ponta a ponta, build rápido; Tailwind v4 com engine CSS-first reduz overhead de config e melhora performance de build. |
| **Backend** | Vercel Serverless Functions (Node/TS) | Deploy contínuo integrado ao GitHub, escala automática por requisição, sem gestão de servidor; adequado ao padrão de tráfego de um painel operacional (picos correlacionados a incidentes). |
| **Banco de Dados** | Supabase (PostgreSQL) | Postgres relacional suporta nativamente o modelo de grafo via CTEs recursivas, RLS para multi-tenancy real a nível de linha, extensões (`pgvector`) sem infra adicional. |
| **Auth** | Supabase Auth | Emite JWT consumido tanto pelo Postgres (RLS) quanto pelas Vercel Functions; suporta MFA e OAuth quando necessário. |
| **Storage** | Supabase Storage | Anexos de Knowledge Base, evidências de playbook, exports de relatório; políticas de acesso também via RLS-like bucket policies. |
| **Realtime** | Supabase Realtime | Dashboard e feed de incidentes atualizados ao vivo sem servidor WebSocket próprio. |
| **IA** | OpenAI API | AI Copilot (chat + sugestão de recuperação) e geração de embeddings para RAG sobre a Knowledge Base. |
| **Busca semântica** | `pgvector` (extensão Postgres, dentro do Supabase) | Não introduz novo componente de infra — busca vetorial vive no mesmo Postgres já usado como banco principal. |
| **Filas / Jobs** | Tabela `job_queue` + Vercel Cron Jobs | Sem broker dedicado na stack obrigatória; padrão "poor man's queue" com `SKIP LOCKED` é seguro e testado para o volume esperado (milhares, não milhões, de itens/dia). |
| **Cron / Agendamento** | Vercel Cron Jobs | Recalculo de saúde, dispatch de eventos, digest de notificações. |
| **Versionamento** | GitHub | Trunk-based ou GitHub Flow, PRs obrigatórios, Vercel Preview Deployments por PR. |
| **Deploy / Infra** | Vercel + Supabase | CI/CD nativo GitHub→Vercel; nenhuma infra própria para provisionar. |
| **Logs / Auditoria** | Postgres (`audit_log`, `domain_events`) + logs nativos da Vercel | Sem custo/infra adicional de observabilidade externa nesta fase; ver seção 19 para evolução. |
| **i18n** | Biblioteca de i18n para React (ex.: `react-i18next`) + conteúdo versionado por locale | EN padrão, PT e ES desde o primeiro schema de conteúdo. |

---

## 13. Estrutura do Banco

> Schema conceitual — nomes/tipos ilustrativos da arquitetura, não uma migration final.

### 13.1 Tenancy

```sql
companies(id, name, slug, plan, created_at, updated_at)
workspaces(id, company_id, name, slug, created_at, updated_at)
teams(id, workspace_id, name, created_at)
users(id, auth_user_id, email, name, locale, created_at)   -- espelha auth.users do Supabase
memberships(id, user_id, company_id, workspace_id, team_id, role, created_at)
roles(id, name, scope)                 -- Owner, Admin, Manager, Operator, Viewer, Auditor
permissions(id, role_id, module, action)  -- (module='incidents', action='resolve')
```

### 13.2 Núcleo de ativos (class-table inheritance)

```sql
assets(
  id uuid PK,
  company_id uuid FK,
  workspace_id uuid FK,
  type text,                 -- 'pixel' | 'business_manager' | 'ad_account' | ...
  name text,
  status text,                -- active | inactive | at_risk | down | archived
  criticality text,           -- low | medium | high | critical
  owner_id uuid FK -> users,
  responsible_team_id uuid FK -> teams,
  risk_level text,            -- derivado, atualizado pelo Health Engine
  metadata jsonb,             -- campos livres não estruturados
  created_at timestamptz,
  updated_at timestamptz,
  created_by uuid,
  updated_by uuid
)

-- Extensões 1:1, uma tabela por tipo (exemplos):
pixels(asset_id PK/FK -> assets.id, pixel_external_id, ...)
business_managers(asset_id PK/FK, bm_external_id, verification_status, ...)
ad_accounts(asset_id PK/FK, ad_account_external_id, currency, timezone, ...)
profiles(asset_id PK/FK, profile_type, is_backup, primary_profile_id, ...)
virtual_machines(asset_id PK/FK, provider, region, ip_address, ...)
proxies(asset_id PK/FK, proxy_type, endpoint, country, ...)
domains(asset_id PK/FK, dns_provider, registrar, expires_at, ...)
-- (mesmo padrão para: admins, pages, instagram_accounts, conversions,
--  payment_methods, business_verifications, identity_verifications,
--  campaigns, creatives, landing_pages, audiences, browsers, vpns)
```

### 13.3 Grafo de relacionamento

```sql
asset_relationships(
  id uuid PK,
  from_asset_id uuid FK -> assets.id,
  to_asset_id uuid FK -> assets.id,
  relationship_type text,      -- 'owns' | 'shared_with' | 'depends_on' | 'backed_up_by' | 'runs_on' | ...
  is_critical boolean,
  created_at timestamptz,
  created_by uuid
)
-- índice composto (from_asset_id, relationship_type) e (to_asset_id, relationship_type)
-- travessia via CTE recursiva para blast radius
```

### 13.4 Saúde, risco e incidentes

```sql
asset_health_scores(
  id uuid PK, asset_id uuid FK, score int, risk_level text,
  reasons jsonb,               -- lista de fatores que compuseram o score
  calculated_at timestamptz
)

incidents(
  id uuid PK, company_id uuid, workspace_id uuid,
  title text, severity text, status text,   -- open|investigating|mitigating|resolved|closed
  detected_by text,             -- 'automation' | 'manual'
  opened_at timestamptz, resolved_at timestamptz,
  assigned_to uuid FK -> users
)

incident_assets(incident_id FK, asset_id FK, impact_level text)
incident_timeline(id, incident_id FK, actor_id, event_type, note, created_at)
```

### 13.5 Playbooks

```sql
playbooks(id, company_id, name, applies_to_asset_type, applies_to_incident_type, version, is_active)
playbook_steps(id, playbook_id FK, order_index, title, description, action_type)
playbook_executions(id, incident_id FK, playbook_id FK, playbook_version, started_at, completed_at)
playbook_execution_steps(id, execution_id FK, step_id FK, status, completed_by, completed_at, evidence_url)
```

### 13.6 Conhecimento, eventos, auditoria, automação

```sql
documents(id, company_id, workspace_id, title, content_md, storage_path, created_by, updated_at)
document_assets(document_id FK, asset_id FK)
document_embeddings(id, document_id FK, chunk_index, embedding vector(1536))

domain_events(
  id uuid PK, aggregate_type text, aggregate_id uuid,
  event_type text, payload jsonb,
  status text,                 -- pending | processed | failed
  created_at timestamptz, processed_at timestamptz
)

audit_log(
  id uuid PK, company_id uuid, actor_id uuid,
  entity_type text, entity_id uuid, action text,   -- insert|update|delete
  before jsonb, after jsonb, created_at timestamptz
)  -- append-only, sem UPDATE/DELETE permitido via RLS

automation_rules(id, company_id, trigger_event_type, condition jsonb, action jsonb, is_active)
job_queue(id, job_type, payload jsonb, status, run_after, locked_at, attempts)
notifications(id, user_id, type, payload jsonb, read_at, created_at)
```

### 13.7 Índices e integridade

- Toda tabela com `company_id`/`workspace_id` recebe índice composto para suportar os filtros de RLS eficientemente.
- `assets(type, status, criticality)` indexado para consultas de dashboard.
- `asset_relationships` indexado nos dois sentidos (grafo bidirecionalmente consultável).
- `document_embeddings` com índice `ivfflat`/`hnsw` (pgvector) para busca semântica.
- Constraints de FK com `ON DELETE RESTRICT` em relações críticas (não se apaga silenciosamente um ativo referenciado por incidente/playbook); soft-delete (`archived_at`) preferido a hard delete em `assets`.

---

## 14. Escalabilidade

- **Multi-tenancy por linha (RLS)**, não por schema/banco — simplifica operação a milhares de empresas sem explosão de infraestrutura, ao custo de exigir políticas de RLS bem indexadas (mitigado pelos índices compostos da seção 13.7).
- **Connection pooling** via Supabase Pooler (modo transaction) nas Vercel Functions, evitando esgotamento de conexões sob picos de invocação serverless.
- **Cache de leitura** em consultas pesadas de grafo (blast radius de ativos muito conectados) via materialização periódica (`asset_impact_cache`) recalculada pelo mesmo Cron que roda o Health Engine, evitando recomputar CTEs recursivas a cada clique.
- **Paginação obrigatória** em toda listagem (assets, incidents, audit_log) — nunca full scan no client.
- **Read-heavy vs write-heavy split implícito**: dashboard e reports leem de tabelas/materializações agregadas; escrita transacional fica restrita ao Asset Manager e Incident Engine.
- **Horizontal scaling nativo**: Vercel Functions escalam por invocação; o gargalo real em alto volume é o Postgres — mitigável com read replicas do Supabase quando o plano exigir.
- **Job queue com `SKIP LOCKED`** permite múltiplos workers (múltiplas invocações de Cron/Function) processarem a fila em paralelo sem duplicar trabalho.
- Arquitetura preparada para, no futuro, extrair um módulo de alto volume (ex.: Health Engine) para um serviço dedicado sem reescrever o domínio — graças ao baixo acoplamento via serviços/eventos definido na seção 3.5.

---

## 15. Segurança

- **RLS como linha de defesa primária**: toda tabela com dado de tenant exige `company_id`/`workspace_id` da linha bater com a `membership` do usuário autenticado (JWT). Nenhuma exceção "por conveniência" no MVP.
- **Segredos e credenciais de ativos** (tokens Meta, credenciais de proxy/VM) armazenados via **Supabase Vault** (criptografia em repouso nativa), nunca em `metadata jsonb` puro.
- **Service Role Key** da Supabase usada exclusivamente em rotas server-side de sistema (jobs, migrações), nunca exposta ao client, nunca usada em rota chamada diretamente por usuário final.
- **Autenticação**: Supabase Auth (e-mail/senha + OAuth opcional), com suporte a MFA para papéis administrativos (Owner/Admin).
- **Autorização em duas camadas**: RLS no banco (garantia) + checagem de permissão explícita na Vercel Function (UX — erro claro antes de bater no banco).
- **Validação de entrada** centralizada (Validation Engine, `zod`) em toda rota, prevenindo injeção de payloads malformados antes de qualquer regra de negócio rodar.
- **Auditoria imutável** (seção 17) como controle compensatório: mesmo numa falha de autorização, a ação fica registrada e é rastreável.
- **Rate limiting** nas rotas públicas/sensíveis (ex.: AI Copilot, import em massa) para conter abuso e custo de API externa (OpenAI).
- **Isolamento de ambientes**: Preview Deployments da Vercel usam projeto Supabase de staging, nunca produção.

---

## 16. Permissões

Modelo **RBAC com escopo por workspace**, extensível a regras ABAC pontuais.

**Papéis padrão:**

| Papel | Escopo típico |
|-------|---------------|
| Owner | Empresa inteira; billing, papéis, exclusão de workspace |
| Admin | Workspace; gestão de ativos, playbooks, automação, membros |
| Manager | Workspace; aprova/atribui incidentes, edita ativos, sem gestão de membros |
| Operator | Executa playbooks, atualiza status de ativos atribuídos a si |
| Viewer | Somente leitura em dashboard/reports |
| Auditor | Somente leitura, com acesso irrestrito a `audit_log` (inclusive de outros papéis) |

**Permissões granulares** (`permissions` table) são compostas por `(module, action)`, ex.: `(incidents, resolve)`, `(assets, delete)`, `(playbooks, publish)` — permitindo criar papéis customizados por empresa sem alterar código.

Enforcement em duas camadas (banco via RLS + aplicação via middleware de rota), conforme seção 15.

---

## 17. Auditoria

- Toda mutação em tabelas designadas como "auditáveis" (`assets`, `asset_relationships`, `incidents`, `playbooks`, `memberships`, `automation_rules`) é capturada via trigger Postgres `AFTER INSERT/UPDATE/DELETE`, gravando `before`/`after` em `audit_log`.
- `audit_log` é **append-only**: política de RLS permite `INSERT` (via trigger, role de sistema) e `SELECT` (para Admin/Auditor), nunca `UPDATE`/`DELETE` por nenhum papel de aplicação.
- Cada entrada carrega `actor_id` resolvido do JWT da sessão (não confiável se vier do payload da aplicação — extraído do contexto de auth do Postgres).
- Auditoria é a fonte de verdade para o **histórico de um ativo** exibido na UI (linha do tempo "quem mudou o quê e quando"), evitando duplicar esse dado em outra tabela.
- Auditoria é retida indefinidamente (ou por política de compliance a definir por empresa); não participa de soft-delete/archival dos ativos que descreve.

---

## 18. Sistema de Eventos

Implementado como **outbox pattern sobre Postgres**, sem broker externo:

1. Toda mutação relevante de domínio, na mesma transação que grava o dado, insere uma linha em `domain_events` (`status='pending'`).
2. Um **worker** (Vercel Cron, a cada minuto ou via invocação encadeada) faz `SELECT ... FOR UPDATE SKIP LOCKED` sobre eventos pendentes, processa (despacha para os handlers interessados: Automation Engine, Notifications, Health Engine, Audit derivado) e marca `processed`/`failed`.
3. Eventos com falha reentram na fila com backoff (campo `attempts` em `job_queue`, referenciado a partir do evento quando a ação de handler é assíncrona/pesada).
4. Esse desenho dá **desacoplamento real** (o módulo que originou o evento não conhece os consumidores) e **garantia de entrega at-least-once**, suficiente para o volume esperado (não é um sistema de streaming de alto throughput).

**Eventos de domínio centrais:** `asset.created`, `asset.updated`, `asset.status_changed`, `asset.health_critical`, `relationship.created`, `relationship.removed`, `incident.opened`, `incident.escalated`, `incident.resolved`, `playbook.step_completed`, `membership.role_changed`.

---

## 19. Estratégia de Logs

- **Logs de aplicação** (execução das Vercel Functions: erros, latência, payloads rejeitados pela Validation Engine) ficam nos logs nativos da Vercel nesta fase — sem custo/infra adicional.
- **Logs de domínio/negócio** (o que importa para o usuário final: "o que aconteceu com este ativo") vivem em `audit_log` e `domain_events` — são dado de produto, não infraestrutura, e por isso residem no Postgres, consultáveis pela própria UI.
- **Separação clara de responsabilidade**: logs técnicos servem ao time de engenharia (debug, performance); `audit_log`/`domain_events` servem ao usuário final (rastreabilidade operacional) e à IA (contexto para o Copilot).
- Evolução prevista (fora do escopo desta stack obrigatória, mas compatível): se o volume de logs técnicos justificar, integrar um provedor de observabilidade externo (ex.: via integração da própria Vercel) sem impacto no modelo de dados de domínio.

---

## 20. Roadmap Técnico

> Ordem de implementação recomendada — cada fase entrega um sistema funcional e testável, não apenas partes soltas.

**Fase 0 — Fundação ✅ concluída**
Setup do projeto (Vite + TS + Tailwind v4), projeto Supabase, schema de tenancy (`companies`, `workspaces`, `memberships`) criado e provisionado — porém Supabase Auth **não** foi integrado nesta fase por decisão explícita (ver "Single Operator Mode" acima); RLS escrita e dormente; i18n (en/pt/es) configurado desde o primeiro componente.

**Fase 1 — Núcleo de Ativos ✅ concluída (Asset Manager Engine)**
`assets` genérico + catálogo `asset_types` com schema de campos em JSONB (todos os 33 tipos de uma vez, não só os prioritários — ver desvio documentado em `CLAUDE.md`), Asset Manager (CRUD completo, dinâmico por tipo), Validation Engine (zod compartilhado front/back), Audit (trigger `SECURITY DEFINER` + `audit_logs`), Asset Risk View, scores calculados síncronamente. Import/Onboarding Engine (CSV) **não** foi implementado nesta fase — fica para quando houver demanda real de importação em massa.

**Fase 2 — Grafo e Saúde (próximo módulo)**
`asset_relationships` já existe e suporta relacionamento direto (preview básico, já entregue na Fase 1); falta o Relationship Engine de verdade — travessia recursiva (CTE) para blast radius — e o Health Engine como job agendado (hoje o score recalcula síncronamente a cada mutação, não em background). Dashboard v1 de saúde/risco já existe (Asset Overview + Asset Risk View).

**Fase 3 — Incidentes e Recuperação**
Incident Engine (ciclo de vida completo), Playbook Engine (CRUD + execução), Recovery Engine (sugestão baseada em tipo + blast radius), Notifications (Realtime + e-mail), Automation Engine (regras simples evento→ação).

**Fase 4 — Conhecimento e IA**
Document Center (Storage + Markdown), `pgvector` + embeddings, AI Copilot v1 (RAG sobre knowledge base + estado do grafo), refinamento do Health Engine com base em incidentes reais acumulados.

**Fase 5 — Ativos restantes, Reports e Hardening**
Tipos de ativo remanescentes (VM, Browser, Proxy, VPN, Verification, Payment Method, Creative, Landing Page, Audience, Conversion), Reports & Analytics, revisão de performance (índices, cache de blast radius, connection pooling), revisão de segurança completa (RLS audit, Vault, rate limiting), permissões customizadas por empresa.

**Fase 6 — Escala e Integrações**
Integração real com Meta Graph API (leitura de status de ativos), API pública documentada, read replicas se justificado por volume, expansão de automação (regras compostas), observabilidade externa se necessário.

---

*Fim do documento de arquitetura. Nenhuma implementação de código deve iniciar antes da validação desta arquitetura pelo responsável do produto.*
