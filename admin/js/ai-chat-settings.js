(function() {
  "use strict";

  const SETTING_KEY = "ai_chat_enabled";

  function toast(type, title, message) {
    if (window.AdminToast && typeof window.AdminToast[type] === "function") {
      window.AdminToast[type](title, message);
      return;
    }
    alert((title ? title + ": " : "") + (message || ""));
  }

  async function ensureAdmin(supabase) {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data || !data.session) {
      throw new Error("Inicia sesión en el panel admin.");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.session.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile || profile.role !== "admin") {
      throw new Error("Solo administradores pueden cambiar este flag.");
    }
    return true;
  }

  async function readFlag(supabase) {
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", SETTING_KEY)
      .maybeSingle();

    if (error) {
      throw error;
    }
    return !!(data && String(data.value).toLowerCase() === "true");
  }

  async function writeFlag(supabase, enabled) {
    const { error } = await supabase
      .from("site_settings")
      .upsert(
        {
          key: SETTING_KEY,
          value: enabled ? "true" : "false",
          updated_at: new Date().toISOString()
        },
        { onConflict: "key" }
      );

    if (error) throw error;
  }

  function updateUiState(enabled, hintEl, badgeEl) {
    if (hintEl) {
      hintEl.textContent = enabled
        ? "Flag prendido: los alumnos con suscripción activa verán el widget en el portal."
        : "Flag apagado: solo tú (admin) ves el widget para probarlo.";
    }
    if (badgeEl) {
      badgeEl.textContent = enabled ? "Visible para alumnos" : "Solo admin";
      badgeEl.className = enabled ? "status-badge active" : "status-badge pending";
    }
  }

  async function initAiChatSettings() {
    const toggle = document.getElementById("aiChatEnabledToggle");
    const hintEl = document.getElementById("aiChatEnabledHint");
    const badgeEl = document.getElementById("aiChatEnabledBadge");
    if (!toggle) return;

    const supabase = window.getSupabaseClient ? window.getSupabaseClient() : null;
    if (!supabase) {
      if (hintEl) {
        hintEl.textContent = "No se pudo conectar con Supabase para cargar el flag.";
      }
      toggle.disabled = true;
      return;
    }

    try {
      await ensureAdmin(supabase);
      const enabled = await readFlag(supabase);
      toggle.checked = enabled;
      updateUiState(enabled, hintEl, badgeEl);
    } catch (err) {
      toggle.disabled = true;
      if (hintEl) {
        hintEl.textContent = (err && err.message)
          ? err.message
          : "Ejecuta supabase/site-settings.sql en Supabase para habilitar este control.";
      }
      return;
    }

    toggle.addEventListener("change", async function() {
      const nextValue = !!toggle.checked;
      toggle.disabled = true;
      try {
        await writeFlag(supabase, nextValue);
        updateUiState(nextValue, hintEl, badgeEl);
        toast(
          "success",
          nextValue ? "Chat visible para alumnos" : "Chat solo para admin",
          nextValue
            ? "El widget aparecerá en el portal para suscriptores activos."
            : "Los alumnos ya no verán el asistente. Tú sí puedes seguir probándolo."
        );
      } catch (err) {
        toggle.checked = !nextValue;
        toast("error", "No se pudo guardar", err.message || "Error al actualizar el flag.");
      } finally {
        toggle.disabled = false;
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAiChatSettings);
  } else {
    initAiChatSettings();
  }
})();
