import * as THREE from 'three';
import { applyMovementWithCollisions } from '../core/collision.js';
import { logger } from '../core/logger.js';

const PROJECTILE_OBSTACLE_PADDING = 0.25;

export class Enemy {
  constructor(scene, position, config, type) {
    this.scene = scene;
    this.config = config;
    this.type = type || config.enemies.defaultType;
    this.stats = config.enemies.archetypes[this.type] || config.enemies.archetypes[config.enemies.defaultType];
    this.speed = this.stats.speed;
    this.health = this.stats.health;
    this.attackCooldown = this.stats.attackCooldown;
    this.attackTimer = 0;
    this.patrolTarget = null;
    this.spawnPoint = new THREE.Vector3(position.x, position.y, position.z);
    this.elapsed = 0;
    this.state = 'patrol';
    this.stateTime = 0;
    this.projectiles = [];
    this.deathTimer = 0;
    this.isDead = false;
    this.collisionRadius = this.stats.collisionRadius || 0.9;
    this.lastCollisionLog = 0;
    this.navigationLogger = logger.withContext({ module: 'enemy', feature: 'navigation', archetype: this.type });
    this.projectileLogger = logger.withContext({ module: 'enemy', feature: 'projectiles', archetype: this.type });

    this.mesh = this.createMesh();
    this.mesh.position.copy(position);
  }

