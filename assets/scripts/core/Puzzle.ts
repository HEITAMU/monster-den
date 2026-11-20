import { BANK } from './Catalog';
export type Board = number[];
export type Mode = 'daily'|'campaign';
export interface Level { board: Board; optimum: number; id: string; }
const SQUARES: number[][] = [[0,1,4,3],[1,2,5,4],[3,4,7,6],[4,5,8,7]];
export const GOAL = [1,2,3,4,5,6,7,8,9];
export function rotate(board: ReadonlyArray<number>, rotor: number, dir: number): Board {
  if (!Number.isInteger(rotor) || rotor < 0 || rotor > 3 || (dir !== 1 && dir !== -1)) throw Error('Bad rotor');
  const r=board.slice(); const sq=SQUARES[rotor];
  for (let k=0;k<4;k++) r[sq[(k+dir+4)%4]]=board[sq[k]];
  return r;
}
export function applyMove(board: ReadonlyArray<number>, move:number): Board {
  if(!Number.isInteger(move)||move<0||move>7)throw Error('Bad move');
  return rotate(board, Math.floor(move/2), move%2===0?1:-1);
}
export function solved(board:ReadonlyArray<number>):boolean {return board.length===9 && board.every((v,i)=>v===i+1);}
export function decode(s:string):Board {if (!/^[1-9]{9}$/.test(s)||new Set(s).size!==9)throw Error('Bad board');return s.split('').map(Number);}
export function encode(b:ReadonlyArray<number>):string {return b.join('');}
function hash(s:string):number {let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0;}
export function todayKey(now=Date.now()):string {return new Date(now+8*3600000).toISOString().substring(0,10).replace(/-/g,'');}
export function levelFor(mode:Mode,day:string,n:number):Level {
  if(!Number.isInteger(n)||n<0)throw Error('Bad level number');
  const depth=mode==='daily'?[5,7,9][n]:Math.max(3,Math.min(10,2+Math.floor((n+4)/8)));
  if(!depth)throw Error('Bad daily stage');
  const pool=BANK[depth];const salt=mode==='daily'?`crown-v1:${day}:${n}`:`campaign:${n}`;
  return {board:decode(pool[hash(salt)%pool.length]),optimum:depth,id:salt};
}
// Bidirectional BFS. The nine-tile rotation graph has a finite 9! = 362,880 states.
// At most 11 moves from any legal position; returns a shortest sequence.
export function shortestSolution(start:ReadonlyArray<number>):number[] {
  const first=encode(start),last='123456789';if(first===last)return [];
  type Link={parent:string|null; move:number};
  const a=new Map<string,Link>([[first,{parent:null,move:-1}]]),b=new Map<string,Link>([[last,{parent:null,move:-1}]]);
  let fa=[first],fb=[last],meet:string|null=null;
  // Expand balanced full BFS layers; stop after first intersection.
  function advance(front:string[],own:Map<string,Link>,other:Map<string,Link>):string[] {
    const next:string[]=[];
    for(const key of front){
      const cur=decode(key);
      for(let move=0;move<8;move++){
        const out=encode(applyMove(cur,move));if(own.has(out))continue;
        own.set(out,{parent:key,move});
        if(other.has(out)){meet=out;return next;}
        next.push(out);
      }
    }
    return next;
  }
  for(let i=0;i<14&&fa.length&&fb.length&&meet===null;i++){
    if(fa.length<=fb.length)fa=advance(fa,a,b);else fb=advance(fb,b,a);
  }
  if(meet===null)throw Error('No solution');
  const fromStart:number[]=[],toGoal:number[]=[];let key=meet as string;
  while(a.get(key)!.parent!==null){const l=a.get(key)!;fromStart.push(l.move);key=l.parent!;}
  fromStart.reverse();key=meet as string;
  while(b.get(key)!.parent!==null){const l=b.get(key)!;toGoal.push(l.move^1);key=l.parent!;}
  return fromStart.concat(toGoal);
}
