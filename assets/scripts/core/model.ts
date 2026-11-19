import { ROOMS, TUNING } from './rooms';
import type {
  AimPreview, Body, EnemyState, GameEvent, GameEventType, GameSnapshot, GameState,
  ObstacleState, RoomConfig, RuntimeState, ToolId, Vec2,
} from './types';

const EPS = 0.00001;
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const length = (x: number, y: number): number => Math.sqrt(x * x + y * y);
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const normal = (x: number, y: number): Vec2 => {
  const n = length(x, y);
  return n > EPS ? { x: x / n, y: y / n } : { x: 0, y: 1 };
};

interface Contact { nx: number; ny: number; depth: number; }

function circleRect(body: Body, rect: ObstacleState): Contact | null {
  const left = rect.x - rect.w / 2, right = rect.x + rect.w / 2;
  const bottom = rect.y - rect.h / 2, top = rect.y + rect.h / 2;
  const nearX = clamp(body.x, left, right), nearY = clamp(body.y, bottom, top);
  const dx = body.x - nearX, dy = body.y - nearY;
  const distSq = dx * dx + dy * dy;
  if (distSq >= body.radius * body.radius) return null;
  if (distSq > EPS * EPS) {
    const dist = Math.sqrt(distSq);
    return { nx: dx / dist, ny: dy / dist, depth: body.radius - dist };
  }
  const distances = [body.x - left, right - body.x, body.y - bottom, top - body.y];
  let side = 0;
  for (let i = 1; i < 4; i++) if (distances[i] < distances[side]) side = i;
  return {
    nx: side === 0 ? -1 : side === 1 ? 1 : 0,
    ny: side === 2 ? -1 : side === 3 ? 1 : 0,
    depth: body.radius + distances[side],
  };
}

function segmentRectT(a: Vec2, b: Vec2, r: ObstacleState, pad: number): number {
  let minT = 0, maxT = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  const origins = [a.x, a.y], directions = [dx, dy];
  const minimums = [r.x - r.w / 2 - pad, r.y - r.h / 2 - pad];
  const maximums = [r.x + r.w / 2 + pad, r.y + r.h / 2 + pad];
  for (let axis = 0; axis < 2; axis++) {
    if (Math.abs(directions[axis]) < EPS) {
      if (origins[axis] < minimums[axis] || origins[axis] > maximums[axis]) return Infinity;
    } else {
      let aT = (minimums[axis] - origins[axis]) / directions[axis];
      let bT = (maximums[axis] - origins[axis]) / directions[axis];
      if (aT > bT) { const old = aT; aT = bT; bT = old; }
      minT = Math.max(minT, aT); maxT = Math.min(maxT, bT);
      if (minT > maxT) return Infinity;
    }
  }
  return minT;
}

function segmentCircleT(a: Vec2, b: Vec2, centre: Vec2, radius: number): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const ox = a.x - centre.x, oy = a.y - centre.y;
  const c = ox * ox + oy * oy - radius * radius;
  if (c <= 0) return 0;
  const aa = dx * dx + dy * dy;
  if (aa < EPS) return Infinity;
  const bb = 2 * (ox * dx + oy * dy), disc = bb * bb - 4 * aa * c;
  if (disc < 0) return Infinity;
  const t = (-bb - Math.sqrt(disc)) / (2 * aa);
  return t >= 0 && t <= 1 ? t : Infinity;
}

/** Pure deterministic simulation. Feed seconds to step; render state without mutating it. */
export class GameModel {
  public state!: GameState;
  private runtime!: RuntimeState;
  private events: GameEvent[] = [];
  private rooms: RoomConfig[];

  constructor(options: { rooms?: RoomConfig[]; snapshot?: GameSnapshot } = {}) {
    this.rooms = copy(options.rooms || ROOMS);
    if (!this.rooms.length) throw new Error('At least one room is required.');
    this.restart();
    if (options.snapshot) this.restore(options.snapshot);
  }

  restart(): void {
    this.runtime = {
      accumulator: 0, flightTime: 0, settledTime: 0, lastShotStart: { x: 0, y: 0 },
      hitEnemies: [], hitBoards: [], continuingTurn: false, nextProjectileId: 0, exitWarning: false,
    };
    this.events = [];
    this.loadRoom(0, TUNING.maxHp, 'none', 0, 0, 0, 0, 0);
  }

