// =============================================================
//  Garden Defense — Chess Edition — simple PvZ for ~6 year olds
//  Defend the pink castle! White pawns charge sun energy,
//  white rooks fire star bolts at the black chess army.
// =============================================================

const GW = 1024;
const GH = 576;
const VERSION = '3.1';
const GAME_ID = 'gardenDefense';
const SUN_HIT_RADIUS = 56; // generous for small fingers on touch screens
const MAX_PLAYS_PER_DAY = 5;
const PLAY_STORAGE_KEY  = 'phaserlab_daily_plays'; // shared with PhaserLab (same origin)

const HUD_Y = 36;
const HUD_BAR_H = 56;
const PICKER_H = 110;
const LAWN_X = 130;
const LAWN_Y = 72;
const LAWN_W = 820;
const LAWN_H = GH - PICKER_H - LAWN_Y - 12;
const ROWS = 5;
const COLS = 6;
const CELL_W = LAWN_W / COLS;
const CELL_H = LAWN_H / ROWS;
const CASTLE_X = 48;

const START_SUN = 75;
const SUN_VALUE = 25;
const SUN_DROP_MS = 5500;
const PAWN_COST = 25;
const PAWN_SUN_MS = 9000;
const ROOK_COST = 50;
const ROOK_SHOOT_MS = 1300;
const BOLT_SPEED = 340;
const BOLT_DAMAGE = 1;
const PAWN_HP = 3;
const PAWN_SPEED = 28;
const PAWN_SPAWN_MS = 4200;
const MAX_HEARTS = 5;

const BOSS_HP = 12;
const BOSS_SPEED = 16;

const WAVES = [
  { count: 4, label: 1 },
  { count: 6, label: 2 },
  { count: 3, label: 3, boss: true },
];

// Visual-only constants (gameplay untouched)
const C_SKY_TOP = '#b8f0d8';
const C_SKY_BOTTOM = '#d4f5c4';
const CLOUD_DRIFT_SPEED = 22;
const PLANT_SWAY_AMP = 2.5;
const ZOMBIE_BOB_AMP = 3;

const C = {
  sky:        C_SKY_BOTTOM,
  boardLight: 0xfff3e0,
  boardDark:  0xf2a6d1,
  boardAccent:0xffe0f0,
  house:      0xffb3d9,
  castle:     0xffb3d9,
  whiteBody:  0xfff8ef,
  whiteShade: 0xf0dfd0,
  whiteTrim:  0xff9ed2,
  sun:        0xffd23f,
  blackBody:  0x4a3f7a,
  blackShade: 0x332b5c,
  bolt:       0xfff2a8,
  crownGold:  0xffd23f,
  crownGoldD: 0xc8941f,
  wood:       0xc98a4b,
  woodD:      0x9a6b35,
};

// ── SFX (Web Audio) ───────────────────────────────────────────
const SFX = (() => {
  let ctx = null;
  const get = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  };
  const tone = (freq, freqEnd, type, dur, vol) => {
    try {
      const c = get();
      const o = c.createOscillator();
      const g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, c.currentTime);
      if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, c.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.22, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      o.start(c.currentTime);
      o.stop(c.currentTime + dur + 0.01);
    } catch (_) {}
  };
  return {
    sun:    () => tone(720, 1100, 'sine', 0.12, 0.2),
    plant:  () => tone(400, 520,  'sine', 0.1,  0.16),
    shoot:  () => tone(520, 680,  'triangle', 0.06, 0.1),
    hit:    () => tone(180, 120,  'square', 0.08, 0.14),
    oops:   () => tone(220, 160,  'sawtooth', 0.2, 0.18),
    win:    () => {
      tone(523, 523, 'sine', 0.14, 0.24);
      setTimeout(() => tone(659, 659, 'sine', 0.14, 0.24), 140);
      setTimeout(() => tone(784, 784, 'sine', 0.22, 0.28), 280);
    },
  };
})();

// ── Daily play limit (shared with PhaserLab via localStorage) ───
const DailyPlays = {
  today() { return new Date().toISOString().slice(0, 10); },
  load() {
    const empty = { date: this.today(), count: 0, versions: {} };
    try {
      const raw = localStorage.getItem(PLAY_STORAGE_KEY);
      if (!raw) return empty;
      const data = JSON.parse(raw);
      if (!data.versions) data.versions = {};
      let dirty = false;
      if (data.date !== this.today()) {
        data.date = this.today();
        data.count = 0;
        dirty = true;
      }
      if (data.versions[GAME_ID] !== VERSION) {
        data.count = 0;
        data.versions[GAME_ID] = VERSION;
        dirty = true;
      }
      if (dirty) this.persist(data);
      return data;
    } catch (_) {
      return empty;
    }
  },
  persist(data) {
    if (!data.versions) data.versions = {};
    data.versions[GAME_ID] = VERSION;
    localStorage.setItem(PLAY_STORAGE_KEY, JSON.stringify(data));
  },
  get() { return this.load(); },
  remaining() { return Math.max(0, MAX_PLAYS_PER_DAY - this.load().count); },
  canPlay()   { return this.remaining() > 0; },
  record() {
    const data = this.load();
    data.count++;
    this.persist(data);
  },
  reset() { localStorage.removeItem(PLAY_STORAGE_KEY); },
};

function tryStartGame(fromScene, stopScenes = []) {
  if (!DailyPlays.canPlay()) {
    stopScenes.forEach(k => fromScene.scene.stop(k));
    fromScene.scene.start('DailyLimitScene');
    return;
  }
  DailyPlays.record();
  stopScenes.forEach(k => fromScene.scene.stop(k));
  fromScene.scene.start('GameScene');
}

// ── Visual helpers ─────────────────────────────────────────────
function lerpColor(c1, c2, t) {
  const a = Phaser.Display.Color.ValueToColor(c1);
  const b = Phaser.Display.Color.ValueToColor(c2);
  const r = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, 100, Math.floor(t * 100));
  return Phaser.Display.Color.GetColor(r.r, r.g, r.b);
}

function makeSkyTexture(scene) {
  if (scene.textures.exists('skyGrad')) return;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const steps = 40;
  for (let i = 0; i < steps; i++) {
    g.fillStyle(lerpColor(C_SKY_TOP, C_SKY_BOTTOM, i / (steps - 1)));
    g.fillRect(0, Math.floor(i * GH / steps), GW, Math.ceil(GH / steps) + 1);
  }
  g.generateTexture('skyGrad', GW, GH);
  g.destroy();
}

