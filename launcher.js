/* ============================================================
   Plexter Launcher — launcher.js
   All settings persisted via localStorage under "plexterSettings"
   ============================================================ */

// ── Default settings ──────────────────────────────────────────
const DEFAULTS = {
  username:        'Steve',
  serverAddr:      '',
  renderDist:      8,
  fov:             70,
  sensitivity:     100,
  quality:         'high',
  fullscreen:      false,
  perfMode:        false,
  gameUrl:         'https://eaglercraft.com/mc/1.12.2/',
  accentColor:     '#4caf50',
  keybinds: {
    forward:   'W',
    back:      'S',
    left:      'A',
    right:     'D',
    jump:      'Space',
    sneak:     'Shift',
    sprint:    'Ctrl',
    inventory: 'E',
    drop:      'Q',
    chat:      'T',
  },
};

// ── Load / save helpers ───────────────────────────────────────
function loadSettings() {
  try {
    const raw = localStorage.getItem('plexterSettings');
    if (!raw) return structuredClone(DEFAULTS);
    const saved = JSON.parse(raw);
    // Deep merge so new default keys are always present
    return {
      ...DEFAULTS,
      ...saved,
      keybinds: { ...DEFAULTS.keybinds, ...(saved.keybinds || {}) },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

function saveSettings(s) {
  localStorage.setItem('plexterSettings', JSON.stringify(s));
}

// ── Global state ──────────────────────────────────────────────
let settings = loadSettings();
let listeningBtn = null; // keybind button currently awaiting a key press

// ── DOM refs ──────────────────────────────────────────────────
const launcher        = document.getElementById('launcher');
const gameContainer   = document.getElementById('game-container');
const gameFrame       = document.getElementById('game-frame');
const loadingOverlay  = document.getElementById('loading-overlay');
const progressBar     = document.getElementById('progress-bar');
const loadingStatus   = document.getElementById('loading-status');
const settingsModal   = document.getElementById('settings-modal');
const perfBanner      = document.getElementById('perf-banner');

// Control panel inputs
const usernameEl      = document.getElementById('username');
const serverAddrEl    = document.getElementById('server-addr');
const perfToggleEl    = document.getElementById('perf-toggle');

// Settings modal inputs
const renderDistEl    = document.getElementById('render-dist');
const rdValEl         = document.getElementById('rd-val');
const fovEl           = document.getElementById('fov');
const fovValEl        = document.getElementById('fov-val');
const sensEl          = document.getElementById('sens');
const sensValEl       = document.getElementById('sens-val');
const qualityEl       = document.getElementById('quality-preset');
const fullscreenEl    = document.getElementById('fullscreen-launch');
const gameUrlEl       = document.getElementById('game-url');
const accentColorEl   = document.getElementById('accent-color');
const keybindBtns     = document.querySelectorAll('.keybind-btn');

// ── Apply accent color ────────────────────────────────────────
function applyAccent(color) {
  const root = document.documentElement;
  root.style.setProperty('--accent', color);

  // Derive a darker shade and a glow from the chosen hex
  const r = parseInt(color.slice(1,3), 16);
  const g = parseInt(color.slice(3,5), 16);
  const b = parseInt(color.slice(5,7), 16);
  const dark = `rgb(${Math.max(0,r-40)},${Math.max(0,g-40)},${Math.max(0,b-40)})`;
  const glow = `rgba(${r},${g},${b},0.35)`;
  root.style.setProperty('--accent-dark', dark);
  root.style.setProperty('--accent-glow', glow);
}

// ── Populate UI from settings ─────────────────────────────────
function populateUI() {
  usernameEl.value       = settings.username;
  serverAddrEl.value     = settings.serverAddr;
  perfToggleEl.checked   = settings.perfMode;
  perfBanner.classList.toggle('active', settings.perfMode);

  renderDistEl.value     = settings.renderDist;
  rdValEl.textContent    = settings.renderDist + ' chunks';
  fovEl.value            = settings.fov;
  fovValEl.textContent   = settings.fov + '°';
  sensEl.value           = settings.sensitivity;
  sensValEl.textContent  = settings.sensitivity + '%';
  qualityEl.value        = settings.quality;
  fullscreenEl.checked   = settings.fullscreen;
  gameUrlEl.value        = settings.gameUrl;
  accentColorEl.value    = settings.accentColor;

  applyAccent(settings.accentColor);

  keybindBtns.forEach(btn => {
    const action = btn.dataset.action;
    btn.textContent = settings.keybinds[action] || '?';
  });
}

// ── Read modal inputs → settings object ──────────────────────
function collectModalSettings() {
  settings.renderDist  = parseInt(renderDistEl.value);
  settings.fov         = parseInt(fovEl.value);
  settings.sensitivity = parseInt(sensEl.value);
  settings.quality     = qualityEl.value;
  settings.fullscreen  = fullscreenEl.checked;
  settings.gameUrl     = gameUrlEl.value.trim() || DEFAULTS.gameUrl;
  settings.accentColor = accentColorEl.value;

  keybindBtns.forEach(btn => {
    settings.keybinds[btn.dataset.action] = btn.textContent.trim();
  });
}

// ── Performance mode: override video settings ─────────────────
function applyPerfMode(on) {
  if (!on) return;
  // Clamp render distance to 4, quality to low
  renderDistEl.value    = Math.min(parseInt(renderDistEl.value), 4);
  rdValEl.textContent   = renderDistEl.value + ' chunks';
  qualityEl.value       = 'low';
}

// ── Simulated loading progress ────────────────────────────────
function runLoadingBar(onDone) {
  let pct = 0;
  const steps = [
    { target: 20, msg: 'Fetching WASM bundle…',    delay: 300 },
    { target: 45, msg: 'Compiling shaders…',        delay: 500 },
    { target: 70, msg: 'Initialising renderer…',    delay: 600 },
    { target: 90, msg: 'Loading world chunks…',     delay: 700 },
    { target: 100, msg: 'Almost ready!',            delay: 400 },
  ];

  let i = 0;
  function tick() {
    if (i >= steps.length) {
      setTimeout(onDone, 300);
      return;
    }
    const step = steps[i++];
    pct = step.target;
    progressBar.style.width = pct + '%';
    loadingStatus.textContent = step.msg;
    setTimeout(tick, step.delay);
  }
  tick();
}

// ── Launch game ───────────────────────────────────────────────
function launchGame() {
  // Persist whatever is in the quick-access inputs
  settings.username  = usernameEl.value.trim() || 'Steve';
  settings.serverAddr = serverAddrEl.value.trim();
  saveSettings(settings);

  // Show game container, hide launcher
  launcher.classList.remove('launcher-visible');
  setTimeout(() => { launcher.style.display = 'none'; }, 500);
  gameContainer.classList.remove('hidden');
  loadingOverlay.style.opacity = '1';
  loadingOverlay.style.pointerEvents = 'auto';
  progressBar.style.width = '0%';

  // Build URL — append username & server as query params so
  // EaglercraftX can pick them up if the host supports it
  let url = settings.gameUrl;
  try {
    const u = new URL(url);
    if (settings.username)  u.searchParams.set('username',  settings.username);
    if (settings.serverAddr) u.searchParams.set('server', settings.serverAddr);
    url = u.toString();
  } catch { /* invalid URL, use raw */ }

  gameFrame.src = url;

  // Request fullscreen if configured
  if (settings.fullscreen) {
    gameContainer.requestFullscreen?.().catch(() => {});
  }

  runLoadingBar(() => {
    loadingOverlay.classList.add('done');
    setTimeout(() => { loadingOverlay.style.display = 'none'; }, 450);
  });
}

// ── Return to launcher ────────────────────────────────────────
function returnToLauncher() {
  gameFrame.src = '';
  gameContainer.classList.add('hidden');
  loadingOverlay.classList.remove('done');
  loadingOverlay.style.display = 'flex';
  loadingOverlay.style.opacity = '1';
  loadingOverlay.style.pointerEvents = 'auto';

  launcher.style.display = 'flex';
  requestAnimationFrame(() => launcher.classList.add('launcher-visible'));

  if (document.fullscreenElement) document.exitFullscreen?.();
}

// ── Keybind capture ───────────────────────────────────────────
function startListening(btn) {
  if (listeningBtn) {
    listeningBtn.classList.remove('listening');
    listeningBtn.textContent = settings.keybinds[listeningBtn.dataset.action] || '?';
  }
  listeningBtn = btn;
  btn.classList.add('listening');
  btn.textContent = '…';
}

document.addEventListener('keydown', (e) => {
  if (!listeningBtn) return;
  e.preventDefault();
  let key = e.key;
  // Friendly names
  if (key === ' ')          key = 'Space';
  else if (key === 'Control') key = 'Ctrl';
  else if (key.length === 1) key = key.toUpperCase();

  listeningBtn.textContent = key;
  listeningBtn.classList.remove('listening');
  settings.keybinds[listeningBtn.dataset.action] = key;
  listeningBtn = null;
});

// Close keybind listener on outside click
document.addEventListener('mousedown', (e) => {
  if (listeningBtn && !listeningBtn.contains(e.target)) {
    listeningBtn.textContent = settings.keybinds[listeningBtn.dataset.action] || '?';
    listeningBtn.classList.remove('listening');
    listeningBtn = null;
  }
});

// ── Particle background ───────────────────────────────────────
(function initParticles() {
  const canvas = document.getElementById('bg-canvas');
  const ctx    = canvas.getContext('2d');
  let W, H, particles;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function makeParticle() {
    return {
      x:    Math.random() * W,
      y:    Math.random() * H,
      r:    Math.random() * 1.5 + 0.5,
      vx:   (Math.random() - 0.5) * 0.3,
      vy:  -Math.random() * 0.4 - 0.1,
      alpha: Math.random() * 0.5 + 0.1,
    };
  }

  function init() {
    resize();
    particles = Array.from({ length: 80 }, makeParticle);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(76,175,80,${p.alpha})`;
      ctx.fill();

      p.x += p.vx;
      p.y += p.vy;

      if (p.y < -4 || p.x < -4 || p.x > W + 4) {
        Object.assign(p, makeParticle(), { y: H + 4, x: Math.random() * W });
      }
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  init();
  draw();
})();

// ── Event listeners ───────────────────────────────────────────

// Launch button
document.getElementById('launch-btn').addEventListener('click', launchGame);

// Back to menu
document.getElementById('back-btn').addEventListener('click', returnToLauncher);

// Perf toggle
perfToggleEl.addEventListener('change', () => {
  settings.perfMode = perfToggleEl.checked;
  perfBanner.classList.toggle('active', settings.perfMode);
  saveSettings(settings);
});

// Open settings modal
document.getElementById('settings-btn').addEventListener('click', () => {
  populateUI(); // ensure modal shows current state
  settingsModal.classList.remove('hidden');
});

// Close settings modal
document.getElementById('settings-close').addEventListener('click', () => {
  settingsModal.classList.add('hidden');
  if (listeningBtn) {
    listeningBtn.textContent = settings.keybinds[listeningBtn.dataset.action] || '?';
    listeningBtn.classList.remove('listening');
    listeningBtn = null;
  }
});

// Close modal on backdrop click
settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) document.getElementById('settings-close').click();
});

// Save settings
document.getElementById('settings-save').addEventListener('click', () => {
  collectModalSettings();

  // Persist quick-access fields too
  settings.username   = usernameEl.value.trim() || 'Steve';
  settings.serverAddr = serverAddrEl.value.trim();

  applyPerfMode(settings.perfMode);
  applyAccent(settings.accentColor);
  saveSettings(settings);
  populateUI();
  settingsModal.classList.add('hidden');
});

// Reset to defaults
document.getElementById('settings-reset').addEventListener('click', () => {
  if (!confirm('Reset all settings to defaults?')) return;
  settings = structuredClone(DEFAULTS);
  saveSettings(settings);
  populateUI();
});

// Live slider labels
renderDistEl.addEventListener('input', () => { rdValEl.textContent  = renderDistEl.value + ' chunks'; });
fovEl.addEventListener('input',        () => { fovValEl.textContent  = fovEl.value + '°'; });
sensEl.addEventListener('input',       () => { sensValEl.textContent = sensEl.value + '%'; });

// Perf mode inside modal clamps render distance
document.getElementById('perf-toggle')?.addEventListener?.('change', () => {
  if (perfToggleEl.checked) applyPerfMode(true);
});

// Keybind buttons
keybindBtns.forEach(btn => {
  btn.addEventListener('click', () => startListening(btn));
});

// ── Init ──────────────────────────────────────────────────────
populateUI();

// Fade the launcher in after a brief moment
requestAnimationFrame(() => {
  setTimeout(() => launcher.classList.add('launcher-visible'), 80);
});
