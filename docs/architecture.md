# Sabore Architecture

Sabore is a web-first restaurant operating system for local pilots in Maceio.

## V1 Modules

- PDV: counter, table and delivery orders in one queue.
- Kitchen: simple status flow from new to preparing, ready and delivered.
- Cash: manual payment registry and turn closing, without TEF in v1.
- Stock: ingredients, lots, expiry, minimum stock and FEFO-style consumption.
- Recipe/CMV: each sale can generate inventory movements from ficha tecnica.
- Fiscal: `/api/fiscal/nfce` validates payloads and uses Focus NFe when `FOCUS_NFE_TOKEN` exists; otherwise it returns a mock authorization.
- Payments: `/api/payments/mercado-pago` creates mock payments unless `MERCADO_PAGO_ACCESS_TOKEN` exists.
- WhatsApp: `/api/whatsapp/send` sends official templates when Meta credentials exist; otherwise it queues a mock message.

## Data Strategy

The UI attempts to load Supabase data server-side when env vars are present. If env vars are missing, RLS blocks the read, or the database has not been seeded, it falls back to `src/lib/demo-data.ts`. Run `supabase/schema.sql` first and `supabase/seed.sql` second to load the pilot dataset.

## Commercial Defaults

- Base subscription: R$69.90/month per unit.
- Fiscal API, certificate, CSC, Mercado Pago fees and Meta/WhatsApp costs are paid by the restaurant.
- WhatsApp AI agents and promotional sends are separate add-ons.

## Known V1 Limits

- No offline mode.
- No iFood integration.
- No TEF/maquininha integration.
- No autonomous WhatsApp order-taking agent in the base plan.
