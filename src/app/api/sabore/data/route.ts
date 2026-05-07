import { apiRateLimit, enforceRateLimit } from "@/lib/security/rate-limit";
import { AccessError, getAuthenticatedProfile } from "@/lib/supabase/access";
import { getSaboreDataForUnit } from "@/lib/supabase/sabore-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = await enforceRateLimit(request, apiRateLimit("sabore:data"));

  if (limited) return limited;

  try {
    const profile = await getAuthenticatedProfile(request);
    const result = await getSaboreDataForUnit(profile.unitId);

    return Response.json({
      ...result,
      profile: {
        id: profile.id,
        name: profile.name,
        role: profile.role,
        unitId: profile.unitId,
      },
    });
  } catch (error) {
    const status = error instanceof AccessError ? error.status : 500;

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar os dados do Sabore",
      },
      { status },
    );
  }
}
