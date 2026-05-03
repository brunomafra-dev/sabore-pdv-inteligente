import { NextResponse } from "next/server";
import { getFiscalProvider } from "@/lib/integrations/focus-nfe";
import { issueNfceSchema } from "@/lib/integrations/contracts";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = issueNfceSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const result = await getFiscalProvider().issueNfce(parsed.data);

  return NextResponse.json(result, {
    status: result.status === "rejected" ? 422 : 201,
  });
}