  /** A permanently unlocked starting loadout is applied only before the first shot. */
  equipStartingTool(tool: ToolId): boolean {
    if(this.state.roomIndex!==0 || this.state.shots!==0 || this.state.phase!=='aiming' ||
      !['none','heavy','grip','return'].includes(tool)) return false;
    this.state.player.tool=tool;
    this.state.player.toolReady=tool==='grip'||tool==='return';
    return true;
  }

  /** Direction vector; magnitude does NOT determine strength. power is clamped to 0..1. */
  shoot(direction: Vec2, power = 1): boolean {
    if (this.state.phase !== 'aiming' || !Number.isFinite(direction.x) || !Number.isFinite(direction.y)
      || !Number.isFinite(power) || length(direction.x, direction.y) < EPS) return false;
    const p = this.state.player, d = normal(direction.x, direction.y);
    const speed = this.launchSpeed(power);
    p.vx = d.x * speed; p.vy = d.y * speed;
    this.state.phase = 'moving';
    this.state.shots++;
    if (!this.runtime.continuingTurn) {
      this.state.turn++;
      this.runtime.hitEnemies = [];
      this.runtime.hitBoards = [];
      p.toolReady = p.tool === 'grip' || p.tool === 'return';
    }
    this.runtime.continuingTurn = false;
    this.runtime.lastShotStart = { x: p.x, y: p.y };
    this.runtime.flightTime = 0; this.runtime.settledTime = 0;
    this.emit('shot', p.x, p.y, { amount: clamp(power, 0, 1), tool: p.tool });
    return true;
  }

  /** Grip pauses the SAME turn for one extra aim; return redirects towards this shot's origin. */
  activateTool(): boolean {
    const p = this.state.player;
    if (this.state.phase !== 'moving' || !p.toolReady) return false;
    if (p.tool === 'grip') {
      p.vx = 0; p.vy = 0; p.toolReady = false;
      this.state.phase = 'aiming'; this.runtime.continuingTurn = true;
      this.runtime.flightTime = 0; this.runtime.settledTime = 0;
    } else if (p.tool === 'return') {
      const dx = this.runtime.lastShotStart.x - p.x, dy = this.runtime.lastShotStart.y - p.y;
      if (length(dx, dy) < 0.25) return false;
      const d = normal(dx, dy);
      const speed = Math.max(7.8, Math.min(11.5, length(p.vx, p.vy) + 2));
      p.vx = d.x * speed; p.vy = d.y * speed; p.toolReady = false;
      this.runtime.flightTime = 0; this.runtime.settledTime = 0;
    } else return false;
    this.emit('tool_used', p.x, p.y, { tool: p.tool });
    return true;
  }