function addSkyBackground(scene, depth = -100) {
  makeSkyTexture(scene);
  scene.add.image(GW / 2, GH / 2, 'skyGrad').setDepth(depth);
}

function addDecorativeSun(scene, depth = -95) {
  const sunX = GW - 72;
  const sunY = 58;
  scene.add.circle(sunX, sunY, 38, 0xfff9c4, 0.18).setDepth(depth);
  scene.add.circle(sunX, sunY, 26, 0xffee58, 0.35).setDepth(depth + 1);
  scene.add.circle(sunX, sunY, 18, 0xffd23f, 0.85).setDepth(depth + 2);
}

function drawCloud(scene, x, y, scale, depth = -90) {
  const container = scene.add.container(x, y).setDepth(depth);
  const blobs = [
    { dx: 0, dy: 0, w: 90, h: 42 },
    { dx: -38, dy: 6, w: 56, h: 32 },
    { dx: 42, dy: 4, w: 64, h: 36 },
    { dx: -12, dy: -10, w: 48, h: 28 },
  ];
  blobs.forEach(b => {
    container.add(scene.add.ellipse(b.dx, b.dy, b.w * scale, b.h * scale, 0xffffff, 0.62));
  });
  const drift = () => {
    const dist = GW + 160 - container.x;
    scene.tweens.add({
      targets: container,
      x: GW + 120,
      duration: (dist / CLOUD_DRIFT_SPEED) * 1000,
      ease: 'Linear',
      onComplete: () => {
        container.x = -120;
        container.y = Phaser.Math.Between(28, 170);
        drift();
      },
    });
  };
  drift();
  return container;
}

function addDriftingClouds(scene, count = 4, depth = -90) {
  for (let i = 0; i < count; i++) {
    drawCloud(
      scene,
      Phaser.Math.Between(-80, GW),
      Phaser.Math.Between(30, 160),
      Phaser.Math.FloatBetween(0.7, 1.15),
      depth
    );
  }
}

function spawnJuice(scene, x, y, color, opts = {}) {
  const count = opts.count || 4;
  const size = opts.size || 6;
  const spread = opts.spread || 22;
  const duration = opts.duration || 320;
  const shape = opts.shape || 'circle';
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.4, 0.4);
    const dist = Phaser.Math.Between(spread * 0.4, spread);
    let dot;
    if (shape === 'star') {
      dot = scene.add.star(x, y, 5, size * 0.4, size, color, 0.95).setDepth(50);
    } else {
      dot = scene.add.circle(x, y, size, color, opts.alpha != null ? opts.alpha : 0.9).setDepth(50);
    }
    scene.tweens.add({
      targets: dot,
      x: x + Math.cos(ang) * dist,
      y: y + Math.sin(ang) * dist,
      alpha: 0,
      scale: opts.expand ? 2.2 : 0.15,
      angle: shape === 'star' ? Phaser.Math.Between(-90, 90) : 0,
      duration: Phaser.Math.Between(duration * 0.7, duration),
      onComplete: () => dot.destroy(),
    });
  }
}

function spawnPoof(scene, x, y) {
  for (let i = 0; i < 5; i++) {
    const s = Phaser.Math.Between(6, 14);
    const dot = scene.add.circle(x + Phaser.Math.Between(-12, 12), y + Phaser.Math.Between(-8, 8), s, 0xffffff, 0.85).setDepth(50);
    scene.tweens.add({
      targets: dot, scale: 2.5, alpha: 0, duration: 380, delay: i * 30,
      onComplete: () => dot.destroy(),
    });
  }
}

function buildStyledPlayButton(scene, x, y, radius, onTap) {
  const glow = scene.add.circle(x, y, radius + 14, 0xff6eb4, 0.25);
  scene.tweens.add({ targets: glow, scale: 1.15, alpha: 0.12, duration: 700, yoyo: true, repeat: -1 });
  const shadow = scene.add.ellipse(x, y + radius * 0.55, radius * 1.6, radius * 0.35, 0x000000, 0.15);
  const btn = scene.add.circle(x, y, radius, 0xff6eb4).setInteractive({ useHandCursor: true });
  const highlight = scene.add.circle(x, y - radius * 0.22, radius * 0.72, 0xffb3e0, 0.45);
  const icon = scene.add.text(x, y + 2, '\u25B6', {
    fontSize: Math.floor(radius * 0.75) + 'px', color: '#ffffff',
  }).setOrigin(0.5);
  scene.tweens.add({ targets: btn, scale: 1.06, duration: 550, yoyo: true, repeat: -1 });
  btn.on('pointerdown', onTap);
  return { btn, glow, shadow, highlight, icon };
}

function addPieceBorder(scene, y, depth = 5) {
  const colors = [0xffffff, 0x4a3f7a, 0xff6eb4, 0xffd23f, 0xf2a6d1];
  const count = 14;
  const step = GW / (count + 1);
  for (let i = 0; i < count; i++) {
    const fx = step * (i + 1);
    scene.add.rectangle(fx, y + 18, 4, 22, 0x8a6a4b, 0.8).setDepth(depth);
    scene.add.circle(fx, y, 10, colors[i % colors.length], 0.9).setDepth(depth + 1);
  }
}

