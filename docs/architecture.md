# Sabore Architecture

Sabore is a web-first restaurant operating system for local pilots in Maceio.

## V1 Modules

- PDV: counter, table and delivery orders in one queue.
- Kitchen: simple status flow from new to preparing, ready and delivered.
- Cash: manual payment registry and turn closing, without TEF in v1.
- Stock: ingredients, lots, expiry, minimum stock and FEFO-style consumption.
- Recipe/CMV: each sale can generate inventory movements from ficha tecnica.
- Fiscal: base plans generate non-fiscal accounts/receipts. NFC-e remains an assisted setup with external API/certificate/accounting paid by the restaurant.
- Payments: base plans register Pix, cash, debit, credit and voucher manually. Online checkout is optional/future.
- WhatsApp: status notifications and AI agent are optional add-ons, with Meta costs possibly passed through.

## Routing

- `/`: authenticated Sabore app.
- `/site`: public landing page.
- `/suporte`: public support page and support boundaries.
- `/termos-de-uso`, `/politica-de-privacidade`, `/politica-de-cookies`, `/acordo-de-tratamento-de-dados`: public legal drafts for pre-launch review.
- `/app`: legacy redirect to `/`.

## Data Strategy

The UI attempts to load Supabase data server-side when env vars are present. If env vars are missing, RLS blocks the read, or the database has not been seeded, it falls back to `src/lib/demo-data.ts`. Run `supabase/schema.sql` first and `supabase/seed.sql` second to load the pilot dataset.

Organizations store both `plan_code` and `plan_price`. The code-defined feature catalog decides which modules are visible and usable for each plan; price alone is not treated as a permission model. Restaurant Admin screens can edit operational identity, users and unit data, but cannot self-change plan, price or fiscal enablement.

## Commercial Defaults

- Essencial: R$59.90/month.
- Operacao: R$89.90/month.
- Site Delivery Proprio: R$300 setup + R$39.90/month.
- Fiscal NFC-e: R$399-699 setup, no Sabore fiscal monthly fee; fiscal API, certificate, CSC and accounting are paid by the restaurant or transparently passed through.
- iFood and 99Food: R$299 setup + R$99.90/month each when partner/API access is available.
- WhatsApp Status: R$29.90/month.
- WhatsApp AI Agent: R$399 setup + R$99.90/month, with Meta/volume costs possibly passed through.

## Known V1 Limits

- No offline mode.
- No iFood integration.
- No TEF/maquininha integration.
- No autonomous WhatsApp order-taking agent in the base plan.
- No NFC-e in the base plans; only non-fiscal account/receipt output.
