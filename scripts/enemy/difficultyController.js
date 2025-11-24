import { logger } from '../core/logger.js';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export class DifficultyController {
  constructor(config) {
    this.config = config || {};
    this.currentModifier = 1;
    this.currentBand = 'baseline';
    this.timeToKillSamples = [];
    this.spawnTimes = new Map();
    this.initialAmmo = null;
    this.difficultyLogger = logger.withContext({ module: 'waves', feature: 'difficulty' });
  }

  trackSpawn(enemy) {
    const now = performance.now() / 1000;
    this.spawnTimes.set(enemy.id, now);
    if (!this.initialAmmo && enemy.config?.combat) {
      this.initialAmmo = enemy.config.combat.magazineSize + enemy.config.combat.reserveAmmo;
    }
  }

  trackKill(enemy) {
    const killedAt = performance.now() / 1000;
    const spawnedAt = this.spawnTimes.get(enemy.id);
    if (spawnedAt) {
      const ttk = killedAt - spawnedAt;
      this.timeToKillSamples.push(ttk);
      const limit = this.config.maxTtkSamples || 24;
      if (this.timeToKillSamples.length > limit) {
        this.timeToKillSamples.shift();
      }
      this.spawnTimes.delete(enemy.id);
    }
  }

  calculateMetrics(player) {
    const { targets = {} } = this.config;
    const averageTimeToKill = this.timeToKillSamples.length
      ? this.timeToKillSamples.reduce((sum, ttk) => sum + ttk, 0) / this.timeToKillSamples.length
      : targets.averageTimeToKill || 0;

    const maxHealth = player?.maxHealth || 1;
    const maxArmor = player?.maxArmor || 0;
    const healthRatio = clamp((player.health + player.armor) / (maxHealth + maxArmor || 1), 0, 1);

    if (!this.initialAmmo && player) {
      this.initialAmmo = player.magazineSize + player.reserveAmmo;
    }
    const ammoRemaining = player ? player.ammoInMagazine + player.reserveAmmo : 0;
    const ammoSpentRatio = this.initialAmmo
      ? clamp((this.initialAmmo - ammoRemaining) / this.initialAmmo, 0, 1)
      : targets.ammoSpentRatio || 0;

    return { averageTimeToKill, healthRatio, ammoSpentRatio };
  }

  resolveBand(score) {
    const { bands = [] } = this.config;
    return (
      bands.find((band) => {
        const aboveMin = band.minScore === undefined || score >= band.minScore;
        const belowMax = band.maxScore === undefined || score < band.maxScore;
        return aboveMin && belowMax;
      }) || { name: 'baseline', allowedArchetypes: [] }
    );
  }

  update(player, waveContext = {}) {
    const metrics = this.calculateMetrics(player);
    const { targets = {}, scaling = {}, minModifier = 0.85, maxModifier = 1.25, smoothing = 0.15 } = this.config;

    const ttkTarget = targets.averageTimeToKill || metrics.averageTimeToKill || 1;
    const ttkScore = ((ttkTarget - metrics.averageTimeToKill) / ttkTarget) * (scaling.timeToKill || 0);

    const healthTarget = targets.healthRatio || 0.5;
    const healthScore = ((metrics.healthRatio - healthTarget) / Math.max(healthTarget, 0.01)) * (scaling.health || 0);

    const ammoTarget = targets.ammoSpentRatio || 0.5;
    const ammoScore = ((ammoTarget - metrics.ammoSpentRatio) / Math.max(ammoTarget, 0.01)) * (scaling.ammo || 0);

    const rawScore = ttkScore + healthScore + ammoScore;
    const unclamped = 1 + rawScore;
    const clamped = clamp(unclamped, minModifier, maxModifier);
    const nextModifier = this.currentModifier + (clamped - this.currentModifier) * smoothing;

    const band = this.resolveBand(rawScore);
    const changedBand = band.name !== this.currentBand;
    const modifierDelta = Math.abs(nextModifier - this.currentModifier);

    if (changedBand) {
      this.difficultyLogger.info('Difficulty band shifted.', {
        bandFrom: this.currentBand,
        bandTo: band.name,
        modifier: Number(nextModifier.toFixed(3)),
        healthRatio: Number(metrics.healthRatio.toFixed(3)),
        averageTimeToKill: Number(metrics.averageTimeToKill.toFixed(3)),
        ammoSpentRatio: Number(metrics.ammoSpentRatio.toFixed(3)),
        waveIndex: waveContext.waveIndex,
        enemiesAlive: waveContext.enemiesAlive
      });
    } else if (modifierDelta > 0.05) {
      this.difficultyLogger.debug('Difficulty modifier adjusted.', {
        modifier: Number(nextModifier.toFixed(3)),
        healthRatio: Number(metrics.healthRatio.toFixed(3)),
        averageTimeToKill: Number(metrics.averageTimeToKill.toFixed(3)),
        ammoSpentRatio: Number(metrics.ammoSpentRatio.toFixed(3)),
        waveIndex: waveContext.waveIndex,
        enemiesAlive: waveContext.enemiesAlive
      });
    }

    this.currentModifier = nextModifier;
    this.currentBand = band.name;
    return { modifier: this.currentModifier, band, metrics };
  }

  applyToWave(wave, allowedTypes = []) {
    const types = wave.types && wave.types.length > 0 ? wave.types : allowedTypes;
    const bandAllowed = this.config.bands?.find((band) => band.name === this.currentBand)?.allowedArchetypes || [];
    const combinedAllowed = bandAllowed.length ? bandAllowed : allowedTypes;
    const filteredTypes = types.filter((type) => combinedAllowed.length === 0 || combinedAllowed.includes(type));
    const effectiveTypes = filteredTypes.length > 0 ? filteredTypes : types;

    const adjustedCount = Math.max(1, Math.round(wave.count * this.currentModifier));
    const adjustedInterval = (wave.spawnInterval || wave.defaultSpawnInterval || 1) / this.currentModifier;

    return { ...wave, count: adjustedCount, spawnInterval: adjustedInterval, types: effectiveTypes };
  }
}
