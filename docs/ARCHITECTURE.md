# Arquitetura — mapa do código

Guia rápido pro mantenedor. O README explica *o que* o projeto faz; aqui é
*onde* cada coisa vive e *por que* está organizada assim.

## Rotas (`src/app/`)

| Rota | Tipo | O que faz |
|------|------|-----------|
| `/` | Estática (ISR, `revalidate = 300`) | Home: status ABERTO/FECHADO, GIF, feed dos últimos reportes, botão 🔔 de push |
| `/stats` | Estática (ISR, `revalidate = 300`) | Gráfico da semana (dom→sáb): janelas verdes nos períodos abertos |
| `/report` | Route handler (GET) | Destino dos QR/NFC: valida token, rate-limit, persiste estado, revalida Home e /stats |
| `/report/locating` | Estática | Tela intermediária que pede GPS quando o geofence está ligado |
| `/report/result` | Dinâmica | Resultado do reporte (padrão POST/Redirect/GET) |
| `/admin` | Dinâmica | Painel: QRs, tokens, toggles (geofence, rate limit), slider da janela |
| `/admin/login` | Dinâmica | Tela de login (única rota sob `/admin` liberada pelo middleware sem sessão) |
| `/admin/aparencia` | Dinâmica | Editores visuais: cores dos blobs, flicker de neon, fundo de tijolo |
| `/admin/export` | Route handler (GET) | CSV do histórico de abertura (`?weeks=1..12`) — protegido pela sessão |
| `/api/icon` | Route handler (GET, force-dynamic) | Favicon dinâmico: PNG verde/vermelho conforme o estado no Redis |
| `/api/og` | Route handler (GET, force-dynamic) | OG image 1200×630: preview do link mostra ABERTO/FECHADO ao vivo |
| `/api/health` | Route handler (GET, force-dynamic) | 200/503 conforme o Redis responde — alvo do monitor de uptime |
| `/api/push/subscribe` | Route handler (POST/DELETE) | Registra/remove assinaturas de Web Push |
| `/api/cron/*` | Route handlers (Bearer `CRON_SECRET`) | `rotate-tokens` (06h) e `auto-close` (madrugada), agendados no `vercel.json` |

Mutations do admin são **Server Actions** (`admin/actions.ts`,
`admin/login/actions.ts`), não rotas de API. Padrão de toda action: ler/validar
`FormData` → chamar o `set*` do módulo em `lib/` → `revalidatePath("/")` +
`revalidatePath("/admin/...")` → `redirect` com `?msg=` (flash message).

## Módulos (`src/lib/`)

| Módulo | Responsabilidade |
|--------|------------------|
| `store.ts` | Abstração Redis (Vercel KV REST ou `REDIS_URL`); todo acesso a dados passa aqui |
| `types.ts` | Modelo de dados (`CaStatus`, `CaState`) |
| `status.ts` | Estado vigente + histórico de reportes; dispara o despachante quando o status MUDA |
| `on-transition.ts` | Despachante de transições: fan-out de efeitos (intervalos, push; futuro: webhook do bot) |
| `intervals.ts` | Períodos de abertura por dia de Brasília (`ca:intervals:*`) — base do /stats e do CSV |
| `push.ts` | Web Push: assinaturas no Redis + envio com poda de subs mortas |
| `report.ts` | `processReport()`: o fluxo completo de um reporte (ordem dos checks abaixo) |
| `tokens.ts` | Tokens rotativos dos QRs (Redis, fallback pra env vars) |
| `rotate.ts` | Orquestra rotação de token + resync dos short links |
| `shortlink.ts` | Integração short.io (QRs impressos apontam pra links estáveis) |
| `rate-limit.ts` | Rate-limit por device (lock TTL) e por IP (contador), toggle e janela ajustável |
| `geofence.ts` | Toggle + checagem de proximidade GPS (haversine) |
| `auto-close.ts` | Fechamento automático noturno (cron + checagem preguiçosa na ISR) |
| `admin-session.ts` | Sessão do `/admin`: token HMAC-SHA256 via Web Crypto (Edge-safe) |
| `blob-theme.ts` · `flicker-settings.ts` · `background-settings.ts` | Configs visuais da Home (Redis) |
| `*-limits.ts` (flicker, background, rate-limit) | Faixas min/max/step dos sliders — ver padrão abaixo |
| `gif.ts` | GIF aleatório do GIPHY |

