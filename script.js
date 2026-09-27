(() => {
  const cv = document.getElementById('scene');
  const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const C = {
    sky: ['#f4b9c9', '#f7c6d2', '#f9d3da', '#fbdde0', '#fde7e4', '#fff0ea'],
    sun: '#f9b9cb', sunGlow: '#fcdbe4',
    cloudFarL: '#fde9ec', cloudFarS: '#f6cfd9',
    cloudL: '#fff7f5', cloudS: '#f5c8d4', cloudD: '#eab4c5',
    sea: '#f8d2d6', seaL: '#fde3e3',
    far: '#f2b4c5', far2: '#eaa2b7',
    hill1: '#fcebc0', hill2: '#f8d9a3', hill3: '#efc293', hillPink: '#f6c4b8', tick: '#dca985',
    trunk: '#a86478', trunkD: '#7f4760', trunkL: '#c5869a',
    leafD: '#d8708f', leaf: '#f08fae', leafL: '#f9b7cb', leafW: '#fdd9e4',
    rope: '#8e5569', seat: '#b9765b', seatD: '#8d5443',
    lamp: '#fff1b8', lampGlow: '#fde7c8', post: '#8d5a6b',
    mush: '#e6718f', mushDot: '#fff4f4', stem: '#fbe9dc',
    flower: ['#ffffff', '#f37fa1', '#fde28a', '#c98ee0'],
    grassD: '#d9819c', grass: '#ee9ab2', grassL: '#f7b8c8', grassBase: '#f3a9bc',
    petal: ['#f7a8bf', '#fbd0dc', '#ee88a8']
  };

  function rng(seed) {
    return () => {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ---------- pixel helpers ----------
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  const R = (g, x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); };
  function disc(g, cx, cy, r, col) {
    g.fillStyle = col; cx = Math.round(cx); cy = Math.round(cy);
    for (let dy = -r; dy <= r; dy++) {
      const hw = Math.floor(Math.sqrt(r * r - dy * dy) + 0.35);
      g.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
    }
  }
  function ditherDisc(g, cx, cy, r, col) {
    g.fillStyle = col; cx = Math.round(cx); cy = Math.round(cy);
    for (let dy = -r; dy <= r; dy++) {
      const hw = Math.floor(Math.sqrt(r * r - dy * dy) + 0.35);
      for (let x = cx - hw; x <= cx + hw; x++) if ((x + cy + dy) % 2 === 0) g.fillRect(x, cy + dy, 1, 1);
    }
  }
  // flat ellipse; mode 1 = dithered upper half only
  function ell(g, cx, cy, a, b, col, mode) {
    g.fillStyle = col; cx = Math.round(cx); cy = Math.round(cy);
    for (let dy = -b; dy <= b; dy++) {
      if (mode === 1 && dy > 0) break;
      const hw = Math.floor(a * Math.sqrt(Math.max(0, 1 - (dy / (b + 0.5)) ** 2)) + 0.35);
      if (mode === 1) { for (let x = cx - hw; x <= cx + hw; x++) if ((x + cy + dy) % 2 === 0) g.fillRect(x, cy + dy, 1, 1); }
      else g.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
    }
  }
  function line(g, x0, y0, x1, y1, col, th = 1) {
    g.fillStyle = col;
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (; ;) {
      g.fillRect(x0, y0, th, th);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }

  // ---------- state ----------
  let W, H, PX, hz, hill, tree, skyLayer, landLayer, clouds, petals, blades, sparkles;

  function build() {
    const vw = innerWidth, vh = innerHeight;
    PX = Math.max(2, Math.floor(Math.min(vw, vh) / 140));
    W = Math.ceil(vw / PX); H = Math.ceil(vh / PX);
    cv.width = W; cv.height = H;
    const r = rng(1127);

    hz = Math.round(H * 0.62);
    const top = Math.max(84, Math.round(H * 0.55));
    const rx = Math.min(Math.round(W * 0.24), 54);
    const ry = Math.max(12, Math.round(rx * 0.32));
    hill = { cx: Math.floor(W / 2), top, rx, ry, cy: top + ry };
    const ts = Math.min(0.9, (W - 8) / 260, (top - 3) / 86);
    tree = { x: hill.cx - Math.round(6 * ts), base: top + 1, s: ts };

    // ----- sky (static) -----
    skyLayer = mk(W, H);
    let g = skyLayer.getContext('2d');
    const bands = C.sky.length, bandH = hz / bands;
    for (let i = 0; i < bands; i++) {
      const y0 = Math.floor(i * bandH), y1 = Math.floor((i + 1) * bandH);
      R(g, 0, y0, W, y1 - y0 + 1, C.sky[i]);
      if (i < bands - 1) {
        g.fillStyle = C.sky[i + 1];
        for (let x = 0; x < W; x++) {
          if (x % 2 === 0) g.fillRect(x, y1 - 2, 1, 1);
          if (x % 2 === 1) g.fillRect(x, y1 - 1, 1, 1);
          g.fillRect(x, y1 - 1 + (x % 2), 1, 1);
        }
      }
    }
    R(g, 0, hz, W, H - hz, C.sky[bands - 1]);
    // light streaks
    g.fillStyle = 'rgba(255,255,255,0.18)';
    for (let s = 0; s < 4; s++) {
      const sx = Math.round(W * (0.1 + s * 0.24 + r() * 0.08));
      for (let k = 0; k < H * 0.5; k++) g.fillRect(sx + k * 1, k - 4, 2 + (s % 2), 1);
    }
    // crescent moon
    const sunX = Math.round(W * 0.8), sunY = Math.round(H * 0.13);
    const px = g.getImageData(sunX + 4, sunY - 3, 1, 1).data;
    const skyAt = `rgb(${px[0]},${px[1]},${px[2]})`;
    ditherDisc(g, sunX, sunY, 13, C.sunGlow);
    disc(g, sunX, sunY, 9, C.sun);
    disc(g, sunX + 5, sunY - 4, 8, skyAt);
    R(g, sunX - 5, sunY + 1, 1, 2, '#fde3ea');

    // ----- land (static, transparent) -----
    landLayer = mk(W, H);
    g = landLayer.getContext('2d');
    // sea band
    R(g, 0, hz, W, H - hz, C.sea);
    for (let x = 0; x < W; x += 1) if (r() < 0.25) R(g, x, hz + 2 + Math.floor(r() * 8), 2 + Math.floor(r() * 4), 1, C.seaL);
    // far hills
    for (let x = 0; x < W; x++) {
      const h1 = 6 + Math.sin(x * 0.045) * 3 + Math.sin(x * 0.13 + 2) * 1.5;
      R(g, x, hz - Math.round(h1), 1, Math.round(h1) + 1, C.far);
      const h2 = 3 + Math.sin(x * 0.08 + 1) * 2;
      if (h2 > 1.5) R(g, x, hz - Math.round(h2) + 1, 1, Math.round(h2), C.far2);
    }

    // main hill
    const { cx, cy } = hill;
    for (let y = top; y < H; y++) {
      let hw;
      if (y <= cy) hw = rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2));
      else hw = rx + (y - cy) * 1.6;
      hw = Math.round(hw);
      const depth = (y - top) / (H - top);
      for (let x = cx - hw; x <= cx + hw; x++) {
        const u = (x - cx) / Math.max(1, hw);
        let col = depth < 0.12 ? C.hill1 : depth < 0.2 ? (((x + y) % 2) ? C.hill1 : C.hill2) : C.hill2;
        if (u > 0.45) col = u > 0.58 || (x + y) % 2 ? C.hill3 : col;
        if (u < -0.8) col = C.hill3;
        const streak = Math.sin(x * 0.07 + y * 0.35) + Math.sin(x * 0.03 - y * 0.2);
        if (streak > 1.35 && depth > 0.08) col = C.hillPink;
        R(g, x, y, 1, 1, col);
      }
    }
    // grass ticks on hill
    for (let i = 0; i < 70; i++) {
      const y = top + 4 + Math.floor(r() * (H - top - 10));
      const hw = y <= cy ? rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2)) : rx + (y - cy) * 1.6;
      const x = Math.round(cx + (r() * 2 - 1) * hw * 0.85);
      R(g, x, y, 1, 1, C.tick); R(g, x + 2, y, 1, 1, C.tick); R(g, x + 1, y + 1, 1, 1, C.tick);
    }

    const surf = x => Math.round(cy - ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2)));
    const surfAt = x => Math.abs(x - cx) < rx ? surf(x) : cy + Math.round((Math.abs(x - cx) - rx) / 1.6);

    // flowers on hill
    for (let i = 0; i < 26; i++) {
      const x = Math.round(cx + (r() * 2 - 1) * rx * 0.8);
      const y = surf(x) + 2 + Math.floor(r() * 18);
      const col = C.flower[Math.floor(r() * C.flower.length)];
      R(g, x, y + 1, 1, 1, '#9fb07a');
      R(g, x, y, 1, 1, col);
      if (r() < 0.4) { R(g, x - 1, y, 1, 1, col); R(g, x + 1, y, 1, 1, col); R(g, x, y - 1, 1, 1, col); R(g, x, y, 1, 1, '#fde28a'); }
    }

    // ----- tree: big acacia, twisted trunk, wide layered flat canopy -----
    const tx = tree.x, tb = tree.base, s = tree.s;
    const A = (dx, dy) => [tx + dx * s, tb + dy * s];
    const sw = w => Math.max(1, Math.round(w * s));
    // curved branch as cubic bezier with tapering width
    function bez(a, b, c, d, w0, w1) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(c[0] - b[0], c[1] - b[1]) + Math.hypot(d[0] - c[0], d[1] - c[1]);
      const steps = Math.ceil(len * 2) + 4;
      for (let pass = 0; pass < 3; pass++) {
        for (let i = 0; i <= steps; i++) {
          const t = i / steps, u = 1 - t;
          const x = u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0];
          const y = u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1];
          const w = Math.max(1, Math.round(w0 + (w1 - w0) * t)), h = Math.floor(w / 2);
          if (pass === 0 && w >= 2) R(g, x - h + 1, y - h + 1, w, w, C.trunkD);
          if (pass === 1) R(g, x - h, y - h, w, w, w >= 2 ? C.trunk : C.trunkD);
          if (pass === 2 && w >= 3) R(g, x - h, y - h, 1, 1, C.trunkL);
        }
      }
    }
    const q = (a, c, d, w0, w1) => bez(a, [a[0] + (c[0] - a[0]) * 2 / 3, a[1] + (c[1] - a[1]) * 2 / 3], [d[0] + (c[0] - d[0]) * 2 / 3, d[1] + (c[1] - d[1]) * 2 / 3], d, w0, w1);

    // root flare
    bez(A(-12, 1), A(-8, -1), A(-5, -4), A(-2, -10), sw(3), sw(3));
    bez(A(13, 1), A(9, -1), A(6, -5), A(4, -10), sw(3), sw(3));
    // twisted trunk: intertwined strands
    bez(A(5, 1), A(-3, -11), A(9, -22), A(8, -33), sw(6), sw(4));
    bez(A(-5, 1), A(-1, -10), A(-5, -20), A(6, -33), sw(6), sw(4));
    bez(A(0, 0), A(3, -12), A(0, -22), A(7, -33), sw(3), sw(3));

    const F = A(7, -33);
    // long left limb, diagonal then almost flat
    bez(A(4, -27), A(-8, -37), A(-25, -41), A(-50, -43), sw(4), sw(2));
    bez(A(-2, -20), A(-10, -27), A(-18, -34), A(-28, -41), sw(3), 1);
    q(A(-50, -43), A(-62, -43), A(-72, -44), sw(2), 1);
    q(A(-50, -43), A(-56, -44), A(-60, -47), 1, 1);
    q(A(-38, -42), A(-40, -44), A(-40, -47), 1, 1);
    q(A(-24, -40), A(-26, -43), A(-27, -47), 1, 1);
    q(A(-12, -38), A(-14, -42), A(-16, -46), 1, 1);
    // center-left limb
    bez(F, A(2, -44), A(-8, -52), A(-22, -61), sw(4), sw(2));
    q(A(-22, -61), A(-30, -62), A(-36, -65), 1, 1);
    q(A(-22, -61), A(-22, -64), A(-20, -67), 1, 1);
    q(A(-6, -51), A(-5, -58), A(-3, -65), 1, 1);
    // center limb, fanning upward
    bez(F, A(10, -44), A(12, -52), A(18, -61), sw(4), sw(2));
    q(A(18, -61), A(14, -64), A(10, -68), 1, 1);
    q(A(18, -61), A(22, -65), A(26, -68), 1, 1);
    q(A(13, -52), A(5, -56), A(2, -61), 1, 1);
    // right limb, diagonal then long and flat
    bez(F, A(20, -38), A(38, -46), A(58, -54), sw(4), sw(2));
    q(A(58, -54), A(66, -58), A(72, -65), sw(2), 1);
    q(A(58, -54), A(78, -54), A(98, -56), sw(2), 1);
    q(A(40, -48), A(44, -56), A(46, -65), 1, 1);
    q(A(30, -44), A(30, -50), A(33, -56), 1, 1);
    q(A(80, -55), A(88, -58), A(92, -60), 1, 1);

    // canopy: wide flat layered pads
    tree.canopy = [];
    function pad(dx, dy, rw0, rh0, seed) {
      const [pcx, pcy] = A(dx, dy);
      const rw = Math.max(3, Math.round(rw0 * s)), rh = Math.max(2, Math.round(rh0 * s));
      const pr = rng(seed), n = Math.max(2, Math.round(rw / 5));
      const blobs = [[pcx, pcy, rw, rh]];
      for (let k = 0; k < n; k++) {
        const u = (k + 0.5) / n;
        blobs.push([
          pcx - rw * 0.8 + rw * 1.6 * u + (pr() - 0.5) * 2,
          pcy - rh * 0.6 - (1 - Math.abs(u * 2 - 1)) * rh * 0.5 + (pr() - 0.5),
          Math.round(rw / n * 1.1 + 1 + pr() * 2),
          Math.max(1, Math.round(rh * 0.7))
        ]);
      }
      blobs.forEach(([x, y, a, b]) => ell(g, x, y + 1, a, b, C.leafD, 0));
      R(g, pcx - rw + 3, pcy + rh, rw * 2 - 5, 2, C.leafD);
      blobs.forEach(([x, y, a, b]) => ell(g, x, y, a, b, C.leaf, 0));
      blobs.forEach(([x, y, a, b]) => ell(g, x - 1, y - 1, Math.max(1, a - 2), Math.max(1, b - 1), C.leafL, 1));
      blobs.slice(1).forEach(([x, y, a, b]) => R(g, x - a * 0.4, y - b, Math.max(1, Math.round(a * 0.5)), 1, C.leafW));
      tree.canopy.push([Math.round(pcx), Math.round(pcy), Math.max(3, Math.round(rw / 2))]);
    }
    pad(-44, -48, 34, 4, 12);  // big left pad
    pad(-38, -52, 20, 3, 17);  // left upper layer
    pad(28, -59, 22, 3, 18);   // under-layer below the top
    pad(98, -59, 26, 4, 14);   // right lower pad
    pad(32, -71, 74, 8, 11);   // huge flat top
    pad(18, -79, 40, 4, 19);   // crown layer
    tree.topX = tx; tree.tt = tb - Math.round(83 * s);
    {
      const [p1x, p1y] = A(19, -38), [p2x, p2y] = A(30, -42);
      const gx2 = Math.round((p1x + p2x) / 2);
      tree.swing = { p1: [p1x, p1y], p2: [p2x, p2y], L: Math.max(12, surf(gx2) - 6 - (p1y + p2y) / 2), half: Math.max(4, Math.round(7 * s)) };
    }

    tree.lamp = null;
    // walking siamese cat path (drawn every frame)
    tree.cat = { x: Math.round(tx - 16 * s) - 12 };
    hill.surf = surf;
    // glove lying on the hill (fingers pointing right)
    const gx = tx - 12, gy = surf(gx) + 9;
    R(g, gx - 3, gy - 4, 3, 5, '#d9a93f');           // cuff
    R(g, gx, gy - 4, 5, 5, '#f3d36b');               // palm
    R(g, gx + 5, gy - 4, 4, 5, '#f3d36b');           // fingers
    R(g, gx + 5, gy - 3, 4, 1, '#d9a93f'); R(g, gx + 5, gy - 1, 3, 1, '#d9a93f');
    R(g, gx + 9, gy - 4, 1, 1, '#f3d36b');
    R(g, gx + 1, gy - 6, 3, 2, '#f3d36b');           // thumb
    R(g, gx + 1, gy - 3, 3, 1, '#f8e59a');
    R(g, gx - 3, gy + 1, 13, 1, '#e3b08f');           // shadow

    // mushrooms
    const mx = tx + 30, my = surf(mx) + 4;
    [[0, 0, 2], [4, 1, 1]].forEach(([ox, oy, sz]) => {
      R(g, mx + ox, my + oy - sz, 1, sz + 1, C.stem);
      for (let dy = 0; dy <= sz; dy++) { const hw = sz + 1 - dy; R(g, mx + ox - hw + 1, my + oy - sz - dy, hw * 2 - 1, 1, C.mush); }
    });

    // ----- clouds -----
    clouds = [];
    const addCloud = (layer, count, yMin, yMax, sMin, sMax, speed) => {
      for (let i = 0; i < count; i++) {
        const n = 3 + Math.floor(r() * 3), parts = [];
        const scale = sMin + r() * (sMax - sMin);
        let x = 0;
        for (let k = 0; k < n; k++) {
          const rr = Math.round(scale * (0.55 + r() * 0.5) * (k === 0 || k === n - 1 ? 0.7 : 1));
          parts.push([x, -Math.round(rr * 0.35), rr]);
          x += Math.round(rr * 1.1);
        }
        clouds.push({ layer, parts, span: x + scale * 2, x0: r() * (W + 200), y: Math.round(yMin + r() * (yMax - yMin)), speed: speed * (0.8 + r() * 0.4) });
      }
    };
    const cloudCount = Math.max(4, Math.round(W / 45));

    addCloud(1, 2, 12, Math.max(24, hz * 0.35), 6, 9, 3);
    addCloud(2, 2, hz * 0.3, hz * 0.5, 5, 8, 4.5);
    // huge soft cloud banks in the middle of the sky
    const bigN = 2;
    for (let i = 0; i < bigN; i++) {
      const scale = Math.round(Math.max(22, Math.min(H * 0.24, W * 0.26)) * (0.95 + r() * 0.15));
      const n = 5 + Math.floor(r() * 3), parts = [];
      let x = 0;
      for (let k = 0; k < n; k++) {
        const u = k / (n - 1), bump = Math.sin(u * Math.PI);
        const rr = Math.round(scale * (0.45 + bump * 0.55) * (0.85 + r() * 0.3));
        parts.push([x, -Math.round(rr * 0.55 + bump * scale * 0.25), rr]);
        x += Math.round(rr * (0.9 + r() * 0.3));
      }
      clouds.push({ layer: 3, parts, span: x + scale * 2, x0: 0, y: hz - 2 - i * 4, speed: 1.6, dots: Array.from({ length: 6 }, () => [r(), r()]) });
    }
    {
      const big = clouds.filter(c => c.layer === 3);
      const span = Math.max(...big.map(c => c.span));
      big.forEach(c => c.span = span);
      const cycle = W + span + 60;
      big[0].x0 = span * 0.55 + 30;
      big[1].x0 = big[0].x0 + cycle / 2;
    }

    // ----- petals -----
    petals = [];
    for (let i = 0; i < Math.round(W * 0.25) + 20; i++) petals.push(newPetal(true));

    // ----- sparkles -----
    sparkles = [];
    for (let i = 0; i < 14; i++) sparkles.push({ x: Math.floor(r() * W), y: Math.floor(r() * hz * 0.8), p: r() * 6 });

    // ----- foreground grass: layers of triangular waves stepping down -----
    const rb = rng(77);
    const edge = x => 1 + 1.3 * Math.pow(Math.abs(x - W / 2) / (W / 2), 2);
    const gy0 = H - Math.round(H * 0.2);
    const avail = Math.max(10, gy0 - hill.top - hill.ry * 0.7);
    blades = [];
    const layers = [
      { base: gy0, hMin: 0.12, hMax: 0.26, wMin: 9, wMax: 16, fill: '#f0a6bb', hi: '#f5bccb' },
      { base: gy0 + Math.round(H * 0.07), hMin: 0.09, hMax: 0.2, wMin: 10, wMax: 18, fill: '#f6bccb', hi: '#fad0db' },
      { base: gy0 + Math.round(H * 0.14), hMin: 0.06, hMax: 0.14, wMin: 12, wMax: 20, fill: '#fbd2dc', hi: '#fde2e8' }
    ];
    layers.forEach((L, k) => {
      L.teeth = [];
      let x = -10 - rb() * 8;
      while (x < W + 10) {
        const w = L.wMin + Math.floor(rb() * (L.wMax - L.wMin));
        const h = Math.round(avail * (1 - k * 0.2) * (0.45 + rb() * 0.55) * edge(x));
        L.teeth.push({ x, w, h, lean: (rb() - 0.4) * w * 0.6, ph: rb() * 6 });
        x += w * (0.75 + rb() * 0.25);
      }
      blades.push(L);
    });
    cv.style.width = W * PX + 'px';
    cv.style.height = H * PX + 'px';
  }

  // tiny siamese cat, standing still with idle motion
  function drawCat(t) {
    const P = { cream: '#f5e9d6', shade: '#dfc9ab', dark: '#5a3e35', dark2: '#443029', eye: '#72b8ee', nose: '#d98c98' };
    const x = tree.cat.x, gy = hill.surf(x + 6) + 1, oy = gy - 9;
    const px = (lx, ly, w, h, col) => R(ctx, x + lx, oy + ly, w, h, col);
    const wag = [0, -1, -1, 0][Math.floor(t / 0.35) % 4];
    R(ctx, x + 1, gy, 11, 1, 'rgba(160,100,90,0.25)');
    px(0, 3, 3, 1, P.dark);
    px(-1, 1 + wag, 1, 3, P.dark2);
    [3, 5, 7, 9].forEach(lx => px(lx, 7, 1, 2, P.dark));
    px(2, 3, 7, 4, P.cream);
    px(2, 6, 7, 1, P.shade);
    const hy = Math.floor(t / 1.3) % 2;
    px(7, hy, 5, 5, P.cream);
    px(7, hy - 1, 1, 1, P.dark); px(11, hy - 1, 1, 1, P.dark);
    px(8, hy + 2, 3, 3, P.dark);
    const blink = (t % 4) < 0.15;
    if (!blink) { px(8, hy + 2, 1, 1, P.eye); px(10, hy + 2, 1, 1, P.eye); }
    px(9, hy + 4, 1, 1, P.nose);
  }

  function newPetal(anywhere) {
    const c = tree.canopy[Math.floor(Math.random() * tree.canopy.length)];
    return {
      x: anywhere ? Math.random() * W : c[0] + (Math.random() - 0.5) * c[2] * 1.6,
      y: anywhere ? Math.random() * H : c[1] + (Math.random() - 0.3) * c[2],
      vx: 3 + Math.random() * 6, vy: 4 + Math.random() * 5,
      ph: Math.random() * 6, col: C.petal[Math.floor(Math.random() * C.petal.length)],
      big: Math.random() < 0.35
    };
  }

  function drawBigCloud(cl, t) {
    const x = Math.round(((cl.x0 + t * cl.speed) % (W + cl.span + 60)) - cl.span - 30);
    let minX = Infinity, maxX = -Infinity;
    cl.parts.forEach(([dx, dy, r]) => { minX = Math.min(minX, x + dx - r); maxX = Math.max(maxX, x + dx + r); });
    cl.parts.forEach(([dx, dy, r]) => disc(ctx, x + dx + 2, cl.y + dy + 4, r, '#eebccb'));
    R(ctx, minX + 4, cl.y - 6, maxX - minX - 6, 40, '#eebccb');
    cl.parts.forEach(([dx, dy, r]) => disc(ctx, x + dx, cl.y + dy, r, '#fdf1f2'));
    R(ctx, minX + 3, cl.y - 8, maxX - minX - 7, 40, '#fdf1f2');
    cl.parts.forEach(([dx, dy, r]) => disc(ctx, x + dx - 3, cl.y + dy - 3, r - 4, '#fff8f6'));
    cl.parts.forEach(([dx, dy, r]) => ditherDisc(ctx, x + dx - 5, cl.y + dy - 6, Math.max(2, r - 10), '#ffffff'));
    cl.dots.forEach(([a, b], i) => {
      const [dx, dy, r] = cl.parts[i % cl.parts.length];
      R(ctx, x + dx + (a - 0.5) * r, cl.y + dy + (b - 0.7) * r, 1, 1, '#ffffff');
    });
  }

  function drawCloud(cl, t) {
    const x = ((cl.x0 + t * cl.speed) % (W + cl.span + 40)) - cl.span - 20;
    const far = cl.layer === 0;
    const L = far ? C.cloudFarL : C.cloudL, S = far ? C.cloudFarS : C.cloudS;
    let minX = Infinity, maxX = -Infinity;
    cl.parts.forEach(([dx, dy, r]) => { disc(ctx, x + dx, cl.y + dy + 2, r, S); minX = Math.min(minX, x + dx - r); maxX = Math.max(maxX, x + dx + r); });
    cl.parts.forEach(([dx, dy, r]) => disc(ctx, x + dx, cl.y + dy, r, L));
    // flat bottom
    R(ctx, minX + 2, cl.y + 1, maxX - minX - 3, 3, S);
    R(ctx, minX + 3, cl.y, maxX - minX - 5, 1, L);
    if (!far) cl.parts.forEach(([dx, dy, r]) => R(ctx, x + dx - Math.floor(r / 2), cl.y + dy - r + 2, Math.max(1, Math.floor(r / 2)), 1, '#ffffff'));
  }

  function tooth(T, base, t, k, col, grow) {
    const sway = Math.sin(t * 1.3 + T.x * 0.05 + T.ph + k) * 2.5;
    const h = T.h + grow;
    for (let i = 0; i <= h; i++) {
      const f = i / h;
      const half = (T.w / 2 + grow * 0.5) * (1 - f);
      const cx2 = T.x + T.w / 2 + (T.lean + sway) * f * f;
      R(ctx, cx2 - half, base - i, Math.max(1, Math.round(half * 2)), 1, col);
    }
  }
  function drawGrassLayer(L, t, k) {
    const OUT = '#c9708c';
    R(ctx, 0, L.base - 1, W, H - L.base + 1, OUT);
    L.teeth.forEach(T => tooth(T, L.base, t, k, OUT, 2));
    R(ctx, 0, L.base, W, H - L.base, L.fill);
    L.teeth.forEach(T => tooth(T, L.base, t, k, L.fill, 0));
    L.teeth.forEach(T => { R(ctx, T.x + T.w * 0.35, L.base - Math.round(T.h * 0.35), 1, Math.round(T.h * 0.25), L.hi); });
  }

  let last = performance.now(), T = 0, push = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    T += dt;
    const t = T;

    ctx.drawImage(skyLayer, 0, 0);
    sparkles.forEach(s => {
      const v = Math.sin(t * 2 + s.p);
      if (v > 0.3) {
        R(ctx, s.x, s.y, 1, 1, '#ffffff');
        if (v > 0.85) { R(ctx, s.x - 1, s.y, 1, 1, '#fff5f7'); R(ctx, s.x + 1, s.y, 1, 1, '#fff5f7'); R(ctx, s.x, s.y - 1, 1, 1, '#fff5f7'); R(ctx, s.x, s.y + 1, 1, 1, '#fff5f7'); }
      }
    });
    clouds.filter(c => c.layer === 1).forEach(c => drawCloud(c, t));
    clouds.filter(c => c.layer === 2).forEach(c => drawCloud(c, t));
    clouds.filter(c => c.layer === 3).forEach(c => drawBigCloud(c, t));
    clouds.filter(c => c.layer === 0).forEach(c => drawCloud(c, t));
    ctx.drawImage(landLayer, 0, 0);

    push *= 0.985;

    drawCat(t);

    {
      const sg = tree.swing, a = Math.sin(t * 1.6) * (0.6 + push);
      const k = Math.sin(a);                       
      const drop = sg.L * Math.cos(a) + k * 3;    
      const mx = (sg.p1[0] + sg.p2[0]) / 2, my = (sg.p1[1] + sg.p2[1]) / 2;
      const half = Math.round(sg.half * (1 + k * 0.18));
      const sy = Math.round(my + drop), lx = Math.round(mx - half), rx2 = Math.round(mx + half);
      line(ctx, sg.p1[0], sg.p1[1], lx + 1, sy - 1, C.rope);
      line(ctx, sg.p2[0], sg.p2[1], rx2 - 1, sy - 1, C.rope);
      const th = 1 + Math.round(Math.abs(k) * 3);   
      if (k > 0.05) { R(ctx, lx, sy - th, rx2 - lx + 1, th, '#d8977a'); R(ctx, lx, sy, rx2 - lx + 1, 2, C.seat); }
      else if (k < -0.05) { R(ctx, lx, sy, rx2 - lx + 1, 2, C.seat); R(ctx, lx + 1, sy + 2, rx2 - lx - 1, th, C.seatD); }
      else { R(ctx, lx, sy, rx2 - lx + 1, 2, C.seat); R(ctx, lx, sy + 2, rx2 - lx + 1, 1, C.seatD); }
    }

    petals.forEach((p, i) => {
      p.x += (p.vx + Math.sin(t * 2 + p.ph) * 4) * dt;
      p.y += p.vy * dt;
      if (p.y > H || p.x > W + 4) petals[i] = newPetal(false);
      const flip = Math.sin(t * 5 + p.ph) > 0;
      R(ctx, p.x, p.y, p.big && flip ? 2 : 1, 1, p.col);
      if (p.big && !flip) R(ctx, p.x, p.y + 1, 1, 1, p.col);
    });

    blades.forEach((L, k) => drawGrassLayer(L, t, k));

    if (!reduce) requestAnimationFrame(frame);
  }

  cv.addEventListener('pointerdown', e => {
    push = Math.min(0.5, push + 0.3);
    const x = e.clientX / PX, y = e.clientY / PX;
    for (let i = 0; i < 18; i++) {
      const p = newPetal(false); p.x = x + (Math.random() - 0.5) * 10; p.y = y + (Math.random() - 0.5) * 10;
      petals.push(p);
    }
    if (petals.length > 400) petals.splice(0, petals.length - 400);
    if (reduce) requestAnimationFrame(frame);
  });

  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { build(); if (reduce) requestAnimationFrame(frame); }, 120); });
  build();
  requestAnimationFrame(frame);
})();