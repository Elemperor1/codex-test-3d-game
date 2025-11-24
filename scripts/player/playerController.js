import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { applyMovementWithCollisions } from '../core/collision.js';
import { logger } from '../core/logger.js';

const PROJECTILE_OBSTACLE_PADDING = 0.25;

export class PlayerController {
  constructor(camera, renderer, scene, hud, config) {
    this.camera = camera;
    this.scene = scene;
    this.hud = hud;
    this.config = config;
    this.keys = {};
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.obstacles = [];
    this.projectiles = [];
    this.cooldown = 0;
    this.score = 0;
    this.maxHealth = config.player.maxHealth;
    this.maxArmor = config.player.maxArmor;
    this.health = this.maxHealth;
    this.armor = this.maxArmor;
    this.healthRegenRate = config.player.healthRegenRate || 0;
    this.armorRegenRate = config.player.armorRegenRate || 0;
    this.lowHealthThreshold = config.player.lowHealthThreshold || 0.2;
    this.collisionRadius = config.player.collisionRadius || 1;
    this.magazineSize = config.combat.magazineSize || 24;
    this.ammoInMagazine = this.magazineSize;
    this.reserveAmmo = config.combat.reserveAmmo || 0;
    this.reloadTime = config.combat.reloadTime || 1.5;
    this.reloadTimer = 0;
    this.isReloading = false;
    this.isDead = false;
    this.id = 'player';
    this.lastCollisionLog = 0;
    this.movementLogger = logger.withContext({ module: 'player', feature: 'navigation' });
    this.projectileLogger = logger.withContext({ module: 'player', feature: 'projectiles' });

    this.controls = new PointerLockControls(camera, renderer.domElement);
    renderer.domElement.addEventListener('click', () => this.controls.lock());

    this.setupInput(renderer.domElement);
  }

  setupInput(target) {
    document.addEventListener('keydown', (event) => {
      if (this.isDead) return;
      this.keys[event.code] = true;
      if (event.code === 'KeyR') {
        this.beginReload();
      }
    });

    document.addEventListener('keyup', (event) => {
      if (this.isDead) return;
      this.keys[event.code] = false;
    });

    target.addEventListener('mousedown', (event) => {
      if (this.isDead || this.isReloading) return;
      if (event.button === 0) {
        this.queueShot = true;
      }
    });
  }

  setPosition(position) {
    this.controls.getObject().position.copy(position);
  }

  setObstacles(obstacles = []) {
    this.obstacles = obstacles;
    this.movementLogger.info('Player collision bounds configured.', {
      actorId: this.id,
      obstacleCount: obstacles.length,
      module: 'player',
      scene: this.scene?.name || 'trainingGround'
    });
  }

  update(delta, enemies) {
    const { acceleration, deceleration, maxSpeed } = this.config.movement;
    const controlsObject = this.controls.getObject();

    if (this.isDead) {
      this.hud.update(this.buildHudState(enemies.length));
      return;
    }

    this.direction.set(0, 0, 0);
    if (this.keys['KeyW']) this.direction.z += 1;
    if (this.keys['KeyS']) this.direction.z -= 1;
    if (this.keys['KeyA']) this.direction.x -= 1;
    if (this.keys['KeyD']) this.direction.x += 1;

    this.direction.normalize();

    if (this.direction.lengthSq() > 0) {
      this.velocity.x += this.direction.x * acceleration * delta;
      this.velocity.z += this.direction.z * acceleration * delta;
    } else {
      this.velocity.x -= this.velocity.x * deceleration * delta;
      this.velocity.z -= this.velocity.z * deceleration * delta;
    }

    this.velocity.x = THREE.MathUtils.clamp(this.velocity.x, -maxSpeed, maxSpeed);
    this.velocity.z = THREE.MathUtils.clamp(this.velocity.z, -maxSpeed, maxSpeed);

    const moveVector = new THREE.Vector3(this.velocity.x * delta, 0, -this.velocity.z * delta);
    const { position: resolvedPosition, blockedAxes } = applyMovementWithCollisions(
      controlsObject.position,
      moveVector,
      this.obstacles,
      this.collisionRadius
    );

    if (blockedAxes.includes('x')) {
      this.velocity.x = 0;
    }
    if (blockedAxes.includes('z')) {
      this.velocity.z = 0;
    }

    controlsObject.position.copy(resolvedPosition);
    controlsObject.position.y = 2.4;
    this.logCollision(blockedAxes, resolvedPosition);

    this.tickRegen(delta);
    this.updateReload(delta);

    this.cooldown -= delta;
    if (this.queueShot && this.cooldown <= 0 && this.consumeAmmo()) {
      this.shoot();
      this.cooldown = 1 / this.config.combat.fireRate;
    } else if (this.queueShot && this.ammoInMagazine <= 0) {
      this.beginReload();
    }
    this.queueShot = false;

    this.updateProjectiles(delta, enemies);
    this.hud.update(this.buildHudState(enemies.length));
  }

  logCollision(blockedAxes, resolvedPosition) {
    if (!blockedAxes.length) return;

    const now = performance.now();
    if (now - this.lastCollisionLog < 300) return;
    this.lastCollisionLog = now;

    this.movementLogger.debug('Collision prevented player movement.', {
      actorId: this.id,
      blockedAxes,
      position: { x: resolvedPosition.x, y: resolvedPosition.y, z: resolvedPosition.z },
      obstacleCount: this.obstacles.length,
      module: 'player',
      feature: 'navigation'
    });
  }

