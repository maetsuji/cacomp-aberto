# CA-Aberto (CACOMP · UnB)

![cacomp.xyz](/public/cacomp_xyz.gif)
**O CA de Computação está aberto agora?** → [cacomp.xyz](https://cacomp.xyz) · [Preview](https://cacomp-aberto.vercel.app)

Status em tempo real do Centro Acadêmico de Computação da UnB, reportado pela comunidade via QR Codes fixados no local. Fácil de usar e rápido de consultar!

> 🤖 Este projeto foi construído (quase) inteiramente em **vibecoding** com Claude (Fable 5, Sonnet) a partir de um System Design Document.

> 🎨 Os assets de arte (exceto fontes e GIFs) utilizados no projeto foram feitos por mim, no Figma!

## Quick Start

```bash
cp .env.example .env.local    # preencha GIPHY_API_KEY, tokens, etc.
docker compose up -d           # Redis local (opcional — sem ele nada persiste)
npm install
npm run dev                    # localhost:3000
```

Sem Redis: app degrada graciosamente (status FECHADO, feed vazio, reportes sem persistência). Detalhes do dev local em [docs/DEV.md](docs/DEV.md).

Para testar no celular (mesma rede): `npm run generate-qr -- --host=SEU_IP_LOCAL:3000`

## Como funciona

**Dois QR Codes impressos no CA:** interno (aberto) e externo (fechado). Codificam short links (short.io) — rotacionar o token só muda o destino do link, a arte nunca muda.

Fluxo do reporte: **validação token** → **rate-limit anônimo** → **persiste estado no Redis** → **revalida Home na hora**.

### 🔄 Estratégia de cache

Home é **HTML estático na CDN** (ISR). Nenhuma visita toca serverless/Redis normalmente. Quando um reporte é processado, `revalidatePath("/")` invalida o cache **instantaneamente** — tempo real com custo de página estática.

### 🌙 Fechamento automático noturno

Regra: fechar se ABERTO ∧ horário Brasília ∈ [00h, 07h) ∧ nenhum reporte de aberto na última hora. Cron diário avalia, depois checagens preguiçosas pegam carona na regeneração ISR.

### 🔒 Anti-fraude sem login

- **Rate-limit por device** (cookie UUID, janela ajustável no `/admin` — default 15 min) — não bloqueia múltiplos usuários na mesma WiFi
- **Teto frouxo por IP** (20/hora) — rede de segurança contra bots
- **Circuit breaker diário** (500 reportes) — protege cota Redis
- **Tokens rotativos** (Redis/env vars) — trocados diariamente, último vale 15 min de graça
- **Geofence GPS** (toggle `/admin`) — dissuasor de compartilhamento (não é prova inquebrável)
- **Histórico público** — comunidade vê trolls, corrige escaneando o QR verdadeiro

### ⚙️ Painel /admin

Tela de login própria (sessão assinada de 12h, botão Sair) — mesmas credenciais `ADMIN_USER`/`ADMIN_PASSWORD`. Funcionalidades:

- QR Codes atuais (SVG inline, PNG/SVG download)
- **Rotacionar tokens** agora (atualiza short.io, persiste se sucesso)
- **Sincronizar short links** (primeiro setup ou reparo)
- **Toggle geofence** (desligado por padrão, bom pra testar em casa)
- **Toggle + slider de rate limit** (janela por device de 1–60 min; desligável para testes)
- **Tab Aparência**: cores dos blobs, flicker de neon e fundo de tijolo (preview ao vivo, revalida Home na hora)

### 🏠 NFC (tags NTAG215)

Chips simples sem criptografia = tecnicamente equivalente ao QR. Provisionamento manual: copiar short link no `/admin`, gravar em tag com "NFC Tools" (Android/iOS), colar na plaquinha. Beneficia-se automaticamente de melhorias de segurança no endpoint.

### 🛡️ Vercel: proteções contra DDoS/flood

Ativar manualmente **Attack Challenge Mode** no dashboard (Project → Firewall). Mitigação L3/L4/L7 é automática. Arquitetura ajuda: Home estática (CDN), só `/report`, `/admin` e 2 crons tocam serverless.

## Interface

- 🎨 Mobile-first: cor da tela = estado (verde ABERTO, vermelho FECHADO)
- 🧱 **Fundo de tijolo** — textura de parede da UnB atrás dos blobs, opacidade do véu ajustável no `/admin`
- 🔄 **Favicon dinâmico** — muda em tempo real conforme estado (consulta Redis sem esperar ISR)
- 💄 **Status em Tilt Neon** — glifos de neon com perspectiva + text-shadow multicamadas
- ✍️ **Inter SemiBold** padrão, ambas self-hosted via `next/font`
- 🎬 **GIF aleatório GIPHY** (*thumbs up*/*thumbs down*) abaixo do status
- ⏰ **"Atualizado há X min"** calculado no cliente (HTML estático não congela relógio)

## Stack

**Next.js 15** (App Router) · **TailwindCSS v4** · **Redis** (Vercel KV ou REST) · **Vercel Hobby** (deploy, CDN, cron)

## Deploy

Semver automático com GitHub Actions:

1. Desenvolva em `main` → valide no preview
2. Abra PR `main` → `release` com label (`major` / `minor` / `patch`)
3. Merge → automação: calcula versão, cria tag `vX.Y.Z`, publica GitHub Release, abre PR `release` → `main` (sync versão)

Vercel detecta commit em `release` → deploy automático para [cacomp.xyz](https://cacomp.xyz).

## Variáveis de ambiente

| Variável | Uso |
|----------|-----|
| `REPORT_TOKEN_INTERNAL` / `EXTERNAL` | QR codes (fallback após 1ª rotação) |
| `IP_HASH_SALT` | Hash anônimo de IP (rate-limit) |
| `REDIS_URL` | Vercel KV ou Redis nativo |
| `GIPHY_API_KEY` | GIF aleatório (opcional) |
| `CRON_SECRET` | Autoriza crons |
| `ADMIN_USER` / `ADMIN_PASSWORD` | Login do `/admin` (sessão própria) |
| `SHORTIO_API_KEY` + `SHORTIO_DOMAIN` | Short links para QRs |
| `SITE_URL` | URL pública dos short links |
| `REPORT_DAILY_CAP` | Teto reportes/dia (default 500) |
| `REPORT_IP_FLOOD_CAP` | Teto reportes/hora por IP (default 20) |
| `GEOFENCE_LAT` / `LNG` / `RADIUS_METERS` | Coordenadas CA + raio GPS |

Em produção: configure no dashboard Vercel (Marketplace injeta `REDIS_URL` automaticamente).

## Links úteis

- [Mapa da arquitetura](docs/ARCHITECTURE.md) — rotas, módulos, padrões do código
- [Guia de dev local](docs/DEV.md) — Redis via Docker Compose, o que funciona em DES
- [System Design Document](https://www.notion.so) — arquitetura, decisões
- [Discussões GitHub](https://github.com/maetsuji/cacomp-aberto/discussions) — ideias, feedback
- [@maetsuji](https://github.com/maetsuji) — author
