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

const STORAGE_KEYS = {
  prefs: "mn:prefs",
  draft: "mn:draft"
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
      isDirty = false;
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

const scheduleDraftSave = () => {
  if (draftTimer) clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
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

const saveNote = async (nameOverride) => {
  const name = sanitizeName(nameOverride ?? fileNameInput.value);
  const resolvedName = name || lastOpenedName || buildAutoName();
  const content = editor.innerHTML;
  const result = await window.notesApi.saveNote(resolvedName, content);
  if (result.ok) {
    fileNameInput.value = result.fileName.replace(/\.txt$/, "");
    lastOpenedName = result.fileName.replace(/\.txt$/, "");
    setStatus(`Guardado`);
    setLastSaved(`Guardado ${formatTimestamp()}`);
    isDirty = false;
    allowDiskAutosave = true;
    localStorage.removeItem(STORAGE_KEYS.draft);
    refreshNotesList();
  } else {
    setStatus("Error al guardar");
  }
  scheduleStatusReset();
};

// --- LISTENERS ---

saveBtn.addEventListener("click", async () => {
  await saveNote();
});

openBtn.addEventListener("click", async () => {
  const result = await window.notesApi.openNote();
  if (!result.ok) return;
  
  fileNameInput.value = result.fileName.replace(/\.txt$/, "");
  lastOpenedName = result.fileName.replace(/\.txt$/, "");
  editor.innerHTML = result.content || "";
  setStatus(`Abierto`);
  setLastSaved(`Abierto ${formatTimestamp()}`);
  isDirty = false;
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
  setStatus("Nueva nota");
  setLastSaved("Sin guardar");
  isDirty = false;
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
  isDirty = true;
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
    if (document.body.classList.contains("zen-active")) {
      document.body.classList.remove("zen-active");
      setStatus("Zen desactivado");
      scheduleStatusReset();
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

if (typeof prefs.sidePanelHidden === "boolean") {
  if (prefs.sidePanelHidden) {
    sidePanel.classList.add("hidden");
  } else {
    sidePanel.classList.remove("hidden");
  }
}

const draft = safeJsonParse(localStorage.getItem(STORAGE_KEYS.draft) || "");
if (draft?.html) {
  editor.innerHTML = draft.html;
  if (draft.name) {
    fileNameInput.value = draft.name;
    lastOpenedName = draft.name;
  }
  isDirty = true;
  allowDiskAutosave = false;
  setStatus("Borrador recuperado");
  setLastSaved("Sin guardar");
  updateStats();
  scheduleStatusReset();
}

refreshNotesList();

if (refreshNotesBtn) {
  refreshNotesBtn.addEventListener("click", () => {
    refreshNotesList();
  });
}

window.addEventListener("beforeunload", (e) => {
  if (!isDirty) return;
  e.preventDefault();
  e.returnValue = "";
});
