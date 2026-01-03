// app.js
const $ = (id) => document.getElementById(id);

const DRAFT_KEY = "tnr_draft_v2"; // увеличил версию черновика
let deferredPrompt = null;

// -----------------------------
// Code generator: 4 digits + 2 letters (e.g., 4145AB)
// -----------------------------
function pad4(n) {
  return String(n).padStart(4, "0");
}

function randLetter() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return letters[Math.floor(Math.random() * letters.length)];
}

function genTempCode() {
  const n = Math.floor(Math.random() * 10000);
  return `${pad4(n)}${randLetter()}${randLetter()}`;
}

function nowISO() {
  const d = new Date();
  return d.toISOString().replace("T", " ").slice(0, 19);
}

function normalizePhone(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  if (!digits) return null;

  // Казахстан/Россия: приводим к +7...
  if (digits.length === 11 && (digits.startsWith("8") || digits.startsWith("7"))) {
    return "+7" + digits.slice(1);
  }
  if (digits.length === 10) {
    return "+7" + digits;
  }
  // иначе просто +
  return "+" + digits;
}

function normalizeTempCode(code) {
  if (!code) return null;
  let s = String(code).trim().toUpperCase();
  if (!s) return null;
  s = s.replace(/[ \-_]/g, ""); // убрать пробелы/дефисы/подчёркивания
  return s || null;
}

function getDistrictValue() {
  const sel = $("district").value;
  if (sel === "__manual__") return $("districtManual").value.trim();
  return sel.trim();
}

function toggleBlocks() {
  // район вручную
  const d = $("district").value;
  $("districtManual").classList.toggle("hidden", d !== "__manual__");

  // владелец
  const st = $("status").value;
  $("ownerBlock").classList.toggle("hidden", st !== "owned");

  // вакцинация
  const vac = $("vaccinated").checked;
  $("vacBlock").classList.toggle("hidden", !vac);
}

// -----------------------------
// Photo helpers
// -----------------------------
function getSelectedPhotoFile() {
  const photoInput = $("photo");
  return photoInput.files && photoInput.files[0] ? photoInput.files[0] : null;
}

function buildPhotoMeta(file, tempCode) {
  if (!file) return null;

  const originalName = file.name || "photo.jpg";
  const ext = originalName.includes(".") ? originalName.split(".").pop() : "jpg";

  const code = normalizeTempCode(tempCode);
  const suggested = code ? `${code}.${ext}` : originalName;

  return {
    original_name: originalName,
    suggested_name: suggested,
    type: file.type || null,
    size: typeof file.size === "number" ? file.size : null,
    lastModified: typeof file.lastModified === "number" ? file.lastModified : null,
  };
}

// -----------------------------
// Payload
// -----------------------------
function collectPayload() {
  const district = getDistrictValue();
  const address = $("address").value.trim();
  const status = $("status").value;

  if (!district) return { ok: false, msg: "Укажи район." };
  if (!status) return { ok: false, msg: "Укажи статус." };
  if (!address) return { ok: false, msg: "Укажи адрес." };

  const vaccinated = $("vaccinated").checked;
  const vdate = $("vaccination_date").value || null;

  const file = getSelectedPhotoFile();

  const tempCode = normalizeTempCode($("temp_code").value) || null;

  // Если выбрали фото — нужен код, чтобы координатору легко состыковать
  if (file && !tempCode) {
    return { ok: false, msg: "Если прикрепляешь фото — сначала сгенерируй/укажи temp_code." };
  }

  const payload = {
    district,
    address,
    status,

    temp_code: tempCode,
    nickname: $("nickname").value.trim() || null,
    sex: $("sex").value || "U",
    approx_age_years: $("age").value ? Number($("age").value) : null,
    sterilized: $("sterilized").checked,
    vaccinated: vaccinated,
    vaccination_date: vaccinated ? (vdate || null) : null,

    owner_name: status === "owned" ? ($("owner_name").value.trim() || null) : null,
    owner_phone: status === "owned" ? (normalizePhone($("owner_phone").value) || null) : null,

    notes: $("notes").value.trim() || null,

    created_at: nowISO(),
    device: navigator.userAgent,
    photo: file ? buildPhotoMeta(file, tempCode) : null,
  };

  return { ok: true, payload, photoFile: file };
}

// -----------------------------
// Draft
// -----------------------------
function saveDraft() {
  const draft = {
    districtSel: $("district").value,
    districtManual: $("districtManual").value,
    address: $("address").value,
    status: $("status").value,
    nickname: $("nickname").value,
    sex: $("sex").value,
    age: $("age").value,
    sterilized: $("sterilized").checked,
    vaccinated: $("vaccinated").checked,
    vaccination_date: $("vaccination_date").value,
    owner_name: $("owner_name").value,
    owner_phone: $("owner_phone").value,
    temp_code: $("temp_code").value,
    notes: $("notes").value,
    // фото не сохраняем (браузеры не дают восстановить выбранный файл)
  };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function loadDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return;
  try {
    const d = JSON.parse(raw);
    $("district").value = d.districtSel || "";
    $("districtManual").value = d.districtManual || "";
    $("address").value = d.address || "";
    $("status").value = d.status || "";
    $("nickname").value = d.nickname || "";
    $("sex").value = d.sex || "U";
    $("age").value = d.age || "";
    $("sterilized").checked = !!d.sterilized;
    $("vaccinated").checked = !!d.vaccinated;
    $("vaccination_date").value = d.vaccination_date || "";
    $("owner_name").value = d.owner_name || "";
    $("owner_phone").value = d.owner_phone || "";
    $("temp_code").value = d.temp_code || "";
    $("notes").value = d.notes || "";
  } catch {}
}

