import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

export class PlayerController {
  constructor(camera, renderer, scene, hud, config) {
    this.camera = camera;
    this.scene = scene;
    this.hud = hud;
    this.config = config;
    this.keys = {};
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.projectiles = [];
    this.cooldown = 0;
    this.score = 0;

    this.controls = new PointerLockControls(camera, renderer.domElement);
    renderer.domElement.addEventListener('click', () => this.controls.lock());

    this.setupInput(renderer.domElement);
  }

  setupInput(target) {
    document.addEventListener('keydown', (event) => {
      this.keys[event.code] = true;
    });

    document.addEventListener('keyup', (event) => {
      this.keys[event.code] = false;
    });

    target.addEventListener('mousedown', (event) => {
      if (event.button === 0) {
        this.queueShot = true;
      }
    });
  }

  setPosition(position) {
    this.controls.getObject().position.copy(position);
  }

  update(delta, enemies) {
    const { acceleration, deceleration, maxSpeed } = this.config.movement;
    const controlsObject = this.controls.getObject();

    this.direction.set(0, 0, 0);
    if (this.keys['KeyW']) this.direction.z -= 1;
    if (this.keys['KeyS']) this.direction.z += 1;
    if (this.keys['KeyA']) this.direction.x -= 1;
    if (this.keys['KeyD']) this.direction.x += 1;

    this.direction.normalize();

    if (this.direction.lengthSq() > 0) {
      this.velocity.x -= this.direction.x * acceleration * delta;
      this.velocity.z -= this.direction.z * acceleration * delta;
    } else {
      this.velocity.x -= this.velocity.x * deceleration * delta;
      this.velocity.z -= this.velocity.z * deceleration * delta;
    }

    this.velocity.x = THREE.MathUtils.clamp(this.velocity.x, -maxSpeed, maxSpeed);
    this.velocity.z = THREE.MathUtils.clamp(this.velocity.z, -maxSpeed, maxSpeed);

    controlsObject.translateX(this.velocity.x * delta);
    controlsObject.translateZ(this.velocity.z * delta);

    controlsObject.position.y = 2.4;

    this.cooldown -= delta;
    if (this.queueShot && this.cooldown <= 0) {
      this.shoot();
      this.cooldown = 1 / this.config.combat.fireRate;
    }
    this.queueShot = false;

    this.updateProjectiles(delta, enemies);
    this.hud.update({ score: this.score, enemiesRemaining: enemies.length });
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

  updateProjectiles(delta, enemies) {
    const now = performance.now() / 1000;

    this.projectiles = this.projectiles.filter((projectile) => {
      projectile.position.addScaledVector(projectile.userData.velocity, delta);

      const lifetime = now - projectile.userData.spawnedAt;
      if (lifetime > this.config.combat.projectileLifetime) {
        this.scene.remove(projectile);
        return false;
      }

      for (let i = 0; i < enemies.length; i += 1) {
        const enemy = enemies[i];
        const distance = projectile.position.distanceTo(enemy.mesh.position);
        if (distance < 1) {
          this.scene.remove(projectile);
          enemy.hit(this.config.combat.damage);
          if (enemy.isDead) {
            enemies.splice(i, 1);
            this.score += 100;
          }
          return false;
        }
      }

      return true;
    });
  }
}
