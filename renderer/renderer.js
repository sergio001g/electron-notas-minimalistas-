const fileNameInput = document.getElementById("fileName");
const editor = document.getElementById("editor");
const statusText = document.getElementById("statusText");
const statsText = document.getElementById("statsText");
const lastSavedText = document.getElementById("lastSaved");

// Buttons
const saveBtn = document.getElementById("saveBtn");
const openBtn = document.getElementById("openBtn");
const newBtn = document.getElementById("newBtn");
const boldBtn = document.getElementById("boldBtn");
const italicBtn = document.getElementById("italicBtn");
const underlineBtn = document.getElementById("underlineBtn");
const printBtn = document.getElementById("printBtn");
const zenBtn = document.getElementById("zenBtn");
const sidePanelBtn = document.getElementById("sidePanelBtn");
const soundToggle = document.getElementById("soundToggle");

// Side Panel Elements
const sidePanel = document.getElementById("sidePanel");
const sessionTimeEl = document.getElementById("sessionTime");
const clockTimeEl = document.getElementById("clockTime");
const wordCountEl = document.getElementById("wordCount");
const charCountEl = document.getElementById("charCount");
const musicStatusEl = document.querySelector(".music-status");
const musicTitleEl = document.querySelector(".music-title");
const notesListEl = document.getElementById("notesList");
const refreshNotesBtn = document.getElementById("refreshNotesBtn");
const winMinBtn = document.getElementById("winMinBtn");
const winMaxBtn = document.getElementById("winMaxBtn");
const winCloseBtn = document.getElementById("winCloseBtn");
const topbar = document.querySelector(".topbar");
const boardBtn = document.getElementById("boardBtn");
const addCardBtn = document.getElementById("addCardBtn");
const addStickyBtn = document.getElementById("addStickyBtn");
const boardOverlay = document.getElementById("boardOverlay");
const boardNodes = document.getElementById("boardNodes");
const boardEdges = document.getElementById("boardEdges");
const menuBtn = document.getElementById("menuBtn");
const menuDropdown = document.getElementById("menuDropdown");
const menuAddCard = document.getElementById("menuAddCard");
const menuAddSticky = document.getElementById("menuAddSticky");
const menuConnect = document.getElementById("menuConnect");
const menuDuplicate = document.getElementById("menuDuplicate");
const menuDelete = document.getElementById("menuDelete");
const menuCenter = document.getElementById("menuCenter");
const menuGrid = document.getElementById("menuGrid");
const menuRuler = document.getElementById("menuRuler");
const menuRulerAngle = document.getElementById("menuRulerAngle");
const menuPerf = document.getElementById("menuPerf");
const menuClearBoard = document.getElementById("menuClearBoard");
const stickyColorButtons = Array.from(document.querySelectorAll("[data-sticky-color]"));
const gridColorButtons = Array.from(document.querySelectorAll("[data-grid-color]"));

// State
let autosaveTimer = null;
let lastOpenedName = "";
let audioContext = null;
let lastClickAt = 0;
let soundEnabled = true;
let sessionSeconds = 0;
let isDirty = false;
let allowDiskAutosave = false;
let statusResetTimer = null;
let draftTimer = null;
let boardState = { mode: "text", viewport: { panX: 0, panY: 0, zoom: 1 }, nodes: [], edges: [], lines: [] };
let selectedNodeId = null;
let selectedLineId = null;
let boardPersistTimer = null;
const BOARD_DATA_ID = "notemaBoardData";
let boardPanSession = null;
let connectFromId = null;
let rulerMode = false;
let rulerSession = null;
let rulerPreview = null;
let rulerAngleMode = "45";
let defaultStickyColor = "yellow";
let gridColor = "black";

const setDirty = (next) => {
  isDirty = !!next;
  if (window.appApi?.setDirty) {
    window.appApi.setDirty(isDirty);
  }
};

setDirty(false);

const STORAGE_KEYS = {
  prefs: "mn:prefs",
  draft: "mn:draft"
};

const STICKY_COLORS = ["yellow", "pink", "blue", "green", "red"];

const normalizeStickyColor = (value, fallback) => {
  const v = typeof value === "string" ? value : "";
  if (STICKY_COLORS.includes(v)) return v;
  if (STICKY_COLORS.includes(fallback)) return fallback;
  return "yellow";
};

const GRID_COLORS = {
  black: "0,0,0",
  blue: "0,120,255",
  green: "0,170,90",
  purple: "160,80,255",
  red: "210,40,40"
};

const normalizeGridColor = (value, fallback) => {
  const v = typeof value === "string" ? value : "";
  if (Object.prototype.hasOwnProperty.call(GRID_COLORS, v)) return v;
  if (Object.prototype.hasOwnProperty.call(GRID_COLORS, fallback)) return fallback;
  return "black";
};

// --- UTILS ---

const setStatus = (text) => {
  statusText.textContent = text;
};

const setLastSaved = (text) => {
  lastSavedText.textContent = text;
};

const formatTimestamp = () => {
  const now = new Date();
  return now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
};

const sanitizeName = (name) => {
  const trimmed = (name || "").trim();
  return trimmed.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
};

const safeJsonParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const readPrefs = () => safeJsonParse(localStorage.getItem(STORAGE_KEYS.prefs) || "");

const writePrefs = (prefs) => {
  localStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify(prefs));
};

const getCurrentNameBase = () => {
  const typed = sanitizeName(fileNameInput.value);
  return typed || sanitizeName(lastOpenedName);
};

const scheduleStatusReset = () => {
  if (statusResetTimer) clearTimeout(statusResetTimer);
  statusResetTimer = setTimeout(() => setStatus("Listo"), 1200);
};

const buildAutoName = () => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 5).replace(":", "");
  return `nota-${date}-${time}`;
};

// --- AUDIO ---

const ensureAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
};

const playKeySound = () => {
  if (!soundEnabled) return;
  
  const now = performance.now();
  if (now - lastClickAt < 40) return; // Debounce
  lastClickAt = now;
  
  ensureAudioContext();
  const t = audioContext.currentTime;
  
  // --- "Thock" Synthesis ---
  // We want a deep, woody, satisfying sound.
  
  // 1. The "Body" (Low thud)
  // Triangle wave for a softer body than sawtooth
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  
  osc.type = "triangle"; 
  // Pitch envelope: Start slightly higher, drop fast
  osc.frequency.setValueAtTime(120, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.08);
  
  // Volume envelope: Short attack, decay
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.3, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  
  osc.connect(gain);
  gain.connect(audioContext.destination);
  
  osc.start(t);
  osc.stop(t + 0.12);

  // 2. The "Click" (High frequency transient)
  // Very short burst of noise or high sine
  const clickOsc = audioContext.createOscillator();
  const clickGain = audioContext.createGain();
  const clickFilter = audioContext.createBiquadFilter();

  clickOsc.type = "sine";
  clickOsc.frequency.setValueAtTime(2000, t); // High ping
  clickOsc.frequency.exponentialRampToValueAtTime(500, t + 0.02);
  
  clickFilter.type = "lowpass";
  clickFilter.frequency.setValueAtTime(3000, t);

  clickGain.gain.setValueAtTime(0, t);
  clickGain.gain.linearRampToValueAtTime(0.05, t + 0.002); // Very quiet
  clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

  clickOsc.connect(clickFilter);
  clickFilter.connect(clickGain);
  clickGain.connect(audioContext.destination);

  clickOsc.start(t);
  clickOsc.stop(t + 0.05);
};

