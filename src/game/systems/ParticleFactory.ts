import Phaser from "phaser";

export class ParticleFactory {
  static hitLight(scene: Phaser.Scene, x: number, y: number) {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const speed = 48 + Math.floor(Math.random() * 3) * 16; // multiples of 16 for pixel grid
      const g = scene.add.graphics().setDepth(50);
      g.fillStyle(0xffffff, 1);
      g.fillRect(-2, -2, 4, 4);
      g.setPosition(Math.round(x), Math.round(y));
      scene.tweens.add({
        targets: g,
        x: Math.round(x + Math.cos(angle) * speed),
        y: Math.round(y + Math.sin(angle) * speed),
        alpha: 0,
        scaleX: 0.25,
        scaleY: 0.25,
        duration: 176, // multiple of 16ms
        ease: "Quad.easeOut",
        onUpdate: () => { g.setPosition(Math.round(g.x), Math.round(g.y)); },
        onComplete: () => g.destroy(),
      });
    }
  }

  // Corporate-themed heavy hit: paper/ink blue palette
  static hitHeavy(scene: Phaser.Scene, x: number, y: number) {
    const corpColors = [0x4a90d9, 0xd0e4f8, 0x2a5a9a, 0xffffff, 0x1a3a6a];
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const speed = 64 + Math.floor(Math.random() * 4) * 16; // 64,80,96,112
      const color = corpColors[Math.floor(Math.random() * corpColors.length)];
      const g = scene.add.graphics().setDepth(50);
      g.fillStyle(color, 1);
      const size = 2 + Math.floor(Math.random() * 3);
      g.fillRect(-size / 2, -size / 2, size, size);
      g.setPosition(Math.round(x), Math.round(y));
      scene.tweens.add({
        targets: g,
        x: Math.round(x + Math.cos(angle) * speed),
        y: Math.round(y + Math.sin(angle) * speed - 16),
        alpha: 0,
        duration: 320,
        ease: "Quad.easeOut",
        onUpdate: () => { g.setPosition(Math.round(g.x), Math.round(g.y)); },
        onComplete: () => g.destroy(),
      });
    }
  }

  // Corporate-themed death: paper shreds + coffee spill
  static enemyDeath(scene: Phaser.Scene, x: number, y: number) {
    const corpColors = [0xffffff, 0x4a90d9, 0xd0e4f8, 0xaaaaaa, 0x2a3a5a];
    for (let i = 0; i < 22; i++) {
      const angle = (i / 22) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 48 + Math.floor(Math.random() * 5) * 16; // 48,64,80,96,112
      const color = corpColors[Math.floor(Math.random() * corpColors.length)];
      const g = scene.add.graphics().setDepth(50);
      g.fillStyle(color, 1);
      const size = 1 + Math.floor(Math.random() * 4);
      g.fillRect(-size / 2, -size / 2, size, size);
      const jx = Math.round(x + (Math.random() - 0.5) * 16);
      const jy = Math.round(y + (Math.random() - 0.5) * 12);
      g.setPosition(jx, jy);
      scene.tweens.add({
        targets: g,
        x: Math.round(jx + Math.cos(angle) * speed),
        y: Math.round(jy + Math.sin(angle) * speed),
        alpha: 0,
        scaleX: 0.25,
        scaleY: 0.25,
        duration: 384 + Math.floor(Math.random() * 14) * 16, // 384-608, multiples of 16
        ease: "Quad.easeOut",
        onUpdate: () => { g.setPosition(Math.round(g.x), Math.round(g.y)); },
        onComplete: () => g.destroy(),
      });
    }
  }
}
