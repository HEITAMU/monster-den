/** Renderer-independent game contract. Coordinates are metres; +y is room north. */
export type ToolId = 'none' | 'heavy' | 'grip' | 'return';
export type Phase = 'aiming' | 'moving' | 'enemies' | 'room_clear' | 'game_over' | 'victory';
export type EnemyKind = 'guard' | 'archer' | 'charger' | 'boss';
export type ObstacleKind = 'wall' | 'pillar' | 'board' | 'cabinet';
export interface Vec2 { x: number; y: number; }
export interface Body extends Vec2 { vx: number; vy: number; radius: number; }
export interface PlayerState extends Body {
  hp: number; maxHp: number; tool: ToolId; toolReady: boolean; invulnerable: number;
}
export interface Rail { axis: 'x' | 'y'; min: number; max: number; }
export interface ObstacleConfig extends Vec2 {
  id: string; kind: ObstacleKind; w: number; h: number; hp?: number; rail?: Rail;
}
export interface ObstacleState extends ObstacleConfig {
  hp: number; maxHp: number; destroyed: boolean; vx: number; vy: number;
}
export interface Telegraph extends Vec2 { dx: number; dy: number; range: number; width: number; }
export interface EnemyConfig extends Vec2 {
  id: string; kind: EnemyKind; hp?: number; radius?: number; fixedAim?: Vec2;
}
export interface EnemyState extends Body {
  id: string; kind: EnemyKind; hp: number; maxHp: number; alive: boolean;
  fixedAim?: Vec2; telegraph: Telegraph;
  action: 'idle' | 'windup' | 'attacking' | 'recover';
  actionTime: number; actionStarted: boolean; actionDone: boolean;
}
export interface ProjectileState extends Body { id: string; ownerId: string; life: number; damage: number; }
export interface RoomConfig {
  id: string; name: string; hint: string; width: number; height: number;
  start: Vec2; treasure: Vec2; exit: Vec2;
  obstacles: ObstacleConfig[]; enemies: EnemyConfig[];
}
export interface GameState {
  version: 1; phase: Phase; roomIndex: number; roomCount: number;
  roomId: string; roomName: string; hint: string; width: number; height: number;
  player: PlayerState; obstacles: ObstacleState[]; enemies: EnemyState[];
  projectiles: ProjectileState[]; treasure: Vec2 & { taken: boolean };
  exit: Vec2 & { radius: number }; turn: number; score: number; rescuesUsed: number;
  shots: number; elapsed: number; enemyTime: number;
}
export type GameEventType =
  | 'room_start' | 'shot' | 'bounce' | 'board_hit' | 'board_break' | 'cabinet_push'
  | 'cabinet_stop' | 'enemy_hit' | 'enemy_down' | 'enemy_windup' | 'enemy_attack'
  | 'arrow' | 'arrow_blocked' | 'damage' | 'treasure' | 'exit_locked'
  | 'room_clear' | 'victory' | 'game_over' | 'tool_used' | 'rescue';
export interface GameEvent {
  type: GameEventType; x: number; y: number; id?: string; amount?: number;
  tool?: ToolId; obstacleId?: string; text?: string;
}
export interface AimPreview {
  points: Vec2[]; direction: Vec2; power: number; blocked: boolean;
  /** Only `stop` is a landing point; interactions deliberately end the prediction. */
  endpoint: 'none' | 'stop' | 'interaction' | 'exit';
  targetId?: string;
}
export interface RuntimeState {
  accumulator: number; flightTime: number; settledTime: number;
  lastShotStart: Vec2; hitEnemies: string[]; hitBoards: string[];
  continuingTurn: boolean; nextProjectileId: number; exitWarning: boolean;
}
export interface GameSnapshot { version: 1; state: GameState; runtime: RuntimeState; }
