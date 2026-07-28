import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1?target=deno";
import { assertRateLimit, getAllowedOrigin, getClientIp } from "../_shared/rate-limit.ts";

const DEFAULT_SITE_URL = "https://protradingacademyusa.com";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

Deno.serve(async (req) => {
  const siteUrl = resolveSiteUrl();
  const corsHeaders = {
    "Access-Control-Allow-Origin": getAllowedOrigin(req, siteUrl),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Método no permitido" }, 405, corsHeaders);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Faltan variables de entorno en Supabase Edge Functions.");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Debes iniciar sesión para usar el asistente." }, 401, corsHeaders);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return json({ error: "Sesión inválida." }, 401, corsHeaders);
    }

    const user = userData.user;
    const clientIp = getClientIp(req);

    await assertRateLimit({
      action: "trading_assistant",
      bucketKey: `user:${user.id}`,
      maxAttempts: 40,
      windowSeconds: 60 * 60,
    });

    await assertRateLimit({
      action: "trading_assistant",
      bucketKey: `ip:${clientIp}`,
      maxAttempts: 80,
      windowSeconds: 60 * 60,
    });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role,plan,subscription_status")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin = profile?.role === "admin";
    const subscriptionActive = profile?.subscription_status === "active"
      || profile?.subscription_status === "trialing";

    const chatEnabled = await isAiChatEnabled(supabase);
    if (!isAdmin && !chatEnabled) {
      return json({
        error: "El asistente aún no está disponible para alumnos. Solo administradores pueden probarlo.",
      }, 403, corsHeaders);
    }

    if (!isAdmin && !subscriptionActive) {
      return json({ error: "Necesitas una suscripción activa para usar el asistente." }, 403, corsHeaders);
    }

    const body = await req.json().catch(() => ({}));
    const message = String(body?.message || "").trim();
    const history = Array.isArray(body?.history) ? body.history.slice(-12) : [];

    if (!message) {
      return json({ error: "Escribe una pregunta para continuar." }, 400, corsHeaders);
    }
    if (message.length > 2000) {
      return json({ error: "El mensaje es demasiado largo (máx. 2000 caracteres)." }, 400, corsHeaders);
    }

    const provider = String(Deno.env.get("AI_PROVIDER") || "").toLowerCase();
    const hasOpenAi = !!Deno.env.get("OPENAI_API_KEY");
    const hasAnthropic = !!Deno.env.get("ANTHROPIC_API_KEY");

    // Fase 1: stub sin proveedor. Luego conectamos OpenAI o Claude.
    if (!provider || (!hasOpenAi && !hasAnthropic)) {
      return json({
        reply: buildStubReply(message, isAdmin),
        provider: "stub",
        mode: isAdmin && !chatEnabled ? "admin_preview" : "public",
      }, 200, corsHeaders);
    }

    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...sanitizeHistory(history),
      { role: "user", content: message },
    ];

    // Placeholder for next iteration: call OpenAI / Anthropic using AI_PROVIDER.
    return json({
      reply: buildStubReply(message, isAdmin),
      provider: provider || "stub",
      mode: isAdmin && !chatEnabled ? "admin_preview" : "public",
      note: "Proveedor configurado, pero la conexión aún no está implementada. Usando respuesta provisional.",
    }, 200, corsHeaders);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error del asistente";
    const status = message.includes("Demasiados intentos") ? 429 : 500;
    return json({ error: message }, status, corsHeaders);
  }
});

const SYSTEM_PROMPT = `Eres el asistente educativo de Pro Trading Academy USA.
Ayudas a resolver dudas sobre trading, la metodología de la academia, plataformas (TC2000, ThinkorSwim) y el uso del portal.
No des señales de compra/venta, no prometas ganancias y aclara que el trading implica riesgo.
Responde en español, de forma clara y breve.`;

function sanitizeHistory(history: unknown[]): ChatMessage[] {
  const cleaned: ChatMessage[] = [];
  for (const item of history) {
    if (!item || typeof item !== "object") continue;
    const role = String((item as ChatMessage).role || "");
    const content = String((item as ChatMessage).content || "").trim();
    if ((role === "user" || role === "assistant") && content) {
      cleaned.push({ role, content: content.slice(0, 2000) });
    }
  }
  return cleaned;
}

async function isAiChatEnabled(supabase: ReturnType<typeof createClient>): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "ai_chat_enabled")
      .maybeSingle();
    if (error || !data) return false;
    return String(data.value).toLowerCase() === "true";
  } catch (_) {
    return false;
  }
}

function buildStubReply(message: string, isAdmin: boolean): string {
  const previewNote = isAdmin
    ? "Estás en modo prueba de administrador. Cuando actives el flag `ai_chat_enabled`, los alumnos también verán este chat."
    : "El asistente está en modo provisional mientras conectamos el proveedor de IA.";

  return [
    "Gracias por tu pregunta.",
    "",
    `Recibí: “${message.slice(0, 180)}${message.length > 180 ? "…" : ""}”`,
    "",
    "Todavía no estoy conectado a OpenAI ni a Claude. En esta fase puedes probar la interfaz del chat; en la siguiente conectamos el modelo.",
    "",
    previewNote,
    "",
    "Mientras tanto, revisa también la sección FAQ del portal o las clases de tu plan.",
  ].join("\n");
}

function resolveSiteUrl(): string {
  const configured = Deno.env.get("SITE_URL") || DEFAULT_SITE_URL;
  if (/^https?:\/\//i.test(configured)) {
    return configured.replace(/\/+$/, "");
  }
  return DEFAULT_SITE_URL;
}

function json(payload: Record<string, unknown>, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
