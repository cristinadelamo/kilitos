"use strict";

const STORE_KEY = "kilitos";

const state = {
  profile: { startWeight: null, targetWeight: null, height: null, age: null, sex: "", calorieGoal: null, waterGoal: 8 },
  days: {},
  currentDate: todayStr()
};

function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function parseDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function shiftDate(s, delta) {
  const d = parseDate(s);
  d.setDate(d.getDate() + delta);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function fmtDateLong(s) {
  return parseDate(s).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.profile) Object.assign(state.profile, data.profile);
    if (data.days) state.days = data.days;
    state.updatedAt = typeof data.updatedAt === "number" ? data.updatedAt : 0;
  } catch (e) {
    toast("No se pudieron cargar los datos guardados");
  }
}

function save() {
  state.updatedAt = Date.now();
  localStorage.setItem(STORE_KEY, JSON.stringify({ version: 1, profile: state.profile, days: state.days, updatedAt: state.updatedAt }));
}

const MYFOODS_KEY = "kilitos-myFoods";
const OVERRIDES_KEY = "kilitos-food-ov";

function loadMyFoods() {
  try {
    const list = JSON.parse(localStorage.getItem(MYFOODS_KEY));
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function saveMyFoods(list) {
  localStorage.setItem(MYFOODS_KEY, JSON.stringify(list));
}

function loadOverrides() {
  try {
    const o = JSON.parse(localStorage.getItem(OVERRIDES_KEY));
    return o && typeof o === "object" ? o : {};
  } catch (e) {
    return {};
  }
}

function saveOverrides(o) {
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(o));
}

const SYNC_KEY = "kilitos-sync";
const SYNC_FILE = "kilitos.json";

function loadSyncCfg() {
  try {
    const c = JSON.parse(localStorage.getItem(SYNC_KEY));
    return c && typeof c === "object" ? c : {};
  } catch (e) {
    return {};
  }
}

function saveSyncCfg(c) {
  localStorage.setItem(SYNC_KEY, JSON.stringify(c));
}

function syncPayload() {
  return {
    version: 1,
    profile: state.profile,
    days: state.days,
    myFoods: loadMyFoods(),
    foodOv: loadOverrides(),
    updatedAt: state.updatedAt || Date.now()
  };
}

function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64decode(b64) {
  const bin = atob(String(b64).replace(/\s/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function normSyncCfg(cfg) {
  let repo = (cfg.repo || "").trim().replace(/^https:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/^\/+|\/+$/g, "");
  if (repo.includes("/")) {
    const parts = repo.split("/");
    cfg.user = cfg.user || parts[0];
    repo = parts[parts.length - 1];
  }
  cfg.repo = repo;
  cfg.user = (cfg.user || "").trim();
  return cfg;
}

async function ghRequest(path, options) {
  const cfg = normSyncCfg(loadSyncCfg());
  const missing = [];
  if (!cfg.user) missing.push("usuario");
  if (!cfg.repo) missing.push("repo");
  if (!cfg.token) missing.push("token");
  if (missing.length) throw new Error("falta por rellenar: " + missing.join(", "));
  const res = await fetch("https://api.github.com" + path, Object.assign({
    headers: {
      "Authorization": "Bearer " + cfg.token,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json"
    }
  }, options || {}));
  let body = null;
  try { body = await res.json(); } catch (e) { body = null; }
  if (res.status === 401 || res.status === 403) {
    throw new Error("acceso denegado (" + res.status + "): " + (body && body.message ? body.message : "revisa el token y sus permisos"));
  }
  if (res.status === 404) {
    if (options && options.method) throw new Error("repo no encontrado (" + cfg.user + "/" + cfg.repo + "): revisa el nombre y que el token tenga acceso a él");
    return null;
  }
  if (!res.ok) throw new Error("GitHub respondió " + res.status + (body && body.message ? ": " + body.message : ""));
  return body;
}

async function syncGetRemote() {
  const cfg = loadSyncCfg();
  const f = await ghRequest("/repos/" + cfg.user + "/" + cfg.repo + "/contents/" + SYNC_FILE);
  if (!f) return null;
  return { sha: f.sha, data: JSON.parse(b64decode(f.content)) };
}

async function syncPush(sha) {
  const cfg = loadSyncCfg();
  const body = {
    message: "Kilitos · " + new Date().toLocaleString("es-ES"),
    content: b64encode(JSON.stringify(syncPayload()))
  };
  if (sha) body.sha = sha;
  await ghRequest("/repos/" + cfg.user + "/" + cfg.repo + "/contents/" + SYNC_FILE, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

function applyRemoteData(data) {
  if (data.profile) Object.assign(state.profile, data.profile);
  state.days = data.days || {};
  if (Array.isArray(data.myFoods)) saveMyFoods(data.myFoods);
  if (data.foodOv && typeof data.foodOv === "object") saveOverrides(data.foodOv);
  state.updatedAt = data.updatedAt || Date.now();
  localStorage.setItem(STORE_KEY, JSON.stringify({ version: 1, profile: state.profile, days: state.days, updatedAt: state.updatedAt }));
  renderDiario();
}

function fmtSync(ts) {
  return ts ? new Date(ts).toLocaleString("es-ES") : "—";
}

function markSynced() {
  const cfg = loadSyncCfg();
  cfg.lastSync = Date.now();
  saveSyncCfg(cfg);
  renderSyncCard();
}

function readSyncForm() {
  const cfg = loadSyncCfg();
  cfg.user = (document.getElementById("syncUser").value || "").trim();
  cfg.repo = (document.getElementById("syncRepo").value || "").trim();
  cfg.token = (document.getElementById("syncToken").value || "").trim();
  saveSyncCfg(cfg);
  return cfg;
}

async function doSync() {
  readSyncForm();
  const btn = document.getElementById("syncBtn");
  btn.disabled = true;
  try {
    const remote = await syncGetRemote();
    if (remote && (remote.data.updatedAt || 0) > (state.updatedAt || 0)) {
      if (confirm("Los datos de la nube son más nuevos (" + fmtSync(remote.data.updatedAt) + ") que los de este dispositivo (" + fmtSync(state.updatedAt) + ").\n\nACEPTAR: descargar los de la nube.\nCANCELAR: subir los locales y reemplazar la nube.")) {
        applyRemoteData(remote.data);
        toast("Datos descargados ☁️⬇️");
      } else {
        await syncPush(remote.sha);
        toast("Datos subidos ☁️⬆️");
      }
    } else {
      await syncPush(remote ? remote.sha : null);
      toast("Datos subidos ☁️⬆️");
    }
    markSynced();
  } catch (e) {
    toast("Sincronización: " + e.message);
  }
  btn.disabled = false;
}

async function doDownload() {
  readSyncForm();
  const btn = document.getElementById("syncDownBtn");
  btn.disabled = true;
  try {
    const remote = await syncGetRemote();
    if (!remote) {
      toast("Aún no hay datos en la nube; usa Sincronizar para subirlos");
    } else if (confirm("¿Reemplazar los datos de este dispositivo por los de la nube (" + fmtSync(remote.data.updatedAt) + ")?")) {
      applyRemoteData(remote.data);
      markSynced();
      toast("Datos descargados ☁️⬇️");
    }
  } catch (e) {
    toast("Descarga: " + e.message);
  }
  btn.disabled = false;
}

function renderSyncCard() {
  const cfg = loadSyncCfg();
  document.getElementById("syncUser").value = cfg.user || "";
  document.getElementById("syncRepo").value = cfg.repo || "";
  document.getElementById("syncToken").value = cfg.token || "";
  document.getElementById("syncStatus").textContent = "Última sincronización: " + fmtSync(cfg.lastSync);
}

function effectiveFoods() {
  const ov = loadOverrides();
  const list = [];
  for (const f of FOODS) {
    const o = ov[normText(f.n)];
    if (o && o.hidden) continue;
    list.push({
      n: (o && o.n) || f.n,
      k: o && typeof o.k === "number" ? o.k : f.k,
      c: f.c,
      base: true,
      key: normText(f.n)
    });
  }
  for (const f of loadMyFoods()) {
    list.push({ n: f.n, k: f.k, c: f.c || "mío", base: false, key: normText(f.n) });
  }
  return list;
}

function findEffFood(name) {
  const nn = normText(name);
  return effectiveFoods().find(f => normText(f.n) === nn) || null;
}

function rememberFood(name, k) {
  const eff = findEffFood(name);
  if (eff && eff.base) {
    const ov = loadOverrides();
    ov[eff.key] = Object.assign({}, ov[eff.key], { k: k });
    saveOverrides(ov);
    return;
  }
  const list = loadMyFoods();
  const existing = list.find(f => normText(f.n) === normText(name));
  if (existing) {
    existing.k = k;
  } else {
    list.push({ n: name, k: k, c: "mío" });
  }
  saveMyFoods(list);
}

function day(dateStr) {
  if (!state.days[dateStr]) state.days[dateStr] = { weight: null, meals: [], exercise: [] };
  const d = state.days[dateStr];
  if (!Array.isArray(d.meals)) d.meals = [];
  if (!Array.isArray(d.exercise)) d.exercise = [];
  if (typeof d.water !== "number") d.water = 0;
  if (typeof d.sleep !== "number") d.sleep = null;
  if (typeof d.bath !== "boolean") d.bath = null;
  if (typeof d.pill !== "boolean") d.pill = null;
  return d;
}

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.remove("show"), 2200);
}

function eatenCalories(d) {
  return d.meals.reduce((sum, m) => sum + (Number(m.calories) || 0), 0);
}

function burnedCalories(d) {
  return d.exercise.reduce((sum, e) => sum + (Number(e.calories) || 0), 0);
}

function calorieGoal() {
  if (state.profile.calorieGoal) return state.profile.calorieGoal;
  const p = state.profile;
  if (!p.height || !p.age || !p.sex) return null;
  const bmr = p.sex === "M"
    ? 10 * p.startWeight + 6.25 * p.height - 5 * p.age + 5
    : 10 * p.startWeight + 6.25 * p.height - 5 * p.age - 161;
  return Math.round(bmr * 1.3);
}

function sortedDays() {
  return Object.keys(state.days).sort();
}

function hasDayData(d) {
  return !!(d && (d.weight || (d.meals && d.meals.length) || (d.exercise && d.exercise.length) ||
    d.water || typeof d.sleep === "number" || d.bath === true || d.bath === false || d.pill === true));
}

function previousWeight(dateStr) {
  const dates = sortedDays().filter(s => s < dateStr);
  for (let i = dates.length - 1; i >= 0; i--) {
    const w = state.days[dates[i]].weight;
    if (w) return w;
  }
  return null;
}

function lastWeight() {
  const dates = sortedDays();
  for (let i = dates.length - 1; i >= 0; i--) {
    const w = state.days[dates[i]].weight;
    if (w) return w;
  }
  return null;
}

function renderDiario() {
  const dateInput = document.getElementById("dayDate");
  dateInput.value = state.currentDate;
  document.getElementById("nextDay").disabled = state.currentDate >= todayStr();

  const d = day(state.currentDate);
  const weightInput = document.getElementById("morningWeight");
  weightInput.value = d.weight || "";

  const deltaEl = document.getElementById("weightDelta");
  const prev = previousWeight(state.currentDate);
  if (d.weight && prev) {
    const diff = d.weight - prev;
    if (Math.abs(diff) < 0.001) {
      deltaEl.textContent = "= igual que ayer";
      deltaEl.className = "delta";
    } else if (diff < 0) {
      deltaEl.textContent = "▼ " + Math.abs(diff).toFixed(1).replace(".", ",") + " kg";
      deltaEl.className = "delta down";
    } else {
      deltaEl.textContent = "▲ " + diff.toFixed(1).replace(".", ",") + " kg";
      deltaEl.className = "delta up";
    }
  } else {
    deltaEl.textContent = "";
  }

  document.getElementById("sumEaten").textContent = eatenCalories(d);
  document.getElementById("sumBurned").textContent = burnedCalories(d);
  document.getElementById("sumNet").textContent = eatenCalories(d) - burnedCalories(d);

  const goal = calorieGoal();
  const net = eatenCalories(d) - burnedCalories(d);
  const goalLine = document.getElementById("goalLine");
  if (goal) {
    const diff = goal - net;
    if (diff >= 0) {
      goalLine.innerHTML = "Te quedan <b>" + diff + " kcal</b> de tu objetivo (" + goal + " kcal)";
    } else {
      goalLine.innerHTML = "<b>" + Math.abs(diff) + " kcal</b> por encima de tu objetivo (" + goal + " kcal)";
    }
  } else {
    goalLine.innerHTML = "Configura tu perfil para ver el objetivo calórico";
  }

  renderMeals(d);
  renderExercise(d);
  renderWater();
  renderSleep();
  renderBath();
  renderPill();
}

const SLEEP_OPTS = [
  { v: 0, label: "Mal", color: "red" },
  { v: 1, label: "Regular", color: "amber" },
  { v: 2, label: "Bien", color: "green" }
];

function renderSleep() {
  const d = day(state.currentDate);
  const box = document.getElementById("sleepLights");
  box.innerHTML = "";
  SLEEP_OPTS.forEach(o => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sleep-light " + o.color + (d.sleep === o.v ? " on" : "");
    b.title = "Sueño: " + o.label;
    b.setAttribute("aria-label", "Sueño: " + o.label);
    b.setAttribute("aria-pressed", d.sleep === o.v ? "true" : "false");
    b.addEventListener("click", () => {
      d.sleep = d.sleep === o.v ? null : o.v;
      save();
      renderSleep();
    });
    box.appendChild(b);
  });
}

function renderBath() {
  const d = day(state.currentDate);
  const yes = document.getElementById("bathYes");
  const no = document.getElementById("bathNo");
  yes.classList.toggle("on", d.bath === true);
  yes.setAttribute("aria-pressed", d.bath === true ? "true" : "false");
  no.classList.toggle("on", d.bath === false);
  no.setAttribute("aria-pressed", d.bath === false ? "true" : "false");
}

function renderPill() {
  const d = day(state.currentDate);
  const btn = document.getElementById("pillTaken");
  btn.classList.toggle("on", d.pill === true);
  btn.setAttribute("aria-pressed", d.pill === true ? "true" : "false");
}

const MEAL_ORDER = ["desayuno", "comida", "merienda", "cena", "snack"];

function renderMeals(d) {
  const box = document.getElementById("mealGroups");
  box.innerHTML = "";
  if (d.meals.length === 0) {
    box.innerHTML = '<p class="empty">Aún no has apuntado comidas este día.</p>';
    return;
  }
  for (const type of MEAL_ORDER) {
    const items = d.meals.filter(m => m.type === type);
    if (items.length === 0) continue;
    const group = document.createElement("div");
    group.className = "meal-group";
    const h = document.createElement("h3");
    const total = items.reduce((s, m) => s + (Number(m.calories) || 0), 0);
    h.textContent = type + " · " + total + " kcal";
    group.appendChild(h);
    const ul = document.createElement("ul");
    items.forEach(m => {
      const li = document.createElement("li");
      li.className = "entry";
      const txt = document.createElement("span");
      txt.className = "txt";
      txt.textContent = m.food;
      if (m.qty && m.qty !== 1) {
        const small = document.createElement("small");
        small.textContent = " ×" + fmtQty(m.qty);
        txt.appendChild(small);
      }
      const kcal = document.createElement("span");
      kcal.className = "kcal";
      kcal.textContent = m.calories + " kcal";
      const del = document.createElement("button");
      del.className = "del";
      del.textContent = "✕";
      del.setAttribute("aria-label", "Eliminar " + m.food);
      del.addEventListener("click", () => {
        const arr = day(state.currentDate).meals;
        const idx = arr.indexOf(m);
        if (idx > -1) arr.splice(idx, 1);
        save();
        renderDiario();
      });
      li.append(txt, kcal, del);
      ul.appendChild(li);
    });
    group.appendChild(ul);
    box.appendChild(group);
  }
}

function renderExercise(d) {
  const ul = document.getElementById("exList");
  ul.innerHTML = "";
  if (d.exercise.length === 0) {
    ul.innerHTML = '<li class="empty">Sin ejercicio apuntado este día.</li>';
    return;
  }
  d.exercise.forEach(e => {
    const li = document.createElement("li");
    li.className = "entry ex";
    const txt = document.createElement("span");
    txt.className = "txt";
    txt.textContent = e.name;
    if (e.minutes) {
      const small = document.createElement("small");
      small.textContent = " · " + e.minutes + " min";
      txt.appendChild(small);
    }
    const kcal = document.createElement("span");
    kcal.className = "kcal";
    kcal.textContent = "-" + e.calories + " kcal";
    const del = document.createElement("button");
    del.className = "del";
    del.textContent = "✕";
    del.setAttribute("aria-label", "Eliminar " + e.name);
    del.addEventListener("click", () => {
      const arr = day(state.currentDate).exercise;
      const idx = arr.indexOf(e);
      if (idx > -1) arr.splice(idx, 1);
      save();
      renderDiario();
    });
    li.append(txt, kcal, del);
    ul.appendChild(li);
  });
}

function renderWater() {
  const d = day(state.currentDate);
  const goal = state.profile.waterGoal || 8;
  const row = document.getElementById("waterRow");
  row.innerHTML = "";
  for (let i = 1; i <= goal; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "glass" + (i <= d.water ? " filled" : "");
    b.setAttribute("aria-label", "Vaso " + i + " de " + goal);
    b.addEventListener("click", () => {
      d.water = i === d.water ? i - 1 : i;
      save();
      renderWater();
    });
    row.appendChild(b);
  }
  document.getElementById("waterCount").textContent = d.water + "/" + goal;
}

function renderHistorial() {
  const dates = sortedDays().filter(s => hasDayData(state.days[s])).reverse();
  const box = document.getElementById("historyList");
  if (dates.length === 0) {
    box.innerHTML = '<p class="empty">Todavía no hay registros. Empieza apuntando tu peso y comidas en el diario.</p>';
  } else {
    box.innerHTML = "";
    const goal = calorieGoal();
    dates.slice(0, 30).forEach(dateStr => {
      const d = state.days[dateStr];
      const eaten = eatenCalories(d);
      const burned = burnedCalories(d);
      const net = eaten - burned;

      const wrap = document.createElement("div");
      wrap.className = "hist-item";
      const row = document.createElement("div");
      row.className = "hist-day";
      const date = parseDate(dateStr);
      const left = document.createElement("div");
      left.className = "hist-date";
      left.innerHTML = date.toLocaleDateString("es-ES", { day: "numeric", month: "short" }) +
        "<small>" + date.toLocaleDateString("es-ES", { weekday: "short" }) + "</small>";

      const mid = document.createElement("div");
      mid.className = "hist-mid";
      if (d.meals.length) {
        const main = document.createElement("div");
        main.className = "hist-kcal" + (goal ? (net > goal ? " over" : " ok") : "");
        main.textContent = goal ? net + " / " + goal + " kcal" : net + " kcal";
        mid.appendChild(main);
        const sub = [];
        if (goal) {
          const diff = goal - net;
          sub.push(diff >= 0 ? "quedan " + diff + " kcal" : Math.abs(diff) + " kcal de más");
        }
        if (d.exercise.length) sub.push("-" + burned + " ejercicio");
        if (d.water) sub.push("💧 " + d.water);
        if (typeof d.sleep === "number") sub.push("😴 " + (d.sleep === 2 ? "bien" : d.sleep === 1 ? "regular" : "mal"));
        if (d.bath === true || d.bath === false) sub.push(d.bath ? "🚽 sí" : "🚽 no");
        if (d.pill) sub.push("💊");
        if (sub.length) {
          const s = document.createElement("small");
          s.className = "hist-sub";
          s.textContent = sub.join(" · ");
          mid.appendChild(s);
        }
      } else {
        const bits = [];
        if (d.exercise.length) bits.push("-" + burned + " (ejercicio)");
        if (d.water) bits.push("💧 " + d.water);
        if (typeof d.sleep === "number") bits.push("😴 " + (d.sleep === 2 ? "bien" : d.sleep === 1 ? "regular" : "mal"));
        if (d.bath === true || d.bath === false) bits.push(d.bath ? "🚽 sí" : "🚽 no");
        if (d.pill) bits.push("💊");
        mid.textContent = bits.join(" · ") || "sin registros";
      }

      const right = document.createElement("div");
      right.className = "hist-nums";
      right.innerHTML = d.weight ? '<span class="hist-weight">' + d.weight + " kg</span>" : "—";

      if (d.meals.length || d.exercise.length) {
        row.classList.add("clickable");
        const caret = document.createElement("div");
        caret.className = "hist-caret";
        caret.textContent = "▸";
        caret.setAttribute("aria-hidden", "true");
        const detail = document.createElement("div");
        detail.className = "hist-detail";
        buildHistDetail(detail, d);
        row.addEventListener("click", () => wrap.classList.toggle("open"));
        row.append(left, mid, right, caret);
        wrap.append(row, detail);
      } else {
        row.append(left, mid, right);
        wrap.appendChild(row);
      }
      box.appendChild(wrap);
    });
  }
  drawChart();
}

function buildHistDetail(box, d) {
  const types = MEAL_ORDER.concat(Array.from(new Set(d.meals.map(m => m.type))).filter(t => !MEAL_ORDER.includes(t)));
  for (const type of types) {
    const items = d.meals.filter(m => m.type === type);
    if (items.length === 0) continue;
    const group = document.createElement("div");
    group.className = "meal-group";
    const h = document.createElement("h3");
    const total = items.reduce((s, m) => s + (Number(m.calories) || 0), 0);
    h.textContent = type + " · " + total + " kcal";
    group.appendChild(h);
    const ul = document.createElement("ul");
    items.forEach(m => {
      const li = document.createElement("li");
      li.className = "entry";
      const txt = document.createElement("span");
      txt.className = "txt";
      txt.textContent = m.food + (m.qty && m.qty !== 1 ? " ×" + fmtQty(m.qty) : "");
      const kcal = document.createElement("span");
      kcal.className = "kcal";
      kcal.textContent = m.calories + " kcal";
      li.append(txt, kcal);
      ul.appendChild(li);
    });
    group.appendChild(ul);
    box.appendChild(group);
  }
  if (d.exercise.length) {
    const group = document.createElement("div");
    group.className = "meal-group";
    const h = document.createElement("h3");
    h.textContent = "ejercicio · -" + burnedCalories(d) + " kcal";
    group.appendChild(h);
    const ul = document.createElement("ul");
    d.exercise.forEach(e => {
      const li = document.createElement("li");
      li.className = "entry ex";
      const txt = document.createElement("span");
      txt.className = "txt";
      txt.textContent = e.name + (e.minutes ? " · " + e.minutes + " min" : "");
      const kcal = document.createElement("span");
      kcal.className = "kcal";
      kcal.textContent = "-" + e.calories + " kcal";
      li.append(txt, kcal);
      ul.appendChild(li);
    });
    group.appendChild(ul);
    box.appendChild(group);
  }
}

function drawChart() {
  const canvas = document.getElementById("weightChart");
  const entries = sortedDays().filter(s => state.days[s].weight)
    .map(s => ({ date: s, w: state.days[s].weight }));
  const statsEl = document.getElementById("chartStats");

  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.parentElement.clientWidth - 4;
  const cssH = 220;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);

  if (entries.length === 0) {
    ctx.fillStyle = "#6b7c7a";
    ctx.font = "14px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Aún no hay pesos registrados", cssW / 2, cssH / 2);
    statsEl.textContent = "";
    return;
  }

  const target = state.profile.targetWeight;
  const weights = entries.map(e => e.w);
  if (target) weights.push(target);
  let min = Math.min(...weights), max = Math.max(...weights);
  if (max - min < 2) { min -= 1; max += 1; }
  const pad = (max - min) * 0.15;
  min -= pad; max += pad;

  const L = 38, R = 10, T = 12, B = 24;
  const W = cssW - L - R, H = cssH - T - B;
  const x = i => entries.length === 1 ? L + W / 2 : L + (W * i) / (entries.length - 1);
  const y = w => T + H - ((w - min) / (max - min)) * H;

  ctx.strokeStyle = "#e2e8e7";
  ctx.fillStyle = "#6b7c7a";
  ctx.font = "11px system-ui";
  ctx.textAlign = "right";
  for (let g = 0; g <= 4; g++) {
    const wv = min + ((max - min) * g) / 4;
    const gy = y(wv);
    ctx.beginPath();
    ctx.moveTo(L, gy);
    ctx.lineTo(cssW - R, gy);
    ctx.stroke();
    ctx.fillText(wv.toFixed(1), L - 5, gy + 4);
  }

  if (target && target >= min && target <= max) {
    ctx.save();
    ctx.strokeStyle = "#d97706";
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(L, y(target));
    ctx.lineTo(cssW - R, y(target));
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#d97706";
    ctx.textAlign = "left";
    ctx.fillText("objetivo " + target + " kg", L + 4, y(target) - 4);
  }

  ctx.strokeStyle = "#0f766e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  entries.forEach((e, i) => i === 0 ? ctx.moveTo(x(i), y(e.w)) : ctx.lineTo(x(i), y(e.w)));
  ctx.stroke();

  ctx.fillStyle = "#0f766e";
  entries.forEach((e, i) => {
    ctx.beginPath();
    ctx.arc(x(i), y(e.w), 3.5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#6b7c7a";
  ctx.textAlign = "center";
  const first = parseDate(entries[0].date);
  const last = parseDate(entries[entries.length - 1].date);
  ctx.fillText(first.toLocaleDateString("es-ES", { day: "numeric", month: "short" }), L + 10, cssH - 8);
  ctx.fillText(last.toLocaleDateString("es-ES", { day: "numeric", month: "short" }), cssW - R - 20, cssH - 8);

  const start = state.profile.startWeight || entries[0].w;
  const current = entries[entries.length - 1].w;
  const lost = start - current;
  let html = "Has pasado de <b>" + start + " kg</b> a <b>" + current + " kg</b>. ";
  if (lost > 0) html += "Has perdido <b>" + lost.toFixed(1).replace(".", ",") + " kg</b> 🎉";
  else if (lost < 0) html += "Has ganado <b>" + Math.abs(lost).toFixed(1).replace(".", ",") + " kg</b>.";
  else html += "Mismo peso.";
  if (target) {
    const remaining = current - target;
    if (remaining > 0) html += " Te faltan <b>" + remaining.toFixed(1).replace(".", ",") + " kg</b> para tu objetivo.";
    else html += " ¡Objetivo conseguido! 🏆";
  }
  statsEl.innerHTML = html;
}

function renderPerfil() {
  const p = state.profile;
  document.getElementById("pfStart").value = p.startWeight || "";
  document.getElementById("pfTarget").value = p.targetWeight || "";
  document.getElementById("pfHeight").value = p.height || "";
  document.getElementById("pfAge").value = p.age || "";
  document.getElementById("pfSex").value = p.sex || "";
  document.getElementById("pfCalGoal").value = p.calorieGoal || "";
  document.getElementById("pfWater").value = p.waterGoal || 8;

  const sum = document.getElementById("profileSummary");
  const goal = calorieGoal();
  const current = lastWeight();
  if (goal || current) {
    sum.classList.add("show");
    let html = "";
    if (goal) html += "Objetivo calórico: <b>" + goal + " kcal/día</b>";
    if (current) html += (html ? " · " : "") + "Último peso: <b>" + current + " kg</b>";
    if (current && p.targetWeight) {
      const rem = current - p.targetWeight;
      html += rem > 0
        ? " · Faltan <b>" + rem.toFixed(1).replace(".", ",") + " kg</b>"
        : " · ¡Objetivo conseguido!";
    }
    sum.innerHTML = html;
  } else {
    sum.classList.remove("show");
  }

  const nDays = Object.keys(state.days).filter(ds => hasDayData(state.days[ds])).length;
  const nMeals = Object.values(state.days).reduce((s, d) => s + (d.meals ? d.meals.length : 0), 0);
  const nMine = loadMyFoods().length;
  document.getElementById("storageInfo").textContent =
    nDays + " día(s) registrado(s), " + nMeals + " comida(s) apuntada(s), " + nMine + " alimento(s) propio(s).";

  renderSyncCard();
}

function switchTab(name) {
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id === name));
  if (name === "diario") renderDiario();
  if (name === "historial") renderHistorial();
  if (name === "alimentos") renderFoods(document.getElementById("foodSearch").value);
  if (name === "perfil") renderPerfil();
}

function renderFoods(filter) {
  const q = filter ? normText(filter.trim()) : "";
  const all = effectiveFoods();
  const items = q ? all.filter(f => normText(f.n).includes(q)) : all.slice();
  document.getElementById("foodCount").textContent = "(" + all.length + ")";

  const listEl = document.getElementById("foodList");
  listEl.innerHTML = "";
  if (items.length === 0) {
    listEl.innerHTML = '<p class="empty">Sin resultados.</p>';
  } else {
    const cats = [];
    const groups = {};
    items.forEach(f => {
      if (!groups[f.c]) { groups[f.c] = []; cats.push(f.c); }
      groups[f.c].push(f);
    });
    cats.sort((a, b) => (a === "mío" ? -1 : b === "mío" ? 1 : a.localeCompare(b)));
    cats.forEach(cat => {
      const wrap = document.createElement("div");
      wrap.className = "food-cat";
      const h = document.createElement("h3");
      h.textContent = cat;
      wrap.appendChild(h);
      groups[cat].forEach(f => wrap.appendChild(foodRow(f)));
      listEl.appendChild(wrap);
    });
  }
}

function foodRow(f) {
  const row = document.createElement("div");
  row.className = "food-row";
  const name = document.createElement("span");
  name.className = "f-name";
  name.textContent = f.n;
  const k = document.createElement("span");
  k.className = "f-k";
  k.textContent = f.k + " kcal";
  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "f-act";
  edit.title = "Editar";
  edit.textContent = "✏️";
  edit.addEventListener("click", () => startFoodEdit(row, f));
  const del = document.createElement("button");
  del.type = "button";
  del.className = "f-act del";
  del.title = "Borrar";
  del.textContent = "🗑️";
  del.addEventListener("click", () => {
    if (!confirm("¿Borrar \"" + f.n + "\" de la base?")) return;
    if (f.base) {
      const ov = loadOverrides();
      ov[f.key] = Object.assign({}, ov[f.key], { hidden: true });
      saveOverrides(ov);
    } else {
      saveMyFoods(loadMyFoods().filter(x => normText(x.n) !== normText(f.n)));
    }
    renderFoods("");
    document.getElementById("foodSearch").value = "";
    toast("Alimento borrado");
  });
  row.append(name, k, edit, del);
  return row;
}

function applyFoodEdit(f, nn, kk) {
  if (f.base) {
    const ov = loadOverrides();
    const cur = ov[f.key] || {};
    cur.n = nn;
    cur.k = kk;
    delete cur.hidden;
    ov[f.key] = cur;
    saveOverrides(ov);
  } else {
    const list = loadMyFoods();
    const e = list.find(x => normText(x.n) === normText(f.n));
    if (e) { e.n = nn; e.k = kk; }
    saveMyFoods(list);
  }
  let updatedCount = 0;
  if (kk !== f.k) {
    const names = [normText(f.n), normText(nn)];
    const matches = [];
    Object.keys(state.days).forEach(ds => {
      (state.days[ds].meals || []).forEach(m => {
        if (names.includes(normText(m.food))) matches.push(m);
      });
    });
    if (matches.length > 0 && confirm("Tienes " + matches.length + " registro(s) de este alimento. ¿Recalcular sus kcal a " + kk + "?")) {
      matches.forEach(m => { m.calories = Math.max(0, Math.round(kk * (m.qty || 1))); });
      updatedCount = matches.length;
      save();
    }
  }
  renderFoods("");
  document.getElementById("foodSearch").value = "";
  return updatedCount;
}

function startFoodEdit(row, f) {
  const box = document.createElement("div");
  box.className = "food-edit";
  const name = document.createElement("input");
  name.type = "text";
  name.value = f.n;
  name.maxLength = 80;
  const kcal = document.createElement("input");
  kcal.type = "number";
  kcal.min = 0;
  kcal.max = 5000;
  kcal.value = f.k;
  const ok = document.createElement("button");
  ok.type = "button";
  ok.className = "btn small primary";
  ok.textContent = "Guardar";
  const no = document.createElement("button");
  no.type = "button";
  no.className = "btn small";
  no.textContent = "Cancelar";
  box.append(name, kcal, ok, no);
  row.replaceWith(box);
  name.focus();

  no.addEventListener("click", () => box.replaceWith(row));
  ok.addEventListener("click", () => {
    const nn = name.value.trim();
    const kk = parseInt(kcal.value, 10);
    if (!nn || isNaN(kk) || kk < 0) {
      toast("Nombre y kcal válidos, por favor");
      return;
    }
    const updatedCount = applyFoodEdit(f, nn, kk);
    toast(updatedCount > 0
      ? "Alimento actualizado · " + updatedCount + " registro(s) recalculado(s)"
      : "Alimento actualizado");
  });
}

function normText(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function fmtQty(q) {
  return String(parseFloat(Number(q).toFixed(2))).replace(".", ",");
}

function parseQty(v) {
  const q = parseFloat(String(v == null ? "" : v).replace(",", "."));
  return !isNaN(q) && q > 0 ? q : 1;
}

function initSuggest() {
  const input = document.getElementById("mealFood");
  const box = document.getElementById("foodSuggest");
  const cal = document.getElementById("mealCal");
  const qty = document.getElementById("mealQty");

  input.addEventListener("input", updateMealPreview);
  cal.addEventListener("input", updateMealPreview);
  qty.addEventListener("input", updateMealPreview);

  input.addEventListener("input", () => {
    const q = normText(input.value.trim());
    box.innerHTML = "";
    if (q.length < 2) { box.hidden = true; return; }
    const all = effectiveFoods();
    const mine = all.filter(f => f.c === "mío" && normText(f.n).includes(q));
    const base = all.filter(f => f.c !== "mío" && normText(f.n).includes(q));
    const hits = mine.concat(base).slice(0, 9);
    if (hits.length === 0) { box.hidden = true; return; }
    hits.forEach(f => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "sug-item";
      const name = document.createElement("span");
      name.className = "sug-name";
      name.textContent = (f.c === "mío" ? "★ " : "") + f.n;
      const cat = document.createElement("span");
      cat.className = "sug-cat";
      cat.textContent = f.c;
      const k = document.createElement("span");
      k.className = "sug-k";
      k.textContent = f.k + " kcal";
      el.append(name, cat, k);
      el.addEventListener("mousedown", e => {
        e.preventDefault();
        input.value = f.n;
        cal.value = f.k;
        box.hidden = true;
        cal.focus();
        cal.select();
        updateMealPreview();
      });
      box.appendChild(el);
    });
    box.hidden = false;
  });

  input.addEventListener("blur", () => setTimeout(() => { box.hidden = true; }, 150));
  input.addEventListener("keydown", e => { if (e.key === "Escape") box.hidden = true; });
}

function updateMealPreview() {
  const food = document.getElementById("mealFood");
  const cal = document.getElementById("mealCal");
  const qty = document.getElementById("mealQty");
  const btn = document.getElementById("mealAddBtn");
  const c = parseFloat(cal.value);
  const total = food.value.trim() && !isNaN(c) && c >= 0
    ? Math.round(c * parseQty(qty.value))
    : null;
  btn.textContent = total === null ? "Añadir" : "Añadir · " + total + " kcal";
}

const EX_PRESETS = [
  { icon: "🏃", name: "Correr (por km)", min: null, k: 62 },
  { icon: "🤸", name: "Cuerpos Serranos 15 min", min: 15, k: 70 },
  { icon: "🥊", name: "Brooklyn Fitboxing 47 min", min: 47, k: 420 },
  { icon: "🚶", name: "Andar rápido (por km)", min: null, k: 48 }
];

function renderExQuick() {
  const box = document.getElementById("exQuick");
  box.innerHTML = "";
  EX_PRESETS.forEach(p => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn small";
    b.textContent = p.icon + " " + p.name + " · " + p.k + " kcal";
    b.addEventListener("click", () => {
      document.getElementById("exName").value = p.name;
      document.getElementById("exMin").value = p.min || "";
      document.getElementById("exCal").value = p.k;
      document.getElementById("exCal").focus();
      document.getElementById("exCal").select();
    });
    box.appendChild(b);
  });
}

function init() {
  load();

  initSuggest();
  renderExQuick();

  document.querySelectorAll(".tab").forEach(t =>
    t.addEventListener("click", () => switchTab(t.dataset.tab)));

  const dateInput = document.getElementById("dayDate");
  dateInput.max = todayStr();
  dateInput.addEventListener("change", () => {
    if (dateInput.value) {
      state.currentDate = dateInput.value;
      renderDiario();
    }
  });
  document.getElementById("prevDay").addEventListener("click", () => {
    state.currentDate = shiftDate(state.currentDate, -1);
    renderDiario();
  });
  document.getElementById("nextDay").addEventListener("click", () => {
    const next = shiftDate(state.currentDate, 1);
    if (next <= todayStr()) {
      state.currentDate = next;
      renderDiario();
    }
  });
  document.getElementById("todayBtn").addEventListener("click", () => {
    state.currentDate = todayStr();
    renderDiario();
  });

  document.getElementById("deleteDayBtn").addEventListener("click", () => {
    const ds = state.currentDate;
    if (hasDayData(state.days[ds]) && !confirm("¿Borrar todos los registros del " + fmtDateLong(ds) + "?")) return;
    delete state.days[ds];
    save();
    renderDiario();
    toast("Día borrado");
  });

  document.getElementById("morningWeight").addEventListener("change", e => {
    const v = parseFloat(e.target.value.replace(",", "."));
    day(state.currentDate).weight = isNaN(v) ? null : v;
    save();
    renderDiario();
    toast("Peso guardado");
  });

  document.getElementById("bathYes").addEventListener("click", () => {
    const d = day(state.currentDate);
    d.bath = d.bath === true ? null : true;
    save();
    renderBath();
  });
  document.getElementById("bathNo").addEventListener("click", () => {
    const d = day(state.currentDate);
    d.bath = d.bath === false ? null : false;
    save();
    renderBath();
  });

  document.getElementById("pillTaken").addEventListener("click", () => {
    const d = day(state.currentDate);
    d.pill = d.pill === true ? null : true;
    save();
    renderPill();
    toast(d.pill ? "Estatina apuntada 💊" : "Marca de estatina quitada");
  });

  document.getElementById("mealForm").addEventListener("submit", e => {
    e.preventDefault();
    const food = document.getElementById("mealFood");
    const cal = document.getElementById("mealCal");
    const qtyEl = document.getElementById("mealQty");
    const type = document.getElementById("mealType").value;
    const c = parseInt(cal.value, 10);
    if (!food.value.trim() || isNaN(c) || c < 0) return;
    const qty = parseQty(qtyEl.value);
    const total = Math.max(0, Math.round(c * qty));
    const entry = { type, food: food.value.trim(), calories: total };
    if (qty !== 1) entry.qty = qty;
    day(state.currentDate).meals.push(entry);
    const isNew = !findEffFood(food.value.trim());
    rememberFood(food.value.trim(), c);
    save();
    food.value = "";
    cal.value = "";
    qtyEl.value = "";
    updateMealPreview();
    renderDiario();
    toast(isNew ? "Apuntado · añadido a mis alimentos" : "Comida apuntada");
  });

  document.getElementById("exForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = document.getElementById("exName");
    const min = document.getElementById("exMin");
    const cal = document.getElementById("exCal");
    const c = parseInt(cal.value, 10);
    if (!name.value.trim() || isNaN(c) || c < 0) return;
    const m = parseInt(min.value, 10);
    day(state.currentDate).exercise.push({
      name: name.value.trim(),
      minutes: isNaN(m) ? null : m,
      calories: c
    });
    save();
    name.value = "";
    min.value = "";
    cal.value = "";
    renderDiario();
    toast("Ejercicio apuntado");
  });

  document.getElementById("profileForm").addEventListener("submit", e => {
    e.preventDefault();
    const num = id => {
      const v = parseFloat(document.getElementById(id).value.replace(",", "."));
      return isNaN(v) ? null : v;
    };
    state.profile.startWeight = num("pfStart");
    state.profile.targetWeight = num("pfTarget");
    state.profile.height = num("pfHeight");
    state.profile.age = num("pfAge");
    state.profile.sex = document.getElementById("pfSex").value;
    const goal = num("pfCalGoal");
    state.profile.calorieGoal = goal ? Math.round(goal) : null;
    const water = parseInt(document.getElementById("pfWater").value, 10);
    state.profile.waterGoal = Math.max(1, Math.min(20, isNaN(water) ? 8 : water));
    save();
    renderPerfil();
    toast("Perfil guardado");
  });

  const cats = ["mío"].concat(Array.from(new Set(FOODS.map(f => f.c))).sort((a, b) => a.localeCompare(b)));
  const faCat = document.getElementById("faCat");
  cats.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    faCat.appendChild(opt);
  });

  document.getElementById("foodAddForm").addEventListener("submit", e => {
    e.preventDefault();
    const nameEl = document.getElementById("faName");
    const kcalEl = document.getElementById("faKcal");
    const k = parseInt(kcalEl.value, 10);
    const nn = nameEl.value.trim();
    if (!nn || isNaN(k) || k < 0) return;
    const existing = findEffFood(nn);
    if (existing) {
      const msg = "Ya existe \"" + existing.n + "\" (" + existing.k + " kcal).\n\n¿Actualizarlo a \"" + nn + "\" (" + k + " kcal)?";
      if (!confirm(msg)) {
        toast("Cancelado: ese alimento ya existe");
        return;
      }
      const n = applyFoodEdit(existing, nn, k);
      nameEl.value = "";
      kcalEl.value = "";
      toast(n > 0
        ? "Actualizado · " + n + " registro(s) recalculados"
        : "Alimento actualizado");
      return;
    }
    const list = loadMyFoods();
    list.push({ n: nn, k: k, c: faCat.value });
    saveMyFoods(list);
    nameEl.value = "";
    kcalEl.value = "";
    renderFoods("");
    document.getElementById("foodSearch").value = "";
    toast("Alimento añadido");
  });

  document.getElementById("foodSearch").addEventListener("input", e => renderFoods(e.target.value));

  document.getElementById("exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ version: 1, profile: state.profile, days: state.days, myFoods: loadMyFoods(), foodOv: loadOverrides() }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "kilitos-copia-" + todayStr() + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Copia descargada");
  });

  ["syncUser", "syncRepo", "syncToken"].forEach(id => {
    document.getElementById(id).addEventListener("change", () => {
      const cfg = loadSyncCfg();
      cfg.user = document.getElementById("syncUser").value.trim();
      cfg.repo = document.getElementById("syncRepo").value.trim();
      cfg.token = document.getElementById("syncToken").value.trim();
      saveSyncCfg(cfg);
      renderSyncCard();
    });
  });
  document.getElementById("syncBtn").addEventListener("click", doSync);
  document.getElementById("syncDownBtn").addEventListener("click", doDownload);

  document.getElementById("importFile").addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data !== "object" || !data.days) throw new Error("formato");
        if (!confirm("Esto reemplazará tus datos actuales por los de la copia. ¿Continuar?")) return;
        if (data.profile) Object.assign(state.profile, data.profile);
        state.days = data.days;
        if (Array.isArray(data.myFoods)) saveMyFoods(data.myFoods);
        if (data.foodOv && typeof data.foodOv === "object") saveOverrides(data.foodOv);
        save();
        renderDiario();
        renderPerfil();
        toast("Copia importada");
      } catch (err) {
        toast("El archivo no es una copia válida");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  document.getElementById("wipeBtn").addEventListener("click", () => {
    if (!confirm("¿Borrar TODOS los datos de Kilitos? Esta acción no se puede deshacer.")) return;
    if (!confirm("¿Seguro? Descarga antes una copia de seguridad si no la tienes.")) return;
    localStorage.removeItem(STORE_KEY);
    localStorage.removeItem(MYFOODS_KEY);
    localStorage.removeItem(OVERRIDES_KEY);
    localStorage.removeItem(SYNC_KEY);
    state.updatedAt = 0;
    state.profile = { startWeight: null, targetWeight: null, height: null, age: null, sex: "", calorieGoal: null, waterGoal: 8 };
    state.days = {};
    state.currentDate = todayStr();
    renderDiario();
    renderPerfil();
    toast("Datos borrados");
  });

  window.addEventListener("resize", () => {
    if (document.getElementById("historial").classList.contains("active")) drawChart();
  });

  switchTab("diario");

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!reloaded) {
        reloaded = true;
        location.reload();
      }
    });
  }
}

init();
