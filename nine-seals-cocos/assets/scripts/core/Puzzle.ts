import { BANK } from './Catalog';

export type Board = number[];
export interface Level { board: Board; optimum: number; key: string; }
export interface Move { rotor: number; dir: 1 | -1; }
const SQUARES = [[0,1,4,3],[1,2,5,4],[3,4,7,6],[4,5,8,7]];
export const GOAL: readonly number[] = Object.freeze([1,2,3,4,5,6,7,8,9]);

export function rotate(board: ReadonlyArray<number>, rotor: number, dir: number): Board {
  if (!Number.isInteger(rotor) || rotor < 0 || rotor >= 4 || (dir !== 1 && dir !== -1)) throw new Error('Invalid rotor');
  const result = board.slice();
  const sq = SQUARES[rotor];
  for (let k = 0; k < 4; ++k) result[sq[(k + dir + 4) % 4]] = board[sq[k]];
  return result;
}
export function solved(board: ReadonlyArray<number>): boolean {
  return board.length === 9 && board.every((x, i) => x === i + 1);
}
export function encode(board: ReadonlyArray<number>): string { return board.join(''); }
export function decode(encoded: string): Board {
  if (!/^[1-9]{9}$/.test(encoded) || new Set(encoded).size !== 9) throw new Error('Invalid board');
  return encoded.split('').map(Number);
}
export function invertMove(m: number): number { return m ^ 1; }
export function applyMove(board: ReadonlyArray<number>, m: number): Board { return rotate(board, Math.floor(m / 2), m % 2 === 0 ? 1 : -1); }
export function dateKey(now: number = Date.now()): string {
  return new Date(now + 8 * 3600000).toISOString().slice(0,10).replace(/-/g, ''); // Beijing day
}
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; ++i) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function dailyLevel(day: string, stage: number): Level {
  if (!/^20\d{6}$/.test(day) || stage < 0 || stage > 2) throw new Error('Invalid challenge');
  const optimum = [5,7,9][stage];
  const pool = BANK[optimum];
  const i = hashString('crown-v1:' + day + ':' + stage) % pool.length;
  return { board: decode(pool[i]), optimum, key: 'D' + day + ':' + stage };
}
export function campaignLevel(num: number): Level {
  if (!Number.isInteger(num) || num < 1) throw new Error('Invalid chapter');
  const optimum = Math.min(10, 2 + Math.floor((num + 3) / 8));
  const depth = Math.max(3, optimum);
  const pool = BANK[depth];
  const i = hashString('campaign:' + num) % pool.length;
  return { board: decode(pool[i]), optimum: depth, key: 'C' + num };
}

// Bidirectional breadth-first search. Complete for the 3x3 rotation graph (9! states),
// so the first move returned is on a truly shortest solution from any legal position.
export function shortestSolution(start: ReadonlyArray<number>): number[] {
  const startKey = encode(start), goal = '123456789';
  if (startKey === goal) return [];
  type Link = { parent: string | null; move: number };
  const a = new Map<string, Link>([[startKey, { parent: null, move: -1 }]]);
  const b = new Map<string, Link>([[goal, { parent: null, move: -1 }]]);
  let frontierA = [startKey], frontierB = [goal];
  let meet: string | null = null;
  function advance(frontier: string[], self: Map<string, Link>, other: Map<string, Link>): string[] {
    const next: string[] = [];
    for (const current of frontier) {
      const board = decode(current);
      for (let m = 0; m < 8; ++m) {
        const child = encode(applyMove(board, m));
        if (self.has(child)) continue;
        self.set(child, { parent: current, move: m });
        if (other.has(child)) { meet = child; return next; }
        next.push(child);
      }
    }
    return next;
  }
  for (let layer = 0; layer < 14 && frontierA.length && frontierB.length && meet === null; ++layer) {
    if (frontierA.length <= frontierB.length) frontierA = advance(frontierA, a, b);
    else frontierB = advance(frontierB, b, a);
  }
  if (meet === null) throw new Error('Unsolvable board');
  const head: number[] = [], tail: number[] = [];
  let at = meet as string;
  while (a.get(at)!.parent !== null) { const link = a.get(at)!; head.push(link.move); at = link.parent!; }
  head.reverse(); at = meet as string;
  while (b.get(at)!.parent !== null) { const link = b.get(at)!; tail.push(invertMove(link.move)); at = link.parent!; }
  return head.concat(tail);
}
