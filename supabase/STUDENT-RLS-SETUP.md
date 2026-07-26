# RLS — blindaje de contenido en Supabase

Ejecuta **después** de `stripe-profiles.sql` y `storage-public-logo.sql`.

## 1. SQL en Supabase

En **SQL Editor**, ejecuta en este orden:

1. `supabase/stripe-profiles.sql` (si no lo hiciste antes)
2. `supabase/storage-public-logo.sql` (logo público del header)
3. `supabase/storage-public-hero-video.sql` (video público del hero en la landing)
4. **`supabase/student-access-rls.sql`** ← este archivo

## 2. Qué protege

| Recurso | Regla |
|---------|--------|
| `profiles` | Cada usuario solo lee su perfil. Solo admin gestiona todos. |
| `pending_subscriptions` | Sin acceso directo desde el navegador (solo webhook + función RPC). |
| `courses`, `course_modules`, `lessons`, `lesson_materials` | Solo cursos **publicados**, con suscripción **activa** y plan suficiente. |
| Storage `lesson-videos`, `lesson-materials`, portadas en `media-library` | URL firmada solo si el usuario tiene derecho al curso/clase. |
| Panel admin | Usuarios con `profiles.role = 'admin'` mantienen acceso completo. |

## 3. Función RPC

`apply_pending_subscription()` aplica el pago de Stripe al perfil tras login, sin permitir que el cliente modifique `plan` o `subscription_status` manualmente.

El frontend (`js/student-guard.js`) ya llama esta función automáticamente.

## 4. Verificación rápida

1. **Sin login:** abrir `dashboard.html` en incógnito → debe redirigir a login.
2. **Con login sin pago:** debe ir a `#pricing`.
3. **Con suscripción activa plan Básico:** solo ve cursos de ese nivel.
4. **En DevTools → Network:** llamadas a `courses` / `lessons` sin JWT deben fallar (401/403 o filas vacías).
5. **Videos:** `createSignedUrl` sin sesión válida no debe devolver URL.

## 5. Notas

- El **service role** (webhooks Stripe, Edge Functions) **no** está limitado por RLS.
- Si algo deja de funcionar tras aplicar el SQL, revisa que tu usuario admin tenga `role = 'admin'` en `profiles`.

## Usuarios creados antes de Stripe / precios

Si tienes estudiantes que ya existían en Supabase Auth antes del sistema de suscripciones, probablemente tienen `subscription_status = inactive` y **no pueden entrar** aunque la contraseña sea correcta.

Ejecuta `supabase/activate-legacy-users.sql` en el SQL Editor. Ese script:

1. Crea perfiles faltantes para usuarios en `auth.users`
2. Activa (`subscription_status = active`) a quienes **no** tienen suscripción Stripe
3. No modifica admins ni pagos pendientes en `pending_subscriptions`

- Tras ejecutar el SQL, no hace falta redeploy del sitio estático salvo el cambio en `student-guard.js` (merge del PR).
