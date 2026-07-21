// ================================================================
//  KidAvatar — shared face/body for all CodersPlug games
//  localStorage key: codersplug_kid_avatar (same origin)
//  Keep this file identical across repos that use it.
// ================================================================
window.KidAvatar = (() => {
  const KEY = 'codersplug_kid_avatar';

  const SKIN = [0xffe0bd, 0xffcd94, 0xd4a574, 0xc68642, 0x8d5524, 0x4a2912];
  const HAIR_COLORS = [0x1a0a00, 0x3d1c02, 0x8b5e3c, 0xd4a017, 0xe85d04, 0xf4a0c0];
  // 0 corto, 1 rizado, 2 largo, 3 coleta, 4 moño arriba, 5 flequillo
  const HAIR_COUNT = 6;
  // 0 redondos, 1 felices (⌒), 2 grandes
  const EYE_COUNT = 3;
  // 0 sonrisa, 1 abierta, 2 gatito
  const MOUTH_COUNT = 3;
  const TOPS = [
    { body: 0xff6eb4, accent: 0xffffff },
    { body: 0x75aadb, accent: 0xffffff },
    { body: 0x44c767, accent: 0xffffff },
    { body: 0xffd700, accent: 0x7a5230 },
    { body: 0x9b59b6, accent: 0xffffff },
  ];
  // 0 ninguno, 1 moño, 2 lentes, 3 vincha
  const ACC_COUNT = 4;

  const DEFAULT = {
    v: 1, skin: 1, hair: 2, hairColor: 1, eyes: 0, mouth: 0, top: 0, accessory: 1,
  };

  function clamp(s) {
    return {
      v: 1,
      skin: Math.max(0, Math.min(SKIN.length - 1, s.skin | 0)),
      hair: Math.max(0, Math.min(HAIR_COUNT - 1, s.hair | 0)),
      hairColor: Math.max(0, Math.min(HAIR_COLORS.length - 1, s.hairColor | 0)),
      eyes: Math.max(0, Math.min(EYE_COUNT - 1, s.eyes | 0)),
      mouth: Math.max(0, Math.min(MOUTH_COUNT - 1, s.mouth | 0)),
      top: Math.max(0, Math.min(TOPS.length - 1, s.top | 0)),
      accessory: Math.max(0, Math.min(ACC_COUNT - 1, s.accessory | 0)),
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...DEFAULT };
      return clamp({ ...DEFAULT, ...JSON.parse(raw) });
    } catch (_) {
      return { ...DEFAULT };
    }
  }

  function save(s) {
    try { localStorage.setItem(KEY, JSON.stringify(clamp(s))); } catch (_) {}
  }

  function drawHair(g, cx, cy, r, style, color) {
    g.fillStyle(color, 1);
    if (style === 0) { // corto
      g.fillEllipse(cx, cy - r * 0.55, r * 1.7, r * 0.9);
    } else if (style === 1) { // rizado
      g.fillCircle(cx - r * 0.55, cy - r * 0.35, r * 0.45);
      g.fillCircle(cx, cy - r * 0.65, r * 0.5);
      g.fillCircle(cx + r * 0.55, cy - r * 0.35, r * 0.45);
      g.fillCircle(cx - r * 0.85, cy - r * 0.05, r * 0.35);
      g.fillCircle(cx + r * 0.85, cy - r * 0.05, r * 0.35);
    } else if (style === 2) { // largo
      g.fillEllipse(cx, cy - r * 0.35, r * 1.85, r * 1.2);
      g.fillEllipse(cx - r * 0.75, cy + r * 0.35, r * 0.55, r * 1.1);
      g.fillEllipse(cx + r * 0.75, cy + r * 0.35, r * 0.55, r * 1.1);
    } else if (style === 3) { // coleta
      g.fillEllipse(cx, cy - r * 0.5, r * 1.6, r * 0.85);
      g.fillCircle(cx + r * 0.95, cy + r * 0.15, r * 0.42);
      g.fillCircle(cx + r * 1.15, cy + r * 0.55, r * 0.32);
    } else if (style === 4) { // moño arriba
      g.fillEllipse(cx, cy - r * 0.45, r * 1.55, r * 0.75);
      g.fillCircle(cx - r * 0.35, cy - r * 1.15, r * 0.38);
      g.fillCircle(cx + r * 0.35, cy - r * 1.15, r * 0.38);
      g.fillCircle(cx, cy - r * 1.0, r * 0.28);
    } else { // flequillo
      g.fillEllipse(cx, cy - r * 0.5, r * 1.7, r * 0.95);
      g.fillEllipse(cx, cy - r * 0.15, r * 1.5, r * 0.55);
    }
  }

  function drawEyes(g, cx, cy, r, style) {
    const ey = cy - r * 0.08;
    const ex = r * 0.38;
    if (style === 1) { // felices — arcs via thick dots (Safari-safe)
      g.fillStyle(0x2a2030, 1);
      for (const side of [-1, 1]) {
        const ox = cx + side * ex;
        g.fillCircle(ox - r * 0.12, ey, r * 0.08);
        g.fillCircle(ox, ey - r * 0.06, r * 0.08);
        g.fillCircle(ox + r * 0.12, ey, r * 0.08);
      }
      return;
    }
    const er = style === 2 ? r * 0.28 : r * 0.22;
    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx - ex, ey, er);
    g.fillCircle(cx + ex, ey, er);
    g.fillStyle(0x2a2030, 1);
    g.fillCircle(cx - ex + er * 0.15, ey + er * 0.05, er * 0.48);
    g.fillCircle(cx + ex + er * 0.15, ey + er * 0.05, er * 0.48);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(cx - ex + er * 0.35, ey - er * 0.25, er * 0.18);
    g.fillCircle(cx + ex + er * 0.35, ey - er * 0.25, er * 0.18);
  }

  function drawMouth(g, cx, cy, r, style) {
    const my = cy + r * 0.42;
    if (style === 0) {
      g.fillStyle(0xe07090, 1);
      g.fillEllipse(cx, my, r * 0.36, r * 0.16);
    } else if (style === 1) {
      g.fillStyle(0xcc4466, 1);
      g.fillEllipse(cx, my, r * 0.35, r * 0.28);
      g.fillStyle(0xff99aa, 1);
      g.fillEllipse(cx, my + r * 0.05, r * 0.2, r * 0.12);
    } else {
      g.fillStyle(0x2a2030, 1);
      g.fillTriangle(cx - r * 0.2, my - r * 0.05, cx, my + r * 0.15, cx + r * 0.2, my - r * 0.05);
    }
  }

  function drawAccessory(g, cx, cy, r, acc) {
    if (acc === 1) { // moño rosa
      g.fillStyle(0xff6eb4, 1);
      g.fillTriangle(cx - r * 0.55, cy - r * 0.95, cx - r * 0.05, cy - r * 0.7, cx - r * 0.55, cy - r * 0.5);
      g.fillTriangle(cx + r * 0.55, cy - r * 0.95, cx + r * 0.05, cy - r * 0.7, cx + r * 0.55, cy - r * 0.5);
      g.fillCircle(cx, cy - r * 0.72, r * 0.18);
    } else if (acc === 2) { // lentes — rings via thick circles
      g.fillStyle(0x2a2030, 1);
      g.fillCircle(cx - r * 0.38, cy - r * 0.08, r * 0.34);
      g.fillCircle(cx + r * 0.38, cy - r * 0.08, r * 0.34);
      g.fillStyle(0xffffff, 0.35);
      g.fillCircle(cx - r * 0.38, cy - r * 0.08, r * 0.26);
      g.fillCircle(cx + r * 0.38, cy - r * 0.08, r * 0.26);
      g.fillStyle(0x2a2030, 1);
      g.fillRect(cx - r * 0.08, cy - r * 0.12, r * 0.16, r * 0.08);
    } else if (acc === 3) { // vincha
      g.fillStyle(0xffd700, 1);
      g.fillEllipse(cx, cy - r * 0.55, r * 1.65, r * 0.35);
      g.fillStyle(0xff6eb4, 1);
      g.fillCircle(cx, cy - r * 0.7, r * 0.2);
    }
  }

  /** Head/face only — for chess-piece overlays. (cx,cy) = head center, r = head radius. */
  function drawHead(g, cx, cy, r, state) {
    const s = clamp(state || load());
    const skin = SKIN[s.skin];
    const hairC = HAIR_COLORS[s.hairColor];
    drawHair(g, cx, cy, r, s.hair, hairC);
    g.fillStyle(skin, 1);
    g.fillCircle(cx, cy, r);
    // blush
    g.fillStyle(0xffb3d9, 0.55);
    g.fillCircle(cx - r * 0.55, cy + r * 0.2, r * 0.22);
    g.fillCircle(cx + r * 0.55, cy + r * 0.2, r * 0.22);
    drawEyes(g, cx, cy, r, s.eyes);
    drawMouth(g, cx, cy, r, s.mouth);
    drawAccessory(g, cx, cy, r, s.accessory);
    // hair bangs on top of face for some styles
    if (s.hair === 5) {
      g.fillStyle(hairC, 1);
      g.fillEllipse(cx, cy - r * 0.35, r * 1.35, r * 0.45);
    }
  }

  /** Full-body Duolingo-ish avatar for the creator. scale ~1 = ~200px tall. */
  function drawFull(g, cx, cy, scale, state) {
    const s = clamp(state || load());
    const skin = SKIN[s.skin];
    const top = TOPS[s.top];
    const headR = 38 * scale;
    const bodyW = 56 * scale;
    const bodyH = 70 * scale;

    // shadow
    g.fillStyle(0x000000, 0.15);
    g.fillEllipse(cx, cy + 110 * scale, 70 * scale, 14 * scale);

    // legs
    g.fillStyle(0x5a4a3a, 1);
    g.fillRoundedRect(cx - 22 * scale, cy + 55 * scale, 18 * scale, 40 * scale, 6 * scale);
    g.fillRoundedRect(cx + 4 * scale, cy + 55 * scale, 18 * scale, 40 * scale, 6 * scale);
    // shoes
    g.fillStyle(0xff6eb4, 1);
    g.fillRoundedRect(cx - 26 * scale, cy + 88 * scale, 24 * scale, 12 * scale, 5 * scale);
    g.fillRoundedRect(cx + 2 * scale, cy + 88 * scale, 24 * scale, 12 * scale, 5 * scale);

    // body / top
    g.fillStyle(top.body, 1);
    g.fillRoundedRect(cx - bodyW / 2, cy - 5 * scale, bodyW, bodyH, 16 * scale);
    g.fillStyle(top.accent, 0.85);
    g.fillCircle(cx, cy + 20 * scale, 10 * scale);

    // arms
    g.fillStyle(skin, 1);
    g.fillRoundedRect(cx - bodyW / 2 - 14 * scale, cy + 5 * scale, 14 * scale, 40 * scale, 7 * scale);
    g.fillRoundedRect(cx + bodyW / 2, cy + 5 * scale, 14 * scale, 40 * scale, 7 * scale);

    // head
    drawHead(g, cx, cy - 45 * scale, headR, s);
  }

  return {
    KEY, SKIN, HAIR_COLORS, HAIR_COUNT, EYE_COUNT, MOUTH_COUNT, TOPS, ACC_COUNT,
    DEFAULT, load, save, clamp, drawHead, drawFull,
  };
})();