## Padrões do projeto

### Par `*-settings.ts` / `*-limits.ts`

Os editores do admin são Client Components e precisam das faixas dos sliders.
Mas os `*-settings.ts` importam `./store` → pacote `redis` (Node-only): importar
qualquer **valor** deles num Client Component faria o webpack tentar empacotar
`redis`/`net` pro navegador. Por isso as constantes ficam num arquivo separado
sem dependências (`*-limits.ts`), que o `*-settings.ts` re-exporta pro lado
server. Ao criar uma config nova com slider, siga o par.

### Configs no Redis (chaves `ca:*`)

Cada config é uma chave própria gerida por um módulo pequeno em `lib/` com
`get*/set*/reset*` (reset grava `null`; o getter sanitiza campo a campo e cai
nos defaults). Inventário:

- `ca:status` · `ca:history` — estado e histórico (status.ts)
- `ca:report-tokens` · `ca:shortlinks:shortio` — tokens e links (tokens/shortlink)
- `ca:blob-theme` · `ca:flicker-settings` · `ca:background-settings` — aparência
- `ca:geofence-enabled` · `ca:ratelimit-disabled` · `ca:ratelimit-window-minutes` — toggles/ajustes
- `ca:report-count` — circuit breaker diário
- `ca:ratelimit:device:{id}` · `ca:ratelimit:ipflood:{hash}` · `ca:admin-login-fail:{hash}` — janelas de rate-limit
- `ca:auto-close-lock` — lock do fechamento noturno
- `ca:intervals:{YYYY-MM-DD}` (TTL 90d) · `ca:intervals:open-since` — períodos de abertura (/stats, CSV)
- `ca:push:subs` — assinaturas de Web Push

### Despachante de transições

`setCaState` (status.ts) lê o estado anterior antes de gravar; quando o
status MUDA de fato (reporte repetido não conta), chama
`onStatusTransition` (on-transition.ts): registra o intervalo pro /stats
e, na abertura, envia Web Push via `after()` — fora do caminho crítico.
Atenção: `setCaState` roda também **durante render ISR** (auto-close
preguiçoso na Home), então o despachante nunca chama `revalidatePath`
— quem revalida é o `processReport` (contexto de route handler).

### Fail-open vs fail-closed

Sem Redis configurado (dev local), tudo **degrada graciosamente** (fail-open):
rate-limits liberam, toggles ficam no default, configs visuais usam os padrões.
A exceção deliberada é `ADMIN_PASSWORD`: sem ela, o middleware responde **503
pra todo o `/admin`, inclusive a tela de login** (fail-closed — nunca aberto
por omissão).

### O coração: ISR + revalidação on-demand

A Home é HTML estático na CDN — visita nenhuma toca serverless/Redis. Quando
algo muda (reporte processado, config salva no admin), `revalidatePath("/")`
invalida o cache na hora. Resultado: tempo real percebido com custo de página
estática. O `revalidate = 300` é só rede de segurança.

### Fluxo do reporte (`processReport`, ordem "mais barato primeiro")

1. Circuit breaker diário (`ca:report-count` vs `REPORT_DAILY_CAP`) — sempre ativo
2. Validação do token rotativo
3. Teto por IP (20/h) — pulado se o rate limit estiver desligado no admin
4. Rate-limit por device (janela ajustável, default 15 min) — idem
5. Geofence GPS, se ligado no admin
6. Persiste estado + log anônimo, `revalidatePath("/")`

### Sessão do `/admin`

Login em `/admin/login` confere `ADMIN_USER`/`ADMIN_PASSWORD` (env) e grava
cookie HttpOnly de 12h: `"<exp>.<HMAC-SHA256>"` assinado com chave derivada do
próprio `ADMIN_PASSWORD` — sem segredo novo, sem sessão no Redis (dev local
funciona sem store). O middleware (runtime **Edge** — por isso Web Crypto, não
`node:crypto`) valida assinatura + expiração a cada request. Força bruta:
5 falhas/IP em 15 min bloqueiam (fail-open sem Redis).
