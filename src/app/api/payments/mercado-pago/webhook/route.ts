import { NextResponse } from "next/server";

const seenEvents = new Set<string>();

export async function POST(request: Request) {
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
