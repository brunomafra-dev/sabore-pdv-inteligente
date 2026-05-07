import { NextResponse } from "next/server";
import { createPaymentSchema } from "@/lib/integrations/contracts";
import { getPaymentProvider } from "@/lib/integrations/mercado-pago";
import { apiRateLimit, enforceRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, apiRateLimit("payments:mercado-pago"));

  if (limited) return limited;

  const payload = await request.json().catch(() => null);
  const parsed = createPaymentSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const result = await getPaymentProvider().createPayment(parsed.data);

  return NextResponse.json(result, { status: 201 });
}
