# Roadmap — features futuras

Design das próximas features, com as decisões de arquitetura já tomadas.
Cada seção vira um plano de implementação próprio quando chegar a vez.
Contexto do código atual: ver [ARCHITECTURE.md](ARCHITECTURE.md).

---

## F1 — Bot WhatsApp

**Objetivo**: (a) postar num grupo sempre que o status do CACOMP mudar;
(b) responder quando alguém mencionar o bot perguntando se está aberto.

**Decisão**: Baileys (biblioteca não-oficial) — a Cloud API oficial da
Meta não entra em grupos. Implicações aceitas: processo Node rodando
24/7 fora da Vercel (Fly.io/Railway/VPS/Raspberry no próprio CA) e
**número dedicado** (chip novo; risco pequeno de ban existe — nunca usar
número pessoal).

### Lado do site (este repo — pode ser feito já, antes do bot)

1. **`/api/status`** (route handler novo): JSON público
   `{ status, since, last_report_at }` com `Cache-Control: s-maxage=30`.
   Reusa `getCaState()` de `src/lib/status.ts`. É o que o bot consulta
   pra responder menções.
2. **Webhook de transição**: quando o status MUDA (ABERTO↔FECHADO, não a
   cada reporte), POST fire-and-forget pra `STATUS_WEBHOOK_URL` com
   assinatura HMAC (`STATUS_WEBHOOK_SECRET`; mesmo padrão Web Crypto de
   `src/lib/admin-session.ts`). **O ponto de disparo já existe**: o
   despachante `src/lib/on-transition.ts` (criado pro /stats e pro Web
   Push) — é só adicionar o POST lá, dentro de `after()`. Timeout curto,
   falha silenciosa — o site nunca depende do bot.

### Lado do bot (repo novo, ex. `cacomp-bot`)

- Node + Baileys, sessão persistida em volume/disco.
- **Push**: recebe o webhook → posta nos grupos configurados
  ("🟢 O CA abriu (14h32)"). Debounce de 5 min contra flip-flop.
- **Menção**: escuta @bot ou regex `ca.*abert` no grupo →
  GET `/api/status` → responde.
- Config: JIDs dos grupos, allowlist, segredo do webhook.

---

## F2 — Mural do CACOMP (posts, cargos, feed)

**Objetivo**: portal de notícias/classificados da gestão, embutido na
Home sem atrapalhar a jornada principal (ver status em 2 segundos).

### Viabilidade no Redis free tier (256 MB, ~500K comandos/mês)

- **Markdown é texto**: 2–10 KB/post × centenas de posts = poucos MB.
  Tranquilo.
- **Imagens NUNCA no Redis** (base64 explode storage e banda): upload
  vai pro **Vercel Blob** (cota gratuita no Hobby ~1 GB); o Redis guarda
  só a URL.
- **O risco real é leitura por visitante**: o feed é servido por
  `/api/feed` com cache CDN (`s-maxage=60, stale-while-revalidate`) +
  revalidação on-demand ao publicar — leitura de visitante ≈ 0 comando
  Redis (mesma filosofia ISR da Home). Escritas são raras por natureza.
- **Veredito: viável**, seguindo a regra imagem→Blob e leitura→CDN.

### Auth e contas (fase 2a)

- **Auth.js (NextAuth v5)**: providers Google OAuth + Credentials
  (email+senha, hash bcrypt/argon2), sessão JWT (sem adapter de DB).
- Modelo no Redis:
  - `ca:user:{id}` — **id ULID imutável (PK interna)**: email,
    passwordHash?, googleId?, username, nickname, role
    (`user`|`gestao`), created_at.
  - Índices: `ca:username:{username}` → id, `ca:email:{email}` → id,
    `ca:users:index` (listagem/busca do admin).
- **Cargo/permissões pendurados no id, nunca no username** → trocar
  username não toca permissões. A troca é atômica: lock → SETNX no
  índice novo → DEL do antigo.
- **Onboarding**: pós-cadastro (qualquer provider), tela obrigatória de
  escolher username único + nickname.
