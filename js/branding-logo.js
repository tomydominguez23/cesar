(function() {
  "use strict";

  const LOGO_SELECTOR = ".brand-logo";
  const STORAGE_LOGO_PATH = "branding/header-logo";
  const LOGO_VERSION_KEY = "pta-header-logo-version";
  const FALLBACK_SUPABASE_URL = "https://bkgkizlrtczrzryhrrjg.supabase.co";

  function getLogoElements() {
    return Array.from(document.querySelectorAll(LOGO_SELECTOR));
  }

  function buildPublicLogoUrl() {
    const configuredUrl = window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url
      ? window.SUPABASE_CONFIG.url
      : FALLBACK_SUPABASE_URL;
    const cleanBase = String(configuredUrl || "").replace(/\/+$/, "");
    const version = window.localStorage.getItem(LOGO_VERSION_KEY) || "";
    const cacheBuster = version ? `?v=${encodeURIComponent(version)}` : "";
    return `${cleanBase}/storage/v1/object/public/media-library/${STORAGE_LOGO_PATH}${cacheBuster}`;
  }

  function setLogoSrc(src, isDynamicSource) {
    if (!src) return;
    const logoElements = getLogoElements();
    logoElements.forEach((img) => {
      if (!img.dataset.defaultSrc) {
        img.dataset.defaultSrc = img.getAttribute("src") || "";
      }
      if (isDynamicSource) {
        img.classList.add("logo-dynamic-source");
        img.classList.remove("logo-fallback-ready");
      } else {
        img.classList.remove("logo-dynamic-source");
        img.classList.add("logo-fallback-ready");
      }
      img.src = src;
      img.onerror = function() {
        img.classList.remove("logo-dynamic-source");
        img.classList.add("logo-fallback-ready");
        if (img.dataset.defaultSrc) {
          img.src = img.dataset.defaultSrc;
        }
      };
    });
  }

  async function trySignedLogoUrl() {
    if (!window.getSupabaseClient || !window.supabase || !window.supabase.createClient) {
      return null;
    }

    const client = window.getSupabaseClient();
    if (!client || !client.storage) {
      return null;
    }

    try {
      const { data, error } = await client.storage
        .from("media-library")
        .createSignedUrl(STORAGE_LOGO_PATH, 60 * 60 * 24 * 7);
      if (error || !data || !data.signedUrl) {
        return null;
      }
      const version = window.localStorage.getItem(LOGO_VERSION_KEY) || "";
      return version ? `${data.signedUrl}&v=${encodeURIComponent(version)}` : data.signedUrl;
    } catch (_) {
      return null;
    }
  }

  async function applyDynamicLogo() {
    const logos = getLogoElements();
    if (!logos.length) return;

    const signedLogo = await trySignedLogoUrl();
    if (signedLogo) {
      setLogoSrc(signedLogo, true);
      return;
    }

    setLogoSrc(buildPublicLogoUrl(), true);
  }

  function initBrandingLogo() {
    applyDynamicLogo();
    window.addEventListener("pta-logo-updated", applyDynamicLogo);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBrandingLogo);
  } else {
    initBrandingLogo();
  }
})();