// --- FEATURES ---

const updateStats = () => {
  const text = editor.innerText || "";
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  
  // Update footer
  statsText.textContent = `${words} palabras`;
  
  // Update dashboard
  if (wordCountEl) wordCountEl.textContent = words;
  if (charCountEl) charCountEl.textContent = chars;
};

const updateClock = () => {
  const now = new Date();
  if (clockTimeEl) {
    clockTimeEl.textContent = now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  }
};

const updateSessionTimer = () => {
  sessionSeconds++;
  const m = Math.floor(sessionSeconds / 60).toString().padStart(2, "0");
  const s = (sessionSeconds % 60).toString().padStart(2, "0");
  if (sessionTimeEl) sessionTimeEl.textContent = `${m}:${s}`;
};

// Mock Music Status
const musicStates = [
  { title: "Spotify", status: "Reproduciendo: Lo-Fi Beats" },
  { title: "Chrome", status: "Navegando: Stack Overflow" },
  { title: "Sistema", status: "En reposo" },
  { title: "Spotify", status: "Reproduciendo: Deep Focus" }
];
let musicIndex = 0;

const updateMusicStatus = () => {
  // Simulate checking for activity
  if (Math.random() > 0.7) {
     musicIndex = (musicIndex + 1) % musicStates.length;
     const state = musicStates[musicIndex];
     musicTitleEl.textContent = state.title;
     musicStatusEl.textContent = state.status;
  }
};

const formatShortDateTime = (ms) => {
  const d = new Date(ms);
  return d.toLocaleString("es-ES", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const renderNotesList = (notes) => {
  if (!notesListEl) return;
  notesListEl.innerHTML = "";
  if (!notes || notes.length === 0) {
    const empty = document.createElement("div");
    empty.className = "meta-text";
    empty.textContent = "Sin notas aún";
    notesListEl.appendChild(empty);
    return;
  }

  for (const note of notes.slice(0, 12)) {
    const item = document.createElement("div");
    item.className = "note-item";
    item.tabIndex = 0;

    const name = document.createElement("div");
    name.className = "note-name";
    name.textContent = note.fileName.replace(/\.txt$/i, "");

    const meta = document.createElement("div");
    meta.className = "note-meta";
    meta.textContent = formatShortDateTime(note.modifiedAt);

    item.appendChild(name);
    item.appendChild(meta);

    const open = async () => {
      const result = await window.notesApi.openNoteByName(note.fileName);
      if (!result.ok) {
        setStatus("No se pudo abrir");
        scheduleStatusReset();
        return;
      }
      fileNameInput.value = result.fileName.replace(/\.txt$/, "");
      lastOpenedName = result.fileName.replace(/\.txt$/, "");
      editor.innerHTML = result.content || "";
      hydrateBoardFromEditor();
      syncBoardUi();
      setDirty(false);
      allowDiskAutosave = true;
      setStatus("Abierto");
      setLastSaved(`Abierto ${formatTimestamp()}`);
      localStorage.removeItem(STORAGE_KEYS.draft);
      updateStats();
      scheduleStatusReset();
    };

    item.addEventListener("click", open);
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });

    notesListEl.appendChild(item);
  }
};

const refreshNotesList = async () => {
  if (!window.notesApi?.listNotes) return;
  const result = await window.notesApi.listNotes();
  if (!result?.ok) return;
  renderNotesList(result.notes);
};

const generateId = () => {
  if (typeof crypto?.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
};

const readEmbeddedBoardState = () => {
  const el = editor.querySelector(`#${BOARD_DATA_ID}[data-notema-board]`);
  if (!el) return null;
  try {
    return JSON.parse(el.textContent || "");
  } catch {
    return null;
  }
};

const removeEmbeddedBoardState = () => {
  const el = editor.querySelector(`#${BOARD_DATA_ID}[data-notema-board]`);
  if (el) el.remove();
};

const persistBoardStateToEditor = () => {
  removeEmbeddedBoardState();
  const shouldPersist =
    boardState.mode === "board" ||
    (Array.isArray(boardState.nodes) && boardState.nodes.length > 0) ||
    (Array.isArray(boardState.edges) && boardState.edges.length > 0) ||
    (Array.isArray(boardState.lines) && boardState.lines.length > 0);
  if (!shouldPersist) return;

  const el = document.createElement("div");
  el.id = BOARD_DATA_ID;
  el.setAttribute("data-notema-board", "1");
  el.style.display = "none";
  el.contentEditable = "false";
  el.textContent = JSON.stringify(boardState);
  editor.appendChild(el);
};

const scheduleBoardPersist = () => {
  if (boardPersistTimer) clearTimeout(boardPersistTimer);
  boardPersistTimer = setTimeout(() => {
    setDirty(true);
    setLastSaved("Sin guardar");
    scheduleDraftSave();
  }, 180);
};

const setBoardMode = (mode) => {
  boardState.mode = mode === "board" ? "board" : "text";
  if (!boardOverlay) return;
  if (boardState.mode === "board") {
    boardOverlay.classList.remove("hidden");
    boardOverlay.setAttribute("aria-hidden", "false");
    editor.setAttribute("contenteditable", "false");
    applyViewport();
    scheduleEdgesUpdate();
  } else {
    boardOverlay.classList.add("hidden");
    boardOverlay.setAttribute("aria-hidden", "true");
    editor.setAttribute("contenteditable", "true");
    editor.focus();
  }
  persistBoardStateToEditor();
};

const clearBoardState = () => {
  boardState = { mode: "text", viewport: { panX: 0, panY: 0, zoom: 1 }, nodes: [], edges: [], lines: [] };
  selectedNodeId = null;
  selectedLineId = null;
  connectFromId = null;
  rulerPreview = null;
  rulerSession = null;
  rulerMode = false;
  if (boardOverlay) boardOverlay.classList.remove("ruler");
  removeEmbeddedBoardState();
  if (boardNodes) boardNodes.innerHTML = "";
  if (boardEdges) boardEdges.innerHTML = "";
  if (boardOverlay) {
    boardOverlay.classList.add("hidden");
    boardOverlay.setAttribute("aria-hidden", "true");
  }
  editor.setAttribute("contenteditable", "true");
};

const getNodeById = (id) => boardState.nodes.find((n) => n.id === id);

const getOverlayRect = () => boardOverlay.getBoundingClientRect();

const getViewport = () => {
  if (!boardState.viewport || typeof boardState.viewport !== "object") {
    boardState.viewport = { panX: 0, panY: 0, zoom: 1 };
  }
  const v = boardState.viewport;
  v.panX = Number.isFinite(v.panX) ? v.panX : 0;
  v.panY = Number.isFinite(v.panY) ? v.panY : 0;
  v.zoom = Number.isFinite(v.zoom) ? v.zoom : 1;
  v.zoom = Math.min(1.8, Math.max(0.55, v.zoom));
  return v;
};

const screenToWorld = (clientX, clientY) => {
  const rect = getOverlayRect();
  const v = getViewport();
  const px = clientX - rect.left;
  const py = clientY - rect.top;
  return { x: (px - v.panX) / v.zoom, y: (py - v.panY) / v.zoom, px, py };
};

const worldToScreen = (worldX, worldY) => {
  const v = getViewport();
  return { x: worldX * v.zoom + v.panX, y: worldY * v.zoom + v.panY };
};

const isGridEnabled = () => !!boardOverlay && boardOverlay.classList.contains("grid");

const snapToGrid = (value) => {
  const size = 32;
  return Math.round(value / size) * size;
};

const snapPointToGrid = (p) => {
  if (!isGridEnabled()) return p;
  return { x: snapToGrid(p.x), y: snapToGrid(p.y) };
};

const snapLineAngle = (start, end, stepRad = Math.PI / 4) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return end;
  const angle = Math.atan2(dy, dx);
  const step = Number.isFinite(stepRad) && stepRad > 0 ? stepRad : Math.PI / 4;
  const snapped = Math.round(angle / step) * step;
  return { x: start.x + Math.cos(snapped) * len, y: start.y + Math.sin(snapped) * len };
};