  /** Full static-geometry flight; interactive contacts are marked rather than guessed past. */
  aim(dx: number, dy: number, power = 1): AimPreview {
    const valid = Number.isFinite(dx) && Number.isFinite(dy) && Number.isFinite(power) && length(dx, dy) >= EPS;
    const d = valid ? normal(dx, dy) : { x: 0, y: 1 }, p = this.state.player;
    const result: AimPreview = {
      points: [{ x: p.x, y: p.y }], direction: d,
      power: Number.isFinite(power) ? clamp(power, 0, 1) : 0, blocked: false, endpoint: 'none',
    };
    if (!valid) return result;
    const ghost: Body = { x: p.x, y: p.y, vx: d.x * this.launchSpeed(power), vy: d.y * this.launchSpeed(power), radius: p.radius };
    const dt = TUNING.fixedStep, restitution = this.restitution();
    const drag = Math.exp(-this.playerDrag() * dt);
    // The same cap as real flight bounds work to at most 661 fixed steps with current tuning.
    const maxSteps = Math.ceil(TUNING.maxFlightTime / dt) + 1;
    let flightTime = 0, settledTime = 0, treasureTaken = this.state.treasure.taken;
    const appendPoint = (): void => {
      const last = result.points[result.points.length - 1];
      if (last.x !== ghost.x || last.y !== ghost.y) result.points.push({ x: ghost.x, y: ghost.y });
    };
    const finish = (endpoint: AimPreview['endpoint'], targetId?: string): AimPreview => {
      appendPoint(); result.endpoint = endpoint; result.blocked = endpoint === 'interaction';
      if (targetId !== undefined) result.targetId = targetId;
      return result;
    };
    for (let i = 0; i < maxSteps; i++) {
      flightTime += dt;
      ghost.x += ghost.vx * dt; ghost.y += ghost.vy * dt;
      let bounced = this.resolveBounds(ghost, restitution);
      // Match movePlayer/resolvePlayerObstacles: three ordered contact passes, then bounds.
      for (let pass = 0; pass < 3; pass++) {
        let overlap = false;
        for (const obstacle of this.state.obstacles) {
          if (obstacle.destroyed) continue;
          const contact = circleRect(ghost, obstacle);
          if (!contact) continue;
          overlap = true;
          if (obstacle.kind === 'board' || obstacle.kind === 'cabinet') {
            // Show the centre at the contact surface, never a supposed landing beyond it.
            ghost.x += contact.nx * (contact.depth + 0.0005);
            ghost.y += contact.ny * (contact.depth + 0.0005);
            return finish('interaction', obstacle.id);
          }
          this.resolveContact(ghost, contact, restitution); bounced = true;
        }
        if (!overlap) break;
      }
      bounced = this.resolveBounds(ghost, restitution) || bounced;
      ghost.vx *= drag; ghost.vy *= drag;
      if (length(ghost.vx, ghost.vy) < 0.08) { ghost.vx = 0; ghost.vy = 0; }
      for (const enemy of this.state.enemies) {
        if (!enemy.alive) continue;
        const ex = ghost.x - enemy.x, ey = ghost.y - enemy.y, distance = length(ex, ey);
        const radius = ghost.radius + enemy.radius;
        if (distance < radius) {
          const n = distance > EPS ? { x: ex / distance, y: ey / distance } : normal(-ghost.vx, -ghost.vy);
          ghost.x = enemy.x + n.x * radius; ghost.y = enemy.y + n.y * radius;
          return finish('interaction', enemy.id);
        }
      }
      // Objectives can stop a real shot before friction does, including treasure + exit in one shot.
      const treasure = this.state.treasure, exit = this.state.exit;
      if (!treasureTaken && length(ghost.x - treasure.x, ghost.y - treasure.y) < ghost.radius + TUNING.treasureRadius) treasureTaken = true;
      if (treasureTaken && length(ghost.x - exit.x, ghost.y - exit.y) < exit.radius) return finish('exit');
      settledTime = length(ghost.vx, ghost.vy) < TUNING.stopSpeed ? settledTime + dt : 0;
      if (settledTime >= 0.08 || flightTime >= TUNING.maxFlightTime) return finish('stop');
      if (i % 8 === 7 || bounced) appendPoint();
    }
    return finish('stop');
  }

  step(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    if (this.isTerminal()) return;
    this.runtime.accumulator += Math.min(dt, TUNING.maxFrameTime);
    let steps = 0;
    while (this.runtime.accumulator + EPS >= TUNING.fixedStep && steps < 32) {
      this.runtime.accumulator -= TUNING.fixedStep;
      if (this.runtime.accumulator < 1e-10) this.runtime.accumulator = 0;
      this.tick(TUNING.fixedStep); steps++;
      if (this.isTerminal()) {
        this.runtime.accumulator = 0; break;
      }
    }
  }

  nextRoom(tool?: ToolId): boolean {
    if (this.state.phase !== 'room_clear' || this.state.roomIndex + 1 >= this.rooms.length) return false;
    if (tool !== undefined && !['none', 'heavy', 'grip', 'return'].includes(tool)) return false;
    const previous = this.state;
    this.loadRoom(previous.roomIndex + 1, Math.min(previous.player.maxHp, previous.player.hp + 1),
      tool || previous.player.tool, previous.score, previous.rescuesUsed, previous.shots, previous.elapsed, previous.turn);
    return true;
  }

  /** One rescue per expedition. Caller must grant this only after a verified ad reward or explicit preview action. */
  rescue(): boolean {
    if (this.state.phase !== 'game_over' || this.state.rescuesUsed >= 1) return false;
    const start = this.rooms[this.state.roomIndex].start, p = this.state.player;
    p.x = start.x; p.y = start.y; p.vx = 0; p.vy = 0;
    p.hp = Math.min(3, p.maxHp); p.invulnerable = 1;
    p.toolReady = p.tool === 'grip' || p.tool === 'return';
    this.state.rescuesUsed++; this.state.phase = 'aiming'; this.state.projectiles = [];
    this.runtime.continuingTurn = false; this.runtime.hitEnemies = []; this.runtime.hitBoards = [];
    for (const enemy of this.state.enemies) { enemy.vx = 0; enemy.vy = 0; enemy.action = 'idle'; }
    this.resolvePlayerObstacles(false); this.planEnemies();
    this.emit('rescue', p.x, p.y, { amount: p.hp }); return true;
  }

