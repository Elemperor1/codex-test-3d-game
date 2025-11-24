export class Hud {
  constructor(root) {
    this.root = root;
    this.root.innerHTML = '';

    this.topBar = document.createElement('div');
    this.topBar.className = 'hud-top';

    this.scoreDisplay = document.createElement('div');
    this.enemyDisplay = document.createElement('div');

    this.bottom = document.createElement('div');
    this.bottom.className = 'hud-bottom';
    this.bottom.innerHTML = 'Click to lock the mouse, WASD to move, Left click to shoot';

    this.topBar.appendChild(this.scoreDisplay);
    this.topBar.appendChild(this.enemyDisplay);
    this.root.appendChild(this.topBar);
    this.root.appendChild(this.bottom);

    this.update({ score: 0, enemiesRemaining: 0 });
  }

  update({ score, enemiesRemaining }) {
    this.scoreDisplay.textContent = `Score: ${score}`;
    this.enemyDisplay.textContent = `Active enemies: ${enemiesRemaining}`;
  }
}
