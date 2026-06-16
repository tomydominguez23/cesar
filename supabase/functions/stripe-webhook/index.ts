import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1?target=deno";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { isPlanSlug } from "../_shared/plans.ts";

async function applySubscriptionToProfile(
  supabase: ReturnType<typeof createClient>,
  params: {
    email: string;
    plan: string;
    customerId: string | null;
    subscriptionId: string | null;
    status: string;
    periodEnd: string | null;
    userId: string | null;
  }
) {
  const { email, plan, customerId, subscriptionId, status, periodEnd, userId } = params;
  const payload = {
    plan,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    subscription_status: status,
    subscription_current_period_end: periodEnd,
  };

  if (userId) {
    await supabase.from("profiles").update(payload).eq("id", userId);
    return;
  }

  const { data: userList } = await supabase.auth.admin.listUsers();
  const matchedUser = userList?.users?.find(
    (user) => user.email?.toLowerCase() === email.toLowerCase()
  );

  if (matchedUser) {
    await supabase.from("profiles").update(payload).eq("id", matchedUser.id);
    return;
  }

  await supabase.from("pending_subscriptions").upsert(
    {
      email: email.toLowerCase(),
      plan,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      subscription_status: status,
      subscription_current_period_end: periodEnd,
    },
    { onConflict: "email" }
  );
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Método no permitido", { status: 405 });
  }

  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!stripeSecret || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return new Response("Configuración incompleta", { status: 500 });
  }

  const stripe = new Stripe(stripeSecret, { apiVersion: "2023-10-16" });
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  if (!signature) {
    return new Response("Firma ausente", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Firma inválida";
    return new Response(`Webhook Error: ${message}`, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const plan = String(session.metadata?.plan || "");
      const email = session.customer_details?.email || session.customer_email || "";
      const userId = session.client_reference_id || session.metadata?.supabase_user_id || null;

      if (email && isPlanSlug(plan)) {
        await applySubscriptionToProfile(supabase, {
          email,
          plan,
          customerId: typeof session.customer === "string" ? session.customer : null,
          subscriptionId: typeof session.subscription === "string" ? session.subscription : null,
          status: "active",
          periodEnd: null,
          userId: userId || null,
        });
      }
    }

    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      const plan = String(subscription.metadata?.plan || "");
      const userId = subscription.metadata?.supabase_user_id || null;
      const status = subscription.status;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
      const periodEnd = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null;

      if (userId && isPlanSlug(plan)) {
        await supabase
          .from("profiles")
          .update({
            plan: status === "active" || status === "trialing" ? plan : "basico",
            stripe_customer_id: customerId,
            stripe_subscription_id: subscription.id,
            subscription_status: status,
            subscription_current_period_end: periodEnd,
          })
          .eq("id", userId);
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : null;
      if (subscriptionId) {
        await supabase
          .from("profiles")
          .update({ subscription_status: "past_due" })
          .eq("stripe_subscription_id", subscriptionId);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error procesando webhook";
    return new Response(message, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
