# StatusPro

Cockpit de decisão para distribuição (papel e limpeza): **caixa**, **estoque**, **vendas** e **margem**.

## Stack

- Next.js (App Router)
- Neon Postgres
- Integração planejada com FKN / SIFWin

## Desenvolvimento

```bash
cp .env.example .env
npm install
npm run dev
```

## Deploy

Vercel usa `npm run build` (`next build`). Configure `DATABASE_URL` nas Environment Variables do projeto.
