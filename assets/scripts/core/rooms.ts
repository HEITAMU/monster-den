import type { RoomConfig, ToolId } from './types';

export const TUNING = {
  fixedStep: 1 / 120, maxFrameTime: 0.25, playerRadius: 0.38, maxHp: 5,
  launchMin: 0.55, launchMax: 12.8, drag: 1.36, stopSpeed: 0.24,
  cabinetDrag: 2.7, cabinetMaxSpeed: 8.5, restitution: 0.70,
  enemyWindup: 0.34, arrowSpeed: 15, invulnerableTime: 0.85,
  treasureRadius: 0.48, exitRadius: 0.8, maxFlightTime: 5.5,
  sporeBlast: 2.22, sporeChain: 3.05, sporeFuse: 0.12, sporeScore: 10,
};

/** Shared design-unit radii. Remap travel after the dead zone to the full 0..1 power range. */
export const JOYSTICK_TUNING = { deadZone: 7, travel: 75 };

/** Playback pacing only; collision steps, shot distances and interaction forces stay unchanged. */
export const ACTION_PACING = {
  flight: 1.5, tail: 3, tailBelowSpeed: 2.8, enemies: 1.5,
  // Keep the opening of grip/return shots at normal speed for a deliberate tool tap.
  toolWindow: 0.45,
};

export const TOOLS: { id: ToolId; name: string; description: string; actionLabel: string }[] = [
  { id: 'heavy', name: '重撞拳套', description: '冲撞更强，一击破厚木栏；柜子推得更远，反弹较弱。', actionLabel: '重撞已装配' },
  { id: 'grip', name: '壁虎手套', description: '冲撞中抓停一次，原地重新瞄准；守卫暂不行动。', actionLabel: '抓停重瞄' },
  { id: 'return', name: '回旋腕带', description: '冲撞中朝本次起点折返一次，可借返程取物。', actionLabel: '回旋折返' },
];