function makeTextures(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const avatar = KidAvatar.load();

  // Castle — pink highlights, door shadow, windows, heart flag
  g.clear();
  g.fillStyle(0xe88ab8); g.fillRoundedRect(16, 40, 48, 52, 4);
  g.fillStyle(C.castle);
  g.fillRoundedRect(18, 38, 44, 52, 4);
  g.fillRoundedRect(4, 28, 20, 62, 4);
  g.fillRoundedRect(56, 28, 20, 62, 4);
  g.fillStyle(0xffcce8);
  g.fillRoundedRect(6, 30, 6, 50, 2);
  g.fillRoundedRect(58, 30, 6, 50, 2);
  g.fillStyle(0xff9ed2);
  for (let i = 0; i < 3; i++) { g.fillRect(6 + i * 6, 22, 5, 8); g.fillRect(58 + i * 6, 22, 5, 8); }
  for (let i = 0; i < 5; i++) g.fillRect(20 + i * 8, 32, 5, 8);
  g.fillStyle(0xcc3388); g.fillRoundedRect(34, 62, 14, 28, 4);
  g.fillStyle(0xff4da6); g.fillRoundedRect(35, 63, 12, 26, 3);
  g.fillStyle(0x88ccff, 0.7);
  g.fillCircle(14, 48, 3); g.fillCircle(66, 48, 3); g.fillCircle(40, 48, 3);
  g.fillStyle(0xff6eb4); g.fillCircle(40, 14, 7);
  g.fillStyle(0xffffff); g.fillRect(38, 4, 4, 12);
  g.fillStyle(0xff4da6);
  g.fillCircle(40, 2, 4);
  g.generateTexture('castle', 80, 100);

  // White Pawn — ivory body + KidAvatar face (remove+rebuild so avatar stays current)
  if (scene.textures.exists('whitePawn')) scene.textures.remove('whitePawn');
  g.clear();
  g.fillStyle(C.whiteShade, 0.6); g.fillEllipse(34, 60, 20, 8);
  g.fillStyle(C.whiteBody); g.fillRoundedRect(20, 50, 28, 14, 6);
  g.fillStyle(C.whiteShade); g.fillEllipse(34, 44, 20, 10);
  g.fillStyle(C.whiteBody); g.fillCircle(34, 38, 17);
  g.fillStyle(C.whiteTrim); g.fillEllipse(34, 27, 19, 6);
  g.fillStyle(C.crownGold);
  g.fillTriangle(34, 37, 31, 44, 37, 44);
  g.fillTriangle(28, 41, 34, 44, 40, 41);
  KidAvatar.drawHead(g, 34, 18, 12, avatar);
  g.generateTexture('whitePawn', 68, 68);

  // White Rook — ivory tower + KidAvatar face (remove+rebuild so avatar stays current)
  if (scene.textures.exists('whiteRook')) scene.textures.remove('whiteRook');
  g.clear();
  g.fillStyle(C.whiteShade, 0.6); g.fillEllipse(34, 58, 24, 10);
  g.fillStyle(C.whiteBody); g.fillRoundedRect(16, 48, 36, 10, 4);
  g.fillStyle(C.whiteBody); g.fillRoundedRect(14, 20, 40, 34, 8);
  g.fillStyle(C.whiteShade, 0.5); g.fillRoundedRect(14, 40, 40, 12, 6);
  g.fillStyle(C.whiteBody);
  for (let i = 0; i < 4; i++) g.fillRect(16 + i * 10, 8, 8, 14);
  g.fillStyle(C.whiteTrim); g.fillRect(16, 20, 40, 4);
  g.fillStyle(C.whiteTrim);
  g.fillTriangle(28, 47, 34, 53, 30, 53);
  g.fillTriangle(40, 47, 38, 53, 34, 53);
  KidAvatar.drawHead(g, 34, 30, 12, avatar);
  g.generateTexture('whiteRook', 68, 68);

  // Sun collectible — rays + glow ring
  g.clear();
  g.fillStyle(0xfff9c4, 0.35); g.fillCircle(22, 22, 21);
  g.fillStyle(0xffc107);
  for (let i = 0; i < 8; i++) {
    const ang = i * Math.PI / 4;
    g.fillTriangle(
      22 + Math.cos(ang) * 10, 22 + Math.sin(ang) * 10,
      22 + Math.cos(ang - 0.15) * 22, 22 + Math.sin(ang - 0.15) * 22,
      22 + Math.cos(ang + 0.15) * 22, 22 + Math.sin(ang + 0.15) * 22
    );
  }
  g.fillStyle(0xc8941f); g.fillCircle(22, 22, 18);
  g.fillStyle(C.sun);    g.fillCircle(22, 22, 15);
  g.fillStyle(0xfff9c4); g.fillCircle(16, 16, 5);
  g.generateTexture('sun', 44, 44);

  // Black Pawn (was Bowser Jr) — round dark body, collar ring, flame tuft, cute-villain face
  g.clear();
  g.lineStyle(3, C.blackShade, 0.6);
  g.fillStyle(C.blackBody); g.fillEllipse(24, 38, 22, 24);
  g.strokeEllipse(24, 38, 22, 24);
  g.fillStyle(0x5d4fa0); g.fillEllipse(24, 30, 20, 6);
  g.fillCircle(24, 18, 17);
  g.strokeCircle(24, 18, 17);
  g.fillStyle(0xff6622);
  g.fillTriangle(24, 0, 12, 14, 36, 14);
  g.fillTriangle(16, 6, 10, 16, 20, 14);
  g.fillTriangle(32, 6, 28, 14, 38, 16);
  g.fillStyle(0xffcc66); g.fillEllipse(24, 22, 14, 11);
  g.fillStyle(0xffffff); g.fillCircle(17, 16, 5); g.fillCircle(31, 16, 5);
  g.fillStyle(0x222222); g.fillCircle(17, 17, 2.5); g.fillCircle(31, 17, 2.5);
  g.fillStyle(0xffffff); g.fillTriangle(20, 26, 19, 31, 21, 31); g.fillTriangle(28, 26, 27, 31, 29, 31);
  g.fillStyle(0xfff5e0); g.fillTriangle(11, 13, 8, 4, 13, 10); g.fillTriangle(37, 13, 35, 10, 40, 4);
  g.generateTexture('blackPawn', 48, 58);

  // Black King boss — big regal body, crown, cape, menacing but round
  g.clear();
  g.fillStyle(0x241b42); g.fillEllipse(48, 82, 50, 54);
  g.fillCircle(48, 38, 36);
  g.fillStyle(0x392a5c); g.fillEllipse(48, 78, 38, 28);
  g.fillStyle(0x2b2450);
  g.fillRoundedRect(22, 56, 52, 36, 6);
  g.fillStyle(0xffd23f, 0.35);
  g.fillRoundedRect(28, 60, 40, 14, 4);
  g.fillStyle(C.crownGold);
  g.fillRect(24, 20, 48, 8);
  g.fillTriangle(28, 20, 22, 6, 36, 20);
  g.fillTriangle(48, 20, 40, 2, 56, 20);
  g.fillTriangle(68, 20, 60, 6, 74, 20);
  g.fillStyle(0xff3355); g.fillCircle(48, 4, 5);
  g.fillStyle(0xd8c8f0); g.fillEllipse(48, 50, 30, 22);
  g.fillStyle(0xffffff);
  g.fillCircle(32, 32, 12); g.fillCircle(64, 32, 12);
  g.fillStyle(0xff6644);
  g.fillCircle(32, 34, 6); g.fillCircle(64, 34, 6);
  g.fillStyle(0x222222);
  g.fillCircle(33, 35, 3); g.fillCircle(65, 35, 3);
  g.fillStyle(0x333333);
  g.fillTriangle(22, 22, 32, 30, 44, 22);
  g.fillTriangle(52, 22, 64, 30, 74, 22);
  g.fillStyle(0xffffff);
  g.fillTriangle(36, 56, 34, 66, 42, 66);
  g.fillTriangle(60, 56, 58, 66, 66, 66);
  g.fillStyle(C.crownGold);
  g.fillTriangle(18, 26, 10, 8, 24, 20);
  g.fillTriangle(78, 26, 72, 20, 86, 8);
  g.generateTexture('blackKing', 96, 112);

  // Star bolt (was petal) — magic sparkle projectile fired by rooks
  g.clear();
  g.fillStyle(C.bolt);
  g.fillTriangle(11, 0, 2, 9, 20, 9);
  g.fillTriangle(2, 9, 20, 9, 11, 18);
  g.fillStyle(C.crownGold, 0.9); g.fillCircle(11, 9, 4);
  g.fillStyle(0xffffff, 0.8); g.fillCircle(9, 7, 1.6);
  g.generateTexture('bolt', 22, 18);

  // HUD / UI textures
  g.clear();
  g.fillStyle(0xffffff, 0.55); g.fillRoundedRect(0, 0, GW, HUD_BAR_H, 0);
  g.lineStyle(2, 0xffb3d9, 0.4); g.strokeRoundedRect(1, 1, GW - 2, HUD_BAR_H - 2, 0);
  g.generateTexture('hudBar', GW, HUD_BAR_H);

  g.clear();
  g.fillStyle(0xffffff, 0.7); g.fillRoundedRect(0, 0, 80, 36, 18);
  g.lineStyle(2, 0xffd23f, 0.5); g.strokeRoundedRect(1, 1, 78, 34, 17);
  g.generateTexture('sunPill', 80, 36);

  g.clear();
  g.fillStyle(0xffffff, 0.45); g.fillRoundedRect(0, 0, 130, 40, 12);
  g.lineStyle(2, 0xffffff, 0.25); g.strokeRoundedRect(1, 1, 128, 38, 11);
  g.generateTexture('waveBox', 130, 40);

  g.clear();
  g.fillStyle(C.wood); g.fillRoundedRect(0, 0, GW, PICKER_H, 0);
  g.fillStyle(C.woodD); g.fillRect(0, PICKER_H - 8, GW, 8);
  g.fillStyle(0xf2a6d1, 0.5); g.fillRect(0, 0, GW, 10);
  g.generateTexture('pickerShelf', GW, PICKER_H);

  g.clear();
  g.fillStyle(0xffffff, 0.35); g.fillRoundedRect(0, 0, 100, 90, 14);
  g.lineStyle(2, 0xffffff, 0.3); g.strokeRoundedRect(1, 1, 98, 88, 13);
  g.generateTexture('pickerCard', 100, 90);

  g.clear();
  g.fillStyle(0x330000, 0.8); g.fillRoundedRect(0, 0, 64, 12, 6);
  g.generateTexture('hpBarBg', 64, 12);

  g.clear();
  g.fillStyle(0x44cc44); g.fillRoundedRect(0, 0, 64, 12, 6);
  g.generateTexture('hpBarFill', 64, 12);

  g.destroy();
}

