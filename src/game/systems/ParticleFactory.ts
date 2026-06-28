import Phaser from "phaser";

export class ParticleFactory {
  static hitLight(scene: Phaser.Scene, x: number, y: number) {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const speed = 55 + Math.random() * 40;
      const g = scene.add.graphics().setDepth(50);
      g.fillStyle(0xffffff, 1);
      g.fillRect(-2, -2, 4, 4);
      g.setPosition(x, y);
      scene.tweens.add({
        targets: g,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 180,
        ease: "Quad.easeOut",
        onComplete: () => g.destroy(),
      });
    }
  }

  static hitHeavy(scene: Phaser.Scene, x: number, y: number) {
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const speed = 70 + Math.random() * 70;
      const color = Math.random() > 0.5 ? 0xff6600 : 0xff3300;
      const g = scene.add.graphics().setDepth(50);
      g.fillStyle(color, 1);
      const size = 2 + Math.floor(Math.random() * 3);
      g.fillRect(-size / 2, -size / 2, size, size);
      g.setPosition(x, y);
      scene.tweens.add({
        targets: g,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed - 20,
        alpha: 0,
        duration: 320,
        ease: "Quad.easeOut",
        onComplete: () => g.destroy(),
      });
    }
  }

  static enemyDeath(scene: Phaser.Scene, x: number, y: number) {
    const colors = [0xffffff, 0xffaa00, 0xff4444, 0xaaaaaa, 0xffdd00];
    for (let i = 0; i < 22; i++) {
      const angle = (i / 22) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 45 + Math.random() * 110;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const g = scene.add.graphics().setDepth(50);
      g.fillStyle(color, 1);
      const size = 1 + Math.floor(Math.random() * 4);
      g.fillRect(-size / 2, -size / 2, size, size);
      g.setPosition(x, y);
      scene.tweens.add({
        targets: g,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scaleX: 0.1,
        scaleY: 0.1,
        duration: 380 + Math.random() * 220,
        ease: "Quad.easeOut",
        onComplete: () => g.destroy(),
      });
    }
  }
}
