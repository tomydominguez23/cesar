(function() {
  "use strict";

  const supabase = window.getSupabaseClient ? window.getSupabaseClient() : null;
  if (!supabase) {
    return;
  }

  function planLabel(plan) {
    if (plan === "basico") return "Básico";
    if (plan === "medio") return "Medio";
    if (plan === "avanzado") return "Avanzado";
    if (plan === "pro") return "Pro";
    return "Sin plan";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeRelation(value) {
    if (Array.isArray(value)) return value[0] || null;
    return value || null;
  }

  function normalizeTitleForOrder(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " y ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/^\d+\s+/, "");
  }

  const basicContentOrder = [
    "Configuración de tc2000",
    "Compra y venta",
    "Velas japonesas",
    "Medias móviles",
    "Líneas de tendencia",
    "Estructura del mercado",
    "Bollinger bands",
    "Planes de inversión 1",
    "Planes de inversiones 2",
    "Panorama completo"
  ].map(normalizeTitleForOrder);

  const basicContentOrderMap = new Map(
    basicContentOrder.map((title, index) => [title, index])
  );

  function isTc2000ConfigTitle(norm) {
    if (!norm) return false;
    const hasTc = /\btc2000?\b/.test(norm) || norm.includes("tc 200");
    return hasTc && norm.includes("configur");
  }

  function isCompraVentaTitle(norm) {
    if (!norm) return false;
    return norm.includes("compra") && norm.includes("venta");
  }

  function getContentOrderRank(lesson, moduleInfo) {
    const lessonNorm = normalizeTitleForOrder(lesson && lesson.title);
    const moduleNorm = normalizeTitleForOrder(moduleInfo && moduleInfo.title);

    if (isTc2000ConfigTitle(lessonNorm)) return 0;
    if (isCompraVentaTitle(lessonNorm)) return 1;

    if (isTc2000ConfigTitle(moduleNorm)) return 0;
    if (isCompraVentaTitle(moduleNorm)) return 1;

    for (const norm of [lessonNorm, moduleNorm]) {
      if (!norm) continue;
      const mapped = basicContentOrderMap.get(norm);
      if (mapped !== undefined) return mapped;
    }

    return basicContentOrder.length;
  }

  function compareLessonsByContentOrder(a, b, modulesMap) {
    const ma = modulesMap.get(a.module_id);
    const mb = modulesMap.get(b.module_id);
    const rankA = getContentOrderRank(a, ma);
    const rankB = getContentOrderRank(b, mb);
    if (rankA !== rankB) return rankA - rankB;

    const moA = ma ? Number(ma.module_order) : 9999;
    const moB = mb ? Number(mb.module_order) : 9999;
    if (moA !== moB) return moA - moB;

    return (Number(a.lesson_order) || 0) - (Number(b.lesson_order) || 0);
  }

  function formatDuration(seconds) {
    const total = Number(seconds || 0);
    if (!total) return "—";
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function getYouTubeId(url) {
    const input = String(url || "");
    const patterns = [
      /(?:youtube\.com\/watch\?v=)([^&]+)/i,
      /(?:youtu\.be\/)([^?&/]+)/i,
      /(?:youtube\.com\/embed\/)([^?&/]+)/i
    ];
    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match && match[1]) return match[1];
    }
    return "";
  }

  function getVimeoId(url) {
    const input = String(url || "");
    const match = input.match(/vimeo\.com\/(\d+)/i);
    return match && match[1] ? match[1] : "";
  }

  async function getSignedUrl(bucket, path) {
    if (!path) return "";
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60);
    if (error || !data) return "";
    return data.signedUrl || "";
  }

  async function requireSession() {
    const guard = window.StudentGuard;
    if (!guard || !guard.requireStudentAccess) {
      window.location.href = "login.html";
      return null;
    }
    const access = await guard.requireStudentAccess({ requireActivePlan: true });
    if (!access) return null;
    return access.session;
  }

  async function loadProfile(userId) {
    const guard = window.StudentGuard;
    if (guard && guard.loadProfile) {
      return guard.loadProfile(supabase, userId);
    }
    const { data } = await supabase
      .from("profiles")
      .select("full_name,plan,role,subscription_status")
      .eq("id", userId)
      .maybeSingle();
    return data || {};
  }

  async function initDashboard(session) {
    const profile = await loadProfile(session.user.id);
    const guard = window.StudentGuard;
    const studentName = profile.full_name || session.user.email || "Estudiante";
    const studentPlan = planLabel(profile.plan || "basico");
    const userPlan = profile.plan || "basico";
    const isAdmin = profile.role === "admin";

    const nameEl = document.getElementById("dashboardStudentName");
    const planEl = document.getElementById("dashboardStudentPlan");
    const greetingEl = document.getElementById("dashboardGreetingName");
    if (nameEl) nameEl.textContent = studentName;
    if (planEl) planEl.textContent = `Plan ${studentPlan}`;
    if (greetingEl) greetingEl.textContent = studentName;

    const coursesGrid = document.getElementById("studentCoursesGrid");
    if (!coursesGrid) return;

    const { data: courses, error } = await supabase
      .from("courses")
      .select("id,title,description,plan_required,status,display_order,cover_url")
      .eq("status", "published")
      .order("display_order", { ascending: true });

    if (error) {
      coursesGrid.innerHTML = `<div class="card"><div class="card-body">No se pudieron cargar los cursos: ${escapeHtml(error.message)}</div></div>`;
      return;
    }

    const list = (courses || []).filter((course) => {
      if (isAdmin) return true;
      return guard && guard.canAccessPlan(userPlan, course.plan_required || "basico");
    });
    const statsCourses = document.getElementById("dashboardStatCourses");
    if (statsCourses) statsCourses.textContent = String(list.length);

    if (!list.length) {
      coursesGrid.innerHTML = `
        <div class="card" style="grid-column: 1 / -1;">
          <div class="card-body">
            <h4 style="margin-bottom:8px;">No tienes programas disponibles en tu plan</h4>
            <p class="text-gray">Actualiza tu suscripción para desbloquear más contenido.</p>
            <a href="index.html#pricing" class="btn btn-primary btn-sm" style="margin-top:12px;">Ver planes</a>
          </div>
        </div>
      `;
      return;
    }

    const cards = await Promise.all(list.map(async (course) => {
      const [{ count: modulesCount }, { count: lessonsCount }] = await Promise.all([
        supabase.from("course_modules").select("id", { count: "exact", head: true }).eq("course_id", course.id),
        supabase.from("lessons").select("id", { count: "exact", head: true }).eq("course_id", course.id).eq("status", "published")
      ]);

      let coverStyle = "background: linear-gradient(135deg, #0d4f4f, #1a6b6b);";
      if (course.cover_url) {
        const coverSigned = await getSignedUrl("media-library", course.cover_url);
        if (coverSigned) {
          coverStyle = `background-image: linear-gradient(rgba(13,79,79,0.35), rgba(13,79,79,0.35)), url('${coverSigned}'); background-size: cover; background-position: center;`;
        }
      }

      return `
        <div class="card course-card">
          <div class="card-img-placeholder" style="${coverStyle}">
            <div class="card-badge">
              <span class="badge badge-success" style="background:rgba(16,185,129,0.9); color:white;">Publicado</span>
            </div>
            <div class="card-img-text">
              <div style="font-size:1.6rem; font-weight:900; line-height:1.2;">${escapeHtml(course.title)}</div>
            </div>
          </div>
          <div class="card-body">
            <h4 class="card-title">${escapeHtml(course.title)}</h4>
            <p class="card-text" style="margin-bottom:12px;">${escapeHtml(course.description || "Sin descripción.")}</p>
          </div>
          <div class="card-footer">
            <div style="display:flex; gap:8px;">
              <span class="tag"><i class="fas fa-layer-group"></i> ${modulesCount || 0} módulos</span>
              <span class="tag"><i class="fas fa-play-circle"></i> ${lessonsCount || 0} clases</span>
            </div>
            <a href="course.html?course_id=${course.id}" class="btn btn-sm btn-primary">Ver programa</a>
          </div>
        </div>
      `;
    }));

    coursesGrid.innerHTML = cards.join("");
  }

  async function initCoursePage(session) {
    const params = new URLSearchParams(window.location.search);
    const requestedCourseId = params.get("course_id");
    const requestedLessonId = params.get("lesson_id");
    const adminPreview = params.get("admin_preview") === "1";
    const profile = await loadProfile(session.user.id);
    const isAdminPreview = adminPreview && profile.role === "admin";
    const guard = window.StudentGuard;
    const userPlan = profile.plan || "basico";

    let courses = [];
    let coursesError = null;

    if (isAdminPreview && requestedCourseId) {
      const response = await supabase
        .from("courses")
        .select("id,title,slug,description,status,plan_required")
        .eq("id", requestedCourseId)
        .limit(1);
      courses = response.data || [];
      coursesError = response.error || null;
    } else {
      const response = await supabase
        .from("courses")
        .select("id,title,slug,description,status,plan_required")
        .eq("status", "published")
        .order("display_order", { ascending: true })
        .limit(100);
      courses = response.data || [];
      coursesError = response.error || null;
    }

    if (coursesError || !courses || !courses.length) {
      const list = document.getElementById("courseLessonList");
      if (list) {
        list.innerHTML = `<div style="padding:16px; color:var(--gray-500);">No hay cursos publicados para mostrar.</div>`;
      }
      return;
    }

    let course = courses.find((item) => item.id === requestedCourseId) || courses[0];

    if (
      !isAdminPreview &&
      guard &&
      !guard.canAccessPlan(userPlan, course.plan_required || "basico")
    ) {
      const list = document.getElementById("courseLessonList");
      const playerContainer = document.getElementById("courseLessonPlayer");
      if (playerContainer) {
        playerContainer.innerHTML = `<div style="padding:24px; color:var(--gray-600);">Este programa no está incluido en tu plan actual. <a href="index.html#pricing" style="color:var(--primary); font-weight:600;">Actualiza tu plan</a> para acceder.</div>`;
      }
      if (list) {
        list.innerHTML = `<div style="padding:16px; color:var(--gray-500);">Contenido bloqueado para tu plan actual.</div>`;
      }
      return;
    }

    const courseId = course.id;

    const lessonsQuery = supabase
      .from("lessons")
      .select("id,title,description,status,lesson_order,duration_seconds,module_id,video_type,video_url,video_path,notes,is_free_preview")
      .eq("course_id", courseId)
      .order("lesson_order", { ascending: true });

    if (!isAdminPreview) {
      lessonsQuery.eq("status", "published");
    }

    const [{ data: modules }, { data: lessons }] = await Promise.all([
      supabase
        .from("course_modules")
        .select("id,title,module_order,status")
        .eq("course_id", courseId)
        .order("module_order", { ascending: true }),
      lessonsQuery
    ]);

    const modulesMap = new Map((modules || []).map((m) => [m.id, m]));
    const lessonsList = (lessons || []).slice().sort((a, b) => compareLessonsByContentOrder(a, b, modulesMap));

    const initialLesson = lessonsList.find((item) => item.id === requestedLessonId) || lessonsList[0] || null;

    const breadcrumbCourse = document.getElementById("courseBreadcrumbTitle");
    const pageTitle = document.getElementById("coursePageTitle");
    const sidebarTitle = document.getElementById("courseSidebarTitle");
    const sidebarCount = document.getElementById("courseSidebarCount");
    if (breadcrumbCourse) breadcrumbCourse.textContent = course.title;
    if (pageTitle) pageTitle.textContent = course.title;
    if (sidebarTitle) sidebarTitle.textContent = course.title;
    if (sidebarCount) sidebarCount.textContent = `${lessonsList.length} clases`;

    const lessonListContainer = document.getElementById("courseLessonList");
    if (lessonListContainer) {
      if (!lessonsList.length) {
        lessonListContainer.innerHTML = `<div style="padding:16px; color:var(--gray-500);">Este curso no tiene clases publicadas.</div>`;
      } else {
        const grouped = new Map();
        lessonsList.forEach((lesson) => {
          const moduleInfo = modulesMap.get(lesson.module_id);
          const key = moduleInfo ? moduleInfo.id : "__no_module__";
          if (!grouped.has(key)) {
            grouped.set(key, {
              module: moduleInfo,
              lessons: []
            });
          }
          grouped.get(key).lessons.push(lesson);
        });

        const groupList = Array.from(grouped.values()).sort((ga, gb) => {
          const minA = Math.min(...ga.lessons.map((l) => getContentOrderRank(l, ga.module)));
          const minB = Math.min(...gb.lessons.map((l) => getContentOrderRank(l, gb.module)));
          if (minA !== minB) return minA - minB;
          const moA = ga.module ? Number(ga.module.module_order) : 9999;
          const moB = gb.module ? Number(gb.module.module_order) : 9999;
          return moA - moB;
        });

        const chunks = [];
        groupList.forEach((group) => {
          if (group.module) {
            chunks.push(`
              <div style="padding:12px 24px; font-size:0.8rem; font-weight:700; color:var(--gray-500); text-transform:uppercase; letter-spacing:0.5px; background:var(--gray-50);">
                ${escapeHtml(group.module.title)}
              </div>
            `);
          }
          const sortedGroupLessons = group.lessons.slice().sort((a, b) =>
            compareLessonsByContentOrder(a, b, modulesMap)
          );
          sortedGroupLessons.forEach((lesson) => {
            const active = initialLesson && initialLesson.id === lesson.id ? " active" : "";
            chunks.push(`
              <div class="lesson-item${active}" data-lesson-id="${lesson.id}">
                <div class="lesson-check"><i class="fas fa-play" style="font-size:0.65rem;"></i></div>
                <div class="lesson-info">
                  <div class="lesson-title">${escapeHtml(lesson.title)}</div>
                  <div class="lesson-duration"><i class="fas fa-play-circle"></i> ${formatDuration(lesson.duration_seconds)}</div>
                </div>
              </div>
            `);
          });
        });

        lessonListContainer.innerHTML = chunks.join("");
      }
    }

    async function renderLesson(lesson) {
      if (!lesson) return;

      if (
        !isAdminPreview &&
        !lesson.is_free_preview &&
        guard &&
        !guard.canAccessPlan(userPlan, course.plan_required || "basico")
      ) {
        const playerContainer = document.getElementById("courseLessonPlayer");
        if (playerContainer) {
          playerContainer.innerHTML = `<div style="padding:24px; color:var(--gray-600);">Necesitas un plan activo para ver esta clase.</div>`;
        }
        return;
      }

      const lessonTitle = document.getElementById("courseLessonTitle");
      const lessonDescription = document.getElementById("courseLessonDescription");
      const lessonDuration = document.getElementById("courseLessonDuration");
      const lessonNotes = document.getElementById("courseLessonNotes");
      const playerContainer = document.getElementById("courseLessonPlayer");
      const materialsContainer = document.getElementById("courseLessonMaterials");
      const nextButton = document.getElementById("courseNextLessonBtn");

      if (lessonTitle) lessonTitle.textContent = lesson.title;
      if (lessonDescription) lessonDescription.textContent = lesson.description || "Sin descripción.";
      if (lessonDuration) lessonDuration.textContent = formatDuration(lesson.duration_seconds);
      if (lessonNotes) lessonNotes.textContent = lesson.notes || "Sin notas adicionales.";

      let playerHtml = `<div style="padding:24px; color:var(--gray-500);">No hay video disponible para esta clase.</div>`;
      if (lesson.video_type === "upload" && lesson.video_path) {
        const signed = await getSignedUrl("lesson-videos", lesson.video_path);
        if (signed) {
          playerHtml = `<video controls playsinline><source src="${signed}" type="video/mp4">Tu navegador no soporta video.</video>`;
        }
      } else if (lesson.video_type === "external_url" && lesson.video_url) {
        playerHtml = `<video controls playsinline><source src="${lesson.video_url}" type="video/mp4"></video>`;
      } else if (lesson.video_type === "youtube" && lesson.video_url) {
        const youtubeId = getYouTubeId(lesson.video_url);
        if (youtubeId) {
          playerHtml = `<iframe src="https://www.youtube.com/embed/${youtubeId}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
        }
      } else if (lesson.video_type === "vimeo" && lesson.video_url) {
        const vimeoId = getVimeoId(lesson.video_url);
        if (vimeoId) {
          playerHtml = `<iframe src="https://player.vimeo.com/video/${vimeoId}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
        }
      }
      if (playerContainer) {
        playerContainer.className = "";
        playerContainer.innerHTML = playerHtml;
      }

      const materialsQuery = supabase
        .from("lesson_materials")
        .select("id,title,description,file_name,storage_path,file_ext,course_id,module_id,lesson_id")
        .eq("course_id", courseId);

      if (lesson.module_id) {
        materialsQuery.or(
          `lesson_id.eq.${lesson.id},and(module_id.eq.${lesson.module_id},lesson_id.is.null),and(module_id.is.null,lesson_id.is.null)`
        );
      } else {
        materialsQuery.or(`lesson_id.eq.${lesson.id},and(module_id.is.null,lesson_id.is.null)`);
      }

      const { data: materials } = await materialsQuery
        .order("created_at", { ascending: false });

      const materialsList = materials || [];
      if (!materialsContainer) return;
      if (!materialsList.length) {
        materialsContainer.innerHTML = `<div class="text-small text-muted">No hay materiales para esta clase.</div>`;
      } else {
        const entries = await Promise.all(materialsList.map(async (material) => {
          const signed = await getSignedUrl("lesson-materials", material.storage_path);
          const href = signed || "#";
          return `
            <div class="tool-card">
              <div class="tool-icon pdf"><i class="fas fa-file"></i></div>
              <div class="tool-info" style="flex:1;">
                <h5>${escapeHtml(material.title || material.file_name)}</h5>
                <p>${escapeHtml(material.description || material.file_name)}</p>
              </div>
              <a href="${href}" target="_blank" class="btn btn-sm btn-accent" ${signed ? "" : "disabled"}>Descargar</a>
            </div>
          `;
        }));
        materialsContainer.innerHTML = entries.join("");
      }

      const idx = lessonsList.findIndex((item) => item.id === lesson.id);
      const nextLesson = idx >= 0 && idx < lessonsList.length - 1 ? lessonsList[idx + 1] : null;
      if (nextButton) {
        if (nextLesson) {
          nextButton.style.display = "inline-flex";
          nextButton.textContent = `Siguiente: ${nextLesson.title}`;
          nextButton.onclick = function(e) {
            e.preventDefault();
            renderLesson(nextLesson);
            if (lessonListContainer) {
              lessonListContainer.querySelectorAll(".lesson-item").forEach((el) => el.classList.remove("active"));
              const activeEl = lessonListContainer.querySelector(`.lesson-item[data-lesson-id="${nextLesson.id}"]`);
              if (activeEl) activeEl.classList.add("active");
            }
          };
        } else {
          nextButton.style.display = "none";
        }
      }
    }

    if (lessonListContainer) {
      lessonListContainer.addEventListener("click", (event) => {
        const item = event.target.closest(".lesson-item[data-lesson-id]");
        if (!item) return;
        const lessonId = item.getAttribute("data-lesson-id");
        const lesson = lessonsList.find((entry) => entry.id === lessonId);
        if (!lesson) return;
        lessonListContainer.querySelectorAll(".lesson-item").forEach((el) => el.classList.remove("active"));
        item.classList.add("active");
        renderLesson(lesson);
      });
    }

    if (initialLesson) {
      renderLesson(initialLesson);
    }
  }

  async function init() {
    const session = await requireSession();
    if (!session) return;

    if (document.getElementById("studentCoursesGrid")) {
      initDashboard(session);
    }

    if (document.getElementById("courseLessonList")) {
      initCoursePage(session);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
