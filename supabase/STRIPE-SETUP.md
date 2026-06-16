# Stripe + Supabase — pasos de despliegue

## 1. SQL en Supabase

Ejecuta en **SQL Editor**:

- `supabase/stripe-profiles.sql`
- `supabase/student-access-rls.sql` (RLS en tablas y storage — ver `STUDENT-RLS-SETUP.md`)

## 2. Secretos en Supabase

**Project Settings → Edge Functions → Secrets**

| Secreto | Valor |
|---------|--------|
| `STRIPE_SECRET_KEY` | `sk_live_...` (rotada) |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (tras crear webhook) |
| `SITE_URL` | `https://protradingacademyusa.com` |

## 3. Desplegar Edge Functions

Con [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase login
supabase link --project-ref bkgkizlrtczrzryhrrjg
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
```

## 4. Webhook en Stripe

**Developers → Webhooks → Add endpoint**

- **URL:** `https://bkgkizlrtczrzryhrrjg.supabase.co/functions/v1/stripe-webhook`
- **Eventos:**
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`

Copia el **Signing secret** (`whsec_...`) a Supabase Secrets como `STRIPE_WEBHOOK_SECRET`.

## 5. Price IDs configurados

| Plan | Price ID |
|------|----------|
| Básico | `price_1Tj0QtEdi9JcCWjpTjB0AI0h` |
| Medio | `price_1TivQnEdi9JcCWjpCY5juiR3` |
| Avanzado | `price_1TivQTEdi9JcCWjptCpf8Eq0` |
| Pro Trading | `price_1TivQ4Edi9JcCWjpOgH6hdNx` |

## 6. Probar

1. Merge a `main` y esperar deploy FTP.
2. En la landing, **Inscribirme** → debe abrir Stripe Checkout.
3. Tras pagar, login con el mismo email → plan activo en `profiles`.
