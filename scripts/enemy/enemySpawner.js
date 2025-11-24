import { Enemy } from './enemy.js';

export class EnemySpawner {
  constructor(scene, config) {
    this.scene = scene;
    this.config = config;
    this.enemies = [];
    this.spawnTimer = 0;
    this.spawnPoints = [];
  }

  loadSpawnPoints(points) {
    this.spawnPoints = points.map(([x, y, z]) => ({ x, y, z }));
  }

  update(delta, targetPosition) {
    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0 && this.enemies.length < this.config.enemies.maxSimultaneous) {
      this.spawnEnemy();
      this.spawnTimer = this.config.enemies.spawnInterval;
    }

    this.enemies.forEach((enemy) => enemy.update(targetPosition, delta));
  }

  spawnEnemy() {
    if (this.spawnPoints.length === 0) return;
    const index = Math.floor(Math.random() * this.spawnPoints.length);
    const point = this.spawnPoints[index];
    const enemy = new Enemy(point, this.config);
    this.scene.add(enemy.mesh);
    this.enemies.push(enemy);
  }
}