const applyViewport = () => {
  if (!boardNodes) return;
  const v = getViewport();
  boardNodes.style.transform = `translate(${v.panX}px, ${v.panY}px) scale(${v.zoom})`;
};

const resetViewport = () => {
  boardState.viewport = { panX: 0, panY: 0, zoom: 1 };
  applyViewport();
  scheduleEdgesUpdate();
  scheduleBoardPersist();
};

let edgesRaf = 0;

const updateEdges = () => {
  if (!boardEdges || !boardOverlay) return;
  const overlayRect = getOverlayRect();
  const v = getViewport();
  const paper = boardOverlay.classList.contains("paper");

  boardEdges.setAttribute("viewBox", `0 0 ${Math.max(1, overlayRect.width)} ${Math.max(1, overlayRect.height)}`);
  boardEdges.innerHTML =
    `<defs><marker id="notemaArrow" markerWidth="10" markerHeight="10" refX="8.5" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L9,3 L0,6 Z" fill="${paper ? "rgba(40,40,40,0.42)" : "rgba(255,255,255,0.35)"}"/></marker></defs>`;

  const lines = Array.isArray(boardState.lines) ? boardState.lines : [];
  for (const ln of lines) {
    if (!ln || typeof ln !== "object") continue;
    const a = worldToScreen(ln.x1, ln.y1);
    const b = worldToScreen(ln.x2, ln.y2);
    const el = document.createElementNS("http://www.w3.org/2000/svg", "line");
    el.setAttribute("x1", a.x);
    el.setAttribute("y1", a.y);
    el.setAttribute("x2", b.x);
    el.setAttribute("y2", b.y);
    el.setAttribute(
      "stroke",
      ln.id === selectedLineId ? "rgba(30, 144, 255, 0.85)" : paper ? "rgba(40, 40, 40, 0.55)" : "rgba(255, 255, 255, 0.22)"
    );
    el.setAttribute("stroke-width", "2.2");
    el.setAttribute("stroke-linecap", "round");
    el.setAttribute("data-line-id", ln.id);
    el.setAttribute("pointer-events", "stroke");
    boardEdges.appendChild(el);
  }

  if (rulerPreview) {
    const a = worldToScreen(rulerPreview.x1, rulerPreview.y1);
    const b = worldToScreen(rulerPreview.x2, rulerPreview.y2);
    const el = document.createElementNS("http://www.w3.org/2000/svg", "line");
    el.setAttribute("x1", a.x);
    el.setAttribute("y1", a.y);
    el.setAttribute("x2", b.x);
    el.setAttribute("y2", b.y);
    el.setAttribute("stroke", "rgba(30, 144, 255, 0.75)");
    el.setAttribute("stroke-width", "2.2");
    el.setAttribute("stroke-dasharray", "6 6");
    el.setAttribute("stroke-linecap", "round");
    el.setAttribute("pointer-events", "none");
    boardEdges.appendChild(el);
  }

  for (const edge of boardState.edges) {
    const from = getNodeById(edge.from);
    const to = getNodeById(edge.to);
    if (!from || !to) continue;

    const fromW = Number.isFinite(from.w) ? from.w : 260;
    const fromH = Number.isFinite(from.h) ? from.h : 160;
    const toW = Number.isFinite(to.w) ? to.w : 260;
    const toH = Number.isFinite(to.h) ? to.h : 160;

    const x1 = from.x * v.zoom + v.panX + (fromW * v.zoom) / 2;
    const y1 = from.y * v.zoom + v.panY + (fromH * v.zoom) / 2;
    const x2 = to.x * v.zoom + v.panX + (toW * v.zoom) / 2;
    const y2 = to.y * v.zoom + v.panY + (toH * v.zoom) / 2;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.setAttribute("stroke", paper ? "rgba(40,40,40,0.25)" : "rgba(255,255,255,0.28)");
    line.setAttribute("stroke-width", "1.4");
    line.setAttribute("marker-end", "url(#notemaArrow)");
    line.setAttribute("pointer-events", "none");
    boardEdges.appendChild(line);
  }
};

const scheduleEdgesUpdate = () => {
  if (edgesRaf) return;
  edgesRaf = requestAnimationFrame(() => {
    edgesRaf = 0;
    updateEdges();
  });
};

const selectLine = (id) => {
  selectedLineId = id;
  if (id) {
    selectedNodeId = null;
    for (const el of boardNodes?.querySelectorAll(".board-node") || []) {
      el.classList.remove("selected");
    }
  }
  if (typeof syncMenuUi === "function") {
    syncMenuUi();
  }
  scheduleEdgesUpdate();
};

const removeLine = (id) => {
  boardState.lines = (Array.isArray(boardState.lines) ? boardState.lines : []).filter((l) => l.id !== id);
  if (selectedLineId === id) selectedLineId = null;
  scheduleBoardPersist();
  scheduleEdgesUpdate();
};

const selectNode = (id) => {
  selectedNodeId = id;
  if (id) selectedLineId = null;
  for (const el of boardNodes?.querySelectorAll(".board-node") || []) {
    el.classList.toggle("selected", el.dataset.id === id);
  }
  if (typeof syncMenuUi === "function") {
    syncMenuUi();
  }
};

const addEdge = (from, to) => {
  if (!from || !to || from === to) return;
  const exists = boardState.edges.some((e) => e.from === from && e.to === to);
  if (exists) return;
  boardState.edges.push({ from, to });
  scheduleBoardPersist();
  scheduleEdgesUpdate();
};

const removeNodeAndEdges = (id) => {
  boardState.nodes = boardState.nodes.filter((n) => n.id !== id);
  boardState.edges = boardState.edges.filter((e) => e.from !== id && e.to !== id);
  if (selectedNodeId === id) selectedNodeId = null;
  if (connectFromId === id) connectFromId = null;
  scheduleBoardPersist();
  renderBoard();
};

