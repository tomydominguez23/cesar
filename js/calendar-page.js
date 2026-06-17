(function() {
  "use strict";

  const FALLBACK_ZOOM_QA_URL =
    "https://us06web.zoom.us/j/89321452328?pwd=Kcvax5ze3cXh5t5JBGXPynvcRGU4PC.1";

  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const events = {
    weekly: {
      1: [{ name: "Preguntas y Respuestas - 4:00 PM Arizona", type: "live" }],
      3: [{ name: "Preguntas y Respuestas - 4:00 PM Arizona", type: "live" }],
      5: [{ name: "Preguntas y Respuestas - 4:00 PM Arizona", type: "live" }]
    },
    special: {}
  };

  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth();

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function planLabel(plan) {
    if (plan === "basico") return "Básico";
    if (plan === "medio") return "Medio";
    if (plan === "avanzado") return "Avanzado";
    if (plan === "pro") return "Pro";
    return "Estudiante";
  }

  function renderShell(profile, zoomUrl) {
    const zoomHref = zoomUrl || FALLBACK_ZOOM_QA_URL;
    const studentName = (profile && profile.full_name) || "Estudiante";
    const studentPlan = planLabel(profile && profile.plan);
    const initials = studentName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "ES";

    return `
      <nav class="dash-navbar">
        <div class="container-lg">
          <div style="display:flex; align-items:center; gap:32px;">
            <a href="index.html" class="navbar-brand">
              <img class="brand-logo" src="assets/logo-pro-trading-academy-usa.svg" alt="Pro Trading Academy USA">
            </a>
            <div class="dash-nav-links">
              <a href="dashboard.html"><i class="fas fa-th-large"></i> Mis programas</a>
              <a href="calendar.html" class="active"><i class="fas fa-calendar-alt"></i> Calendario eventos</a>
              <a href="faq.html"><i class="fas fa-question-circle"></i> FAQ</a>
            </div>
          </div>
          <div class="dash-user">
            <div style="text-align:right;">
              <div style="font-size:0.85rem; font-weight:600;">${escapeHtml(studentName)}</div>
              <div style="font-size:0.75rem; opacity:0.7;">Plan ${escapeHtml(studentPlan)}</div>
            </div>
            <div class="dash-user-avatar">${escapeHtml(initials)}</div>
          </div>
        </div>
      </nav>

      <div class="dash-header" style="padding:40px 0;">
        <div class="container-lg">
          <div class="dash-header-content text-center">
            <h2 style="color:var(--white); font-size:2rem; margin-bottom:8px;">Calendario de Clases y Eventos</h2>
            <p style="color:rgba(255,255,255,0.7); font-size:1.05rem; max-width:700px; margin:0 auto;">
              Clases fijas de Preguntas y Respuestas: lunes, miércoles y viernes a las 16:00 (hora Arizona). Usa el botón para unirte directo por Zoom.
            </p>
          </div>
        </div>
      </div>

      <main style="padding:32px 0 80px;">
        <div class="container-lg">
          <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:16px; margin-bottom:32px;">
            <div style="background:var(--white); border-radius:var(--radius-md); padding:20px; border:1px solid var(--gray-200); border-left:4px solid #3b82f6;">
              <div style="font-size:0.75rem; color:var(--gray-500); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Frecuencia</div>
              <div style="font-weight:700; font-size:0.95rem; margin-bottom:4px;">Preguntas y Respuestas</div>
              <div style="font-size:0.85rem; color:var(--info); font-weight:500;"><i class="fas fa-calendar-day"></i> Lunes - Miércoles - Viernes</div>
            </div>
            <div style="background:var(--white); border-radius:var(--radius-md); padding:20px; border:1px solid var(--gray-200); border-left:4px solid #10b981;">
              <div style="font-size:0.75rem; color:var(--gray-500); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Horario</div>
              <div style="font-weight:700; font-size:0.95rem; margin-bottom:4px;">16:00</div>
              <div style="font-size:0.85rem; color:var(--success); font-weight:500;"><i class="fas fa-clock"></i> Hora Arizona</div>
            </div>
            <div style="background:var(--white); border-radius:var(--radius-md); padding:20px; border:1px solid var(--gray-200); border-left:4px solid #8b5cf6;">
              <div style="font-size:0.75rem; color:var(--gray-500); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Formato</div>
              <div style="font-weight:700; font-size:0.95rem; margin-bottom:4px;">Sesión en vivo por Zoom</div>
              <div style="font-size:0.85rem; color:#8b5cf6; font-weight:500;"><i class="fas fa-video"></i> Enlace exclusivo</div>
            </div>
            <div style="background:var(--white); border-radius:var(--radius-md); padding:20px; border:1px solid var(--gray-200); border-left:4px solid var(--secondary); display:flex; flex-direction:column; justify-content:space-between; gap:8px;">
              <div>
                <div style="font-size:0.75rem; color:var(--gray-500); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Acceso rápido</div>
                <div style="font-weight:700; font-size:0.95rem; margin-bottom:4px;">Unirse a la sesión</div>
              </div>
              <a href="${escapeHtml(zoomHref)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-primary" style="width:fit-content;">
                <i class="fas fa-video"></i> Abrir Zoom
              </a>
            </div>
          </div>

          <div class="calendar-container">
            <div class="calendar-header">
              <div class="calendar-nav">
                <button type="button" data-cal-action="prev"><i class="fas fa-chevron-left"></i></button>
                <button type="button" data-cal-action="today" style="padding:8px 16px;">Hoy</button>
                <button type="button" data-cal-action="next"><i class="fas fa-chevron-right"></i></button>
                <h3 class="calendar-month" id="calendarMonth"></h3>
              </div>
              <div class="calendar-view-toggle">
                <button type="button" class="active"><i class="fas fa-th"></i> Mes</button>
                <button type="button"><i class="fas fa-list"></i> Lista</button>
              </div>
            </div>

            <div style="padding:12px 32px; border-bottom:1px solid var(--gray-200); display:flex; gap:20px; flex-wrap:wrap;">
              <div style="display:flex; align-items:center; gap:6px; font-size:0.8rem;">
                <div style="width:12px; height:12px; border-radius:3px; background:rgba(59,130,246,0.15); border:1px solid rgba(59,130,246,0.3);"></div>
                <span style="color:var(--gray-600);">Preguntas y Respuestas (16:00 Arizona)</span>
              </div>
            </div>

            <div class="calendar-grid" id="calendarGrid">
              <div class="calendar-day-header">DOM</div>
              <div class="calendar-day-header">LUN</div>
              <div class="calendar-day-header">MAR</div>
              <div class="calendar-day-header">MIE</div>
              <div class="calendar-day-header">JUE</div>
              <div class="calendar-day-header">VIE</div>
              <div class="calendar-day-header">SAB</div>
            </div>
            <div class="calendar-grid" id="calendarDays"></div>
          </div>

          <div style="margin-top:40px;">
            <h3 style="margin-bottom:20px;"><i class="fas fa-list-alt" style="color:var(--primary); margin-right:8px;"></i> Sesiones de la Semana</h3>
            <div style="display:flex; flex-direction:column; gap:12px;">
              ${renderWeeklySessionCard("LUN", "#3b82f6", "rgba(59,130,246,0.1)", zoomUrl)}
              ${renderWeeklySessionCard("MIE", "#10b981", "rgba(16,185,129,0.1)", zoomUrl)}
              ${renderWeeklySessionCard("VIE", "#8b5cf6", "rgba(139,92,246,0.1)", zoomUrl)}
            </div>
          </div>
        </div>
      </main>

      <footer style="background: var(--dark); padding: 24px 0; text-align: center;">
        <div class="container">
          <p style="color: rgba(255,255,255,0.5); font-size: 0.85rem;">&copy; 2026 Pro Trading Academy USA. Todos los derechos reservados.</p>
        </div>
      </footer>
    `;
  }

  function renderWeeklySessionCard(dayLabel, color, bg, zoomUrl) {
    const zoomHref = zoomUrl || FALLBACK_ZOOM_QA_URL;
    return `
      <div style="background:var(--white); border-radius:var(--radius-md); padding:20px 24px; display:flex; align-items:center; gap:20px; border:1px solid var(--gray-200);">
        <div style="width:56px; height:56px; background:${bg}; border-radius:var(--radius-sm); display:flex; flex-direction:column; align-items:center; justify-content:center; flex-shrink:0;">
          <span style="font-size:1rem; font-weight:800; color:${color};">${dayLabel}</span>
          <span style="font-size:0.65rem; color:var(--gray-500); text-transform:uppercase;">Semanal</span>
        </div>
        <div style="flex:1;">
          <div style="font-weight:700; margin-bottom:2px;">Preguntas y Respuestas</div>
          <div style="font-size:0.85rem; color:var(--gray-500);"><i class="fas fa-clock"></i> 16:00 (Hora Arizona)</div>
        </div>
        <a href="${escapeHtml(zoomHref)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-primary"><i class="fas fa-video"></i> Unirse</a>
      </div>
    `;
  }

  function generateCalendar(year, month) {
    const container = document.getElementById("calendarDays");
    const monthTitle = document.getElementById("calendarMonth");
    if (!container || !monthTitle) return;

    container.innerHTML = "";

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    for (let i = 0; i < firstDay; i += 1) {
      const cell = document.createElement("div");
      cell.className = "calendar-day";
      cell.style.background = "var(--gray-50)";
      container.appendChild(cell);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const cell = document.createElement("div");
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      const isToday =
        day === today.getDate() &&
        month === today.getMonth() &&
        year === today.getFullYear();

      cell.className = "calendar-day" + (isToday ? " today" : "");

      let html = `<div class="day-number">${day}</div>`;

      if (events.weekly[dayOfWeek]) {
        events.weekly[dayOfWeek].forEach((ev) => {
          html += `<div class="calendar-event ${ev.type}">${escapeHtml(ev.name)}</div>`;
        });
      }

      const key = `${month}-${day}`;
      if (events.special[key]) {
        events.special[key].forEach((ev) => {
          html += `<div class="calendar-event ${ev.type}">${escapeHtml(ev.name)}</div>`;
        });
      }

      cell.innerHTML = html;
      container.appendChild(cell);
    }

    monthTitle.textContent = `${months[month]} de ${year}`;
  }

  function bindCalendarNav() {
    document.querySelectorAll("[data-cal-action]").forEach((button) => {
      button.addEventListener("click", function() {
        const action = button.getAttribute("data-cal-action");
        if (action === "prev") {
          currentMonth -= 1;
          if (currentMonth < 0) {
            currentMonth = 11;
            currentYear -= 1;
          }
        } else if (action === "next") {
          currentMonth += 1;
          if (currentMonth > 11) {
            currentMonth = 0;
            currentYear += 1;
          }
        } else if (action === "today") {
          const today = new Date();
          currentYear = today.getFullYear();
          currentMonth = today.getMonth();
        }
        generateCalendar(currentYear, currentMonth);
      });
    });
  }

  async function loadZoomUrl(supabase) {
    if (!supabase) return FALLBACK_ZOOM_QA_URL;

    const { data, error } = await supabase
      .from("live_session_links")
      .select("zoom_url")
      .eq("slug", "qa-arizona")
      .eq("active", true)
      .maybeSingle();

    if (error || !data || !data.zoom_url) {
      return FALLBACK_ZOOM_QA_URL;
    }

    return String(data.zoom_url);
  }

  async function init() {
    const root = document.getElementById("calendarPageRoot");
    if (!root || !window.StudentGuard) return;

    const access = await window.StudentGuard.requireStudentAccess({ requireActivePlan: false });
    if (!access) return;

    const zoomUrl = await loadZoomUrl(access.supabase);
    root.innerHTML = renderShell(access.profile, zoomUrl);
    generateCalendar(currentYear, currentMonth);
    bindCalendarNav();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
