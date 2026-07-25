(function() {
  "use strict";

  const defaultConfig = {
    url: "https://bkgkizlrtczrzryhrrjg.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrZ2tpemxydGN6cnpyeWhycmpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzQ2NzIsImV4cCI6MjA5MzY1MDY3Mn0.A97sd1Fqgxyys8SSjQJ6KctgqSdh9UIz2I2ZACLgxiU",
    // Opcional: URL directa del logo (p. ej. assets/header-logo.png en tu dominio)
    headerLogoUrl: "",
    // Opcional: URL del video del hero (MP4 público, YouTube o Vimeo).
    // Si está vacío, se usa media-library/branding/hero-video en Supabase Storage.
    heroVideoUrl: "",
    // Opcional: imagen de portada del video del hero
    heroVideoPosterUrl: ""
  };

  window.SUPABASE_CONFIG = Object.assign({}, defaultConfig, window.SUPABASE_CONFIG || {});

  // La anonKey es pública por diseño; la seguridad real está en RLS (student-access-rls.sql).

  let cachedClient = null;

  window.getSupabaseClient = function() {
    if (cachedClient) {
      return cachedClient;
    }

    if (!window.supabase || !window.supabase.createClient) {
      console.error("Supabase SDK no está cargado.");
      return null;
    }

    const config = window.SUPABASE_CONFIG || {};
    if (!config.url || !config.anonKey) {
      console.error("Falta configurar SUPABASE_CONFIG (url y anonKey).");
      return null;
    }

    cachedClient = window.supabase.createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    return cachedClient;
  };
})();