- **Tela de conta** (substitui o botão de login quando logado): editar
  nickname, trocar username (com confirmação), trocar senha (só quem é
  credentials), logout.
- **Aba "Usuários" no /admin**: lista paginada + busca; atribuir/remover
  o cargo gestão.

### Permissões

| Ação | user | gestão | admin |
|------|------|--------|-------|
| curtir, comentar | ✅ | ✅ | ✅ |
| editar próprios comentários | ✅ | ✅ | ✅ |
| publicar post; editar/apagar os próprios | — | ✅ | ✅ |
| apagar qualquer post/comentário | — | — | ✅ |

Admin modera numa **aba FEED do /admin** que replica o feed com os
controles extras (apagar qualquer coisa, publicar, comentar).

### UI/UX

- **Greeting personalizado**: logado, o usuário vê
  "olá {nickname}, o CACOMP está:" acima do ABERTO/FECHADO.
  Client-side (componente que lê a sessão no navegador) pra não quebrar
  a Home estática: o HTML da CDN segue igual pra todos e o greeting
  hidrata depois; sem sessão, não renderiza nada.
- **Botão liquid glass discreto** no rodapé da Home → `/login` (longe da
  jornada principal).
- **Feed liquid glass** abaixo do hint text. Ao scrollar, a seção
  "Últimos reportes" encolhe gradualmente (CSS scroll-driven animations,
  `animation-timeline: scroll()`, fallback IntersectionObserver) até
  restar só o último reporte + horário — abrindo espaço pro feed.
- **Post abre inline** na própria div do feed (client state); aba de
  comentários dentro da mesma área — sem navegação nem refresh.
- Markdown renderizado com `react-markdown` + sanitização; imagens via
  Vercel Blob.
- Chaves: `ca:feed:posts` (ids), `ca:feed:post:{id}`,
  `ca:feed:comments:{postId}`, `ca:feed:likes:{postId}` (set de
  userIds).

### Fases de entrega

2a auth+contas+aba usuários → 2b posts CRUD da gestão + feed leitura →
2c likes + comentários inline → 2d aba FEED do admin → 2e transição de
scroll + polish.

---

## F3 — GIFs sazonais em datas comemorativas

**Objetivo**: perto de (e em) datas especiais brasileiras, a busca do
GIF da Home vira "data + thumbs up/down" — ex. `christmas thumbs down`,
`easter thumbs up`, `halloween thumbs up`.

- **Tabela curada** em `src/lib/holidays.ts`, seed feita da Wikipédia
  ("Feriados no Brasil" + datas comemorativas) UMA VEZ na implementação
  — não em runtime (scraping em runtime é frágil, lento e desnecessário:
  a lista quase nunca muda).
- **Datas móveis via Computus**: calcula a Páscoa de qualquer ano →
  Carnaval = Páscoa − 47d, Corpus Christi = Páscoa + 60d. Zero
  manutenção anual.
- `getSeasonalTerm(now)`: janela configurável (default 7 dias antes até
  o próprio dia) → termo em inglês pro GIPHY (`christmas`, `easter`,
  `halloween`, `carnival`, `new year`, `festa junina`…).
- `src/lib/gif.ts`: dentro da janela, a query vira
  `"${termo} thumbs up|down"`; busca sazonal sem resultado → fallback
  pra busca normal (nunca quebra a Home).
- Opcional: preview/override do termo sazonal na aba Aparência do
  /admin.

---

## F4 — Escala da gestão no /stats (overlay de previsão)

Evolução do gráfico semanal já existente em `/stats`: a gestão envia uma
tabela de horários em que os portadores da chave estarão disponíveis
para abrir o CA, e o gráfico ganha um **overlay hachurado** de "previsto
aberto" sobre as janelas reais.

- Dados: `ca:schedule:{isoWeek}` — lista de janelas previstas por dia,
  editada numa tela da gestão (depende dos cargos do F2).
- O CSV de export (`/admin/export`) vira também o formato de import da
  escala (mesmas colunas, sem `duration_min`).
- Leitura no `/stats`: mesma `collect()` de `src/lib/intervals.ts`,
  segunda camada de segmentos com estilo tracejado/outline.
