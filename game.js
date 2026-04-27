const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startOverlay = document.getElementById('startOverlay');
const levelUpOverlay = document.getElementById('levelUpOverlay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const gameOverSummary = document.getElementById('gameOverSummary');
const upgradeOptions = document.getElementById('upgradeOptions');
const startButton = document.getElementById('startButton');
const restartButton = document.getElementById('restartButton');

const healthValue = document.getElementById('healthValue');
const levelValue = document.getElementById('levelValue');
const xpValue = document.getElementById('xpValue');
const timeValue = document.getElementById('timeValue');

const weaponMortar = document.getElementById('weaponMortar');
const weaponBlade = document.getElementById('weaponBlade');
const weaponOrbit = document.getElementById('weaponOrbit');
const passiveShell = document.getElementById('passiveShell');
const passiveStride = document.getElementById('passiveStride');
const passiveReload = document.getElementById('passiveReload');
const passiveMagnet = document.getElementById('passiveMagnet');

const WORLD = {
  width: canvas.width,
  height: canvas.height
};

const keys = new Set();

const state = {
  running: false,
  paused: true,
  gameOver: false,
  choosingUpgrade: false,
  lastTime: 0,
  elapsed: 0,
  spawnTimer: 0,
  enemyId: 0,
  projectiles: [],
  enemies: [],
  xpGems: [],
  explosions: [],
  floatingTexts: [],
  upgradesOffered: [],
  player: null
};

const baseStats = {
  maxHealth: 100,
  speed: 190,
  pickupRadius: 70,
  armor: 0,
  cooldownFactor: 1
};

function createPlayer() {
  return {
    x: WORLD.width / 2,
    y: WORLD.height / 2,
    radius: 20,
    health: baseStats.maxHealth,
    maxHealth: baseStats.maxHealth,
    speed: baseStats.speed,
    level: 1,
    xp: 0,
    xpToNext: 5,
    facing: { x: 1, y: 0 },
    pickupRadius: baseStats.pickupRadius,
    weapons: {
      mortar: { level: 1, cooldown: 1.35, timer: 0 },
      blade: { level: 1, cooldown: 0.95, timer: 0 },
      orbit: { level: 1, angle: 0 }
    },
    passives: {
      shell: 0,
      stride: 0,
      reload: 0,
      magnet: 0
    },
    hitFlash: 0,
    contactTimer: 1.25
  };
}

const ENEMY_TYPES = {
  shrimp: {
    name: '蝦子',
    color: '#ff8fab',
    radius: 12,
    speed: 105,
    health: 18,
    damage: 8,
    xp: 1
  },
  crab: {
    name: '螃蟹',
    color: '#ffb703',
    radius: 18,
    speed: 72,
    health: 40,
    damage: 12,
    xp: 2
  },
  lobster: {
    name: '龍蝦',
    color: '#fb5607',
    radius: 26,
    speed: 52,
    health: 90,
    damage: 18,
    xp: 4
  }
};

const UPGRADE_POOL = [
  {
    id: 'mortar',
    label: '浣熊迫擊砲',
    description: '增加爆炸傷害與範圍，縮短冷卻。',
    canTake: (player) => player.weapons.mortar.level < 5,
    apply: (player) => player.weapons.mortar.level += 1
  },
  {
    id: 'blade',
    label: '兔子迴旋刃',
    description: '增加投射傷害、飛行距離與穿透。',
    canTake: (player) => player.weapons.blade.level < 5,
    apply: (player) => player.weapons.blade.level += 1
  },
  {
    id: 'orbit',
    label: '星星防護罩',
    description: '增加星星數量、轉速與環繞半徑。',
    canTake: (player) => player.weapons.orbit.level < 5,
    apply: (player) => player.weapons.orbit.level += 1
  },
  {
    id: 'shell',
    label: '厚殼',
    description: '最大生命 +20，立即回復 20 生命。',
    canTake: (player) => player.passives.shell < 5,
    apply: (player) => {
      player.passives.shell += 1;
      player.maxHealth += 20;
      player.health = Math.min(player.maxHealth, player.health + 20);
    }
  },
  {
    id: 'stride',
    label: '潮汐步伐',
    description: '移動速度提高 12%。',
    canTake: (player) => player.passives.stride < 5,
    apply: (player) => {
      player.passives.stride += 1;
      player.speed = baseStats.speed * (1 + player.passives.stride * 0.12);
    }
  },
  {
    id: 'reload',
    label: '海流裝填',
    description: '全武器冷卻縮短 10%。',
    canTake: (player) => player.passives.reload < 5,
    apply: (player) => {
      player.passives.reload += 1;
      player.cooldownFactor = 1 - player.passives.reload * 0.1;
    }
  },
  {
    id: 'magnet',
    label: '幸運貝殼',
    description: '經驗吸取半徑增加 24。',
    canTake: (player) => player.passives.magnet < 5,
    apply: (player) => {
      player.passives.magnet += 1;
      player.pickupRadius = baseStats.pickupRadius + player.passives.magnet * 24;
    }
  }
];

function resetGame() {
  state.running = false;
  state.paused = true;
  state.gameOver = false;
  state.choosingUpgrade = false;
  state.lastTime = 0;
  state.elapsed = 0;
  state.spawnTimer = 0;
  state.enemyId = 0;
  state.projectiles = [];
  state.enemies = [];
  state.xpGems = [];
  state.explosions = [];
  state.floatingTexts = [];
  state.upgradesOffered = [];
  state.player = createPlayer();
  updateHud();
  startOverlay.classList.remove('hidden');
  levelUpOverlay.classList.add('hidden');
  gameOverOverlay.classList.add('hidden');
}

function startGame() {
  state.running = true;
  state.paused = false;
  state.gameOver = false;
  state.lastTime = performance.now();
  startOverlay.classList.add('hidden');
  levelUpOverlay.classList.add('hidden');
  gameOverOverlay.classList.add('hidden');
}

function restartGame() {
  resetGame();
  startGame();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getClosestEnemy(from) {
  let closest = null;
  let closestDist = Infinity;
  for (const enemy of state.enemies) {
    const d = distance(from, enemy);
    if (d < closestDist) {
      closestDist = d;
      closest = enemy;
    }
  }
  return closest;
}

function getEnemyClusterTarget() {
  if (state.enemies.length === 0) return null;
  let bestEnemy = state.enemies[0];
  let bestScore = -1;

  for (const enemy of state.enemies) {
    let score = 0;
    for (const other of state.enemies) {
      if (distance(enemy, other) < 90) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestEnemy = enemy;
    }
  }

  return { x: bestEnemy.x, y: bestEnemy.y };
}

function spawnEnemy() {
  const elapsed = state.elapsed;
  const roll = Math.random();
  let typeKey = 'shrimp';

  if (elapsed > 90) {
    typeKey = roll < 0.35 ? 'lobster' : roll < 0.75 ? 'crab' : 'shrimp';
  } else if (elapsed > 35) {
    typeKey = roll < 0.18 ? 'lobster' : roll < 0.58 ? 'crab' : 'shrimp';
  } else if (elapsed > 15) {
    typeKey = roll < 0.3 ? 'crab' : 'shrimp';
  }

  const type = ENEMY_TYPES[typeKey];
  const side = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;
  const margin = 50;

  if (side === 0) {
    x = Math.random() * WORLD.width;
    y = -margin;
  } else if (side === 1) {
    x = WORLD.width + margin;
    y = Math.random() * WORLD.height;
  } else if (side === 2) {
    x = Math.random() * WORLD.width;
    y = WORLD.height + margin;
  } else {
    x = -margin;
    y = Math.random() * WORLD.height;
  }

  state.enemies.push({
    id: ++state.enemyId,
    type: typeKey,
    x,
    y,
    radius: type.radius,
    speed: type.speed + Math.min(25, state.elapsed * 0.08),
    health: type.health + Math.floor(state.elapsed * 0.35),
    maxHealth: type.health + Math.floor(state.elapsed * 0.35),
    damage: type.damage + Math.floor(state.elapsed / 45),
    xp: type.xp,
    color: type.color,
    hitFlash: 0,
    contactCooldown: 0
  });
}

function spawnExplosion(x, y, radius, damage) {
  state.explosions.push({ x, y, radius, damage, age: 0, life: 0.3, hitIds: new Set() });
}

function fireMortar() {
  const player = state.player;
  const weapon = player.weapons.mortar;
  const target = getEnemyClusterTarget();
  if (!target) return false;

  const level = weapon.level;
  const volley = level >= 4 ? 2 : 1;

  for (let i = 0; i < volley; i += 1) {
    const spread = volley > 1 ? (i === 0 ? -22 : 22) : 0;
    state.projectiles.push({
      kind: 'mortar',
      x: player.x,
      y: player.y,
      tx: target.x + spread,
      ty: target.y + spread * 0.5,
      speed: 300,
      radius: 7,
      damage: 22 + level * 10,
      blastRadius: 48 + level * 8,
      color: '#8ecae6'
    });
  }

  return true;
}

function fireBlade() {
  const player = state.player;
  const weapon = player.weapons.blade;
  const target = getClosestEnemy(player);
  if (!target) return false;

  const level = weapon.level;
  const count = level >= 5 ? 2 : 1;
  const baseAngle = Math.atan2(target.y - player.y, target.x - player.x);

  for (let i = 0; i < count; i += 1) {
    const offset = count > 1 ? (i === 0 ? -0.16 : 0.16) : 0;
    const angle = baseAngle + offset;
    state.projectiles.push({
      kind: 'blade',
      x: player.x,
      y: player.y,
      vx: Math.cos(angle) * (360 + level * 24),
      vy: Math.sin(angle) * (360 + level * 24),
      radius: 8,
      damage: 18 + level * 12,
      life: 0,
      maxLife: 0.6 + level * 0.08,
      returning: false,
      pierce: 1 + Math.floor(level / 2),
      hitIds: new Set(),
      color: '#ffd166'
    });
  }

  return true;
}

function updateWeapons(dt) {
  const player = state.player;

  const mortar = player.weapons.mortar;
  mortar.timer -= dt;
  if (mortar.timer <= 0) {
    const fired = fireMortar();
    mortar.timer = fired
      ? Math.max(0.35, mortar.cooldown - mortar.level * 0.08) * player.cooldownFactor
      : 0.12;
  }

  const blade = player.weapons.blade;
  blade.timer -= dt;
  if (blade.timer <= 0) {
    const fired = fireBlade();
    blade.timer = fired
      ? Math.max(0.25, blade.cooldown - blade.level * 0.05) * player.cooldownFactor
      : 0.12;
  }

  player.weapons.orbit.angle += dt * (1.4 + player.weapons.orbit.level * 0.5);
}

function damageEnemy(enemy, amount) {
  enemy.health -= amount;
  enemy.hitFlash = 0.12;
  state.floatingTexts.push({ x: enemy.x, y: enemy.y - enemy.radius, text: `${Math.round(amount)}`, age: 0, life: 0.45 });
  if (enemy.health <= 0) {
    killEnemy(enemy);
    return true;
  }
  return false;
}

function killEnemy(enemy) {
  state.enemies = state.enemies.filter((e) => e.id !== enemy.id);
  state.xpGems.push({ x: enemy.x, y: enemy.y, radius: 6 + enemy.xp, value: enemy.xp, color: '#7bdff2' });
}

function updateProjectiles(dt) {
  const player = state.player;
  const remaining = [];

  for (const projectile of state.projectiles) {
    if (projectile.kind === 'mortar') {
      const dx = projectile.tx - projectile.x;
      const dy = projectile.ty - projectile.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= projectile.speed * dt) {
        spawnExplosion(projectile.tx, projectile.ty, projectile.blastRadius, projectile.damage);
        continue;
      }
      projectile.x += (dx / dist) * projectile.speed * dt;
      projectile.y += (dy / dist) * projectile.speed * dt;
      remaining.push(projectile);
      continue;
    }

    if (projectile.kind === 'blade') {
      projectile.life += dt;
      if (!projectile.returning && projectile.life >= projectile.maxLife * 0.5) {
        projectile.returning = true;
      }

      if (projectile.returning) {
        const dx = player.x - projectile.x;
        const dy = player.y - projectile.y;
        const dist = Math.hypot(dx, dy) || 1;
        const speed = Math.hypot(projectile.vx, projectile.vy);
        projectile.vx = (dx / dist) * speed;
        projectile.vy = (dy / dist) * speed;
      }

      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;

      for (const enemy of state.enemies) {
        if (projectile.hitIds.has(enemy.id)) continue;
        if (distance(projectile, enemy) <= projectile.radius + enemy.radius) {
          projectile.hitIds.add(enemy.id);
          damageEnemy(enemy, projectile.damage);
          projectile.pierce -= 1;
          if (projectile.pierce < 0) break;
        }
      }

      if (projectile.life >= projectile.maxLife || projectile.pierce < 0) {
        continue;
      }

      remaining.push(projectile);
    }
  }

  state.projectiles = remaining;
}

function updateExplosions(dt) {
  const remaining = [];

  for (const explosion of state.explosions) {
    explosion.age += dt;
    for (const enemy of state.enemies) {
      if (explosion.hitIds.has(enemy.id)) continue;
      if (distance(explosion, enemy) <= explosion.radius + enemy.radius) {
        explosion.hitIds.add(enemy.id);
        damageEnemy(enemy, explosion.damage);
      }
    }

    if (explosion.age < explosion.life) {
      remaining.push(explosion);
    }
  }

  state.explosions = remaining;
}

function updateOrbitDamage(dt) {
  const player = state.player;
  const orbitLevel = player.weapons.orbit.level;
  const starCount = 1 + Math.floor(orbitLevel / 2);
  const radius = 42 + orbitLevel * 10;
  const damage = 8 + orbitLevel * 6;
  const stars = [];

  for (let i = 0; i < starCount; i += 1) {
    const angle = player.weapons.orbit.angle + (Math.PI * 2 * i) / starCount;
    stars.push({
      x: player.x + Math.cos(angle) * radius,
      y: player.y + Math.sin(angle) * radius,
      radius: 10
    });
  }

  for (const enemy of state.enemies) {
    enemy.contactCooldown = Math.max(0, enemy.contactCooldown - dt);
    for (const star of stars) {
      if (distance(enemy, star) <= enemy.radius + star.radius && enemy.contactCooldown <= 0) {
        enemy.contactCooldown = 0.18;
        damageEnemy(enemy, damage);
      }
    }
  }

  state.orbitStars = stars;
}

function gainXp(value) {
  const player = state.player;
  player.xp += value;

  while (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    player.level += 1;
    player.xpToNext = Math.ceil(player.xpToNext * 1.45 + 2);
    offerUpgrade();
  }

  updateHud();
}

function updateXpGems(dt) {
  const player = state.player;
  const remaining = [];

  for (const gem of state.xpGems) {
    const d = distance(gem, player);
    if (d <= player.pickupRadius) {
      const dx = player.x - gem.x;
      const dy = player.y - gem.y;
      const len = Math.hypot(dx, dy) || 1;
      gem.x += (dx / len) * dt * 280;
      gem.y += (dy / len) * dt * 280;
    }

    if (distance(gem, player) <= player.radius + gem.radius) {
      gainXp(gem.value);
      continue;
    }

    remaining.push(gem);
  }

  state.xpGems = remaining;
}

function offerUpgrade() {
  state.paused = true;
  state.choosingUpgrade = true;
  const available = UPGRADE_POOL.filter((upgrade) => upgrade.canTake(state.player));
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  state.upgradesOffered = shuffled.slice(0, 3);
  renderUpgradeOptions();
  levelUpOverlay.classList.remove('hidden');
}

function renderUpgradeOptions() {
  upgradeOptions.innerHTML = '';
  state.upgradesOffered.forEach((upgrade) => {
    const button = document.createElement('button');
    button.className = 'upgrade-button';
    button.innerHTML = `<strong>${upgrade.label}</strong><span>${upgrade.description}</span>`;
    button.addEventListener('click', () => selectUpgrade(upgrade));
    upgradeOptions.appendChild(button);
  });
}

function selectUpgrade(upgrade) {
  upgrade.apply(state.player);
  state.choosingUpgrade = false;
  state.paused = false;
  levelUpOverlay.classList.add('hidden');
  updateHud();
}

function takeDamage(amount) {
  const player = state.player;
  player.health = Math.max(0, player.health - amount);
  player.hitFlash = 0.18;
  updateHud();
  if (player.health <= 0) {
    endGame();
  }
}

function updateEnemies(dt) {
  const player = state.player;

  for (const enemy of state.enemies) {
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    enemy.x += (dx / dist) * enemy.speed * dt;
    enemy.y += (dy / dist) * enemy.speed * dt;

    if (distance(enemy, player) <= enemy.radius + player.radius) {
      if (player.contactTimer <= 0) {
        takeDamage(enemy.damage);
        player.contactTimer = 0.5;
      }
    }
  }
}

function updatePlayer(dt) {
  const player = state.player;
  player.hitFlash = Math.max(0, player.hitFlash - dt);
  player.contactTimer = Math.max(0, player.contactTimer - dt);

  let moveX = 0;
  let moveY = 0;

  if (keys.has('arrowup') || keys.has('w')) moveY -= 1;
  if (keys.has('arrowdown') || keys.has('s')) moveY += 1;
  if (keys.has('arrowleft') || keys.has('a')) moveX -= 1;
  if (keys.has('arrowright') || keys.has('d')) moveX += 1;

  if (moveX !== 0 || moveY !== 0) {
    const length = Math.hypot(moveX, moveY);
    moveX /= length;
    moveY /= length;
    player.facing.x = moveX;
    player.facing.y = moveY;
  }

  player.x = clamp(player.x + moveX * player.speed * dt, player.radius, WORLD.width - player.radius);
  player.y = clamp(player.y + moveY * player.speed * dt, player.radius, WORLD.height - player.radius);
}

function updateFloatingTexts(dt) {
  const remaining = [];
  for (const text of state.floatingTexts) {
    text.age += dt;
    text.y -= dt * 30;
    if (text.age < text.life) remaining.push(text);
  }
  state.floatingTexts = remaining;
}

function updateSpawn(dt) {
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnEnemy();
    const rate = Math.max(0.18, 0.8 - state.elapsed * 0.0045);
    state.spawnTimer = rate;
  }
}