  drainEvents(): GameEvent[] { const result = this.events; this.events = []; return result; }
  snapshot(): GameSnapshot { return { version: 1, state: copy(this.state), runtime: copy(this.runtime) }; }

  restore(snapshot: GameSnapshot): void {
    if (!snapshot || snapshot.version !== 1 || snapshot.state?.version !== 1 || !snapshot.runtime
      || !Number.isInteger(snapshot.state.roomIndex) || snapshot.state.roomIndex < 0
      || snapshot.state.roomIndex >= this.rooms.length || !snapshot.state.player
      || !Number.isFinite(snapshot.state.player.x) || !Number.isFinite(snapshot.state.player.y)
      || !Array.isArray(snapshot.state.obstacles) || !Array.isArray(snapshot.state.enemies)) {
      throw new Error('Invalid or unsupported Monster Den snapshot.');
    }
    this.state = copy(snapshot.state); this.runtime = copy(snapshot.runtime); this.events = [];
  }

  private loadRoom(index: number, hp: number, tool: ToolId, score: number, rescues: number, shots: number, elapsed: number, turn: number): void {
    const room = this.rooms[index];
    this.state = {
      version: 1, phase: 'aiming', roomIndex: index, roomCount: this.rooms.length,
      roomId: room.id, roomName: room.name, hint: room.hint, width: room.width, height: room.height,
      player: { ...room.start, vx: 0, vy: 0, radius: TUNING.playerRadius, hp, maxHp: TUNING.maxHp, tool,
        toolReady: tool === 'grip' || tool === 'return', invulnerable: 0 },
      obstacles: room.obstacles.map(o => ({ ...copy(o), hp: o.hp || 1, maxHp: o.hp || 1, destroyed: false, vx: 0, vy: 0 })),
      enemies: room.enemies.map(e => ({ ...copy(e), vx: 0, vy: 0, radius: e.radius || (e.kind === 'charger' ? 0.55 : 0.43),
        hp: e.hp || 2, maxHp: e.hp || 2, alive: true, action: 'idle', actionTime: 0, actionStarted: false, actionDone: false,
        telegraph: { x: e.x, y: e.y, dx: 0, dy: -1, range: 4, width: 0.8 } })),
      projectiles: [], treasure: { ...room.treasure, taken: false }, exit: { ...room.exit, radius: TUNING.exitRadius },
      turn, score, rescuesUsed: rescues, shots, elapsed, enemyTime: 0,
    };
    this.runtime.accumulator = 0; this.runtime.flightTime = 0; this.runtime.settledTime = 0;
    this.runtime.hitEnemies = []; this.runtime.hitBoards = []; this.runtime.continuingTurn = false;
    this.runtime.exitWarning = false; this.runtime.lastShotStart = copy(room.start);
    this.planEnemies(); this.emit('room_start', room.start.x, room.start.y, { text: room.name });
  }

  private launchSpeed(power: number): number {
    return (TUNING.launchMin + clamp(power, 0, 1) * (TUNING.launchMax - TUNING.launchMin))
      * (this.state.player.tool === 'heavy' ? 0.96 : 1);
  }
  private isTerminal(): boolean {
    return this.state.phase === 'game_over' || this.state.phase === 'victory' || this.state.phase === 'room_clear';
  }
  private playerDrag(): number { return TUNING.drag * (this.state.player.tool === 'heavy' ? 1.07 : 1); }
  private restitution(): number { return this.state.player.tool === 'heavy' ? 0.38 : TUNING.restitution; }

