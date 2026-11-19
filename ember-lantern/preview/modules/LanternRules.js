export const INITIAL_PROGRESS = { version: 1, currency: 0, upgrades: { flame: 0, pulse: 0, stride: 0 }, bestDepth: 0, runs: 0, totalSeeds: 0 };
export const WORLD = { minX: -306, maxX: 306, minY: -360, maxY: 354, portalX: 0, portalY: 285 };
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const distance = (x, y, xx, yy) => Math.hypot(x - xx, y - yy);
export const upgradeCost = (upgrades, key) => [15, 17, 19][['flame', 'pulse', 'stride'].indexOf(key)] + upgrades[key] * ([17, 21, 23][['flame', 'pulse', 'stride'].indexOf(key)]);
export function normalizeProgress(raw) {
    if (!raw || typeof raw !== 'object')
        return JSON.parse(JSON.stringify(INITIAL_PROGRESS));
    const s = raw;
    const u = s.upgrades || INITIAL_PROGRESS.upgrades;
    return { version: 1, currency: clamp(Number(s.currency) || 0, 0, 9999999), bestDepth: clamp(Number(s.bestDepth) || 0, 0, 99), runs: clamp(Number(s.runs) || 0, 0, 999999), totalSeeds: clamp(Number(s.totalSeeds) || 0, 0, 9999999), upgrades: { flame: clamp(Number(u.flame) || 0, 0, 9), pulse: clamp(Number(u.pulse) || 0, 0, 9), stride: clamp(Number(u.stride) || 0, 0, 9) } };
}
function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
export class LanternRules {
    constructor(progress = INITIAL_PROGRESS, seed = 12345) {
        this.clock = 0;
        this.vx = 0;
        this.vy = 0;
        this.lastMoveX = 0;
        this.lastMoveY = 1;
        this.pulseCount = 0;
        this.pendingBank = 0;
        this.wave = 0;
        this.progress = normalizeProgress(progress);
        this.state = this.empty(seed);
    }
    empty(seed) {
        return { phase: 'camp', depth: 0, time: 0, hero: { x: 0, y: -278, hp: 4, maxHp: 4, flame: 100, maxFlame: 100, invuln: 0, dashCd: 0, pulseCd: 0, hitflash: 0 }, enemies: [], pickups: [], collected: 0, target: 3, carried: 0, portalReady: false, portalX: WORLD.portalX, portalY: WORLD.portalY, kills: 0, seed, events: [], maxDepthReached: 0 };
    }
    begin(seed) {
        this.state = this.empty(seed);
        this.state.depth = 1;
        this.state.phase = 'exploring';
        this.pendingBank = 0;
        this.pulseCount = 0;
        this.lastMoveY = 1;
        this.setupRoom(false);
    }
    setupRoom(continueHero) {
        const s = this.state;
        const rand = rng((s.seed + Math.imul(s.depth, 7919)) >>> 0);
        const maxFlame = 100 + this.progress.upgrades.flame * 12;
        const maxHP = 4;
        s.hero = { x: 0, y: -275, maxHp: maxHP, hp: continueHero ? Math.min(maxHP, s.hero.hp + 1) : maxHP, maxFlame, flame: continueHero ? Math.min(maxFlame, s.hero.flame + 35) : maxFlame, pulseCd: 0, dashCd: 0, invuln: 1, hitflash: 0 };
        this.wave = 0;
        s.target = Math.min(5, 2 + s.depth);
        s.collected = 0;
        s.portalReady = false;
        s.time = 0;
        s.enemies = [];
        s.pickups = [];
        s.maxDepthReached = Math.max(s.maxDepthReached, s.depth);
        for (let i = 0; i < s.target + 2; i++) {
            let x = -255 + rand() * 510, y = -205 + rand() * 425;
            if (Math.abs(x) < 65 && y < -120)
                x += x >= 0 ? 93 : -93;
            s.pickups.push({ id: `s${s.depth}_${i}`, kind: 'seed', x, y, revealed: i === 0, taken: false, glimmer: rand() * 6.3 });
        }
        for (let i = 0; i < 3; i++)
            s.pickups.push({ id: `f${s.depth}_${i}`, kind: 'fuel', x: -246 + rand() * 492, y: -205 + rand() * 454, revealed: true, taken: false, glimmer: rand() * 6.3 });
        for (let i = 0; i < Math.min(8, 3 + s.depth); i++) {
            let x = -265 + rand() * 530, y = -20 + rand() * 305;
            if (distance(x, y, 0, -275) < 180) {
                y = 180 + rand() * 75;
            }
            const kind = (i + s.depth) % 5 === 0 ? 'moth' : (i + s.depth) % 3 === 0 ? 'mantis' : 'hunter';
            const hp = kind === 'mantis' ? 3 : kind === 'moth' ? 1 : 2;
            s.enemies.push({ id: `e${s.depth}_${i}`, kind, x, y, hp, maxHp: hp, speed: (kind === 'moth' ? 63 : kind === 'mantis' ? 45 : 53) + s.depth * 6, cooldown: 1 + rand() * 1.7, windup: 0, stun: 0, strikeX: x, strikeY: y, phase: rand() * 6.3 });
        }
        s.events.push({ kind: 'stage', x: 0, y: -275, amount: s.depth });
    }
    move(x, y) { const n = Math.hypot(x, y); this.vx = n > 1 ? x / n : x; this.vy = n > 1 ? y / n : y; }
    get pulseCost() { return 17; }
    get canPulse() { return this.state.phase === 'exploring' && this.state.hero.flame >= this.pulseCost && this.state.hero.pulseCd <= 0; }
    pulse() {
        if (!this.canPulse)
            return false;
        const s = this.state, h = s.hero;
        h.flame -= this.pulseCost;
        h.pulseCd = 1.0;
        this.pulseCount++;
        const range = 153 + this.progress.upgrades.pulse * 6;
        s.events.push({ kind: 'pulse', x: h.x, y: h.y, amount: range });
        for (const p of s.pickups) {
            if (!p.taken && !p.revealed && distance(p.x, p.y, h.x, h.y) < range + 30) {
                p.revealed = true;
                s.events.push({ kind: 'reveal', x: p.x, y: p.y });
            }
        }
        for (const e of s.enemies) {
            if (e.hp > 0 && distance(e.x, e.y, h.x, h.y) < range) {
                e.hp -= (1 + Math.floor(this.progress.upgrades.pulse / 3));
                e.stun = .68;
                e.windup = 0;
                s.events.push({ kind: 'hit', x: e.x, y: e.y, amount: 1 + Math.floor(this.progress.upgrades.pulse / 3) });
                if (e.hp <= 0) {
                    s.kills++;
                    s.events.push({ kind: 'kill', x: e.x, y: e.y });
                }
            }
        }
        return true;
    }
    dash() {
        const s = this.state, h = s.hero;
        if (s.phase !== 'exploring' || h.dashCd > 0 || h.flame < 8)
            return false;
        h.flame -= 8;
        h.dashCd = 2.7;
        h.invuln = .37;
        const mag = Math.hypot(this.vx, this.vy);
        const dx = mag > .2 ? this.vx / mag : this.lastMoveX, dy = mag > .2 ? this.vy / mag : this.lastMoveY;
        h.x = clamp(h.x + dx * 125, WORLD.minX, WORLD.maxX);
        h.y = clamp(h.y + dy * 125, WORLD.minY, WORLD.maxY);
        s.events.push({ kind: 'dash', x: h.x, y: h.y });
        return true;
    }
    tick(dt) {
        const s = this.state;
        if (s.phase !== 'exploring')
            return;
        dt = clamp(dt, 0, .05);
        s.time += dt;
        this.clock += dt;
        const h = s.hero;
        h.pulseCd = Math.max(0, h.pulseCd - dt);
        h.dashCd = Math.max(0, h.dashCd - dt);
        h.invuln = Math.max(0, h.invuln - dt);
        h.hitflash = Math.max(0, h.hitflash - dt);
        const mag = Math.hypot(this.vx, this.vy);
        if (mag > .1) {
            this.lastMoveX = this.vx / mag;
            this.lastMoveY = this.vy / mag;
        }
        const speed = 190 + this.progress.upgrades.stride * 10;
        h.x = clamp(h.x + this.vx * speed * dt, WORLD.minX, WORLD.maxX);
        h.y = clamp(h.y + this.vy * speed * dt, WORLD.minY, WORLD.maxY);
        h.flame = clamp(h.flame - dt * (.37 + s.depth * .095), 0, h.maxFlame);
        for (const p of s.pickups) {
            if (p.taken)
                continue;
            const d = distance(p.x, p.y, h.x, h.y);
            if (!p.revealed && d < 65) {
                p.revealed = true;
                s.events.push({ kind: 'reveal', x: p.x, y: p.y });
            }
            if (p.revealed && d < 37) {
                p.taken = true;
                if (p.kind === 'seed') {
                    s.collected++;
                    const gain = 8 + 2 * s.depth;
                    s.carried += gain;
                    h.flame = clamp(h.flame + 4, 0, h.maxFlame);
                    s.events.push({ kind: 'pickup', x: p.x, y: p.y, amount: gain, tag: 'seed' });
                }
                else {
                    h.flame = clamp(h.flame + 30, 0, h.maxFlame);
                    s.events.push({ kind: 'pickup', x: p.x, y: p.y, amount: 30, tag: 'fuel' });
                }
            }
        }
        if (s.collected >= s.target && !s.portalReady) {
            s.portalReady = true;
            s.events.push({ kind: 'portal', x: WORLD.portalX, y: WORLD.portalY });
        }
        if (s.portalReady && distance(h.x, h.y, WORLD.portalX, WORLD.portalY) < 64) {
            s.phase = 'choice';
            this.move(0, 0);
            return;
        }
        if (s.time > (this.wave + 1) * 23 && s.enemies.filter(e => e.hp > 0).length < 9) {
            this.wave++;
            const random = rng((s.seed + Math.imul(s.depth, 4099) + Math.imul(this.wave, 314159)) >>> 0);
            const side = random() > .5 ? 1 : -1;
            const ex = side * 282, ey = -150 + random() * 465;
            s.enemies.push({ id: `patrol_${s.depth}_${this.wave}`, kind: this.wave % 3 === 0 ? 'mantis' : 'hunter', x: ex, y: ey, hp: 2, maxHp: 2, speed: 65 + s.depth * 7, cooldown: 1, stun: 0, windup: 0, strikeX: ex, strikeY: ey, phase: random() * 6.3 });
            s.events.push({ kind: 'ambush', x: ex, y: ey });
        }
        for (const e of s.enemies) {
            if (e.hp <= 0)
                continue;
            e.phase += dt * 5;
            e.cooldown = Math.max(0, e.cooldown - dt);
            e.stun = Math.max(0, e.stun - dt);
            if (e.stun > 0)
                continue;
            const d = distance(h.x, h.y, e.x, e.y);
            if (e.windup > 0) {
                e.windup -= dt;
                if (e.windup <= 0) {
                    if (distance(h.x, h.y, e.strikeX, e.strikeY) < 58 && h.invuln <= 0) {
                        h.hp--;
                        h.invuln = 1.15;
                        h.hitflash = .38;
                        s.events.push({ kind: 'hurt', x: h.x, y: h.y, amount: h.hp });
                        if (h.hp === 1)
                            s.events.push({ kind: 'near-death', x: h.x, y: h.y });
                    }
                    e.cooldown = 1.7 + Math.min(1, s.depth * .12);
                }
            }
            else if (d < 60 && e.cooldown === 0) {
                e.windup = .66;
                e.strikeX = h.x;
                e.strikeY = h.y;
            }
            else if (d > 40) {
                const pursuit = Math.min(d - 40, (e.speed + s.collected * 3 + (h.flame / h.maxFlame < .2 ? 12 : 0)) * dt);
                e.x += ((h.x - e.x) / d) * pursuit;
                e.y += ((h.y - e.y) / d) * pursuit;
            }
        }
        if (h.hp <= 0 || h.flame <= 0) {
            s.phase = 'defeated';
            this.pendingBank = Math.floor(s.carried * .35);
            s.events.push({ kind: 'defeat', x: h.x, y: h.y, amount: this.pendingBank });
        }
    }
    choose(choice) {
        const s = this.state;
        if (s.phase !== 'choice')
            return false;
        if (choice === 'deeper' && s.depth < 3) {
            s.depth++;
            s.phase = 'exploring';
            this.setupRoom(true);
            return true;
        }
        this.pendingBank = s.carried + Math.max(0, s.depth - 1) * 7;
        s.phase = 'settled';
        s.events.push({ kind: 'settled', x: 0, y: 0, amount: this.pendingBank });
        return true;
    }
    finish() {
        const s = this.state;
        if (s.phase !== 'settled' && s.phase !== 'defeated')
            return 0;
        const gain = this.pendingBank;
        this.progress.currency += gain;
        this.progress.totalSeeds += gain;
        this.progress.runs++;
        this.progress.bestDepth = Math.max(this.progress.bestDepth, s.maxDepthReached);
        this.state = this.empty((s.seed + 1) >>> 0);
        this.pendingBank = 0;
        return gain;
    }
    buy(key) {
        if (this.state.phase !== 'camp')
            return false;
        const cost = upgradeCost(this.progress.upgrades, key);
        if (this.progress.currency < cost || this.progress.upgrades[key] >= 9)
            return false;
        this.progress.currency -= cost;
        this.progress.upgrades[key]++;
        return true;
    }
    drainEvents() { const x = this.state.events; this.state.events = []; return x; }
}
