/* ============================================================
   Plexter Launcher — patch.js
   Add this to game.html (the EaglercraftX offline bundle) by
   inserting the following line inside its <head> tag:
     <script src="patch.js"></script>
   It must appear BEFORE the game's own bootstrap scripts.

   This script reads settings saved by the Plexter Launcher and
   injects them into eaglercraftXOpts so EaglercraftX picks them
   up at boot time.
   ============================================================ */
(function () {
  var raw = localStorage.getItem('plexterSettings');
  if (!raw) return;

  var s;
  try { s = JSON.parse(raw); } catch (e) { return; }

  // eaglercraftXOpts is read by EaglercraftX before the game boots.
  // We create or extend the existing object.
  window.eaglercraftXOpts = window.eaglercraftXOpts || {};
  var opts = window.eaglercraftXOpts;

  // Username
  if (s.username) opts.defaultUsername = s.username;

  // Default server shown in Multiplayer screen
  if (s.serverAddr) {
    opts.servers = opts.servers || [];
    // Avoid duplicates
    var already = opts.servers.some(function(srv) { return srv.addr === s.serverAddr; });
    if (!already) {
      opts.servers.unshift({ name: 'Plexter Server', addr: s.serverAddr });
    }
  }

  // Quality preset → fancyGraphics / clouds / particles flags
  var quality = s.quality || 'high';
  if (quality === 'low' || s.perfMode) {
    opts.fancyGraphics = false;
    opts.renderClouds  = false;
  } else if (quality === 'medium') {
    opts.fancyGraphics = true;
    opts.renderClouds  = false;
  } else {
    opts.fancyGraphics = true;
    opts.renderClouds  = true;
  }

  // Store render distance + FOV in localStorage keys eaglercraft reads natively
  // (EaglercraftX reads these from its own MC options storage, not opts,
  //  so we write them to the standard key it uses: "options.txt" in IndexedDB.
  //  What we can do here is store them for reference; the in-game options menu
  //  is where they ultimately take effect.)
  localStorage.setItem('plexterPatch_renderDist',  String(s.renderDist  || 8));
  localStorage.setItem('plexterPatch_fov',         String(s.fov         || 70));
  localStorage.setItem('plexterPatch_sensitivity', String(s.sensitivity || 100));

  // Add a "Back to Launcher" button once the page loads
  window.addEventListener('load', function () {
    var btn = document.createElement('button');
    btn.textContent = '← Launcher';
    btn.title = 'Return to Plexter Launcher';
    btn.style.cssText = [
      'position:fixed', 'top:10px', 'left:10px', 'z-index:99999',
      'padding:6px 14px', 'background:rgba(0,0,0,0.55)',
      'color:#e8f5e9', 'border:1px solid rgba(255,255,255,0.15)',
      'border-radius:8px', 'font:600 13px system-ui,sans-serif',
      'cursor:pointer', 'backdrop-filter:blur(6px)',
      'opacity:0.35', 'transition:opacity .2s',
    ].join(';');
    btn.addEventListener('mouseover', function () { btn.style.opacity = '1'; });
    btn.addEventListener('mouseout',  function () { btn.style.opacity = '0.35'; });
    btn.addEventListener('click', function () { history.back(); });
    document.body.appendChild(btn);
  });
})();