function updateHud() {
  const player = state.player;
  healthValue.textContent = `${Math.ceil(player.health)} / ${player.maxHealth}`;
  levelValue.textContent = `${player.level}`;
  xpValue.textContent = `${player.xp} / ${player.xpToNext}`;
  timeValue.textContent = formatTime(state.elapsed);

  weaponMortar.textContent = `Lv.${player.weapons.mortar.level}`;
  weaponBlade.textContent = `Lv.${player.weapons.blade.level}`;
  weaponOrbit.textContent = `Lv.${player.weapons.orbit.level}`;
  passiveShell.textContent = `Lv.${player.passives.shell}`;
  passiveStride.textContent = `Lv.${player.passives.stride}`;
  passiveReload.textContent = `Lv.${player.passives.reload}`;
  passiveMagnet.textContent = `Lv.${player.passives.magnet}`;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function endGame() {
  state.running = false;
  state.paused = true;
  state.gameOver = true;
  gameOverSummary.textContent = `你撐過了 ${Math.floor(state.elapsed)} 秒，等級 ${state.player.level}。`;
  gameOverOverlay.classList.remove('hidden');
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  gradient.addColorStop(0, '#023047');
  gradient.addColorStop(1, '#126782');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  ctx.globalAlpha = 0.14;
  for (let i = 0; i < 24; i += 1) {
    ctx.fillStyle = '#8ecae6';
    ctx.beginPath();
    ctx.arc((i * 137) % WORLD.width, ((i * 97) + state.elapsed * 12) % WORLD.height, 2 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPlayer() {
  const player = state.player;
  ctx.save();
  ctx.translate(player.x, player.y);

  ctx.fillStyle = player.hitFlash > 0 ? '#ffffff' : '#52b788';
  ctx.beginPath();
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#2d6a4f';
  ctx.beginPath();
  ctx.ellipse(0, 0, player.radius - 4, player.radius - 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#95d5b2';
  ctx.beginPath();
  ctx.arc(player.facing.x * 12, player.facing.y * 12, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  ctx.strokeStyle = 'rgba(123,223,242,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.pickupRadius, 0, Math.PI * 2);
  ctx.stroke();
}

function drawEnemies() {
  for (const enemy of state.enemies) {
    ctx.fillStyle = enemy.hitFlash > 0 ? '#ffffff' : enemy.color;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 10, enemy.radius * 2, 4);
    ctx.fillStyle = '#90e0ef';
    ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 10, (enemy.health / enemy.maxHealth) * enemy.radius * 2, 4);
  }
}

function drawProjectiles() {
  for (const projectile of state.projectiles) {
    ctx.fillStyle = projectile.color;
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawExplosions() {
  for (const explosion of state.explosions) {
    const alpha = 1 - explosion.age / explosion.life;
    ctx.fillStyle = `rgba(255, 209, 102, ${alpha * 0.45})`;
    ctx.beginPath();
    ctx.arc(explosion.x, explosion.y, explosion.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawXpGems() {
  for (const gem of state.xpGems) {
    ctx.fillStyle = gem.color;
    ctx.beginPath();
    ctx.arc(gem.x, gem.y, gem.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawOrbitStars() {
  const stars = state.orbitStars || [];
  for (const star of stars) {
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFloatingTexts() {
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  for (const text of state.floatingTexts) {
    ctx.globalAlpha = 1 - text.age / text.life;
    ctx.fillText(text.text, text.x, text.y);
  }
  ctx.globalAlpha = 1;
}

function render() {
  drawBackground();
  drawXpGems();
  drawExplosions();
  drawOrbitStars();
  drawProjectiles();
  drawEnemies();
  drawPlayer();
  drawFloatingTexts();
}

function update(dt) {
  if (!state.running || state.paused) return;

  state.elapsed += dt;
  updatePlayer(dt);
  updateSpawn(dt);
  updateWeapons(dt);
  updateProjectiles(dt);
  updateExplosions(dt);
  updateOrbitDamage(dt);
  updateEnemies(dt);
  updateXpGems(dt);
  updateFloatingTexts(dt);
  updateHud();
}

function gameLoop(timestamp) {
  const dt = Math.min(0.033, (timestamp - state.lastTime) / 1000 || 0);
  state.lastTime = timestamp;
  update(dt);
  render();
  requestAnimationFrame(gameLoop);
}

window.addEventListener('keydown', (event) => {
  keys.add(event.key.toLowerCase());
});

window.addEventListener('keyup', (event) => {
  keys.delete(event.key.toLowerCase());
});

startButton.addEventListener('click', () => {
  if (!state.running) startGame();
});

restartButton.addEventListener('click', restartGame);

resetGame();
requestAnimationFrame(gameLoop);
