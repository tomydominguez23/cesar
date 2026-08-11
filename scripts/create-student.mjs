#!/usr/bin/env node
/**
 * Crea o activa un estudiante en Supabase (plan + suscripción activa).
 *
 * Uso:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-student.mjs \
 *     --email Heydycarreno32@gmail.com \
 *     --password Protrading2026 \
 *     --plan basico \
 *     --name "Heydy Carreno"
 */

const SUPABASE_URL = process.env.SUPABASE_URL || "https://bkgkizlrtczrzryhrrjg.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      args[name] = true;
      continue;
    }
    args[name] = value;
    i += 1;
  }
  return args;
}

async function adminFetch(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message = typeof data === "object" && data
      ? data.msg || data.message || data.error || JSON.stringify(data)
      : String(data);
    throw new Error(`${response.status} ${path}: ${message}`);
  }

  return data;
}

async function findUserByEmail(email) {
  const users = await adminFetch(`/auth/v1/admin/users?email=${encodeURIComponent(email)}`);
  if (Array.isArray(users.users) && users.users.length > 0) {
    return users.users[0];
  }
  return null;
}

async function upsertProfile(userId, fullName, plan) {
  // Intentar upsert vía REST (service role bypasea RLS)
  try {
    await adminFetch("/rest/v1/profiles", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        id: userId,
        full_name: fullName,
        plan,
        role: "student",
        subscription_status: "active"
      })
    });
    return;
  } catch (error) {
    // Fallback: PATCH si ya existe
    await adminFetch(`/rest/v1/profiles?id=eq.${userId}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        full_name: fullName,
        plan,
        role: "student",
        subscription_status: "active"
      })
    });
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const email = (args.email || "").trim();
  const password = args.password || "";
  const plan = (args.plan || "basico").trim();
  const fullName = (args.name || "").trim() || email.split("@")[0];

  if (!SERVICE_ROLE_KEY) {
    console.error("Falta SUPABASE_SERVICE_ROLE_KEY en el entorno.");
    process.exit(1);
  }

  if (!email || !password) {
    console.error("Uso: node scripts/create-student.mjs --email correo@ejemplo.com --password Secreta123 --plan basico --name Nombre");
    process.exit(1);
  }

  let user = await findUserByEmail(email);

  if (!user) {
    user = await adminFetch("/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName }
      })
    });
    console.log("Usuario creado:", user.id);
  } else {
    user = await adminFetch(`/auth/v1/admin/users/${user.id}`, {
      method: "PUT",
      body: JSON.stringify({
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName }
      })
    });
    console.log("Usuario actualizado:", user.id);
  }

  await upsertProfile(user.id, fullName, plan);
  console.log("Perfil activado:", { email, plan, subscription_status: "active" });
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