  private tick(dt: number): void {
    this.state.elapsed += dt;
    const p = this.state.player;
    p.invulnerable = Math.max(0, p.invulnerable - dt);
    this.moveCabinets(dt);
    if (this.state.phase === 'moving') {
      this.runtime.flightTime += dt;
      this.moveLooseEnemies(dt);
      this.movePlayer(dt, this.playerDrag());
      this.collidePlayerEnemies();
      this.checkObjectives();
      if (this.state.phase !== 'moving') return;
      const speed = length(p.vx, p.vy);
      this.runtime.settledTime = speed < TUNING.stopSpeed ? this.runtime.settledTime + dt : 0;
      if (this.runtime.settledTime >= 0.08 || this.runtime.flightTime >= TUNING.maxFlightTime) {
        p.vx = 0; p.vy = 0; this.beginEnemyPhase();
      }
    } else if (this.state.phase === 'enemies') {
      this.updateEnemies(dt);
      if (this.state.phase !== 'enemies') return;
      this.movePlayer(dt, 4.5); this.checkObjectives();
    } else if (this.state.phase === 'aiming') {
      this.moveLooseEnemies(dt); this.resolvePlayerObstacles(false);
    }
  }

  private movePlayer(dt: number, drag: number): void {
    const p = this.state.player;
    p.x += p.vx * dt; p.y += p.vy * dt;
    const speed = length(p.vx, p.vy);
    if (this.resolveBounds(p, this.restitution()) && speed > 1.2) this.emit('bounce', p.x, p.y, { amount: speed });
    this.resolvePlayerObstacles(true);
    const damp = Math.exp(-drag * dt); p.vx *= damp; p.vy *= damp;
    if (length(p.vx, p.vy) < 0.08) { p.vx = 0; p.vy = 0; }
  }

  private resolvePlayerObstacles(interactive: boolean): void {
    const p = this.state.player;
    for (let pass = 0; pass < 3; pass++) {
      let overlap = false;
      for (const o of this.state.obstacles) {
        if (o.destroyed) continue;
        const c = circleRect(p, o); if (!c) continue;
        overlap = true;
        const towards = -(p.vx * c.nx + p.vy * c.ny);
        if (interactive && this.state.phase === 'moving' && towards > 2.2 && o.kind === 'board'
          && !this.runtime.hitBoards.includes(o.id)) {
          this.runtime.hitBoards.push(o.id);
          const damage = p.tool === 'heavy' ? 2 : 1; o.hp = Math.max(0, o.hp - damage);
          this.emit('board_hit', o.x, o.y, { id: o.id, amount: damage });
          if (o.hp === 0) {
            o.destroyed = true; this.state.score += 15;
            this.emit('board_break', o.x, o.y, { id: o.id });
            p.vx *= 0.91; p.vy *= 0.91; continue;
          }
        }
        if (interactive && o.kind === 'cabinet' && o.rail && towards > 0.7) {
          const axis = o.rail.axis, alignment = axis === 'x' ? Math.abs(c.nx) : Math.abs(c.ny);
          if (alignment > 0.48) {
            const incoming = axis === 'x' ? p.vx : p.vy;
            const canMove = incoming > 0 ? o[axis] < o.rail.max - 0.005 : o[axis] > o.rail.min + 0.005;
            if (canMove) {
              const old = axis === 'x' ? o.vx : o.vy;
              const impulse = incoming * (p.tool === 'heavy' ? 1.05 : 0.67);
              const velocity = clamp(old + impulse, -TUNING.cabinetMaxSpeed, TUNING.cabinetMaxSpeed);
              if (axis === 'x') o.vx = velocity; else o.vy = velocity;
              if (Math.abs(old) < 0.45) this.emit('cabinet_push', o.x, o.y, { id: o.id, amount: Math.abs(velocity) });
              this.resolveContact(p, c, 0.08); continue;
            }
          }
        }
        this.resolveContact(p, c, this.restitution());
        if (towards > 1.2) this.emit('bounce', p.x, p.y, { id: o.id, amount: towards });
      }
      if (!overlap) break;
    }
    this.resolveBounds(p, this.restitution());
  }

