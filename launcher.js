/* ============================================================
   Plexter Launcher — launcher.js
   Settings saved to localStorage under "plexterSettings".
   On launch, navigates to game.html (the EaglercraftX offline
   bundle). patch.js (included in game.html) reads these settings
   and wires them into eaglercraftXOpts before the game boots.
   ============================================================ */

// ── Default settings ──────────────────────────────────────────
const DEFAULTS = {
  username:    'Steve',
  serverAddr:  '',
  renderDist:  8,
  fov:         70,
  sensitivity: 100,
  quality:     'high',
  fullscreen:  false,
  perfMode:    false,
  gameUrl:     'game.html',
  accentColor: '#4caf50',
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
const SETTINGS_KEY = 'plexterSettings_v2'; // bumped to clear old eaglercraft.com URL

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const saved = JSON.parse(raw);
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
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// ── Global state ──────────────────────────────────────────────
let settings = loadSettings();
let listeningBtn = null;

// ── DOM refs ──────────────────────────────────────────────────
const launcher      = document.getElementById('launcher');
const settingsModal = document.getElementById('settings-modal');
const perfBanner    = document.getElementById('perf-banner');

const usernameEl    = document.getElementById('username');
const serverAddrEl  = document.getElementById('server-addr');
const perfToggleEl  = document.getElementById('perf-toggle');

const renderDistEl  = document.getElementById('render-dist');
const rdValEl       = document.getElementById('rd-val');
const fovEl         = document.getElementById('fov');
const fovValEl      = document.getElementById('fov-val');
const sensEl        = document.getElementById('sens');
const sensValEl     = document.getElementById('sens-val');
const qualityEl     = document.getElementById('quality-preset');
const fullscreenEl  = document.getElementById('fullscreen-launch');
const gameUrlEl     = document.getElementById('game-url');
const accentColorEl = document.getElementById('accent-color');
const keybindBtns   = document.querySelectorAll('.keybind-btn');

// ── Apply accent color ────────────────────────────────────────
function applyAccent(color) {
  const root = document.documentElement;
  root.style.setProperty('--accent', color);
  const r = parseInt(color.slice(1,3), 16);
  const g = parseInt(color.slice(3,5), 16);
  const b = parseInt(color.slice(5,7), 16);
  root.style.setProperty('--accent-dark', `rgb(${Math.max(0,r-40)},${Math.max(0,g-40)},${Math.max(0,b-40)})`);
  root.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.35)`);
}

// ── Populate UI from settings ─────────────────────────────────
function populateUI() {
  usernameEl.value     = settings.username;
  serverAddrEl.value   = settings.serverAddr;
  perfToggleEl.checked = settings.perfMode;
  perfBanner.classList.toggle('active', settings.perfMode);

  renderDistEl.value   = settings.renderDist;
  rdValEl.textContent  = settings.renderDist + ' chunks';
  fovEl.value          = settings.fov;
  fovValEl.textContent = settings.fov + '°';
  sensEl.value         = settings.sensitivity;
  sensValEl.textContent= settings.sensitivity + '%';
  qualityEl.value      = settings.quality;
  fullscreenEl.checked = settings.fullscreen;
  gameUrlEl.value      = settings.gameUrl;
  accentColorEl.value  = settings.accentColor;

  applyAccent(settings.accentColor);

  keybindBtns.forEach(btn => {
    btn.textContent = settings.keybinds[btn.dataset.action] || '?';
  });
}

// ── Read modal inputs into settings ──────────────────────────
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

// ── Performance mode ──────────────────────────────────────────
function applyPerfMode(on) {
  if (!on) return;
  settings.renderDist = Math.min(settings.renderDist, 4);
  settings.quality    = 'low';
}

// ── Launch game ───────────────────────────────────────────────
function launchGame() {
  settings.username   = usernameEl.value.trim() || 'Steve';
  settings.serverAddr = serverAddrEl.value.trim();

  if (settings.perfMode) applyPerfMode(true);

  saveSettings(settings);

  const dest = settings.gameUrl || 'game.html';
  window.location.href = dest;
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
  if (key === ' ')           key = 'Space';
  else if (key === 'Control') key = 'Ctrl';
  else if (key.length === 1)  key = key.toUpperCase();
  listeningBtn.textContent = key;
  listeningBtn.classList.remove('listening');
  settings.keybinds[listeningBtn.dataset.action] = key;
  listeningBtn = null;
});

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
      x:     Math.random() * W,
      y:     Math.random() * H,
      r:     Math.random() * 1.5 + 0.5,
      vx:    (Math.random() - 0.5) * 0.3,
      vy:   -Math.random() * 0.4 - 0.1,
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

document.getElementById('launch-btn').addEventListener('click', launchGame);

perfToggleEl.addEventListener('change', () => {
  settings.perfMode = perfToggleEl.checked;
  perfBanner.classList.toggle('active', settings.perfMode);
  saveSettings(settings);
});

document.getElementById('settings-btn').addEventListener('click', () => {
  populateUI();
  settingsModal.classList.remove('hidden');
});

document.getElementById('settings-close').addEventListener('click', () => {
  settingsModal.classList.add('hidden');
  if (listeningBtn) {
    listeningBtn.textContent = settings.keybinds[listeningBtn.dataset.action] || '?';
    listeningBtn.classList.remove('listening');
    listeningBtn = null;
  }
});

settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) document.getElementById('settings-close').click();
});

document.getElementById('settings-save').addEventListener('click', () => {
  collectModalSettings();
  settings.username   = usernameEl.value.trim() || 'Steve';
  settings.serverAddr = serverAddrEl.value.trim();
  applyAccent(settings.accentColor);
  saveSettings(settings);
  populateUI();
  settingsModal.classList.add('hidden');
});

document.getElementById('settings-reset').addEventListener('click', () => {
  if (!confirm('Reset all settings to defaults?')) return;
  settings = structuredClone(DEFAULTS);
  saveSettings(settings);
  populateUI();
});

renderDistEl.addEventListener('input', () => { rdValEl.textContent   = renderDistEl.value + ' chunks'; });
fovEl.addEventListener('input',        () => { fovValEl.textContent   = fovEl.value + '°'; });
sensEl.addEventListener('input',       () => { sensValEl.textContent  = sensEl.value + '%'; });

keybindBtns.forEach(btn => {
  btn.addEventListener('click', () => startListening(btn));
});

// ── Init ──────────────────────────────────────────────────────
populateUI();
requestAnimationFrame(() => setTimeout(() => launcher.classList.add('launcher-visible'), 80));