const attachNodeBehavior = (nodeEl, node) => {
  const handle = nodeEl.querySelector(".node-handle");
  const body = nodeEl.querySelector(".node-body");
  const del = nodeEl.querySelector(".node-delete");
  const resize = nodeEl.querySelector(".node-resize");

  nodeEl.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".node-delete")) return;
    if (e.target.closest(".node-body")) return;
    selectNode(node.id);
  });

  nodeEl.addEventListener("click", (e) => {
    if (e.target.closest(".node-delete")) return;
    if (e.shiftKey && selectedNodeId && selectedNodeId !== node.id) {
      addEdge(selectedNodeId, node.id);
      return;
    }
    if (connectFromId && connectFromId !== node.id) {
      addEdge(connectFromId, node.id);
      connectFromId = null;
      setStatus("Conectado");
      scheduleStatusReset();
      return;
    }
    if (!e.target.closest(".node-body")) {
      selectNode(node.id);
    }
  });

  if (del) {
    del.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeNodeAndEdges(node.id);
    });
  }

  if (body) {
    body.addEventListener("input", () => {
      node.html = body.innerHTML || "";
      scheduleBoardPersist();
    });
    body.addEventListener("focus", () => selectNode(node.id));
  }

  if (handle) {
    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectNode(node.id);

      const startX = e.clientX;
      const startY = e.clientY;
      const startLeft = node.x;
      const startTop = node.y;
      const zoom = getViewport().zoom;
      const previousWillChange = nodeEl.style.willChange;
      nodeEl.style.willChange = "transform";

      handle.setPointerCapture(e.pointerId);

      const onMove = (ev) => {
        const dx = (ev.clientX - startX) / zoom;
        const dy = (ev.clientY - startY) / zoom;
        const nx = startLeft + dx;
        const ny = startTop + dy;
        if (isGridEnabled()) {
          node.x = snapToGrid(nx);
          node.y = snapToGrid(ny);
        } else {
          node.x = Math.round(nx);
          node.y = Math.round(ny);
        }
        const tx = node.x - startLeft;
        const ty = node.y - startTop;
        nodeEl.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
        scheduleEdgesUpdate();
      };

      const onUp = (ev) => {
        handle.releasePointerCapture(ev.pointerId);
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onCancel);
        nodeEl.style.transform = "";
        nodeEl.style.left = `${node.x}px`;
        nodeEl.style.top = `${node.y}px`;
        nodeEl.style.willChange = previousWillChange;
        scheduleEdgesUpdate();
        scheduleBoardPersist();
      };

      const onCancel = (ev) => {
        try {
          handle.releasePointerCapture(ev.pointerId);
        } catch {}
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onCancel);
        nodeEl.style.transform = "";
        nodeEl.style.left = `${node.x}px`;
        nodeEl.style.top = `${node.y}px`;
        nodeEl.style.willChange = previousWillChange;
        scheduleEdgesUpdate();
      };

      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onCancel);
    });
  }

  if (resize) {
    resize.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectNode(node.id);

      const startX = e.clientX;
      const startY = e.clientY;
      const startW = node.w;
      const startH = node.h;
      const zoom = getViewport().zoom;

      resize.setPointerCapture(e.pointerId);

      const onMove = (ev) => {
        const dx = (ev.clientX - startX) / zoom;
        const dy = (ev.clientY - startY) / zoom;
        const baseW = Number.isFinite(startW) ? startW : 260;
        const baseH = Number.isFinite(startH) ? startH : 160;
        let nextW = Math.max(160, baseW + dx);
        let nextH = Math.max(110, baseH + dy);
        if (isGridEnabled()) {
          nextW = Math.max(160, snapToGrid(nextW));
          nextH = Math.max(110, snapToGrid(nextH));
        }
        node.w = Math.round(nextW);
        node.h = Math.round(nextH);
        nodeEl.style.width = `${node.w}px`;
        nodeEl.style.height = `${node.h}px`;
        scheduleEdgesUpdate();
      };

      const onUp = (ev) => {
        resize.releasePointerCapture(ev.pointerId);
        resize.removeEventListener("pointermove", onMove);
        resize.removeEventListener("pointerup", onUp);
        scheduleBoardPersist();
      };

      resize.addEventListener("pointermove", onMove);
      resize.addEventListener("pointerup", onUp);
    });
  }
};

const renderBoard = () => {
  if (!boardNodes || !boardOverlay) return;
  boardNodes.innerHTML = "";

  for (const node of boardState.nodes) {
    const nodeEl = document.createElement("div");
    nodeEl.className = `board-node ${node.type === "sticky" ? "sticky" : ""}`.trim();
    nodeEl.dataset.id = node.id;
    if (node.type === "sticky") {
      nodeEl.dataset.color = normalizeStickyColor(node.color, defaultStickyColor);
    }
    nodeEl.style.left = `${node.x}px`;
    nodeEl.style.top = `${node.y}px`;
    nodeEl.style.width = `${node.w}px`;
    nodeEl.style.height = `${node.h}px`;
    if (node.id === selectedNodeId) {
      nodeEl.classList.add("selected");
    }

    const handle = document.createElement("div");
    handle.className = "node-handle";

    const body = document.createElement("div");
    body.className = "node-body";
    body.contentEditable = "true";
    body.spellcheck = true;
    body.innerHTML = node.html || "";

    const del = document.createElement("button");
    del.className = "node-delete";
    del.type = "button";
    del.textContent = "×";

    const resize = document.createElement("div");
    resize.className = "node-resize";

    nodeEl.appendChild(handle);
    nodeEl.appendChild(body);
    nodeEl.appendChild(del);
    nodeEl.appendChild(resize);
    boardNodes.appendChild(nodeEl);

    attachNodeBehavior(nodeEl, node);
  }

  scheduleEdgesUpdate();
};

const addNode = (type, options = {}) => {
  if (!boardOverlay) return;
  const overlayRect = getOverlayRect();
  const v = getViewport();
  const w = 260;
  const h = 160;
  const cx = overlayRect.width / 2;
  const cy = overlayRect.height / 2;
  let x = Math.round((cx - v.panX) / v.zoom - w / 2);
  let y = Math.round((cy - v.panY) / v.zoom - h / 2);
  if (isGridEnabled()) {
    x = snapToGrid(x);
    y = snapToGrid(y);
  }
  const node = {
    id: generateId(),
    type: type === "sticky" ? "sticky" : "card",
    x,
    y,
    w,
    h,
    html: ""
  };
  if (node.type === "sticky") {
    node.color = normalizeStickyColor(options?.color, defaultStickyColor);
  }
  boardState.nodes.push(node);
  setBoardMode("board");
  selectNode(node.id);
  renderBoard();
  scheduleBoardPersist();
  const el = boardNodes?.querySelector(`.board-node[data-id="${node.id}"] .node-body`);
  if (el) el.focus();
};

const hydrateBoardFromEditor = () => {
  const state = readEmbeddedBoardState();
  removeEmbeddedBoardState();
  const normalizeNodes = (nodes) => {
    const list = Array.isArray(nodes) ? nodes : [];
    return list
      .map((n) => {
        const id = typeof n?.id === "string" && n.id ? n.id : generateId();
        const type = n?.type === "sticky" ? "sticky" : "card";
        const x = Number.isFinite(n?.x) ? n.x : 0;
        const y = Number.isFinite(n?.y) ? n.y : 0;
        const w = Number.isFinite(n?.w) ? Math.max(160, n.w) : 260;
        const h = Number.isFinite(n?.h) ? Math.max(110, n.h) : 160;
        const html = typeof n?.html === "string" ? n.html : "";
        const color = type === "sticky" ? normalizeStickyColor(n?.color, defaultStickyColor) : undefined;
        return { id, type, x, y, w, h, html, color };
      })
      .slice(0, 400);
  };

  const normalizeEdges = (edges) => {
    const list = Array.isArray(edges) ? edges : [];
    return list
      .map((e) => ({
        from: typeof e?.from === "string" ? e.from : "",
        to: typeof e?.to === "string" ? e.to : ""
      }))
      .filter((e) => e.from && e.to && e.from !== e.to)
      .slice(0, 900);
  };

  const normalizeLines = (lines) => {
    const list = Array.isArray(lines) ? lines : [];
    return list
      .map((l) => ({
        id: typeof l?.id === "string" && l.id ? l.id : generateId(),
        x1: Number.isFinite(l?.x1) ? l.x1 : 0,
        y1: Number.isFinite(l?.y1) ? l.y1 : 0,
        x2: Number.isFinite(l?.x2) ? l.x2 : 0,
        y2: Number.isFinite(l?.y2) ? l.y2 : 0
      }))
      .slice(0, 1200);
  };

  if (state && typeof state === "object") {
    boardState = {
      mode: state.mode === "board" ? "board" : "text",
      viewport: state.viewport && typeof state.viewport === "object" ? state.viewport : { panX: 0, panY: 0, zoom: 1 },
      nodes: normalizeNodes(state.nodes),
      edges: normalizeEdges(state.edges),
      lines: normalizeLines(state.lines)
    };
  } else {
    boardState = { mode: "text", viewport: { panX: 0, panY: 0, zoom: 1 }, nodes: [], edges: [], lines: [] };
  }
  selectedNodeId = null;
  selectedLineId = null;
  connectFromId = null;
  setBoardMode(boardState.mode);
  applyViewport();
  renderBoard();
};

