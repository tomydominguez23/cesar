import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1?target=deno";

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 120);
  }

  const candidates = [
    req.headers.get("cf-connecting-ip"),
    req.headers.get("x-real-ip"),
    req.headers.get("x-client-ip"),
  ];

  for (const value of candidates) {
    if (value && value.trim()) {
      return value.trim().slice(0, 120);
    }
  }

  return "unknown";
}

export function getAllowedOrigin(req: Request, fallback: string): string {
  const allowed = new Set([
    "https://protradingacademyusa.com",
    "https://www.protradingacademyusa.com",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
  ]);

  const origin = req.headers.get("origin");
  if (origin && allowed.has(origin)) {
    return origin;
  }

  return fallback;
}

export async function assertRateLimit(params: {
  action: string;
  bucketKey: string;
  maxAttempts: number;
  windowSeconds: number;
}): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Rate limit no configurado en el servidor.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase.rpc("assert_rate_limit", {
    p_action: params.action,
    p_bucket: params.bucketKey,
    p_max: params.maxAttempts,
    p_window_seconds: params.windowSeconds,
  });

  if (!error) return;

  const message = error.message || "";
  if (message.includes("rate_limit_exceeded")) {
    throw new Error("Demasiados intentos. Espera unos minutos e inténtalo de nuevo.");
  }

  throw error;
}
