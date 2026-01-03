const $ = (id) => document.getElementById(id);

const DRAFT_KEY = "tnr_draft_v1";

let deferredPrompt = null;

function pad4(n) {
  return String(n).padStart(4, "0");
}

function genTempCode() {
  const n = Math.floor(Math.random() * 10000);
  return pad4(n);
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

function getDistrictValue() {
  const sel = $("district").value;
  if (sel === "__manual__") {
    return $("districtManual").value.trim();
  }
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

function collectPayload() {
  const district = getDistrictValue();
  const address = $("address").value.trim();
  const status = $("status").value;

  if (!district) return { ok:false, msg:"Укажи район." };
  if (!status) return { ok:false, msg:"Укажи статус." };
  if (!address) return { ok:false, msg:"Укажи адрес." };

  const vaccinated = $("vaccinated").checked;
  let vdate = $("vaccination_date").value || null;

  const photoInput = $("photo");
  const file = photoInput.files && photoInput.files[0] ? photoInput.files[0] : null;

  const payload = {
    // обязательные
    district,
    address,
    status,

    // остальное
    temp_code: $("temp_code").value.trim() || null,
    nickname: $("nickname").value.trim() || null,
    sex: $("sex").value || "U",
    approx_age_years: $("age").value ? Number($("age").value) : null,
    sterilized: $("sterilized").checked,
    vaccinated: vaccinated,
    vaccination_date: vaccinated ? (vdate || null) : null,

    owner_name: status === "owned" ? ($("owner_name").value.trim() || null) : null,
    owner_phone: status === "owned" ? (normalizePhone($("owner_phone").value) || null) : null,

    notes: $("notes").value.trim() || null,

    // метаданные
    created_at: nowISO(),
    device: navigator.userAgent,
    photo: file ? { name: file.name, type: file.type, size: file.size, lastModified: file.lastModified } : null,
  };

  return { ok:true, payload };
}

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
    // фото не сохраняем (браузеры не дают)
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
  document.querySelectorAll("input,select,textarea").forEach(el => {
    if (el.type === "checkbox") el.checked = false;
    else if (el.type === "file") el.value = "";
    else el.value = "";
  });
  $("sex").value = "U";
  toggleBlocks();
}

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

async function shareJSON(obj) {
  const text = JSON.stringify(obj, null, 2);
  const file = new File([text], "anketa.json", { type: "application/json" });

  if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
    await navigator.share({
      title: "Анкета собаки",
      text: "JSON анкета для импорта координатором",
      files: [file],
    });
    return true;
  }

  // fallback: копируем в буфер
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    alert("JSON скопирован в буфер. Вставь в сообщение WhatsApp/Telegram или сохрани файл через 'Сохранить JSON'.");
    return true;
  }

  alert("На этом телефоне шаринг недоступен. Нажми 'Сохранить JSON' и отправь файл вручную.");
  return false;
}

function bindAutosave() {
  const els = document.querySelectorAll("input,select,textarea");
  els.forEach(el => el.addEventListener("input", saveDraft));
  els.forEach(el => el.addEventListener("change", () => { toggleBlocks(); saveDraft(); }));
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
    $("temp_code").value = genTempCode();
    saveDraft();
  });

  $("btnExport").addEventListener("click", () => {
    const res = collectPayload();
    if (!res.ok) return alert(res.msg);
    downloadJSON(res.payload);
    alert("JSON сохранён. Отправь файл координатору (WhatsApp/Telegram).");
  });

  $("btnShare").addEventListener("click", async () => {
    const res = collectPayload();
    if (!res.ok) return alert(res.msg);
    await shareJSON(res.payload);
  });

  $("btnClear").addEventListener("click", () => {
    if (confirm("Очистить форму и черновик?")) clearDraftAndForm();
  });
}

document.addEventListener("DOMContentLoaded", init);