  private moveCabinets(dt: number): void {
    for (const c of this.state.obstacles) {
      if (c.kind !== 'cabinet' || !c.rail || c.destroyed) continue;
      const axis = c.rail.axis, old = c[axis], velocity = axis === 'x' ? c.vx : c.vy;
      if (Math.abs(velocity) < 0.035) { c.vx = 0; c.vy = 0; continue; }
      c[axis] = clamp(old + velocity * dt, c.rail.min, c.rail.max);
      const half = axis === 'x' ? c.w / 2 : c.h / 2;
      const cross = axis === 'x' ? 'y' : 'x';
      const crossHalf = axis === 'x' ? c.h / 2 : c.w / 2;
      for (const other of this.state.obstacles) {
        if (other === c || other.destroyed) continue;
        const otherHalf = axis === 'x' ? other.w / 2 : other.h / 2;
        const otherCrossHalf = axis === 'x' ? other.h / 2 : other.w / 2;
        if (Math.abs(c[cross] - other[cross]) >= crossHalf + otherCrossHalf - EPS) continue;
        if (Math.abs(c[axis] - other[axis]) < half + otherHalf) {
          c[axis] = velocity > 0 ? other[axis] - half - otherHalf : other[axis] + half + otherHalf;
          c[axis] = clamp(c[axis], c.rail.min, c.rail.max);
        }
      }
      const blocked = Math.abs(c[axis] - (old + velocity * dt)) > 0.0001;
      if (blocked) {
        c.vx = 0; c.vy = 0;
        if (Math.abs(velocity) > 0.5) this.emit('cabinet_stop', c.x, c.y, { id: c.id });
      } else {
        const v = velocity * Math.exp(-TUNING.cabinetDrag * dt);
        c.vx = axis === 'x' ? v : 0; c.vy = axis === 'y' ? v : 0;
      }
    }
  }

  private moveLooseEnemies(dt: number): void {
    for (const e of this.state.enemies) {
      if (!e.alive) continue;
      e.x += e.vx * dt; e.y += e.vy * dt;
      this.resolveEnemyObstacles(e);
      const damp = Math.exp(-4 * dt); e.vx *= damp; e.vy *= damp;
      if (length(e.vx, e.vy) < 0.04) { e.vx = 0; e.vy = 0; }
    }
  }

  private collidePlayerEnemies(): void {
    const p = this.state.player;
    for (const e of this.state.enemies) {
      if (!e.alive) continue;
      const dx = p.x - e.x, dy = p.y - e.y, dist = length(dx, dy), sum = p.radius + e.radius;
      if (dist >= sum) continue;
      const n = dist > EPS ? { x: dx / dist, y: dy / dist } : normal(-p.vx, -p.vy);
      const impact = Math.max(0, -(p.vx * n.x + p.vy * n.y));
      if (impact > 1.8 && !this.runtime.hitEnemies.includes(e.id)) {
        this.runtime.hitEnemies.push(e.id);
        const damage = p.tool === 'heavy' ? 2 : 1;
        e.hp = Math.max(0, e.hp - damage);
        const knock = e.kind === 'boss' ? 0.22 : 0.72;
        e.vx += p.vx * knock; e.vy += p.vy * knock;
        this.emit('enemy_hit', e.x, e.y, { id: e.id, amount: damage });
        if (e.hp === 0) {
          e.alive = false; e.vx = 0; e.vy = 0;
          this.state.score += e.kind === 'boss' ? 250 : 35;
          this.emit('enemy_down', e.x, e.y, { id: e.id });
          p.vx *= 0.85; p.vy *= 0.85; continue;
        }
      }
      p.x += n.x * (sum - dist + 0.001); p.y += n.y * (sum - dist + 0.001);
      const dot = p.vx * n.x + p.vy * n.y;
      if (dot < 0) { p.vx -= 1.48 * dot * n.x; p.vy -= 1.48 * dot * n.y; }
      this.resolvePlayerObstacles(false);
    }
  }

  private planEnemies(): void {
    const p = this.state.player;
    for (const e of this.state.enemies) {
      if (!e.alive) continue;
      const target = e.fixedAim || p, d = normal(target.x - e.x, target.y - e.y);
      const distance = length(target.x - e.x, target.y - e.y);
      const range = e.kind === 'archer' ? 13 : e.kind === 'guard' ? Math.min(2.5, distance + 0.3)
        : e.kind === 'boss' ? Math.min(7.2, distance + 1.1) : Math.min(6.4, distance + 0.7);
      e.telegraph = { x: e.x, y: e.y, dx: d.x, dy: d.y, range, width: e.radius * 2 };
      e.action = 'idle'; e.actionTime = 0; e.actionStarted = false; e.actionDone = false;
    }
  }

  private beginEnemyPhase(): void {
    this.state.phase = 'enemies'; this.state.enemyTime = 0;
    this.state.player.toolReady = false;
    for (const e of this.state.enemies) {
      e.vx = 0; e.vy = 0;
      if (!e.alive) continue;
      e.action = 'windup'; e.actionTime = 0; e.actionStarted = false; e.actionDone = false;
      // A knocked-back enemy retains its advertised direction, but starts at its actual location.
      e.telegraph.x = e.x; e.telegraph.y = e.y;
      this.emit('enemy_windup', e.x, e.y, { id: e.id });
    }
  }

