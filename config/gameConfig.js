const gameConfig = {
  movement: {
    acceleration: 80,
    deceleration: 12,
    maxSpeed: 24
  },
  combat: {
    fireRate: 6,
    projectileSpeed: 120,
    projectileLifetime: 2.5,
    damage: 1
  },
  enemies: {
    speed: 6,
    spawnInterval: 4,
    maxSimultaneous: 10
  },
  scene: {
    fogNear: 20,
    fogFar: 140,
    floorSize: 120
  }
};

export default gameConfig;
