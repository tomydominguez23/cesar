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
        price: 699,
        stripeProductId: "prod_UiM7i6tuAdIy5P",
        stripePriceId: "price_1Tj0QtEdi9JcCWjpTjB0AI0h"
      },
      medio: {
        slug: "medio",
        name: "Plan Medio",
        price: 1199,
        stripeProductId: "prod_UiM9k9233PaV1l",
        stripePriceId: "price_1TivQnEdi9JcCWjpCY5juiR3"
      },
      pro: {
        slug: "pro",
        name: "Pro Trading",
        price: 1995,
        stripeProductId: "prod_UiM8X3joKksLD4",
        stripePriceId: "price_1TivQ4Edi9JcCWjpOgH6hdNx"
      }
    }
  };

  window.PTA_STRIPE_CONFIG = {
    publishableKey: "pk_live_51RCqyfEdi9JcCWjpGtVK1tvlkt4lAOMky6M0PAd69umhbg6xqtOJRqZ3FI4DjDyEZdUUxEQggX2Zyw4Sav7gB2iX00AnCRCI6Q",
    checkoutSuccessUrl: "https://protradingacademyusa.com/register.html?payment=success",
    checkoutCancelUrl: "https://protradingacademyusa.com/index.html#pricing?payment=cancelled"
  };
})();
