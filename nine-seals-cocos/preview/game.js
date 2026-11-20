/* Lightweight browser build for fast UX testing. Same curated boards and rotation rules
 * as assets/scripts/core/Puzzle.ts; WeChat-only features deliberately not simulated. */
(()=>{'use strict';
const $=document.getElementById('app');
const SQUARES=[[0,1,4,3],[1,2,5,4],[3,4,7,6],[4,5,8,7]];
const bank=window.CROWN_PUZZLES;
let page='home',stage=0,mode='daily',chapter=1,day=today(),board=[],initial=[],opt=0,turns=0,
    reverse=false,assisted=false,assistedDaily=false,hint=-1,start=0,elapsed=0,totalExtra=0,totalMs=0,perfect=0;
const saveKey='crown-browser-v1';let save={chapter:1,daily:{}};
try{const x=JSON.parse(localStorage.getItem(saveKey));if(x&&x.chapter&&x.daily)save=x;}catch(_){}
function today(){return new Date(Date.now()+28800000).toISOString().slice(0,10).replace(/-/g,'')}
const params=new URLSearchParams(location.search);const incoming=params.get('day');if(/^20\d{6}$/.test(incoming||''))day=incoming;
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function level(kind,num){const depth=kind==='daily'?[5,7,9][num]:Math.max(3,Math.min(10,2+Math.floor((num+3)/8)));
 const b=bank[depth];return {board:b[hash(kind==='daily'?'crown-v1:'+day+':'+num:'campaign:'+num)%b.length],opt:depth}}
function rotate(arr,r,d){const a=arr.slice(),sq=SQUARES[r];for(let k=0;k<4;k++)a[sq[(k+d+4)%4]]=arr[sq[k]];return a}
function solved(a){return a.join('')==='123456789'}
function fromString(s){return s.split('').map(Number)}
function fmt(ms){return (ms/1000).toFixed(1)+'s'}
function elapsedMs(){return elapsed+(page==='play'?performance.now()-start:0)}
function store(){try{localStorage.setItem(saveKey,JSON.stringify(save))}catch(_){}}
function el(html){$.innerHTML='<div class="app"><main class="screen">'+html+'</main></div>'}
function btn(s,cls,id){return `<button class="btn ${cls||''}" data-act="${id}">${s}</button>`}
function baseHead(sub=''){return `<header class="head"><div class="eyebrow">THE NINE SEALS</div><div class="title">九 印 王 座</div><div class="subtitle">${sub}</div></header><div class="divider"></div>`}
function home(){page='home';el(baseHead('会解算入场 · 赢得漂亮才有资格封王')+
 `<div class="hero"><div class="seal"><strong>♛</strong></div></div><div class="intro">四个旋钮，九枚秘印。<br>今天，你能以最少步数解开三重密令吗？</div>
 <section class="panel"><h2>今 日 密 令</h2><small>${day.slice(0,4)} / ${day.slice(4,6)} / ${day.slice(6)}</small><p>${save.daily[day]?`最佳：多 ${save.daily[day].extra} 步 / ${fmt(save.daily[day].ms)}`:'三题同场，每个人都是相同起点'}</p></section>
 ${btn('挑战今日王座','primary big','daily')}${btn('闯关之路 · 第 '+save.chapter+' 关','big','campaign')}
 <div class="btnrow" style="margin-top:13px">${btn('好友排行榜','','rank')}${btn('分享挑战','','share')}</div>
 <div class="under">浏览器试玩不接入微信好友数据与广告，正式接口在 Cocos 工程内</div>`);}
function begin(kind){mode=kind;stage=0;chapter=save.chapter;totalExtra=0;totalMs=0;perfect=0;assistedDaily=false;load()}
function load(){const l=level(mode,mode==='daily'?stage:chapter);initial=fromString(l.board);board=initial.slice();opt=l.opt;turns=0;assisted=false;hint=-1;reverse=false;elapsed=0;start=performance.now();play()}
function play(){page='play';const goal=[1,2,3,4,5,6,7,8,9].map(n=>`<b>${n}</b>`).join('');
 el(`<div class="game-top">${btn('‹ 返回','back','home')}<span class="stage">${mode==='daily'?'今日密令 · 第 '+(stage+1)+'/3 座':'推演之路 · 第 '+chapter+' 关'}</span></div>
 <div class="stats"><div class="stat"><strong>${opt}</strong><span>理论最少步数</span></div><div class="stat"><strong>${turns}</strong><span>实际旋转次数</span></div><div class="stat"><strong id="clock">${fmt(elapsedMs())}</strong><span>完成用时</span></div></div>
 <div class="goal"><div class="goal-label">目 标<br><small>由 1 到 9</small></div><div class="mini">${goal}</div></div>
 <div class="hintline">点击四处发光的旋钮，旋转相邻四枚秘印</div>
 <div class="board-outer"><div class="board" id="board">${board.map(n=>`<div class="tile"><strong>${n}</strong><em>${['◇','✦','✧','✶','⬟','✥','☼','✹','◆'][n-1]}</em></div>`).join('')}
 ${[0,1,2,3].map(r=>`<button class="rotor ${hint===r?'hint':''}" aria-label="旋转第${r+1}个机关" data-rotor="${r}" style="left:${r%2?67:33}%;top:${r<2?33:67}%">${reverse?'↺':'↻'}</button>`).join('')}</div></div>
 <div class="direction">旋转方向</div><div class="controls">${btn(reverse?'↺ 逆时针':'↻ 顺时针','', 'dir')}</div>
 <div class="btnrow secondary">${btn('重新开始','','reset')}${btn('揭示一步 · 练习','','hint')}</div>
 <div class="score-message ${assisted?'assisted':''}">${assisted?'已使用提示，本轮只作练习，不参与好友榜':hint>=0?'高亮机关就是最短解的一步':'好友榜按多走步数排名，再比谁更快'}</div>`);
}
function move(r){if(page!=='play')return;board=rotate(board,r,reverse?-1:1);turns++;hint=-1;
 const b=document.getElementById('board');if(b)b.animate([{transform:'scale(1)'},{transform:'scale(.986)'},{transform:'scale(1)'}],{duration:190});
 if(solved(board)){elapsed=elapsedMs();result();return;}play();}
function result(){page='result';totalExtra+=Math.max(0,turns-opt);totalMs+=elapsed;if(turns===opt)perfect++;
 if(mode==='campaign'){save.chapter=Math.max(save.chapter,chapter+1);store()}
 const last=mode==='daily'&&stage===2;
 if(last&&!assistedDaily){const old=save.daily[day],rec={extra:totalExtra,ms:Math.round(totalMs)};
  if(!old||rec.extra<old.extra||(rec.extra===old.extra&&rec.ms<old.ms)){save.daily[day]=rec;store()}}
 const extra=turns-opt;el(baseHead('判定完成 · 荣耀来自真正的思考')+
 `<div class="result-medal">♛</div><div class="result-title">${extra===0?'完 美 复 原':extra<=2?'精 密 推 演':'密 令 已 解'}</div>
 <div class="summary">本关：${turns} 步，理论最少 ${opt} 步<br>用时 ${fmt(elapsed)} · 多用 ${extra} 步<br>
 ${mode==='daily'?`<strong>累计多 ${totalExtra} 步 / ${fmt(totalMs)}</strong><br>理论最优复原 ${perfect}/${stage+1} 关`:'<strong>已解锁第 '+(chapter+1)+' 关</strong>'}</div>
 <div class="result-actions">${btn(last?'分享战绩，邀请好友挑战':mode==='daily'?'进入下一道密令':'继续推演','primary big',last?'share':'next')}
 ${last?btn('再次挑战','big','daily'):''}${btn('返回大厅','big','home')}${btn('好友榜','','rank')}</div>
 <div class="under">${assistedDaily?'包含练习提示，不计入好友成绩':'真正的排名来自最少步数与实际完成时间'}</div>`);
}
function share(){const q='?day='+day;const url=new URL(location.href);url.search=q;
 if(navigator.share){navigator.share({title:'九印王座｜你能比我更快吗？',url:url.href}).catch(()=>{});return}
 if(navigator.clipboard&&location.protocol.startsWith('http'))navigator.clipboard.writeText(url.href).then(()=>toast('挑战链接已复制')).catch(()=>toast(url.href));else toast('请复制地址栏链接进行分享')}
function rank(){page='rank';el(baseHead('朋友之间，同题竞争')+'<div class="ranklist"><div><h2 style="color:#f1d09a">微信好友王座</h2><p>浏览器不拥有微信好友关系链权限。</p><p>正式小游戏版使用微信开放数据域读取真实好友榜。</p><p>此处不展示虚构玩家或虚假成绩。</p></div></div>'+btn('返回大厅','big primary','home'));}
function toast(s){const old=document.querySelector('.toast');if(old)old.remove();const n=document.createElement('div');n.className='toast';n.textContent=s;document.body.appendChild(n);setTimeout(()=>n.remove(),2300)}
function solve(arr){const start=arr.join(''),goal='123456789';if(start===goal)return[];
 const maps=[new Map([[start,{p:null,m:-1}]]),new Map([[goal,{p:null,m:-1}]])],front=[[start],[goal]];let meet=null;
 for(let count=0;count<14&&front[0].length&&front[1].length&&meet===null;count++){
  const side=front[0].length<=front[1].length?0:1,other=1-side,next=[];
  loop:for(const state of front[side]){const b=fromString(state);for(let m=0;m<8;m++){
   const nextState=rotate(b,Math.floor(m/2),m%2?-1:1).join('');
   if(maps[side].has(nextState))continue;maps[side].set(nextState,{p:state,m});
   if(maps[other].has(nextState)){meet=nextState;break loop}next.push(nextState);
  }}front[side]=next;
 }
 if(meet===null)return[];let cur=meet,h=[],t=[];
 while(maps[0].get(cur).p!==null){const link=maps[0].get(cur);h.push(link.m);cur=link.p}h.reverse();cur=meet;
 while(maps[1].get(cur).p!==null){const link=maps[1].get(cur);t.push(link.m^1);cur=link.p}
 return h.concat(t);
}
$.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 const r=b.dataset.rotor;if(r!==undefined){move(+r);return}
 const id=b.dataset.act;
 if(id==='daily'||id==='campaign')begin(id);
 else if(id==='home')home();else if(id==='rank')rank();else if(id==='share')share();
 else if(id==='dir'){reverse=!reverse;play()}
 else if(id==='reset'){load()}
 else if(id==='hint'){assisted=true;assistedDaily=true;const path=solve(board);if(path.length){hint=Math.floor(path[0]/2);reverse=path[0]%2===1;play();toast('高亮机关可减少一次最短剩余步数')}else toast('已经还原完成')}
 else if(id==='next'){if(mode==='daily'){stage++;load()}else{chapter++;load()}}
});
setInterval(()=>{if(page==='play'){const c=document.getElementById('clock');if(c)c.textContent=fmt(elapsedMs())}},100);
home();
})();
