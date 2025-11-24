import * as THREE from 'three';

export class Enemy {
  constructor(position, config) {
    this.speed = config.enemies.speed;
    this.mesh = this.createMesh();
    this.mesh.position.copy(position);
    this.health = 1;
    this.isDead = false;
  }

  createMesh() {
    const geometry = new THREE.ConeGeometry(0.8, 2, 6);
    const material = new THREE.MeshStandardMaterial({ color: '#ff5c8a', emissive: '#c5305b' });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.rotation.x = Math.PI;
    return mesh;
  }

  update(targetPosition, delta) {
    if (this.isDead) return;

    const direction = new THREE.Vector3().subVectors(targetPosition, this.mesh.position);
    direction.y = 0;
    const distance = direction.length();

    if (distance > 0.001) {
      direction.normalize();
      this.mesh.position.addScaledVector(direction, this.speed * delta);
      this.mesh.lookAt(targetPosition.x, this.mesh.position.y, targetPosition.z);
    }
  }

  hit(damage) {
    this.health -= damage;
    if (this.health <= 0) {
      this.isDead = true;
    }
  }
}
