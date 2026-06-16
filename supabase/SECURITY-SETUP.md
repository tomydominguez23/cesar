# Seguridad — guía de configuración

## Qué es público (normal y seguro)

| Archivo / valor | ¿Es secreto? | Notas |
|-----------------|--------------|-------|
| `js/supabase-config.js` → `anonKey` | No | Clave **anon** de Supabase; debe usarse con **RLS** activo (`student-access-rls.sql`). |
| `js/plan-pricing.js` → `publishableKey` | No | Clave **pública** de Stripe (`pk_live_...`). |
| `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | **Sí** | Solo en **Supabase Secrets** o Stripe Dashboard. Nunca en el repo ni en HTML/JS. |

## SQL recomendado (orden)

1. `stripe-profiles.sql`
2. `student-access-rls.sql`
3. **`rate-limiting.sql`** (límite de intentos en checkout)

## Supabase Dashboard — Auth

En **Authentication → Rate Limits** (o Attack Protection):

- Activar límite de intentos de **login** / **password recovery**
- Activar **CAPTCHA** (Cloudflare Turnstile o hCaptcha) en sign-in y reset password
- Desactivar **registro público** si los usuarios solo entran por pago + invitación

## Supabase Dashboard — Email

En **Authentication → Email**:

- Limitar plantillas solo a lo necesario (login, reset)
- Usar SMTP propio con límites del proveedor
- No exponer endpoints de envío masivo desde el frontend

## Edge Functions

Tras merge, **redeploy** en Supabase:

- `create-checkout-session` (incluye rate limit por IP)
- `stripe-webhook` (solo Stripe; no exponer URL)

Secretos requeridos:

- `STRIPE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (webhook + rate limit)
- `SITE_URL`

## cPanel / sitio estático

El workflow FTP **no** sube `.github/` ni `supabase/` al hosting público.

El frontend incluye:

- `js/security-guard.js` — honeypot, retardo mínimo y cooldown en login/checkout
- Cabeceras de seguridad en `.htaccess`

## Si alguna clave secreta se filtró

1. Rotar **Stripe** secret key y webhook secret
2. Rotar **Supabase** service role (Project Settings → API)
3. Revisar logs de Auth y Stripe por uso indebido
