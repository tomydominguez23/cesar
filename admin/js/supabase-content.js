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
    lessonsByCourse: new Map()
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
      .select("id,title,slug,plan_required,status,display_order")
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
      .select("id,title,module_order,status")
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
      .select("id,title,slug,plan_required,status,display_order")
      .single();

    if (error) throw error;
    state.courses.push(created);
    state.courses.sort((a, b) => a.display_order - b.display_order);
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
      .select("id,title,module_order,status")
      .single();

    if (error) throw error;

    const list = state.modulesByCourse.get(courseId) || [];
    list.push(created);
    list.sort((a, b) => a.module_order - b.module_order);
    state.modulesByCourse.set(courseId, list);
    toast("success", "Módulo creado", `Se creó "${title}" en borrador.`);
    return created;
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

  async function insertLessonWithUniqueSlug(payload) {
    let attempt = 0;
    const baseSlug = payload.slug;

    while (attempt < 6) {
      const currentPayload = Object.assign({}, payload, {
        slug: attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`
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

      attempt += 1;
    }

    throw new Error("No se pudo crear la clase por conflicto de slug.");
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

  function appendMaterialToTable(material, courseTitle, lessonTitle) {
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
            <strong>${material.title}</strong>
            <div class="text-small text-muted">${material.file_name}</div>
          </div>
        </div>
      </td>
      <td><span style="font-size: 11px; font-weight: 600; background: rgba(13,79,79,0.1); color: #0d4f4f; padding: 3px 8px; border-radius: 4px;">${extLabel}</span></td>
      <td>
        <div>${courseTitle || "—"}</div>
        <div class="text-small text-muted">${lessonTitle || "Sin clase específica"}</div>
      </td>
      <td>${formatBytes(material.size_bytes)}</td>
      <td>0</td>
      <td>${formatDate(material.created_at)}</td>
      <td>
        <div class="table-actions">
          <button class="table-action-btn" title="Editar"><i class="fa-solid fa-pen"></i></button>
          <button class="table-action-btn" title="Descargar"><i class="fa-solid fa-download"></i></button>
          <button class="table-action-btn danger" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.insertBefore(row, tbody.firstChild);
  }

  function mapVideoType(value) {
    if (value === "upload") return "upload";
    if (value === "url") return "external_url";
    if (value === "youtube") return "youtube";
    if (value === "vimeo") return "vimeo";
    return "upload";
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

  function appendCourseCard(course) {
    const grid = document.querySelector(".course-grid");
    if (!grid) return;

    const row = document.createElement("div");
    row.className = "course-card-admin";
    const statusClass = course.status === "published" ? "active" : "draft";
    const statusLabel = course.status === "published" ? "Publicado" : "Borrador";
    row.innerHTML = `
      <div class="course-card-thumb" style="background: linear-gradient(135deg, #0d4f4f, #1a6b6b);">
        <div class="course-card-status"><span class="status-badge ${statusClass}">${statusLabel}</span></div>
        <div class="course-card-plan"><span class="plan-badge ${getPlanBadgeClass(course.plan_required)}">${getPlanLabel(course.plan_required)}</span></div>
      </div>
      <div class="course-card-body">
        <h3 class="course-card-title">${course.title}</h3>
        <p class="course-card-desc">${course.description || "Curso creado desde panel de administración."}</p>
        <div class="course-card-meta">
          <span><i class="fa-solid fa-layer-group"></i> 0 módulos</span>
          <span><i class="fa-solid fa-play"></i> 0 clases</span>
          <span><i class="fa-solid fa-users"></i> 0</span>
        </div>
        <div class="course-card-footer">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="text-small text-muted">Curso recién creado</span>
          </div>
          <div class="table-actions">
            <button class="table-action-btn" title="Editar"><i class="fa-solid fa-pen"></i></button>
            <button class="table-action-btn" title="Módulos"><i class="fa-solid fa-layer-group"></i></button>
            <button class="table-action-btn danger" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      </div>
    `;
    grid.insertBefore(row, grid.firstChild);
  }

  async function initCoursesForm() {
    const saveButton = document.getElementById("saveCourseBtn");
    if (!saveButton) return;

    const titleInput = document.getElementById("courseTitleInput");
    const slugInput = document.getElementById("courseSlugInput");
    const descriptionInput = document.getElementById("courseDescriptionInput");
    const planSelect = document.getElementById("coursePlanSelect");
    const orderInput = document.getElementById("courseOrderInput");
    const statusSelect = document.getElementById("courseStatusSelect");
    const coverInput = document.getElementById("courseCoverInput");
    const coverPreviewControl = setupMediaPreview({
      input: coverInput,
      box: document.getElementById("courseCoverPreviewWrap"),
      media: document.getElementById("courseCoverPreview"),
      fileName: document.getElementById("courseCoverFileName"),
      clearBtn: document.getElementById("courseCoverClearBtn"),
      kind: "image"
    });

    if (titleInput && slugInput) {
      titleInput.addEventListener("blur", () => {
        if (!slugInput.value.trim()) {
          slugInput.value = slugify(titleInput.value);
        }
      });
    }

    saveButton.addEventListener("click", async () => {
      const title = titleInput ? titleInput.value.trim() : "";
      const description = descriptionInput ? descriptionInput.value.trim() : "";
      const planRequired = planSelect ? planSelect.value : "";
      const status = statusSelect ? statusSelect.value : "draft";
      const generatedSlug = slugify(slugInput ? slugInput.value : "") || slugify(title);
      const parsedOrder = Number(orderInput ? orderInput.value : "");
      const displayOrder = parsedOrder > 0
        ? parsedOrder
        : ((state.courses.reduce((max, item) => Math.max(max, Number(item.display_order) || 0), 0)) + 1);

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
        const created = await insertCourseWithUniqueSlug({
          title,
          slug: generatedSlug,
          description,
          plan_required: planRequired,
          status,
          display_order: displayOrder
        });

        if (coverInput && coverInput.files && coverInput.files.length) {
          const coverFile = coverInput.files[0];
          const ext = getExtension(coverFile.name) || "jpg";
          const coverPath = `courses/${created.id}/cover-${Date.now()}-${uniqueToken()}.${ext}`;
          await uploadToBucket("media-library", coverPath, coverFile);

          const { error: coverError } = await supabase
            .from("courses")
            .update({ cover_url: coverPath })
            .eq("id", created.id);

          if (coverError) throw coverError;
          created.cover_url = coverPath;
        }

        state.courses.push(created);
        state.courses.sort((a, b) => a.display_order - b.display_order);
        appendCourseCard(created);

        toast("success", "Curso guardado", "El curso se creó correctamente en Supabase.");
        if (titleInput) titleInput.value = "";
        if (slugInput) slugInput.value = "";
        if (descriptionInput) descriptionInput.value = "";
        if (planSelect) planSelect.value = "";
        if (orderInput) orderInput.value = "";
        if (statusSelect) statusSelect.value = "draft";
        if (coverPreviewControl && typeof coverPreviewControl.clear === "function") {
          coverPreviewControl.clear();
        }
        if (window.AdminModal) {
          window.AdminModal.close("modal-course");
        }
      } catch (err) {
        toast("error", "No se pudo crear el curso", err.message);
      } finally {
        saveButton.disabled = false;
        saveButton.innerHTML = originalHtml;
      }
    });
  }

  async function initClassesForm() {
    const saveButton = document.getElementById("saveLessonBtn");
    if (!saveButton) return;

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
    const videoPreviewControl = setupMediaPreview({
      input: videoFileInput,
      box: document.getElementById("lessonVideoPreviewBox"),
      media: document.getElementById("lessonVideoPreview"),
      fileName: document.getElementById("lessonVideoFileName"),
      clearBtn: document.getElementById("lessonVideoClearBtn"),
      kind: "video"
    });
    const thumbnailPreviewControl = setupMediaPreview({
      input: thumbnailInput,
      box: document.getElementById("lessonThumbnailPreviewBox"),
      media: document.getElementById("lessonThumbnailPreview"),
      fileName: document.getElementById("lessonThumbnailFileName"),
      clearBtn: document.getElementById("lessonThumbnailClearBtn"),
      kind: "image"
    });

    populateCourseSelect(courseSelect, true);

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

        const modules = await loadModules(courseSelect.value);
        populateModuleSelect(moduleSelect, modules, true);
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

      if (videoType === "upload" && (!videoFileInput.files || !videoFileInput.files.length)) {
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
        const lessonOrder = Number(orderInput.value) > 0 ? Number(orderInput.value) : await getNextLessonOrder(moduleId);
        const lesson = await insertLessonWithUniqueSlug({
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
        });

        const updateFields = {};
        const lessonBasePath = `courses/${courseId}/modules/${moduleId}/lessons/${lesson.id}`;

        if (videoType === "upload" && videoFileInput.files && videoFileInput.files.length) {
          const video = videoFileInput.files[0];
          const ext = getExtension(video.name) || "mp4";
          const videoPath = `${lessonBasePath}/video-${Date.now()}-${uniqueToken()}.${ext}`;
          await uploadToBucket("lesson-videos", videoPath, video);
          updateFields.video_path = videoPath;
          updateFields.video_url = null;
        }

        if (thumbnailInput.files && thumbnailInput.files.length) {
          const image = thumbnailInput.files[0];
          const ext = getExtension(image.name) || "jpg";
          const imagePath = `${lessonBasePath}/thumb-${Date.now()}-${uniqueToken()}.${ext}`;
          await uploadToBucket("media-library", imagePath, image);
          updateFields.thumbnail_path = imagePath;
        }

        if (subtitlesInput.files && subtitlesInput.files.length) {
          const subtitle = subtitlesInput.files[0];
          const ext = getExtension(subtitle.name) || "vtt";
          const subtitlePath = `${lessonBasePath}/subs-${Date.now()}-${uniqueToken()}.${ext}`;
          await uploadToBucket("media-library", subtitlePath, subtitle);
          updateFields.subtitles_path = subtitlePath;
        }

        if (Object.keys(updateFields).length) {
          const { error: updateError } = await supabase
            .from("lessons")
            .update(updateFields)
            .eq("id", lesson.id);
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
              lesson_id: lesson.id,
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

        if (externalResourcesContainer) {
          const rows = [];
          externalResourcesContainer.querySelectorAll("div").forEach((resourceRow) => {
            const fields = resourceRow.querySelectorAll("input");
            if (fields.length < 2) return;
            const resourceTitle = fields[0].value.trim();
            const resourceUrl = fields[1].value.trim();
            if (resourceTitle && resourceUrl) {
              rows.push({
                lesson_id: lesson.id,
                title: resourceTitle,
                url: resourceUrl
              });
            }
          });

          if (rows.length) {
            const payload = rows.map((item, index) => ({
              lesson_id: item.lesson_id,
              title: item.title,
              url: item.url,
              display_order: index + 1
            }));
            const { error: resourceError } = await supabase
              .from("lesson_external_resources")
              .insert(payload);
            if (resourceError) throw resourceError;
          }
        }

        const modules = state.modulesByCourse.get(courseId) || [];
        const selectedModule = modules.find((module) => module.id === moduleId);
        appendLessonToTable(
          { title },
          selectedCourse ? selectedCourse.title : "",
          selectedModule ? selectedModule.title : "",
          durationInput.value.trim(),
          finalStatus
        );

        toast("success", "Clase guardada", "La clase y sus archivos se guardaron en Supabase.");
        titleInput.value = "";
        slugInput.value = "";
        descriptionInput.value = "";
        orderInput.value = "";
        videoUrlInput.value = "";
        durationInput.value = "";
        subtitlesInput.value = "";
        materialsInput.value = "";
        notesInput.value = "";
        statusSelect.value = "draft";
        scheduledAtInput.value = "";
        freePreviewInput.checked = false;
        allowDownloadInput.checked = false;
        allowCommentsInput.checked = true;
        if (videoPreviewControl && typeof videoPreviewControl.clear === "function") {
          videoPreviewControl.clear();
        }
        if (thumbnailPreviewControl && typeof thumbnailPreviewControl.clear === "function") {
          thumbnailPreviewControl.clear();
        }
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
    const lessonSelect = document.getElementById("materialLessonSelect");
    const categorySelect = document.getElementById("materialCategorySelect");
    const planSelect = document.getElementById("materialPlanSelect");
    const bulkInput = document.getElementById("bulkMaterialsInput");

    populateCourseSelect(courseSelect, true);
    populateLessonSelect(lessonSelect, []);

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
          populateLessonSelect(lessonSelect, []);
          return;
        }
        const lessons = await loadLessons(courseSelect.value);
        populateLessonSelect(lessonSelect, lessons);
      } catch (err) {
        toast("error", "No se pudo cargar clases", err.message);
      }
    });

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
        let moduleId = null;
        let lessonTitle = null;
        if (lessonId) {
          const lessons = state.lessonsByCourse.get(courseId) || [];
          const lesson = lessons.find((item) => item.id === lessonId);
          if (lesson) {
            moduleId = lesson.module_id;
            lessonTitle = lesson.title;
          }
        }

        const course = state.courses.find((item) => item.id === courseId);
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

        (inserted || []).forEach((item) => {
          appendMaterialToTable(item, course ? course.title : "", lessonTitle);
        });

        toast("success", "Material guardado", `Se subieron ${insertedRows.length} archivo(s) correctamente.`);
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
      await initCoursesForm();
      await initClassesForm();
      await initMaterialsForm();
    } catch (err) {
      toast("error", "Error de Supabase", err.message);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
