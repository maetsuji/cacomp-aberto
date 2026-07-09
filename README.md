# CA-Aberto (CACOMP UnB)

O CA de Computação está aberto agora? Status em tempo real, reportado pela
comunidade via QR Codes fixados no local — sem login, sem app, sem custo.

## Como funciona

- **QR externo (porta):** `/report?action=close&token=…` — reporta CA fechado.
- **QR interno (dentro do CA):** `/report?action=open&token=…` — reporta CA aberto.
- O servidor valida o token (env vars), aplica rate limit por hash anônimo de
  IP (1 reporte / 20 min), grava o estado no Vercel KV e chama
  `revalidatePath("/")` — a Home estática na CDN é invalidada na hora.

## Rodando localmente

```bash
cp .env.example .env.local   # preencha tokens, salt e credenciais do KV
npm install
npm run dev
```

## Estrutura

```
src/
├── app/
│   ├── layout.tsx          # Shell HTML + metadata
│   ├── globals.css         # Tailwind v4
│   ├── page.tsx            # Home estática (ISR on-demand)
│   └── report/page.tsx     # Rota dinâmica pós-scan do QR
├── components/
│   ├── TimeAgo.tsx         # "há X minutos" calculado no cliente
│   └── RedirectHome.tsx    # Redirect automático pós-reporte
└── lib/
    ├── types.ts            # Schema (CaState, ReportEntry)
    ├── status.ts           # Leitura/escrita no Vercel KV
    ├── rate-limit.ts       # Hash anônimo de IP + janela de 20 min
    └── report.ts           # Server Action: valida token e revalida cache
```

## Deploy

Vercel (plano Hobby) + integração Vercel KV. Configure as variáveis de
`.env.example` no dashboard do projeto.
