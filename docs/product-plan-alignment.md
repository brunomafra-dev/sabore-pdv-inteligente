# Sabore Plan Alignment

This note checks the current product against the revised commercial model.

## Current Commercial Model

| Product | Price | Status in codebase |
| --- | ---: | --- |
| Essencial | R$59.90/month | Mostly implemented as the base app: PDV, tables, cash, catalog, manual stock, non-fiscal receipt positioning and basic reports. |
| Operacao | R$89.90/month | Core operational features exist in the app: KDS, recipe items, automatic stock movements, CMV, lots/expiry and internal delivery flow. |
| Site Delivery Proprio | R$300 setup + R$39.90/month | Not implemented yet. App structure already has delivery orders; next step is public `/delivery/[slug]` and public checkout. |
| Fiscal NFC-e | R$399-699 setup, external costs paid by restaurant | Provider adapter exists, but production route must still be secured and changed to issue from a real paid order. Not part of base plan. |
| iFood | R$299 setup + R$99.90/month | Not implemented. Requires partner/API/hub decision and item mapping. |
| 99Food | R$299 setup + R$99.90/month | Not implemented. Requires partner/API/hub decision and item mapping. |
| WhatsApp Status | R$29.90/month | Mock/provider structure exists, but route still needs auth hardening and real recipient handling. |
| Agente IA WhatsApp | R$399 setup + R$99.90/month | Not implemented. Commercially positioned as a later add-on. |

## Alignment Done

- Public site now presents Essencial, Operacao and add-ons with the revised prices.
- Demo and seed default price changed from R$69.90 to R$59.90.
- Demo fiscal flag defaults to disabled to match "recibo nao fiscal" in the base plan.
- App header no longer suggests NFC-e is bundled into the core product.
- Admin "Planos e modulos" now mirrors the revised plan structure.
- Architecture and README now describe non-fiscal base plans and fiscal as assisted setup.
- Organizations now carry `plan_code` as well as `plan_price`.
- Navigation and order behavior now respect plan features: Essencial hides KDS/delivery, and automatic stock movements only run when `autoStock` is available.
- Customer Admin no longer edits plan, price or fiscal enablement; those are commercial/internal controls.
- Mutation API now checks the stored plan before accepting delivery orders, automatic stock movements, KDS status changes, recipe items and kitchen-only users.

## Still Needed

- Server-side feature enforcement for add-on API routes such as WhatsApp, fiscal and future marketplace callbacks.
- Billing/subscription records.
- Public site delivery module.
- Fiscal route hardening before any real NFC-e.
- Marketplace providers and SKU mapping.
- WhatsApp route hardening and opt-in/opt-out controls.
- Non-fiscal receipt print/export screen with explicit legal text.

## Competitive Positioning

TalkyFood should be treated as the aggressive low-price competitor. Sabore should avoid copying "everything included" claims until costs are proven. The safer strategy is:

- Low-friction base plan.
- Operacao plan as the real restaurant operations value.
- Expensive/external-cost features sold as transparent add-ons.
- Fiscal never silently bundled into low-ticket subscriptions.
