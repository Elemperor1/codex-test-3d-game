const gameConfig = {
  movement: {
    acceleration: 80,
    deceleration: 12,
    maxSpeed: 24
  },
  player: {
    maxHealth: 140,
    maxArmor: 80,
    healthRegenRate: 6,
    armorRegenRate: 10,
    lowHealthThreshold: 0.25
  },
  combat: {
    fireRate: 6,
    projectileSpeed: 120,
    projectileLifetime: 2.5,
    damage: 1,
    magazineSize: 24,
    reserveAmmo: 180,
    reloadTime: 1.6
  },
  enemies: {
    spawnInterval: 4,
    maxSimultaneous: 10,
    defaultType: 'grunt',
    waveIntermission: 3,
    difficulty: {
      minModifier: 0.85,
      maxModifier: 1.3,
      smoothing: 0.12,
      maxTtkSamples: 24,
      targets: {
        averageTimeToKill: 3.2,
        healthRatio: 0.55,
        ammoSpentRatio: 0.4
      },
      scaling: {
        timeToKill: 0.6,
        health: 0.25,
        ammo: 0.2
      },
      bands: [
        { name: 'recovery', maxScore: -0.2, allowedArchetypes: ['grunt', 'ranger'] },
        { name: 'balanced', minScore: -0.2, maxScore: 0.35, allowedArchetypes: ['grunt', 'ranger', 'skirmisher'] },
        {
          name: 'pressure',
          minScore: 0.35,
          allowedArchetypes: ['grunt', 'ranger', 'skirmisher', 'brute', 'artillery']
        }
      ]
    },
    waves: [
      { count: 6, spawnInterval: 3.5, types: ['grunt'] },
      { count: 8, spawnInterval: 3, types: ['grunt', 'ranger'] },
      { count: 10, spawnInterval: 2.6, types: ['skirmisher', 'ranger'] },
      { count: 6, spawnInterval: 3.75, types: ['brute', 'grunt'] }
    ],
    archetypes: {
      grunt: {
        speed: 6,
        health: 6,
        aggroRange: 28,
        attackRange: 3.5,
        attackDamage: 10,
        attackCooldown: 1.25,
        patrolRadius: 10,
        strafeAmplitude: 0.8,
        attackType: 'melee'
      },
      ranger: {
        speed: 5,
        health: 4,
        aggroRange: 34,
        attackRange: 16,
        attackDamage: 6,
        attackCooldown: 1.5,
        patrolRadius: 12,
        strafeAmplitude: 1.2,
        projectileSpeed: 72,
        projectileLifetime: 3,
        attackType: 'ranged'
      },
      skirmisher: {
        speed: 8,
        health: 4,
        aggroRange: 32,
        attackRange: 4,
        attackDamage: 7,
        attackCooldown: 1,
        patrolRadius: 14,
        strafeAmplitude: 1.3,
        attackType: 'melee'
      },
      brute: {
        speed: 4,
        health: 14,
        aggroRange: 30,
        attackRange: 3.2,
        attackDamage: 18,
        attackCooldown: 1.8,
        patrolRadius: 8,
        strafeAmplitude: 0.4,
        attackType: 'melee'
      },
      artillery: {
        speed: 3,
        health: 8,
        aggroRange: 40,
        attackRange: 22,
        attackDamage: 9,
        attackCooldown: 2.4,
        patrolRadius: 10,
        strafeAmplitude: 0.2,
        projectileSpeed: 56,
        projectileLifetime: 3.6,
        attackType: 'ranged'
      }
    },
    avoidance: {
      radius: 3.5,
      strength: 12
    }
  },
  scene: {
    fogNear: 20,
    fogFar: 140,
    floorSize: 120
  },
  logging: {
    overlay: { maxEntries: 6 },
    networkEndpoint: '',
    networkFetchOptions: {
      // Add headers like authentication tokens here if needed. Avoid PII/secrets.
    }
  }
};

export default gameConfig;
