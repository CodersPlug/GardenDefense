// =============================================================
//  Garden Defense — simple PvZ for ~6 year olds
//  Defend the pink castle! Sunflowers make sun, flowers shoot petals.
// =============================================================

const GW = 1024;
const GH = 576;
const VERSION = '1.4';
const SUN_HIT_RADIUS = 56; // generous for small fingers on touch screens
const MAX_PLAYS_PER_DAY = 5;
const PLAY_STORAGE_KEY  = 'phaserlab_daily_plays'; // shared with PhaserLab (same origin)

const HUD_Y = 36;
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
const SUNFLOWER_COST = 25;
const SUNFLOWER_SUN_MS = 9000;
const FLOWER_COST = 50;
const FLOWER_SHOOT_MS = 1300;
const PETAL_SPEED = 340;
const PETAL_DAMAGE = 1;
const ZOMBIE_HP = 3;
const ZOMBIE_SPEED = 28;
const ZOMBIE_SPAWN_MS = 4200;
const MAX_HEARTS = 5;

const WAVES = [
  { count: 4, label: 1 },
  { count: 6, label: 2 },
  { count: 8, label: 3 },
];

const C = {
  sky:    '#a8e6cf',
  grass:  0x6ecf8a,
  grassD: 0x5ab876,
  house:  0xffb3d9,
  castle: 0xffb3d9,
  flower: 0xff6eb4,
  sun:    0xffd23f,
  bowser: 0x3cb878,
  petal:  0xff9ed2,
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
  get() {
    try {
      const raw = localStorage.getItem(PLAY_STORAGE_KEY);
      if (!raw) return { date: this.today(), count: 0 };
      const data = JSON.parse(raw);
      if (data.date !== this.today()) return { date: this.today(), count: 0 };
      return data;
    } catch (_) {
      return { date: this.today(), count: 0 };
    }
  },
  remaining() { return Math.max(0, MAX_PLAYS_PER_DAY - this.get().count); },
  canPlay()   { return this.remaining() > 0; },
  record() {
    const data = this.get();
    data.count++;
    localStorage.setItem(PLAY_STORAGE_KEY, JSON.stringify({ date: this.today(), count: data.count }));
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

function makeTextures(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  g.clear();
  g.fillStyle(C.grassD); g.fillRect(0, 0, 64, 64);
  g.fillStyle(C.grass);  g.fillRect(0, 0, 64, 20);
  g.generateTexture('grass', 64, 64);

  g.clear();
  g.fillStyle(C.castle);
  g.fillRect(18, 38, 44, 52);
  g.fillRect(4, 28, 20, 62);
  g.fillRect(56, 28, 20, 62);
  g.fillStyle(0xff9ed2);
  for (let i = 0; i < 3; i++) { g.fillRect(6 + i * 6, 22, 5, 8); g.fillRect(58 + i * 6, 22, 5, 8); }
  for (let i = 0; i < 5; i++) g.fillRect(20 + i * 8, 32, 5, 8);
  g.fillStyle(0xff4da6); g.fillRoundedRect(34, 62, 14, 28, 4);
  g.fillStyle(0xff6eb4); g.fillCircle(40, 14, 7);
  g.fillStyle(0xffffff); g.fillRect(38, 8, 4, 10);
  g.generateTexture('castle', 80, 100);

  g.clear();
  g.fillStyle(0x4a9e5c); g.fillRect(30, 48, 8, 20);
  g.fillStyle(0xffd23f);
  for (let i = 0; i < 8; i++) {
    const ang = i * Math.PI / 4;
    g.fillCircle(34 + Math.cos(ang) * 18, 26 + Math.sin(ang) * 18, 10);
  }
  g.fillStyle(0x8B4513); g.fillCircle(34, 26, 12);
  g.fillStyle(0xffee58); g.fillCircle(34, 26, 6);
  g.generateTexture('sunflower', 68, 68);

  g.clear();
  g.fillStyle(0x4a9e5c); g.fillCircle(34, 40, 28);
  g.fillStyle(C.flower); g.fillCircle(34, 28, 22);
  g.fillStyle(0xffb3e0); g.fillCircle(22, 20, 10);
  g.fillStyle(0xffb3e0); g.fillCircle(46, 20, 10);
  g.fillStyle(0xffb3e0); g.fillCircle(34, 12, 10);
  g.fillStyle(0xffffff); g.fillCircle(28, 26, 5); g.fillCircle(40, 26, 5);
  g.fillStyle(0x333333); g.fillCircle(29, 27, 2); g.fillCircle(41, 27, 2);
  g.generateTexture('flower', 68, 68);

  g.clear();
  g.fillStyle(0xc8941f); g.fillCircle(22, 22, 22);
  g.fillStyle(C.sun);    g.fillCircle(22, 22, 17);
  g.fillStyle(0xfff9c4); g.fillCircle(16, 16, 5);
  g.generateTexture('sun', 44, 44);

  // Bowser Jr–inspired attacker (original art, kid-friendly)
  g.clear();
  g.fillStyle(C.bowser); g.fillEllipse(24, 36, 20, 22);
  g.fillCircle(24, 18, 17);
  g.fillStyle(0xff6622);
  g.fillTriangle(24, 0, 12, 14, 36, 14);
  g.fillTriangle(16, 6, 10, 16, 20, 14);
  g.fillTriangle(32, 6, 28, 14, 38, 16);
  g.fillStyle(0xffcc66); g.fillEllipse(24, 22, 13, 10);
  g.fillStyle(0xffffff); g.fillCircle(17, 16, 5); g.fillCircle(31, 16, 5);
  g.fillStyle(0x222222); g.fillCircle(17, 17, 2.5); g.fillCircle(31, 17, 2.5);
  g.fillStyle(0xffffff); g.fillTriangle(20, 26, 19, 31, 21, 31); g.fillTriangle(28, 26, 27, 31, 29, 31);
  g.fillStyle(0xfff5e0); g.fillTriangle(11, 13, 8, 4, 13, 10); g.fillTriangle(37, 13, 35, 10, 40, 4);
  g.generateTexture('bowserjr', 48, 58);

  g.clear();
  g.fillStyle(C.petal); g.fillCircle(8, 8, 8);
  g.generateTexture('petal', 16, 16);

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

// ── Menu ──────────────────────────────────────────────────────
class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create() {
    this.cameras.main.setBackgroundColor(C.sky);
    for (let i = 0; i < 5; i++) {
      this.add.ellipse(
        Phaser.Math.Between(60, GW - 60), Phaser.Math.Between(40, 160),
        Phaser.Math.Between(90, 160), 40, 0xffffff, 0.75
      );
    }
    this.add.text(GW / 2, GH / 2 - 120, '\uD83C\uDFF0', { fontSize: '88px' }).setOrigin(0.5);
    this.add.text(GW / 2, GH / 2 - 30, 'Garden Defense', {
      fontSize: '42px', fontFamily: 'Arial Black, sans-serif',
      color: '#ff4da6', stroke: '#ffffff', strokeThickness: 6,
    }).setOrigin(0.5);

    const rem = DailyPlays.remaining();
    const startX = GW / 2 - (MAX_PLAYS_PER_DAY - 1) * 22;
    for (let i = 0; i < MAX_PLAYS_PER_DAY; i++) {
      this.add.text(startX + i * 44, GH / 2 + 20, i < rem ? '\u2B50' : '\u2606', {
        fontSize: '28px', color: i < rem ? '#ffd23f' : '#ffffff44',
      }).setOrigin(0.5);
    }

    const play = this.add.circle(GW / 2, GH / 2 + 90, 64, 0xff6eb4)
      .setInteractive({ useHandCursor: true });
    this.add.text(GW / 2, GH / 2 + 90, '\u25B6', {
      fontSize: '48px', color: '#ffffff',
    }).setOrigin(0.5);
    this.tweens.add({ targets: play, scale: 1.08, duration: 600, yoyo: true, repeat: -1 });
    play.on('pointerdown', () => tryStartGame(this));

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
    this.cameras.main.setBackgroundColor(C.sky);

    // Lawn + grid lines (subtle)
    this.add.rectangle(LAWN_X + LAWN_W / 2, LAWN_Y + LAWN_H / 2, LAWN_W, LAWN_H, C.grass, 0.35);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const { x, y } = cellCenter(c, r);
        this.add.rectangle(x, y, CELL_W - 6, CELL_H - 6, C.grass, r % 2 === c % 2 ? 0.22 : 0.12)
          .setStrokeStyle(2, 0xffffff, 0.15);
      }
    }

    this.add.image(CASTLE_X, LAWN_Y + LAWN_H / 2, 'castle').setScale(1.15);

    this.sunCount = START_SUN;
    this.hearts = MAX_HEARTS;
    this.waveIdx = 0;
    this.spawnedThisWave = 0;
    this.zombiesAlive = 0;
    this.isOver = false;
    this.selectedPlant = 'sunflower';
    this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

    this.plants = this.add.group();
    this.zombies = this.add.group();
    this.petals = this.physics.add.group();
    this.suns = this.add.group();

    this.buildHUD();
    this.buildPicker();

    this.time.addEvent({ delay: SUN_DROP_MS, callback: () => this.dropSun(), loop: true });
    this.time.delayedCall(2000, () => this.dropSun());
    this.time.addEvent({ delay: ZOMBIE_SPAWN_MS, callback: () => this.trySpawnZombie(), loop: true });
    this.time.delayedCall(3000, () => this.trySpawnZombie());

    this.input.on('pointerdown', (pointer, currentlyOver) => this.handleTap(pointer, currentlyOver));
  }

  handleTap(pointer, currentlyOver) {
    if (this.isOver) return;

    // Priority 1: Phaser hit-test on interactive suns (large hit circle)
    for (const go of currentlyOver) {
      if (go.getData('isSun')) {
        this.collectSun(go);
        return;
      }
    }

    const x = pointer.worldX;
    const y = pointer.worldY;

    // Priority 2: distance fallback (covers edge taps Phaser may miss)
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
  }

  buildHUD() {
    this.add.image(36, HUD_Y, 'sun').setScale(0.9);
    this.sunText = this.add.text(62, HUD_Y, '' + this.sunCount, {
      fontSize: '32px', fontFamily: 'Arial Black, sans-serif',
      color: '#ffffff', stroke: '#8a6910', strokeThickness: 5,
    }).setOrigin(0, 0.5);

    this.heartIcons = [];
    for (let i = 0; i < MAX_HEARTS; i++) {
      const h = this.add.text(GW / 2 - 88 + i * 44, HUD_Y, '\u2665', {
        fontSize: '34px', color: '#ff4da6', stroke: '#880033', strokeThickness: 4,
      }).setOrigin(0.5);
      this.heartIcons.push(h);
    }

    this.waveIcons = [];
    for (let i = 0; i < WAVES.length; i++) {
      const w = this.add.text(GW - 130 + i * 36, HUD_Y, '\uD83C\uDF0A', {
        fontSize: '28px', alpha: i === 0 ? 1 : 0.25,
      }).setOrigin(0.5);
      this.waveIcons.push(w);
    }

    this.add.text(8, GH - PICKER_H - 6, 'v' + VERSION, {
      fontSize: '13px', fontFamily: 'monospace', color: '#ffffff88',
    }).setOrigin(0, 1);
  }

  buildPicker() {
    const py = GH - PICKER_H / 2;
    this.add.rectangle(GW / 2, py, GW, PICKER_H, 0xffb3d9, 0.45);

    const slots = [
      { kind: 'sunflower', tex: 'sunflower', x: GW / 2 - 120, cost: SUNFLOWER_COST },
      { kind: 'flower',    tex: 'flower',    x: GW / 2 + 20,  cost: FLOWER_COST },
    ];

    slots.forEach(({ kind, tex, x, cost }) => {
      const icon = this.add.image(x, py - 8, tex).setScale(0.82)
        .setInteractive({ useHandCursor: true });
      this.add.image(x + 28, py + 32, 'sun').setScale(0.42);
      this.add.text(x + 46, py + 32, '' + cost, {
        fontSize: '20px', fontFamily: 'Arial Black, sans-serif', color: '#ffffff',
        stroke: '#8a6910', strokeThickness: 4,
      }).setOrigin(0, 0.5);
      icon.on('pointerdown', () => {
        this.selectedPlant = kind;
        this.pickerRing.setPosition(x, py - 8);
        SFX.plant();
      });
      if (kind === 'sunflower') this.pickerSunflower = icon;
      else this.pickerFlower = icon;
    });

    this.pickerRing = this.add.circle(GW / 2 - 120, py - 8, 46).setStrokeStyle(4, 0xff4da6);
  }

  refreshSun() { this.sunText.setText('' + this.sunCount); }

  refreshHearts() {
    this.heartIcons.forEach((h, i) => h.setAlpha(i < this.hearts ? 1 : 0.2));
  }

  spawnPlantSun(plant) {
    if (this.isOver) return;
    const sun = this.add.image(plant.x, plant.y - 24, 'sun').setScale(0.72);
    this.suns.add(sun);
    this.setupSunHitArea(sun);
    this.tweens.add({ targets: sun, y: plant.y + 8, duration: 900, ease: 'Sine.out' });
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
    this.sunCount += SUN_VALUE;
    this.refreshSun();
    SFX.sun();
    this.tweens.add({
      targets: sun, scale: 1.6, alpha: 0, duration: 200,
      onComplete: () => { sun.destroy(); },
    });
    return true;
  }

  trySpawnZombie() {
    if (this.isOver) return;
    const wave = WAVES[this.waveIdx];
    if (!wave || this.spawnedThisWave >= wave.count) return;
    const row = Phaser.Math.Between(0, ROWS - 1);
    const { y } = cellCenter(0, row);
    const z = this.add.image(LAWN_X + LAWN_W + 40, y, 'bowserjr');
    z.row = row;
    z.hp = ZOMBIE_HP;
    z.eating = false;
    this.zombies.add(z);
    this.zombiesAlive++;
    this.spawnedThisWave++;
    this.tweens.add({
      targets: z, x: CASTLE_X + 70,
      duration: ((LAWN_X + LAWN_W + 40) - (CASTLE_X + 70)) / ZOMBIE_SPEED * 1000,
      ease: 'Linear',
      onComplete: () => this.zombieReachedHouse(z),
    });
  }

  zombieReachedHouse(z) {
    if (!z.active || this.isOver) return;
    z.destroy();
    this.zombiesAlive--;
    this.hearts--;
    this.refreshHearts();
    SFX.oops();
    this.cameras.main.shake(120, 0.008);
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
    const cost = this.selectedPlant === 'sunflower' ? SUNFLOWER_COST : FLOWER_COST;
    if (this.sunCount >= cost) this.placePlant(cell.col, cell.row, this.selectedPlant);
  }

  placePlant(col, row, kind) {
    const cost = kind === 'sunflower' ? SUNFLOWER_COST : FLOWER_COST;
    this.sunCount -= cost;
    this.refreshSun();
    const { x, y } = cellCenter(col, row);
    const tex = kind === 'sunflower' ? 'sunflower' : 'flower';
    const plant = this.add.image(x, y, tex).setScale(0.82);
    plant.col = col;
    plant.row = row;
    plant.kind = kind;
    plant.lastShot = 0;
    plant.lastSun = this.time.now;
    this.plants.add(plant);
    this.grid[row][col] = plant;
    SFX.plant();
    this.tweens.add({ targets: plant, scale: 0.95, duration: 120, yoyo: true });
  }

  shootFrom(plant) {
    const petal = this.petals.create(plant.x + 24, plant.y, 'petal');
    petal.body.setAllowGravity(false);
    petal.setVelocityX(PETAL_SPEED);
    petal.row = plant.row;
    SFX.shoot();
  }

  hitZombie(z, petal) {
    if (!z.active) return;
    petal.destroy();
    z.hp -= PETAL_DAMAGE;
    this.tweens.add({ targets: z, alpha: 0.4, duration: 60, yoyo: true });
    SFX.hit();
    if (z.hp <= 0) {
      this.tweens.killTweensOf(z);
      this.tweens.add({
        targets: z, scaleY: 0.2, alpha: 0, duration: 200,
        onComplete: () => {
          z.destroy();
          this.zombiesAlive--;
          this.checkWaveClear();
        },
      });
    }
  }

  checkWaveClear() {
    const wave = WAVES[this.waveIdx];
    if (!wave) return;
    if (this.spawnedThisWave >= wave.count && this.zombiesAlive <= 0) {
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
    const t = this.add.text(GW / 2, GH / 2, '\uD83C\uDF0A', { fontSize: '80px' }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({
      targets: t, alpha: 1, scale: 1.3, duration: 400, yoyo: true,
      onComplete: () => t.destroy(),
    });
  }

  endGame(win) {
    if (this.isOver) return;
    this.isOver = true;
    if (win) SFX.win();
    this.scene.start('EndScene', { win });
  }

  update(time) {
    if (this.isOver) return;

    this.plants.getChildren().forEach(plant => {
      if (!plant.active) return;
      if (plant.kind === 'sunflower') {
        if (time - (plant.lastSun || 0) > SUNFLOWER_SUN_MS) {
          plant.lastSun = time;
          this.spawnPlantSun(plant);
        }
        return;
      }
      const blocker = this.zombies.getChildren().find(z =>
        z.active && z.row === plant.row && z.x > plant.x
      );
      if (blocker && time - (plant.lastShot || 0) > FLOWER_SHOOT_MS) {
        plant.lastShot = time;
        this.shootFrom(plant);
      }
    });

    this.petals.getChildren().forEach(petal => {
      if (!petal.active) return;
      if (petal.x > LAWN_X + LAWN_W + 60) { petal.destroy(); return; }
      this.zombies.getChildren().forEach(z => {
        if (!z.active || z.row !== petal.row) return;
        if (Math.abs(z.x - petal.x) < 28 && Math.abs(z.y - petal.y) < 30) {
          this.hitZombie(z, petal);
        }
      });
    });
  }
}

// ── End ───────────────────────────────────────────────────────
class EndScene extends Phaser.Scene {
  constructor() { super('EndScene'); }

  create(data) {
    const win = !!(data && data.win);
    this.add.rectangle(GW / 2, GH / 2, GW, GH, 0x000000, 0.55);
    this.add.text(GW / 2, GH / 2 - 100, win ? '\uD83C\uDFF0' : '\uD83D\uDE22', {
      fontSize: '88px',
    }).setOrigin(0.5);
    this.add.text(GW / 2, GH / 2 - 10, win ? 'YOU WIN!' : 'TRY AGAIN', {
      fontSize: '48px', fontFamily: 'Arial Black, sans-serif',
      color: win ? '#ff6eb4' : '#ff8888', stroke: '#ffffff', strokeThickness: 6,
    }).setOrigin(0.5);

    const again = this.add.circle(GW / 2, GH / 2 + 90, 58, win ? 0xff6eb4 : 0x9b8ec4)
      .setInteractive({ useHandCursor: true });
    this.add.text(GW / 2, GH / 2 + 90, '\u25B6', { fontSize: '44px', color: '#fff' }).setOrigin(0.5);
    again.on('pointerdown', () => tryStartGame(this, ['EndScene', 'GameScene']));

    const home = this.add.circle(GW / 2, GH / 2 + 190, 44, 0x6ecf8a)
      .setInteractive({ useHandCursor: true });
    this.add.text(GW / 2, GH / 2 + 190, '\u2B50', { fontSize: '32px' }).setOrigin(0.5);
    home.on('pointerdown', () => this.scene.start('MenuScene'));
  }
}

// ── Daily limit screen ─────────────────────────────────────────
class DailyLimitScene extends Phaser.Scene {
  constructor() { super('DailyLimitScene'); }

  create() {
    this.add.rectangle(GW / 2, GH / 2, GW, GH, 0x1a2a4a);

    for (let i = 0; i < 8; i++) {
      this.add.text(Phaser.Math.Between(60, GW - 60), Phaser.Math.Between(40, 200), '\u2728', {
        fontSize: Phaser.Math.Between(18, 28) + 'px', color: '#ffffff55',
      }).setOrigin(0.5);
    }

    this.add.text(GW / 2, GH / 2 - 100, '\uD83C\uDF19', { fontSize: '96px' }).setOrigin(0.5);
    this.add.text(GW / 2, GH / 2 + 10, '\u00A1Hasta ma\u00F1ana!', {
      fontSize: '44px', fontFamily: 'Arial Black, sans-serif',
      color: '#c8d8ff', stroke: '#0a1530', strokeThickness: 6,
    }).setOrigin(0.5);
    this.add.text(GW / 2, GH / 2 + 80, '\uD83D\uDE34', { fontSize: '48px' }).setOrigin(0.5);

    const home = this.add.circle(GW / 2, GH / 2 + 170, 52, 0x44c767)
      .setInteractive({ useHandCursor: true });
    this.add.text(GW / 2, GH / 2 + 170, '\u2B50', { fontSize: '40px' }).setOrigin(0.5);
    home.on('pointerdown', () => this.scene.start('MenuScene'));
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
