import { z } from "zod";
import { authRateLimit, enforceRateLimit } from "@/lib/security/rate-limit";
import { getSupabaseAuthClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(256),
});

function payloadEmail(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("email" in payload)) {
    return "invalid";
  }

  const email = payload.email;

  return typeof email === "string" ? email : "invalid";
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const limited = await enforceRateLimit(
    request,
    authRateLimit("auth:sign-in", payloadEmail(payload)),
  );

  if (limited) return limited;

  const parsed = signInSchema.safeParse(payload);

  if (!parsed.success) {
    return Response.json(
      { error: "invalid_payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await getSupabaseAuthClient().auth.signInWithPassword(
    parsed.data,
  );

  if (error || !data.session) {
    return Response.json({ error: "Email ou senha invalidos" }, { status: 401 });
  }

  return Response.json({ session: data.session });
}