const scheduleDraftSave = () => {
  if (draftTimer) clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    persistBoardStateToEditor();
    const html = editor.innerHTML || "";
    const name = getCurrentNameBase();
    const empty = !html || html === "<br>" || html === "<div><br></div>";
    if (empty && !name) {
      localStorage.removeItem(STORAGE_KEYS.draft);
      return;
    }
    localStorage.setItem(
      STORAGE_KEYS.draft,
      JSON.stringify({ name, html, ts: Date.now() })
    );
  }, 350);
};

// --- CORE ---

const updateMaximizeButton = async () => {
  if (!winMaxBtn || !window.windowApi?.isMaximized) return;
  const maximized = await window.windowApi.isMaximized();
  winMaxBtn.title = maximized ? "Restaurar" : "Maximizar";
  winMaxBtn.setAttribute("aria-label", maximized ? "Restaurar" : "Maximizar");
  winMaxBtn.innerHTML = maximized
    ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M4.2 2.8h5v5"/><path d="M7.8 4.2H2.8v5h5z"/></svg>'
    : '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><rect x="2.2" y="2.2" width="7.6" height="7.6" rx="0.8"/></svg>';
};

const saveNote = async (nameOverride) => {
  const name = sanitizeName(nameOverride ?? fileNameInput.value);
  const resolvedName = name || lastOpenedName || buildAutoName();
  persistBoardStateToEditor();
  const content = editor.innerHTML;
  const result = await window.notesApi.saveNote(resolvedName, content);
  if (result.ok) {
    fileNameInput.value = result.fileName.replace(/\.txt$/, "");
    lastOpenedName = result.fileName.replace(/\.txt$/, "");
    setStatus(`Guardado`);
    setLastSaved(`Guardado ${formatTimestamp()}`);
    setDirty(false);
    allowDiskAutosave = true;
    localStorage.removeItem(STORAGE_KEYS.draft);
    refreshNotesList();
  } else {
    setStatus("Error al guardar");
  }
  scheduleStatusReset();
};

// --- LISTENERS ---

if (winMinBtn) {
  winMinBtn.addEventListener("click", () => {
    window.windowApi?.minimize?.();
  });
}

if (winMaxBtn) {
  winMaxBtn.addEventListener("click", async () => {
    await window.windowApi?.toggleMaximize?.();
    updateMaximizeButton();
  });
}

if (winCloseBtn) {
  winCloseBtn.addEventListener("click", () => {
    window.windowApi?.close?.();
  });
}

if (topbar) {
  topbar.addEventListener("dblclick", async (e) => {
    if (e.target.closest(".actions")) return;
    await window.windowApi?.toggleMaximize?.();
    updateMaximizeButton();
  });
}

const syncBoardUi = () => {
  if (!boardBtn) return;
  const active = boardState.mode === "board";
  boardBtn.classList.toggle("active", active);
};

if (boardBtn) {
  boardBtn.addEventListener("click", () => {
    setBoardMode(boardState.mode === "board" ? "text" : "board");
    renderBoard();
    scheduleBoardPersist();
    syncBoardUi();
  });
}

if (addCardBtn) {
  addCardBtn.addEventListener("click", () => addNode("card"));
}

if (addStickyBtn) {
  addStickyBtn.addEventListener("click", () => addNode("sticky", { color: defaultStickyColor }));
}

const isMenuOpen = () => !!menuDropdown && !menuDropdown.classList.contains("hidden");

const getRulerAngleLabel = (mode) => {
  if (mode === "90") return "90°";
  if (mode === "15") return "15°";
  if (mode === "free") return "Libre";
  return "45°";
};

const setRulerAngleMode = (mode) => {
  rulerAngleMode = mode === "90" ? "90" : mode === "15" ? "15" : mode === "free" ? "free" : "45";
  const prefs = readPrefs() || {};
  writePrefs({ ...prefs, rulerAngleMode });
  if (menuRulerAngle) {
    menuRulerAngle.textContent = `Ángulos: ${getRulerAngleLabel(rulerAngleMode)}`;
  }
  syncMenuUi();
};

const cycleRulerAngleMode = () => {
  if (rulerAngleMode === "free") setRulerAngleMode("45");
  else if (rulerAngleMode === "45") setRulerAngleMode("90");
  else if (rulerAngleMode === "90") setRulerAngleMode("15");
  else setRulerAngleMode("free");
};

const setDefaultStickyColor = (color) => {
  defaultStickyColor = normalizeStickyColor(color, "yellow");
  const prefs = readPrefs() || {};
  writePrefs({ ...prefs, defaultStickyColor });
  syncMenuUi();
};

const setGridColor = (color) => {
  gridColor = normalizeGridColor(color, "black");
  if (boardOverlay) {
    const rgb = GRID_COLORS[gridColor] || GRID_COLORS.black;
    boardOverlay.style.setProperty("--grid-rgb", rgb);
  }
  const prefs = readPrefs() || {};
  writePrefs({ ...prefs, boardGridColor: gridColor });
  syncMenuUi();
};

const setSelectedStickyColor = (color) => {
  const node = selectedNodeId ? getNodeById(selectedNodeId) : null;
  const c = normalizeStickyColor(color, defaultStickyColor);
  if (!node || node.type !== "sticky") {
    setDefaultStickyColor(c);
    setStatus(`Color predeterminado: ${c}`);
    scheduleStatusReset();
    return;
  }
  node.color = c;
  renderBoard();
  scheduleBoardPersist();
  setStatus(`Post-it: ${c}`);
  scheduleStatusReset();
};

const syncMenuUi = () => {
  const hasNodeSelection = !!selectedNodeId;
  const hasAnySelection = !!selectedNodeId || !!selectedLineId;
  if (menuDelete) menuDelete.disabled = !hasAnySelection;
  if (menuDuplicate) menuDuplicate.disabled = !hasNodeSelection;
  if (menuConnect) menuConnect.disabled = !hasNodeSelection;

  const gridOn = !!boardOverlay && boardOverlay.classList.contains("grid");
  const perfOn = document.body.classList.contains("perf-mode");
  if (menuGrid) menuGrid.classList.toggle("active", gridOn);
  if (menuPerf) menuPerf.classList.toggle("active", perfOn);
  if (menuRuler) menuRuler.classList.toggle("active", rulerMode);
  if (menuRulerAngle) {
    menuRulerAngle.textContent = `Ángulos: ${getRulerAngleLabel(rulerAngleMode)}`;
  }

  const selectedNode = selectedNodeId ? getNodeById(selectedNodeId) : null;
  const stickyActiveColor =
    selectedNode && selectedNode.type === "sticky"
      ? normalizeStickyColor(selectedNode.color, defaultStickyColor)
      : normalizeStickyColor(defaultStickyColor, "yellow");

  for (const btn of stickyColorButtons) {
    const c = btn?.dataset?.stickyColor;
    btn.classList.toggle("active", c === stickyActiveColor);
  }

  for (const btn of gridColorButtons) {
    const c = btn?.dataset?.gridColor;
    btn.classList.toggle("active", c === gridColor);
  }
};

