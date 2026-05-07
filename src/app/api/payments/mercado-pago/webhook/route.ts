import { NextResponse } from "next/server";
import { apiRateLimit, enforceRateLimit } from "@/lib/security/rate-limit";

const seenEvents = new Set<string>();

export async function POST(request: Request) {
  const limited = await enforceRateLimit(
    request,
    apiRateLimit("payments:mercado-pago:webhook"),
  );

  if (limited) return limited;

  const eventId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const payload = await request.json().catch(() => ({}));
  const duplicate = seenEvents.has(eventId);

  seenEvents.add(eventId);

  return NextResponse.json({
    ok: true,
    duplicate,
    eventId,
    received: payload,
  });
}
