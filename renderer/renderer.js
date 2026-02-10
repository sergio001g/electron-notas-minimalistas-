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
const musicStatusEl = document.querySelector(".music-status");
const musicTitleEl = document.querySelector(".music-title");

// State
let autosaveTimer = null;
let lastOpenedName = "";
let audioContext = null;
let lastClickAt = 0;
let soundEnabled = true;
let sessionSeconds = 0;

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

const sanitizeName = (name) => name.trim();

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
  } else {
    setStatus("Error al guardar");
  }
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
  updateStats();
});

newBtn.addEventListener("click", () => {
  editor.innerHTML = "";
  fileNameInput.value = "";
  lastOpenedName = "";
  setStatus("Nueva nota");
  setLastSaved("Sin guardar");
  updateStats();
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
});

soundToggle.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundToggle.textContent = soundEnabled ? "🔊 ON" : "🔇 OFF";
  soundToggle.style.opacity = soundEnabled ? "1" : "0.5";
});

editor.addEventListener("input", () => {
  setStatus("Escribiendo...");
  updateStats();
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
  const isCommand = event.ctrlKey || event.metaKey;
  if (!isCommand) return;
  
  switch(event.key.toLowerCase()) {
    case "s":
      event.preventDefault();
      saveNote();
      break;
    case "o":
      event.preventDefault();
      openBtn.click();
      break;
    case "b":
      // Sidebar uses Ctrl+B by default in this logic if not handled carefully
      // But standard Bold is Ctrl+B. Let's remap Sidebar to Ctrl+Shift+S or something
      // Actually, execCommand('bold') handles Ctrl+B automatically for contenteditable.
      // So we don't need to intercept 'b' unless we want the button visual feedback or specific logic.
      // Let's toggle sidebar with something else or let the user click.
      // Wait, I mapped Sidebar to 'b' in previous step. Let's fix that.
      if (!event.shiftKey) {
        // Allow native Bold behavior
      } else {
        // Ctrl+Shift+B -> Toggle Sidebar? Or just use a different key.
        event.preventDefault();
        sidePanelBtn.click();
      }
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
    case "z": // Toggle Zen (Ctrl+Alt+Z or Ctrl+Shift+Z to avoid Undo conflict)
      if (event.altKey || event.shiftKey) {
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
