import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1?target=deno";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { isPlanSlug, PLAN_PRICE_IDS } from "../_shared/plans.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    const siteUrl = Deno.env.get("SITE_URL") || "https://protradingacademyusa.com";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!stripeSecret || !supabaseUrl || !supabaseAnonKey) {
      throw new Error("Faltan variables de entorno en Supabase Edge Functions.");
    }

    const body = await req.json();
    const plan = String(body?.plan || "");

    if (!isPlanSlug(plan)) {
      return new Response(JSON.stringify({ error: "Plan inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: "2023-10-16" });
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let customerEmail: string | undefined;

    if (authHeader) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        userId = userData.user.id;
        customerEmail = userData.user.email || undefined;
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: PLAN_PRICE_IDS[plan], quantity: 1 }],
      success_url: `${siteUrl}/login.html?payment=success&plan=${plan}`,
      cancel_url: `${siteUrl}/index.html#pricing?payment=cancelled`,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      customer_email: customerEmail,
      client_reference_id: userId || undefined,
      metadata: {
        plan,
        supabase_user_id: userId || "",
      },
      subscription_data: {
        metadata: {
          plan,
          supabase_user_id: userId || "",
        },
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al crear checkout";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
