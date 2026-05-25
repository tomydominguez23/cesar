(function() {
  "use strict";

  const LOGO_SELECTOR = ".brand-logo";
  const STORAGE_LOGO_PATH = "branding/header-logo";
  const LOGO_VERSION_KEY = "pta-header-logo-version";
  const FALLBACK_SUPABASE_URL = "https://bkgkizlrtczrzryhrrjg.supabase.co";
  const STATIC_LOGO_FILES = [
    "header-logo.webp",
    "header-logo.png",
    "header-logo.jpg",
    "header-logo.jpeg",
    "header-logo.svg"
  ];

  let logoVersionPromise = null;

  function getLogoElements() {
    return Array.from(document.querySelectorAll(LOGO_SELECTOR));
  }

  function getConfiguredOverrideUrl() {
    const config = window.SUPABASE_CONFIG || {};
    return config.headerLogoUrl || window.PTA_HEADER_LOGO_URL || "";
  }

  function getSupabaseBaseUrl() {
    const configuredUrl = window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url
      ? window.SUPABASE_CONFIG.url
      : FALLBACK_SUPABASE_URL;
    return String(configuredUrl || "").replace(/\/+$/, "");
  }

  function appendCacheBuster(url, version) {
    if (!url || !version) return url;
    const joiner = url.includes("?") ? "&" : "?";
    return `${url}${joiner}v=${encodeURIComponent(version)}`;
  }

  function rememberLogoVersion(version) {
    if (!version) return;
    try {
      window.localStorage.setItem(LOGO_VERSION_KEY, String(version));
    } catch (_) {
      /* ignore quota errors */
    }
  }

  function readStoredLogoVersion() {
    try {
      return window.localStorage.getItem(LOGO_VERSION_KEY) || "";
    } catch (_) {
      return "";
    }
  }

  function getStaticAssetBases() {
    const bases = new Set(["assets/", "../assets/"]);
    const logos = getLogoElements();
    logos.forEach((img) => {
      const src = img.getAttribute("src") || img.dataset.defaultSrc || "";
      const match = src.match(/^(?:\.\.\/)?assets\//);
      if (match) {
        bases.add(match[0]);
      }
    });
    return Array.from(bases);
  }

  function buildStaticLogoCandidates(version) {
    const bases = getStaticAssetBases();
    const urls = [];
    bases.forEach((base) => {
      STATIC_LOGO_FILES.forEach((fileName) => {
        urls.push(appendCacheBuster(`${base}${fileName}`, version));
      });
    });
    return urls;
  }

  async function fetchLogoVersionFromStorage(client) {
    if (!client || !client.storage) return null;

    try {
      const { data, error } = await client.storage
        .from("media-library")
        .list("branding", { limit: 20, sortBy: { column: "updated_at", order: "desc" } });
      if (error || !Array.isArray(data)) return null;

      const logoFile = data.find((item) => {
        const name = String(item && item.name ? item.name : "");
        return name === "header-logo" || name.startsWith("header-logo.");
      });
      if (!logoFile) return null;

      const stamp = logoFile.updated_at || logoFile.created_at || logoFile.id;
      return stamp ? String(stamp) : null;
    } catch (_) {
      return null;
    }
  }

  async function fetchLogoVersionFromPublicHead() {
    const baseUrl = `${getSupabaseBaseUrl()}/storage/v1/object/public/media-library/${STORAGE_LOGO_PATH}`;
    try {
      const response = await fetch(baseUrl, { method: "HEAD", cache: "no-store" });
      if (!response.ok) return null;
      return response.headers.get("last-modified")
        || response.headers.get("etag")
        || null;
    } catch (_) {
      return null;
    }
  }

  async function resolveLogoCacheVersion() {
    if (!logoVersionPromise) {
      logoVersionPromise = (async () => {
        const client = window.getSupabaseClient ? window.getSupabaseClient() : null;
        const remoteVersion = client
          ? await fetchLogoVersionFromStorage(client)
          : await fetchLogoVersionFromPublicHead();

        const version = remoteVersion || readStoredLogoVersion() || "";
        if (version) rememberLogoVersion(version);
        return version;
      })();
    }

    return logoVersionPromise;
  }

  function buildPublicLogoUrl(version) {
    const baseUrl = `${getSupabaseBaseUrl()}/storage/v1/object/public/media-library/${STORAGE_LOGO_PATH}`;
    return appendCacheBuster(baseUrl, version);
  }

  function preloadImage(url) {
    return new Promise((resolve, reject) => {
      const probe = new Image();
      probe.decoding = "async";
      probe.onload = function() {
        resolve(url);
      };
      probe.onerror = function() {
        reject(new Error("No se pudo cargar el logo."));
      };
      probe.src = url;
    });
  }

  async function preloadFirstAvailable(urls) {
    for (let i = 0; i < urls.length; i += 1) {
      const candidate = urls[i];
      if (!candidate) continue;
      try {
        return await preloadImage(candidate);
      } catch (_) {
        /* try next */
      }
    }
    return null;
  }

  function markLogoPending() {
    getLogoElements().forEach((img) => {
      img.classList.add("logo-pending");
      img.classList.remove("logo-dynamic-source", "logo-fallback-ready");
      img.removeAttribute("src");
    });
  }

  function applyLoadedLogo(url, sourceType) {
    const logoElements = getLogoElements();
    logoElements.forEach((img) => {
      img.classList.remove("logo-pending");
      img.classList.remove("logo-fallback-ready");
      img.classList.add("logo-dynamic-source");
      if (sourceType === "static") {
        img.classList.add("logo-fallback-ready");
      }
      img.onerror = function() {
        markLogoPending();
        applyDynamicLogo();
      };
      img.src = url;
    });
  }

  function hideLogo() {
    getLogoElements().forEach((img) => {
      img.classList.add("logo-pending");
      img.classList.remove("logo-dynamic-source", "logo-fallback-ready");
      img.removeAttribute("src");
    });
  }

  async function trySignedLogoUrl(version) {
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
        .createSignedUrl(STORAGE_LOGO_PATH, 60 * 60);
      if (error || !data || !data.signedUrl) {
        return null;
      }
      return appendCacheBuster(data.signedUrl, version);
    } catch (_) {
      return null;
    }
  }

  async function resolveDynamicLogoUrl(version) {
    const signedLogo = await trySignedLogoUrl(version);
    if (signedLogo) return signedLogo;
    return buildPublicLogoUrl(version);
  }

  async function applyDynamicLogo() {
    const logos = getLogoElements();
    if (!logos.length) return;

    markLogoPending();

    const version = await resolveLogoCacheVersion();
    const candidates = [];

    const overrideUrl = getConfiguredOverrideUrl();
    if (overrideUrl) {
      candidates.push(appendCacheBuster(overrideUrl, version));
    }

    buildStaticLogoCandidates(version).forEach((url) => candidates.push(url));

    const staticLoaded = await preloadFirstAvailable(candidates);
    if (staticLoaded) {
      applyLoadedLogo(staticLoaded, "static");
      return;
    }

    const dynamicUrl = await resolveDynamicLogoUrl(version);
    if (dynamicUrl) {
      try {
        const loadedUrl = await preloadImage(dynamicUrl);
        applyLoadedLogo(loadedUrl, "remote");
        return;
      } catch (_) {
        /* continue */
      }
    }

    hideLogo();
    if (window.console && console.warn) {
      console.warn(
        "[Pro Trading Academy] No se pudo cargar el logo. Sube assets/header-logo.png en cPanel o ejecuta supabase/storage-public-logo.sql y vuelve a subir el logo en Mediateca."
      );
    }
  }

  function resetLogoVersionCache() {
    logoVersionPromise = null;
  }

  function initBrandingLogo() {
    applyDynamicLogo();
    window.addEventListener("pta-logo-updated", function() {
      resetLogoVersionCache();
      applyDynamicLogo();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBrandingLogo);
  } else {
    initBrandingLogo();
  }
})();
