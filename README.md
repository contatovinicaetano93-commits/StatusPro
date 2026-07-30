# StatusPro

Cockpit de decisão (CEO/diretoria) para distribuidora de **limpeza e papel** (~R$100mi/ano, base SP, multi-UF).

Foco: **caixa · estoque · vendas · margem · frete · concentração · fill rate/OTIF** — com copiloto de IA.

## Rodar local

```bash
cp .env.example .env   # preencha DATABASE_URL (Neon)
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Login demo: `ceo@statuspro.local` / `demo` (também finance/commercial/operations/admin).

## Arquitetura

```
src/
  app/                 # UI Next.js (rotas)
  components/          # Shell, KPIs, AI panels
  application/         # Use-cases (ex.: getCeoHome)
  domain/              # KPIs, roles, tipos
  ai/                  # Tools tipadas + briefing
  infrastructure/
    db/                # Neon client + repositórios
    erp/               # ErpGateway + Mock + stub FKN/SIFWin
    auth/              # Sessão cookie (JWT)
db/migrations/         # SQL versionado
scripts/               # migrate + seed
```

Regras:
- Páginas e actions chamam só `application/` (use-cases); **não** SQL, repos ou orquestração de IA na UI
- Tenant vem da **sessão** (`organizationId`), não de `NEXT_PUBLIC_DEFAULT_ORG_SLUG` nas leituras
- ERP entra só via `ErpGateway` (Zod nos boundaries; `ErpPullResultSchema` no sync)
- Sync upserta fatos + recompute KPIs (`ingestErpPull` → `recomputeKpisFromPull`) e refresh de alertas operacionais
- Ranking de alertas vive em `domain/alerts` (não na camada de IA)
- Default `ERP_MODE=mock` até existir API FKN
- IA é fail-soft: prefer `ANTHROPIC_API_KEY` (Claude); sem chave, briefing por regras continua

## Domínio / KPIs

Catálogo central em `src/domain/kpis/catalog.ts` (fórmula, fonte, thresholds, playbooks).
Motor em `src/domain/kpis/engine.ts`. Testes: `npm test`.

Horizontes: Diário → Semanal → Mensal → Trimestral.

## Sync FKN/SIFWin

1. Pedir API ao suporte FKN
2. Implementar `FknSifwinErpGateway` em `src/infrastructure/erp/mock-gateway.ts`
3. Validar com schemas Zod de `gateway.ts`
4. `ERP_MODE=fkn` + credenciais
5. Acompanhar no **Sync Center**

## Feature flags

`FEATURE_FLAGS=ai_briefing,ai_chat,sync_center,playbooks`

## Decisões de produto (simples)

- Auth demo por cookie JWT (sem IdP) para MVP interno
- EBITDA trimestral é **proxy gerencial** (não contábil oficial)
- Freshness: KPI `ok` vira `stale` após 180 min sem sync

## Scripts

| Script | Uso |
|--------|-----|
| `npm run dev` | App local |
| `npm run db:migrate` | Aplica SQL |
| `npm run db:seed` | Popula demo ~100mi anualizado |
| `npm test` | Fórmulas KPI |
| `npm run build` / `lint` | Qualidade |