  private updateEnemies(dt: number): void {
    this.state.enemyTime += dt;
    const p = this.state.player;
    let index = 0;
    for (const e of this.state.enemies) {
      if (!e.alive) continue;
      const startTime = TUNING.enemyWindup + index++ * 0.085;
      if (!e.actionStarted && this.state.enemyTime >= startTime) {
        e.actionStarted = true; e.action = 'attacking'; e.actionTime = 0;
        this.emit('enemy_attack', e.x, e.y, { id: e.id });
        if (e.kind === 'archer') {
          const d = e.telegraph;
          this.state.projectiles.push({ id: `arrow-${this.runtime.nextProjectileId++}`, ownerId: e.id,
            x: e.x + d.dx * (e.radius + 0.12), y: e.y + d.dy * (e.radius + 0.12),
            vx: d.dx * TUNING.arrowSpeed, vy: d.dy * TUNING.arrowSpeed, radius: 0.085, life: 1.6, damage: 1 });
          this.emit('arrow', e.x, e.y, { id: e.id });
        } else {
          const speed = e.kind === 'guard' ? 4.3 : e.kind === 'boss' ? 9.5 : 11;
          e.vx = e.telegraph.dx * speed; e.vy = e.telegraph.dy * speed;
        }
      }
      if (!e.actionStarted || e.actionDone) continue;
      e.actionTime += dt;
      if (e.kind === 'archer') {
        if (e.actionTime > 0.16) { e.actionDone = true; e.action = 'recover'; }
        continue;
      }
      const speed = e.kind === 'guard' ? 4.3 : e.kind === 'boss' ? 9.5 : 11;
      e.x += e.vx * dt; e.y += e.vy * dt;
      const blocked = this.resolveEnemyObstacles(e);
      const dx = p.x - e.x, dy = p.y - e.y;
      if (length(dx, dy) < p.radius + e.radius + 0.025) {
        const away = normal(dx, dy);
        this.damagePlayer(e.kind === 'boss' ? 2 : 1, e.id, away.x * 5.2, away.y * 5.2);
        if (this.state.phase !== 'enemies') return;
        e.actionDone = true;
      }
      if (blocked || e.actionTime >= e.telegraph.range / speed || e.actionDone) {
        e.vx = 0; e.vy = 0; e.actionDone = true; e.action = 'recover';
      }
    }
    this.updateProjectiles(dt);
    if (this.state.phase !== 'enemies') return;
    const done = this.state.enemies.every(e => !e.alive || e.actionDone);
    if (done && this.state.projectiles.length === 0 && this.state.enemyTime >= TUNING.enemyWindup + 0.1
      && length(p.vx, p.vy) < 0.3 && this.cabinetsSettled()) {
      p.vx = 0; p.vy = 0; this.state.phase = 'aiming';
      for (const obstacle of this.state.obstacles) {
        if (obstacle.kind === 'cabinet') { obstacle.vx = 0; obstacle.vy = 0; }
      }
      p.toolReady = p.tool === 'grip' || p.tool === 'return';
      this.runtime.continuingTurn = false; this.planEnemies();
    }
  }

  private updateProjectiles(dt: number): void {
    const remaining = [];
    for (const arrow of this.state.projectiles) {
      const start = { x: arrow.x, y: arrow.y };
      const end = { x: arrow.x + arrow.vx * dt, y: arrow.y + arrow.vy * dt };
      let firstT = Infinity, firstObstacle: ObstacleState | undefined;
      for (const o of this.state.obstacles) {
        if (o.destroyed) continue;
        const t = segmentRectT(start, end, o, arrow.radius);
        if (t < firstT) { firstT = t; firstObstacle = o; }
      }
      const playerT = segmentCircleT(start, end, this.state.player, this.state.player.radius + arrow.radius);
      if (playerT < firstT && playerT <= 1) {
        const d = normal(arrow.vx, arrow.vy);
        this.damagePlayer(arrow.damage, arrow.ownerId, d.x * 3.2, d.y * 3.2);
        if (this.state.phase === 'game_over') return;
        continue;
      }
      if (firstObstacle && firstT <= 1) {
        this.emit('arrow_blocked', start.x + (end.x - start.x) * firstT, start.y + (end.y - start.y) * firstT,
          { id: arrow.id, obstacleId: firstObstacle.id, text: firstObstacle.kind });
        continue;
      }
      arrow.x = end.x; arrow.y = end.y; arrow.life -= dt;
      if (arrow.life > 0 && Math.abs(arrow.x) < this.state.width / 2 + 0.2 && Math.abs(arrow.y) < this.state.height / 2 + 0.2) remaining.push(arrow);
    }
    this.state.projectiles = remaining;
  }

