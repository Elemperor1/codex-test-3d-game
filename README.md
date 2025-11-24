# WebGL Training Arena

This repository contains a minimal 3D starter built with [three.js](https://threejs.org/) and Vite. It includes basic player controls, enemy spawning/AI, HUD, and level geometry scaffolding.

## Project structure

- `scripts/` – ES modules for the game loop and engine helpers.
  - `core/` – Scene/camera/renderer setup and level utilities.
  - `player/` – Player controller, aiming, and shooting logic.
  - `enemy/` – Simple enemy actor and spawner.
  - `hud/` – Lightweight DOM HUD overlay.
- `config/` – Tunable gameplay and scene configuration.
- `scenes/` – Level JSON files (e.g., `trainingGround.json`).
- `assets/` – Placeholder for textures, models, and audio.
- `index.html` – Entry point that mounts the renderer and HUD.

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the development server:
   ```bash
   npm run dev
   ```
   Open the printed local URL in your browser. Click to lock the mouse, use **WASD** to move, and left-click to fire.
3. Build for production:
   ```bash
   npm run build
   ```
4. Preview the production build locally:
   ```bash
   npm run preview
   ```

## Gameplay notes

- The `trainingGround` level spawns cone-shaped enemies at timed intervals from predefined points.
- Projectiles travel in the direction the camera is facing and remove enemies on contact.
- The HUD shows your score and number of active enemies. Update configuration values in `config/gameConfig.js` to tweak speeds, fire rate, and spawn density.
