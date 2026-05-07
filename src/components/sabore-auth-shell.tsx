"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { BrandMark } from "@/components/brand-mark";
import { SaboreApp } from "@/components/sabore-app";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Role, SaboreData } from "@/lib/types";

type Profile = {
  id: string;
  name: string;
  role: Role;
  unitId: string;
};

type DataResponse = {
  data: SaboreData;
  source: "supabase";
  message: string;
  profile: Profile;
};

type SignInResponse =
  | { session: Session }
  | { error?: string; message?: string; retryAfterSeconds?: number };

function Field({
  label,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <input
        className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal outline-none ring-ring transition focus:ring-2"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function SaboreAuthShell() {
  const supabase = getSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<SaboreData | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(() =>
    supabase ? "" : "Env vars publicas do Supabase nao configuradas.",
  );
  const [loading, setLoading] = useState(() => Boolean(supabase));
  const [submitting, setSubmitting] = useState(false);

  async function loadData(accessToken: string) {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/sabore/data", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = (await response.json().catch(() => null)) as
        | DataResponse
        | { error?: string }
        | null;

      if (!response.ok || !result || !("data" in result)) {
        const errorMessage = result && "error" in result ? result.error : undefined;

        throw new Error(errorMessage ?? "Nao foi possivel carregar o Sabore");
      }

      setData(result.data);
      setProfile(result.profile);
      setMessage(result.message);
    } catch (loadError) {
      setData(null);
      setProfile(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Nao foi possivel carregar o Sabore",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data: sessionData }) => {
      if (!mounted) return;

      const currentSession = sessionData.session;
      setSession(currentSession);

      if (currentSession) {
        void loadData(currentSession.access_token);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);

      if (currentSession) {
        void loadData(currentSession.access_token);
      } else {
        setData(null);
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function signIn() {
    if (!supabase) return;

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
        }),
      });
      const result = (await response.json().catch(() => null)) as SignInResponse | null;

      if (!response.ok || !result || !("session" in result)) {
        const errorMessage =
          result && "message" in result
            ? result.message
            : result && "error" in result
              ? result.error
              : undefined;

        setError(errorMessage ?? "Nao foi possivel entrar no Sabore");
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });

      if (sessionError) {
        setError(sessionError.message);
        return;
      }

      setSession(result.session);
      await loadData(result.session.access_token);
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : "Nao foi possivel entrar no Sabore",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setSession(null);
    setData(null);
    setProfile(null);
  }

  if (session && data && profile) {
    return (
      <SaboreApp
        accessToken={session.access_token}
        currentUser={{ name: profile.name, role: profile.role }}
        dataSource={{ source: "supabase", message }}
        initialData={data}
        onLogout={signOut}
      />
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center">
        <Card className="w-full">
          <CardHeader>
            <div className="mb-3 flex items-center gap-2">
              <BrandMark />
              <div>
                <p className="text-sm font-semibold">Sabore</p>
                <p className="text-xs text-muted-foreground">PDV inteligente</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CardTitle>Acesso operacional</CardTitle>
              <Badge variant="info">Supabase Auth</Badge>
            </div>
            <CardDescription>
              Entre com o usuario vinculado a unidade do restaurante.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="rounded-md border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                Carregando sessao...
              </div>
            ) : (
              <>
                <Field label="Email" value={email} onChange={setEmail} />
                <Field
                  label="Senha"
                  type="password"
                  value={password}
                  onChange={setPassword}
                />
                {error && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}
                <Button className="w-full" disabled={submitting} onClick={signIn}>
                  {submitting ? "Entrando..." : "Entrar"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
