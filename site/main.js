// Tramus website behaviour. The page works without this script; it only adds the OS-aware
// download button, the theme toggle, the copy-citation button and the hero animation.
(function () {
  'use strict';
  var root = document.documentElement;
  var $ = function (sel) {
    return document.querySelector(sel);
  };
  var ref = function (name) {
    return document.querySelector('[data-ref="' + name + '"]');
  };

  // ---- Theme -----------------------------------------------------------------
  var themeBtn = $('[data-action="theme"]');
  function storedTheme() {
    try {
      return localStorage.getItem('tramus-theme');
    } catch (e) {
      return null;
    }
  }
  function applyTheme(t) {
    root.dataset.theme = t;
    var label = t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
    themeBtn.setAttribute('aria-label', label);
    themeBtn.title = label;
  }
  applyTheme(root.dataset.theme === 'light' ? 'light' : 'dark');
  themeBtn.addEventListener('click', function () {
    var t = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('tramus-theme', t);
    } catch (e) {}
    applyTheme(t);
  });
  var lightMq = matchMedia('(prefers-color-scheme: light)');
  if (lightMq.addEventListener)
    lightMq.addEventListener('change', function (e) {
      if (!storedTheme()) applyTheme(e.matches ? 'light' : 'dark');
    });

  // ---- Download button for the visitor's OS -------------------------------------
  function detectOs() {
    var nav = navigator;
    var ua = (nav.userAgent || '').toLowerCase();
    var p = ((nav.userAgentData && nav.userAgentData.platform) || nav.platform || ua).toLowerCase();
    if (/android|iphone|ipad|ipod/.test(ua) || nav.maxTouchPoints > 1) return null; // phones, tablets (iPadOS reports "MacIntel")
    if (/mac/.test(p)) return 'mac';
    if (/win/.test(p)) return 'win';
    if (/linux/.test(p)) return 'linux';
    return null;
  }
  var os = detectOs();
  var names = { mac: 'macOS', win: 'Windows', linux: 'Linux' };
  var macBtn = $('[data-dl="mac"]');
  var directLink = $('[data-dl="direct"]');
  var macMenu = $('#mac-menu');
  if (os) {
    document.querySelectorAll('[data-dl-label]').forEach(function (el) {
      el.textContent = 'Download for ' + names[os];
    });
  }
  if (os === 'mac') {
    directLink.hidden = true;
    macBtn.hidden = false;
  } else if (os) {
    var card = document.querySelector('#download a[href*="-' + (os === 'win' ? 'win-x64' : 'linux-x86_64') + '"]');
    if (card) directLink.href = card.href;
  }

  function setMacMenu(open) {
    macMenu.hidden = !open;
    macBtn.setAttribute('aria-expanded', String(open));
  }
  macBtn.addEventListener('click', function () {
    var open = macMenu.hidden;
    setMacMenu(open);
    if (open) macMenu.querySelector('a').focus();
  });
  document.addEventListener('click', function (e) {
    if (!macMenu.hidden && !e.target.closest('[data-macpop]')) setMacMenu(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !macMenu.hidden) {
      setMacMenu(false);
      macBtn.focus();
    }
  });
  macMenu.addEventListener('focusout', function (e) {
    if (e.relatedTarget && !e.target.closest('[data-macpop]').contains(e.relatedTarget)) setMacMenu(false);
  });

  // ---- Copy citation --------------------------------------------------------------
  var copyBtn = $('[data-action="copy-cite"]');
  var cite = $('[data-cite]');
  var copyTimer;
  copyBtn.hidden = false;
  copyBtn.addEventListener('click', function () {
    var text = cite.textContent.trim();
    var done = function () {
      copyBtn.textContent = 'Copied';
      clearTimeout(copyTimer);
      copyTimer = setTimeout(function () {
        copyBtn.textContent = 'Copy';
      }, 1600);
    };
    var selectIt = function () {
      var range = document.createRange();
      range.selectNodeContents(cite);
      var sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    };
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(text).then(done, selectIt);
    else selectIt();
  });

  // ---- Hero animation: a mouse wandering through three chambers -------------------
  var W = [[112, 124], [86, 236], [150, 282], [206, 184], [264, 128], [328, 240], [394, 178], [452, 108],
    [516, 196], [468, 280], [394, 184], [300, 190], [206, 176], [150, 92]];
  var ZONE_OPACITY = [0.12, 0.3];
  function cr(a, b, c, d, t) {
    var t2 = t * t, t3 = t2 * t;
    return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  }
  function pt(k) {
    var n = W.length;
    return W[((k % n) + n) % n];
  }
  function pos(s) {
    var i = Math.floor(s), u = s - i;
    return [
      cr(pt(i - 1)[0], pt(i)[0], pt(i + 1)[0], pt(i + 2)[0], u),
      cr(pt(i - 1)[1], pt(i)[1], pt(i + 1)[1], pt(i + 2)[1], u),
    ];
  }
  var pad = function (n) {
    return String(n).padStart(2, '0');
  };
  var f1 = function (s) {
    var m = Math.floor(s / 60);
    return pad(m) + ':' + (s - m * 60).toFixed(1).padStart(4, '0');
  };
  var f3 = function (s) {
    var m = Math.floor(s / 60);
    return pad(m) + ':' + (s - m * 60).toFixed(3).padStart(6, '0');
  };

  var trailG = ref('rTrail');
  if (!trailG) return;
  var mouse = ref('rMouse'), now = ref('rNow'), playhead = ref('rPlay');
  var zones = ['L', 'C', 'R'];
  var zoneEl = {}, rowEl = {}, timeEl = {};
  zones.forEach(function (k) {
    zoneEl[k] = ref('rZ' + k);
    rowEl[k] = ref('rRow' + k);
    timeEl[k] = ref('rT' + k);
  });

  var NS = 'http://www.w3.org/2000/svg', CHUNKS = 16, segs = [];
  for (var i = 0; i < CHUNKS; i++) {
    var p = document.createElementNS(NS, 'path');
    p.setAttribute('stroke-opacity', (((i + 1) / CHUNKS) * 0.9).toFixed(2));
    trailG.appendChild(p);
    segs.push(p);
  }
  var BASE = { L: 72.4, C: 31.0, R: 108.9 }, T0 = 212.3, TEND = 305, LEN = 372.48, SEG = 3.4;
  var s = 2.2, vt = T0, times = Object.assign({}, BASE), trail = [], zone = null;
  var zoneOf = function (x) {
    return x < 206 ? 'L' : x > 394 ? 'R' : 'C';
  };
  function step(dt) {
    s = (s + dt / SEG) % W.length;
    var q = pos(s);
    trail.push(q);
    if (trail.length > 170) trail.shift();
    return q;
  }
  function draw(q) {
    var ahead = pos((s + 0.02) % W.length);
    var angle = (Math.atan2(ahead[1] - q[1], ahead[0] - q[0]) * 180) / Math.PI;
    mouse.setAttribute('transform', 'translate(' + q[0].toFixed(1) + ' ' + q[1].toFixed(1) + ') rotate(' + angle.toFixed(1) + ')');
    var n = trail.length, per = Math.ceil(n / CHUNKS);
    for (var c = 0; c < CHUNKS; c++) {
      var sl = trail.slice(c * per, Math.min(n, (c + 1) * per + 1));
      segs[c].setAttribute('d', sl.length > 1 ? 'M' + sl.map(function (v) {
        return v[0].toFixed(1) + ' ' + v[1].toFixed(1);
      }).join('L') : '');
    }
    var z = zoneOf(q[0]);
    if (z !== zone) {
      zone = z;
      zones.forEach(function (k) {
        zoneEl[k].setAttribute('fill-opacity', k === z ? ZONE_OPACITY[1] : ZONE_OPACITY[0]);
        rowEl[k].style.background = k === z ? 'var(--raised)' : 'transparent';
        rowEl[k].style.fontWeight = k === z ? '600' : '400';
      });
    }
    zones.forEach(function (k) {
      timeEl[k].textContent = f1(times[k]);
    });
    now.textContent = f3(vt);
    playhead.style.left = ((vt / LEN) * 100).toFixed(2) + '%';
  }

  var last;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var still;
    for (var j = 0; j < 170; j++) still = step(1 / 30);
    draw(still);
    return;
  }
  for (var k = 0; k < 60; k++) step(1 / 30);
  draw(pos(s));

  // Only animate while the hero is on screen.
  var raf = 0;
  function loop(t) {
    var dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    var q = step(dt);
    vt += dt;
    times[zoneOf(q[0])] += dt;
    if (vt > TEND) {
      vt = T0;
      times = Object.assign({}, BASE);
    }
    draw(q);
    raf = requestAnimationFrame(loop);
  }
  function start() {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries[0].isIntersecting ? start() : stop();
    }).observe(trailG.ownerSVGElement);
  } else start();
})();