  projectilePathBlocked(startPosition, nextPosition) {
    if (!this.obstacles || this.obstacles.length === 0) return false;

    const path = new THREE.Line3(startPosition, nextPosition);

    return this.obstacles.some(({ box }) => {
      const paddedBox = box.clone().expandByScalar(PROJECTILE_OBSTACLE_PADDING);
      return paddedBox.intersectsLine(path);
    });
  }

  shoot() {
    const geometry = new THREE.SphereGeometry(0.15, 8, 8);
    const material = new THREE.MeshStandardMaterial({ color: '#ffbf47', emissive: '#ffa62b' });
    const projectile = new THREE.Mesh(geometry, material);
    projectile.castShadow = true;

    const origin = this.controls.getObject().position.clone();
    projectile.position.copy(origin);

    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();
    projectile.userData.velocity = direction.multiplyScalar(this.config.combat.projectileSpeed);
    projectile.userData.spawnedAt = performance.now() / 1000;

    this.scene.add(projectile);
    this.projectiles.push(projectile);
  }

  takeDamage(amount) {
    if (this.isDead) return;

    const armorDamage = Math.min(this.armor, amount);
    const remainingDamage = amount - armorDamage;
    this.armor = Math.max(0, this.armor - armorDamage);
    this.health = Math.max(0, this.health - remainingDamage);

    this.hud.showDamageIndicator();
    const isLowHealth = this.health / this.maxHealth <= this.lowHealthThreshold;
    this.hud.update({ ...this.buildHudState(this.hud.enemiesRemaining || 0), lowHealth: isLowHealth });

    if (this.health === 0) {
      this.handleDeath();
    }
  }

  handleDeath() {
    this.isDead = true;
    this.bottomMessage('You were defeated! Restart to try again.');
    this.controls.unlock();
    if (typeof this.onDeath === 'function') {
      this.onDeath();
    }
  }

  beginReload() {
    if (this.isDead || this.isReloading) return;
    const hasSpareAmmo = this.reserveAmmo > 0;
    const needsAmmo = this.ammoInMagazine < this.magazineSize;
    if (!hasSpareAmmo || !needsAmmo) return;
    this.isReloading = true;
    this.reloadTimer = this.reloadTime;
    this.hud.update({ ...this.buildHudState(this.hud.enemiesRemaining || 0), isReloading: true });
  }

  updateReload(delta) {
    if (!this.isReloading) return;
    this.reloadTimer -= delta;
    if (this.reloadTimer <= 0) {
      const needed = this.magazineSize - this.ammoInMagazine;
      const toLoad = Math.min(needed, this.reserveAmmo);
      this.ammoInMagazine += toLoad;
      this.reserveAmmo -= toLoad;
      this.isReloading = false;
    }
  }

  consumeAmmo() {
    if (this.ammoInMagazine <= 0 || this.isReloading) return false;
    this.ammoInMagazine -= 1;
    return true;
  }

  tickRegen(delta) {
    if (this.health > 0) {
      if (this.health < this.maxHealth) {
        this.health = Math.min(this.maxHealth, this.health + this.healthRegenRate * delta);
      }
      if (this.armor < this.maxArmor) {
        this.armor = Math.min(this.maxArmor, this.armor + this.armorRegenRate * delta);
      }
    }
  }

  bottomMessage(text) {
    if (this.hud && this.hud.bottom) {
      this.hud.bottom.textContent = text;
    }
  }

  updateProjectiles(delta, enemies) {
    const now = performance.now() / 1000;

    this.projectiles = this.projectiles.filter((projectile) => {
      const startPosition = projectile.position.clone();
      const nextPosition = startPosition.clone().addScaledVector(projectile.userData.velocity, delta);

      const lifetime = now - projectile.userData.spawnedAt;
      if (lifetime > this.config.combat.projectileLifetime) {
        this.scene.remove(projectile);
        return false;
      }

      if (this.projectilePathBlocked(startPosition, nextPosition)) {
        this.scene.remove(projectile);
        this.projectileLogger.debug('Player projectile intercepted by obstacle.', {
          actorId: this.id,
          obstacleCount: this.obstacles.length,
          module: 'player',
          feature: 'projectiles'
        });
        return false;
      }

      projectile.position.copy(nextPosition);

      for (let i = 0; i < enemies.length; i += 1) {
        const enemy = enemies[i];
        if (enemy.isDead) continue;
        const distance = projectile.position.distanceTo(enemy.mesh.position);
        if (distance < 1) {
          this.scene.remove(projectile);
          enemy.hit(this.config.combat.damage);
          if (enemy.isDead) {
            enemy.markedForRemoval = true;
            this.score += 100;
          }
          return false;
        }
      }

      return true;
    });
  }

  buildHudState(enemiesRemaining) {
    return {
      score: this.score,
      enemiesRemaining,
      health: Math.round(this.health),
      armor: Math.round(this.armor),
      maxHealth: this.maxHealth,
      maxArmor: this.maxArmor,
      ammoInMagazine: this.ammoInMagazine,
      magazineSize: this.magazineSize,
      reserveAmmo: this.reserveAmmo,
      isReloading: this.isReloading,
      lowHealth: this.health / this.maxHealth <= this.lowHealthThreshold
    };
  }
}