  private damagePlayer(amount: number, id: string, knockX: number, knockY: number): void {
    const p = this.state.player;
    if (p.invulnerable > 0 || p.hp <= 0) return;
    p.hp = Math.max(0, p.hp - amount); p.invulnerable = TUNING.invulnerableTime;
    p.vx += knockX; p.vy += knockY;
    this.emit('damage', p.x, p.y, { id, amount });
    if (p.hp === 0) {
      p.vx = 0; p.vy = 0; this.state.phase = 'game_over'; this.state.projectiles = [];
      this.emit('game_over', p.x, p.y);
    }
  }

  private checkObjectives(): void {
    if (this.state.phase === 'game_over') return;
    const p = this.state.player, treasure = this.state.treasure, exit = this.state.exit;
    if (!treasure.taken && length(p.x - treasure.x, p.y - treasure.y) < p.radius + TUNING.treasureRadius) {
      treasure.taken = true; this.state.score += 100;
      this.emit('treasure', treasure.x, treasure.y, { amount: 100 });
    }
    const atExit = length(p.x - exit.x, p.y - exit.y) < exit.radius;
    if (atExit && treasure.taken) {
      p.vx = 0; p.vy = 0; this.state.projectiles = []; this.state.score += 50;
      if (this.state.roomIndex === this.rooms.length - 1) {
        this.state.phase = 'victory'; this.state.score += 250;
        this.emit('victory', exit.x, exit.y, { amount: this.state.score });
      } else {
        this.state.phase = 'room_clear'; this.emit('room_clear', exit.x, exit.y, { amount: 50 });
      }
    } else if (atExit && !this.runtime.exitWarning) {
      this.runtime.exitWarning = true; this.emit('exit_locked', exit.x, exit.y, { text: '先拿到宝物' });
    } else if (!atExit) this.runtime.exitWarning = false;
  }

  private cabinetsSettled(): boolean {
    return this.state.obstacles.every(o => o.kind !== 'cabinet' || length(o.vx, o.vy) < 0.12);
  }

  private resolveEnemyObstacles(e: EnemyState): boolean {
    let blocked = this.resolveBounds(e, 0);
    for (let pass = 0; pass < 2; pass++) {
      for (const o of this.state.obstacles) {
        if (o.destroyed) continue;
        const c = circleRect(e, o);
        if (c) { this.resolveContact(e, c, 0); blocked = true; }
      }
    }
    return blocked;
  }

  private resolveContact(body: Body, c: Contact, restitution: number): void {
    body.x += c.nx * (c.depth + 0.0005); body.y += c.ny * (c.depth + 0.0005);
    const dot = body.vx * c.nx + body.vy * c.ny;
    if (dot < 0) { body.vx -= (1 + restitution) * dot * c.nx; body.vy -= (1 + restitution) * dot * c.ny; }
  }

  private resolveBounds(body: Body, restitution: number): boolean {
    let hit = false;
    const xBound = this.state.width / 2 - body.radius, yBound = this.state.height / 2 - body.radius;
    if (body.x < -xBound) { body.x = -xBound; if (body.vx < 0) body.vx *= -restitution; hit = true; }
    if (body.x > xBound) { body.x = xBound; if (body.vx > 0) body.vx *= -restitution; hit = true; }
    if (body.y < -yBound) { body.y = -yBound; if (body.vy < 0) body.vy *= -restitution; hit = true; }
    if (body.y > yBound) { body.y = yBound; if (body.vy > 0) body.vy *= -restitution; hit = true; }
    return hit;
  }

  private emit(type: GameEventType, x: number, y: number, extra: Partial<GameEvent> = {}): void {
    this.events.push({ type, x, y, ...extra });
    if (this.events.length > 256) this.events.splice(0, this.events.length - 256);
  }
}
