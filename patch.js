/* ============================================================
   Plexter Launcher — patch.js
   Injected into game.html <head> before all game scripts.
   Intercepts the game boot, shows our launcher UI first,
   then calls the real main() when the user hits Launch.
   ============================================================ */
(function () {
  'use strict';

  // ── 1. Intercept main() ─────────────────────────────────────
  // TeaVM assigns main() to global scope. We proxy it so the
  // countdown can fire but the game won't actually boot until
  // the user clicks Launch.
  var _realMain = null;
  var _launchReady = false;

  try {
    Object.defineProperty(window, 'main', {
      configurable: true,
      enumerable: true,
      get: function () {
        return function () {
          if (_launchReady) {
            _realMain && _realMain();
          }
          // else: countdown fired early — we'll call it on Launch
        };
      },
      set: function (fn) { _realMain = fn; }
    });
  } catch (e) { /* strict-mode var — fall back to skip-button method */ }

  // ── 2. Intercept setInterval to freeze the countdown ────────
  var _origSetInterval = window.setInterval;
  var _capturedIds = [];
  window.setInterval = function () {
    var id = _origSetInterval.apply(this, arguments);
    _capturedIds.push(id);
    return id;
  };

  // ── 3. Protect eaglercraftXOpts from being overwritten ──────
  var _opts = { container: 'game_frame', worldsDB: 'worlds' };
  try {
    Object.defineProperty(window, 'eaglercraftXOpts', {
      configurable: true,
      get: function () { return _opts; },
      set: function (v) {
        // Game tries to set it — merge their keys under ours
        if (v) Object.keys(v).forEach(function (k) {
          if (!(k in _opts)) _opts[k] = v[k];
        });
      }
    });
  } catch (e) { window.eaglercraftXOpts = _opts; }

  // ── 4. On page load: freeze countdown, show launcher ────────
  window.addEventListener('load', function () {
    window.setInterval = _origSetInterval;           // restore
    _capturedIds.forEach(function (id) { clearInterval(id); }); // freeze countdown

    var cd = document.getElementById('launch_countdown_screen');
    if (cd) cd.style.display = 'none';

    injectLauncher();
  });

  // ── 5. Public launch trigger (called from our UI) ────────────
  window.plexterLaunch = function (settings) {
    // Apply settings to eaglercraftXOpts before game boots
    if (settings.username)   _opts.defaultUsername = settings.username;
    if (settings.serverAddr) {
      _opts.servers = _opts.servers || [];
      if (!_opts.servers.some(function (s) { return s.addr === settings.serverAddr; }))
        _opts.servers.unshift({ name: 'Quick Connect', addr: settings.serverAddr });
    }
    var q = settings.perfMode ? 'low' : (settings.quality || 'high');
    _opts.fancyGraphics = q !== 'low';
    _opts.renderClouds  = (q === 'high' || q === 'ultra');

    _launchReady = true;

    var overlay = document.getElementById('_plexterOverlay');
    if (overlay) overlay.remove();

    if (_realMain) {
      _realMain();
    } else {
      // Fallback: reveal countdown and skip it
      var cd2 = document.getElementById('launch_countdown_screen');
      if (cd2) cd2.style.display = 'flex';
      var skip = document.getElementById('skipCountdown');
      if (skip) { skip.click(); }
    }

    // Inject the persistent in-game HUD after a short delay
    setTimeout(injectHUD, 800);
  };

  // ── 6b. In-game HUD ───────────────────────────────────────────
  function injectHUD() {
    var hud = document.createElement('div');
    hud.id = '_pxHUD';
    hud.innerHTML = HUD_HTML;
    document.body.appendChild(hud);
    initHUD();
  }

  function initHUD() {
    var btn      = document.getElementById('_px_hudBtn');
    var panel    = document.getElementById('_px_hudPanel');
    var closeBtn = document.getElementById('_px_hudClose');

    btn.addEventListener('click', function() {
      panel.classList.toggle('px-hud-open');
      if (panel.classList.contains('px-hud-open')) hudPopulate();
    });
    closeBtn.addEventListener('click', function() {
      panel.classList.remove('px-hud-open');
    });

    // Close on Esc
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') panel.classList.remove('px-hud-open');
    });

    // Save button inside HUD panel
    document.getElementById('_px_hudSave').addEventListener('click', function() {
      hudCollect();
      saveSettings(settings);
      panel.classList.remove('px-hud-open');
    });

    // Reset
    document.getElementById('_px_hudReset').addEventListener('click', function() {
      if (!confirm('Reset all settings to defaults?')) return;
      settings = JSON.parse(JSON.stringify(DEFAULTS));
      saveSettings(settings);
      hudPopulate();
    });

    // Live slider labels
    document.getElementById('_px_hrd').addEventListener('input',   function() { document.getElementById('_px_hrdVal').textContent  = this.value + ' chunks'; });
    document.getElementById('_px_hfov').addEventListener('input',  function() { document.getElementById('_px_hfovVal').textContent  = this.value + '°'; });
    document.getElementById('_px_hsens').addEventListener('input', function() { document.getElementById('_px_hsensVal').textContent = this.value + '%'; });

    // Perf toggle
    document.getElementById('_px_hperf').addEventListener('change', function() {
      settings.perfMode = this.checked;
      saveSettings(settings);
    });

    // Accent color
    document.getElementById('_px_haccent').addEventListener('input', function() {
      applyAccent(this.value);
    });

    // Keybind buttons in HUD
    document.querySelectorAll('._px_hkbtn').forEach(function(btn2) {
      btn2.addEventListener('click', function() { startListening(btn2); });
    });
  }

  function hudPopulate() {
    document.getElementById('_px_husername').value          = settings.username;
    document.getElementById('_px_hserver').value            = settings.serverAddr;
    document.getElementById('_px_hrd').value                = settings.renderDist;
    document.getElementById('_px_hrdVal').textContent       = settings.renderDist + ' chunks';
    document.getElementById('_px_hfov').value               = settings.fov;
    document.getElementById('_px_hfovVal').textContent      = settings.fov + '°';
    document.getElementById('_px_hsens').value              = settings.sensitivity;
    document.getElementById('_px_hsensVal').textContent     = settings.sensitivity + '%';
    document.getElementById('_px_hquality').value           = settings.quality;
    document.getElementById('_px_hperf').checked            = settings.perfMode;
    document.getElementById('_px_haccent').value            = settings.accentColor;
    document.querySelectorAll('._px_hkbtn').forEach(function(b) {
      b.textContent = settings.keybinds[b.dataset.action] || '?';
    });
  }

  function hudCollect() {
    settings.username    = document.getElementById('_px_husername').value.trim() || 'Steve';
    settings.serverAddr  = document.getElementById('_px_hserver').value.trim();
    settings.renderDist  = parseInt(document.getElementById('_px_hrd').value);
    settings.fov         = parseInt(document.getElementById('_px_hfov').value);
    settings.sensitivity = parseInt(document.getElementById('_px_hsens').value);
    settings.quality     = document.getElementById('_px_hquality').value;
    settings.accentColor = document.getElementById('_px_haccent').value;
    document.querySelectorAll('._px_hkbtn').forEach(function(b) {
      settings.keybinds[b.dataset.action] = b.textContent.trim();
    });
  }

  // ── 6. Inject launcher UI ─────────────────────────────────────
  function injectLauncher() {
    var el = document.createElement('div');
    el.id = '_plexterOverlay';
    el.innerHTML = LAUNCHER_HTML;
    document.body.appendChild(el);

    var st = document.createElement('style');
    st.textContent = LAUNCHER_CSS;
    document.head.appendChild(st);

    initUI();
  }

  // ── 7. Settings ───────────────────────────────────────────────
  var KEY = 'plexterSettings_v2';
  var DEFAULTS = {
    username: 'Steve', serverAddr: '', renderDist: 8, fov: 70,
    sensitivity: 100, quality: 'high', fullscreen: false, perfMode: false,
    accentColor: '#4caf50',
    keybinds: { forward:'W', back:'S', left:'A', right:'D', jump:'Space',
                sneak:'Shift', sprint:'Ctrl', inventory:'E', drop:'Q', chat:'T' }
  };

  function loadSettings() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULTS));
      var s = JSON.parse(raw);
      return Object.assign({}, DEFAULTS, s, { keybinds: Object.assign({}, DEFAULTS.keybinds, s.keybinds || {}) });
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULTS)); }
  }
  function saveSettings(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

  // ── 8. UI logic ───────────────────────────────────────────────
  var settings, listeningBtn = null;

  function applyAccent(color) {
    var r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16);
    var root = document.documentElement;
    root.style.setProperty('--px-accent', color);
    root.style.setProperty('--px-accent-dark', 'rgb('+(r-40)+','+(g-40)+','+(b-40)+')');
    root.style.setProperty('--px-accent-glow', 'rgba('+r+','+g+','+b+',.35)');
  }

  function $(id) { return document.getElementById(id); }

  function populateUI() {
    $('_px_username').value    = settings.username;
    $('_px_server').value      = settings.serverAddr;
    $('_px_perf').checked      = settings.perfMode;
    $('_px_perfBanner').classList.toggle('px-active', settings.perfMode);
    $('_px_rd').value          = settings.renderDist;
    $('_px_rdVal').textContent = settings.renderDist + ' chunks';
    $('_px_fov').value         = settings.fov;
    $('_px_fovVal').textContent= settings.fov + '°';
    $('_px_sens').value        = settings.sensitivity;
    $('_px_sensVal').textContent=settings.sensitivity + '%';
    $('_px_quality').value     = settings.quality;
    $('_px_fs').checked        = settings.fullscreen;
    $('_px_accent').value      = settings.accentColor;
    applyAccent(settings.accentColor);
    document.querySelectorAll('._px_kbtn').forEach(function(b) {
      b.textContent = settings.keybinds[b.dataset.action] || '?';
    });
  }

  function collectModal() {
    settings.renderDist  = parseInt($('_px_rd').value);
    settings.fov         = parseInt($('_px_fov').value);
    settings.sensitivity = parseInt($('_px_sens').value);
    settings.quality     = $('_px_quality').value;
    settings.fullscreen  = $('_px_fs').checked;
    settings.accentColor = $('_px_accent').value;
    document.querySelectorAll('._px_kbtn').forEach(function(b) {
      settings.keybinds[b.dataset.action] = b.textContent.trim();
    });
  }

  function startListening(btn) {
    if (listeningBtn) {
      listeningBtn.classList.remove('px-listening');
      listeningBtn.textContent = settings.keybinds[listeningBtn.dataset.action] || '?';
    }
    listeningBtn = btn;
    btn.classList.add('px-listening');
    btn.textContent = '…';
  }

  function initParticles() {
    var canvas = $('_px_canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var W, H, particles;
    function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
    function mkP() { return { x: Math.random()*W, y: Math.random()*H, r: Math.random()*1.5+.5, vx:(Math.random()-.5)*.3, vy:-Math.random()*.4-.1, a:Math.random()*.5+.1 }; }
    function draw() {
      ctx.clearRect(0,0,W,H);
      particles.forEach(function(p) {
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.fillStyle='rgba(76,175,80,'+p.a+')'; ctx.fill();
        p.x+=p.vx; p.y+=p.vy;
        if (p.y<-4||p.x<-4||p.x>W+4) Object.assign(p,mkP(),{y:H+4,x:Math.random()*W});
      });
      requestAnimationFrame(draw);
    }
    window.addEventListener('resize', resize);
    resize();
    particles = Array.from({length:80},mkP);
    draw();
  }

  function initUI() {
    settings = loadSettings();
    populateUI();
    initParticles();

    // Fade in
    setTimeout(function() {
      var o = $('_plexterOverlay');
      if (o) o.classList.add('px-visible');
    }, 60);

    // Launch
    $('_px_launchBtn').addEventListener('click', function() {
      settings.username   = $('_px_username').value.trim() || 'Steve';
      settings.serverAddr = $('_px_server').value.trim();
      if (settings.perfMode) { settings.renderDist = Math.min(settings.renderDist, 4); settings.quality = 'low'; }
      saveSettings(settings);
      if (settings.fullscreen) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
      window.plexterLaunch(settings);
    });

    // Perf toggle
    $('_px_perf').addEventListener('change', function() {
      settings.perfMode = this.checked;
      $('_px_perfBanner').classList.toggle('px-active', settings.perfMode);
      saveSettings(settings);
    });

    // Settings open/close
    $('_px_settingsBtn').addEventListener('click', function() { populateUI(); $('_px_modal').classList.remove('px-hidden'); });
    $('_px_closeModal').addEventListener('click',  function() { $('_px_modal').classList.add('px-hidden'); });
    $('_px_modal').addEventListener('click', function(e) { if (e.target===$('_px_modal')) $('_px_closeModal').click(); });

    // Save settings
    $('_px_saveSettings').addEventListener('click', function() {
      collectModal();
      settings.username   = $('_px_username').value.trim() || 'Steve';
      settings.serverAddr = $('_px_server').value.trim();
      applyAccent(settings.accentColor);
      saveSettings(settings);
      populateUI();
      $('_px_modal').classList.add('px-hidden');
    });

    // Reset
    $('_px_resetSettings').addEventListener('click', function() {
      if (!confirm('Reset all settings to defaults?')) return;
      settings = JSON.parse(JSON.stringify(DEFAULTS));
      saveSettings(settings);
      populateUI();
    });

    // Sliders
    $('_px_rd').addEventListener('input',   function() { $('_px_rdVal').textContent  = this.value+' chunks'; });
    $('_px_fov').addEventListener('input',  function() { $('_px_fovVal').textContent  = this.value+'°'; });
    $('_px_sens').addEventListener('input', function() { $('_px_sensVal').textContent = this.value+'%'; });

    // Keybinds
    document.querySelectorAll('._px_kbtn').forEach(function(btn) {
      btn.addEventListener('click', function() { startListening(btn); });
    });

    document.addEventListener('keydown', function(e) {
      if (!listeningBtn) return;
      e.preventDefault();
      var key = e.key === ' ' ? 'Space' : e.key === 'Control' ? 'Ctrl' : e.key.length === 1 ? e.key.toUpperCase() : e.key;
      listeningBtn.textContent = key;
      listeningBtn.classList.remove('px-listening');
      settings.keybinds[listeningBtn.dataset.action] = key;
      listeningBtn = null;
    });
    document.addEventListener('mousedown', function(e) {
      if (listeningBtn && !listeningBtn.contains(e.target)) {
        listeningBtn.textContent = settings.keybinds[listeningBtn.dataset.action] || '?';
        listeningBtn.classList.remove('px-listening');
        listeningBtn = null;
      }
    });
  }

  // ── HTML ──────────────────────────────────────────────────────
  var LAUNCHER_HTML = '<canvas id="_px_canvas" style="position:fixed;inset:0;z-index:0;pointer-events:none"></canvas>'
  + '<div class="px-shell">'
  +   '<header class="px-header">'
  +     '<div class="px-logo"><span style="font-size:1.8rem">⛏</span> Plexter<span class="px-accent">Launcher</span></div>'
  +     '<span class="px-badge">EaglercraftX 1.12</span>'
  +   '</header>'
  +   '<main class="px-main">'
  +     '<section class="px-art">'
  +       '<div class="px-scene">'
  +         '<div class="px-cloud px-c1"></div><div class="px-cloud px-c2"></div><div class="px-cloud px-c3"></div>'
  +         '<div class="px-ground">'
  +           '<div class="px-block"></div><div class="px-block"></div><div class="px-block" style="margin-top:-14px"></div><div class="px-block"></div><div class="px-block"></div>'
  +         '</div>'
  +       '</div>'
  +       '<div class="px-tagline">Play anywhere.<br>No Java required.</div>'
  +     '</section>'
  +     '<section class="px-ctrl">'
  +       '<div class="px-field"><label>Username</label><input id="_px_username" type="text" maxlength="16" autocomplete="off" placeholder="Steve"/></div>'
  +       '<div class="px-field"><label>Server Address</label><input id="_px_server" type="text" autocomplete="off" placeholder="wss://example.com:8081"/></div>'
  +       '<div class="px-perf-banner" id="_px_perfBanner">'
  +         '<div style="display:flex;gap:12px;align-items:flex-start"><span style="font-size:1.4rem;line-height:1">⚡</span>'
  +         '<div><strong>Performance Mode</strong><p>Reduces render distance, particles, and entity load for smoother play on low-end hardware.</p></div></div>'
  +         '<label class="px-toggle"><input type="checkbox" id="_px_perf"><span class="px-slider"></span></label>'
  +       '</div>'
  +       '<div class="px-actions">'
  +         '<button id="_px_settingsBtn" class="px-btn px-btn-sec">⚙ Settings</button>'
  +         '<button id="_px_launchBtn" class="px-btn px-btn-pri">▶ Launch Game</button>'
  +       '</div>'
  +     '</section>'
  +   '</main>'
  +   '<footer class="px-footer"><span>Plexter Launcher — EaglercraftX 1.12 WASM</span><span>Not affiliated with Mojang</span></footer>'
  + '</div>'
  + '<div id="_px_modal" class="px-modal px-hidden">'
  +   '<div class="px-mbox">'
  +     '<div class="px-mhdr"><h2>Settings</h2><button id="_px_closeModal" class="px-mclose">&times;</button></div>'
  +     '<div class="px-mbody">'
  +       '<div class="px-msec"><h3>Video</h3>'
  +         '<div class="px-srow"><label>Render Distance <span class="px-val" id="_px_rdVal"></span></label><input type="range" id="_px_rd" min="2" max="16" step="1"/></div>'
  +         '<div class="px-srow"><label>FOV <span class="px-val" id="_px_fovVal"></span></label><input type="range" id="_px_fov" min="30" max="110" step="1"/></div>'
  +         '<div class="px-srow"><label>Quality Preset</label><select id="_px_quality"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="ultra">Ultra</option></select></div>'
  +         '<div class="px-srow"><label>Fullscreen on Launch</label><label class="px-toggle"><input type="checkbox" id="_px_fs"><span class="px-slider"></span></label></div>'
  +       '</div>'
  +       '<div class="px-msec"><h3>Controls</h3>'
  +         '<div class="px-srow"><label>Mouse Sensitivity <span class="px-val" id="_px_sensVal"></span></label><input type="range" id="_px_sens" min="1" max="200" step="1"/></div>'
  +         '<div class="px-kgrid">'
  +           ['forward:Move Forward','back:Move Back','left:Move Left','right:Move Right',
  +            'jump:Jump','sneak:Sneak','sprint:Sprint','inventory:Inventory','drop:Drop Item','chat:Chat']
  +           .map(function(s){var p=s.split(':');return '<div class="px-krow"><span>'+p[1]+'</span><button class="_px_kbtn" data-action="'+p[0]+'"></button></div>';}).join('')
  +         '</div>'
  +       '</div>'
  +       '<div class="px-msec"><h3>Theme</h3>'
  +         '<div class="px-srow"><label>Accent Color</label><input type="color" id="_px_accent"/></div>'
  +       '</div>'
  +     '</div>'
  +     '<div class="px-mftr"><button id="_px_resetSettings" class="px-btn px-btn-ghost">Reset Defaults</button><button id="_px_saveSettings" class="px-btn px-btn-pri">Save Settings</button></div>'
  +   '</div>'
  + '</div>';

  // ── CSS ───────────────────────────────────────────────────────
  var LAUNCHER_CSS = [
    ':root{--px-accent:#4caf50;--px-accent-dark:#388e3c;--px-accent-glow:rgba(76,175,80,.35)}',
    '#_plexterOverlay{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;opacity:0;transition:opacity .5s}',
    '#_plexterOverlay.px-visible{opacity:1}',
    '.px-shell{position:relative;z-index:10;display:flex;flex-direction:column;height:100vh;font-family:Segoe UI,system-ui,sans-serif;color:#e8f5e9}',
    '.px-header{display:flex;align-items:center;justify-content:space-between;padding:18px 32px;background:rgba(13,15,13,.88);backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,.07)}',
    '.px-logo{font-size:1.5rem;font-weight:700;display:flex;align-items:center;gap:10px}',
    '.px-accent{color:var(--px-accent)}',
    '.px-badge{font-size:.75rem;font-weight:600;background:#1c231c;border:1px solid rgba(255,255,255,.07);border-radius:999px;padding:4px 12px;color:#7a9e7e;letter-spacing:.5px}',
    '.px-main{display:flex;flex:1;overflow:hidden}',
    '.px-art{flex:1;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:40px;background:linear-gradient(180deg,#0a1a2e 0%,#0d2b1a 60%,#0d0f0d 100%);overflow:hidden}',
    '.px-art::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 50% 30%,rgba(76,175,80,.08),transparent 70%)}',
    '.px-cloud{position:absolute;background:rgba(255,255,255,.06);border-radius:50px;filter:blur(2px)}',
    '.px-cloud::before,.px-cloud::after{content:"";position:absolute;background:inherit;border-radius:50%}',
    '.px-c1{width:160px;height:40px;top:15%;left:10%;animation:px-drift 28s linear infinite}',
    '.px-c1::before{width:70px;height:60px;top:-30px;left:20px}.px-c1::after{width:50px;height:50px;top:-20px;right:20px}',
    '.px-c2{width:220px;height:50px;top:28%;left:45%;animation:px-drift 36s linear infinite reverse}',
    '.px-c2::before{width:90px;height:70px;top:-35px;left:30px}.px-c2::after{width:60px;height:55px;top:-25px;right:25px}',
    '.px-c3{width:130px;height:35px;top:10%;right:8%;animation:px-drift 22s linear infinite}',
    '.px-c3::before{width:55px;height:50px;top:-25px;left:15px}.px-c3::after{width:40px;height:42px;top:-18px;right:15px}',
    '@keyframes px-drift{from{transform:translateX(-60px)}to{transform:translateX(60px)}}',
    '.px-scene{position:absolute;bottom:60px;left:50%;transform:translateX(-50%)}',
    '.px-ground{display:flex;gap:4px}',
    '.px-block{width:52px;height:52px;background:linear-gradient(180deg,#5a8a3a 30%,#6b4226 30%);border:2px solid rgba(0,0,0,.4);border-radius:3px;box-shadow:inset 0 0 0 2px rgba(255,255,255,.06),0 4px 12px rgba(0,0,0,.5);animation:px-bob 4s ease-in-out infinite}',
    '.px-block:nth-child(2){animation-delay:.2s}.px-block:nth-child(3){animation-delay:.4s}.px-block:nth-child(4){animation-delay:.6s}.px-block:nth-child(5){animation-delay:.8s}',
    '@keyframes px-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}',
    '.px-tagline{position:relative;font-size:1.1rem;color:#7a9e7e;text-align:center;line-height:1.6}',
    '.px-ctrl{width:380px;flex-shrink:0;display:flex;flex-direction:column;gap:16px;padding:32px 28px;background:rgba(13,15,13,.92);backdrop-filter:blur(16px);border-left:1px solid rgba(255,255,255,.07);overflow-y:auto;justify-content:center}',
    '.px-field{display:flex;flex-direction:column;gap:6px}',
    '.px-field label{font-size:.78rem;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:#7a9e7e}',
    '.px-field input{padding:10px 14px;background:#1c231c;border:1px solid rgba(255,255,255,.07);border-radius:10px;color:#e8f5e9;font-size:.95rem;font-family:inherit;outline:none;transition:border-color .2s,box-shadow .2s}',
    '.px-field input:focus{border-color:var(--px-accent);box-shadow:0 0 0 3px var(--px-accent-glow)}',
    '.px-perf-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;background:#1c231c;border:1px solid rgba(255,255,255,.07);border-radius:10px;transition:border-color .3s,box-shadow .3s}',
    '.px-perf-banner p{font-size:.72rem;color:#7a9e7e;line-height:1.4;margin-top:2px}',
    '.px-perf-banner strong{font-size:.9rem}',
    '.px-active{border-color:var(--px-accent)!important;box-shadow:0 0 0 2px var(--px-accent-glow)!important}',
    '.px-toggle{position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0;cursor:pointer}',
    '.px-toggle input{opacity:0;width:0;height:0}',
    '.px-slider{position:absolute;inset:0;background:#151a15;border:1px solid rgba(255,255,255,.07);border-radius:24px;transition:background .25s}',
    '.px-slider::before{content:"";position:absolute;width:16px;height:16px;left:3px;top:3px;background:#7a9e7e;border-radius:50%;transition:transform .25s,background .25s}',
    '.px-toggle input:checked+.px-slider{background:var(--px-accent-dark);border-color:var(--px-accent)}',
    '.px-toggle input:checked+.px-slider::before{transform:translateX(20px);background:var(--px-accent)}',
    '.px-actions{display:flex;gap:10px;margin-top:4px}',
    '.px-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:11px 18px;border:none;border-radius:10px;font-family:inherit;font-size:.9rem;font-weight:600;cursor:pointer;transition:background .2s,transform .1s,box-shadow .2s;white-space:nowrap}',
    '.px-btn:active{transform:scale(.97)}',
    '.px-btn-pri{flex:1;background:var(--px-accent);color:#000;box-shadow:0 0 16px var(--px-accent-glow)}',
    '.px-btn-pri:hover{background:#66bb6a;box-shadow:0 0 24px var(--px-accent-glow)}',
    '.px-btn-sec{background:#1c231c;color:#e8f5e9;border:1px solid rgba(255,255,255,.07)}',
    '.px-btn-sec:hover{background:#232c23}',
    '.px-btn-ghost{background:transparent;color:#7a9e7e;border:1px solid rgba(255,255,255,.07)}',
    '.px-btn-ghost:hover{background:#1c231c;color:#e8f5e9}',
    '.px-footer{display:flex;justify-content:space-between;padding:10px 32px;font-size:.72rem;color:#7a9e7e;background:rgba(13,15,13,.88);border-top:1px solid rgba(255,255,255,.07)}',
    '.px-modal{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.65);backdrop-filter:blur(4px)}',
    '.px-hidden{display:none!important}',
    '.px-mbox{width:min(680px,95vw);max-height:88vh;display:flex;flex-direction:column;background:#151a15;border:1px solid rgba(255,255,255,.07);border-radius:14px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.7);animation:px-up .25s ease}',
    '@keyframes px-up{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}',
    '.px-mhdr{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid rgba(255,255,255,.07)}',
    '.px-mhdr h2{font-size:1.1rem;color:#e8f5e9;margin:0}',
    '.px-mclose{background:none;border:none;color:#7a9e7e;font-size:1.6rem;cursor:pointer;line-height:1;padding:0 4px;transition:color .2s}',
    '.px-mclose:hover{color:#e8f5e9}',
    '.px-mbody{flex:1;overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:28px}',
    '.px-mftr{display:flex;justify-content:flex-end;gap:10px;padding:16px 24px;border-top:1px solid rgba(255,255,255,.07)}',
    '.px-msec h3{font-size:.75rem;text-transform:uppercase;letter-spacing:1px;color:#7a9e7e;margin:0 0 14px}',
    '.px-srow{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.07)}',
    '.px-srow:last-child{border-bottom:none}',
    '.px-srow label{font-size:.88rem;color:#e8f5e9;display:flex;align-items:center;gap:8px;flex:1}',
    '.px-val{font-size:.8rem;color:var(--px-accent);font-weight:600;min-width:36px;text-align:right}',
    'input[type=range]{-webkit-appearance:none;appearance:none;width:160px;height:4px;background:#1c231c;border-radius:4px;outline:none;cursor:pointer}',
    'input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:var(--px-accent);box-shadow:0 0 6px var(--px-accent-glow);cursor:pointer}',
    'select{padding:7px 12px;background:#1c231c;border:1px solid rgba(255,255,255,.07);border-radius:10px;color:#e8f5e9;font-family:inherit;font-size:.88rem;cursor:pointer;outline:none}',
    'input[type=color]{-webkit-appearance:none;appearance:none;width:44px;height:32px;border:1px solid rgba(255,255,255,.07);border-radius:6px;padding:2px;background:#1c231c;cursor:pointer}',
    '.px-kgrid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}',
    '.px-krow{display:flex;align-items:center;justify-content:space-between;padding:7px 10px;background:#1c231c;border:1px solid rgba(255,255,255,.07);border-radius:6px;gap:8px}',
    '.px-krow span{font-size:.82rem;color:#e8f5e9;flex:1}',
    '._px_kbtn{min-width:52px;padding:4px 8px;background:#151a15;border:1px solid rgba(255,255,255,.07);border-radius:5px;color:var(--px-accent);font-family:inherit;font-size:.78rem;font-weight:600;cursor:pointer;text-align:center;text-transform:uppercase;transition:background .15s}',
    '._px_kbtn:hover{background:#1c231c}',
    '._px_kbtn.px-listening{border-color:var(--px-accent);background:var(--px-accent-glow);color:#e8f5e9;animation:px-pulse .8s ease infinite alternate}',
    '@keyframes px-pulse{from{opacity:.7}to{opacity:1}}',
    '@media(max-width:700px){.px-art{display:none}.px-ctrl{width:100%;border-left:none;padding:24px 20px;justify-content:flex-start;padding-top:32px}.px-header{padding:14px 20px}.px-kgrid{grid-template-columns:1fr}input[type=range]{width:130px}}',
    // ── In-game HUD styles ──
    '#_pxHUD{position:fixed;top:12px;left:12px;z-index:99999;font-family:Segoe UI,system-ui,sans-serif}',
    '#_px_hudBtn{display:flex;align-items:center;gap:7px;padding:6px 13px;background:rgba(13,20,13,.75);border:1px solid rgba(76,175,80,.35);border-radius:8px;color:#e8f5e9;font-size:.8rem;font-weight:700;cursor:pointer;backdrop-filter:blur(8px);transition:opacity .2s,background .2s,border-color .2s;opacity:.45;letter-spacing:.3px;user-select:none}',
    '#_px_hudBtn:hover{opacity:1;background:rgba(13,20,13,.92);border-color:var(--px-accent)}',
    '#_px_hudBtn .px-hico{font-size:1rem}',
    '#_px_hudPanel{position:fixed;top:0;left:0;bottom:0;width:340px;background:#0f150f;border-right:1px solid rgba(255,255,255,.08);display:flex;flex-direction:column;transform:translateX(-110%);transition:transform .3s cubic-bezier(.4,0,.2,1);z-index:99998;box-shadow:4px 0 32px rgba(0,0,0,.7)}',
    '#_px_hudPanel.px-hud-open{transform:translateX(0)}',
    '.px-hud-header{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid rgba(255,255,255,.07)}',
    '.px-hud-logo{font-size:1.1rem;font-weight:700;color:#e8f5e9}',
    '.px-hud-logo span{color:var(--px-accent)}',
    '.px-hud-close{background:none;border:none;color:#7a9e7e;font-size:1.4rem;cursor:pointer;line-height:1;padding:0 4px;transition:color .2s}',
    '.px-hud-close:hover{color:#e8f5e9}',
    '.px-hud-body{flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:20px}',
    '.px-hud-section{display:flex;flex-direction:column;gap:2px}',
    '.px-hud-section h4{font-size:.68rem;text-transform:uppercase;letter-spacing:1px;color:#7a9e7e;margin:0 0 10px}',
    '.px-hud-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.05)}',
    '.px-hud-row:last-child{border-bottom:none}',
    '.px-hud-row label{font-size:.82rem;color:#e8f5e9;display:flex;align-items:center;gap:6px;flex:1}',
    '.px-hud-row input[type=text]{flex:1;padding:6px 10px;background:#1a221a;border:1px solid rgba(255,255,255,.07);border-radius:7px;color:#e8f5e9;font-size:.82rem;font-family:inherit;outline:none}',
    '.px-hud-row input[type=text]:focus{border-color:var(--px-accent)}',
    '.px-hud-row input[type=range]{width:120px}',
    '.px-hud-row select{padding:5px 8px;background:#1a221a;border:1px solid rgba(255,255,255,.07);border-radius:7px;color:#e8f5e9;font-family:inherit;font-size:.82rem;cursor:pointer;outline:none}',
    '.px-hud-row input[type=color]{width:36px;height:26px;border:1px solid rgba(255,255,255,.07);border-radius:5px;padding:1px;background:#1a221a;cursor:pointer}',
    '.px-hud-val{font-size:.75rem;color:var(--px-accent);font-weight:600;min-width:52px;text-align:right}',
    '.px-hud-kgrid{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:4px}',
    '.px-hud-krow{display:flex;align-items:center;justify-content:space-between;padding:5px 8px;background:#1a221a;border:1px solid rgba(255,255,255,.06);border-radius:5px;gap:6px}',
    '.px-hud-krow span{font-size:.75rem;color:#e8f5e9;flex:1}',
    '._px_hkbtn{min-width:44px;padding:3px 6px;background:#0f150f;border:1px solid rgba(255,255,255,.07);border-radius:4px;color:var(--px-accent);font-family:inherit;font-size:.72rem;font-weight:600;cursor:pointer;text-align:center;text-transform:uppercase;transition:background .15s}',
    '._px_hkbtn.px-listening{border-color:var(--px-accent);background:var(--px-accent-glow);color:#e8f5e9;animation:px-pulse .8s ease infinite alternate}',
    '.px-hud-note{font-size:.7rem;color:#7a9e7e;padding:6px 0;line-height:1.4}',
    '.px-hud-footer{display:flex;gap:8px;padding:14px 20px;border-top:1px solid rgba(255,255,255,.07)}'
  ].join('');

  // ── HUD HTML ──────────────────────────────────────────────────
  var kbActions = ['forward:Forward','back:Back','left:Left','right:Right','jump:Jump','sneak:Sneak','sprint:Sprint','inventory:Inventory','drop:Drop','chat:Chat'];

  var HUD_HTML =
    '<button id="_px_hudBtn"><span class="px-hico">⛏</span> Plexter</button>'
  + '<div id="_px_hudPanel">'
  +   '<div class="px-hud-header">'
  +     '<div class="px-hud-logo">⛏ Plexter<span>Launcher</span></div>'
  +     '<button id="_px_hudClose" class="px-hud-close">&times;</button>'
  +   '</div>'
  +   '<div class="px-hud-body">'
  +     '<div class="px-hud-section"><h4>Profile</h4>'
  +       '<div class="px-hud-row"><label>Username</label><input type="text" id="_px_husername" maxlength="16" autocomplete="off"/></div>'
  +       '<div class="px-hud-row"><label>Server</label><input type="text" id="_px_hserver" autocomplete="off" placeholder="wss://…"/></div>'
  +       '<p class="px-hud-note">⚠ Profile changes take effect on next launch.</p>'
  +     '</div>'
  +     '<div class="px-hud-section"><h4>Video</h4>'
  +       '<div class="px-hud-row"><label>Render Distance <span class="px-hud-val" id="_px_hrdVal"></span></label><input type="range" id="_px_hrd" min="2" max="16" step="1"/></div>'
  +       '<div class="px-hud-row"><label>FOV <span class="px-hud-val" id="_px_hfovVal"></span></label><input type="range" id="_px_hfov" min="30" max="110" step="1"/></div>'
  +       '<div class="px-hud-row"><label>Quality</label><select id="_px_hquality"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="ultra">Ultra</option></select></div>'
  +       '<div class="px-hud-row"><label>Performance Mode</label><label class="px-toggle"><input type="checkbox" id="_px_hperf"><span class="px-slider"></span></label></div>'
  +       '<p class="px-hud-note">⚠ Video changes take effect on next launch.</p>'
  +     '</div>'
  +     '<div class="px-hud-section"><h4>Controls</h4>'
  +       '<div class="px-hud-row"><label>Mouse Sensitivity <span class="px-hud-val" id="_px_hsensVal"></span></label><input type="range" id="_px_hsens" min="1" max="200" step="1"/></div>'
  +       '<div class="px-hud-kgrid">'
  +         kbActions.map(function(s){var p=s.split(':');return '<div class="px-hud-krow"><span>'+p[1]+'</span><button class="_px_hkbtn" data-action="'+p[0]+'"></button></div>';}).join('')
  +       '</div>'
  +     '</div>'
  +     '<div class="px-hud-section"><h4>Theme</h4>'
  +       '<div class="px-hud-row"><label>Accent Color</label><input type="color" id="_px_haccent"/></div>'
  +     '</div>'
  +   '</div>'
  +   '<div class="px-hud-footer">'
  +     '<button id="_px_hudReset" class="px-btn px-btn-ghost" style="font-size:.8rem;padding:8px 12px">Reset</button>'
  +     '<button id="_px_hudSave" class="px-btn px-btn-pri" style="flex:1;font-size:.85rem;padding:9px 14px">Save &amp; Close</button>'
  +   '</div>'
  + '</div>';

})();