const openMenu = () => {
  if (!menuDropdown || !menuBtn) return;
  menuDropdown.classList.remove("hidden");
  menuDropdown.setAttribute("aria-hidden", "false");
  menuBtn.setAttribute("aria-expanded", "true");
  syncMenuUi();
};

const closeMenu = () => {
  if (!menuDropdown || !menuBtn) return;
  menuDropdown.classList.add("hidden");
  menuDropdown.setAttribute("aria-hidden", "true");
  menuBtn.setAttribute("aria-expanded", "false");
};

const toggleMenu = () => {
  if (isMenuOpen()) closeMenu();
  else openMenu();
};

const setGridEnabled = (enabled) => {
  if (!boardOverlay) return;
  if (!!enabled && boardState.mode !== "board") {
    setBoardMode("board");
    renderBoard();
    syncBoardUi();
  }
  boardOverlay.classList.toggle("grid", !!enabled);
  boardOverlay.classList.toggle("paper", !!enabled);
  const prefs = readPrefs() || {};
  writePrefs({ ...prefs, boardGrid: !!enabled });
  syncMenuUi();
  scheduleEdgesUpdate();
  setStatus(!!enabled ? "Hoja cuadriculada activada" : "Cuadrícula desactivada");
  scheduleStatusReset();
};

const setPerfModeEnabled = (enabled) => {
  document.body.classList.toggle("perf-mode", !!enabled);
  const prefs = readPrefs() || {};
  writePrefs({ ...prefs, boardPerfMode: !!enabled });
  syncMenuUi();
  setStatus(!!enabled ? "Modo rendimiento activado" : "Modo rendimiento desactivado");
  scheduleStatusReset();
};

const duplicateSelectedNode = () => {
  if (!selectedNodeId) return;
  const original = getNodeById(selectedNodeId);
  if (!original) return;
  const clone = {
    ...original,
    id: generateId(),
    x: Math.round(original.x + 22),
    y: Math.round(original.y + 22)
  };
  boardState.nodes.push(clone);
  selectNode(clone.id);
  renderBoard();
  scheduleBoardPersist();
  const el = boardNodes?.querySelector(`.board-node[data-id="${clone.id}"] .node-body`);
  if (el) el.focus();
};

const startConnectMode = () => {
  if (!selectedNodeId) return;
  connectFromId = selectedNodeId;
  setStatus("Conectar: click en el destino");
  scheduleStatusReset();
};

const setRulerModeEnabled = (enabled) => {
  rulerMode = !!enabled;
  connectFromId = null;
  rulerSession = null;
  rulerPreview = null;
  if (boardOverlay) boardOverlay.classList.toggle("ruler", rulerMode);
  if (rulerMode && boardState.mode !== "board") {
    setBoardMode("board");
    renderBoard();
    syncBoardUi();
  }
  setStatus(rulerMode ? "Regla: arrastra para trazar línea" : "Regla desactivada");
  scheduleStatusReset();
  syncMenuUi();
  scheduleEdgesUpdate();
};

if (menuBtn) {
  menuBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleMenu();
  });
}

document.addEventListener("pointerdown", (e) => {
  if (!isMenuOpen()) return;
  if (e.target.closest(".menu")) return;
  closeMenu();
});

if (menuAddCard) {
  menuAddCard.addEventListener("click", () => {
    addNode("card");
    closeMenu();
  });
}

if (menuAddSticky) {
  menuAddSticky.addEventListener("click", () => {
    addNode("sticky", { color: defaultStickyColor });
    closeMenu();
  });
}

if (menuConnect) {
  menuConnect.addEventListener("click", () => {
    startConnectMode();
    closeMenu();
  });
}

if (menuDuplicate) {
  menuDuplicate.addEventListener("click", () => {
    duplicateSelectedNode();
    closeMenu();
  });
}

if (menuDelete) {
  menuDelete.addEventListener("click", () => {
    if (selectedNodeId) {
      removeNodeAndEdges(selectedNodeId);
    } else if (selectedLineId) {
      removeLine(selectedLineId);
    } else {
      return;
    }
    closeMenu();
  });
}

if (menuCenter) {
  menuCenter.addEventListener("click", () => {
    resetViewport();
    closeMenu();
  });
}

if (menuRuler) {
  menuRuler.addEventListener("click", () => {
    setRulerModeEnabled(!rulerMode);
    closeMenu();
  });
}

if (menuRulerAngle) {
  menuRulerAngle.addEventListener("click", () => {
    cycleRulerAngleMode();
    setStatus(`Ángulos: ${getRulerAngleLabel(rulerAngleMode)}`);
    scheduleStatusReset();
    closeMenu();
  });
}

for (const btn of stickyColorButtons) {
  btn.addEventListener("click", () => {
    const c = btn.dataset.stickyColor;
    setSelectedStickyColor(c);
  });
}

for (const btn of gridColorButtons) {
  btn.addEventListener("click", () => {
    const c = btn.dataset.gridColor;
    setGridColor(c);
    setStatus(`Cuadrícula: ${c}`);
    scheduleStatusReset();
  });
}

if (menuGrid) {
  menuGrid.addEventListener("click", () => {
    setGridEnabled(!boardOverlay?.classList.contains("grid"));
    closeMenu();
  });
}

if (menuPerf) {
  menuPerf.addEventListener("click", () => {
    setPerfModeEnabled(!document.body.classList.contains("perf-mode"));
    closeMenu();
  });
}

if (menuClearBoard) {
  menuClearBoard.addEventListener("click", () => {
    if (!window.confirm("¿Vaciar tablero?")) return;
    clearBoardState();
    syncBoardUi();
    scheduleBoardPersist();
    closeMenu();
  });
}

const clearBoardSelection = () => {
  selectNode(null);
  selectLine(null);
  connectFromId = null;
};

