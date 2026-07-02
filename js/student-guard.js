(function() {
  "use strict";

  const PLAN_RANK = {
    basico: 1,
    medio: 2,
    avanzado: 3,
    pro: 4
  };

  function getSupabase() {
    return window.getSupabaseClient ? window.getSupabaseClient() : null;
  }

  function redirectToLogin() {
    const page = window.location.pathname.split("/").pop() || "dashboard.html";
    const next = encodeURIComponent(`${page}${window.location.search}`);
    window.location.href = `login.html?next=${next}`;
  }

  function redirectToPricing() {
    window.location.href = "index.html#pricing";
  }

  function isActiveSubscription(status) {
    return status === "active" || status === "trialing";
  }

  function canAccessPlan(userPlan, requiredPlan) {
    const userRank = PLAN_RANK[userPlan] || 0;
    const requiredRank = PLAN_RANK[requiredPlan] || 99;
    return userRank >= requiredRank;
  }

  async function loadProfile(supabase, userId) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name,plan,role,subscription_status")
      .eq("id", userId)
      .maybeSingle();
    return data || {};
  }

  async function applyPendingSubscription(supabase) {
    if (!supabase || !supabase.rpc) return;

    const { error } = await supabase.rpc("apply_pending_subscription");
    if (error) {
      // Compatibilidad si el SQL aún no se ejecutó en Supabase.
      console.warn("apply_pending_subscription:", error.message);
    }
  }

  function showGuardLoading() {
    if (document.getElementById("pta-guard-loading")) return;
    const overlay = document.createElement("div");
    overlay.id = "pta-guard-loading";
    overlay.className = "pta-guard-loading";
    overlay.innerHTML = '<div class="pta-guard-spinner"></div><p>Verificando acceso...</p>';
    document.body.appendChild(overlay);
  }

  function hideGuardLoading() {
    document.documentElement.classList.remove("student-guard-pending");
    const overlay = document.getElementById("pta-guard-loading");
    if (overlay) overlay.remove();
  }

  if (document.documentElement.classList.contains("student-guard-pending")) {
    document.addEventListener("DOMContentLoaded", showGuardLoading);
  }

  async function requireStudentAccess(options) {
    const settings = Object.assign(
      { requireActivePlan: true, requiredPlan: null },
      options || {}
    );

    const supabase = getSupabase();
    if (!supabase) {
      redirectToLogin();
      return null;
    }

    const { data, error } = await supabase.auth.getSession();
    if (error || !data || !data.session) {
      redirectToLogin();
      return null;
    }

    const session = data.session;
    await applyPendingSubscription(supabase);
    const profile = await loadProfile(supabase, session.user.id);
    const isAdmin = profile.role === "admin";

    if (settings.requireActivePlan && !isAdmin && !isActiveSubscription(profile.subscription_status)) {
      hideGuardLoading();
      redirectToPricing();
      return null;
    }

    if (
      settings.requiredPlan &&
      !isAdmin &&
      !canAccessPlan(profile.plan || "basico", settings.requiredPlan)
    ) {
      hideGuardLoading();
      redirectToPricing();
      return null;
    }

    hideGuardLoading();
    return { session, profile, supabase, isAdmin };
  }

  async function getStudentAccess(supabase, userId) {
    await applyPendingSubscription(supabase);
    const profile = await loadProfile(supabase, userId);
    const isAdmin = profile.role === "admin";
    const hasAccess = isAdmin || isActiveSubscription(profile.subscription_status);
    return { profile, hasAccess, isAdmin };
  }

  window.StudentGuard = {
    PLAN_RANK,
    canAccessPlan,
    isActiveSubscription,
    requireStudentAccess,
    getStudentAccess,
    redirectToLogin,
    redirectToPricing,
    applyPendingSubscription,
    loadProfile
  };
})();
