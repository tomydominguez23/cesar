(function() {
  "use strict";

  function getPlanPricing() {
    return window.PTA_PLAN_PRICING && window.PTA_PLAN_PRICING.plans
      ? window.PTA_PLAN_PRICING.plans
      : {};
  }

  function setButtonLoading(button, loading) {
    if (!button) return;
    if (loading) {
      if (!button.dataset.originalHtml) {
        button.dataset.originalHtml = button.innerHTML;
      }
      button.disabled = true;
      button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Redirigiendo a pago...';
      return;
    }
    button.disabled = false;
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
    }
  }

  async function startCheckout(planSlug, triggerButton) {
    const supabase = window.getSupabaseClient ? window.getSupabaseClient() : null;
    if (!supabase) {
      alert("No se pudo conectar con Supabase. Intenta de nuevo en unos minutos.");
      return;
    }

    const plans = getPlanPricing();
    if (!plans[planSlug] || !plans[planSlug].stripePriceId) {
      alert("Este plan aún no está disponible para pago en línea.");
      return;
    }

    setButtonLoading(triggerButton, true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const invokeOptions = {
        body: { plan: planSlug }
      };

      if (accessToken) {
        invokeOptions.headers = { Authorization: `Bearer ${accessToken}` };
      }

      const { data, error } = await supabase.functions.invoke("create-checkout-session", invokeOptions);

      if (error) {
        throw error;
      }
      if (!data || !data.url) {
        throw new Error(data?.error || "Stripe no devolvió URL de pago.");
      }

      window.location.href = data.url;
    } catch (err) {
      const message = err && err.message ? err.message : "No se pudo iniciar el pago.";
      alert("Error al iniciar el pago: " + message);
      setButtonLoading(triggerButton, false);
    }
  }

  function bindCheckoutButtons() {
    document.querySelectorAll("[data-checkout-plan]").forEach((button) => {
      button.addEventListener("click", function(event) {
        event.preventDefault();
        const planSlug = button.getAttribute("data-checkout-plan");
        if (!planSlug) return;
        startCheckout(planSlug, button);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindCheckoutButtons);
  } else {
    bindCheckoutButtons();
  }
})();