function cellCenter(col, row) {
  return {
    x: LAWN_X + col * CELL_W + CELL_W / 2,
    y: LAWN_Y + row * CELL_H + CELL_H / 2,
  };
}

function gridFromPointer(px, py) {
  if (px < LAWN_X || px > LAWN_X + LAWN_W || py < LAWN_Y || py > LAWN_Y + LAWN_H) return null;
  const col = Math.floor((px - LAWN_X) / CELL_W);
  const row = Math.floor((py - LAWN_Y) / CELL_H);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
  return { col, row };
}

function bossBarColor(pct) {
  if (pct > 0.5) return 0x44cc44;
  if (pct > 0.25) return 0xffcc00;
  return 0xff3333;
}

// ── Menu ──────────────────────────────────────────────────────
class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  preload() { makeTextures(this); }

  create() {
    addSkyBackground(this);
    addDecorativeSun(this);
    addDriftingClouds(this, 5);

    const castle = this.add.image(GW / 2, GH / 2 - 120, 'castle').setScale(1.1);
    this.tweens.add({ targets: castle, y: castle.y - 6, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    const title = this.add.text(GW / 2, GH / 2 - 30, 'Chess Defense', {
      fontSize: '42px', fontFamily: 'Arial Black, sans-serif',
      color: '#ff4da6', stroke: '#ffffff', strokeThickness: 6,
    }).setOrigin(0.5);
    this.add.text(GW / 2 + 2, GH / 2 - 28, 'Chess Defense', {
      fontSize: '42px', fontFamily: 'Arial Black, sans-serif', color: '#cc338866',
    }).setOrigin(0.5).setDepth(-1);
    this.add.text(GW / 2 - 200, GH / 2 - 30, '\u2659', { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(GW / 2 + 200, GH / 2 - 30, '\u265F', { fontSize: '32px', color: '#4a3f7a' }).setOrigin(0.5);

    const rem = DailyPlays.remaining();
    const startX = GW / 2 - (MAX_PLAYS_PER_DAY - 1) * 22;
    for (let i = 0; i < MAX_PLAYS_PER_DAY; i++) {
      this.add.text(startX + i * 44, GH / 2 + 20, i < rem ? '\u2B50' : '\u2606', {
        fontSize: '28px', color: i < rem ? '#ffd23f' : '#ffffff44',
      }).setOrigin(0.5);
    }

    buildStyledPlayButton(this, GW / 2, GH / 2 + 90, 64, () => tryStartGame(this));
    addPieceBorder(this, GH - 28);

    const versionLabel = this.add.text(8, GH - 6, 'v' + VERSION, {
      fontSize: '13px', fontFamily: 'monospace', color: '#ffffff88',
    }).setOrigin(0, 1).setInteractive();
    let holdEvt = null;
    versionLabel.on('pointerdown', () => {
      holdEvt = this.time.delayedCall(3000, () => { DailyPlays.reset(); this.scene.restart(); });
    });
    const cancelHold = () => { if (holdEvt) { holdEvt.remove(); holdEvt = null; } };
    versionLabel.on('pointerup', cancelHold);
    versionLabel.on('pointerout', cancelHold);
  }
}

// ── Main game ─────────────────────────────────────────────────
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  preload() { makeTextures(this); }

  create() {
    addSkyBackground(this);
    addDecorativeSun(this);
    addDriftingClouds(this, 4);

    // Wooden frame behind castle
    this.add.rectangle(LAWN_X - 55, LAWN_Y + LAWN_H / 2, 110, LAWN_H + 8, 0x8B6914, 0.55)
      .setStrokeStyle(3, 0x6b4f10, 0.4);

    // Chessboard grid — alternating light/dark squares
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const { x, y } = cellCenter(c, r);
        const isLight = (r + c) % 2 === 0;
        const tint = isLight ? C.boardLight : C.boardDark;
        const light = isLight ? C.boardAccent : C.boardLight;
        const tile = this.add.graphics();
        tile.fillStyle(tint, 0.7);
        tile.fillRoundedRect(x - CELL_W / 2 + 3, y - CELL_H / 2 + 3, CELL_W - 6, CELL_H - 6, 10);
        tile.fillStyle(light, 0.3);
        tile.fillRoundedRect(x - CELL_W / 2 + 5, y - CELL_H / 2 + 5, CELL_W - 10, (CELL_H - 6) * 0.3, 6);
        tile.lineStyle(2, 0xffffff, 0.15);
        tile.strokeRoundedRect(x - CELL_W / 2 + 3, y - CELL_H / 2 + 3, CELL_W - 6, CELL_H - 6, 10);
      }
    }

    const castleY = LAWN_Y + LAWN_H / 2;
    this.add.ellipse(CASTLE_X + 8, castleY + 48, 70, 18, 0x000000, 0.18);
    this.castleSprite = this.add.image(CASTLE_X, castleY, 'castle').setScale(1.15);

    this.sunCount = START_SUN;
    this.hearts = MAX_HEARTS;
    this.waveIdx = 0;
    this.spawnedThisWave = 0;
    this.enemiesAlive = 0;
    this.isOver = false;
    this.isPaused = false;
    this.selectedPiece = 'pawn';
    this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

    this.whitePieces = this.add.group();
    this.blackPieces = this.add.group();
    this.bolts = this.physics.add.group();
    this.suns = this.add.group();

    this.buildHUD();
    this.buildPicker();

    this.time.addEvent({ delay: SUN_DROP_MS, callback: () => this.dropSun(), loop: true });
    this.time.delayedCall(2000, () => this.dropSun());
    this.time.addEvent({ delay: PAWN_SPAWN_MS, callback: () => this.trySpawnEnemy(), loop: true });
    this.time.delayedCall(3000, () => this.trySpawnEnemy());

    this.input.on('pointerdown', (pointer, currentlyOver) => this.handleTap(pointer, currentlyOver));
  }

  handleTap(pointer, currentlyOver) {
    if (this.isOver || this.isPaused) return;

    for (const go of currentlyOver) {
      if (go.getData('isSun')) {
        this.collectSun(go);
        return;
      }
    }

    const x = pointer.worldX;
    const y = pointer.worldY;
    if (this.tapHitsSun(x, y)) return;
    this.onTap(x, y);
  }

  tapHitsSun(x, y, cell) {
    const points = [{ x, y }];
    if (cell) {
      const c = cellCenter(cell.col, cell.row);
      points.push(c);
    }
    let closest = null;
    let best = SUN_HIT_RADIUS;
    for (const s of this.suns.getChildren()) {
      if (!s.active || s.getData('collected')) continue;
      for (const p of points) {
        const d = Phaser.Math.Distance.Between(p.x, p.y, s.x, s.y);
        if (d < best) { closest = s; best = d; }
      }
    }
    if (closest) { this.collectSun(closest); return true; }
    return false;
  }

  setupSunHitArea(sun) {
    sun.setData('isSun', true);
    sun.setInteractive(
      new Phaser.Geom.Circle(0, 0, SUN_HIT_RADIUS),
      Phaser.Geom.Circle.Contains
    );
    this.tweens.add({ targets: sun, angle: 360, duration: 8000, repeat: -1, ease: 'Linear' });
  }

  buildHUD() {
    this.add.image(GW / 2, HUD_BAR_H / 2, 'hudBar').setOrigin(0.5);

    this.add.image(72, HUD_Y, 'sunPill').setOrigin(0.5);
    this.add.image(36, HUD_Y, 'sun').setScale(0.75);
    this.sunText = this.add.text(58, HUD_Y, '' + this.sunCount, {
      fontSize: '28px', fontFamily: 'Arial Black, sans-serif',
      color: '#ffffff', stroke: '#8a6910', strokeThickness: 4,
    }).setOrigin(0, 0.5);

    this.heartIcons = [];
    for (let i = 0; i < MAX_HEARTS; i++) {
      const h = this.add.text(GW / 2 - 88 + i * 44, HUD_Y, '\u2665', {
        fontSize: '34px', color: '#ff4da6', stroke: '#880033', strokeThickness: 4,
      }).setOrigin(0.5);
      this.heartIcons.push(h);
    }

    this.add.image(GW - 148, HUD_Y, 'waveBox').setOrigin(0.5);
    this.waveIcons = [];
    for (let i = 0; i < WAVES.length; i++) {
      const w = this.add.text(GW - 180 + i * 36, HUD_Y, '\u265F', {
        fontSize: '28px', color: '#4a3f7a', alpha: i === 0 ? 1 : 0.25,
      }).setOrigin(0.5);
      this.waveIcons.push(w);
    }

    this.add.ellipse(GW - 44, HUD_Y + 18, 38, 10, 0x000000, 0.15);
    this.pauseBtn = this.add.circle(GW - 44, HUD_Y, 28, 0xff6eb4)
      .setInteractive({ useHandCursor: true });
    this.pauseBtn.setStrokeStyle(2, 0xffffff, 0.5);
    this.pauseIcon = this.add.text(GW - 44, HUD_Y, '\u23F8', {
      fontSize: '28px', color: '#ffffff',
    }).setOrigin(0.5);
    this.pauseBtn.on('pointerdown', () => this.togglePause());

    this.add.text(8, GH - PICKER_H - 6, 'v' + VERSION, {
      fontSize: '13px', fontFamily: 'monospace', color: '#ffffff88',
    }).setOrigin(0, 1);
  }

  buildPicker() {
    const py = GH - PICKER_H / 2;
    this.add.image(GW / 2, py, 'pickerShelf').setOrigin(0.5);

    this.pickerSlots = [];
    const slots = [
      { kind: 'pawn', tex: 'whitePawn', x: GW / 2 - 120, cost: PAWN_COST },
      { kind: 'rook', tex: 'whiteRook', x: GW / 2 + 20,  cost: ROOK_COST },
    ];

    slots.forEach(({ kind, tex, x, cost }) => {
      const card = this.add.image(x, py - 4, 'pickerCard').setOrigin(0.5);
      const icon = this.add.image(x, py - 8, tex).setScale(0.82)
        .setInteractive({ useHandCursor: true });
      this.add.image(x + 28, py + 32, 'sun').setScale(0.42);
      const costText = this.add.text(x + 46, py + 32, '' + cost, {
        fontSize: '20px', fontFamily: 'Arial Black, sans-serif', color: '#ffffff',
        stroke: '#8a6910', strokeThickness: 4,
      }).setOrigin(0, 0.5);
      icon.on('pointerdown', () => {
        this.selectedPiece = kind;
        this.pickerRing.setPosition(x, py - 8);
        this.tweens.add({ targets: icon, scale: 0.95, duration: 80, yoyo: true });
        this.tweens.add({ targets: card, scale: 1.05, duration: 80, yoyo: true });
        SFX.plant();
      });
      const slot = { kind, icon, card, costText, cost, x };
      this.pickerSlots.push(slot);
      if (kind === 'pawn') this.pickerPawnIcon = icon;
      else this.pickerRookIcon = icon;
    });

    this.pickerRing = this.add.circle(GW / 2 - 120, py - 8, 48).setStrokeStyle(4, 0xff4da6);
    this.tweens.add({ targets: this.pickerRing, scale: 1.06, alpha: 0.7, duration: 600, yoyo: true, repeat: -1 });
    this.refreshPickerAfford();
  }

  refreshPickerAfford() {
    if (!this.pickerSlots) return;
    this.pickerSlots.forEach(slot => {
      const canAfford = this.sunCount >= slot.cost;
      const alpha = canAfford ? 1 : 0.45;
      slot.icon.setAlpha(alpha);
      slot.card.setAlpha(canAfford ? 1 : 0.55);
      slot.costText.setAlpha(alpha);
    });
  }

  refreshSun() {
    this.sunText.setText('' + this.sunCount);
    this.refreshPickerAfford();
  }

  refreshHearts() {
    const lostIdx = this.hearts;
    this.heartIcons.forEach((h, i) => {
      const alive = i < this.hearts;
      h.setAlpha(alive ? 1 : 0.2);
      if (!alive && i === lostIdx) {
        this.tweens.add({ targets: h, scale: 1.5, duration: 150, yoyo: true });
      }
    });
  }

  spawnPieceSun(piece) {
    if (this.isOver) return;
    this.tweens.add({
      targets: piece, scaleY: piece.scaleY * 0.88, scaleX: piece.scaleX * 1.06,
      duration: 140, yoyo: true, ease: 'Back.out',
    });
    const sun = this.add.image(piece.x, piece.y - 24, 'sun').setScale(0.72);
    this.suns.add(sun);
    this.setupSunHitArea(sun);
    this.tweens.add({ targets: sun, y: piece.y + 8, duration: 900, ease: 'Sine.out' });
    this.tweens.add({ targets: sun, scale: 0.85, duration: 450, yoyo: true, repeat: -1 });
  }

  dropSun() {
    if (this.isOver) return;
    const x = Phaser.Math.Between(LAWN_X + 40, LAWN_X + LAWN_W - 40);
    const sun = this.add.image(x, -30, 'sun').setScale(0.9);
    this.suns.add(sun);
    this.setupSunHitArea(sun);
    this.tweens.add({
      targets: sun, y: Phaser.Math.Between(LAWN_Y + 40, LAWN_Y + LAWN_H - 40),
      duration: 4500, ease: 'Sine.inOut',
    });
    this.tweens.add({ targets: sun, scale: 1.05, duration: 500, yoyo: true, repeat: -1 });
  }

  collectSun(sun) {
    if (!sun.active || this.isOver || sun.getData('collected')) return false;
    sun.setData('collected', true);
    sun.disableInteractive();
    this.tweens.killTweensOf(sun);
    spawnJuice(this, sun.x, sun.y, 0xffd23f, { count: 6, shape: 'star', size: 7, spread: 28 });
    this.sunCount += SUN_VALUE;
    this.refreshSun();
    SFX.sun();
    this.tweens.add({
      targets: sun, scale: 1.6, alpha: 0, duration: 200,
      onComplete: () => { sun.destroy(); },
    });
    return true;
  }

  trySpawnEnemy() {
    if (this.isOver) return;
    const wave = WAVES[this.waveIdx];
    if (!wave || this.spawnedThisWave >= wave.count) return;
    const row = Phaser.Math.Between(0, ROWS - 1);
    const { y } = cellCenter(0, row);
    const isBoss = !!wave.boss;
    const tex = isBoss ? 'blackKing' : 'blackPawn';
    const e = this.add.image(LAWN_X + LAWN_W + 40, y, tex);
    e.row = row;
    e.baseY = y;
    e.bobPhase = Phaser.Math.FloatBetween(0, Math.PI * 2);
    e.hp = isBoss ? BOSS_HP : PAWN_HP;
    e.maxHp = e.hp;
    e.isBoss = isBoss;
    e.eating = false;
    if (isBoss) {
      e.hpBarBg = this.add.image(LAWN_X + LAWN_W + 40, y - 64, 'hpBarBg').setOrigin(0.5);
      e.hpBar   = this.add.image(LAWN_X + LAWN_W + 40, y - 64, 'hpBarFill').setOrigin(0, 0.5);
      e.hpBar.setCrop(0, 0, 64, 12);
    }
    this.blackPieces.add(e);
    this.enemiesAlive++;
    this.spawnedThisWave++;
    const speed = isBoss ? BOSS_SPEED : PAWN_SPEED;
    this.tweens.add({
      targets: e, x: CASTLE_X + 70,
      duration: ((LAWN_X + LAWN_W + 40) - (CASTLE_X + 70)) / speed * 1000,
      ease: 'Linear',
      onComplete: () => this.enemyReachedCastle(e),
    });
  }

  enemyReachedCastle(e) {
    if (!e.active || e.dying || this.isOver) return;
    if (e.hpBar)   e.hpBar.destroy();
    if (e.hpBarBg) e.hpBarBg.destroy();
    e.destroy();
    this.enemiesAlive--;
    this.hearts--;
    this.refreshHearts();
    SFX.oops();
    this.cameras.main.shake(120, 0.008);
    if (this.castleSprite) {
      this.castleSprite.setTint(0xff88cc);
      this.time.delayedCall(220, () => { if (this.castleSprite) this.castleSprite.clearTint(); });
    }
    if (this.hearts <= 0) this.endGame(false);
    else this.checkWaveClear();
  }

  onTap(x, y) {
    if (this.isOver) return;
    if (y >= GH - PICKER_H) return;

    const cell = gridFromPointer(x, y);
    if (!cell) return;
    if (this.tapHitsSun(x, y, cell)) return;
    if (this.grid[cell.row][cell.col]) return;
    const cost = this.selectedPiece === 'pawn' ? PAWN_COST : ROOK_COST;
    if (this.sunCount >= cost) this.placePiece(cell.col, cell.row, this.selectedPiece);
  }

  placePiece(col, row, kind) {
    const cost = kind === 'pawn' ? PAWN_COST : ROOK_COST;
    this.sunCount -= cost;
    this.refreshSun();
    const { x, y } = cellCenter(col, row);
    const tex = kind === 'pawn' ? 'whitePawn' : 'whiteRook';
    const piece = this.add.image(x, y, tex).setScale(0.82);
    piece.col = col;
    piece.row = row;
    piece.kind = kind;
    piece.baseY = y;
    piece.swayPhase = Phaser.Math.FloatBetween(0, Math.PI * 2);
    piece.lastShot = 0;
    piece.lastSun = this.time.now;
    this.whitePieces.add(piece);
    this.grid[row][col] = piece;
    SFX.plant();
    spawnJuice(this, x, y, 0x5ab876, { count: 4, size: 5, spread: 20, duration: 280 });
    this.tweens.add({ targets: piece, scale: 0.95, duration: 120, yoyo: true });
  }

  shootFrom(piece) {
    const bolt = this.bolts.create(piece.x + 24, piece.y, 'bolt');
    bolt.body.setAllowGravity(false);
    bolt.setVelocityX(BOLT_SPEED);
    bolt.row = piece.row;
    SFX.shoot();
  }

  hitEnemy(e, bolt) {
    if (!e.active || e.dying) return;
    const px = bolt.x;
    const py = bolt.y;
    bolt.destroy();
    spawnJuice(this, px, py, 0xfff2a8, { count: 5, size: 4, spread: 16, duration: 220 });
    e.hp -= BOLT_DAMAGE;
    SFX.hit();
    if (e.isBoss) {
      e.setTint(0xff2200);
      this.time.delayedCall(110, () => { if (e.active) e.clearTint(); });
    } else {
      this.tweens.add({ targets: e, alpha: 0.4, duration: 60, yoyo: true });
    }
    if (e.hp <= 0) {
      e.dying = true;
      spawnPoof(this, e.x, e.y);
      this.tweens.killTweensOf(e);
      if (e.hpBar)   { e.hpBar.destroy();   e.hpBar   = null; }
      if (e.hpBarBg) { e.hpBarBg.destroy(); e.hpBarBg = null; }
      this.tweens.add({
        targets: e, scaleY: 0.2, alpha: 0, duration: 200,
        onComplete: () => {
          e.destroy();
          this.enemiesAlive--;
          this.checkWaveClear();
        },
      });
    }
  }

  checkWaveClear() {
    const wave = WAVES[this.waveIdx];
    if (!wave) return;
    if (this.spawnedThisWave >= wave.count && this.enemiesAlive <= 0) {
      if (this.waveIdx >= WAVES.length - 1) {
        this.endGame(true);
        return;
      }
      this.waveIdx++;
      this.spawnedThisWave = 0;
      this.waveIcons.forEach((w, i) => w.setAlpha(i <= this.waveIdx ? 1 : 0.25));
      this.time.delayedCall(1200, () => {
        if (!this.isOver) this.showWaveBanner();
      });
    }
  }

  showWaveBanner() {
    const wave = WAVES[this.waveIdx];
    const isBoss = !!(wave && wave.boss);
    const emoji = isBoss ? '\u265A' : '\u265F';
    const emojiColor = isBoss ? '#ffd23f' : '#4a3f7a';
    const emojiSize = isBoss ? '110px' : '80px';
    const t = this.add.text(GW / 2, GH / 2, emoji, { fontSize: emojiSize, color: emojiColor, stroke: '#ffffff', strokeThickness: 4 }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({
      targets: t, alpha: 1, scale: 1.3, duration: 400, yoyo: true,
      onComplete: () => t.destroy(),
    });
    if (isBoss) {
      const label = this.add.text(GW / 2, GH / 2 + 70, 'CHECK!', {
        fontSize: '44px', fontFamily: 'Arial Black, sans-serif',
        color: '#ff3300', stroke: '#ffffff', strokeThickness: 6,
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({
        targets: label, alpha: 1, duration: 300, delay: 200,
        yoyo: true, hold: 700,
        onComplete: () => label.destroy(),
      });
    }
  }

  endGame(win) {
    if (this.isOver) return;
    this.isOver = true;
    if (win) SFX.win();
    this.scene.start('EndScene', { win });
  }

  togglePause() {
    if (this.isOver) return;
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.time.timeScale = 0;
      this.tweens.pauseAll();
      this.physics.pause();
      this.pauseIcon.setText('\u25B6');
    } else {
      this.time.timeScale = 1;
      this.tweens.resumeAll();
      this.physics.resume();
      this.pauseIcon.setText('\u23F8');
    }
  }

  update(time) {
    if (this.isOver || this.isPaused) return;

    this.whitePieces.getChildren().forEach(piece => {
      if (!piece.active) return;
      piece.y = piece.baseY + Math.sin(time / 900 + piece.swayPhase) * PLANT_SWAY_AMP;
      if (piece.kind === 'pawn') {
        if (time - (piece.lastSun || 0) > PAWN_SUN_MS) {
          piece.lastSun = time;
          this.spawnPieceSun(piece);
        }
        return;
      }
      const blocker = this.blackPieces.getChildren().find(e =>
        e.active && e.row === piece.row && e.x > piece.x
      );
      if (blocker && time - (piece.lastShot || 0) > ROOK_SHOOT_MS) {
        piece.lastShot = time;
        this.shootFrom(piece);
      }
    });

    this.bolts.getChildren().forEach(bolt => {
      if (!bolt.active) return;
      if (bolt.x > LAWN_X + LAWN_W + 60) { bolt.destroy(); return; }
      this.blackPieces.getChildren().forEach(e => {
        if (!bolt.active) return;
        if (!e.active || e.dying || e.row !== bolt.row) return;
        const hitW = e.isBoss ? 48 : 28;
        const hitH = e.isBoss ? 56 : 30;
        if (Math.abs(e.x - bolt.x) < hitW && Math.abs(e.baseY - bolt.y) < hitH) {
          this.hitEnemy(e, bolt);
        }
      });
    });

    this.blackPieces.getChildren().forEach(e => {
      if (!e.active || e.dying) return;
      e.y = e.baseY + Math.sin(time / 280 + e.bobPhase) * ZOMBIE_BOB_AMP;
      if (!e.isBoss || !e.hpBar || !e.hpBarBg) return;
      const pct = Math.max(0, e.hp / e.maxHp);
      const barW = Math.max(1, 64 * pct);
      e.hpBarBg.setPosition(e.x, e.y - 64);
      e.hpBar.setTint(bossBarColor(pct));
      e.hpBar.setCrop(0, 0, barW, 12);
      e.hpBar.setPosition(e.x - 32, e.y - 64);
    });
  }
}

// ── End ───────────────────────────────────────────────────────
class EndScene extends Phaser.Scene {
  constructor() { super('EndScene'); }

  preload() { makeTextures(this); }

  create(data) {
    const win = !!(data && data.win);
    addSkyBackground(this);
    addDriftingClouds(this, 3);

    this.add.rectangle(GW / 2, GH / 2, GW, GH, win ? 0x000000 : 0x1a1030, win ? 0.35 : 0.5);

    if (win) {
      const colors = [0xff6eb4, 0xffd23f, 0x6ecf8a, 0xff9ed2, 0x88ccff];
      for (let i = 0; i < 28; i++) {
        const c = colors[i % colors.length];
        const piece = this.add.circle(
          Phaser.Math.Between(40, GW - 40), -20,
          Phaser.Math.Between(4, 10), c, 0.9
        );
        this.tweens.add({
          targets: piece,
          y: GH + 30,
          angle: Phaser.Math.Between(-360, 360),
          duration: Phaser.Math.Between(2000, 4000),
          delay: Phaser.Math.Between(0, 1200),
          onComplete: () => piece.destroy(),
        });
      }
    }

    this.add.text(GW / 2, GH / 2 - 100, win ? '\uD83C\uDFF0' : '\uD83D\uDE22', {
      fontSize: '88px',
    }).setOrigin(0.5);
    this.add.text(GW / 2, GH / 2 - 10, win ? 'CHECKMATE!' : 'TRY AGAIN', {
      fontSize: '48px', fontFamily: 'Arial Black, sans-serif',
      color: win ? '#ff6eb4' : '#ffaaaa', stroke: '#ffffff', strokeThickness: 6,
    }).setOrigin(0.5);

    buildStyledPlayButton(this, GW / 2, GH / 2 + 90, 58, () => tryStartGame(this, ['EndScene', 'GameScene']));

    const homeShadow = this.add.ellipse(GW / 2, GH / 2 + 200, 52, 12, 0x000000, 0.12);
    const home = this.add.circle(GW / 2, GH / 2 + 190, 44, 0x6ecf8a)
      .setInteractive({ useHandCursor: true });
    home.setStrokeStyle(2, 0xffffff, 0.4);
    this.add.text(GW / 2, GH / 2 + 190, '\u2B50', { fontSize: '32px' }).setOrigin(0.5);
    home.on('pointerdown', () => this.scene.start('MenuScene'));
  }
}

// ── Daily limit screen ─────────────────────────────────────────
class DailyLimitScene extends Phaser.Scene {
  constructor() { super('DailyLimitScene'); }

  preload() { makeTextures(this); }

  create() {
    addSkyBackground(this);
    addDecorativeSun(this, -80);
    addDriftingClouds(this, 3, -85);

    this.add.rectangle(GW / 2, GH / 2, GW, GH, 0x1a2a4a, 0.45);

    for (let i = 0; i < 8; i++) {
      this.add.text(Phaser.Math.Between(60, GW - 60), Phaser.Math.Between(40, 200), '\u2728', {
        fontSize: Phaser.Math.Between(18, 28) + 'px', color: '#ffffff55',
      }).setOrigin(0.5);
    }

    const moon = this.add.text(GW / 2, GH / 2 - 100, '\uD83C\uDF19', { fontSize: '96px' })
      .setOrigin(0.5).setInteractive();
    this.add.text(GW / 2, GH / 2 + 10, '\u00A1Hasta ma\u00F1ana!', {
      fontSize: '44px', fontFamily: 'Arial Black, sans-serif',
      color: '#c8d8ff', stroke: '#0a1530', strokeThickness: 6,
    }).setOrigin(0.5);
    this.add.text(GW / 2, GH / 2 + 80, '\uD83D\uDE34', { fontSize: '48px' }).setOrigin(0.5);

    const home = this.add.circle(GW / 2, GH / 2 + 170, 52, 0x44c767)
      .setInteractive({ useHandCursor: true });
    home.setStrokeStyle(2, 0xffffff, 0.35);
    this.add.text(GW / 2, GH / 2 + 170, '\u2B50', { fontSize: '40px' }).setOrigin(0.5);
    home.on('pointerdown', () => this.scene.start('MenuScene'));

    this.add.text(8, GH - 6, 'v' + VERSION, {
      fontSize: '13px', fontFamily: 'monospace', color: '#ffffff44',
    }).setOrigin(0, 1);

    let holdEvt = null;
    moon.on('pointerdown', () => {
      holdEvt = this.time.delayedCall(3000, () => { DailyPlays.reset(); this.scene.start('MenuScene'); });
    });
    const cancelHold = () => { if (holdEvt) { holdEvt.remove(); holdEvt = null; } };
    moon.on('pointerup', cancelHold);
    moon.on('pointerout', cancelHold);
  }
}

// ── Boot ──────────────────────────────────────────────────────
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: C.sky,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GW,
    height: GH,
  },
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [MenuScene, GameScene, EndScene, DailyLimitScene],
});
