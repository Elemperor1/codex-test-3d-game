import * as THREE from 'three';

export function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  return renderer;
}

export function createCamera(container) {
  const aspect = container.clientWidth / container.clientHeight;
  const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 500);
  camera.position.set(0, 4, 12);
  return camera;
}

export function createScene(config) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#111319');
  scene.fog = new THREE.Fog('#0c0e14', config.scene.fogNear, config.scene.fogFar);

  const hemiLight = new THREE.HemisphereLight('#a3b9ff', '#1b1f2a', 0.9);
  hemiLight.position.set(0, 20, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight('#f7f9ff', 0.9);
  dirLight.castShadow = true;
  dirLight.position.set(16, 32, 6);
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  scene.add(dirLight);

  return scene;
}

export function buildLevelGeometry(scene, levelData, config) {
  const floorGeo = new THREE.BoxGeometry(config.scene.floorSize, 1, config.scene.floorSize);
  const floorMat = new THREE.MeshStandardMaterial({ color: '#1f2632' });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(0, -0.5, 0);
  floor.receiveShadow = true;
  scene.add(floor);

  const obstacleMat = new THREE.MeshStandardMaterial({ color: '#3e4a62' });

  levelData.obstacles.forEach((obstacle) => {
    const [width, height, depth] = obstacle.size;
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geometry, obstacleMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const [x, y, z] = obstacle.position;
    mesh.position.set(x, y, z);
    scene.add(mesh);
  });
}

export function setupResizing(camera, renderer, container) {
  function handleResize() {
    const { clientWidth, clientHeight } = container;
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(clientWidth, clientHeight);
  }

  window.addEventListener('resize', handleResize);
}
