// geow2.com: the download button, the clips, the copy buttons and the
// background grid. Everything works without this script: the download
// links then go to the Releases page and the clips show their posters.

(() => {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // --- Download: the latest release's archive for this system --------------

  const PLATFORMS = [
    { id: "windows", label: "Windows", match: /-windows-x64\.zip$/ },
    { id: "macos", label: "macOS", match: /-macos\.zip$/ },
    { id: "linux", label: "Linux", match: /-linux-x86_64\.tar\.gz$/ },
  ];

  function detectPlatform() {
    const p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
    const ua = navigator.userAgent || "";
    if (/android|iphone|ipad|ipod/i.test(ua)) return null;
    if (/win/i.test(p) || /windows/i.test(ua)) return "windows";
    if (/mac/i.test(p) || /mac os x/i.test(ua)) return "macos";
    if (/linux|x11/i.test(p) || /linux|cros/i.test(ua)) return "linux";
    return null;
  }

  function megabytes(bytes) {
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  async function showRelease() {
    const primary = document.getElementById("dl-primary");
    const label = document.getElementById("dl-label");
    const meta = document.getElementById("dl-meta");
    const others = document.getElementById("dl-others");
    if (!primary || !label || !meta || !others) return;  // a page without the download button
    let release;
    try {
      const r = await fetch("https://api.github.com/repos/techknight/geow2/releases/latest",
        { headers: { Accept: "application/vnd.github+json" } });
      if (!r.ok) return;
      release = await r.json();
    } catch (e) {
      return;
    }
    const version = release.tag_name || "";
    const assets = PLATFORMS.map((p) => ({ ...p, asset: (release.assets || []).find((a) => p.match.test(a.name)) }))
      .filter((p) => p.asset);
    if (!assets.length) return;
    const mine = detectPlatform();
    const first = assets.find((p) => p.id === mine);
    const rest = assets.filter((p) => p !== first);
    if (first) {
      primary.href = first.asset.browser_download_url;
      label.textContent = "Download for " + first.label;
      meta.textContent = version + " · " + megabytes(first.asset.size);
    } else {
      primary.href = release.html_url;
      label.textContent = "Download " + version;
      meta.textContent = "Windows · macOS · Linux";
    }
    others.textContent = "";
    for (const p of rest) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = p.asset.browser_download_url;
      a.textContent = p.label + " ";
      const size = document.createElement("span");
      size.className = "readout";
      size.textContent = megabytes(p.asset.size);
      a.append(size);
      li.append(a);
      others.append(li);
    }
    const all = document.createElement("li");
    const link = document.createElement("a");
    link.href = release.html_url;
    link.textContent = "Release notes and checksums";
    all.append(link);
    others.append(all);
    const footer = document.getElementById("site-version");
    if (footer) footer.textContent = "geow2.com · latest release " + version;
  }

  // --- Clips: load when near the screen, play only while visible -----------

  function setUpClips() {
    const clips = [...document.querySelectorAll("video.clip[data-src]")];
    if (reducedMotion || !("IntersectionObserver" in window)) {
      // No autoplay: each clip gets controls and loads when started.
      for (const v of clips) {
        v.controls = true;
        v.src = v.dataset.src;
      }
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const v = e.target;
        if (e.isIntersecting) {
          if (!v.src) v.src = v.dataset.src;
          const p = v.play();
          if (p && p.catch) p.catch(() => { v.controls = true; });
        } else if (!v.paused) {
          v.pause();
        }
      }
    }, { threshold: 0.35 });
    for (const v of clips) io.observe(v);
  }

  // --- Copy buttons ---------------------------------------------------------

  function setUpCopy() {
    for (const b of document.querySelectorAll("button.copy[data-copy]")) {
      b.addEventListener("click", async () => {
        const code = document.getElementById(b.dataset.copy);
        try {
          await navigator.clipboard.writeText(code.textContent);
          b.textContent = "Copied";
        } catch (e) {
          const range = document.createRange();
          range.selectNodeContents(code);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          b.textContent = "Selected";
        }
        setTimeout(() => { b.textContent = "Copy"; }, 1600);
      });
    }
  }

  // --- The grid: lines pulled toward wells (as in geow2's icon) -------------

  function setUpGrid() {
    const canvas = document.getElementById("grid");
    const ctx = canvas && canvas.getContext("2d");
    if (!ctx) return;
    const SPACING = 56;
    let w = 0, h = 0, dpr = 1;
    // The pointer's well eases toward the pointer; a second one drifts.
    const pointer = { x: 0.7, y: 0.3, tx: 0.7, ty: 0.3, strength: 0, target: 0 };
    let t0 = performance.now();

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function warp(x, y, wells) {
      let dx = 0, dy = 0;
      for (const well of wells) {
        const ex = x - well.x, ey = y - well.y;
        const r = Math.hypot(ex, ey);
        if (r < 1e-3) continue;
        const s = well.radius;
        const pull = well.strength * Math.exp(-(r * r) / (s * s)) * Math.min(1, r / (s * 0.3));
        dx -= ex / r * pull;
        dy -= ey / r * pull;
      }
      return [x + dx, y + dy];
    }

    function line(points) {
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    }

    function draw(now) {
      const t = (now - t0) / 1000;
      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;
      pointer.strength += (pointer.target - pointer.strength) * 0.04;
      const m = Math.min(w, h);
      const wells = [
        { x: pointer.x * w, y: pointer.y * h, radius: m * 0.22, strength: m * 0.07 * pointer.strength },
        {
          x: w * (0.5 + 0.32 * Math.sin(t * 0.11)), y: h * (0.55 + 0.25 * Math.sin(t * 0.17 + 1.3)),
          radius: m * 0.3, strength: m * 0.05,
        },
      ];
      ctx.clearRect(0, 0, w, h);
      const STEP = 14;
      ctx.beginPath();
      for (let x = (w / 2) % SPACING; x <= w; x += SPACING) {
        const pts = [];
        for (let y = -STEP; y <= h + STEP; y += STEP) pts.push(warp(x, y, wells));
        line(pts);
      }
      for (let y = (h / 2) % SPACING; y <= h; y += SPACING) {
        const pts = [];
        for (let x = -STEP; x <= w + STEP; x += STEP) pts.push(warp(x, y, wells));
        line(pts);
      }
      // Bloom: a wide faint pass, then the line itself.
      ctx.strokeStyle = "rgba(40, 100, 255, 0.10)";
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = "rgba(60, 120, 255, 0.34)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    let running = false;
    function frame(now) {
      draw(now);
      if (running) requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener("resize", () => { resize(); if (!running) draw(performance.now()); });
    if (reducedMotion) {
      draw(performance.now());
      return;
    }
    window.addEventListener("pointermove", (e) => {
      pointer.tx = e.clientX / w;
      pointer.ty = e.clientY / h;
      pointer.target = 1;
    }, { passive: true });
    document.addEventListener("pointerleave", () => { pointer.target = 0; });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) running = false;
      else if (!running) { running = true; requestAnimationFrame(frame); }
    });
    running = true;
    requestAnimationFrame(frame);
  }

  setUpGrid();
  setUpClips();
  setUpCopy();
  showRelease();
})();
