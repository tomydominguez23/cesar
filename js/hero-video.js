(function() {
  "use strict";

  const STORAGE_VIDEO_PATH = "branding/hero-video";
  const STORAGE_POSTER_PATH = "branding/hero-video-poster";
  const VIDEO_VERSION_KEY = "pta-hero-video-version";
  const FALLBACK_SUPABASE_URL = "https://bkgkizlrtczrzryhrrjg.supabase.co";

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

  function rememberVideoVersion(version) {
    if (!version) return;
    try {
      window.localStorage.setItem(VIDEO_VERSION_KEY, String(version));
    } catch (_) {
      /* ignore */
    }
  }

  function readStoredVideoVersion() {
    try {
      return window.localStorage.getItem(VIDEO_VERSION_KEY) || "";
    } catch (_) {
      return "";
    }
  }

  function getConfiguredVideoUrl() {
    const config = window.SUPABASE_CONFIG || {};
    return String(config.heroVideoUrl || window.PTA_HERO_VIDEO_URL || "").trim();
  }

  function getConfiguredPosterUrl() {
    const config = window.SUPABASE_CONFIG || {};
    return String(config.heroVideoPosterUrl || window.PTA_HERO_VIDEO_POSTER_URL || "").trim();
  }

  function parseEmbedUrl(rawUrl) {
    if (!rawUrl) return null;
    let url;
    try {
      url = new URL(rawUrl);
    } catch (_) {
      return null;
    }

    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const id = url.pathname.replace(/^\//, "").split("/")[0];
      if (!id) return null;
      return {
        type: "iframe",
        src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1`
      };
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      let id = url.searchParams.get("v");
      if (!id && url.pathname.startsWith("/embed/")) {
        id = url.pathname.split("/")[2];
      }
      if (!id && url.pathname.startsWith("/shorts/")) {
        id = url.pathname.split("/")[2];
      }
      if (!id) return null;
      return {
        type: "iframe",
        src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1`
      };
    }

    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      const id = host === "player.vimeo.com" ? parts[1] : parts[0];
      if (!id || !/^\d+$/.test(id)) return null;
      return {
        type: "iframe",
        src: `https://player.vimeo.com/video/${encodeURIComponent(id)}?title=0&byline=0&portrait=0`
      };
    }

    if (/\.(mp4|webm|ogg|m4v)(\?|$)/i.test(url.pathname + url.search)) {
      return { type: "file", src: rawUrl };
    }

    return { type: "file", src: rawUrl };
  }

  function buildPublicUrl(path, version) {
    const baseUrl = `${getSupabaseBaseUrl()}/storage/v1/object/public/media-library/${path}`;
    return appendCacheBuster(baseUrl, version);
  }

  async function probeUrl(url) {
    if (!url) return false;
    try {
      const headResponse = await fetch(url, { method: "HEAD", cache: "no-store" });
      if (headResponse && headResponse.ok) return true;
    } catch (_) {
      /* algunos hosts no aceptan HEAD */
    }

    // Fallback ligero: pedir solo 1 byte y abortar.
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    try {
      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        headers: { Range: "bytes=0-0" },
        signal: controller ? controller.signal : undefined
      });
      if (controller) {
        setTimeout(function() { controller.abort(); }, 0);
      }
      return !!(response && (response.ok || response.status === 206));
    } catch (_) {
      return false;
    }
  }

  async function fetchVideoVersionFromStorage(client) {
    if (!client || !client.storage) return null;
    try {
      const { data, error } = await client.storage
        .from("media-library")
        .list("branding", { limit: 40, sortBy: { column: "updated_at", order: "desc" } });
      if (error || !Array.isArray(data)) return null;

      const videoFile = data.find((item) => {
        const name = String(item && item.name ? item.name : "");
        return name === "hero-video" || name.startsWith("hero-video.");
      });
      if (!videoFile) return null;

      const stamp = videoFile.updated_at || videoFile.created_at || videoFile.id;
      return stamp ? String(stamp) : null;
    } catch (_) {
      return null;
    }
  }

  async function resolveCacheVersion() {
    const client = window.getSupabaseClient ? window.getSupabaseClient() : null;
    const remoteVersion = client
      ? await fetchVideoVersionFromStorage(client)
      : null;
    const version = remoteVersion || readStoredVideoVersion() || String(Date.now());
    if (remoteVersion) rememberVideoVersion(remoteVersion);
    return version;
  }

  function escapeAttr(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function getMount() {
    return document.getElementById("heroVideoMount");
  }

  function getFallback() {
    return document.getElementById("heroVideoFallback");
  }

  function showFallback() {
    const mount = getMount();
    const fallback = getFallback();
    if (mount) {
      mount.hidden = true;
      mount.innerHTML = "";
    }
    if (fallback) {
      fallback.hidden = false;
    }
  }

  function showMount() {
    const mount = getMount();
    const fallback = getFallback();
    if (fallback) fallback.hidden = true;
    if (mount) mount.hidden = false;
  }

  function renderIframe(src) {
    const mount = getMount();
    if (!mount) return;
    showMount();
    const safeSrc = escapeAttr(src);
    mount.innerHTML = `
      <div class="hero-video-frame">
        <iframe
          class="hero-video-embed"
          src="${safeSrc}"
          title="Video de presentación Pro Trading Academy USA"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
          referrerpolicy="strict-origin-when-cross-origin"
        ></iframe>
      </div>
      <div class="hero-video-caption">
        <span><i class="fas fa-play-circle"></i> Mira cómo funciona la academia</span>
        <a href="#pricing" class="hero-video-cta">Ver planes</a>
      </div>
    `;
  }

  function renderFileVideo(src, poster) {
    const mount = getMount();
    if (!mount) return;
    showMount();
    const safeSrc = escapeAttr(src);
    const posterAttr = poster ? ` poster="${escapeAttr(poster)}"` : "";
    mount.innerHTML = `
      <div class="hero-video-frame">
        <video
          class="hero-video-player"
          controls
          playsinline
          preload="metadata"${posterAttr}
        >
          <source src="${safeSrc}" type="video/mp4">
          Tu navegador no soporta video HTML5.
        </video>
      </div>
      <div class="hero-video-caption">
        <span><i class="fas fa-play-circle"></i> Mira cómo funciona la academia</span>
        <a href="#pricing" class="hero-video-cta">Ver planes</a>
      </div>
    `;
  }

  async function resolveStorageVideo(version) {
    const videoUrl = buildPublicUrl(STORAGE_VIDEO_PATH, version);
    const exists = await probeUrl(videoUrl);
    if (!exists) return null;

    let posterUrl = getConfiguredPosterUrl();
    if (!posterUrl) {
      const candidatePoster = buildPublicUrl(STORAGE_POSTER_PATH, version);
      if (await probeUrl(candidatePoster)) {
        posterUrl = candidatePoster;
      }
    }

    return { src: videoUrl, poster: posterUrl || "" };
  }

  async function initHeroVideo() {
    const mount = getMount();
    if (!mount) return;

    const configured = getConfiguredVideoUrl();
    if (configured) {
      const parsed = parseEmbedUrl(configured);
      if (parsed && parsed.type === "iframe") {
        renderIframe(parsed.src);
        return;
      }
      if (parsed && parsed.type === "file") {
        renderFileVideo(parsed.src, getConfiguredPosterUrl());
        return;
      }
    }

    try {
      const version = await resolveCacheVersion();
      const storageVideo = await resolveStorageVideo(version);
      if (storageVideo) {
        renderFileVideo(storageVideo.src, storageVideo.poster);
        return;
      }
    } catch (_) {
      /* fallback below */
    }

    showFallback();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHeroVideo);
  } else {
    initHeroVideo();
  }

  window.addEventListener("pta-hero-video-updated", initHeroVideo);
})();
