# Elo Marketing OS — Plano de Arquitetura

Sistema interno tipo Notion/ClickUp/Linear para a Elo Marketing. Escopo gigantesco — vou entregar em **fases** para garantir qualidade. Cada fase é navegável e usável; nada de telas vazias.

> Nota técnica: Lovable usa **TanStack Start + React + TypeScript + Tailwind v4** (não Next.js). O backend será **Lovable Cloud** (Supabase gerenciado) — entrega o mesmo que você pediu: auth, banco, storage, RLS. Vou tratar como "Cloud" no app.

---

## Stack
- TanStack Start (SSR), React 19, TypeScript estrito
- Tailwind v4 + shadcn customizado (tema dark próprio)
- Lovable Cloud (Postgres + Auth + Storage + RLS)
- TanStack Query (cache/loaders)
- Framer Motion (microinterações)
- Lucide Icons, Recharts (gráficos), dnd-kit (kanban/drag)

## Design System (definido em `src/styles.css`)
- `--background: #050505`, surfaces `#0A0A0C` / `#101014`
- `--primary: #2563EB` (azul) + `--primary-glow` neon `#3B82F6`
- `--border` cinza sutil `rgba(255,255,255,0.08)`
- Tipografia: display **Space Grotesk**, body **Inter** (carregadas via `<link>` no `__root`)
- Tokens semânticos: `--gradient-primary`, `--shadow-elegant`, `--shadow-glow`
- Variantes próprias de Button, Card, Badge, Input — zero classes hardcoded de cor
- Layout: Sidebar fixa colapsável (icon mode) + Topbar com busca global + Outlet

## Modelo de Dados (Cloud / Postgres)

```text
auth.users (gerenciado)
profiles(id→users, full_name, role_title, avatar_url, phone)
user_roles(user_id, role: admin|manager|member)  -- enum + has_role()
clients(id, name, company, segment, phone, whatsapp, email, instagram, site,
        city, state, plan, entry_date, monthly_value, owner_id, status, notes)
client_files(id, client_id, path, name, mime, size)
client_notes(id, client_id, author_id, body, created_at)
crm_leads(id, name, company, contact, source, value_expected, stage, owner_id, notes)
projects(id, client_id, name, category, start_date, deadline, status,
         description, owner_id, priority, progress)
project_members(project_id, user_id)
tasks(id, project_id?, client_id?, title, description, status, priority,
      due_date, assignee_id, parent_task_id, tags[])
task_comments(id, task_id, author_id, body)
events(id, title, type: meeting|delivery|campaign|reminder, start_at, end_at,
       client_id?, project_id?, meet_link, location, notes)
event_participants(event_id, user_id)
meetings(id, event_id, agenda, summary, status)
finance_entries(id, kind: income|expense, category, amount, due_date,
                paid_at, client_id?, description)
contracts(id, client_id, file_path, signed_at, renewal_at, value, status, notes)
campaigns(id, client_id, objective, channel: meta|google|tiktok, status,
          budget, invested, leads, cpa, ctr, cpc, roas, roi, owner_id,
          start_date, end_date, notes)
social_posts(id, client_id, format: post|story|reel|carousel, scheduled_at,
             status, assets[], owner_id, caption)
files(id, folder_id?, client_id?, path, name, mime, size, owner_id)
folders(id, parent_id?, client_id?, name)
goals(id, scope: agency|team|user, metric, target, period_start, period_end, progress)
notifications(id, user_id, kind, title, body, link, read_at)
agency_settings(id, name, logo_path, primary_color)
```

RLS em todas as tabelas. Padrão: membros autenticados leem/escrevem; admins têm escopo total via `has_role(auth.uid(),'admin')`. `user_roles` separada (nunca em profiles).

## Navegação / Rotas
```
/auth                      público (login + cadastro + reset)
/reset-password            público
/_authenticated/
  index                   Dashboard
  clients, clients/$id
  crm
  projects, projects/$id
  tasks
  calendar
  team
  finance
  contracts
  marketing
  social
  meetings
  files
  reports
  goals
  notifications
  settings
  profile
```

Layout protegido gerenciado pela integração (`ssr:false`, redireciona `/auth`).

## Fases de Entrega

**Fase 1 — Fundação (esta entrega)**
1. Habilitar Lovable Cloud
2. Migration completa de TODAS as tabelas + RLS + grants + triggers (profile on signup, updated_at)
3. Design system dark + tokens + fontes
4. Sidebar + Topbar + busca global (UI; resultados na Fase 2)
5. Auth completa (login, cadastro, reset, perfil)
6. Dashboard com KPIs reais (queries agregadas)
7. CRUD funcional: **Clientes** (lista + perfil), **Projetos**, **Tarefas (Kanban + lista)**, **CRM (pipeline drag-drop)**, **Equipe**
8. Calendário (visualização mês/semana/dia) ligado a `events`
9. Notificações (lista + badge)

**Fase 2 — Operação**
- Reuniões com ata, Financeiro completo + gráficos, Contratos (upload PDF), Marketing/Campanhas com métricas, Social Media calendar, Arquivos tipo Drive (Storage buckets)

**Fase 3 — Inteligência**
- Relatórios avançados, Metas com progresso visual, Exportações PDF/Excel, Configurações da agência, Busca global indexada, Permissões granulares

## UX / Qualidade
- Microinterações Framer Motion em cards, sidebar, modais
- Skeletons em todos os loads
- Empty states ilustrados em cada módulo
- Toasts (sonner) em ações
- Responsivo: sidebar vira drawer no mobile
- Atalhos: `⌘K` busca global, `c` cria item no contexto

## Confirmações antes de começar
Vou seguir com a **Fase 1** assim que você aprovar. Confirma:
1. Pode habilitar **Lovable Cloud** (auth + DB + storage)? 
2. Primeiro usuário cadastrado vira **admin** automaticamente — ok?
3. Login: **email/senha + Google** (padrão Cloud) — ok?

Aprovando, eu já habilito o Cloud, rodo a migration completa e entrego a Fase 1 navegável.