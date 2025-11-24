import * as THREE from 'three';
import gameConfig from '../config/gameConfig.js';
import { createCamera, createRenderer, createScene, buildLevelGeometry, setupResizing } from './core/engine.js';
import { loadLevel } from './core/levelLoader.js';
import { PlayerController } from './player/playerController.js';
import { EnemySpawner } from './enemy/enemySpawner.js';
import { Hud } from './hud/hud.js';

const container = document.getElementById('app');
const hud = new Hud(document.getElementById('hud-root'));

const scene = createScene(gameConfig);
const renderer = createRenderer(container);
const camera = createCamera(container);
setupResizing(camera, renderer, container);

const player = new PlayerController(camera, renderer, scene, hud, gameConfig);
const spawner = new EnemySpawner(scene, gameConfig);

const clock = new THREE.Clock();

async function start() {
  try {
    const level = await loadLevel('/scenes/trainingGround.json');
    buildLevelGeometry(scene, level, gameConfig);
    player.setPosition(new THREE.Vector3(...level.playerStart));
    spawner.loadSpawnPoints(level.enemySpawnPoints);
  } catch (error) {
    console.error(error);
  }

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  spawner.update(delta, player.controls.getObject().position);
  player.update(delta, spawner.enemies);

  renderer.render(scene, camera);
}

start();
