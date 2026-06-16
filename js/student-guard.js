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

  async function applyPendingSubscription(supabase, userId, email) {
    if (!email) return;

    const { data: pending } = await supabase
      .from("pending_subscriptions")
      .select("plan,stripe_customer_id,stripe_subscription_id,subscription_status,subscription_current_period_end")
      .eq("email", String(email).toLowerCase())
      .maybeSingle();

    if (!pending) return;

    await supabase
      .from("profiles")
      .update({
        plan: pending.plan,
        stripe_customer_id: pending.stripe_customer_id,
        stripe_subscription_id: pending.stripe_subscription_id,
        subscription_status: pending.subscription_status || "active",
        subscription_current_period_end: pending.subscription_current_period_end
      })
      .eq("id", userId);

    await supabase
      .from("pending_subscriptions")
      .delete()
      .eq("email", String(email).toLowerCase());
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
    await applyPendingSubscription(supabase, session.user.id, session.user.email || "");
    const profile = await loadProfile(supabase, session.user.id);
    const isAdmin = profile.role === "admin";

    if (settings.requireActivePlan && !isAdmin && !isActiveSubscription(profile.subscription_status)) {
      redirectToPricing();
      return null;
    }

    if (
      settings.requiredPlan &&
      !isAdmin &&
      !canAccessPlan(profile.plan || "basico", settings.requiredPlan)
    ) {
      redirectToPricing();
      return null;
    }

    document.documentElement.classList.remove("student-guard-pending");
    return { session, profile, supabase, isAdmin };
  }

  async function getStudentAccess(supabase, userId, email) {
    await applyPendingSubscription(supabase, userId, email || "");
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
