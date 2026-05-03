# Sabore

SaaS/PDV inteligente para restaurantes locais: pedidos de balcao, mesa e delivery proprio, cozinha, caixa manual, estoque, ficha tecnica, CMV, validade, NFC-e via API fiscal e WhatsApp guiado.

O app atual entrega um MVP navegavel com dados demo e integrações mockadas. Quando as variaveis de ambiente forem configuradas, os adapters passam a chamar Focus NFe, Mercado Pago e WhatsApp Cloud API.

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Scripts

- `npm run dev`: local development.
- `npm run build`: production build.
- `npm run lint`: ESLint.
- `npm run test`: domain tests for order, stock and cash calculations.

## Env Vars

Copy `.env.example` to `.env.local` and fill only what you need:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FOCUS_NFE_TOKEN`
- `MERCADO_PAGO_ACCESS_TOKEN`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`

## Supabase

Run `supabase/schema.sql` in a Supabase project to create the first production-ready data model.

See `docs/architecture.md` for module boundaries and v1 limits.