function clearDraftAndForm() {
  localStorage.removeItem(DRAFT_KEY);
  document.querySelectorAll("input,select,textarea").forEach((el) => {
    if (el.type === "checkbox") el.checked = false;
    else if (el.type === "file") el.value = "";
    else el.value = "";
  });
  $("sex").value = "U";
  toggleBlocks();
}

// -----------------------------
// Export / Share
// -----------------------------
function downloadJSON(obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  const code = obj.temp_code ? obj.temp_code : "anketa";
  a.href = url;
  a.download = `anketa_${code}_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

async function shareJSONAndMaybePhoto(payload, photoFile) {
  const text = JSON.stringify(payload, null, 2);
  const code = payload.temp_code || "anketa";

  const jsonFile = new File([text], `anketa_${code}.json`, { type: "application/json" });

  const files = [jsonFile];

  // Если есть фото — пробуем приложить вторым файлом
  // (Android Chrome/WhatsApp обычно умеют принимать несколько файлов)
  if (photoFile) {
    // имя файла фото желательно сделать с кодом
    const meta = payload.photo && payload.photo.suggested_name ? payload.photo.suggested_name : `photo_${code}.jpg`;
    const photoNamed = new File([photoFile], meta, { type: photoFile.type || "image/jpeg" });
    files.push(photoNamed);
  }

  // Web Share API with files
  if (navigator.share && navigator.canShare && navigator.canShare({ files })) {
    await navigator.share({
      title: "Анкета собаки",
      text: "Файлы для координатора: JSON + фото (если есть).",
      files,
    });
    return { ok: true, mode: "share_files" };
  }

  // Если не умеет шарить 2 файла, пробуем хотя бы JSON
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [jsonFile] })) {
    await navigator.share({
      title: "Анкета собаки",
      text: photoFile
        ? "JSON отправлен. Фото отправь вторым файлом отдельно (по коду)."
        : "JSON анкета для импорта координатором.",
      files: [jsonFile],
    });
    return { ok: true, mode: "share_json_only" };
  }

  // fallback: скачивание + подсказка
  downloadJSON(payload);
  return { ok: false, mode: "fallback_download" };
}

// -----------------------------
// UI binds
// -----------------------------
function bindAutosave() {
  const els = document.querySelectorAll("input,select,textarea");
  els.forEach((el) => el.addEventListener("input", saveDraft));
  els.forEach((el) =>
    el.addEventListener("change", () => {
      toggleBlocks();
      saveDraft();
    })
  );
}

function setupPWA() {
  // Service Worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }

  // Install prompt
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    $("btnInstall").style.display = "inline-block";
  });

  $("btnInstall").addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    $("btnInstall").style.display = "none";
  });
}

function init() {
  loadDraft();
  toggleBlocks();
  bindAutosave();
  setupPWA();

  $("btnGenCode").addEventListener("click", () => {
    const code = genTempCode();
    $("temp_code").value = code;
    saveDraft();
    alert("✅ Код сгенерирован: " + code + "\n\nЕсли делаешь фото — отправь фото с этим кодом (или просто прикрепи здесь и нажми «Поделиться»).");
  });

  $("btnExport").addEventListener("click", () => {
    const res = collectPayload();
    if (!res.ok) return alert(res.msg);

    downloadJSON(res.payload);

    if (res.photoFile && res.payload.photo && res.payload.photo.suggested_name) {
      alert(
        "✅ JSON сохранён.\n\nЕсли фото прикреплено в форме — оно НЕ сохраняется в JSON.\n" +
          "Отправь координатору:\n" +
          "1) этот JSON\n" +
          "2) фото (лучше назвать: " +
          res.payload.photo.suggested_name +
          ")"
      );
    } else {
      alert("✅ JSON сохранён. Отправь файл координатору (WhatsApp/Telegram).");
    }
  });

  $("btnShare").addEventListener("click", async () => {
    const res = collectPayload();
    if (!res.ok) return alert(res.msg);

    try {
      const result = await shareJSONAndMaybePhoto(res.payload, res.photoFile);

      if (result.ok && result.mode === "share_files") {
        alert("✅ Отправлено: JSON + фото (если было выбрано).");
        return;
      }

      if (result.ok && result.mode === "share_json_only") {
        const suggested = res.payload.photo && res.payload.photo.suggested_name ? res.payload.photo.suggested_name : null;
        alert(
          "✅ JSON отправлен.\n" +
            (res.photoFile
              ? ("⚠️ Этот телефон/браузер не отправляет фото вместе с JSON.\nОтправь фото отдельно. " +
                 (suggested ? "Желательно назвать фото: " + suggested : ""))
              : "")
        );
        return;
      }

      // fallback_download
      const suggested = res.payload.photo && res.payload.photo.suggested_name ? res.payload.photo.suggested_name : null;
      alert(
        "📥 JSON скачан (как запасной вариант).\n" +
          (res.photoFile
            ? ("Фото отправь отдельно. " + (suggested ? "Желательно назвать: " + suggested : ""))
            : "")
      );
    } catch (e) {
      alert("❌ Не удалось поделиться. Используй «Сохранить JSON» и отправь вручную.");
    }
  });

  $("btnClear").addEventListener("click", () => {
    if (confirm("Очистить форму и черновик?")) clearDraftAndForm();
  });

  // Мелочь: если вводят код вручную — нормализуем в upper и без пробелов
  $("temp_code").addEventListener("change", () => {
    $("temp_code").value = normalizeTempCode($("temp_code").value) || "";
    saveDraft();
  });
}

document.addEventListener("DOMContentLoaded", init);