  createMesh() {
    const geometry = new THREE.ConeGeometry(0.8, 2, 6);
    const material = new THREE.MeshStandardMaterial({
      color: this.type === 'ranger' ? '#7dd3fc' : '#ff5c8a',
      emissive: this.type === 'ranger' ? '#0ea5e9' : '#c5305b',
      emissiveIntensity: 0.5
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.rotation.x = Math.PI;
    return mesh;
  }

  setState(nextState) {
    if (this.state === nextState) return;
    this.state = nextState;
    this.stateTime = 0;

    if (nextState === 'attack') {
      this.mesh.material.emissiveIntensity = 1;
      this.mesh.scale.setScalar(1.05);
    } else if (nextState === 'chase') {
      this.mesh.material.emissiveIntensity = 0.7;
      this.mesh.scale.setScalar(1);
    } else {
      this.mesh.material.emissiveIntensity = 0.5;
      this.mesh.scale.setScalar(0.95);
    }
  }

  update(player, delta, obstacles = []) {
    this.elapsed += delta;
    this.stateTime += delta;

    if (this.isDead) {
      this.updateDeath(delta);
      return;
    }

    this.attackTimer -= delta;

    const playerPosition = player.controls.getObject().position;
    const distanceToPlayer = this.mesh.position.distanceTo(playerPosition);

    if (distanceToPlayer <= this.stats.attackRange) {
      this.setState('attack');
    } else if (distanceToPlayer <= this.stats.aggroRange) {
      this.setState('chase');
    } else {
      this.setState('patrol');
    }

    if (this.state === 'patrol') {
      this.patrol(delta, obstacles);
    } else if (this.state === 'chase') {
      this.chase(playerPosition, delta, obstacles);
    } else if (this.state === 'attack') {
      this.attack(player, playerPosition, delta, obstacles, distanceToPlayer);
    }

    this.updateProjectiles(delta, player, obstacles);
  }

  patrol(delta, obstacles) {
    if (!this.patrolTarget || this.mesh.position.distanceTo(this.patrolTarget) < 1) {
      this.patrolTarget = this.createPatrolPoint();
    }

    this.moveTowards(this.patrolTarget, delta, obstacles, 0.3);
  }

  chase(targetPosition, delta, obstacles) {
    this.moveTowards(targetPosition, delta, obstacles, this.stats.strafeAmplitude);
  }

  attack(player, targetPosition, delta, obstacles, distanceToPlayer) {
    if (distanceToPlayer > this.stats.attackRange * 1.2) {
      this.setState('chase');
      return;
    }

    this.moveTowards(targetPosition, delta, obstacles, this.stats.strafeAmplitude);
    this.tryAttack(player, targetPosition, distanceToPlayer);
  }

  tryAttack(player, targetPosition, distanceToPlayer) {
    if (this.attackTimer > 0) return;

    if (this.stats.attackType === 'ranged') {
      this.performRangedAttack(targetPosition);
    } else if (distanceToPlayer <= this.stats.attackRange + 0.5) {
      this.performMeleeAttack(player);
    }

    this.attackTimer = this.attackCooldown;
  }

  performMeleeAttack(player) {
    player.takeDamage(this.stats.attackDamage);
    this.mesh.scale.setScalar(1.15);
    setTimeout(() => this.mesh.scale.setScalar(1), 120);
  }

  performRangedAttack(targetPosition) {
    const geometry = new THREE.SphereGeometry(0.18, 10, 10);
    const material = new THREE.MeshStandardMaterial({ color: '#7c3aed', emissive: '#c084fc' });
    const projectile = new THREE.Mesh(geometry, material);
    projectile.castShadow = true;
    projectile.position.copy(this.mesh.position);

    const direction = new THREE.Vector3().subVectors(targetPosition, this.mesh.position).setY(0).normalize();
    projectile.userData.velocity = direction.multiplyScalar(this.stats.projectileSpeed || 64);
    projectile.userData.spawnedAt = performance.now() / 1000;
    projectile.userData.lifetime = this.stats.projectileLifetime || 2.2;

    this.scene.add(projectile);
    this.projectiles.push(projectile);
  }

  moveTowards(target, delta, obstacles, strafeAmount = 0) {
    const desired = new THREE.Vector3().subVectors(target, this.mesh.position);
    desired.y = 0;

    if (desired.lengthSq() === 0) return;

    const forward = desired.clone().normalize();

    if (strafeAmount) {
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
      desired.addScaledVector(right, Math.sin(this.elapsed * 2) * strafeAmount);
    }

    desired.add(this.computeAvoidance(obstacles));

    if (desired.lengthSq() > 0.001) {
      desired.normalize();
      const step = desired.multiplyScalar(this.speed * delta);
      const { position: resolvedPosition, blockedAxes } = applyMovementWithCollisions(
        this.mesh.position,
        step,
        obstacles,
        this.collisionRadius
      );

      this.mesh.position.copy(resolvedPosition);
      this.logCollision(blockedAxes, resolvedPosition, obstacles.length);
      this.mesh.lookAt(target.x, this.mesh.position.y, target.z);
    }
  }

  computeAvoidance(obstacles) {
    const avoidance = new THREE.Vector3();
    const avoidRadius = this.config.enemies.avoidance.radius;

    obstacles.forEach((obstacle) => {
      const closestPoint = obstacle.box.clampPoint(this.mesh.position, new THREE.Vector3());
      const offset = new THREE.Vector3().subVectors(this.mesh.position, closestPoint);
      const distance = offset.length();
      if (distance > 0 && distance < avoidRadius) {
        const weight = (avoidRadius - distance) / avoidRadius;
        avoidance.add(offset.normalize().multiplyScalar(weight * this.config.enemies.avoidance.strength));
      }
    });

    return avoidance;
  }

  projectilePathBlocked(startPosition, nextPosition, obstacles) {
    if (!obstacles || obstacles.length === 0) return false;

    const path = new THREE.Line3(startPosition, nextPosition);

    return obstacles.some(({ box }) => {
      const paddedBox = box.clone().expandByScalar(PROJECTILE_OBSTACLE_PADDING);
      return paddedBox.intersectsLine(path);
    });
  }

  logCollision(blockedAxes, position, obstacleCount) {
    if (!blockedAxes || blockedAxes.length === 0) return;

    const now = performance.now();
    if (now - this.lastCollisionLog < 350) return;
    this.lastCollisionLog = now;

    this.navigationLogger.debug('Enemy movement blocked by obstacle.', {
      actorId: this.id || 'enemy',
      blockedAxes,
      position: { x: position.x, y: position.y, z: position.z },
      obstacleCount,
      module: 'enemy',
      feature: 'navigation'
    });
  }

  createPatrolPoint() {
    const radius = this.stats.patrolRadius;
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * radius;
    return new THREE.Vector3(
      this.spawnPoint.x + Math.cos(angle) * distance,
      this.spawnPoint.y,
      this.spawnPoint.z + Math.sin(angle) * distance
    );
  }

  updateProjectiles(delta, player, obstacles = []) {
    const now = performance.now() / 1000;
    this.projectiles = this.projectiles.filter((projectile) => {
      const startPosition = projectile.position.clone();
      const nextPosition = startPosition.clone().addScaledVector(projectile.userData.velocity, delta);

      const lifetime = now - projectile.userData.spawnedAt;
      if (lifetime > projectile.userData.lifetime) {
        this.scene.remove(projectile);
        return false;
      }

      if (this.projectilePathBlocked(startPosition, nextPosition, obstacles)) {
        this.scene.remove(projectile);
        this.projectileLogger.debug('Enemy projectile intercepted by obstacle.', {
          actorId: this.id || 'enemy',
          obstacleCount: obstacles.length,
          module: 'enemy',
          feature: 'projectiles'
        });
        return false;
      }

      projectile.position.copy(nextPosition);

      const distanceToPlayer = projectile.position.distanceTo(player.controls.getObject().position);
      if (distanceToPlayer < 1) {
        player.takeDamage(this.stats.attackDamage);
        this.scene.remove(projectile);
        return false;
      }

      return true;
    });
  }

  updateDeath(delta) {
    if (this.deathTimer <= 0) return;
    this.deathTimer -= delta;
    const shrinkTarget = new THREE.Vector3(0.1, 0.05, 0.1);
    this.mesh.scale.lerp(shrinkTarget, 1 - Math.exp(-delta * 8));
    if (this.deathTimer <= 0) {
      this.scene.remove(this.mesh);
    }
  }

  hit(damage) {
    if (this.isDead) return;
    this.health -= damage;
    this.mesh.material.emissiveIntensity = 1.2;
    setTimeout(() => {
      if (!this.isDead) {
        this.mesh.material.emissiveIntensity = 0.7;
      }
    }, 80);

    if (this.health <= 0) {
      this.isDead = true;
      this.deathTimer = 0.6;
      this.mesh.material.color.set('#2e3140');
      this.mesh.material.emissive.set('#1f2937');
    } else if (this.state === 'patrol') {
      this.setState('chase');
    }
  }
}
