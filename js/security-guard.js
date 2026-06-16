(function() {
  "use strict";

  const STORAGE_PREFIX = "pta_guard_";

  function now() {
    return Date.now();
  }

  function readAttempts(actionKey) {
    try {
      const raw = sessionStorage.getItem(STORAGE_PREFIX + actionKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function writeAttempts(actionKey, attempts) {
    try {
      sessionStorage.setItem(STORAGE_PREFIX + actionKey, JSON.stringify(attempts));
    } catch (_) {
      /* ignore quota */
    }
  }

  function pruneAttempts(attempts, windowMs) {
    const cutoff = now() - windowMs;
    return attempts.filter((timestamp) => timestamp > cutoff);
  }

  function initForm(formEl, options) {
    const settings = Object.assign(
      {
        honeypotName: "pta_website",
        minDelayMs: 2000
      },
      options || {}
    );

    if (!formEl || formEl.dataset.ptaGuardReady === "1") {
      return;
    }

    formEl.dataset.ptaGuardReady = "1";
    formEl.dataset.ptaFormReadyAt = String(now());

    if (!formEl.querySelector(`[name="${settings.honeypotName}"]`)) {
      const trap = document.createElement("input");
      trap.type = "text";
      trap.name = settings.honeypotName;
      trap.autocomplete = "off";
      trap.tabIndex = -1;
      trap.setAttribute("aria-hidden", "true");
      trap.style.cssText =
        "position:absolute;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";
      formEl.appendChild(trap);
    }
  }

  function validateSubmission(formEl, actionKey, options) {
    const settings = Object.assign(
      {
        honeypotName: "pta_website",
        minDelayMs: 2000,
        maxAttempts: 8,
        windowMs: 15 * 60 * 1000
      },
      options || {}
    );

    if (formEl) {
      const honeypot = formEl.querySelector(`[name="${settings.honeypotName}"]`);
      if (honeypot && String(honeypot.value || "").trim()) {
        return {
          ok: false,
          message: "No se pudo procesar el formulario."
        };
      }

      const readyAt = Number(formEl.dataset.ptaFormReadyAt || 0);
      if (readyAt && now() - readyAt < settings.minDelayMs) {
        return {
          ok: false,
          message: "Espera un momento antes de enviar."
        };
      }
    }

    const key = actionKey || "default";
    const pruned = pruneAttempts(readAttempts(key), settings.windowMs);
    if (pruned.length >= settings.maxAttempts) {
      const waitMs = settings.windowMs - (now() - pruned[0]);
      const waitSec = Math.max(1, Math.ceil(waitMs / 1000));
      return {
        ok: false,
        message: `Demasiados intentos. Espera ${waitSec} segundos e inténtalo de nuevo.`
      };
    }

    pruned.push(now());
    writeAttempts(key, pruned);
    return { ok: true };
  }

  function validateAction(actionKey, options) {
    return validateSubmission(null, actionKey, options);
  }

  window.PTASecurityGuard = {
    initForm,
    validateSubmission,
    validateAction
  };
})();
