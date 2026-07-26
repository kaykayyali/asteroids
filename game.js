/*
 * ASTEROIDS
 * A standalone Canvas arcade game. Visuals and sound are generated in-browser.
 */
(() => {
  'use strict';

  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const overlay = document.querySelector('#overlay');
  const actionButton = document.querySelector('#action');
  const title = document.querySelector('#title');
  const message = document.querySelector('#message');
  const TAU = Math.PI * 2;
  const keys = new Set();
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // State lives in one closure so a restart can replace entities without adding listeners.
  let pixelRatio = 1;
  let audioContext;
  let lastFrameTime = 0;
  let active = false;
  let paused = false;
  let muted = false;
  let score = 0;
  let highScore = readHighScore();
  let level = 0;
  let lives = 3;
  let ship = null;
  let asteroids = [];
  let bullets = [];
  let enemyBullets = [];
  let particles = [];
  let ufo = null;
  let ufoClock = 0;
  let respawnTimer = 0;
  let waveBannerTimer = 0;
  let shake = 0;
  let stars = [];
  let combo = 1;
  let comboTimer = 0;
  let thrustSoundCooldown = 0;
  let clearBonus = 0;
  let clearBonusTimer = 0;

  const width = () => canvas.width / pixelRatio;
  const height = () => canvas.height / pixelRatio;

  // Persisting a high score is optional; storage failures must never block first paint.
  function readHighScore() {
    try {
      return Number(localStorage.asteroidsHigh || 0);
    } catch {
      return 0;
    }
  }

  function saveHighScore(value) {
    try {
      localStorage.asteroidsHigh = value;
    } catch {
      // A storage-restricted browser can still play a complete session.
    }
  }

  function random(minimum, maximum) {
    return minimum + Math.random() * (maximum - minimum);
  }

  function wrap(entity) {
    entity.x = (entity.x + width()) % width();
    entity.y = (entity.y + height()) % height();
  }

  function toroidalDistance(first, second) {
    const xDistance = Math.abs(first.x - second.x);
    const yDistance = Math.abs(first.y - second.y);
    const shortestX = Math.min(xDistance, width() - xDistance);
    const shortestY = Math.min(yDistance, height() - yDistance);
    return Math.hypot(shortestX, shortestY);
  }

  function toroidalVector(from, to) {
    let x = to.x - from.x;
    let y = to.y - from.y;

    if (Math.abs(x) > width() / 2) {
      x -= Math.sign(x) * width();
    }

    if (Math.abs(y) > height() / 2) {
      y -= Math.sign(y) * height();
    }

    return { x, y };
  }

  // Resizing updates the backing store and wraps paused entities immediately, not next tick.
  function resize() {
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(window.innerWidth * pixelRatio));
    canvas.height = Math.max(1, Math.floor(window.innerHeight * pixelRatio));
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const entities = [
      ship,
      ufo,
      ...asteroids,
      ...bullets,
      ...enemyBullets,
      ...particles,
    ];
    entities.filter(Boolean).forEach(wrap);
    buildStars();
  }

  function buildStars() {
    const density = reduceMotion ? 18000 : 11000;
    const count = Math.max(35, Math.floor((width() * height()) / density));

    stars = Array.from({ length: count }, () => ({
      x: Math.random() * width(),
      y: Math.random() * height(),
      alpha: 0.15 + Math.random() * 0.5,
      size: Math.random() * 1.4,
    }));
  }

  // Audio --------------------------------------------------------------------
  // Oscillator envelopes avoid asset files and fade to near-silence to prevent clicks.
  function playTone(
    frequency,
    duration = 0.08,
    type = 'square',
    gain = 0.04,
    frequencySlide = 0,
  ) {
    if (!audioContext || muted) {
      return;
    }

    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const amplifier = audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, frequency + frequencySlide),
      now + duration,
    );
    amplifier.gain.setValueAtTime(gain, now);
    amplifier.gain.exponentialRampToValueAtTime(0.001, now + duration);

    oscillator.connect(amplifier).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  function playSound(name) {
    const sounds = {
      fire: () => playTone(520, 0.055, 'square', 0.035, -280),
      boom: () => playTone(100, 0.2, 'sawtooth', 0.07, -65),
      thrust: () => playTone(60, 0.04, 'triangle', 0.018, 20),
      ufo: () => playTone(290, 0.11, 'sine', 0.03, 80),
      hyper: () => playTone(900, 0.16, 'sine', 0.05, -760),
      life: () => playTone(760, 0.22, 'triangle', 0.05, 250),
    };

    sounds[name]?.();
  }

  // Lifecycle ----------------------------------------------------------------
  // A respawn samples safe positions because a center spawn can overlap wrapped debris.
  function clearSpawnPosition() {
    let x = width() / 2;
    let y = height() / 2;
    const padding = Math.min(80, width() / 3, height() / 3);

    for (let attempt = 0; attempt < 28; attempt += 1) {
      const candidate = { x, y };
      const unsafe = asteroids.some(
        asteroid => toroidalDistance(candidate, asteroid) < asteroid.radius + 110,
      );

      if (!unsafe) {
        return candidate;
      }

      x = random(padding, width() - padding);
      y = random(padding, height() - padding);
    }

    return { x, y };
  }

  function makeShip() {
    const position = clearSpawnPosition();

    return {
      ...position,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      radius: 13,
      fireCooldown: 0,
      invulnerableFor: 2.6,
      hyperCooldown: 0,
      thrusting: false,
    };
  }

  function makeAsteroid(size, x = random(0, width()), y = random(0, height()), parent) {
    const radius = [12, 23, 40][size];
    const pointCount = 8 + Math.floor(Math.random() * 5);
    const shape = Array.from(
      { length: pointCount },
      () => radius * random(0.7, 1.15),
    );
    const direction = Math.random() * TAU;
    const speed = random(18, 55) + level * 3;

    return {
      x,
      y,
      vx: (parent?.vx || 0) * 0.35 + Math.cos(direction) * speed,
      vy: (parent?.vy || 0) * 0.35 + Math.sin(direction) * speed,
      angle: 0,
      spin: random(-1.2, 1.2),
      size,
      radius,
      shape,
    };
  }

  function burst(x, y, count, color = '#baffdf') {
    const particleCount = reduceMotion ? Math.ceil(count * 0.35) : count;

    for (let index = 0; index < particleCount; index += 1) {
      const angle = Math.random() * TAU;
      const speed = random(20, 160);
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: random(0.25, 0.75),
        color,
      });
    }
  }

  function addScore(points) {
    score += points;

    if (score > highScore) {
      highScore = score;
      saveHighScore(highScore);
    }

    if (score > 0 && score % 10000 < points) {
      lives += 1;
      playSound('life');
    }
  }

  function newWave() {
    level += 1;
    waveBannerTimer = 1.65;
    const asteroidCount = Math.min(3 + level, 10);

    for (let index = 0; index < asteroidCount; index += 1) {
      let x;
      let y;
      let attempts = 0;

      do {
        x = random(0, width());
        y = random(0, height());
        attempts += 1;
      } while (
        ship &&
        toroidalDistance({ x, y }, ship) < 140 &&
        attempts < 30
      );

      asteroids.push(makeAsteroid(2, x, y));
    }

    ufoClock = random(8, 15) / Math.min(1 + level * 0.04, 1.7);
    playSound('life');
  }

  // Reset replaces all per-run collections while the single animation loop keeps running.
  function resetGame() {
    score = 0;
    level = 0;
    lives = 3;
    asteroids = [];
    bullets = [];
    enemyBullets = [];
    particles = [];
    ufo = null;
    shake = 0;
    combo = 1;
    comboTimer = 0;
    thrustSoundCooldown = 0;
    clearBonus = 0;
    clearBonusTimer = 0;
    ship = makeShip();
    respawnTimer = 0;
    newWave();
  }

  function startGame() {
    if (!audioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioContext();
    }

    audioContext.resume();
    resetGame();
    active = true;
    paused = false;
    overlay.classList.add('hidden');
  }

  function endGame() {
    active = false;
    highScore = Math.max(highScore, score);
    saveHighScore(highScore);
    title.textContent = 'GAME OVER';
    message.textContent = [
      `Final score: ${formatScore(score)}`,
      `High score: ${formatScore(highScore)}`,
    ].join('  •  ');
    actionButton.textContent = 'PLAY AGAIN';
    overlay.classList.remove('hidden');
  }

  function formatScore(value) {
    return value.toString().padStart(6, '0');
  }

  function shoot(enemy = false) {
    const source = enemy ? ufo : ship;

    if (!source || (enemy && !ship)) {
      return;
    }

    const target = enemy ? toroidalVector(ufo, ship) : null;
    const leadTime = enemy && ufo.radius < 15 ? 0.5 : 0;
    const angle = enemy
      ? Math.atan2(
        target.y + ship.vy * leadTime,
        target.x + ship.vx * leadTime,
      ) + random(-0.25, 0.25)
      : ship.angle;
    const speed = enemy ? 210 : 460;
    const list = enemy ? enemyBullets : bullets;

    list.push({
      x: source.x + Math.cos(angle) * (source.radius || 14),
      y: source.y + Math.sin(angle) * (source.radius || 14),
      vx: (source.vx || 0) + Math.cos(angle) * speed,
      vy: (source.vy || 0) + Math.sin(angle) * speed,
      life: enemy ? 2.2 : 1.05,
      radius: enemy ? 3 : 2,
      enemy,
    });
    playSound(enemy ? 'ufo' : 'fire');
  }

  function hyperspace() {
    if (!ship || ship.hyperCooldown > 0) {
      return;
    }

    const position = clearSpawnPosition();
    ship.x = position.x;
    ship.y = position.y;
    ship.vx = 0;
    ship.vy = 0;
    ship.invulnerableFor = 0.8;
    ship.hyperCooldown = 1.2;
    burst(ship.x, ship.y, 18, '#67ddff');
    playSound('hyper');
  }

  function loseShip() {
    if (!ship || ship.invulnerableFor > 0) {
      return;
    }

    burst(ship.x, ship.y, 30);
    playSound('boom');
    lives -= 1;
    ship = null;
    respawnTimer = 1.6;

    if (lives < 0) {
      endGame();
    }
  }

  function addThrustParticle() {
    if (reduceMotion || Math.random() >= 0.35) {
      return;
    }

    const angle = ship.angle + Math.PI + random(-0.35, 0.35);
    particles.push({
      x: ship.x - Math.cos(ship.angle) * 10,
      y: ship.y - Math.sin(ship.angle) * 10,
      vx: ship.vx * 0.25 + Math.cos(angle) * random(45, 95),
      vy: ship.vy * 0.25 + Math.sin(angle) * random(45, 95),
      life: 0.22,
      color: '#ffcc80',
    });
  }

  // Physics and collisions ----------------------------------------------------
  // Motion is delta-time based so speed is stable across monitors and brief frame stalls.
  function updateShip(deltaTime) {
    if (!ship) {
      respawnTimer -= deltaTime;

      if (respawnTimer <= 0 && lives >= 0) {
        ship = makeShip();
      }

      return;
    }

    ship.fireCooldown -= deltaTime;
    thrustSoundCooldown -= deltaTime;
    ship.invulnerableFor -= deltaTime;
    ship.hyperCooldown = Math.max(0, ship.hyperCooldown - deltaTime);
    ship.thrusting = false;

    if (keys.has('ArrowLeft') || keys.has('KeyA')) {
      ship.angle -= 4.5 * deltaTime;
    }

    if (keys.has('ArrowRight') || keys.has('KeyD')) {
      ship.angle += 4.5 * deltaTime;
    }

    if (keys.has('ArrowUp') || keys.has('KeyW')) {
      ship.vx += Math.cos(ship.angle) * 235 * deltaTime;
      ship.vy += Math.sin(ship.angle) * 235 * deltaTime;
      ship.thrusting = true;
      addThrustParticle();

      if (thrustSoundCooldown <= 0) {
        playSound('thrust');
        thrustSoundCooldown = 0.09;
      }
    }

    if ((keys.has('Space') || keys.has('KeyX')) && ship.fireCooldown <= 0) {
      shoot();
      ship.fireCooldown = 0.19;
    }

    if (keys.has('KeyH')) {
      keys.delete('KeyH');
      hyperspace();
    }

    const speed = Math.hypot(ship.vx, ship.vy);

    if (speed > 310) {
      ship.vx *= 310 / speed;
      ship.vy *= 310 / speed;
    }

    // Convert the original per-60fps drag into a frame-rate-independent decay.
    ship.vx *= Math.pow(0.985, deltaTime * 60);
    ship.vy *= Math.pow(0.985, deltaTime * 60);
    ship.x += ship.vx * deltaTime;
    ship.y += ship.vy * deltaTime;
    wrap(ship);
  }

  function updateAsteroids(deltaTime) {
    asteroids.forEach(asteroid => {
      asteroid.x += asteroid.vx * deltaTime;
      asteroid.y += asteroid.vy * deltaTime;
      asteroid.angle += asteroid.spin * deltaTime;
      wrap(asteroid);
    });
  }

  function updateProjectiles(deltaTime) {
    [bullets, enemyBullets].forEach(list => {
      list.forEach(bullet => {
        bullet.x += bullet.vx * deltaTime;
        bullet.y += bullet.vy * deltaTime;
        bullet.life -= deltaTime;
        wrap(bullet);
      });
    });

    bullets = bullets.filter(bullet => bullet.life > 0);
    enemyBullets = enemyBullets.filter(bullet => bullet.life > 0);
  }

  function updateParticles(deltaTime) {
    particles.forEach(particle => {
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;
      particle.vx *= 0.96;
      particle.vy *= 0.96;
      particle.life -= deltaTime;
    });

    particles = particles.filter(particle => particle.life > 0);
  }

  function spawnUfo() {
    const direction = Math.random() < 0.5 ? 1 : -1;
    ufo = {
      x: direction > 0 ? -30 : width() + 30,
      y: random(80, Math.max(81, height() - 120)),
      vx: direction * (78 + level * 2),
      radius: level > 4 && Math.random() < 0.4 ? 12 : 18,
      fireCooldown: 1,
    };
    playSound('ufo');
  }

  function updateUfo(deltaTime, now) {
    if (!ufo && level > 1) {
      ufoClock -= deltaTime;

      if (ufoClock <= 0) {
        spawnUfo();
      }
    }

    if (!ufo) {
      return;
    }

    ufo.x += ufo.vx * deltaTime;
    // The sine drift is integrated over time so the UFO glides rather than teleports.
    ufo.y += Math.sin(now / 350) * 25 * deltaTime;
    ufo.fireCooldown -= deltaTime;

    if (ufo.fireCooldown < 0 && ship) {
      shoot(true);
      ufo.fireCooldown = random(0.8, 1.8);
    }

    if (ufo.x < -45 || ufo.x > width() + 45) {
      ufo = null;
    }
  }

  function destroyAsteroid(asteroid) {
    asteroid.destroyed = true;
    addScore([100, 50, 20][asteroid.size] * combo);
    combo = Math.min(5, combo + 1);
    comboTimer = 1.8;
    burst(asteroid.x, asteroid.y, asteroid.size === 2 ? 20 : 12);

    if (!reduceMotion) {
      shake = Math.max(shake, asteroid.size === 2 ? 1 : 0.45);
    }

    playSound('boom');

    if (asteroid.size > 0) {
      asteroids.push(
        makeAsteroid(asteroid.size - 1, asteroid.x, asteroid.y, asteroid),
        makeAsteroid(asteroid.size - 1, asteroid.x, asteroid.y, asteroid),
      );
    }
  }

  function resolveBulletCollisions() {
    bullets.forEach(bullet => {
      asteroids.forEach(asteroid => {
        if (
          bullet.life > 0 &&
          !asteroid.destroyed &&
          toroidalDistance(bullet, asteroid) < asteroid.radius + bullet.radius
        ) {
          bullet.life = 0;
          destroyAsteroid(asteroid);
        }
      });
    });

    asteroids = asteroids.filter(asteroid => !asteroid.destroyed);

    if (!ufo) {
      return;
    }

    bullets.forEach(bullet => {
      if (
        bullet.life > 0 &&
        toroidalDistance(bullet, ufo) < bullet.radius + ufo.radius
      ) {
        bullet.life = 0;
        addScore(ufo.radius < 15 ? 1000 : 200);
        burst(ufo.x, ufo.y, 24, '#ffcc8e');
        ufo = null;
        playSound('boom');
      }
    });
  }

  // Collision checks use toroidalDistance, so hits near opposite screen edges are fair.
  function resolveShipCollisions() {
    if (!ship) {
      return;
    }

    asteroids.forEach(asteroid => {
      if (toroidalDistance(ship, asteroid) < ship.radius + asteroid.radius * 0.72) {
        loseShip();
      }
    });

    enemyBullets.forEach(bullet => {
      if (toroidalDistance(ship, bullet) < ship.radius + bullet.radius) {
        loseShip();
      }
    });

    if (ufo && toroidalDistance(ship, ufo) < ship.radius + ufo.radius) {
      loseShip();
    }
  }

  function update(deltaTime, now) {
    if (!active || paused) {
      return;
    }

    waveBannerTimer -= deltaTime;
    comboTimer -= deltaTime;
    clearBonusTimer -= deltaTime;
    if (comboTimer <= 0) {
      combo = 1;
    }
    updateShip(deltaTime);
    updateAsteroids(deltaTime);
    updateProjectiles(deltaTime);
    updateParticles(deltaTime);
    updateUfo(deltaTime, now);
    resolveBulletCollisions();
    resolveShipCollisions();

    if (asteroids.length === 0) {
      clearBonus = 250 * level;
      clearBonusTimer = 1.35;
      addScore(clearBonus);
      newWave();
    }

    shake = Math.max(0, shake - deltaTime * 3);
  }

  // Rendering ----------------------------------------------------------------
  // Vector paths are redrawn every frame so the glow remains crisp at any device scale.
  function drawPath(points, x, y, angle = 0, close = true) {
    ctx.beginPath();

    points.forEach(([pointX, pointY], index) => {
      const rotatedX = x + pointX * Math.cos(angle) - pointY * Math.sin(angle);
      const rotatedY = y + pointX * Math.sin(angle) + pointY * Math.cos(angle);

      if (index === 0) {
        ctx.moveTo(rotatedX, rotatedY);
      } else {
        ctx.lineTo(rotatedX, rotatedY);
      }
    });

    if (close) {
      ctx.closePath();
    }

    ctx.stroke();
  }

  function drawWrapped(drawEntity, entity) {
    const margin = 45;
    const xOffsets = entity.x < margin
      ? [0, width()]
      : entity.x > width() - margin
        ? [0, -width()]
        : [0];
    const yOffsets = entity.y < margin
      ? [0, height()]
      : entity.y > height() - margin
        ? [0, -height()]
        : [0];

    xOffsets.forEach(xOffset => {
      yOffsets.forEach(yOffset => {
        drawEntity(entity.x + xOffset, entity.y + yOffset);
      });
    });
  }

  function drawAsteroid(asteroid) {
    drawWrapped((x, y) => {
      const points = asteroid.shape.map((radius, index) => {
        const angle = (index * TAU) / asteroid.shape.length;
        return [Math.cos(angle) * radius, Math.sin(angle) * radius];
      });
      drawPath(points, x, y, asteroid.angle);
    }, asteroid);
  }

  function drawUfo() {
    drawWrapped((x, y) => {
      ctx.beginPath();
      ctx.ellipse(x, y + 4, ufo.radius, 6, 0, 0, TAU);
      ctx.moveTo(x - ufo.radius * 0.55, y + 1);
      ctx.quadraticCurveTo(x, y - ufo.radius, x + ufo.radius * 0.55, y + 1);
      ctx.stroke();
    }, ufo);
  }

  function drawShip() {
    if (!ship || (ship.invulnerableFor > 0 && Math.floor(ship.invulnerableFor * 9) % 2)) {
      return;
    }

    drawWrapped((x, y) => {
      drawPath(
        [[15, 0], [-11, -9], [-5, 0], [-11, 9]],
        x,
        y,
        ship.angle,
      );

      if (ship.thrusting) {
        ctx.strokeStyle = '#ffcc80';
        drawPath(
          [[-9, 0], [-19 - Math.random() * 7, 0]],
          x,
          y,
          ship.angle,
          false,
        );
        ctx.strokeStyle = '#baffdf';
      }
    }, ship);
  }

  function drawHud() {
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#baffdf';
    ctx.font = 'bold 16px "Courier New"';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${formatScore(score)}`, 20, 18);
    ctx.fillText(`HIGH ${formatScore(highScore)}`, Math.max(160, width() / 2 - 65), 18);
    ctx.fillText(`WAVE ${level}`, width() - 106, 18);

    if (combo > 1 && comboTimer > 0) {
      ctx.fillStyle = '#ffcc8e';
      ctx.textAlign = 'center';
      ctx.fillText(`COMBO x${combo - 1}`, width() / 2, 45);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#baffdf';
    }

    if (clearBonusTimer > 0) {
      ctx.fillStyle = '#8fe8ff';
      ctx.textAlign = 'center';
      ctx.fillText(`SECTOR CLEAR +${clearBonus}`, width() / 2, 65);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#baffdf';
    }

    for (let index = 0; index < Math.max(0, lives); index += 1) {
      drawPath(
        [[7, 0], [-5, -4], [-2, 0], [-5, 4]],
        29 + index * 23,
        52,
        -Math.PI / 2,
      );
    }

    ctx.fillStyle = '#67cbb0';
    ctx.font = '12px "Courier New"';
    ctx.fillText('H: HYPERSPACE  •  P: PAUSE', 20, height() - 42);
    ctx.fillText(`M: SOUND ${muted ? 'OFF' : 'ON'}`, 20, height() - 25);

    if (!ufo && level > 1 && ufoClock < 2.2 && ufoClock > 0) {
      ctx.fillStyle = '#ffcc8e';
      ctx.textAlign = 'right';
      ctx.fillText('UFO SIGNAL DETECTED', width() - 20, height() - 25);
      ctx.textAlign = 'left';
    }

    if (waveBannerTimer > 0) {
      ctx.globalAlpha = Math.min(1, waveBannerTimer * 2);
      ctx.fillStyle = '#d9fff1';
      ctx.font = 'bold 25px "Courier New"';
      ctx.textAlign = 'center';
      ctx.fillText(`WAVE ${level}`, width() / 2, height() * 0.3);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }

    if (paused) {
      ctx.fillStyle = '#d9fff1';
      ctx.font = 'bold 28px "Courier New"';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', width() / 2, height() / 2 - 15);
      ctx.font = '13px "Courier New"';
      ctx.fillText('PRESS P TO RESUME', width() / 2, height() / 2 + 22);
      ctx.textAlign = 'left';
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width(), height());
    ctx.fillStyle = '#02080c';
    ctx.fillRect(0, 0, width(), height());

    ctx.fillStyle = '#baffdf';
    stars.forEach(star => {
      ctx.globalAlpha = star.alpha;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    });
    ctx.globalAlpha = 1;

    ctx.save();
    if (shake) {
      ctx.translate(random(-shake, shake) * 5, random(-shake, shake) * 5);
    }

    ctx.strokeStyle = '#baffdf';
    ctx.lineWidth = 1.7;
    ctx.shadowColor = '#18e4a5';
    ctx.shadowBlur = 5;
    asteroids.forEach(drawAsteroid);

    if (ufo) {
      drawUfo();
    }

    [...bullets, ...enemyBullets].forEach(bullet => {
      ctx.fillStyle = bullet.enemy ? '#ffb26f' : '#d5fff0';
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, TAU);
      ctx.fill();
    });

    particles.forEach(particle => {
      ctx.globalAlpha = Math.max(0, particle.life / 0.75);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, 2, 2);
    });
    ctx.globalAlpha = 1;
    drawShip();
    ctx.restore();
    drawHud();
  }

  // Input --------------------------------------------------------------------
  // Input listeners are installed once; touch feeds the same key set as a physical keyboard.
  function frame(now) {
    // Cap simulation time after a tab stall so objects cannot tunnel through each other.
    const deltaTime = Math.min(0.033, (now - lastFrameTime) / 1000 || 0);
    lastFrameTime = now;
    update(deltaTime, now);
    draw();
    requestAnimationFrame(frame);
  }

  function handleKeyDown(event) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space'].includes(event.code)) {
      event.preventDefault();
    }

    if (event.code === 'KeyP' && !event.repeat && active) {
      paused = !paused;
      keys.clear();
    }

    if (event.code === 'KeyM' && !event.repeat) {
      muted = !muted;
    }

    keys.add(event.code);
  }

  function bindTouchControls() {
    document.querySelectorAll('.touch').forEach(button => {
      const code = button.dataset.key;

      const press = event => {
        event.preventDefault();
        // Capture pairs a release with this button even when the finger drifts off it.
        button.setPointerCapture?.(event.pointerId);
        keys.add(code);
      };
      const release = event => {
        event.preventDefault();
        keys.delete(code);
      };

      button.addEventListener('pointerdown', press);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
    });
  }

  window.addEventListener('resize', resize);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', event => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());
  actionButton.addEventListener('click', startGame);

  bindTouchControls();
  resize();
  requestAnimationFrame(frame);
})();
