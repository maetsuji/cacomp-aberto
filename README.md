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

| QR | Local | URL | Efeito |
|----|-------|-----|--------|
| Interno | mesa/parede dentro do CA | `/report?action=open&token=…` | reporta **ABERTO** |
| Externo | porta do CA | `/report?action=close&token=…` | reporta **FECHADO** |

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

- **Rate limiting** por hash anônimo de IP (SET NX+EX atômico no Redis).
- **Tokens secretos** só existem nas variáveis de ambiente e nos QR impressos.
- **Histórico público**: os últimos 5 reportes anônimos aparecem na Home — a comunidade vê se alguém trollou e corrige escaneando o QR verdadeiro.

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
│   │   ├── route.ts             # GET do QR: processa e redireciona (PRG)
│   │   └── result/page.tsx      # Tela "Obrigado!" / "Calma lá!" / "Link inválido"
│   └── api/cron/auto-close/
│       └── route.ts             # Endpoint do Vercel Cron (protegido por CRON_SECRET)
├── components/
│   ├── TimeAgo.tsx              # "há X minutos" no cliente
│   └── RedirectHome.tsx         # Volta à Home 3s após o reporte
└── lib/
    ├── types.ts                 # Schema (CaState, ReportEntry)
    ├── store.ts                 # Abstração Redis (REST ou cliente nativo)
    ├── status.ts                # Estado atual + histórico
    ├── rate-limit.ts            # Hash anônimo de IP + janela de 20 min
    ├── report.ts                # Valida token → rate limit → persiste → revalida
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

```bash
npm run generate-qr:prod   # aponta para https://cacomp-aberto.vercel.app
```

Os PNGs vão para `qrcodes/` (gitignored — as URLs embutem os tokens secretos;
nunca versione nem use geradores de QR online com eles).

## Variáveis de ambiente

| Variável | Uso |
|----------|-----|
| `REPORT_TOKEN_INTERNAL` | Token do QR interno (`action=open`) |
| `REPORT_TOKEN_EXTERNAL` | Token do QR externo (`action=close`) |
| `IP_HASH_SALT` | Salt do hash anônimo de IP (rate limiting) |
| `REDIS_URL` *(ou `KV_REST_API_URL`+`KV_REST_API_TOKEN`)* | Conexão com o Redis |
| `GIPHY_API_KEY` | Chave gratuita do GIPHY (sem ela, a Home só omite o GIF) |
| `CRON_SECRET` | Autoriza o cron de fechamento automático (a Vercel envia `Authorization: Bearer`) |

Em produção, configure todas no dashboard da Vercel — o Redis do Marketplace
injeta `REDIS_URL` sozinho; as demais são manuais.
