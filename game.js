/* ASTEROIDS: a self-contained Canvas arcade game. All visuals and audio are generated at runtime. */
(() => {
  'use strict';
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const overlay = document.querySelector('#overlay');
  const action = document.querySelector('#action');
  const title = document.querySelector('#title');
  const message = document.querySelector('#message');
  const W = () => canvas.width / devicePixelRatio;
  const H = () => canvas.height / devicePixelRatio;
  const TAU = Math.PI * 2;
  const key = new Set();
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const readHigh = () => { try { return +(localStorage.asteroidsHigh || 0); } catch { return 0; } };
  const saveHigh = value => { try { localStorage.asteroidsHigh = value; } catch { /* Private browsing can disable storage; play continues. */ } };
  let audio, last = 0, active = false, paused = false, muted = false, gameOver = false, score = 0, high = readHigh();
  let level = 0, lives = 3, ship, asteroids, bullets, enemyBullets, particles, ufo, ufoClock, respawnTimer, waveBanner, shake, stars;

  function resize() { const dpr = Math.min(devicePixelRatio || 1, 2); canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); buildStars(); }
  function buildStars() { stars = Array.from({ length: Math.max(35, Math.floor(W() * H() / (reduceMotion ? 18000 : 11000))) }, () => ({ x: Math.random() * W(), y: Math.random() * H(), a: .15 + Math.random() * .5, s: Math.random() * 1.4 })); }
  function wrap(o) { o.x = (o.x + W()) % W(); o.y = (o.y + H()) % H(); }
  function dist(a, b) { const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y); return Math.hypot(Math.min(dx, W() - dx), Math.min(dy, H() - dy)); }
  function rand(min, max) { return min + Math.random() * (max - min); }
  function tone(freq, time = .08, type = 'square', gain = .04, slide = 0) {
    if (!audio || muted) return; const now = audio.currentTime, osc = audio.createOscillator(), amp = audio.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, now); osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), now + time);
    amp.gain.setValueAtTime(gain, now); amp.gain.exponentialRampToValueAtTime(.001, now + time); osc.connect(amp).connect(audio.destination); osc.start(now); osc.stop(now + time);
  }
  function sound(name) { if (name === 'fire') tone(520, .055, 'square', .035, -280); if (name === 'boom') tone(100, .2, 'sawtooth', .07, -65); if (name === 'thrust') tone(60, .04, 'triangle', .018, 20); if (name === 'ufo') tone(290, .11, 'sine', .03, 80); if (name === 'hyper') tone(900, .16, 'sine', .05, -760); if (name === 'life') tone(760, .22, 'triangle', .05, 250); }
  function makeShip() { let x = W() / 2, y = H() / 2; for (let i = 0; i < 28 && asteroids?.some(a => Math.hypot(a.x - x, a.y - y) < a.r + 110); i++) { x = rand(80, W() - 80); y = rand(80, H() - 80); } return { x, y, vx: 0, vy: 0, a: -Math.PI / 2, r: 13, cool: 0, inv: 2.6, flame: 0 }; }
  function makeAsteroid(size, x = rand(0, W()), y = rand(0, H()), parent = null) { const r = [12, 23, 40][size], n = 8 + Math.floor(Math.random() * 5), shape = Array.from({ length: n }, () => r * rand(.7, 1.15)); const angle = Math.random() * TAU, speed = rand(18, 55) + level * 3; return { x, y, vx: (parent?.vx || 0) * .35 + Math.cos(angle) * speed, vy: (parent?.vy || 0) * .35 + Math.sin(angle) * speed, a: 0, spin: rand(-1.2, 1.2), size, r, shape }; }
  function burst(x, y, count, color = '#baffdf') { for (let i = 0; i < (reduceMotion ? Math.ceil(count * .35) : count); i++) { const a = Math.random() * TAU, speed = rand(20, 160); particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: rand(.25, .75), max: 1, color }); } }
  function newWave() { level++; waveBanner = 1.65; const count = Math.min(3 + level, 10); for (let i = 0; i < count; i++) { let x, y; do { x = rand(0, W()); y = rand(0, H()); } while (ship && Math.hypot(x - ship.x, y - ship.y) < 140); asteroids.push(makeAsteroid(2, x, y)); } ufoClock = rand(8, 15) / Math.min(1 + level * .04, 1.7); sound('life'); }
  function resetGame() { score = 0; level = 0; lives = 3; asteroids = []; bullets = []; enemyBullets = []; particles = []; ufo = null; shake = 0; ship = makeShip(); respawnTimer = 0; newWave(); }
  function start() { if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); resetGame(); active = true; paused = false; gameOver = false; overlay.classList.add('hidden'); }
  function end() { active = false; gameOver = true; high = Math.max(high, score); saveHigh(high); title.textContent = 'GAME OVER'; message.textContent = `Final score: ${score.toString().padStart(6, '0')}  •  High score: ${high.toString().padStart(6, '0')}`; action.textContent = 'PLAY AGAIN'; overlay.classList.remove('hidden'); }
  function shoot(enemy = false) { const source = enemy ? ufo : ship; if (!source) return; const a = enemy ? Math.atan2(ship.y - ufo.y, ship.x - ufo.x) + rand(-.25, .25) : ship.a; const speed = enemy ? 210 : 460; (enemy ? enemyBullets : bullets).push({ x: source.x + Math.cos(a) * (source.r || 14), y: source.y + Math.sin(a) * (source.r || 14), vx: (source.vx || 0) + Math.cos(a) * speed, vy: (source.vy || 0) + Math.sin(a) * speed, life: enemy ? 2.2 : 1.05, r: enemy ? 3 : 2 }); sound(enemy ? 'ufo' : 'fire'); }
  function hyperspace() { if (!ship || ship.hyper > 0) return; ship.x = rand(0, W()); ship.y = rand(0, H()); ship.vx = ship.vy = 0; ship.inv = .8; ship.hyper = 1.2; burst(ship.x, ship.y, 18, '#67ddff'); sound('hyper'); }
  function loseShip() { if (!ship || ship.inv > 0) return; burst(ship.x, ship.y, 30, '#baffdf'); sound('boom'); lives--; ship = null; respawnTimer = 1.6; if (lives < 0) end(); }
  function award(n) { score += n; if (score > high) { high = score; saveHigh(high); } if (score > 0 && score % 10000 < n) { lives++; sound('life'); } }
  function update(dt) {
    if (!active || paused) return; waveBanner -= dt;
    if (ship) {
      ship.cool -= dt; ship.inv -= dt; ship.hyper = Math.max(0, (ship.hyper || 0) - dt); ship.flame = 0;
      if (key.has('ArrowLeft') || key.has('KeyA')) ship.a -= 4.5 * dt;
      if (key.has('ArrowRight') || key.has('KeyD')) ship.a += 4.5 * dt;
      if (key.has('ArrowUp') || key.has('KeyW')) { ship.vx += Math.cos(ship.a) * 235 * dt; ship.vy += Math.sin(ship.a) * 235 * dt; ship.flame = 1; if (!reduceMotion && Math.random() < .35) { const a = ship.a + Math.PI + rand(-.35, .35); particles.push({ x: ship.x - Math.cos(ship.a) * 10, y: ship.y - Math.sin(ship.a) * 10, vx: ship.vx * .25 + Math.cos(a) * rand(45, 95), vy: ship.vy * .25 + Math.sin(a) * rand(45, 95), life: .22, max: 1, color: '#ffcc80' }); } if (Math.random() < .15) sound('thrust'); }
      if ((key.has('Space') || key.has('KeyX')) && ship.cool <= 0) { shoot(); ship.cool = .19; }
      if (key.has('KeyH')) { key.delete('KeyH'); hyperspace(); }
      const speed = Math.hypot(ship.vx, ship.vy); if (speed > 310) { ship.vx *= 310 / speed; ship.vy *= 310 / speed; } ship.vx *= Math.pow(.985, dt * 60); ship.vy *= Math.pow(.985, dt * 60); ship.x += ship.vx * dt; ship.y += ship.vy * dt; wrap(ship);
    } else if ((respawnTimer -= dt) <= 0 && lives >= 0) { ship = makeShip(); }
    for (const a of asteroids) { a.x += a.vx * dt; a.y += a.vy * dt; a.a += a.spin * dt; wrap(a); }
    for (const list of [bullets, enemyBullets]) for (const b of list) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; wrap(b); }
    bullets = bullets.filter(b => b.life > 0); enemyBullets = enemyBullets.filter(b => b.life > 0);
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .96; p.vy *= .96; p.life -= dt; } particles = particles.filter(p => p.life > 0);
    if (!ufo && level > 1) { ufoClock -= dt; if (ufoClock <= 0) { const dir = Math.random() < .5 ? 1 : -1; ufo = { x: dir > 0 ? -30 : W() + 30, y: rand(80, H() - 120), vx: dir * (78 + level * 2), vy: 0, r: level > 4 && Math.random() < .4 ? 12 : 18, cool: 1 }; sound('ufo'); } }
    if (ufo) { ufo.x += ufo.vx * dt; ufo.y += Math.sin(performance.now() / 350) * 25 * dt; ufo.cool -= dt; if (ufo.cool < 0 && ship) { shoot(true); ufo.cool = rand(.8, 1.8); } if (ufo.x < -45 || ufo.x > W() + 45) ufo = null; }
    // Projectile-to-rock collision; splitting occurs only once per destroyed parent.
    for (const b of bullets) for (const a of asteroids) if (b.life > 0 && a.dead !== true && dist(b, a) < a.r + b.r) { b.life = 0; a.dead = true; award([100, 50, 20][a.size]); burst(a.x, a.y, a.size === 2 ? 20 : 12); if (!reduceMotion) shake = Math.max(shake, a.size === 2 ? 1 : .45); sound('boom'); if (a.size) { asteroids.push(makeAsteroid(a.size - 1, a.x, a.y, a), makeAsteroid(a.size - 1, a.x, a.y, a)); } }
    asteroids = asteroids.filter(a => !a.dead);
    if (ufo) for (const b of bullets) if (b.life > 0 && dist(b, ufo) < ufo.r + b.r) { b.life = 0; award(ufo.r < 15 ? 1000 : 200); burst(ufo.x, ufo.y, 24, '#ffcc8e'); ufo = null; sound('boom'); }
    if (ship) { for (const a of asteroids) if (dist(ship, a) < ship.r + a.r * .72) loseShip(); for (const b of enemyBullets) if (dist(ship, b) < ship.r + b.r) loseShip(); if (ufo && dist(ship, ufo) < ship.r + ufo.r) loseShip(); }
    if (!asteroids.length) newWave(); shake = Math.max(0, shake - dt * 3);
  }
  function path(points, x, y, a = 0, close = true) { ctx.beginPath(); points.forEach(([px, py], i) => { const rx = x + px * Math.cos(a) - py * Math.sin(a), ry = y + px * Math.sin(a) + py * Math.cos(a); i ? ctx.lineTo(rx, ry) : ctx.moveTo(rx, ry); }); if (close) ctx.closePath(); ctx.stroke(); }
  function drawWrapped(draw, o) { for (const ox of [-W(), 0, W()]) for (const oy of [-H(), 0, H()]) if (ox || oy ? o.x < 45 || o.x > W() - 45 || o.y < 45 || o.y > H() - 45 : true) draw(o.x + ox, o.y + oy); }
  function draw() {
    ctx.clearRect(0, 0, W(), H()); ctx.fillStyle = '#02080c'; ctx.fillRect(0, 0, W(), H());
    ctx.fillStyle = '#baffdf'; for (const s of stars) { ctx.globalAlpha = s.a; ctx.fillRect(s.x, s.y, s.s, s.s); } ctx.globalAlpha = 1;
    ctx.save(); if (shake) ctx.translate(rand(-shake, shake) * 5, rand(-shake, shake) * 5); ctx.strokeStyle = '#baffdf'; ctx.lineWidth = 1.7; ctx.shadowColor = '#18e4a5'; ctx.shadowBlur = 5;
    for (const a of asteroids) drawWrapped((x, y) => { const points = a.shape.map((r, i) => [Math.cos(i * TAU / a.shape.length) * r, Math.sin(i * TAU / a.shape.length) * r]); path(points, x, y, a.a); }, a);
    if (ufo) drawWrapped((x, y) => { ctx.beginPath(); ctx.ellipse(x, y + 4, ufo.r, 6, 0, 0, TAU); ctx.moveTo(x - ufo.r * .55, y + 1); ctx.quadraticCurveTo(x, y - ufo.r, x + ufo.r * .55, y + 1); ctx.stroke(); }, ufo);
    for (const b of bullets.concat(enemyBullets)) { ctx.fillStyle = enemyBullets.includes(b) ? '#ffb26f' : '#d5fff0'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill(); }
    for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / .75); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 2, 2); } ctx.globalAlpha = 1;
    if (ship && (ship.inv <= 0 || Math.floor(ship.inv * 9) % 2)) { drawWrapped((x, y) => { path([[15, 0], [-11, -9], [-5, 0], [-11, 9]], x, y, ship.a); if (ship.flame) { ctx.strokeStyle = '#ffcc80'; path([[-9, 0], [-19 - Math.random() * 7, 0]], x, y, ship.a, false); ctx.strokeStyle = '#baffdf'; } }, ship); }
    ctx.restore(); ctx.shadowBlur = 0; ctx.fillStyle = '#baffdf'; ctx.font = 'bold 16px "Courier New"'; ctx.textBaseline = 'top'; ctx.fillText(`SCORE ${score.toString().padStart(6, '0')}`, 20, 18); ctx.fillText(`HIGH ${high.toString().padStart(6, '0')}`, Math.max(160, W() / 2 - 65), 18); ctx.fillText(`WAVE ${level}`, W() - 106, 18);
    for (let i = 0; i < Math.max(0, lives); i++) path([[7, 0], [-5, -4], [-2, 0], [-5, 4]], 29 + i * 23, 52, -Math.PI / 2);
    ctx.fillStyle = '#67cbb0'; ctx.font = '12px "Courier New"'; ctx.fillText(`H: HYPERSPACE  •  P: PAUSE  •  M: SOUND ${muted ? 'OFF' : 'ON'}`, 20, H() - 25); if (!ufo && level > 1 && ufoClock < 2.2 && ufoClock > 0) { ctx.fillStyle = '#ffcc8e'; ctx.fillText('UFO SIGNAL DETECTED', W() - 186, H() - 25); } if (waveBanner > 0) { ctx.globalAlpha = Math.min(1, waveBanner * 2); ctx.fillStyle = '#d9fff1'; ctx.font = 'bold 25px "Courier New"'; ctx.textAlign = 'center'; ctx.fillText(`WAVE ${level}`, W() / 2, H() * .30); ctx.globalAlpha = 1; ctx.textAlign = 'left'; } if (paused) { ctx.fillStyle = '#d9fff1'; ctx.font = 'bold 28px "Courier New"'; ctx.textAlign = 'center'; ctx.fillText('PAUSED', W() / 2, H() / 2 - 15); ctx.font = '13px "Courier New"'; ctx.fillText('PRESS P TO RESUME', W() / 2, H() / 2 + 22); ctx.textAlign = 'left'; }
  }
  function frame(t) { const dt = Math.min(.033, (t - last) / 1000 || 0); last = t; update(dt); draw(); requestAnimationFrame(frame); }
  addEventListener('resize', resize); addEventListener('keydown', e => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space'].includes(e.code)) e.preventDefault(); if (e.code === 'KeyP' && !e.repeat && active) { paused = !paused; key.clear(); } if (e.code === 'KeyM' && !e.repeat) muted = !muted; key.add(e.code); }); addEventListener('keyup', e => key.delete(e.code)); addEventListener('blur', () => key.clear());
  document.querySelectorAll('.touch').forEach(button => { const code = button.dataset.key; const down = e => { e.preventDefault(); key.add(code); }; const up = e => { e.preventDefault(); key.delete(code); }; button.addEventListener('pointerdown', down); button.addEventListener('pointerup', up); button.addEventListener('pointercancel', up); button.addEventListener('pointerleave', up); });
  action.addEventListener('click', start); resize(); requestAnimationFrame(frame);
})();
