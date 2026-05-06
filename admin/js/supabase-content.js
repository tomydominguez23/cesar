(function() {
  "use strict";

  const supabase = window.getSupabaseClient ? window.getSupabaseClient() : null;
  if (!supabase) {
    return;
  }

  const SPECIAL_NEW_COURSE = "__new_course__";
  const SPECIAL_NEW_MODULE = "__new_module__";
  const state = {
    isAdmin: false,
    courses: [],
    modulesByCourse: new Map(),
    lessonsByCourse: new Map(),
    adminLessons: [],
    adminMaterials: [],
    openModulesCourseId: null,
    modulesModalCourseId: null,
    courseEditor: null,
    lessonEditor: null,
    moduleEditor: null
  };

  function toast(type, title, message) {
    if (window.AdminToast && typeof window.AdminToast[type] === "function") {
      window.AdminToast[type](title, message);
      return;
    }

    const text = [title, message].filter(Boolean).join(" - ");
    if (type === "error") {
      alert(text || "Ocurrió un error");
    } else {
      console.log(text);
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function sameId(a, b) {
    return String(a) === String(b);
  }

  function slugify(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function sanitizePathSegment(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function getExtension(fileName) {
    const name = String(fileName || "");
    const idx = name.lastIndexOf(".");
    return idx === -1 ? "" : name.substring(idx + 1).toLowerCase();
  }

  function normalizeRelation(value) {
    if (Array.isArray(value)) {
      return value[0] || null;
    }
    return value || null;
  }

  function uniqueToken() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID().slice(0, 8);
    }
    return Math.random().toString(36).slice(2, 10);
  }

  function setupMediaPreview(config) {
    const input = config && config.input ? config.input : null;
    const box = config && config.box ? config.box : null;
    const media = config && config.media ? config.media : null;
    const fileName = config && config.fileName ? config.fileName : null;
    const clearBtn = config && config.clearBtn ? config.clearBtn : null;
    const kind = config && config.kind ? config.kind : "image";

    if (!input || !box || !media) {
      return { clear: function() {} };
    }

    let previewUrl = null;

    function revokeUrl() {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = null;
      }
    }

    function clearPreview() {
      revokeUrl();
      if (kind === "image") {
        media.removeAttribute("src");
      } else {
        media.pause();
        media.removeAttribute("src");
        media.load();
      }
      if (fileName) {
        fileName.textContent = "";
      }
      box.style.display = "none";
      input.value = "";
    }

    function renderPreview() {
      const file = input.files && input.files.length ? input.files[0] : null;
      if (!file) {
        clearPreview();
        return;
      }

      const validType = kind === "video"
        ? String(file.type || "").startsWith("video/")
        : String(file.type || "").startsWith("image/");

      if (!validType) {
        toast("warning", "Archivo no compatible", `Selecciona un archivo de ${kind === "video" ? "video" : "imagen"} válido.`);
        clearPreview();
        return;
      }

      revokeUrl();
      previewUrl = URL.createObjectURL(file);
      media.src = previewUrl;
      if (kind === "video") {
        media.load();
      }
      if (fileName) {
        fileName.textContent = file.name;
      }
      box.style.display = "block";
    }

    input.addEventListener("change", renderPreview);
    if (clearBtn) {
      clearBtn.addEventListener("click", function(event) {
        event.preventDefault();
        clearPreview();
      });
    }

    return { clear: clearPreview };
  }

  function parseDurationToSeconds(value) {
    const input = String(value || "").trim();
    if (!input) return null;

    const parts = input.split(":").map((part) => Number(part));
    if (parts.some((part) => Number.isNaN(part))) {
      return null;
    }

    if (parts.length === 2) {
      const [minutes, seconds] = parts;
      if (seconds > 59) return null;
      return (minutes * 60) + seconds;
    }

    if (parts.length === 3) {
      const [hours, minutes, seconds] = parts;
      if (minutes > 59 || seconds > 59) return null;
      return (hours * 3600) + (minutes * 60) + seconds;
    }

    return null;
  }

  function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (value === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const unitIndex = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const normalized = value / (1024 ** unitIndex);
    return `${normalized.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  function formatDate(value) {
    try {
      return new Date(value).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
    } catch (_) {
      return "—";
    }
  }

  function formatDurationLabel(seconds) {
    const total = Number(seconds || 0);
    if (!total) return "—";
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${minutes}:${String(secs).padStart(2, "0")}`;
  }

  function unwrapRelation(value) {
    if (Array.isArray(value)) {
      return value[0] || null;
    }
    return value || null;
  }

  function fileIconByExt(ext) {
    const normalized = (ext || "").toLowerCase();
    if (["pdf"].includes(normalized)) return "fa-file-pdf";
    if (["doc", "docx"].includes(normalized)) return "fa-file-word";
    if (["xls", "xlsx"].includes(normalized)) return "fa-file-excel";
    if (["ppt", "pptx"].includes(normalized)) return "fa-file-powerpoint";
    if (["zip", "rar"].includes(normalized)) return "fa-file-zipper";
    return "fa-file-lines";
  }

  async function uploadToBucket(bucket, path, file) {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: false, contentType: file.type || undefined });

    if (error) {
      throw new Error(`No se pudo subir "${file.name}": ${error.message}`);
    }
  }

  async function getSignedStorageUrl(bucket, path) {
    if (!path) return null;
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60);
    if (error) {
      console.warn(`No se pudo crear signed URL para ${bucket}/${path}:`, error.message);
      return null;
    }
    return data && data.signedUrl ? data.signedUrl : null;
  }

  async function ensureAdmin() {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      throw sessionError;
    }

    const session = sessionData ? sessionData.session : null;
    if (!session) {
      toast("warning", "Sesión requerida", "Inicia sesión para gestionar contenido.");
      return false;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profile || profile.role !== "admin") {
      toast("error", "Acceso denegado", "Tu usuario no tiene permisos de administrador.");
      return false;
    }

    state.isAdmin = true;
    return true;
  }

  async function loadCourses() {
    const { data, error } = await supabase
      .from("courses")
      .select("id,title,slug,description,plan_required,status,display_order,cover_url")
      .order("display_order", { ascending: true });

    if (error) throw error;
    state.courses = data || [];
    return state.courses;
  }

  function setOptions(select, options, selectedValue) {
    if (!select) return;
    select.innerHTML = "";
    options.forEach((option) => {
      const el = document.createElement("option");
      el.value = option.value;
      el.textContent = option.label;
      select.appendChild(el);
    });

    if (selectedValue != null) {
      select.value = selectedValue;
    }
  }

  function populateCourseSelect(select, includeNew) {
    if (!select) return;

    const options = [{ value: "", label: "Seleccionar curso..." }];
    state.courses.forEach((course) => {
      options.push({
        value: course.id,
        label: `${course.title} (${course.status === "published" ? "publicado" : "borrador"})`
      });
    });

    if (includeNew) {
      options.push({ value: SPECIAL_NEW_COURSE, label: "➕ Crear curso rápido..." });
    }

    setOptions(select, options);
  }

  async function loadModules(courseId) {
    if (!courseId) return [];
    const { data, error } = await supabase
      .from("course_modules")
      .select("id,course_id,title,description,module_order,status")
      .eq("course_id", courseId)
      .order("module_order", { ascending: true });

    if (error) throw error;
    const modules = data || [];
    state.modulesByCourse.set(courseId, modules);
    return modules;
  }

  async function loadLessons(courseId) {
    if (!courseId) return [];
    const { data, error } = await supabase
      .from("lessons")
      .select("id,title,module_id,status,lesson_order")
      .eq("course_id", courseId)
      .order("lesson_order", { ascending: true });

    if (error) throw error;
    const lessons = data || [];
    state.lessonsByCourse.set(courseId, lessons);
    return lessons;
  }

  async function loadAdminLessonsTable() {
    const { data, error } = await supabase
      .from("lessons")
      .select(`
        id,
        title,
        slug,
        description,
        status,
        lesson_order,
        duration_seconds,
        course_id,
        module_id,
        plan_required,
        video_type,
        video_url,
        video_path,
        thumbnail_path,
        subtitles_path,
        notes,
        is_free_preview,
        allow_video_download,
        allow_comments,
        scheduled_at,
        created_at,
        course:courses(id,title),
        module:course_modules(id,title,module_order)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;
    state.adminLessons = data || [];
    return state.adminLessons;
  }

  async function loadAdminMaterialsTable() {
    const { data, error } = await supabase
      .from("lesson_materials")
      .select(`
        id,
        title,
        description,
        file_name,
        file_ext,
        size_bytes,
        storage_path,
        created_at,
        course_id,
        module_id,
        lesson_id,
        course:courses(id,title),
        module:course_modules(id,title,module_order),
        lesson:lessons(id,title)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;
    state.adminMaterials = data || [];
    return state.adminMaterials;
  }

  function populateModuleSelect(select, modules, includeNew) {
    if (!select) return;
    const options = [{ value: "", label: "Seleccionar módulo..." }];
    modules.forEach((module) => {
      options.push({
        value: module.id,
        label: `${module.module_order}. ${module.title}`
      });
    });
    if (includeNew) {
      options.push({ value: SPECIAL_NEW_MODULE, label: "➕ Crear módulo rápido..." });
    }
    setOptions(select, options);
  }

  function populateLessonSelect(select, lessons) {
    if (!select) return;
    const options = [{ value: "", label: "Sin clase específica" }];
    lessons.forEach((lesson) => {
      options.push({
        value: lesson.id,
        label: `${lesson.title} (${lesson.status === "published" ? "publicada" : "borrador"})`
      });
    });
    setOptions(select, options);
  }

  async function createQuickCourse() {
    const title = (window.prompt("Nombre del nuevo curso:") || "").trim();
    if (!title) return null;

    const slugBase = slugify(title) || `curso-${Date.now()}`;
    let slug = slugBase;
    let attempt = 1;

    while (attempt <= 10) {
      const { data: existing } = await supabase
        .from("courses")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (!existing) break;
      slug = `${slugBase}-${attempt}`;
      attempt += 1;
    }

    const { data: lastCourse } = await supabase
      .from("courses")
      .select("display_order")
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: created, error } = await supabase
      .from("courses")
      .insert({
        title,
        slug,
        description: "",
        plan_required: "basico",
        status: "draft",
        display_order: (lastCourse && lastCourse.display_order ? lastCourse.display_order : 0) + 1
      })
      .select("id,title,slug,description,plan_required,status,display_order,cover_url")
      .single();

    if (error) throw error;
    state.courses.push(created);
    state.courses.sort((a, b) => (Number(a.display_order) || 0) - (Number(b.display_order) || 0));
    renderCoursesGrid();
    toast("success", "Curso creado", `Se creó "${title}" en borrador.`);
    return created;
  }

  async function createQuickModule(courseId) {
    const title = (window.prompt("Nombre del nuevo módulo:") || "").trim();
    if (!title) return null;

    const { data: lastModule } = await supabase
      .from("course_modules")
      .select("module_order")
      .eq("course_id", courseId)
      .order("module_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: created, error } = await supabase
      .from("course_modules")
      .insert({
        course_id: courseId,
        title,
        description: "",
        module_order: (lastModule && lastModule.module_order ? lastModule.module_order : 0) + 1,
        status: "draft"
      })
      .select("id,course_id,title,description,module_order,status")
      .single();

    if (error) throw error;

    const list = state.modulesByCourse.get(courseId) || [];
    list.push(created);
    list.sort((a, b) => a.module_order - b.module_order);
    state.modulesByCourse.set(courseId, list);
    toast("success", "Módulo creado", `Se creó "${title}" en borrador.`);
    return created;
  }

  async function getNextModuleOrder(courseId) {
    const { data: lastModule } = await supabase
      .from("course_modules")
      .select("module_order")
      .eq("course_id", courseId)
      .order("module_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (lastModule && lastModule.module_order ? lastModule.module_order : 0) + 1;
  }

  async function getNextLessonOrder(moduleId) {
    const { data: lastLesson } = await supabase
      .from("lessons")
      .select("lesson_order")
      .eq("module_id", moduleId)
      .order("lesson_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    return (lastLesson && lastLesson.lesson_order ? lastLesson.lesson_order : 0) + 1;
  }

  function lessonConflictType(error) {
    const source = `${(error && error.message) || ""} ${(error && error.details) || ""} ${(error && error.hint) || ""}`.toLowerCase();
    if (source.includes("module_id") && source.includes("lesson_order")) return "order";
    if (source.includes("course_id") && source.includes("slug")) return "slug";
    if (source.includes("slug")) return "slug";
    return "unknown";
  }

  async function insertLessonWithUniqueSlug(payload) {
    let slugAttempt = 0;
    let orderAttempt = 0;
    const baseSlug = payload.slug;
    const baseOrder = Number(payload.lesson_order) || 1;

    while (slugAttempt < 8 && orderAttempt < 20) {
      const currentPayload = Object.assign({}, payload, {
        slug: slugAttempt === 0 ? baseSlug : `${baseSlug}-${slugAttempt}`,
        lesson_order: baseOrder + orderAttempt
      });

      const { data, error } = await supabase
        .from("lessons")
        .insert(currentPayload)
        .select("id,course_id,module_id,title")
        .single();

      if (!error) {
        return data;
      }

      if (error.code !== "23505") {
        throw error;
      }

      const conflict = lessonConflictType(error);
      if (conflict === "slug") {
        slugAttempt += 1;
        continue;
      }
      if (conflict === "order") {
        orderAttempt += 1;
        continue;
      }

      // Si no se puede identificar el índice en conflicto, avanza ambos.
      slugAttempt += 1;
      orderAttempt += 1;
    }

    throw new Error("No se pudo crear la clase por conflicto de slug u orden en el módulo.");
  }

  async function insertCourseWithUniqueSlug(payload) {
    let attempt = 0;
    const baseSlug = payload.slug;

    while (attempt < 6) {
      const currentPayload = Object.assign({}, payload, {
        slug: attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`
      });

      const { data, error } = await supabase
        .from("courses")
        .insert(currentPayload)
        .select("id,title,slug,description,plan_required,status,display_order,cover_url")
        .single();

      if (!error) {
        return data;
      }

      if (error.code !== "23505") {
        throw error;
      }

      attempt += 1;
    }

    throw new Error("No se pudo crear el curso por conflicto de slug.");
  }

  function appendLessonToTable(lesson, courseTitle, moduleTitle, durationLabel, status) {
    const table = document.getElementById("lessonsTable");
    if (!table) return;

    const tbody = table.querySelector("tbody");
    if (!tbody) return;

    const row = document.createElement("tr");
    const statusLabel = status === "published" ? "Publicado" : (status === "scheduled" ? "Programado" : "Borrador");
    const statusClass = status === "published" ? "active" : (status === "scheduled" ? "pending" : "draft");
    row.innerHTML = `
      <td><input type="checkbox"></td>
      <td>
        <div style="display: flex; align-items: center; gap: 10px;">
          <div class="lesson-icon video"><i class="fa-solid fa-play"></i></div>
          <div>
            <strong>${lesson.title}</strong>
            <div class="text-small text-muted">Clase creada desde panel</div>
          </div>
        </div>
      </td>
      <td>
        <div>${courseTitle || "—"}</div>
        <div class="text-small text-muted">${moduleTitle || "—"}</div>
      </td>
      <td>${durationLabel || "—"}</td>
      <td>0</td>
      <td>—</td>
      <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
      <td>
        <div class="table-actions">
          <button class="table-action-btn" title="Editar"><i class="fa-solid fa-pen"></i></button>
          <button class="table-action-btn" title="Vista previa"><i class="fa-solid fa-eye"></i></button>
          <button class="table-action-btn danger" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.insertBefore(row, tbody.firstChild);
  }

  function appendMaterialToTable(material, courseTitle, moduleTitle, lessonTitle) {
    const table = document.getElementById("materialsTable");
    if (!table) return;

    const tbody = table.querySelector("tbody");
    if (!tbody) return;

    const iconClass = fileIconByExt(material.file_ext);
    const extLabel = (material.file_ext || "archivo").toUpperCase();
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input type="checkbox"></td>
      <td>
        <div style="display: flex; align-items: center; gap: 10px;">
          <div class="lesson-icon doc"><i class="fa-solid ${iconClass}"></i></div>
          <div>
            <strong>${escapeHtml(material.title || "Sin título")}</strong>
            <div class="text-small text-muted">${escapeHtml(material.file_name || "archivo")}</div>
          </div>
        </div>
      </td>
      <td><span style="font-size: 11px; font-weight: 600; background: rgba(13,79,79,0.1); color: #0d4f4f; padding: 3px 8px; border-radius: 4px;">${escapeHtml(extLabel)}</span></td>
      <td>
        <div>${escapeHtml(courseTitle || "—")}</div>
        <div class="text-small text-muted">${escapeHtml(moduleTitle || "Sin módulo específico")}</div>
        <div class="text-small text-muted">${escapeHtml(lessonTitle || "Sin clase específica")}</div>
      </td>
      <td>${formatBytes(material.size_bytes)}</td>
      <td>0</td>
      <td>${formatDate(material.created_at)}</td>
      <td>
        <div class="table-actions">
          <button class="table-action-btn material-download-btn" data-material-id="${escapeHtml(material.id)}" title="Descargar"><i class="fa-solid fa-download"></i></button>
          <button class="table-action-btn danger material-delete-btn" data-material-id="${escapeHtml(material.id)}" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.insertBefore(row, tbody.firstChild);
  }

  function updateMaterialsSummary() {
    const summaryEl = document.getElementById("materialsSummaryText");
    if (!summaryEl) return;
    const total = state.adminMaterials.length;
    const downloads = 0;
    const recent = state.adminMaterials.filter((item) => {
      if (!item.created_at) return false;
      const created = new Date(item.created_at);
      const deltaMs = Date.now() - created.getTime();
      return deltaMs >= 0 && deltaMs <= (7 * 24 * 60 * 60 * 1000);
    }).length;
    summaryEl.textContent = `${total} materiales · ${downloads} descargas totales · ${recent} subidos esta semana`;
  }

  function renderMaterialsTable() {
    const tbody = document.getElementById("materialsTableBody");
    if (!tbody) return;

    if (!state.adminMaterials.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-small text-muted" style="padding:16px;">No hay materiales registrados todavía.</td>
        </tr>
      `;
      updateMaterialsSummary();
      return;
    }

    const rows = state.adminMaterials.map((material) => {
      const course = normalizeRelation(material.course);
      const module = normalizeRelation(material.module);
      const lesson = normalizeRelation(material.lesson);
      const iconClass = fileIconByExt(material.file_ext);
      const extLabel = (material.file_ext || "archivo").toUpperCase();
      return `
        <tr>
          <td><input type="checkbox"></td>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div class="lesson-icon doc"><i class="fa-solid ${iconClass}"></i></div>
              <div>
                <strong>${escapeHtml(material.title || "Sin título")}</strong>
                <div class="text-small text-muted">${escapeHtml(material.file_name || "archivo")}</div>
              </div>
            </div>
          </td>
          <td><span style="font-size: 11px; font-weight: 600; background: rgba(13,79,79,0.1); color: #0d4f4f; padding: 3px 8px; border-radius: 4px;">${escapeHtml(extLabel)}</span></td>
          <td>
            <div>${escapeHtml(course ? course.title : "—")}</div>
            <div class="text-small text-muted">${escapeHtml(module ? module.title : "Sin módulo específico")}</div>
            <div class="text-small text-muted">${escapeHtml(lesson ? lesson.title : "Sin clase específica")}</div>
          </td>
          <td>${formatBytes(material.size_bytes)}</td>
          <td>0</td>
          <td>${formatDate(material.created_at)}</td>
          <td>
            <div class="table-actions">
              <button class="table-action-btn material-download-btn" data-material-id="${escapeHtml(material.id)}" title="Descargar"><i class="fa-solid fa-download"></i></button>
              <button class="table-action-btn danger material-delete-btn" data-material-id="${escapeHtml(material.id)}" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
            </div>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = rows.join("");
    updateMaterialsSummary();
  }

  function bindMaterialsTableActions() {
    const table = document.getElementById("materialsTable");
    if (!table || table.dataset.boundActions === "true") return;
    table.dataset.boundActions = "true";

    table.addEventListener("click", async (event) => {
      const downloadBtn = event.target.closest(".material-download-btn");
      if (downloadBtn) {
        const materialId = downloadBtn.getAttribute("data-material-id");
        const material = state.adminMaterials.find((item) => sameId(item.id, materialId));
        if (!material || !material.storage_path) return;
        const signedUrl = await getSignedStorageUrl("lesson-materials", material.storage_path);
        if (!signedUrl) {
          toast("error", "No se pudo descargar", "No se pudo generar el enlace de descarga.");
          return;
        }
        window.open(signedUrl, "_blank");
        return;
      }

      const deleteBtn = event.target.closest(".material-delete-btn");
      if (deleteBtn) {
        const materialId = deleteBtn.getAttribute("data-material-id");
        const material = state.adminMaterials.find((item) => sameId(item.id, materialId));
        if (!material) return;
        if (!window.confirm(`¿Eliminar material "${material.title || material.file_name}"?`)) return;
        try {
          const { error } = await supabase
            .from("lesson_materials")
            .delete()
            .eq("id", material.id);
          if (error) throw error;

          state.adminMaterials = state.adminMaterials.filter((item) => !sameId(item.id, material.id));
          renderMaterialsTable();
          toast("success", "Material eliminado", "El material fue eliminado correctamente.");
        } catch (err) {
          toast("error", "No se pudo eliminar material", err.message);
        }
      }
    });
  }

  function updateLessonsSummary() {
    const summaryEl = document.getElementById("lessonsSummaryText");
    const kpiTotal = document.getElementById("kpiLessonsTotal");
    const kpiHours = document.getElementById("kpiLessonsHours");
    const kpiViews = document.getElementById("kpiLessonsViews");
    const kpiPublishedPct = document.getElementById("kpiLessonsPublishedPct");
    const total = state.adminLessons.length;
    const published = state.adminLessons.filter((lesson) => lesson.status === "published").length;
    const hours = state.adminLessons.reduce((sum, lesson) => sum + (Number(lesson.duration_seconds) || 0), 0) / 3600;
    const pct = total ? Math.round((published / total) * 100) : 0;
    if (summaryEl) {
      const draft = total - published;
      summaryEl.textContent = `${total} clases en total · ${published} publicadas · ${draft} borradores/programadas`;
    }
    if (kpiTotal) kpiTotal.textContent = String(total);
    if (kpiHours) kpiHours.textContent = `${hours.toFixed(1)}h`;
    if (kpiViews) kpiViews.textContent = "—";
    if (kpiPublishedPct) kpiPublishedPct.textContent = `${pct}%`;
  }

  function renderLessonsTable() {
    const tbody = document.getElementById("lessonsTableBody");
    if (!tbody) return;

    if (!state.adminLessons.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-small text-muted" style="padding:16px;">No hay clases registradas todavía.</td>
        </tr>
      `;
      updateLessonsSummary();
      return;
    }

    const rows = state.adminLessons.map((lesson) => {
      const course = normalizeRelation(lesson.course);
      const module = normalizeRelation(lesson.module);
      const statusMeta = getStatusMeta(lesson.status);
      return `
        <tr>
          <td><input type="checkbox"></td>
          <td>
            <div style="display:flex; align-items:center; gap:10px;">
              <div class="lesson-icon video"><i class="fa-solid fa-play"></i></div>
              <div>
                <strong>${escapeHtml(lesson.title)}</strong>
                <div class="text-small text-muted">${escapeHtml(lesson.description || "Sin descripción")}</div>
              </div>
            </div>
          </td>
          <td>
            <div>${escapeHtml(course ? course.title : "—")}</div>
            <div class="text-small text-muted">${escapeHtml(module ? module.title : "Sin módulo")}</div>
          </td>
          <td>${escapeHtml(formatDurationLabel(lesson.duration_seconds))}</td>
          <td>—</td>
          <td>—</td>
          <td><span class="status-badge ${statusMeta.cssClass}">${statusMeta.label}</span></td>
          <td>
            <div class="table-actions">
              <button class="table-action-btn lesson-edit-btn" data-lesson-id="${lesson.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
              <button class="table-action-btn lesson-preview-btn" data-course-id="${lesson.course_id}" data-lesson-id="${lesson.id}" title="Vista previa"><i class="fa-solid fa-eye"></i></button>
              <button class="table-action-btn danger lesson-delete-btn" data-lesson-id="${lesson.id}" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = rows.join("");
    updateLessonsSummary();
  }

  function bindLessonsTableActions() {
    const table = document.getElementById("lessonsTable");
    if (!table || table.dataset.boundActions === "true") return;
    table.dataset.boundActions = "true";

    table.addEventListener("click", async (event) => {
      const previewBtn = event.target.closest(".lesson-preview-btn");
      if (previewBtn) {
        const lessonId = previewBtn.getAttribute("data-lesson-id");
        const lesson = state.adminLessons.find((item) => item.id === lessonId);
        if (!lesson || !lesson.course_id) return;
        window.open(`../course.html?course_id=${lesson.course_id}&lesson_id=${lesson.id}&admin_preview=1`, "_blank");
        return;
      }

      const editBtn = event.target.closest(".lesson-edit-btn");
      if (editBtn) {
        const lessonId = editBtn.getAttribute("data-lesson-id");
        const lesson = state.adminLessons.find((item) => item.id === lessonId);
        if (!lesson) return;
        if (state.lessonEditor && typeof state.lessonEditor.openEdit === "function") {
          state.lessonEditor.openEdit(lesson);
        } else {
          toast("warning", "Editor no disponible", "Recarga la página para habilitar la edición completa.");
        }
        return;
      }

      const deleteBtn = event.target.closest(".lesson-delete-btn");
      if (deleteBtn) {
        const lessonId = deleteBtn.getAttribute("data-lesson-id");
        const lesson = state.adminLessons.find((item) => item.id === lessonId);
        if (!lesson) return;
        const ok = window.confirm(`¿Eliminar la clase "${lesson.title}"?`);
        if (!ok) return;

        try {
          const { error } = await supabase
            .from("lessons")
            .delete()
            .eq("id", lesson.id);
          if (error) throw error;

          state.adminLessons = state.adminLessons.filter((item) => item.id !== lesson.id);
          renderLessonsTable();
          toast("success", "Clase eliminada", "La clase fue eliminada correctamente.");
        } catch (deleteError) {
          toast("error", "No se pudo eliminar la clase", deleteError.message);
        }
      }
    });
  }

  function mapVideoType(value) {
    if (value === "upload") return "upload";
    if (value === "url") return "external_url";
    if (value === "youtube") return "youtube";
    if (value === "vimeo") return "vimeo";
    return "upload";
  }

  function mapVideoTypeToInput(value) {
    if (value === "external_url") return "url";
    if (value === "youtube") return "youtube";
    if (value === "vimeo") return "vimeo";
    return "upload";
  }

  function toDatetimeLocalValue(value) {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    const offsetMs = parsed.getTimezoneOffset() * 60 * 1000;
    const local = new Date(parsed.getTime() - offsetMs);
    return local.toISOString().slice(0, 16);
  }

  function getPlanBadgeClass(plan) {
    if (plan === "basico") return "basico";
    if (plan === "medio") return "medio";
    if (plan === "avanzado") return "avanzado";
    return "pro";
  }

  function getPlanLabel(plan) {
    if (plan === "basico") return "Básico";
    if (plan === "medio") return "Medio";
    if (plan === "avanzado") return "Avanzado";
    return "Pro";
  }

  function getStatusMeta(status) {
    if (status === "published") return { cssClass: "active", label: "Publicado" };
    if (status === "scheduled") return { cssClass: "draft", label: "Programado" };
    return { cssClass: "draft", label: "Borrador" };
  }

  function updateCoursesSummary() {
    const summaryEl = document.getElementById("coursesSummaryText");
    if (!summaryEl) return;

    const total = state.courses.length;
    const published = state.courses.filter((course) => course.status === "published").length;
    const drafts = total - published;
    const courseWord = total === 1 ? "curso" : "cursos";
    const publishedWord = published === 1 ? "publicado" : "publicados";
    const draftWord = drafts === 1 ? "borrador" : "borradores";
    summaryEl.textContent = `${total} ${courseWord} · ${published} ${publishedWord} · ${drafts} ${draftWord}`;
  }

  function appendCourseCard(course, prepend) {
    const grid = document.querySelector(".course-grid");
    if (!grid) return;

    const row = document.createElement("div");
    row.className = "course-card-admin";
    const statusMeta = getStatusMeta(course.status);
    row.innerHTML = `
      <div class="course-card-thumb" style="background: linear-gradient(135deg, #0d4f4f, #1a6b6b);">
        <div class="course-card-status"><span class="status-badge ${statusMeta.cssClass}">${statusMeta.label}</span></div>
        <div class="course-card-plan"><span class="plan-badge ${getPlanBadgeClass(course.plan_required)}">${getPlanLabel(course.plan_required)}</span></div>
      </div>
      <div class="course-card-body">
        <h3 class="course-card-title">${course.title}</h3>
        <p class="course-card-desc">${course.description || "Curso creado desde panel de administración."}</p>
        <div class="course-card-meta">
          <span><i class="fa-solid fa-layer-group"></i> Gestiona módulos desde el botón</span>
        </div>
        <div class="course-card-footer">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="text-small text-muted">Slug: ${course.slug}</span>
          </div>
          <div class="table-actions">
            <button class="table-action-btn edit-course-btn" data-course-id="${course.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
            <button class="table-action-btn open-modules-btn" data-course-id="${course.id}" title="Módulos"><i class="fa-solid fa-layer-group"></i></button>
            <button class="table-action-btn danger delete-course-btn" data-course-id="${course.id}" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      </div>
    `;
    if (prepend) {
      grid.insertBefore(row, grid.firstChild);
    } else {
      grid.appendChild(row);
    }
  }

  function renderCoursesGrid() {
    const grid = document.querySelector(".course-grid");
    if (!grid) return;

    grid.innerHTML = "";
    if (!state.courses.length) {
      grid.innerHTML = `
        <div class="card" style="grid-column: 1 / -1;">
          <div class="card-body" style="padding: 18px;">
            <strong>No hay cursos creados todavía.</strong>
            <div class="text-small text-muted" style="margin-top: 6px;">
              Usa el botón "Nuevo Curso" para empezar. Ya se eliminaron los cursos predeterminados del panel.
            </div>
          </div>
        </div>
      `;
      updateCoursesSummary();
      return;
    }

    state.courses
      .slice()
      .sort((a, b) => (Number(a.display_order) || 0) - (Number(b.display_order) || 0))
      .forEach((course) => appendCourseCard(course, false));

    updateCoursesSummary();
  }

  async function openModulesModal(courseId) {
    if (!courseId) return;
    state.modulesModalCourseId = courseId;
    state.openModulesCourseId = courseId;
    const modalTitle = document.getElementById("modulesModalTitle");
    const listContainer = document.getElementById("modulesListContainer");
    const course = state.courses.find((item) => item.id === courseId);
    if (!modalTitle || !listContainer) return;

    modalTitle.textContent = course ? `Módulos — ${course.title}` : "Módulos del curso";
    listContainer.innerHTML = `
      <div class="card" style="border: 1px dashed var(--gray-300);">
        <div class="card-body" style="padding: 14px; font-size: 13px; color: var(--gray-500);">
          Cargando módulos...
        </div>
      </div>
    `;

    if (window.AdminModal) {
      window.AdminModal.open("modal-modules");
    }

    try {
      const modules = await loadModules(courseId);
      const lessons = await loadLessons(courseId);
      const lessonsByModule = new Map();
      lessons.forEach((lesson) => {
        const current = lessonsByModule.get(lesson.module_id) || 0;
        lessonsByModule.set(lesson.module_id, current + 1);
      });

      if (!modules.length) {
        listContainer.innerHTML = `
          <div class="card" style="border: 1px dashed var(--gray-300);">
            <div class="card-body" style="padding: 14px;">
              <strong>No hay módulos en este curso.</strong>
              <div class="text-small text-muted" style="margin-top: 6px;">
                Usa el botón "Nuevo Módulo" para crear el primero con todos los campos.
              </div>
            </div>
          </div>
        `;
        return;
      }

      listContainer.innerHTML = "";
      modules.forEach((module) => {
        const lessonsCount = lessonsByModule.get(module.id) || 0;
        const statusMeta = getStatusMeta(module.status);
        const moduleEl = document.createElement("div");
        moduleEl.className = "module-item";
        moduleEl.innerHTML = `
          <div class="module-header">
            <div class="module-header-left">
              <div class="module-number">${module.module_order || "-"}</div>
              <div>
                <div class="module-title">${module.title}</div>
                <div class="module-subtitle">${lessonsCount} clase(s) · ${escapeHtml(module.description || "Sin descripción")}</div>
              </div>
            </div>
            <div class="module-header-right">
              <span class="status-badge ${statusMeta.cssClass}">${statusMeta.label}</span>
              <button class="table-action-btn edit-module-btn" data-module-id="${module.id}" title="Editar módulo"><i class="fa-solid fa-pen"></i></button>
              <button class="table-action-btn danger delete-module-btn" data-module-id="${module.id}" data-module-title="${escapeHtml(module.title)}" title="Eliminar módulo"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>
        `;
        listContainer.appendChild(moduleEl);
      });
    } catch (error) {
      listContainer.innerHTML = `
        <div class="card" style="border: 1px dashed var(--danger);">
          <div class="card-body" style="padding: 14px; color: var(--danger);">
            No se pudieron cargar los módulos: ${error.message}
          </div>
        </div>
      `;
    }
  }

  async function initModuleForm() {
    const saveButton = document.getElementById("saveModuleBtn");
    if (!saveButton) return;

    const modalTitle = document.getElementById("moduleFormModalTitle");
    const titleInput = document.getElementById("moduleTitleInput");
    const descriptionInput = document.getElementById("moduleDescriptionInput");
    const orderInput = document.getElementById("moduleOrderInput");
    const statusInput = document.getElementById("moduleStatusInput");

    const formState = {
      mode: "create",
      editingModuleId: null
    };

    function setMode(mode) {
      formState.mode = mode === "edit" ? "edit" : "create";
      if (modalTitle) {
        modalTitle.textContent = formState.mode === "edit" ? "Editar Módulo" : "Nuevo Módulo";
      }
      saveButton.innerHTML = formState.mode === "edit"
        ? '<i class="fa-solid fa-check"></i> Guardar Cambios'
        : '<i class="fa-solid fa-check"></i> Crear Módulo';
    }

    function resetForm() {
      formState.editingModuleId = null;
      if (titleInput) titleInput.value = "";
      if (descriptionInput) descriptionInput.value = "";
      if (orderInput) orderInput.value = "";
      if (statusInput) statusInput.value = "draft";
    }

    async function openCreateModal() {
      const courseId = state.modulesModalCourseId;
      if (!courseId) {
        toast("warning", "Selecciona un curso", "Abre primero los módulos de un curso.");
        return;
      }
      setMode("create");
      resetForm();
      if (orderInput) {
        orderInput.value = String(await getNextModuleOrder(courseId));
      }
      if (window.AdminModal) {
        window.AdminModal.open("modal-new-module");
      }
    }

    async function openEditModal(module) {
      if (!module) return;
      setMode("edit");
      resetForm();
      formState.editingModuleId = module.id;
      if (titleInput) titleInput.value = module.title || "";
      if (descriptionInput) descriptionInput.value = module.description || "";
      if (orderInput) orderInput.value = module.module_order != null ? String(module.module_order) : "";
      if (statusInput) statusInput.value = module.status || "draft";
      if (window.AdminModal) {
        window.AdminModal.open("modal-new-module");
      }
    }

    window.openCourseModuleModal = openCreateModal;
    state.moduleEditor = {
      openCreate: openCreateModal,
      openEdit: openEditModal
    };

    saveButton.addEventListener("click", async () => {
      const courseId = state.modulesModalCourseId;
      const title = titleInput ? titleInput.value.trim() : "";
      const description = descriptionInput ? descriptionInput.value.trim() : "";
      const statusRaw = statusInput ? statusInput.value : "draft";
      const status = ["draft", "published", "scheduled"].includes(statusRaw) ? statusRaw : "draft";
      const isEditMode = formState.mode === "edit" && !!formState.editingModuleId;
      const parsedOrder = Number(orderInput ? orderInput.value : "");

      if (!courseId) {
        toast("warning", "Curso requerido", "Abre primero los módulos de un curso.");
        return;
      }

      if (!title) {
        toast("warning", "Nombre requerido", "Ingresa el nombre del módulo.");
        return;
      }

      const originalHtml = saveButton.innerHTML;
      saveButton.disabled = true;
      saveButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

      try {
        const currentModule = isEditMode
          ? ((state.modulesByCourse.get(courseId) || []).find((item) => item.id === formState.editingModuleId) || null)
          : null;
        const moduleOrder = parsedOrder > 0
          ? parsedOrder
          : (isEditMode && currentModule && Number(currentModule.module_order) > 0
              ? Number(currentModule.module_order)
              : await getNextModuleOrder(courseId));
        if (isEditMode) {
          const { error } = await supabase
            .from("course_modules")
            .update({
              title,
              description: description || "",
              module_order: moduleOrder,
              status
            })
            .eq("id", formState.editingModuleId);
          if (error) {
            if (error.code === "23505") {
              throw new Error("Ya existe un módulo con ese orden para este curso.");
            }
            throw error;
          }
        } else {
          const { error } = await supabase
            .from("course_modules")
            .insert({
              course_id: courseId,
              title,
              description: description || "",
              module_order: moduleOrder,
              status
            });
          if (error) {
            if (error.code === "23505") {
              throw new Error("Ya existe un módulo con ese orden para este curso.");
            }
            throw error;
          }
        }

        await openModulesModal(courseId);
        await loadAdminLessonsTable();
        renderLessonsTable();
        toast(
          "success",
          isEditMode ? "Módulo actualizado" : "Módulo creado",
          isEditMode
            ? "El módulo se actualizó con el formulario completo."
            : "El módulo se creó correctamente."
        );
        if (window.AdminModal) {
          window.AdminModal.close("modal-new-module");
        }
      } catch (err) {
        toast("error", "No se pudo guardar módulo", err.message);
      } finally {
        saveButton.disabled = false;
        saveButton.innerHTML = originalHtml;
      }
    });
  }

  function bindCoursesGridActions() {
    const grid = document.querySelector(".course-grid");
    if (!grid || grid.dataset.boundActions === "true") return;
    grid.dataset.boundActions = "true";

    grid.addEventListener("click", (event) => {
      const editCourseBtn = event.target.closest(".edit-course-btn");
      if (editCourseBtn) {
        const courseId = editCourseBtn.getAttribute("data-course-id");
        const course = state.courses.find((item) => sameId(item.id, courseId));
        if (!course) {
          toast("warning", "Curso no encontrado", "Recarga la lista de cursos e inténtalo de nuevo.");
          return;
        }
        if (state.courseEditor && typeof state.courseEditor.openEdit === "function") {
          state.courseEditor.openEdit(course);
        } else {
          toast("warning", "Editor no disponible", "Recarga la página para habilitar la edición de cursos.");
        }
        return;
      }

      const modulesBtn = event.target.closest(".open-modules-btn");
      if (modulesBtn) {
        const courseId = modulesBtn.getAttribute("data-course-id");
        openModulesModal(courseId);
        return;
      }

      const deleteCourseBtn = event.target.closest(".delete-course-btn");
      if (!deleteCourseBtn) return;
      const courseId = deleteCourseBtn.getAttribute("data-course-id");
      const course = state.courses.find((item) => sameId(item.id, courseId));
      const label = course ? course.title : "este curso";
      if (!window.confirm(`¿Eliminar "${label}"? Esta acción eliminará módulos y clases asociadas.`)) {
        return;
      }

      supabase
        .from("courses")
        .delete()
        .eq("id", courseId)
        .then(async ({ error }) => {
          if (error) {
            toast("error", "No se pudo eliminar curso", error.message);
            return;
          }
          state.courses = state.courses.filter((item) => item.id !== courseId);
          renderCoursesGrid();
          await loadAdminLessonsTable();
          renderLessonsTable();
          toast("success", "Curso eliminado", `"${label}" fue eliminado.`);
        });
    });

    const modulesListContainer = document.getElementById("modulesListContainer");
    if (modulesListContainer && modulesListContainer.dataset.boundActions !== "true") {
      modulesListContainer.dataset.boundActions = "true";
      modulesListContainer.addEventListener("click", async (event) => {
        const editBtn = event.target.closest(".edit-module-btn");
        const deleteBtn = event.target.closest(".delete-module-btn");

        if (!editBtn && !deleteBtn) return;

        const moduleId = (editBtn || deleteBtn).getAttribute("data-module-id");
        if (!moduleId) return;

        if (editBtn) {
          const courseId = state.modulesModalCourseId;
          const modules = courseId ? (state.modulesByCourse.get(courseId) || []) : [];
          const module = modules.find((item) => sameId(item.id, moduleId));
          if (!module) {
            toast("warning", "Módulo no encontrado", "Recarga la lista de módulos e inténtalo de nuevo.");
            return;
          }
          if (state.moduleEditor && typeof state.moduleEditor.openEdit === "function") {
            state.moduleEditor.openEdit(module);
          } else {
            toast("warning", "Editor no disponible", "Recarga la página para habilitar la edición de módulos.");
          }
          return;
        }

        if (deleteBtn) {
          const moduleTitle = deleteBtn.getAttribute("data-module-title") || "este módulo";
          if (!window.confirm(`¿Eliminar "${moduleTitle}"? También se eliminarán sus clases asociadas.`)) {
            return;
          }
          try {
            const { error } = await supabase
              .from("course_modules")
              .delete()
              .eq("id", moduleId);
            if (error) throw error;
            toast("success", "Módulo eliminado", "El módulo y sus clases asociadas fueron eliminados.");
            if (state.modulesModalCourseId) {
              await openModulesModal(state.modulesModalCourseId);
            }
            await loadAdminLessonsTable();
            renderLessonsTable();
          } catch (err) {
            toast("error", "No se pudo eliminar módulo", err.message);
          }
        }
      });
    }
  }

  async function initCoursesForm() {
    const saveButton = document.getElementById("saveCourseBtn");
    if (!saveButton) return;

    const modal = document.getElementById("modal-course");
    const modalTitle = document.getElementById("courseFormModalTitle")
      || (modal ? modal.querySelector(".modal-header h3") : null);
    const newCourseButton = document.querySelector(".page-header-actions .btn.btn-primary");
    const titleInput = document.getElementById("courseTitleInput");
    const slugInput = document.getElementById("courseSlugInput");
    const descriptionInput = document.getElementById("courseDescriptionInput");
    const planSelect = document.getElementById("coursePlanSelect");
    const orderInput = document.getElementById("courseOrderInput");
    const statusSelect = document.getElementById("courseStatusSelect");
    const coverInput = document.getElementById("courseCoverInput");
    const coverPreviewWrap = document.getElementById("courseCoverPreviewWrap");
    const coverPreview = document.getElementById("courseCoverPreview");
    const coverFileName = document.getElementById("courseCoverFileName");
    const coverClearBtn = document.getElementById("courseCoverClearBtn");
    const coverPreviewControl = setupMediaPreview({
      input: coverInput,
      box: coverPreviewWrap,
      media: coverPreview,
      fileName: coverFileName,
      clearBtn: coverClearBtn,
      kind: "image"
    });
    const formState = {
      mode: "create",
      editingCourseId: null,
      existingCoverPath: null
    };

    function setMode(mode) {
      formState.mode = mode === "edit" ? "edit" : "create";
      if (modalTitle) {
        modalTitle.textContent = formState.mode === "edit" ? "Editar Curso" : "Nuevo Curso";
      }
      saveButton.innerHTML = formState.mode === "edit"
        ? '<i class="fa-solid fa-check"></i> Guardar Cambios'
        : '<i class="fa-solid fa-check"></i> Guardar Curso';
    }

    function resetForm() {
      formState.editingCourseId = null;
      formState.existingCoverPath = null;
      if (titleInput) titleInput.value = "";
      if (slugInput) slugInput.value = "";
      if (descriptionInput) descriptionInput.value = "";
      if (planSelect) planSelect.value = "";
      if (orderInput) orderInput.value = "";
      if (statusSelect) statusSelect.value = "draft";
      if (coverPreviewControl && typeof coverPreviewControl.clear === "function") {
        coverPreviewControl.clear();
      }
    }

    async function renderExistingCoverPreview(path) {
      if (!path || !coverPreviewWrap || !coverPreview || !coverFileName) return;
      const signedUrl = await getSignedStorageUrl("media-library", path);
      if (!signedUrl) return;
      coverPreview.src = signedUrl;
      coverFileName.textContent = `Actual: ${path.split("/").pop()}`;
      coverPreviewWrap.style.display = "block";
    }

    async function openCreateCourseModal() {
      setMode("create");
      resetForm();
      if (window.AdminModal) {
        window.AdminModal.open("modal-course");
      }
    }

    async function openEditCourseModal(course) {
      if (!course) return;
      setMode("edit");
      resetForm();
      formState.editingCourseId = course.id;
      formState.existingCoverPath = course.cover_url || null;
      if (titleInput) titleInput.value = course.title || "";
      if (slugInput) slugInput.value = course.slug || "";
      if (descriptionInput) descriptionInput.value = course.description || "";
      if (planSelect) planSelect.value = course.plan_required || "";
      if (orderInput) orderInput.value = course.display_order != null ? String(course.display_order) : "";
      if (statusSelect) statusSelect.value = course.status || "draft";
      await renderExistingCoverPreview(formState.existingCoverPath);
      if (window.AdminModal) {
        window.AdminModal.open("modal-course");
      }
    }

    if (newCourseButton) {
      newCourseButton.onclick = function(event) {
        event.preventDefault();
        openCreateCourseModal();
      };
    }

    window.openCourseCreateModal = openCreateCourseModal;
    state.courseEditor = {
      openCreate: openCreateCourseModal,
      openEdit: async (course) => {
        try {
          await openEditCourseModal(course);
        } catch (err) {
          toast("error", "No se pudo cargar el curso", err.message);
        }
      }
    };
    setMode("create");
    resetForm();

    if (titleInput && slugInput) {
      titleInput.addEventListener("blur", () => {
        if (!slugInput.value.trim()) {
          slugInput.value = slugify(titleInput.value);
        }
      });
    }

    if (coverClearBtn) {
      coverClearBtn.addEventListener("click", () => {
        if (formState.mode === "edit" && (!coverInput.files || !coverInput.files.length)) {
          formState.existingCoverPath = null;
        }
      });
    }

    saveButton.addEventListener("click", async () => {
      const title = titleInput ? titleInput.value.trim() : "";
      const description = descriptionInput ? descriptionInput.value.trim() : "";
      const planRequired = planSelect ? planSelect.value : "";
      const status = statusSelect ? statusSelect.value : "draft";
      const generatedSlug = slugify(slugInput ? slugInput.value : "") || slugify(title);
      const isEditMode = formState.mode === "edit" && !!formState.editingCourseId;
      const editingCourseId = isEditMode ? formState.editingCourseId : null;
      const existingCourse = isEditMode
        ? state.courses.find((item) => sameId(item.id, editingCourseId))
        : null;
      const parsedOrder = Number(orderInput ? orderInput.value : "");
      const displayOrder = parsedOrder > 0
        ? parsedOrder
        : (existingCourse && Number(existingCourse.display_order) > 0
            ? Number(existingCourse.display_order)
            : ((state.courses.reduce((max, item) => Math.max(max, Number(item.display_order) || 0), 0)) + 1));

      if (!title || !description || !planRequired) {
        toast("warning", "Campos requeridos", "Completa nombre, descripción y plan requerido.");
        return;
      }

      if (!generatedSlug) {
        toast("warning", "Slug inválido", "No se pudo generar un slug válido para el curso.");
        return;
      }

      const originalHtml = saveButton.innerHTML;
      saveButton.disabled = true;
      saveButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

      try {
        let savedCourseId = editingCourseId;
        let savedCourse = null;

        if (isEditMode) {
          const updatePayload = {
            title,
            slug: generatedSlug,
            description,
            plan_required: planRequired,
            status,
            display_order: displayOrder
          };
          const { error: updateError } = await supabase
            .from("courses")
            .update(updatePayload)
            .eq("id", editingCourseId);
          if (updateError) {
            if (updateError.code === "23505") {
              throw new Error("Ya existe otro curso con ese slug.");
            }
            throw updateError;
          }
          savedCourse = Object.assign({}, existingCourse || {}, updatePayload, { id: editingCourseId });
        } else {
          const created = await insertCourseWithUniqueSlug({
            title,
            slug: generatedSlug,
            description,
            plan_required: planRequired,
            status,
            display_order: displayOrder
          });
          savedCourseId = created.id;
          savedCourse = created;
        }

        let coverPath = formState.existingCoverPath || null;
        if (coverInput && coverInput.files && coverInput.files.length) {
          const coverFile = coverInput.files[0];
          const ext = getExtension(coverFile.name) || "jpg";
          const uploadedCoverPath = `courses/${savedCourseId}/cover-${Date.now()}-${uniqueToken()}.${ext}`;
          await uploadToBucket("media-library", uploadedCoverPath, coverFile);
          coverPath = uploadedCoverPath;
        } else if (isEditMode && existingCourse && existingCourse.cover_url && !formState.existingCoverPath) {
          coverPath = null;
        }

        if (isEditMode || coverPath) {
          const { error: coverError } = await supabase
            .from("courses")
            .update({ cover_url: coverPath })
            .eq("id", savedCourseId);

          if (coverError) throw coverError;
          if (savedCourse) {
            savedCourse.cover_url = coverPath;
          }
        }

        if (isEditMode) {
          state.courses = state.courses.map((item) => (sameId(item.id, savedCourseId) ? Object.assign({}, item, savedCourse) : item));
        } else if (savedCourse) {
          state.courses.push(savedCourse);
        }
        state.courses.sort((a, b) => (Number(a.display_order) || 0) - (Number(b.display_order) || 0));
        renderCoursesGrid();

        toast(
          "success",
          isEditMode ? "Curso actualizado" : "Curso guardado",
          isEditMode
            ? "Los cambios del curso se guardaron correctamente."
            : "El curso se creó correctamente en Supabase."
        );
        resetForm();
        setMode("create");
        if (window.AdminModal) {
          window.AdminModal.close("modal-course");
        }
      } catch (err) {
        toast("error", "No se pudo guardar el curso", err.message);
      } finally {
        saveButton.disabled = false;
        saveButton.innerHTML = originalHtml;
      }
    });
  }

  async function initClassesForm() {
    const saveButton = document.getElementById("saveLessonBtn");
    if (!saveButton) return;

    const modal = document.getElementById("modal-lesson");
    const modalTitle = modal ? modal.querySelector(".modal-header h3") : null;
    const newLessonButton = document.querySelector(".page-header-actions .btn.btn-primary");
    const draftButton = document.getElementById("saveLessonDraftBtn");
    const titleInput = document.getElementById("lessonTitleInput");
    const slugInput = document.getElementById("lessonSlugInput");
    const descriptionInput = document.getElementById("lessonDescriptionInput");
    const courseSelect = document.getElementById("lessonCourseSelect");
    const moduleSelect = document.getElementById("lessonModuleSelect");
    const orderInput = document.getElementById("lessonOrderInput");
    const videoFileInput = document.getElementById("lessonVideoFileInput");
    const videoUrlInput = document.getElementById("lessonVideoUrlInput");
    const durationInput = document.getElementById("lessonDurationInput");
    const subtitlesInput = document.getElementById("lessonSubtitlesInput");
    const thumbnailInput = document.getElementById("lessonThumbnailInput");
    const materialsInput = document.getElementById("lessonMaterialsInput");
    const statusSelect = document.getElementById("lessonStatusSelect");
    const scheduledAtInput = document.getElementById("lessonScheduledAtInput");
    const notesInput = document.getElementById("lessonNotesInput");
    const freePreviewInput = document.getElementById("lessonFreePreviewInput");
    const allowDownloadInput = document.getElementById("lessonAllowDownloadInput");
    const allowCommentsInput = document.getElementById("lessonAllowCommentsInput");
    const externalResourcesContainer = document.getElementById("external-resources");
    const videoPreviewBox = document.getElementById("lessonVideoPreviewBox");
    const videoPreviewMedia = document.getElementById("lessonVideoPreview");
    const videoPreviewFileName = document.getElementById("lessonVideoFileName");
    const videoClearBtn = document.getElementById("lessonVideoClearBtn");
    const thumbnailPreviewBox = document.getElementById("lessonThumbnailPreviewBox");
    const thumbnailPreviewMedia = document.getElementById("lessonThumbnailPreview");
    const thumbnailPreviewFileName = document.getElementById("lessonThumbnailFileName");
    const thumbnailClearBtn = document.getElementById("lessonThumbnailClearBtn");
    const videoTypeInputs = Array.from(document.querySelectorAll("input[name='video-type']"));

    const formState = {
      mode: "create",
      editingLessonId: null,
      existingVideoPath: null,
      existingThumbnailPath: null,
      existingSubtitlesPath: null
    };

    let subtitlesHint = document.getElementById("lessonSubtitlesCurrentHint");
    if (!subtitlesHint && subtitlesInput && subtitlesInput.parentElement) {
      subtitlesHint = document.createElement("div");
      subtitlesHint.id = "lessonSubtitlesCurrentHint";
      subtitlesHint.className = "form-hint";
      subtitlesHint.style.marginTop = "8px";
      subtitlesHint.style.display = "none";
      subtitlesInput.parentElement.appendChild(subtitlesHint);
    }

    const videoPreviewControl = setupMediaPreview({
      input: videoFileInput,
      box: videoPreviewBox,
      media: videoPreviewMedia,
      fileName: videoPreviewFileName,
      clearBtn: videoClearBtn,
      kind: "video"
    });
    const thumbnailPreviewControl = setupMediaPreview({
      input: thumbnailInput,
      box: thumbnailPreviewBox,
      media: thumbnailPreviewMedia,
      fileName: thumbnailPreviewFileName,
      clearBtn: thumbnailClearBtn,
      kind: "image"
    });

    function setModalMode(mode) {
      formState.mode = mode === "edit" ? "edit" : "create";
      if (modalTitle) {
        modalTitle.textContent = formState.mode === "edit" ? "Editar Clase" : "Nueva Clase";
      }
      if (saveButton) {
        saveButton.innerHTML = formState.mode === "edit"
          ? '<i class="fa-solid fa-check"></i> Guardar Cambios'
          : '<i class="fa-solid fa-check"></i> Publicar Clase';
      }
      if (draftButton) {
        draftButton.textContent = formState.mode === "edit"
          ? "Guardar en borrador"
          : "Guardar como Borrador";
      }
    }

    function activateInfoTab() {
      if (!modal) return;
      const tabs = modal.querySelectorAll(".tabs .tab");
      const tabPanels = modal.querySelectorAll(".tab-content");
      tabs.forEach((tab) => {
        tab.classList.toggle("active", tab.getAttribute("data-tab") === "tab-info");
      });
      tabPanels.forEach((panel) => {
        panel.classList.toggle("active", panel.id === "tab-info");
      });
    }

    function buildResourceRow(title, url) {
      const row = document.createElement("div");
      row.className = "external-resource-row";
      row.style.cssText = "display: flex; gap: 8px;";
      row.innerHTML = `
        <input type="text" class="form-control" placeholder="Nombre del recurso" style="flex: 1;" value="${escapeHtml(title || "")}">
        <input type="url" class="form-control" placeholder="URL" style="flex: 2;" value="${escapeHtml(url || "")}">
        <button type="button" class="btn btn-sm btn-danger remove-resource-row"><i class="fa-solid fa-trash"></i></button>
      `;
      const removeBtn = row.querySelector(".remove-resource-row");
      if (removeBtn) {
        removeBtn.addEventListener("click", () => {
          row.remove();
          if (!externalResourcesContainer.querySelector(".external-resource-row")) {
            externalResourcesContainer.appendChild(buildResourceRow("", ""));
          }
        });
      }
      return row;
    }

    function setExternalResourceRows(items) {
      if (!externalResourcesContainer) return;
      externalResourcesContainer.innerHTML = "";
      const resources = Array.isArray(items) ? items : [];
      if (!resources.length) {
        externalResourcesContainer.appendChild(buildResourceRow("", ""));
        return;
      }
      resources.forEach((item) => {
        externalResourcesContainer.appendChild(buildResourceRow(item.title || "", item.url || ""));
      });
    }

    function collectExternalResourceRows() {
      if (!externalResourcesContainer) return [];
      const resources = [];
      externalResourcesContainer.querySelectorAll(".external-resource-row").forEach((row) => {
        const fields = row.querySelectorAll("input");
        if (fields.length < 2) return;
        const resourceTitle = fields[0].value.trim();
        const resourceUrl = fields[1].value.trim();
        if (!resourceTitle || !resourceUrl) return;
        resources.push({ title: resourceTitle, url: resourceUrl });
      });
      return resources;
    }

    function setVideoTypeInput(inputValue) {
      const nextValue = ["upload", "url", "youtube", "vimeo"].includes(inputValue) ? inputValue : "upload";
      const target = videoTypeInputs.find((input) => input.value === nextValue);
      if (!target) return;
      target.checked = true;
      target.dispatchEvent(new Event("change", { bubbles: true }));
    }

    async function syncModuleOptions(courseId, selectedModuleId) {
      if (!courseId) {
        populateModuleSelect(moduleSelect, [], true);
        return;
      }
      const modules = state.modulesByCourse.get(courseId) || await loadModules(courseId);
      populateModuleSelect(moduleSelect, modules, true);
      if (selectedModuleId) {
        moduleSelect.value = selectedModuleId;
      }
    }

    function updateSubtitlesHint(path) {
      if (!subtitlesHint) return;
      if (!path) {
        subtitlesHint.style.display = "none";
        subtitlesHint.textContent = "";
        return;
      }
      subtitlesHint.style.display = "block";
      subtitlesHint.textContent = `Subtítulo actual: ${path.split("/").pop()}`;
    }

    async function renderStoredMediaPreviews(lesson) {
      if (!lesson) return;
      if (formState.existingVideoPath && videoPreviewBox && videoPreviewMedia && videoPreviewFileName) {
        const signedVideo = await getSignedStorageUrl("lesson-videos", formState.existingVideoPath);
        if (signedVideo) {
          videoPreviewMedia.src = signedVideo;
          videoPreviewMedia.load();
          videoPreviewFileName.textContent = `Actual: ${formState.existingVideoPath.split("/").pop()}`;
          videoPreviewBox.style.display = "block";
        }
      }
      if (formState.existingThumbnailPath && thumbnailPreviewBox && thumbnailPreviewMedia && thumbnailPreviewFileName) {
        const signedThumbnail = await getSignedStorageUrl("media-library", formState.existingThumbnailPath);
        if (signedThumbnail) {
          thumbnailPreviewMedia.src = signedThumbnail;
          thumbnailPreviewFileName.textContent = `Actual: ${formState.existingThumbnailPath.split("/").pop()}`;
          thumbnailPreviewBox.style.display = "block";
        }
      }
      updateSubtitlesHint(lesson.subtitles_path || null);
    }

    function resetLessonForm() {
      formState.editingLessonId = null;
      formState.existingVideoPath = null;
      formState.existingThumbnailPath = null;
      formState.existingSubtitlesPath = null;

      titleInput.value = "";
      slugInput.value = "";
      descriptionInput.value = "";
      courseSelect.value = "";
      populateModuleSelect(moduleSelect, [], true);
      orderInput.value = "";
      videoUrlInput.value = "";
      durationInput.value = "";
      subtitlesInput.value = "";
      thumbnailInput.value = "";
      materialsInput.value = "";
      notesInput.value = "";
      statusSelect.value = "draft";
      scheduledAtInput.value = "";
      freePreviewInput.checked = false;
      allowDownloadInput.checked = false;
      allowCommentsInput.checked = true;
      setVideoTypeInput("upload");
      if (videoPreviewControl && typeof videoPreviewControl.clear === "function") {
        videoPreviewControl.clear();
      }
      if (thumbnailPreviewControl && typeof thumbnailPreviewControl.clear === "function") {
        thumbnailPreviewControl.clear();
      }
      setExternalResourceRows([]);
      updateSubtitlesHint(null);
      activateInfoTab();
    }

    async function openCreateLessonModal() {
      setModalMode("create");
      populateCourseSelect(courseSelect, true);
      resetLessonForm();
      if (window.AdminModal) {
        window.AdminModal.open("modal-lesson");
      }
    }

    async function openEditLessonModal(lesson) {
      if (!lesson) return;
      setModalMode("edit");
      populateCourseSelect(courseSelect, true);
      resetLessonForm();

      formState.editingLessonId = lesson.id;
      formState.existingVideoPath = lesson.video_path || null;
      formState.existingThumbnailPath = lesson.thumbnail_path || null;
      formState.existingSubtitlesPath = lesson.subtitles_path || null;

      titleInput.value = lesson.title || "";
      slugInput.value = lesson.slug || "";
      descriptionInput.value = lesson.description || "";
      courseSelect.value = lesson.course_id || "";
      await syncModuleOptions(courseSelect.value, lesson.module_id || "");
      orderInput.value = lesson.lesson_order != null ? String(lesson.lesson_order) : "";
      durationInput.value = formatDurationLabel(lesson.duration_seconds || 0).replace(/^—$/, "");
      notesInput.value = lesson.notes || "";
      statusSelect.value = lesson.status || "draft";
      scheduledAtInput.value = toDatetimeLocalValue(lesson.scheduled_at);
      freePreviewInput.checked = !!lesson.is_free_preview;
      allowDownloadInput.checked = !!lesson.allow_video_download;
      allowCommentsInput.checked = !!lesson.allow_comments;
      videoUrlInput.value = lesson.video_url || "";
      setVideoTypeInput(mapVideoTypeToInput(lesson.video_type));

      const { data: resources, error: resourcesError } = await supabase
        .from("lesson_external_resources")
        .select("title,url,display_order")
        .eq("lesson_id", lesson.id)
        .order("display_order", { ascending: true });
      if (resourcesError) throw resourcesError;
      setExternalResourceRows(resources || []);

      await renderStoredMediaPreviews(lesson);
      activateInfoTab();
      if (window.AdminModal) {
        window.AdminModal.open("modal-lesson");
      }
    }

    window.addResourceRow = function() {
      if (!externalResourcesContainer) return;
      externalResourcesContainer.appendChild(buildResourceRow("", ""));
    };

    if (newLessonButton) {
      newLessonButton.onclick = function(event) {
        event.preventDefault();
        openCreateLessonModal();
      };
    }
    window.openLessonCreateModal = openCreateLessonModal;
    state.lessonEditor = {
      openCreate: openCreateLessonModal,
      openEdit: async (lesson) => {
        try {
          await openEditLessonModal(lesson);
        } catch (err) {
          toast("error", "No se pudo cargar la clase", err.message);
        }
      }
    };

    populateCourseSelect(courseSelect, true);
    populateModuleSelect(moduleSelect, [], true);
    setExternalResourceRows([]);
    setModalMode("create");

    titleInput.addEventListener("blur", () => {
      if (!slugInput.value.trim()) {
        slugInput.value = slugify(titleInput.value);
      }
    });

    courseSelect.addEventListener("change", async () => {
      try {
        if (courseSelect.value === SPECIAL_NEW_COURSE) {
          const newCourse = await createQuickCourse();
          populateCourseSelect(courseSelect, true);
          if (newCourse) {
            courseSelect.value = newCourse.id;
          } else {
            courseSelect.value = "";
          }
        }

        if (!courseSelect.value) {
          populateModuleSelect(moduleSelect, [], true);
          return;
        }

        await syncModuleOptions(courseSelect.value, null);
      } catch (err) {
        toast("error", "No se pudo cargar módulos", err.message);
      }
    });

    moduleSelect.addEventListener("change", async () => {
      try {
        if (moduleSelect.value !== SPECIAL_NEW_MODULE) return;
        if (!courseSelect.value) {
          toast("warning", "Selecciona curso", "Debes elegir un curso antes de crear módulo.");
          moduleSelect.value = "";
          return;
        }

        const moduleCreated = await createQuickModule(courseSelect.value);
        const modules = state.modulesByCourse.get(courseSelect.value) || [];
        populateModuleSelect(moduleSelect, modules, true);
        moduleSelect.value = moduleCreated ? moduleCreated.id : "";
      } catch (err) {
        toast("error", "No se pudo crear módulo", err.message);
      }
    });

    async function saveLesson(forceDraft) {
      const title = titleInput.value.trim();
      const description = descriptionInput.value.trim();
      const courseId = courseSelect.value;
      const moduleId = moduleSelect.value;
      const selectedVideoType = document.querySelector("input[name='video-type']:checked");
      const videoType = selectedVideoType ? selectedVideoType.value : "upload";
      const parsedDuration = parseDurationToSeconds(durationInput.value);
      const normalizedSlug = slugify(slugInput.value || title);
      const finalStatus = forceDraft ? "draft" : statusSelect.value;
      const isEditMode = formState.mode === "edit" && !!formState.editingLessonId;
      const lessonId = isEditMode ? formState.editingLessonId : null;
      const currentLesson = isEditMode
        ? state.adminLessons.find((item) => item.id === lessonId)
        : null;

      if (!title || !description || !courseId || !moduleId || moduleId === SPECIAL_NEW_MODULE) {
        toast("warning", "Campos requeridos", "Completa título, descripción, curso y módulo.");
        return;
      }

      if (!normalizedSlug) {
        toast("warning", "Slug inválido", "No se pudo generar un slug válido para la clase.");
        return;
      }

      if (durationInput.value.trim() && parsedDuration == null) {
        toast("warning", "Duración inválida", "Usa MM:SS o HH:MM:SS.");
        return;
      }

      if (videoType === "upload" && (!videoFileInput.files || !videoFileInput.files.length) && !formState.existingVideoPath) {
        toast("warning", "Video requerido", "Selecciona un archivo de video para subir.");
        return;
      }

      if (videoType !== "upload" && !videoUrlInput.value.trim()) {
        toast("warning", "URL requerida", "Ingresa la URL del video.");
        return;
      }

      if (finalStatus === "scheduled" && !scheduledAtInput.value) {
        toast("warning", "Fecha requerida", "Debes indicar fecha de publicación para estado programado.");
        return;
      }

      const submitButton = forceDraft ? draftButton : saveButton;
      const originalHtml = submitButton.innerHTML;
      submitButton.disabled = true;
      submitButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

      try {
        const selectedCourse = state.courses.find((course) => course.id === courseId);
        const lessonOrder = Number(orderInput.value) > 0
          ? Number(orderInput.value)
          : (currentLesson && Number(currentLesson.lesson_order) > 0
              ? Number(currentLesson.lesson_order)
              : await getNextLessonOrder(moduleId));
        const baseLessonPayload = {
          course_id: courseId,
          module_id: moduleId,
          slug: normalizedSlug,
          title,
          description,
          lesson_order: lessonOrder,
          status: finalStatus,
          plan_required: selectedCourse ? selectedCourse.plan_required : "basico",
          video_type: mapVideoType(videoType),
          video_url: videoType === "upload" ? null : videoUrlInput.value.trim(),
          duration_seconds: parsedDuration,
          notes: notesInput.value.trim() || null,
          is_free_preview: !!freePreviewInput.checked,
          allow_video_download: !!allowDownloadInput.checked,
          allow_comments: !!allowCommentsInput.checked,
          scheduled_at: finalStatus === "scheduled" ? new Date(scheduledAtInput.value).toISOString() : null
        };

        let storedLessonId = lessonId;
        if (isEditMode) {
          const { error: updateLessonError } = await supabase
            .from("lessons")
            .update(Object.assign({}, baseLessonPayload, {
              video_path: mapVideoType(videoType) === "upload" ? (formState.existingVideoPath || null) : null
            }))
            .eq("id", lessonId);
          if (updateLessonError) {
            if (updateLessonError.code === "23505") {
              throw new Error("Ya existe otra clase con ese slug u orden en el módulo.");
            }
            throw updateLessonError;
          }
        } else {
          const lesson = await insertLessonWithUniqueSlug(baseLessonPayload);
          storedLessonId = lesson.id;
        }

        const updateFields = {};
        const lessonBasePath = `courses/${courseId}/modules/${moduleId}/lessons/${storedLessonId}`;

        if (videoType === "upload" && videoFileInput.files && videoFileInput.files.length) {
          const video = videoFileInput.files[0];
          const ext = getExtension(video.name) || "mp4";
          const videoPath = `${lessonBasePath}/video-${Date.now()}-${uniqueToken()}.${ext}`;
          await uploadToBucket("lesson-videos", videoPath, video);
          updateFields.video_path = videoPath;
          updateFields.video_url = null;
          formState.existingVideoPath = videoPath;
        } else if (videoType !== "upload") {
          updateFields.video_path = null;
          updateFields.video_url = videoUrlInput.value.trim() || null;
          formState.existingVideoPath = null;
        }

        if (thumbnailInput.files && thumbnailInput.files.length) {
          const image = thumbnailInput.files[0];
          const ext = getExtension(image.name) || "jpg";
          const imagePath = `${lessonBasePath}/thumb-${Date.now()}-${uniqueToken()}.${ext}`;
          await uploadToBucket("media-library", imagePath, image);
          updateFields.thumbnail_path = imagePath;
          formState.existingThumbnailPath = imagePath;
        } else if (
          isEditMode &&
          currentLesson &&
          currentLesson.thumbnail_path &&
          !formState.existingThumbnailPath
        ) {
          updateFields.thumbnail_path = null;
        }

        if (subtitlesInput.files && subtitlesInput.files.length) {
          const subtitle = subtitlesInput.files[0];
          const ext = getExtension(subtitle.name) || "vtt";
          const subtitlePath = `${lessonBasePath}/subs-${Date.now()}-${uniqueToken()}.${ext}`;
          await uploadToBucket("media-library", subtitlePath, subtitle);
          updateFields.subtitles_path = subtitlePath;
          formState.existingSubtitlesPath = subtitlePath;
        }

        if (Object.keys(updateFields).length) {
          const { error: updateError } = await supabase
            .from("lessons")
            .update(updateFields)
            .eq("id", storedLessonId);
          if (updateError) throw updateError;
        }

        if (materialsInput.files && materialsInput.files.length) {
          const materialRows = [];
          for (const file of Array.from(materialsInput.files)) {
            const ext = getExtension(file.name);
            const safeName = sanitizePathSegment(file.name) || `material-${Date.now()}.${ext || "bin"}`;
            const materialPath = `${lessonBasePath}/materials/${Date.now()}-${uniqueToken()}-${safeName}`;
            await uploadToBucket("lesson-materials", materialPath, file);
            materialRows.push({
              course_id: courseId,
              module_id: moduleId,
              lesson_id: storedLessonId,
              title: file.name.replace(/\.[^.]+$/, ""),
              description: null,
              category: "Clase",
              file_name: file.name,
              mime_type: file.type || null,
              file_ext: ext || null,
              size_bytes: file.size || 0,
              storage_path: materialPath,
              plan_required: selectedCourse ? selectedCourse.plan_required : "basico"
            });
          }

          if (materialRows.length) {
            const { error: materialError } = await supabase
              .from("lesson_materials")
              .insert(materialRows);
            if (materialError) throw materialError;
          }
        }

        const resources = collectExternalResourceRows();
        if (isEditMode) {
          const { error: deleteResourcesError } = await supabase
            .from("lesson_external_resources")
            .delete()
            .eq("lesson_id", storedLessonId);
          if (deleteResourcesError) throw deleteResourcesError;
        }
        if (resources.length) {
          const payload = resources.map((item, index) => ({
            lesson_id: storedLessonId,
            title: item.title,
            url: item.url,
            display_order: index + 1
          }));
          const { error: resourceError } = await supabase
            .from("lesson_external_resources")
            .insert(payload);
          if (resourceError) throw resourceError;
        }

        await loadAdminLessonsTable();
        renderLessonsTable();

        toast(
          "success",
          isEditMode ? "Clase actualizada" : "Clase guardada",
          isEditMode
            ? "La clase se actualizó con todas las opciones del formulario."
            : "La clase y sus archivos se guardaron en Supabase."
        );
        resetLessonForm();
        setModalMode("create");
        if (window.AdminModal) {
          window.AdminModal.close("modal-lesson");
        }
      } catch (err) {
        toast("error", "No se pudo guardar la clase", err.message);
      } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalHtml;
      }
    }

    if (videoClearBtn) {
      videoClearBtn.addEventListener("click", () => {
        if (formState.mode === "edit" && (!videoFileInput.files || !videoFileInput.files.length)) {
          formState.existingVideoPath = null;
        }
      });
    }
    if (thumbnailClearBtn) {
      thumbnailClearBtn.addEventListener("click", () => {
        if (formState.mode === "edit" && (!thumbnailInput.files || !thumbnailInput.files.length)) {
          formState.existingThumbnailPath = null;
        }
      });
    }

    saveButton.addEventListener("click", () => saveLesson(false));
    if (draftButton) {
      draftButton.addEventListener("click", () => saveLesson(true));
    }
  }

  async function initMaterialsForm() {
    const saveButton = document.getElementById("saveMaterialBtn");
    if (!saveButton) return;

    const titleInput = document.getElementById("materialTitleInput");
    const descriptionInput = document.getElementById("materialDescriptionInput");
    const filesInput = document.getElementById("materialFilesInput");
    const courseSelect = document.getElementById("materialCourseSelect");
    const moduleSelect = document.getElementById("materialModuleSelect");
    const lessonSelect = document.getElementById("materialLessonSelect");
    const categorySelect = document.getElementById("materialCategorySelect");
    const planSelect = document.getElementById("materialPlanSelect");
    const bulkInput = document.getElementById("bulkMaterialsInput");

    function populateMaterialModuleSelect(modules, selectedValue) {
      if (!moduleSelect) return;
      const options = [{ value: "", label: "Sin módulo específico" }];
      (modules || []).forEach((module) => {
        options.push({
          value: module.id,
          label: `${module.module_order || "—"}. ${module.title}`
        });
      });
      setOptions(moduleSelect, options, selectedValue);
    }

    function populateMaterialLessonSelect(lessons, selectedValue) {
      if (!lessonSelect) return;
      const options = [{ value: "", label: "Sin clase específica" }];
      (lessons || []).forEach((lesson) => {
        options.push({
          value: lesson.id,
          label: `${lesson.title} (${lesson.status === "published" ? "publicada" : "borrador"})`
        });
      });
      setOptions(lessonSelect, options, selectedValue);
    }

    populateCourseSelect(courseSelect, true);
    populateMaterialModuleSelect([], "");
    populateMaterialLessonSelect([], "");

    courseSelect.addEventListener("change", async () => {
      try {
        if (courseSelect.value === SPECIAL_NEW_COURSE) {
          const createdCourse = await createQuickCourse();
          populateCourseSelect(courseSelect, true);
          if (createdCourse) {
            courseSelect.value = createdCourse.id;
          } else {
            courseSelect.value = "";
          }
        }

        if (!courseSelect.value) {
          populateMaterialModuleSelect([], "");
          populateMaterialLessonSelect([], "");
          return;
        }
        const selectedCourse = state.courses.find((item) => sameId(item.id, courseSelect.value));
        if (selectedCourse && planSelect) {
          planSelect.value = selectedCourse.plan_required || "basico";
        }
        const [modules, lessons] = await Promise.all([
          loadModules(courseSelect.value),
          loadLessons(courseSelect.value)
        ]);
        populateMaterialModuleSelect(modules, "");
        populateMaterialLessonSelect(lessons, "");
      } catch (err) {
        toast("error", "No se pudo cargar clases", err.message);
      }
    });

    if (moduleSelect) {
      moduleSelect.addEventListener("change", async () => {
        const courseId = courseSelect.value;
        if (!courseId) {
          populateMaterialLessonSelect([], "");
          return;
        }
        const selectedModuleId = moduleSelect.value;
        const lessons = state.lessonsByCourse.get(courseId) || await loadLessons(courseId);
        const filteredLessons = selectedModuleId
          ? lessons.filter((lesson) => sameId(lesson.module_id, selectedModuleId))
          : lessons;
        populateMaterialLessonSelect(filteredLessons, "");
      });
    }

    if (lessonSelect) {
      lessonSelect.addEventListener("change", async () => {
        const lessonId = lessonSelect.value;
        if (!lessonId || !courseSelect.value || !moduleSelect) return;
        const lessons = state.lessonsByCourse.get(courseSelect.value) || await loadLessons(courseSelect.value);
        const selectedLesson = lessons.find((item) => sameId(item.id, lessonId));
        if (selectedLesson && selectedLesson.module_id) {
          moduleSelect.value = selectedLesson.module_id;
        }
      });
    }

    if (bulkInput) {
      bulkInput.addEventListener("change", () => {
        if (!bulkInput.files || !bulkInput.files.length) return;
        const transfer = new DataTransfer();
        Array.from(bulkInput.files).forEach((file) => transfer.items.add(file));
        filesInput.files = transfer.files;
        if (window.AdminModal) {
          window.AdminModal.open("modal-material");
        }
        toast("info", "Archivos listos", "Completa el formulario y guarda para subir materiales.");
      });
    }

    saveButton.addEventListener("click", async () => {
      const files = filesInput.files ? Array.from(filesInput.files) : [];
      const courseId = courseSelect.value;
      const lessonId = lessonSelect.value || null;
      const selectedModuleId = moduleSelect ? (moduleSelect.value || null) : null;
      const category = categorySelect ? categorySelect.value : null;
      const description = descriptionInput ? descriptionInput.value.trim() : "";
      const title = titleInput ? titleInput.value.trim() : "";
      const planRequired = planSelect ? planSelect.value : "basico";

      if (!courseId) {
        toast("warning", "Curso requerido", "Selecciona un curso para asociar el material.");
        return;
      }

      if (!files.length) {
        toast("warning", "Archivo requerido", "Selecciona al menos un archivo.");
        return;
      }

      const originalHtml = saveButton.innerHTML;
      saveButton.disabled = true;
      saveButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo...';

      try {
        let moduleId = selectedModuleId;
        let lessonTitle = null;
        if (lessonId) {
          const lessons = state.lessonsByCourse.get(courseId) || [];
          const lesson = lessons.find((item) => sameId(item.id, lessonId));
          if (lesson) {
            moduleId = lesson.module_id;
            lessonTitle = lesson.title;
          }
        }

        const course = state.courses.find((item) => sameId(item.id, courseId));
        const insertedRows = [];

        for (let i = 0; i < files.length; i += 1) {
          const file = files[i];
          const ext = getExtension(file.name);
          const safeFileName = sanitizePathSegment(file.name) || `material-${Date.now()}.${ext || "bin"}`;
          const folder = moduleId || "general";
          const storagePath = `courses/${courseId}/materials/${folder}/${Date.now()}-${uniqueToken()}-${safeFileName}`;
          await uploadToBucket("lesson-materials", storagePath, file);

          const materialTitle = files.length === 1
            ? (title || file.name.replace(/\.[^.]+$/, ""))
            : (title ? `${title} (${i + 1})` : file.name.replace(/\.[^.]+$/, ""));

          insertedRows.push({
            course_id: courseId,
            module_id: moduleId,
            lesson_id: lessonId,
            title: materialTitle,
            description: description || null,
            category: category || null,
            file_name: file.name,
            mime_type: file.type || null,
            file_ext: ext || null,
            size_bytes: file.size || 0,
            storage_path: storagePath,
            plan_required: planRequired || (course ? course.plan_required : "basico")
          });
        }

        const { data: inserted, error } = await supabase
          .from("lesson_materials")
          .insert(insertedRows)
          .select("id,title,file_name,file_ext,size_bytes,created_at");

        if (error) throw error;
        if (!inserted || !inserted.length) {
          throw new Error("No se recibió confirmación de materiales insertados.");
        }

        if (document.getElementById("materialsTableBody")) {
          await loadAdminMaterialsTable();
          renderMaterialsTable();
        }

        toast("success", "Material guardado", `Se subieron ${insertedRows.length} archivo(s) correctamente.`);
        if (titleInput) titleInput.value = "";
        if (descriptionInput) descriptionInput.value = "";
        if (filesInput) filesInput.value = "";
        if (moduleSelect) moduleSelect.value = "";
        if (lessonSelect) lessonSelect.value = "";
        if (categorySelect) categorySelect.selectedIndex = 0;
        if (bulkInput) bulkInput.value = "";
        if (window.AdminModal) {
          window.AdminModal.close("modal-material");
        }
      } catch (err) {
        toast("error", "No se pudo subir material", err.message);
      } finally {
        saveButton.disabled = false;
        saveButton.innerHTML = originalHtml;
      }
    });
  }

  async function init() {
    try {
      const allowed = await ensureAdmin();
      if (!allowed) return;

      await loadCourses();
      bindCoursesGridActions();
      renderCoursesGrid();
      await initCoursesForm();
      await initModuleForm();
      await initClassesForm();
      if (document.getElementById("lessonsTableBody")) {
        await loadAdminLessonsTable();
        renderLessonsTable();
        bindLessonsTableActions();
      }
      await initMaterialsForm();
      if (document.getElementById("materialsTableBody")) {
        await loadAdminMaterialsTable();
        renderMaterialsTable();
        bindMaterialsTableActions();
      }
    } catch (err) {
      toast("error", "Error de Supabase", err.message);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