if (boardOverlay) {
  boardOverlay.addEventListener("pointerdown", (e) => {
    if (boardState.mode !== "board") return;
    if (e.button !== 0) return;
    if (e.target.closest(".board-node")) return;

    const lineId = e.target?.getAttribute?.("data-line-id");
    if (lineId) {
      e.preventDefault();
      selectLine(lineId);
      return;
    }

    if (connectFromId) {
      connectFromId = null;
      setStatus("Conexión cancelada");
      scheduleStatusReset();
    }

    if (rulerMode) {
      e.preventDefault();
      clearBoardSelection();
      const startRaw = screenToWorld(e.clientX, e.clientY);
      const start = snapPointToGrid({ x: startRaw.x, y: startRaw.y });
      rulerSession = { pointerId: e.pointerId, start };
      rulerPreview = { x1: start.x, y1: start.y, x2: start.x, y2: start.y };
      scheduleEdgesUpdate();
      boardOverlay.setPointerCapture(e.pointerId);

      const onMove = (ev) => {
        if (!rulerSession || ev.pointerId !== rulerSession.pointerId) return;
        const raw = screenToWorld(ev.clientX, ev.clientY);
        let end = snapPointToGrid({ x: raw.x, y: raw.y });
        const shouldSnap = rulerAngleMode !== "free" || ev.shiftKey;
        if (shouldSnap) {
          const step =
            rulerAngleMode === "90" ? Math.PI / 2 : rulerAngleMode === "15" ? Math.PI / 12 : Math.PI / 4;
          end = snapLineAngle(rulerSession.start, end, step);
        }
        rulerPreview = { x1: rulerSession.start.x, y1: rulerSession.start.y, x2: end.x, y2: end.y };
        scheduleEdgesUpdate();
      };

      const onUp = (ev) => {
        if (!rulerSession || ev.pointerId !== rulerSession.pointerId) return;
        boardOverlay.releasePointerCapture(ev.pointerId);
        boardOverlay.removeEventListener("pointermove", onMove);
        boardOverlay.removeEventListener("pointerup", onUp);
        boardOverlay.removeEventListener("pointercancel", onCancel);

        const end = { x: rulerPreview?.x2 ?? rulerSession.start.x, y: rulerPreview?.y2 ?? rulerSession.start.y };
        const dist = Math.hypot(end.x - rulerSession.start.x, end.y - rulerSession.start.y);
        if (dist >= 8) {
          boardState.lines = Array.isArray(boardState.lines) ? boardState.lines : [];
          const line = { id: generateId(), x1: rulerSession.start.x, y1: rulerSession.start.y, x2: end.x, y2: end.y };
          boardState.lines.push(line);
          selectLine(line.id);
          scheduleBoardPersist();
        }
        rulerSession = null;
        rulerPreview = null;
        scheduleEdgesUpdate();
      };

      const onCancel = (ev) => {
        if (!rulerSession || ev.pointerId !== rulerSession.pointerId) return;
        try {
          boardOverlay.releasePointerCapture(ev.pointerId);
        } catch {}
        boardOverlay.removeEventListener("pointermove", onMove);
        boardOverlay.removeEventListener("pointerup", onUp);
        boardOverlay.removeEventListener("pointercancel", onCancel);
        rulerSession = null;
        rulerPreview = null;
        scheduleEdgesUpdate();
      };

      boardOverlay.addEventListener("pointermove", onMove);
      boardOverlay.addEventListener("pointerup", onUp);
      boardOverlay.addEventListener("pointercancel", onCancel);
      return;
    }

    const v = getViewport();
    boardPanSession = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: v.panX,
      startPanY: v.panY,
      moved: false
    };

    boardOverlay.classList.add("panning");
    boardOverlay.setPointerCapture(e.pointerId);

    const onMove = (ev) => {
      if (!boardPanSession || ev.pointerId !== boardPanSession.pointerId) return;
      const dx = ev.clientX - boardPanSession.startX;
      const dy = ev.clientY - boardPanSession.startY;
      if (Math.abs(dx) + Math.abs(dy) > 3) {
        boardPanSession.moved = true;
      }
      const view = getViewport();
      view.panX = boardPanSession.startPanX + dx;
      view.panY = boardPanSession.startPanY + dy;
      applyViewport();
      scheduleEdgesUpdate();
    };

    const onUp = (ev) => {
      if (!boardPanSession || ev.pointerId !== boardPanSession.pointerId) return;
      boardOverlay.releasePointerCapture(ev.pointerId);
      boardOverlay.classList.remove("panning");
      boardOverlay.removeEventListener("pointermove", onMove);
      boardOverlay.removeEventListener("pointerup", onUp);
      boardOverlay.removeEventListener("pointercancel", onCancel);
      if (!boardPanSession.moved) {
        clearBoardSelection();
      } else {
        scheduleBoardPersist();
      }
      boardPanSession = null;
    };

    const onCancel = (ev) => {
      if (!boardPanSession || ev.pointerId !== boardPanSession.pointerId) return;
      try {
        boardOverlay.releasePointerCapture(ev.pointerId);
      } catch {}
      boardOverlay.classList.remove("panning");
      boardOverlay.removeEventListener("pointermove", onMove);
      boardOverlay.removeEventListener("pointerup", onUp);
      boardOverlay.removeEventListener("pointercancel", onCancel);
      boardPanSession = null;
    };

    boardOverlay.addEventListener("pointermove", onMove);
    boardOverlay.addEventListener("pointerup", onUp);
    boardOverlay.addEventListener("pointercancel", onCancel);
  });

  boardOverlay.addEventListener(
    "wheel",
    (e) => {
      if (boardState.mode !== "board") return;
      e.preventDefault();
      const rect = getOverlayRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const v = getViewport();
      const worldX = (px - v.panX) / v.zoom;
      const worldY = (py - v.panY) / v.zoom;

      const zoomFactor = Math.exp(-e.deltaY * 0.0015);
      const nextZoom = Math.min(1.8, Math.max(0.55, v.zoom * zoomFactor));

      v.zoom = nextZoom;
      v.panX = px - worldX * nextZoom;
      v.panY = py - worldY * nextZoom;
      applyViewport();
      scheduleEdgesUpdate();
      scheduleBoardPersist();
    },
    { passive: false }
  );

  boardOverlay.addEventListener("dblclick", (e) => {
    if (boardState.mode !== "board") return;
    if (e.target.closest(".board-node")) return;
    addNode("card");
  });
}

document.addEventListener("keydown", (event) => {
  if (boardState.mode !== "board") return;
  if (event.ctrlKey || event.metaKey) {
    if (event.key === "0") {
      event.preventDefault();
      resetViewport();
    }
    if (event.key.toLowerCase() === "d" && selectedNodeId) {
      event.preventDefault();
      duplicateSelectedNode();
    }
    if (event.key.toLowerCase() === "g") {
      event.preventDefault();
      setGridEnabled(!boardOverlay?.classList.contains("grid"));
    }
    if (event.key.toLowerCase() === "m") {
      event.preventDefault();
      setPerfModeEnabled(!document.body.classList.contains("perf-mode"));
    }
    if (event.key === "=" || event.key === "+") {
      event.preventDefault();
      const v = getViewport();
      v.zoom = Math.min(1.8, v.zoom * 1.1);
      applyViewport();
      scheduleEdgesUpdate();
      scheduleBoardPersist();
    }
    if (event.key === "-") {
      event.preventDefault();
      const v = getViewport();
      v.zoom = Math.max(0.55, v.zoom / 1.1);
      applyViewport();
      scheduleEdgesUpdate();
      scheduleBoardPersist();
    }
    return;
  }

  if (event.target.closest?.(".node-body")) return;

  if (event.key.toLowerCase() === "c" && selectedNodeId) {
    event.preventDefault();
    startConnectMode();
    return;
  }

  if (selectedNodeId && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
    event.preventDefault();
    const node = getNodeById(selectedNodeId);
    if (!node) return;
    const step = isGridEnabled() ? (event.shiftKey ? 64 : 32) : event.shiftKey ? 24 : 6;
    if (event.key === "ArrowUp") node.y = Math.round(node.y - step);
    if (event.key === "ArrowDown") node.y = Math.round(node.y + step);
    if (event.key === "ArrowLeft") node.x = Math.round(node.x - step);
    if (event.key === "ArrowRight") node.x = Math.round(node.x + step);
    if (isGridEnabled()) {
      node.x = snapToGrid(node.x);
      node.y = snapToGrid(node.y);
    }
    const el = boardNodes?.querySelector(`.board-node[data-id="${node.id}"]`);
    if (el) {
      el.style.left = `${node.x}px`;
      el.style.top = `${node.y}px`;
    }
    scheduleEdgesUpdate();
    scheduleBoardPersist();
    return;
  }

  if (event.key === "Enter" && selectedNodeId) {
    const el = boardNodes?.querySelector(`.board-node[data-id="${selectedNodeId}"] .node-body`);
    if (el) {
      event.preventDefault();
      el.focus();
    }
  }
});

