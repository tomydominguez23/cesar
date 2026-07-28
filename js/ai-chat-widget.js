(function() {
  "use strict";

  const HISTORY_LIMIT = 12;
  const STORAGE_OPEN_KEY = "pta-ai-chat-open";

  let rootEl = null;
  let panelEl = null;
  let messagesEl = null;
  let inputEl = null;
  let sendBtn = null;
  let statusEl = null;
  let history = [];
  let sending = false;
  let accessContext = null;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatReply(text) {
    return escapeHtml(text).replace(/\n/g, "<br>");
  }

  function isPortalPage() {
    return !!(document.body && document.body.classList.contains("portal-page"));
  }

  function isActiveSubscription(status) {
    return status === "active" || status === "trialing";
  }

  async function loadAiChatEnabled(supabase) {
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "ai_chat_enabled")
        .maybeSingle();
      if (error || !data) return false;
      return String(data.value).toLowerCase() === "true";
    } catch (_) {
      return false;
    }
  }

  async function resolveAccess() {
    const supabase = window.getSupabaseClient ? window.getSupabaseClient() : null;
    if (!supabase) return null;

    const { data, error } = await supabase.auth.getSession();
    if (error || !data || !data.session) return null;

    const userId = data.session.user.id;
    let profile = {};
    if (window.StudentGuard && window.StudentGuard.loadProfile) {
      profile = await window.StudentGuard.loadProfile(supabase, userId);
    } else {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name,plan,role,subscription_status")
        .eq("id", userId)
        .maybeSingle();
      profile = profileData || {};
    }

    const isAdmin = profile.role === "admin";
    const chatEnabled = await loadAiChatEnabled(supabase);
    const hasPlan = isActiveSubscription(profile.subscription_status);
    const canUse = isAdmin || (chatEnabled && hasPlan);

    return {
      supabase,
      session: data.session,
      profile,
      isAdmin,
      chatEnabled,
      canUse
    };
  }

  function createWidget(context) {
    if (document.getElementById("ptaAiChatRoot")) return;

    rootEl = document.createElement("div");
    rootEl.id = "ptaAiChatRoot";
    rootEl.className = "pta-ai-chat";
    if (context.isAdmin && !context.chatEnabled) {
      rootEl.classList.add("pta-ai-chat--admin-preview");
    }

    rootEl.innerHTML = `
      <button type="button" class="pta-ai-chat-launcher" id="ptaAiChatLauncher" aria-expanded="false" aria-controls="ptaAiChatPanel">
        <i class="fas fa-comments" aria-hidden="true"></i>
        <span class="pta-ai-chat-launcher-label">Asistente</span>
      </button>
      <section class="pta-ai-chat-panel" id="ptaAiChatPanel" hidden>
        <header class="pta-ai-chat-header">
          <div>
            <h3>Asistente Pro Trading</h3>
            <p id="ptaAiChatStatus">${context.isAdmin && !context.chatEnabled
              ? "Vista previa admin · flag apagado"
              : "Resuelve dudas de trading"}</p>
          </div>
          <button type="button" class="pta-ai-chat-close" id="ptaAiChatClose" aria-label="Cerrar chat">
            <i class="fas fa-xmark"></i>
          </button>
        </header>
        <div class="pta-ai-chat-messages" id="ptaAiChatMessages" role="log" aria-live="polite"></div>
        <form class="pta-ai-chat-form" id="ptaAiChatForm">
          <textarea
            id="ptaAiChatInput"
            rows="2"
            maxlength="2000"
            placeholder="Escribe tu duda de trading..."
            required
          ></textarea>
          <button type="submit" class="pta-ai-chat-send" id="ptaAiChatSend" aria-label="Enviar">
            <i class="fas fa-paper-plane"></i>
          </button>
        </form>
      </section>
    `;

    document.body.appendChild(rootEl);

    panelEl = document.getElementById("ptaAiChatPanel");
    messagesEl = document.getElementById("ptaAiChatMessages");
    inputEl = document.getElementById("ptaAiChatInput");
    sendBtn = document.getElementById("ptaAiChatSend");
    statusEl = document.getElementById("ptaAiChatStatus");

    document.getElementById("ptaAiChatLauncher").addEventListener("click", togglePanel);
    document.getElementById("ptaAiChatClose").addEventListener("click", closePanel);
    document.getElementById("ptaAiChatForm").addEventListener("submit", onSubmit);

    inputEl.addEventListener("keydown", function(event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        document.getElementById("ptaAiChatForm").requestSubmit();
      }
    });

    appendMessage(
      "assistant",
      context.isAdmin && !context.chatEnabled
        ? "Hola. Estás probando el asistente como administrador. Los alumnos aún no lo ven porque el flag está apagado."
        : "Hola. Soy el asistente de Pro Trading Academy. Pregúntame sobre la metodología, el portal o conceptos de trading."
    );

    try {
      if (window.sessionStorage.getItem(STORAGE_OPEN_KEY) === "1") {
        openPanel();
      }
    } catch (_) {
      /* ignore */
    }
  }

  function appendMessage(role, content) {
    if (!messagesEl) return;
    const bubble = document.createElement("div");
    bubble.className = "pta-ai-chat-bubble pta-ai-chat-bubble--" + role;
    bubble.innerHTML = formatReply(content);
    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function setSending(isSending) {
    sending = isSending;
    if (sendBtn) sendBtn.disabled = isSending;
    if (inputEl) inputEl.disabled = isSending;
  }

  function openPanel() {
    if (!panelEl) return;
    panelEl.hidden = false;
    rootEl.classList.add("is-open");
    const launcher = document.getElementById("ptaAiChatLauncher");
    if (launcher) launcher.setAttribute("aria-expanded", "true");
    try {
      window.sessionStorage.setItem(STORAGE_OPEN_KEY, "1");
    } catch (_) {
      /* ignore */
    }
    if (inputEl) inputEl.focus();
  }

  function closePanel() {
    if (!panelEl) return;
    panelEl.hidden = true;
    rootEl.classList.remove("is-open");
    const launcher = document.getElementById("ptaAiChatLauncher");
    if (launcher) launcher.setAttribute("aria-expanded", "false");
    try {
      window.sessionStorage.setItem(STORAGE_OPEN_KEY, "0");
    } catch (_) {
      /* ignore */
    }
  }

  function togglePanel() {
    if (!panelEl) return;
    if (panelEl.hidden) openPanel();
    else closePanel();
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (sending || !accessContext) return;

    const message = String(inputEl.value || "").trim();
    if (!message) return;

    appendMessage("user", message);
    history.push({ role: "user", content: message });
    if (history.length > HISTORY_LIMIT) {
      history = history.slice(-HISTORY_LIMIT);
    }
    inputEl.value = "";
    setSending(true);
    appendMessage("assistant", "Pensando...");
    const thinkingBubble = messagesEl.lastElementChild;

    try {
      const { data, error } = await accessContext.supabase.functions.invoke("trading-assistant", {
        body: {
          message,
          history: history.slice(0, -1)
        }
      });

      if (thinkingBubble) thinkingBubble.remove();

      if (error) {
        throw error;
      }
      if (data && data.error) {
        throw new Error(data.error);
      }

      const reply = data && data.reply
        ? String(data.reply)
        : "No pude generar una respuesta ahora. Intenta de nuevo.";

      appendMessage("assistant", reply);
      history.push({ role: "assistant", content: reply });
      if (history.length > HISTORY_LIMIT) {
        history = history.slice(-HISTORY_LIMIT);
      }

      if (statusEl && data && data.provider === "stub") {
        statusEl.textContent = accessContext.isAdmin && !accessContext.chatEnabled
          ? "Vista previa admin · respuesta provisional"
          : "Respuesta provisional (IA aún no conectada)";
      }
    } catch (err) {
      if (thinkingBubble) thinkingBubble.remove();
      const msg = err && err.message ? err.message : "No se pudo contactar al asistente.";
      appendMessage("assistant", "Error: " + msg);
    } finally {
      setSending(false);
      if (inputEl) inputEl.focus();
    }
  }

  async function initAiChatWidget() {
    if (!isPortalPage()) return;

    // Esperar a que el guard termine si está presente.
    let attempts = 0;
    while (document.documentElement.classList.contains("student-guard-pending") && attempts < 40) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts += 1;
    }

    accessContext = await resolveAccess();
    if (!accessContext || !accessContext.canUse) return;
    createWidget(accessContext);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAiChatWidget);
  } else {
    initAiChatWidget();
  }

  window.PTAAiChatWidget = {
    init: initAiChatWidget
  };
})();
