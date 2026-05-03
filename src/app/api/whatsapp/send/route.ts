import { NextResponse } from "next/server";
import { whatsappTemplateSchema } from "@/lib/integrations/contracts";
import { getWhatsAppProvider } from "@/lib/integrations/whatsapp";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = whatsappTemplateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const result = await getWhatsAppProvider().sendTemplate(parsed.data);

  return NextResponse.json(result, { status: 202 });
}