document.addEventListener("keydown", (event) => {
  if (boardState.mode !== "board") return;
  if (event.key !== "Delete" && event.key !== "Backspace") return;
  if (event.target.closest?.(".node-body")) return;
  event.preventDefault();
  if (selectedNodeId) {
    removeNodeAndEdges(selectedNodeId);
    return;
  }
  if (selectedLineId) {
    removeLine(selectedLineId);
  }
});

saveBtn.addEventListener("click", async () => {
  await saveNote();
});

openBtn.addEventListener("click", async () => {
  const result = await window.notesApi.openNote();
  if (!result.ok) return;
  
  fileNameInput.value = result.fileName.replace(/\.txt$/, "");
  lastOpenedName = result.fileName.replace(/\.txt$/, "");
  editor.innerHTML = result.content || "";
  hydrateBoardFromEditor();
  syncBoardUi();
  setStatus(`Abierto`);
  setLastSaved(`Abierto ${formatTimestamp()}`);
  setDirty(false);
  allowDiskAutosave = true;
  localStorage.removeItem(STORAGE_KEYS.draft);
  updateStats();
  refreshNotesList();
  scheduleStatusReset();
});

newBtn.addEventListener("click", () => {
  editor.innerHTML = "";
  fileNameInput.value = "";
  lastOpenedName = "";
  clearBoardState();
  syncBoardUi();
  setStatus("Nueva nota");
  setLastSaved("Sin guardar");
  setDirty(false);
  allowDiskAutosave = false;
  localStorage.removeItem(STORAGE_KEYS.draft);
  updateStats();
  scheduleStatusReset();
});

boldBtn.addEventListener("click", () => {
  document.execCommand("bold");
  editor.focus();
});

italicBtn.addEventListener("click", () => {
  document.execCommand("italic");
  editor.focus();
});

underlineBtn.addEventListener("click", () => {
  document.execCommand("underline");
  editor.focus();
});

printBtn.addEventListener("click", () => {
  window.print();
});

zenBtn.addEventListener("click", () => {
  document.body.classList.toggle("zen-active");
});

sidePanelBtn.addEventListener("click", () => {
  sidePanel.classList.toggle("hidden");
  const prefs = readPrefs() || {};
  writePrefs({ ...prefs, sidePanelHidden: sidePanel.classList.contains("hidden") });
});

soundToggle.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundToggle.textContent = soundEnabled ? "🔊 ON" : "🔇 OFF";
  soundToggle.style.opacity = soundEnabled ? "1" : "0.5";
  const prefs = readPrefs() || {};
  writePrefs({ ...prefs, soundEnabled });
});

editor.addEventListener("input", () => {
  setStatus("Escribiendo...");
  scheduleStatusReset();
  updateStats();
  setDirty(true);
  setLastSaved("Sin guardar");
  scheduleDraftSave();

  if (autosaveTimer) clearTimeout(autosaveTimer);
  if (allowDiskAutosave) {
    autosaveTimer = setTimeout(() => {
      if (!isDirty) return;
      saveNote();
    }, 2000);
  }
});

editor.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  // Play sound for most keys
  if (event.key.length === 1 || event.key === "Enter" || event.key === "Backspace" || event.key === "Space") {
    playKeySound();
  }
});

// Shortcuts
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (isMenuOpen()) {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (document.body.classList.contains("zen-active")) {
      document.body.classList.remove("zen-active");
      setStatus("Zen desactivado");
      scheduleStatusReset();
      return;
    }
    if (boardState.mode === "board") {
      event.preventDefault();
      setBoardMode("text");
      syncBoardUi();
      connectFromId = null;
      scheduleBoardPersist();
      return;
    }
    return;
  }

  const isCommand = event.ctrlKey || event.metaKey;
  if (!isCommand) return;
  
  switch(event.key.toLowerCase()) {
    case "s":
      event.preventDefault();
      if (event.shiftKey) {
        const current = getCurrentNameBase();
        const next = sanitizeName(window.prompt("Guardar como", current || "nota") || "");
        if (next) saveNote(next);
      } else {
        saveNote();
      }
      break;
    case "o":
      event.preventDefault();
      openBtn.click();
      break;
    case "p":
      event.preventDefault();
      printBtn.click();
      break;
    case "n":
      event.preventDefault();
      newBtn.click();
      break;
    // Removed old 'b' case conflict
    case "\\": // Toggle Sidebar with Ctrl+\ 
      event.preventDefault();
      sidePanelBtn.click();
      break;
    case "z": // Toggle Zen (Ctrl+Shift+Z to avoid Undo conflict)
      if (event.shiftKey) {
        event.preventDefault();
        zenBtn.click();
      }
      break;
  }
});

// Init
setInterval(updateClock, 1000);
setInterval(updateSessionTimer, 1000);
setInterval(updateMusicStatus, 5000);
updateClock();
updateStats();
setStatus("Listo");

const prefs = readPrefs() || {};
if (typeof prefs.soundEnabled === "boolean") {
  soundEnabled = prefs.soundEnabled;
}
soundToggle.textContent = soundEnabled ? "🔊 ON" : "🔇 OFF";
soundToggle.style.opacity = soundEnabled ? "1" : "0.5";

if (typeof prefs.defaultStickyColor === "string") {
  defaultStickyColor = normalizeStickyColor(prefs.defaultStickyColor, "yellow");
}

if (typeof prefs.rulerAngleMode === "string") {
  rulerAngleMode =
    prefs.rulerAngleMode === "90" || prefs.rulerAngleMode === "15" || prefs.rulerAngleMode === "free"
      ? prefs.rulerAngleMode
      : "45";
}

if (typeof prefs.boardGridColor === "string") {
  gridColor = normalizeGridColor(prefs.boardGridColor, "black");
  if (boardOverlay) {
    const rgb = GRID_COLORS[gridColor] || GRID_COLORS.black;
    boardOverlay.style.setProperty("--grid-rgb", rgb);
  }
}

if (typeof prefs.sidePanelHidden === "boolean") {
  if (prefs.sidePanelHidden) {
    sidePanel.classList.add("hidden");
  } else {
    sidePanel.classList.remove("hidden");
  }
}

if (typeof prefs.boardGrid === "boolean") {
  setGridEnabled(prefs.boardGrid);
}

if (typeof prefs.boardPerfMode === "boolean") {
  setPerfModeEnabled(prefs.boardPerfMode);
}

syncMenuUi();

const draft = safeJsonParse(localStorage.getItem(STORAGE_KEYS.draft) || "");
if (draft?.html) {
  editor.innerHTML = draft.html;
  if (draft.name) {
    fileNameInput.value = draft.name;
    lastOpenedName = draft.name;
  }
  hydrateBoardFromEditor();
  syncBoardUi();
  setDirty(true);
  allowDiskAutosave = false;
  setStatus("Borrador recuperado");
  setLastSaved("Sin guardar");
  updateStats();
  scheduleStatusReset();
} else {
  hydrateBoardFromEditor();
  syncBoardUi();
}

refreshNotesList();
updateMaximizeButton();

if (refreshNotesBtn) {
  refreshNotesBtn.addEventListener("click", () => {
    refreshNotesList();
  });
}

