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
        stripeProductId: "prod_UiM7i6tuAdIy5P",
        stripePriceId: ""
      },
      medio: {
        slug: "medio",
        name: "Plan Medio",
        price: 1199,
        stripeProductId: "prod_UiM9k9233PaV1l",
        stripePriceId: ""
      },
      avanzado: {
        slug: "avanzado",
        name: "Plan Avanzado",
        price: 1599,
        stripeProductId: "prod_UiM8ZqNAQOrrfQ",
        stripePriceId: ""
      },
      pro: {
        slug: "pro",
        name: "Pro Trading",
        price: 1995,
        stripeProductId: "prod_UiM8X3joKksLD4",
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
