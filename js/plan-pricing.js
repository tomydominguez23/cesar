(function() {
  "use strict";

  // Fuente única de precios y planes (suscripción mensual en USD).
  window.PTA_PLAN_PRICING = {
    currency: "USD",
    billing: "month",
    billingLabel: "/mes",
    plans: {
      basico: {
        slug: "basico",
        name: "Plan Básico",
        price: 399,
        stripePriceId: ""
      },
      medio: {
        slug: "medio",
        name: "Plan Medio",
        price: 1199,
        stripePriceId: ""
      },
      avanzado: {
        slug: "avanzado",
        name: "Plan Avanzado",
        price: 1599,
        stripePriceId: ""
      },
      pro: {
        slug: "pro",
        name: "Pro Trading",
        price: 1995,
        stripePriceId: ""
      }
    }
  };

  window.PTA_STRIPE_CONFIG = {
    publishableKey: "",
    checkoutSuccessUrl: "https://protradingacademyusa.com/login.html?payment=success",
    checkoutCancelUrl: "https://protradingacademyusa.com/index.html#pricing?payment=cancelled"
  };
})();
