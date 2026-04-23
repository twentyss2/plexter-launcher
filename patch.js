/* ============================================================
   Plexter Launcher — patch.js
   Injected into game.html <head> before all game scripts.

   Strategy: show our launcher as a full-page overlay immediately.
   The game boots underneath it. When the user clicks Launch we
   apply what we can (server list via eaglercraftXOpts) and remove
   the overlay. In-game the Plexter HUD stays accessible.
   ============================================================ */
(function () {
  'use strict';

  // ── 1. Settings ───────────────────────────────────────────────
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
      var s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!s) return clone(DEFAULTS);
      return merge(DEFAULTS, s);
    } catch (e) { return clone(DEFAULTS); }
  }
  function saveSettings(s) { localStorage.setItem(KEY, JSON.stringify(s)); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function merge(def, saved) {
    var out = clone(def);
    Object.keys(saved).forEach(function(k) {
      if (k === 'keybinds') out.keybinds = merge(def.keybinds, saved.keybinds);
      else out[k] = saved[k];
    });
    return out;
  }

  var settings = loadSettings();

  // ── 2. Protect eaglercraftXOpts and pre-apply servers ────────
  // eaglercraftXOpts is what the game reads on boot for server list etc.
  var _opts = { container: 'game_frame', worldsDB: 'worlds' };
  applyOptsFromSettings(settings);

  function applyOptsFromSettings(s) {
    if (s.serverAddr) {
      _opts.servers = _opts.servers || [];
      var exists = _opts.servers.some(function(x) { return x.addr === s.serverAddr; });
      if (!exists) _opts.servers.unshift({ name: 'Quick Connect', addr: s.serverAddr });
    }
    var q = s.perfMode ? 'low' : (s.quality || 'high');
    _opts.fancyGraphics = q !== 'low';
    _opts.renderClouds  = (q === 'high' || q === 'ultra');
  }

  try {
    Object.defineProperty(window, 'eaglercraftXOpts', {
      configurable: true,
      get: function () { return _opts; },
      set: function (v) {
        if (v) Object.keys(v).forEach(function (k) {
          if (!(k in _opts)) _opts[k] = v[k];
        });
      }
    });
  } catch (e) { window.eaglercraftXOpts = _opts; }

  // ── 3. Inject overlay as early as possible ────────────────────
  function injectOverlay() {
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    var el = document.createElement('div');
    el.id = '_pxOverlay';
    el.innerHTML = HTML;
    document.body.appendChild(el);

    initLauncher();
  }

  // Run on DOMContentLoaded so body exists, but before game's load handlers
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectOverlay);
  } else {
    injectOverlay();
  }

  // ── 4. Accent color helper ────────────────────────────────────
  function applyAccent(color) {
    var r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16);
    var root = document.documentElement;
    root.style.setProperty('--px-accent', color);
    root.style.setProperty('--px-accent-dark','rgb('+(r-40)+','+(g-40)+','+(b-40)+')');
    root.style.setProperty('--px-accent-glow','rgba('+r+','+g+','+b+',.35)');
  }

  function $(id) { return document.getElementById(id); }

  // ── 5. Keybind listener state ─────────────────────────────────
  var listeningBtn = null;
  function startListening(btn) {
    if (listeningBtn) {
      listeningBtn.classList.remove('px-listening');
      listeningBtn.textContent = settings.keybinds[listeningBtn.dataset.action] || '?';
    }
    listeningBtn = btn;
    btn.classList.add('px-listening');
    btn.textContent = '…';
  }
  document.addEventListener('keydown', function(e) {
    if (!listeningBtn) return;
    e.preventDefault();
    var k = e.key === ' ' ? 'Space' : e.key === 'Control' ? 'Ctrl' : e.key.length === 1 ? e.key.toUpperCase() : e.key;
    listeningBtn.textContent = k;
    listeningBtn.classList.remove('px-listening');
    settings.keybinds[listeningBtn.dataset.action] = k;
    listeningBtn = null;
  });
  document.addEventListener('mousedown', function(e) {
    if (listeningBtn && !listeningBtn.contains(e.target)) {
      listeningBtn.textContent = settings.keybinds[listeningBtn.dataset.action] || '?';
      listeningBtn.classList.remove('px-listening');
      listeningBtn = null;
    }
  });

  // ── 6. Launcher init ──────────────────────────────────────────
  function populateLauncher() {
    $('_px_username').value = settings.username;
    $('_px_server').value   = settings.serverAddr;
    $('_px_perf').checked   = settings.perfMode;
    $('_px_perfBanner').classList.toggle('px-active', settings.perfMode);

    $('_px_rd').value    = settings.renderDist;
    $('_px_rdVal').textContent = settings.renderDist + ' chunks';
    $('_px_fov').value   = settings.fov;
    $('_px_fovVal').textContent = settings.fov + '°';
    $('_px_sens').value  = settings.sensitivity;
    $('_px_sensVal').textContent = settings.sensitivity + '%';
    $('_px_quality').value  = settings.quality;
    $('_px_fs').checked     = settings.fullscreen;
    $('_px_accent').value   = settings.accentColor;
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

  function initParticles() {
    var canvas = $('_px_canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var W, H, pts;
    function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
    function mk() { return {x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.5+.5,vx:(Math.random()-.5)*.3,vy:-Math.random()*.4-.1,a:Math.random()*.5+.1}; }
    function draw() {
      ctx.clearRect(0,0,W,H);
      pts.forEach(function(p){
        ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.fillStyle='rgba(76,175,80,'+p.a+')';ctx.fill();
        p.x+=p.vx;p.y+=p.vy;
        if(p.y<-4||p.x<-4||p.x>W+4) Object.assign(p,mk(),{y:H+4,x:Math.random()*W});
      });
      requestAnimationFrame(draw);
    }
    window.addEventListener('resize', resize);
    resize(); pts=Array.from({length:80},mk); draw();
  }

  function initLauncher() {
    populateLauncher();
    initParticles();

    setTimeout(function() {
      var o = $('_pxOverlay');
      if (o) o.classList.add('px-vis');
    }, 60);

    // ── Launch button ──
    $('_px_launchBtn').addEventListener('click', function() {
      settings.username   = $('_px_username').value.trim() || 'Steve';
      settings.serverAddr = $('_px_server').value.trim();
      if (settings.perfMode) { settings.renderDist = Math.min(settings.renderDist, 4); settings.quality = 'low'; }
      applyOptsFromSettings(settings);
      saveSettings(settings);
      if (settings.fullscreen) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();

      // Remove launcher overlay — game is already running beneath it
      var o = $('_pxOverlay');
      if (o) { o.style.opacity='0'; setTimeout(function(){ o.remove(); }, 500); }

      // Inject in-game HUD
      setTimeout(injectHUD, 600);
    });

    // ── Perf toggle ──
    $('_px_perf').addEventListener('change', function() {
      settings.perfMode = this.checked;
      $('_px_perfBanner').classList.toggle('px-active', settings.perfMode);
      saveSettings(settings);
    });

    // ── Settings modal ──
    $('_px_settingsBtn').addEventListener('click', function() { populateLauncher(); $('_px_modal').classList.remove('px-hid'); });
    $('_px_closeModal').addEventListener('click', function() { $('_px_modal').classList.add('px-hid'); });
    $('_px_modal').addEventListener('click', function(e) { if (e.target===$('_px_modal')) $('_px_closeModal').click(); });

    $('_px_saveSettings').addEventListener('click', function() {
      collectModal();
      settings.username   = $('_px_username').value.trim() || 'Steve';
      settings.serverAddr = $('_px_server').value.trim();
      applyAccent(settings.accentColor);
      saveSettings(settings);
      populateLauncher();
      $('_px_modal').classList.add('px-hid');
    });

    $('_px_resetSettings').addEventListener('click', function() {
      if (!confirm('Reset all settings to defaults?')) return;
      settings = clone(DEFAULTS);
      saveSettings(settings);
      populateLauncher();
    });

    $('_px_rd').addEventListener('input',   function(){ $('_px_rdVal').textContent  = this.value+' chunks'; });
    $('_px_fov').addEventListener('input',  function(){ $('_px_fovVal').textContent  = this.value+'°'; });
    $('_px_sens').addEventListener('input', function(){ $('_px_sensVal').textContent = this.value+'%'; });

    document.querySelectorAll('._px_kbtn').forEach(function(b) {
      b.addEventListener('click', function(){ startListening(b); });
    });
  }

  // ── 7. In-game HUD ────────────────────────────────────────────
  function injectHUD() {
    var h = document.createElement('div');
    h.id = '_pxHUD';
    h.innerHTML = HUD_HTML;
    document.body.appendChild(h);

    var panel = $('_px_hudPanel');
    $('_px_hudBtn').addEventListener('click', function() {
      panel.classList.toggle('px-hopen');
      if (panel.classList.contains('px-hopen')) hudFill();
    });
    $('_px_hudClose').addEventListener('click', function() { panel.classList.remove('px-hopen'); });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && panel.classList.contains('px-hopen')) panel.classList.remove('px-hopen');
    });

    $('_px_hudSave').addEventListener('click', function() {
      hudCollect(); saveSettings(settings); panel.classList.remove('px-hopen');
    });
    $('_px_hudReset').addEventListener('click', function() {
      if (!confirm('Reset all settings?')) return;
      settings = clone(DEFAULTS); saveSettings(settings); hudFill();
    });
    $('_px_hrd').addEventListener('input',   function(){ $('_px_hrdVal').textContent  = this.value+' chunks'; });
    $('_px_hfov').addEventListener('input',  function(){ $('_px_hfovVal').textContent  = this.value+'°'; });
    $('_px_hsens').addEventListener('input', function(){ $('_px_hsensVal').textContent = this.value+'%'; });
    $('_px_hperf').addEventListener('change', function(){ settings.perfMode = this.checked; saveSettings(settings); });
    $('_px_haccent').addEventListener('input', function(){ applyAccent(this.value); });
    document.querySelectorAll('._px_hkbtn').forEach(function(b) {
      b.addEventListener('click', function(){ startListening(b); });
    });
  }

  function hudFill() {
    $('_px_husername').value          = settings.username;
    $('_px_hserver').value            = settings.serverAddr;
    $('_px_hrd').value                = settings.renderDist;
    $('_px_hrdVal').textContent       = settings.renderDist+' chunks';
    $('_px_hfov').value               = settings.fov;
    $('_px_hfovVal').textContent      = settings.fov+'°';
    $('_px_hsens').value              = settings.sensitivity;
    $('_px_hsensVal').textContent     = settings.sensitivity+'%';
    $('_px_hquality').value           = settings.quality;
    $('_px_hperf').checked            = settings.perfMode;
    $('_px_haccent').value            = settings.accentColor;
    document.querySelectorAll('._px_hkbtn').forEach(function(b){
      b.textContent = settings.keybinds[b.dataset.action]||'?';
    });
  }

  function hudCollect() {
    settings.username    = $('_px_husername').value.trim()||'Steve';
    settings.serverAddr  = $('_px_hserver').value.trim();
    settings.renderDist  = parseInt($('_px_hrd').value);
    settings.fov         = parseInt($('_px_hfov').value);
    settings.sensitivity = parseInt($('_px_hsens').value);
    settings.quality     = $('_px_hquality').value;
    settings.accentColor = $('_px_haccent').value;
    document.querySelectorAll('._px_hkbtn').forEach(function(b){
      settings.keybinds[b.dataset.action]=b.textContent.trim();
    });
  }

  // ── 8. HTML ───────────────────────────────────────────────────
  var KB = ['forward:Move Forward','back:Move Back','left:Move Left','right:Move Right',
            'jump:Jump','sneak:Sneak','sprint:Sprint','inventory:Inventory','drop:Drop Item','chat:Chat'];

  var HTML =
    '<canvas id="_px_canvas" style="position:absolute;inset:0;z-index:0;pointer-events:none"></canvas>'
  + '<div class="px-shell">'
  +   '<header class="px-hdr">'
  +     '<div class="px-logo"><span>⛏</span> Plexter<span class="px-a">Launcher</span></div>'
  +     '<span class="px-badge">EaglercraftX 1.12</span>'
  +   '</header>'
  +   '<main class="px-main">'
  +     '<section class="px-art">'
  +       '<div class="px-scene">'
  +         '<div class="px-cloud px-c1"></div><div class="px-cloud px-c2"></div><div class="px-cloud px-c3"></div>'
  +         '<div class="px-ground"><div class="px-blk"></div><div class="px-blk"></div><div class="px-blk" style="margin-top:-14px"></div><div class="px-blk"></div><div class="px-blk"></div></div>'
  +       '</div>'
  +       '<div class="px-tag">Play anywhere.<br>No Java required.</div>'
  +     '</section>'
  +     '<section class="px-ctrl">'
  +       '<div class="px-fld"><label>Username</label><input id="_px_username" type="text" maxlength="16" autocomplete="off" placeholder="Steve"/></div>'
  +       '<div class="px-fld"><label>Server Address</label><input id="_px_server" type="text" autocomplete="off" placeholder="wss://example.com:8081"/></div>'
  +       '<div class="px-perf" id="_px_perfBanner">'
  +         '<div style="display:flex;gap:12px;align-items:flex-start"><span style="font-size:1.4rem;line-height:1">⚡</span><div><strong>Performance Mode</strong><p>Reduces render distance, particles, and entity load.</p></div></div>'
  +         '<label class="px-tog"><input type="checkbox" id="_px_perf"><span class="px-sli"></span></label>'
  +       '</div>'
  +       '<div class="px-acts"><button id="_px_settingsBtn" class="px-btn px-sec">⚙ Settings</button><button id="_px_launchBtn" class="px-btn px-pri">▶ Launch Game</button></div>'
  +     '</section>'
  +   '</main>'
  +   '<footer class="px-foot"><span>Plexter Launcher — EaglercraftX 1.12 WASM</span><span>Not affiliated with Mojang</span></footer>'
  + '</div>'
  + '<div id="_px_modal" class="px-modal px-hid">'
  +   '<div class="px-mbox">'
  +     '<div class="px-mhdr"><h2>Settings</h2><button id="_px_closeModal" class="px-mcls">&times;</button></div>'
  +     '<div class="px-mbdy">'
  +       '<div class="px-msec"><h3>Video</h3>'
  +         '<div class="px-row"><label>Render Distance <span class="px-val" id="_px_rdVal"></span></label><input type="range" id="_px_rd" min="2" max="16" step="1"/></div>'
  +         '<div class="px-row"><label>FOV <span class="px-val" id="_px_fovVal"></span></label><input type="range" id="_px_fov" min="30" max="110" step="1"/></div>'
  +         '<div class="px-row"><label>Quality</label><select id="_px_quality"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="ultra">Ultra</option></select></div>'
  +         '<div class="px-row"><label>Fullscreen on Launch</label><label class="px-tog"><input type="checkbox" id="_px_fs"><span class="px-sli"></span></label></div>'
  +       '</div>'
  +       '<div class="px-msec"><h3>Controls</h3>'
  +         '<div class="px-row"><label>Mouse Sensitivity <span class="px-val" id="_px_sensVal"></span></label><input type="range" id="_px_sens" min="1" max="200" step="1"/></div>'
  +         '<div class="px-kg">'+KB.map(function(s){var p=s.split(':');return '<div class="px-kr"><span>'+p[1]+'</span><button class="_px_kbtn" data-action="'+p[0]+'"></button></div>';}).join('')+'</div>'
  +       '</div>'
  +       '<div class="px-msec"><h3>Theme</h3><div class="px-row"><label>Accent Color</label><input type="color" id="_px_accent"/></div></div>'
  +     '</div>'
  +     '<div class="px-mft"><button id="_px_resetSettings" class="px-btn px-ghost">Reset Defaults</button><button id="_px_saveSettings" class="px-btn px-pri">Save Settings</button></div>'
  +   '</div>'
  + '</div>';

  var HUD_HTML =
    '<button id="_px_hudBtn"><span>⛏</span> Plexter</button>'
  + '<div id="_px_hudPanel">'
  +   '<div class="px-huhdr"><div class="px-logo" style="font-size:1rem">⛏ Plexter<span class="px-a">Launcher</span></div><button id="_px_hudClose" class="px-mcls">&times;</button></div>'
  +   '<div class="px-hubdy">'
  +     '<div class="px-husec"><h4>Profile</h4>'
  +       '<div class="px-row"><label>Username</label><input type="text" id="_px_husername" maxlength="16"/></div>'
  +       '<div class="px-row"><label>Server</label><input type="text" id="_px_hserver" placeholder="wss://…"/></div>'
  +       '<p class="px-hnote">⚠ Takes effect on next launch</p>'
  +     '</div>'
  +     '<div class="px-husec"><h4>Video</h4>'
  +       '<div class="px-row"><label>Render Distance <span class="px-val" id="_px_hrdVal"></span></label><input type="range" id="_px_hrd" min="2" max="16" step="1"/></div>'
  +       '<div class="px-row"><label>FOV <span class="px-val" id="_px_hfovVal"></span></label><input type="range" id="_px_hfov" min="30" max="110" step="1"/></div>'
  +       '<div class="px-row"><label>Quality</label><select id="_px_hquality"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="ultra">Ultra</option></select></div>'
  +       '<div class="px-row"><label>Performance Mode</label><label class="px-tog"><input type="checkbox" id="_px_hperf"><span class="px-sli"></span></label></div>'
  +       '<p class="px-hnote">⚠ Takes effect on next launch</p>'
  +     '</div>'
  +     '<div class="px-husec"><h4>Controls</h4>'
  +       '<div class="px-row"><label>Sensitivity <span class="px-val" id="_px_hsensVal"></span></label><input type="range" id="_px_hsens" min="1" max="200" step="1"/></div>'
  +       '<div class="px-kg" style="margin-top:6px">'+KB.map(function(s){var p=s.split(':');return '<div class="px-kr"><span>'+p[1]+'</span><button class="_px_hkbtn" data-action="'+p[0]+'"></button></div>';}).join('')+'</div>'
  +     '</div>'
  +     '<div class="px-husec"><h4>Theme</h4><div class="px-row"><label>Accent Color</label><input type="color" id="_px_haccent"/></div></div>'
  +   '</div>'
  +   '<div class="px-huft"><button id="_px_hudReset" class="px-btn px-ghost" style="font-size:.8rem;padding:7px 12px">Reset</button><button id="_px_hudSave" class="px-btn px-pri" style="flex:1;font-size:.84rem;padding:8px 12px">Save &amp; Close</button></div>'
  + '</div>';

  // ── 9. CSS ────────────────────────────────────────────────────
  var CSS = [
    ':root{--px-accent:#4caf50;--px-accent-dark:#388e3c;--px-accent-glow:rgba(76,175,80,.35)}',
    '#_pxOverlay{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;opacity:0;transition:opacity .5s;background:#0d0f0d}',
    '#_pxOverlay.px-vis{opacity:1}',
    '.px-shell{position:relative;z-index:1;display:flex;flex-direction:column;height:100vh;font-family:Segoe UI,system-ui,sans-serif;color:#e8f5e9}',
    '.px-hdr{display:flex;align-items:center;justify-content:space-between;padding:18px 32px;background:rgba(13,15,13,.88);backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,.07)}',
    '.px-logo{font-size:1.5rem;font-weight:700;display:flex;align-items:center;gap:10px}',
    '.px-a{color:var(--px-accent)}',
    '.px-badge{font-size:.75rem;font-weight:600;background:#1c231c;border:1px solid rgba(255,255,255,.07);border-radius:999px;padding:4px 12px;color:#7a9e7e}',
    '.px-main{display:flex;flex:1;overflow:hidden}',
    '.px-art{flex:1;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:40px;background:linear-gradient(180deg,#0a1a2e,#0d2b1a 60%,#0d0f0d);overflow:hidden}',
    '.px-art::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 50% 30%,rgba(76,175,80,.08),transparent 70%)}',
    '.px-cloud{position:absolute;background:rgba(255,255,255,.06);border-radius:50px;filter:blur(2px)}',
    '.px-cloud::before,.px-cloud::after{content:"";position:absolute;background:inherit;border-radius:50%}',
    '.px-c1{width:160px;height:40px;top:15%;left:10%;animation:pxD 28s linear infinite}.px-c1::before{width:70px;height:60px;top:-30px;left:20px}.px-c1::after{width:50px;height:50px;top:-20px;right:20px}',
    '.px-c2{width:220px;height:50px;top:28%;left:45%;animation:pxD 36s linear infinite reverse}.px-c2::before{width:90px;height:70px;top:-35px;left:30px}.px-c2::after{width:60px;height:55px;top:-25px;right:25px}',
    '.px-c3{width:130px;height:35px;top:10%;right:8%;animation:pxD 22s linear infinite}.px-c3::before{width:55px;height:50px;top:-25px;left:15px}.px-c3::after{width:40px;height:42px;top:-18px;right:15px}',
    '@keyframes pxD{from{transform:translateX(-60px)}to{transform:translateX(60px)}}',
    '.px-scene{position:absolute;bottom:60px;left:50%;transform:translateX(-50%)}',
    '.px-ground{display:flex;gap:4px}',
    '.px-blk{width:52px;height:52px;background:linear-gradient(180deg,#5a8a3a 30%,#6b4226 30%);border:2px solid rgba(0,0,0,.4);border-radius:3px;box-shadow:inset 0 0 0 2px rgba(255,255,255,.06),0 4px 12px rgba(0,0,0,.5);animation:pxB 4s ease-in-out infinite}',
    '.px-blk:nth-child(2){animation-delay:.2s}.px-blk:nth-child(3){animation-delay:.4s}.px-blk:nth-child(4){animation-delay:.6s}.px-blk:nth-child(5){animation-delay:.8s}',
    '@keyframes pxB{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}',
    '.px-tag{position:relative;font-size:1.1rem;color:#7a9e7e;text-align:center;line-height:1.6}',
    '.px-ctrl{width:380px;flex-shrink:0;display:flex;flex-direction:column;gap:16px;padding:32px 28px;background:rgba(13,15,13,.92);backdrop-filter:blur(16px);border-left:1px solid rgba(255,255,255,.07);overflow-y:auto;justify-content:center}',
    '.px-fld{display:flex;flex-direction:column;gap:6px}',
    '.px-fld label{font-size:.78rem;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:#7a9e7e}',
    '.px-fld input{padding:10px 14px;background:#1c231c;border:1px solid rgba(255,255,255,.07);border-radius:10px;color:#e8f5e9;font-size:.95rem;font-family:inherit;outline:none;transition:border-color .2s,box-shadow .2s}',
    '.px-fld input:focus{border-color:var(--px-accent);box-shadow:0 0 0 3px var(--px-accent-glow)}',
    '.px-perf{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;background:#1c231c;border:1px solid rgba(255,255,255,.07);border-radius:10px;transition:border-color .3s,box-shadow .3s}',
    '.px-perf p{font-size:.72rem;color:#7a9e7e;line-height:1.4;margin-top:2px}.px-perf strong{font-size:.9rem}',
    '.px-active{border-color:var(--px-accent)!important;box-shadow:0 0 0 2px var(--px-accent-glow)!important}',
    '.px-tog{position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0;cursor:pointer}',
    '.px-tog input{opacity:0;width:0;height:0}',
    '.px-sli{position:absolute;inset:0;background:#151a15;border:1px solid rgba(255,255,255,.07);border-radius:24px;transition:background .25s}',
    '.px-sli::before{content:"";position:absolute;width:16px;height:16px;left:3px;top:3px;background:#7a9e7e;border-radius:50%;transition:transform .25s,background .25s}',
    '.px-tog input:checked+.px-sli{background:var(--px-accent-dark);border-color:var(--px-accent)}',
    '.px-tog input:checked+.px-sli::before{transform:translateX(20px);background:var(--px-accent)}',
    '.px-acts{display:flex;gap:10px;margin-top:4px}',
    '.px-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:11px 18px;border:none;border-radius:10px;font-family:inherit;font-size:.9rem;font-weight:600;cursor:pointer;transition:background .2s,transform .1s,box-shadow .2s;white-space:nowrap}',
    '.px-btn:active{transform:scale(.97)}',
    '.px-pri{flex:1;background:var(--px-accent);color:#000;box-shadow:0 0 16px var(--px-accent-glow)}.px-pri:hover{background:#66bb6a;box-shadow:0 0 24px var(--px-accent-glow)}',
    '.px-sec{background:#1c231c;color:#e8f5e9;border:1px solid rgba(255,255,255,.07)}.px-sec:hover{background:#232c23}',
    '.px-ghost{background:transparent;color:#7a9e7e;border:1px solid rgba(255,255,255,.07)}.px-ghost:hover{background:#1c231c;color:#e8f5e9}',
    '.px-foot{display:flex;justify-content:space-between;padding:10px 32px;font-size:.72rem;color:#7a9e7e;background:rgba(13,15,13,.88);border-top:1px solid rgba(255,255,255,.07)}',
    // Modal
    '.px-modal{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.65);backdrop-filter:blur(4px)}',
    '.px-hid{display:none!important}',
    '.px-mbox{width:min(680px,95vw);max-height:88vh;display:flex;flex-direction:column;background:#151a15;border:1px solid rgba(255,255,255,.07);border-radius:14px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.7);animation:pxU .25s ease}',
    '@keyframes pxU{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}',
    '.px-mhdr{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid rgba(255,255,255,.07)}',
    '.px-mhdr h2{font-size:1.1rem;color:#e8f5e9;margin:0}',
    '.px-mcls{background:none;border:none;color:#7a9e7e;font-size:1.6rem;cursor:pointer;line-height:1;padding:0 4px;transition:color .2s}.px-mcls:hover{color:#e8f5e9}',
    '.px-mbdy{flex:1;overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:28px}',
    '.px-mft{display:flex;justify-content:flex-end;gap:10px;padding:16px 24px;border-top:1px solid rgba(255,255,255,.07)}',
    '.px-msec h3{font-size:.75rem;text-transform:uppercase;letter-spacing:1px;color:#7a9e7e;margin:0 0 14px}',
    '.px-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.07)}',
    '.px-row:last-child{border-bottom:none}',
    '.px-row label{font-size:.88rem;color:#e8f5e9;display:flex;align-items:center;gap:8px;flex:1}',
    '.px-row input[type=text]{flex:1;padding:7px 10px;background:#1c231c;border:1px solid rgba(255,255,255,.07);border-radius:7px;color:#e8f5e9;font-size:.85rem;font-family:inherit;outline:none}',
    '.px-row input[type=text]:focus{border-color:var(--px-accent)}',
    '.px-val{font-size:.8rem;color:var(--px-accent);font-weight:600;min-width:40px;text-align:right}',
    'input[type=range]{-webkit-appearance:none;appearance:none;width:160px;height:4px;background:#1c231c;border-radius:4px;outline:none;cursor:pointer}',
    'input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:var(--px-accent);box-shadow:0 0 6px var(--px-accent-glow);cursor:pointer}',
    'select{padding:7px 12px;background:#1c231c;border:1px solid rgba(255,255,255,.07);border-radius:10px;color:#e8f5e9;font-family:inherit;font-size:.88rem;cursor:pointer;outline:none}',
    'input[type=color]{-webkit-appearance:none;appearance:none;width:44px;height:32px;border:1px solid rgba(255,255,255,.07);border-radius:6px;padding:2px;background:#1c231c;cursor:pointer}',
    '.px-kg{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}',
    '.px-kr{display:flex;align-items:center;justify-content:space-between;padding:7px 10px;background:#1c231c;border:1px solid rgba(255,255,255,.07);border-radius:6px;gap:8px}',
    '.px-kr span{font-size:.82rem;color:#e8f5e9;flex:1}',
    '._px_kbtn,._px_hkbtn{min-width:46px;padding:4px 8px;background:#151a15;border:1px solid rgba(255,255,255,.07);border-radius:5px;color:var(--px-accent);font-family:inherit;font-size:.78rem;font-weight:600;cursor:pointer;text-align:center;text-transform:uppercase;transition:background .15s}',
    '._px_kbtn:hover,._px_hkbtn:hover{background:#1c231c}',
    '._px_kbtn.px-listening,._px_hkbtn.px-listening{border-color:var(--px-accent);background:var(--px-accent-glow);color:#e8f5e9;animation:pxP .8s ease infinite alternate}',
    '@keyframes pxP{from{opacity:.7}to{opacity:1}}',
    // HUD
    '#_pxHUD{position:fixed;top:12px;left:12px;z-index:99999;font-family:Segoe UI,system-ui,sans-serif}',
    '#_px_hudBtn{display:flex;align-items:center;gap:7px;padding:6px 13px;background:rgba(13,20,13,.75);border:1px solid rgba(76,175,80,.35);border-radius:8px;color:#e8f5e9;font-size:.8rem;font-weight:700;cursor:pointer;backdrop-filter:blur(8px);transition:opacity .2s,background .2s,border-color .2s;opacity:.4;user-select:none}',
    '#_px_hudBtn:hover{opacity:1;background:rgba(13,20,13,.92);border-color:var(--px-accent)}',
    '#_px_hudPanel{position:fixed;top:0;left:0;bottom:0;width:320px;background:#0f150f;border-right:1px solid rgba(255,255,255,.08);display:flex;flex-direction:column;transform:translateX(-110%);transition:transform .3s cubic-bezier(.4,0,.2,1);z-index:99998;box-shadow:4px 0 32px rgba(0,0,0,.7)}',
    '#_px_hudPanel.px-hopen{transform:translateX(0)}',
    '.px-huhdr{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.07)}',
    '.px-hubdy{flex:1;overflow-y:auto;padding:14px 18px;display:flex;flex-direction:column;gap:18px}',
    '.px-husec h4{font-size:.68rem;text-transform:uppercase;letter-spacing:1px;color:#7a9e7e;margin:0 0 10px}',
    '.px-hnote{font-size:.7rem;color:#7a9e7e;padding:5px 0;line-height:1.4}',
    '.px-huft{display:flex;gap:8px;padding:12px 18px;border-top:1px solid rgba(255,255,255,.07)}',
    '@media(max-width:700px){.px-art{display:none}.px-ctrl{width:100%;border-left:none;padding:24px 20px;justify-content:flex-start;padding-top:32px}.px-hdr{padding:14px 20px}.px-kg{grid-template-columns:1fr}input[type=range]{width:120px}}'
  ].join('');

})();
