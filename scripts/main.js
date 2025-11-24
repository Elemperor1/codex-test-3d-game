import * as THREE from 'three';
import gameConfig from '../config/gameConfig.js';
import { createCamera, createRenderer, createScene, buildLevelGeometry, setupResizing } from './core/engine.js';
import { loadLevel } from './core/levelLoader.js';
import { logger } from './core/logger.js';
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

// Initialize client-side sinks before gameplay begins.
logger.enableOverlaySink(gameConfig.logging?.overlay);
if (gameConfig.logging?.networkEndpoint) {
  // Network sink is optional; configure URL via gameConfig.logging.networkEndpoint.
  logger.registerNetworkSink(gameConfig.logging.networkEndpoint, gameConfig.logging?.networkFetchOptions);
}

const sessionLogger = logger.withContext({ module: 'session', feature: 'lifecycle' });
const waveLogger = logger.withContext({ module: 'waves', feature: 'spawner' });
const playerLogger = logger.withContext({ module: 'player', feature: 'state' });

player.onDeath = () => {
  logger.addBreadcrumb('player_death', { health: player.health, armor: player.armor });
  playerLogger.error('Player defeated. Offering restart prompt.', {
    actorId: player.id,
    health: player.health,
    armor: player.armor
  });
  hud.showRestart(restartGame);
};

spawner.setCallbacks({
  onWaveStart: (waveNumber, totalWaves, wave) => {
    const types = wave.types && wave.types.length > 0 ? wave.types.join(', ') : gameConfig.enemies.defaultType;
    hud.setWaveStatus(`Wave ${waveNumber}/${totalWaves}: ${types}`);
    logger.addBreadcrumb('wave_start', { waveNumber, totalWaves, types });
    waveLogger.info('Wave started.', { waveNumber, totalWaves, types });
  },
  onWaveComplete: (waveNumber, totalWaves) => {
    hud.setWaveStatus(`Wave ${waveNumber}/${totalWaves} cleared`);
    logger.addBreadcrumb('wave_complete', { waveNumber, totalWaves });
    waveLogger.info('Wave cleared.', { waveNumber, totalWaves });
  },
  onIntermission: (nextWave, totalWaves, timeRemaining) => {
    hud.showIntermission(nextWave, totalWaves, timeRemaining);
    logger.addBreadcrumb('wave_intermission', { nextWave, totalWaves, timeRemaining });
    waveLogger.debug('Intermission started.', { nextWave, totalWaves, timeRemaining });
  },
  onScheduleComplete: () => {
    logger.addBreadcrumb('all_waves_cleared', { totalWaves: spawner.totalWaves });
    hud.setWaveStatus('All waves defeated!');
    player.bottomMessage('All enemy waves cleared!');
    waveLogger.info('Enemy schedule complete.', { totalWaves: spawner.totalWaves });
  }
});

const clock = new THREE.Clock();

async function start() {
  logger.startSession('trainingGround');
  logger.addBreadcrumb('scene_load_start', { level: 'trainingGround', source: '/scenes/trainingGround.json' });
  try {
    const level = await loadLevel('/scenes/trainingGround.json');
    logger.setLevelName(level.name || 'trainingGround');
    buildLevelGeometry(scene, level, gameConfig);
    player.setPosition(new THREE.Vector3(...level.playerStart));
    spawner.loadSpawnPoints(level.enemySpawnPoints);
    spawner.setObstacles(level.obstacles);
    spawner.setAllowedTypes(level.enemyTypes || []);
    spawner.configureWaves(level.waves || gameConfig.enemies.waves);
    logger.addBreadcrumb('scene_load_complete', { level: logger.levelName, spawnPoints: level.enemySpawnPoints?.length });
    sessionLogger.info('Level loaded and session ready.', {
      level: logger.levelName,
      spawnPoints: level.enemySpawnPoints?.length,
      waveCount: (level.waves || gameConfig.enemies.waves).length
    });
  } catch (error) {
    logger.error('Failed to initialize the training ground.', {
      error,
      module: 'main',
      stage: 'start',
      nextSteps: 'Reload the page or check your network connection. If the issue continues, report the error and try again later.'
    });
  }

  animate();
}

function restartGame() {
  window.location.reload();
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  spawner.update(delta, player);
  player.update(delta, spawner.enemies);

  renderer.render(scene, camera);
}

start();
