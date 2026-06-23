// =============================================================
//  Garden Defense — simple Plants vs Zombies for ~6 year olds
//  Tap sun → collect. Tap flower → tap lawn → plant. Protect the house!
// =============================================================

const GW = 1024;
const GH = 576;
const VERSION = '1.0';

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
const HOUSE_X = 52;

const START_SUN = 75;
const SUN_VALUE = 25;
const SUN_DROP_MS = 5500;
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
  flower: 0xff6eb4,
  sun:    0xffd23f,
  zombie: 0x9b8ec4,
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

function makeTextures(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  g.clear();
  g.fillStyle(C.grassD); g.fillRect(0, 0, 64, 64);
  g.fillStyle(C.grass);  g.fillRect(0, 0, 64, 20);
  g.generateTexture('grass', 64, 64);

  g.clear();
  g.fillStyle(C.house); g.fillRoundedRect(0, 0, 70, 90, 12);
  g.fillStyle(0xffffff); g.fillCircle(35, 38, 18);
  g.fillStyle(0xff6eb4); g.fillCircle(35, 38, 10);
  g.fillStyle(0xff4da6); g.fillTriangle(35, 0, 8, 28, 62, 28);
  g.generateTexture('house', 70, 90);

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

  g.clear();
  g.fillStyle(C.zombie); g.fillRoundedRect(0, 0, 44, 56, 10);
  g.fillStyle(0xffffff); g.fillCircle(16, 22, 7); g.fillCircle(30, 22, 7);
  g.fillStyle(0x333333); g.fillCircle(16, 24, 3); g.fillCircle(30, 24, 3);
  g.fillStyle(0xffffff); g.fillRoundedRect(14, 38, 16, 6, 3);
  g.generateTexture('zombie', 44, 56);

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
    this.add.text(GW / 2, GH / 2 - 120, '\uD83C\uDF38', { fontSize: '88px' }).setOrigin(0.5);
    this.add.text(GW / 2, GH / 2 - 30, 'Garden Defense', {
      fontSize: '42px', fontFamily: 'Arial Black, sans-serif',
      color: '#ff4da6', stroke: '#ffffff', strokeThickness: 6,
    }).setOrigin(0.5);

    const play = this.add.circle(GW / 2, GH / 2 + 80, 64, 0xff6eb4)
      .setInteractive({ useHandCursor: true });
    this.add.text(GW / 2, GH / 2 + 80, '\u25B6', {
      fontSize: '48px', color: '#ffffff',
    }).setOrigin(0.5);
    this.tweens.add({ targets: play, scale: 1.08, duration: 600, yoyo: true, repeat: -1 });
    play.on('pointerdown', () => this.scene.start('GameScene'));

    this.add.text(8, GH - 6, 'v' + VERSION, {
      fontSize: '13px', fontFamily: 'monospace', color: '#ffffff88',
    }).setOrigin(0, 1);
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

    this.add.image(HOUSE_X, LAWN_Y + LAWN_H / 2, 'house').setScale(1.1);

    this.sunCount = START_SUN;
    this.hearts = MAX_HEARTS;
    this.waveIdx = 0;
    this.spawnedThisWave = 0;
    this.zombiesAlive = 0;
    this.isOver = false;
    this.selectedPlant = 'flower';
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

    this.input.on('pointerdown', (p) => this.onTap(p.x, p.y));
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
  }

  buildPicker() {
    const py = GH - PICKER_H / 2;
    this.add.rectangle(GW / 2, py, GW, PICKER_H, 0xffb3d9, 0.45);

    this.pickerFlower = this.add.image(GW / 2 - 80, py - 8, 'flower').setScale(0.85)
      .setInteractive({ useHandCursor: true });
    this.add.image(GW / 2 - 80, py + 32, 'sun').setScale(0.45);
    this.add.text(GW / 2 - 58, py + 32, '' + FLOWER_COST, {
      fontSize: '22px', fontFamily: 'Arial Black, sans-serif', color: '#ffffff',
      stroke: '#8a6910', strokeThickness: 4,
    }).setOrigin(0, 0.5);

    this.pickerRing = this.add.circle(GW / 2 - 80, py - 8, 46).setStrokeStyle(4, 0xff4da6);

    this.pickerFlower.on('pointerdown', () => {
      this.selectedPlant = 'flower';
      this.pickerRing.setPosition(GW / 2 - 80, py - 8);
      SFX.plant();
    });
  }

  refreshSun() { this.sunText.setText('' + this.sunCount); }

  refreshHearts() {
    this.heartIcons.forEach((h, i) => h.setAlpha(i < this.hearts ? 1 : 0.2));
  }

  dropSun() {
    if (this.isOver) return;
    const x = Phaser.Math.Between(LAWN_X + 40, LAWN_X + LAWN_W - 40);
    const sun = this.add.image(x, -30, 'sun').setScale(0.9).setInteractive();
    this.suns.add(sun);
    this.tweens.add({
      targets: sun, y: Phaser.Math.Between(LAWN_Y + 40, LAWN_Y + LAWN_H - 40),
      duration: 4500, ease: 'Sine.inOut',
    });
    this.tweens.add({ targets: sun, scale: 1.05, duration: 500, yoyo: true, repeat: -1 });
    sun.on('pointerdown', () => this.collectSun(sun));
  }

  collectSun(sun) {
    if (!sun.active || this.isOver) return;
    this.sunCount += SUN_VALUE;
    this.refreshSun();
    SFX.sun();
    this.tweens.add({
      targets: sun, scale: 1.6, alpha: 0, duration: 200,
      onComplete: () => { sun.destroy(); },
    });
  }

  trySpawnZombie() {
    if (this.isOver) return;
    const wave = WAVES[this.waveIdx];
    if (!wave || this.spawnedThisWave >= wave.count) return;
    const row = Phaser.Math.Between(0, ROWS - 1);
    const { y } = cellCenter(0, row);
    const z = this.add.image(LAWN_X + LAWN_W + 40, y, 'zombie');
    z.row = row;
    z.hp = ZOMBIE_HP;
    z.eating = false;
    this.zombies.add(z);
    this.zombiesAlive++;
    this.spawnedThisWave++;
    this.tweens.add({
      targets: z, x: HOUSE_X + 60,
      duration: ((LAWN_X + LAWN_W + 40) - (HOUSE_X + 60)) / ZOMBIE_SPEED * 1000,
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

    // Sun tap (also handled by sun pointerdown — fallback here)
    this.suns.getChildren().forEach(s => {
      if (!s.active) return;
      const d = Phaser.Math.Distance.Between(x, y, s.x, s.y);
      if (d < 36) this.collectSun(s);
    });

    const cell = gridFromPointer(x, y);
    if (!cell) return;
    if (this.grid[cell.row][cell.col]) return;
    if (this.selectedPlant === 'flower' && this.sunCount >= FLOWER_COST) {
      this.placeFlower(cell.col, cell.row);
    }
  }

  placeFlower(col, row) {
    this.sunCount -= FLOWER_COST;
    this.refreshSun();
    const { x, y } = cellCenter(col, row);
    const plant = this.add.image(x, y, 'flower').setScale(0.82);
    plant.col = col;
    plant.row = row;
    plant.lastShot = 0;
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
    this.add.text(GW / 2, GH / 2 - 100, win ? '\uD83C\uDF38' : '\uD83D\uDE22', {
      fontSize: '88px',
    }).setOrigin(0.5);
    this.add.text(GW / 2, GH / 2 - 10, win ? 'YOU WIN!' : 'TRY AGAIN', {
      fontSize: '48px', fontFamily: 'Arial Black, sans-serif',
      color: win ? '#ff6eb4' : '#ff8888', stroke: '#ffffff', strokeThickness: 6,
    }).setOrigin(0.5);

    const again = this.add.circle(GW / 2, GH / 2 + 90, 58, win ? 0xff6eb4 : 0x9b8ec4)
      .setInteractive({ useHandCursor: true });
    this.add.text(GW / 2, GH / 2 + 90, '\u25B6', { fontSize: '44px', color: '#fff' }).setOrigin(0.5);
    again.on('pointerdown', () => this.scene.start('GameScene'));

    const home = this.add.circle(GW / 2, GH / 2 + 190, 44, 0x6ecf8a)
      .setInteractive({ useHandCursor: true });
    this.add.text(GW / 2, GH / 2 + 190, '\u2B50', { fontSize: '32px' }).setOrigin(0.5);
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
  scene: [MenuScene, GameScene, EndScene],
});
