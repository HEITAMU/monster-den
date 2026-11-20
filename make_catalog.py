from collections import defaultdict,deque
from pathlib import Path
import json,random
ROOT=Path(__file__).resolve().parent
SQUARES=((0,1,4,3),(1,2,5,4),(3,4,7,6),(4,5,8,7))
def rotate(p,move):
    sq=SQUARES[move//2];direction=1 if move%2==0 else -1
    out=list(p)
    for i,old in enumerate(sq):out[sq[(i+direction)%4]]=p[old]
    return ''.join(out)
queue=deque(['123456789']);dist={'123456789':0};groups=defaultdict(list)
while queue:
    state=queue.popleft();d=dist[state];groups[d].append(state)
    for move in range(8):
        t=rotate(state,move)
        if t not in dist:dist[t]=d+1;queue.append(t)
assert len(dist)==362880
rng=random.Random(19311123)
# 56 options per depth, all verified optimal by exhaustive BFS; 5..10 levels
bank={d:rng.sample(groups[d],min(48,len(groups[d]))) for d in range(3,11)}
(ROOT/'assets/scripts/core/Catalog.ts').write_text('// Exact minimum move lengths verified by full 9! state BFS; generated with make_catalog.py.\nexport const BANK: Record<number, readonly string[]> = '+json.dumps(bank,separators=(',',':'))+';\n')
(ROOT/'preview/catalog.js').write_text('window.CROWN_BANK='+json.dumps(bank,separators=(',',':'))+';\n')
(ROOT/'tests/catalog.json').write_text(json.dumps(bank,separators=(',',':')))
print('reachable',len(dist),'deepest',max(dist.values()),'verified puzzles',sum(map(len,bank.values())))
