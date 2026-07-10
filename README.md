# CA-Aberto (CACOMP · UnB)

**O CA de Computação está aberto agora?** → [cacomp.xyz](https://cacomp.xyz)
Status em tempo real do Centro Acadêmico de Computação da UnB, reportado pela
própria comunidade via QR Codes fixados no local — sem login, sem app, sem
custo de infraestrutura.

> 🤖 **Nota de desenvolvimento:** este projeto foi inteiramente construído em
> método **vibecoding**, orquestrando os modelos **Claude Fable 5**,
> **Claude Sonnet** e **Gemini Pro** a partir de um System Design Document.
> O código é revisado por humanos, mas escrito por LLMs.

## Como funciona

Dois QR Codes estáticos impressos no CA:

| QR | Local | Aponta para | Efeito |
|----|-------|-------------|--------|
| Interno | mesa/parede dentro do CA | `qr.cacomp.xyz/open` → `/report?action=open&token=…` | reporta **ABERTO** |
| Externo | porta do CA | `qr.cacomp.xyz/close` → `/report?action=close&token=…` | reporta **FECHADO** |

Os QRs impressos codificam **short links (short.io)**, não a URL com o token:
rotacionar o token = atualizar o destino do short link via API — a arte
impressa nunca muda e o token não fica exposto no QR.

O fluxo do reporte (`src/app/report/route.ts` → `src/lib/report.ts`):

1. Valida o token estático contra variáveis de ambiente (nunca chega ao bundle do frontend).
2. Aplica rate limiting: 1 reporte a cada 20 min por hash anônimo `SHA-256(IP + salt secreto + data)` — o salt diário impede correlação entre dias.
3. Persiste o estado + log anônimo no Redis e chama `revalidatePath("/")`.
4. Redireciona para a tela de resultado (padrão redirect-after-action: recarregar não reprocessa, e o token sai da barra de endereço).

### Estratégia de cache (o coração do projeto)

A Home é **HTML estático servido da CDN da Vercel** (ISR). Nenhuma visita toca
em função serverless ou Redis. Quando um reporte legítimo é processado,
`revalidatePath("/")` invalida o cache **na hora** — comportamento de tempo
real com custo de página estática. Um `revalidate = 300` fica de rede de
segurança. Detalhes comentados no topo de `src/app/page.tsx`.

### Fechamento automático noturno

O último horário de aula noturna da UnB acaba às 22h30, então o CA fecha no
máximo ~23h normalmente. Regra (em `src/lib/auto-close.ts`):

> Fechar se **ABERTO** ∧ hora de Brasília ∈ **[00h, 07h)** ∧ **nenhum reporte
> de aberto na última hora**.

- Um cron diário da Vercel (`vercel.json`, 00h00 de Brasília) dispara a primeira avaliação — reporte de aberto entre 23h e 00h adia o fechamento.
- Como o plano Hobby limita crons a 1×/dia, as checagens seguintes (de hora em hora até as 7h) acontecem de forma *preguiçosa*, pegando carona na regeneração ISR da Home.
- O feed de transparência exibe "Fechado **automaticamente** de madrugada", distinguindo do reporte humano.

### Anti-fraude sem login

- **Rate limiting por dispositivo**: um cookie anônimo (`ca_device`, UUID aleatório, sem dado pessoal, ~180 dias) identifica o navegador que reportou, em vez de só o IP — numa wifi compartilhada (ex. rede pública da UnB), pessoas diferentes não se bloqueiam mutuamente. Janela de 15 min por dispositivo.
- **Teto frouxo por IP** (`REPORT_IP_FLOOD_CAP`, default 20/hora): rede de segurança contra scripts que não persistem cookies — não é a defesa principal, só evita flood automatizado.
- **Circuit breaker diário** (`REPORT_DAILY_CAP`, default 500/dia): protege a cota gratuita do Redis contra picos de tráfego, checado antes de qualquer outra leitura.
- **Tokens rotacionáveis**: vivem no Redis (fallback em env vars) e são trocados diariamente pelo cron das 06h — ou manualmente no `/admin`. O token anterior vale por 15 min de graça após a rotação.
- **Geofence por GPS** (toggle no `/admin`, desligado por padrão): quando ligado, abrir o link do QR/NFC pede a localização do navegador (`/report/locating`) antes de completar o reporte, só aceitando dentro de um raio (`GEOFENCE_RADIUS_METERS`, default 150m) das coordenadas do CA (`GEOFENCE_LAT`/`GEOFENCE_LNG`). Existe porque rotacionar token **não** impede alguém de reportar de qualquer lugar usando o link/QR/NFC compartilhado — o próprio propósito do link é sempre apontar pro destino válido. ⚠️ É um **dissuasor de compartilhamento casual**, não uma prova inquebrável: como o check final compara `lat`/`lng` vindos da própria URL, alguém tecnicamente sofisticado poderia forjar coordenadas fixas. Funciona em qualquer rede (inclusive dados móveis), diferente de um allowlist de IP — por isso foi a opção escolhida.
- **Histórico público**: os últimos 5 reportes anônimos aparecem na Home — a comunidade vê se alguém trollou e corrige escaneando o QR verdadeiro.

### Painel /admin

Página fechada por HTTP Basic Auth (`ADMIN_USER`/`ADMIN_PASSWORD` no
middleware; sem senha configurada, responde 503). Nela dá para:

- Ver os QR Codes atuais (SVG inline + download em PNG/SVG) — codificando os short links, estáveis entre rotações.
- **Rotacionar tokens agora**: gera par novo, atualiza o destino dos short links no short.io e só então persiste (se o short.io falhar, nada muda e os QRs continuam válidos).
- **Sincronizar short links**: recria/atualiza os links para os tokens atuais (primeiro setup ou reparo).
- **Ligar/desligar verificação de localização**: liga o geofence por GPS descrito acima. Fica desligado por padrão — bom para testar o fluxo de fora do CA (inclusive em casa) sem restrição; ligue só quando for operar de verdade no local.

### Vercel: proteções gratuitas contra DDoS/flood

Antes de divulgar o link publicamente, vale ativar manualmente o
**Attack Challenge Mode** no dashboard da Vercel (Project → Firewall) —
gratuito em todos os planos, desafia tráfego suspeito antes dele chegar
no app, e não conta pra cota de uso. A mitigação DDoS L3/L4/L7 já é
automática e gratuita sem nenhuma configuração. A arquitetura do projeto
já ajuda: a Home é estática (servida da CDN, zero função por visita);
só `/report`, `/admin` e os 2 crons tocam função serverless + Redis.

### NFC: atalho de toque (tags NTAG215)

As tags NFC usadas (**NTAG215**) são chips de memória NDEF simples, sem
criptografia própria (isso só existiria em chips como NTAG 424 DNA, com
recurso SUN/SDM de token rotativo por toque — não é o que foi comprado).
Isso significa que tocar a tag é **tecnicamente equivalente a escanear o
QR**: ela guarda o mesmo short link estático, lido sempre igual. Toda a
segurança contra abuso vem das camadas do endpoint `/report` descritas
acima (rate-limit por device, geofence etc.), que valem igualmente para
quem chega via QR ou via toque — não há código de verificação específico
pra tag.

Provisionamento (manual, sem código):
1. Pegue o short link final de cada ação no `/admin` (ex.: `report.cacomp.xyz/open`, `/close`).
2. Grave cada link numa tag com um app de celular (ex.: "NFC Tools", Android/iOS) como registro NDEF do tipo URI.
3. Cole cada tag na plaquinha correspondente — mesma topologia dos QRs (aberto dentro do CA, fechado na porta).

Como a tag nunca muda, ela se beneficia automaticamente de qualquer
melhoria futura nas proteções do endpoint (geofence, rate-limit), sem
precisar regravar nada. Proteção própria da tag (per-toque, criptográfica)
exigiria comprar tags NTAG 424 DNA à parte.

## Interface

- Mobile-first: a cor da tela inteira é o status (verde = aberto, vermelho escuro = fechado).
- Status em **Monaspace Neon** (variável, com *texture healing* via feature OpenType `calt`) com efeito de placa de neon em camadas de `text-shadow`.
- Fonte padrão **Inter SemiBold** (variável), ambas self-hosted via `next/font`.
- GIF aleatório do GIPHY abaixo do status (*thumbs up*/*thumbs down* conforme o estado, `rating=g` filtra conteúdo impróprio); o GIF troca a cada regeneração da página e some silenciosamente se a API falhar.
- "Atualizado há X minutos" calculado no navegador (`TimeAgo`), porque o HTML estático congelaria o relógio.

## Stack

Next.js 15 (App Router) · TailwindCSS v4 · Redis (aceita `REDIS_URL` nativo ou
REST `KV_REST_*`/`UPSTASH_*`, ver `src/lib/store.ts`) · Vercel Hobby (deploy,
CDN, cron).

## Estrutura

```
src/
├── app/
│   ├── layout.tsx               # Fontes (next/font) + shell HTML
│   ├── globals.css              # Tailwind v4, tema, .neon-text, .texture-healing
│   ├── page.tsx                 # Home estática (ISR on-demand) + auto-close preguiçoso
│   ├── report/
│   │   ├── route.ts             # GET do QR/NFC: cookie de device, geofence, processa e redireciona (PRG)
│   │   ├── locating/page.tsx    # Tela client-side que pede GPS quando o geofence está ligado
│   │   └── result/page.tsx      # Tela "Obrigado!" / "Calma lá!" / "Fora do local" / etc.
│   ├── admin/
│   │   ├── page.tsx             # Painel: QRs, tokens, rotação, toggle de geofence (Basic Auth)
│   │   └── actions.ts           # Server Actions: rotacionar / sincronizar / ligar-desligar geofence
│   └── api/cron/
│       ├── auto-close/route.ts  # Cron 00h: fechamento automático noturno
│       └── rotate-tokens/route.ts # Cron 06h: rotação diária de tokens
├── middleware.ts                # Basic Auth do /admin
├── components/
│   ├── TimeAgo.tsx              # "há X minutos" no cliente
│   └── RedirectHome.tsx         # Volta à Home 3s após o reporte
└── lib/
    ├── types.ts                 # Schema (CaState, ReportEntry)
    ├── store.ts                 # Abstração Redis (REST ou cliente nativo) + storeIncrWithTTL
    ├── status.ts                # Estado atual + histórico
    ├── rate-limit.ts            # Rate-limit por device (cookie) + teto frouxo por IP
    ├── geofence.ts              # Toggle de geofence + distância Haversine
    ├── report.ts                # Cap diário → token → flood → device → geofence → persiste → revalida
    ├── tokens.ts                # Tokens rotacionáveis no Redis (fallback env)
    ├── shortlink.ts             # Cliente short.io (criar/atualizar short links)
    ├── rotate.ts                # Orquestra rotação: short.io primeiro, Redis depois
    ├── auto-close.ts            # Regra do fechamento automático noturno
    └── gif.ts                   # GIF aleatório do GIPHY (rating g)
scripts/
└── generate-qr.mjs              # Gera os PNGs dos QR Codes (dev e produção)
```

## Rodando localmente

```bash
cp .env.example .env.local   # preencha tokens, salt, GIPHY_API_KEY, CRON_SECRET
npm install
npm run dev
```

Sem Redis configurado, o app degrada graciosamente: status FECHADO, feed
vazio, reportes aceitos sem persistir — suficiente para desenvolver a UI.

Para testar no celular (mesma rede Wi-Fi):

```bash
npm run generate-qr -- --host=SEU_IP_LOCAL:3000
```

## Gerando os QR Codes de produção

O jeito recomendado é pelo **`/admin`** (QRs dos short links, estáveis entre
rotações). O script continua disponível para QRs de URL direta:

```bash
npm run generate-qr:prod   # aponta para https://cacomp.xyz
```

Os PNGs vão para `qrcodes/` (gitignored — as URLs embutem os tokens secretos;
nunca versione nem use geradores de QR online com eles).

## Release & deploy

Segue **semver** (`major.minor.patch`, versão em `package.json`):

- **`main`** → deploy de preview em [cacomp-aberto.vercel.app](https://cacomp-aberto.vercel.app). É a branch padrão do repo (onde o desenvolvimento acontece).
- **`release`** → produção em [cacomp.xyz](https://cacomp.xyz). Só deploya com novo commit nessa branch. Na Vercel, é a "Production Branch" do projeto (Settings → Git), domínio `cacomp.xyz` atribuído à produção — os crons rodam sobre esse deploy. `main` ser a branch padrão do GitHub e `release` ser a branch de produção da Vercel são coisas independentes; não precisam coincidir.

Fluxo: desenvolva em `main` → valide no preview → abra um PR de `main` para
`release` → adicione **uma label** (`major`, `minor` ou `patch`) indicando o
tamanho da mudança → merge. A partir daí, dois workflows do GitHub Actions
(`.github/workflows/`) cuidam do resto:

1. **`release-label-check.yml`** — bloqueia o PR (status check vermelho) se
   ele não tiver exatamente uma das labels `major`/`minor`/`patch`.
2. **`release-tag.yml`** — dispara no merge: calcula a nova versão a partir
   da label, atualiza `package.json`, cria e empurra a tag `vX.Y.Z`, publica
   uma GitHub Release com changelog automático (PRs desde a última tag), e
   abre um PR pequeno de `release` → `main` só com o bump de versão (evita
   conflito de `version` no próximo PR).

A única decisão manual que resta é escolher a label (major/minor/patch); tag,
versão e changelog são 100% automáticos a partir daí.

## Variáveis de ambiente

| Variável | Uso |
|----------|-----|
| `REPORT_TOKEN_INTERNAL` | Token inicial do QR interno (`action=open`) — vira fallback após a 1ª rotação |
| `REPORT_TOKEN_EXTERNAL` | Token inicial do QR externo (`action=close`) — idem |
| `IP_HASH_SALT` | Salt do hash anônimo de IP (rate limiting) |
| `REDIS_URL` *(ou `KV_REST_API_URL`+`KV_REST_API_TOKEN`)* | Conexão com o Redis |
| `GIPHY_API_KEY` | Chave gratuita do GIPHY (sem ela, a Home só omite o GIF) |
| `CRON_SECRET` | Autoriza os dois crons (a Vercel envia `Authorization: Bearer`) |
| `ADMIN_USER` / `ADMIN_PASSWORD` | Basic Auth do `/admin` (sem senha → 503) |
| `SHORTIO_API_KEY` + `SHORTIO_DOMAIN` | API do short.io (secret key + domínio de encurtamento, ex. `report.cacomp.xyz` — links fixos em `/open` e `/close`) |
| `SITE_URL` | URL pública usada como destino dos short links (`https://cacomp.xyz`) |
| `REPORT_DAILY_CAP` | Teto de requisições/dia a `/report` antes de qualquer leitura extra no Redis (default 500) |
| `REPORT_IP_FLOOD_CAP` | Teto frouxo de reportes/hora por hash de IP, rede de segurança contra scripts (default 20) |
| `GEOFENCE_LAT` / `GEOFENCE_LNG` / `GEOFENCE_RADIUS_METERS` | Coordenadas do CA e raio em metros para o geofence por GPS (liga/desliga é um toggle no `/admin`, não env var) |

Em produção, configure todas no dashboard da Vercel — o Redis do Marketplace
injeta `REDIS_URL` sozinho; as demais são manuais.