/** Authored first expedition. None of the exits requires defeating every enemy. */
export const ROOMS: RoomConfig[] = [
  {
    id: 'moss-court', name: '苔门前院', hint: '撞木栏过门，也可以试试左侧发光菌核。',
    width: 10, height: 14, start: { x: 0, y: -5.5 }, treasure: { x: 0, y: 1.6 }, exit: { x: 0, y: 5.6 },
    // Optional alternate solution: touch the leftmost bud to ignite the full fungal lattice.
    // Buds avoid the straight central launch lane so the original direct route remains valid.
    spores: [
      {id:'heart-root',x:-3.2,y:-3.0,radius:0.52},
      {id:'heart-bridge',x:-2.7,y:-1.05,radius:0.52},
      {id:'heart-latch',x:-1.45,y:-0.85,radius:0.52},
      {id:'heart-bloom',x:-1.6,y:1.35,radius:0.52},
      {id:'heart-guard',x:1.05,y:2.75,radius:0.52},
    ],
    obstacles: [
      { id: 'welcome-board', kind: 'board', x: 0, y: -1.2, w: 2.1, h: 0.28, hp: 1 },
      { id: 'west-stump', kind: 'pillar', x: -3.1, y: 1.2, w: 1.1, h: 1.4 },
      { id: 'east-stump', kind: 'pillar', x: 3.1, y: 1.2, w: 1.1, h: 1.4 },
    ],
    enemies: [{ id: 'court-guard', kind: 'guard', x: 2.5, y: 3.7, hp: 2 }],
  },
  {
    id: 'arrow-store', name: '箭廊货仓', hint: '把柜子沿轨道推上去，它会一直留在那里挡箭。',
    width: 10, height: 14, start: { x: 0, y: -5.6 }, treasure: { x: 0, y: 4.2 }, exit: { x: 2.9, y: 5.7 },
    stashes: [{ id: 'store-side-stash', x: -3.85, y: -0.4, value: 80 }],
    obstacles: [
      { id: 'arrow-cabinet', kind: 'cabinet', x: 0, y: -3, w: 1.7, h: 1.6, rail: { axis: 'y', min: -3, max: 0.2 } },
      { id: 'store-west-wall', kind: 'wall', x: -3.5, y: 1.2, w: 3, h: 0.5 },
      { id: 'store-east-wall', kind: 'wall', x: 3.5, y: 1.2, w: 3, h: 0.5 },
      { id: 'store-pillar', kind: 'pillar', x: -3.1, y: 4, w: 1.1, h: 1.1 },
    ],
    enemies: [
      { id: 'store-archer', kind: 'archer', x: 4.1, y: -0.4, hp: 2, fixedAim: { x: -4.5, y: -0.4 } },
      { id: 'store-guard', kind: 'guard', x: -3.5, y: 3, hp: 2 },
    ],
  },
  {
    id: 'broken-garden', name: '断桥菌庭', hint: '厚木板要撞两次。重撞拳套可以直接撞穿。',
    width: 10, height: 14, start: { x: -3, y: -5.5 }, treasure: { x: 3, y: 3.6 }, exit: { x: 3, y: 5.8 },
    obstacles: [
      { id: 'garden-west-wall', kind: 'wall', x: -3.15, y: -0.1, w: 3.7, h: 0.45 },
      { id: 'garden-east-wall', kind: 'wall', x: 3.15, y: -0.1, w: 3.7, h: 0.45 },
      { id: 'thick-board', kind: 'board', x: 0, y: -0.1, w: 2.5, h: 0.45, hp: 2 },
      { id: 'garden-pillar', kind: 'pillar', x: -2.5, y: 2.4, w: 1.3, h: 1.3 },
    ],
    enemies: [
      { id: 'garden-charger', kind: 'charger', x: -2.7, y: 4.5, hp: 3 },
      { id: 'garden-archer', kind: 'archer', x: 4, y: -2.6, hp: 2, fixedAim: { x: -4.5, y: -2.6 } },
    ],
  },
  {
    id: 'echo-vault', name: '回声宝库', hint: '宝物在右上角，出口在左边。拿到后可以直接溜走。',
    width: 10, height: 14, start: { x: 0, y: -5.7 }, treasure: { x: 3.6, y: 4.5 }, exit: { x: -3.5, y: 5.7 },
    stashes: [{ id: 'vault-side-stash', x: -2.35, y: 0.5, value: 120 }],
    obstacles: [
      { id: 'vault-pillar', kind: 'pillar', x: 0, y: -1.7, w: 2, h: 1.8 },
      { id: 'vault-screen', kind: 'wall', x: 0.5, y: 2.1, w: 5.5, h: 0.45 },
      { id: 'vault-cabinet', kind: 'cabinet', x: -2.6, y: 3.8, w: 1.3, h: 1.4, rail: { axis: 'x', min: -3.5, max: 1.8 } },
    ],
    enemies: [
      { id: 'vault-archer', kind: 'archer', x: -4.1, y: 0.5, hp: 2, fixedAim: { x: 4.5, y: 0.5 } },
      { id: 'vault-guard', kind: 'guard', x: 3.5, y: -0.2, hp: 2 },
    ],
  },
  {
    id: 'den-heart', name: '窝主巢心', hint: '窝主会沿预告方向冲撞。带走它身后的宝物，冲向出口。',
    width: 10, height: 14, start: { x: 0, y: -5.7 }, treasure: { x: 0, y: 3.8 }, exit: { x: 0, y: 5.9 },
    obstacles: [
      { id: 'boss-west-pillar', kind: 'pillar', x: -2.5, y: -0.8, w: 1.2, h: 1.7 },
      { id: 'boss-east-pillar', kind: 'pillar', x: 2.5, y: -0.8, w: 1.2, h: 1.7 },
      { id: 'boss-cabinet', kind: 'cabinet', x: 0, y: -2.5, w: 1.6, h: 1, rail: { axis: 'x', min: -3.7, max: 3.7 } },
    ],
    enemies: [
      { id: 'den-boss', kind: 'boss', x: 0, y: 0.5, hp: 7, radius: 0.85 },
      { id: 'boss-archer', kind: 'archer', x: -4, y: 4.8, hp: 2 },
    ],
  },
];
