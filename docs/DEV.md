# Dev local — guia de DES

Como rodar o projeto na sua máquina e o que esperar de cada feature sem a
infra de produção (Vercel + KV + short.io).

## Setup

```bash
cp .env.example .env.local   # preencha ao menos ADMIN_USER/ADMIN_PASSWORD
docker compose up -d         # Redis local (porta 6379, dados persistem em volume)
npm install
npm run dev                  # localhost:3000
```

No `.env.local`, aponte o app pro Redis do compose:

```
REDIS_URL=redis://localhost:6379
```

Sem `REDIS_URL` (nem `KV_REST_*`), o app roda em modo **fail-open**: nada
quebra, mas nada persiste — status sempre FECHADO, feed vazio, toggles do
admin voltam ao default a cada request.

## O que funciona × o que falta em DES

| Área | Com Redis local | Observações |
|------|-----------------|-------------|
| Status + histórico | ✅ persiste | Reportes sobrevivem a restart do dev server |
| Rate limits (device/IP/diário) | ✅ funcionam | Inclusive o toggle e o slider da janela no `/admin` |
| Toggles e aparência (`/admin`) | ✅ persistem | Geofence, rate limit, blobs, flicker, fundo de tijolo |
| Login `/admin` + anti-brute-force | ✅ funciona | Sessão é cookie assinado (nem precisa de Redis); o contador de falhas usa Redis |
| Short links (short.io) | ⚠️ ausente | Sem `SHORTIO_API_KEY`, QRs codificam a URL direta com token exposto (o `/admin` avisa). Serviço externo — não há emulação local |
| Crons | ⚠️ manuais | O `vercel.json` só agenda na Vercel. Local, dispare na mão: `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/rotate-tokens` (idem `auto-close`) |
| Geofence (GPS) | ⚠️ só em localhost | Exige `GEOFENCE_LAT`/`GEOFENCE_LNG` e contexto seguro do browser: funciona em `localhost`, mas **não** no celular via IP da LAN (`http://192.168…`) |
| GIF do GIPHY | ⚠️ opcional | Sem `GIPHY_API_KEY`, a Home simplesmente não mostra GIF. A chave gratuita funciona local |
| `/admin` em si | ❗ exige senha | Sem `ADMIN_PASSWORD`, todo o `/admin` (inclusive o login) responde 503 — fail-closed |
| `SITE_URL` | — | Só importa como destino dos short links em produção |

## Testando no celular (mesma rede)

```bash
npm run generate-qr -- --host=SEU_IP_LOCAL:3000
```

Lembre: geofence não funciona nesse cenário (contexto inseguro) — desligue
a verificação de localização no `/admin` antes de testar.

## Redis: espiar e limpar

```bash
docker compose exec redis redis-cli KEYS 'ca:*'    # tudo que o app gravou
docker compose exec redis redis-cli DEL ca:status  # apaga uma chave
docker compose down -v                             # zera o banco (apaga o volume)
```

O inventário completo das chaves `ca:*` está no
[ARCHITECTURE.md](ARCHITECTURE.md#configs-no-redis-chaves-ca).
