(function(){'use strict';
const app=document.querySelector('#app'),BANK=window.CROWN_BANK,SQUARES=[[0,1,4,3],[1,2,5,4],[3,4,7,6],[4,5,8,7]];
const KEY='crown-preview-v1';
let day=today(),mode='daily',chapter=1,stage=0,screen='home',board=[],initial=[],opt=0,moves=0,clockwise=true,
    start=0,ms=0,totalMs=0,extra=0,perfect=0,assisted=false,assistedDaily=false,hintMove=-1;
let save={chapter:1,daily:{}};try{const d=JSON.parse(localStorage.getItem(KEY));if(d&&d.chapter&&d.daily)save=d;}catch(_){}
const incoming=new URLSearchParams(location.search).get('day');if(/^20\d{6}$/.test(incoming||''))day=incoming;
function today(){return new Date(Date.now()+28800000).toISOString().slice(0,10).replace(/-/g,'')}
function hash(s){let h=2166136261;for(let c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0;}
function nextLevel(){const d=mode==='daily'?[5,7,9][stage]:Math.max(3,Math.min(10,2+Math.floor((chapter+4)/8)));
 const choices=BANK[d],key=mode==='daily'?`crown-v1:${day}:${stage}`:`campaign:${chapter}`;
 return{board:choices[hash(key)%choices.length].split('').map(Number),opt:d};}
function rotate(a,r,dir){const out=a.slice(),sq=SQUARES[r];for(let i=0;i<4;i++)out[sq[(i+dir+4)%4]]=a[sq[i]];return out;}
function finished(b){return b.join('')==='123456789';}
function duration(){return ms+(screen==='play'?performance.now()-start:0);}
function format(t){return (t/1000).toFixed(1)+'s'}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(save));}catch(_){}}
function render(html){app.innerHTML='<div class="app"><main class="screen">'+html+'</main></div>';}
function btn(t,id,klass=''){return `<button class="btn ${klass}" data-action="${id}">${t}</button>`;}
function head(sub){return `<div class="head"><div class="eyebrow">THE NINE SEALS</div><h1 class="title">九 印 王 座</h1><div class="sub">${sub}</div></div><div class="rule"></div>`;}
function home(){screen='home';const rec=save.daily[day];render(head('一局九印，只有最少步数才能封王')+
 `<div class="medal">♛</div><div class="intro">四个旋钮 · 九枚秘印 · 三道同题竞技<br>能解出只是开始，赢得漂亮才是本事。</div>
 <section class="panel"><h2>今 日 密 令</h2><div class="date">${day.slice(0,4)} / ${day.slice(4,6)} / ${day.slice(6)}</div><p>${rec?`个人最佳：多 ${rec.extra} 步 · ${format(rec.ms)}`:'人人同样的谜题，比谁能做得更好'}</p></section>
 ${btn('挑战今日王座','daily','primary big')}${btn('闯关之路 · 第 '+save.chapter+' 关','campaign','big')}
 <div class="btnrow" style="margin-top:13px">${btn('好友排行榜','rank')}${btn('分享挑战','share')}</div>
 <div class="fine">浏览器版可独立试玩；微信好友榜和广告由正式小游戏接入。</div>`);}
function begin(m){mode=m;chapter=save.chapter;stage=0;totalMs=0;extra=0;perfect=0;assistedDaily=false;load();}
function load(){const d=nextLevel();board=d.board.slice();initial=d.board.slice();opt=d.opt;moves=0;ms=0;clockwise=true;assisted=false;hintMove=-1;start=performance.now();play();}
function play(){screen='play';const cells=board.map(n=>`<div class="tile"><strong>${n}</strong><em>${['◇','✦','✧','✶','◆','✥','☼','✹','⬟'][n-1]}</em></div>`).join('');
 render(`<div class="gamebar">${btn('‹ 返回','home')}<div class="stage">${mode==='daily'?`今日密令 · 第 ${stage+1} / 3 座`:`闯关之路 · 第 ${chapter} 关`}</div></div>
 <div class="stats"><div class="stat"><b>${opt}</b><small>理论最少步数</small></div><div class="stat"><b>${moves}</b><small>实际旋转次数</small></div><div class="stat"><b id="clock">${format(duration())}</b><small>完成用时</small></div></div>
 <div class="goal"><div class="goaltext">目 标<br><small>按 1 ～ 9 排列</small></div><div class="miniboard">${Array.from({length:9},(_,i)=>`<b>${i+1}</b>`).join('')}</div></div>
 <div class="instruction">点击四个金色旋钮，每次旋转相邻的四枚秘印</div>
 <div class="boardframe"><div class="board">${cells}${Array.from({length:4},(_,i)=>`<button class="rotor ${hintMove>=0&&Math.floor(hintMove/2)===i?'hint':''}" style="left:${i%2?67:33}%;top:${i<2?33:67}%" data-rotor="${i}" aria-label="旋转第${i+1}个机关">${clockwise?'↻':'↺'}</button>`).join('')}</div></div>
 <div class="controlshead">旋转方向</div><div class="direction">${btn(clockwise?'↻ 顺时针':'↺ 逆时针','direction')}</div>
 <div class="btnrow actions">${btn('重新开始','restart')}${btn('提示 · 练习','hint')}</div>
 <div class="note ${assisted?'warn':''}">${assisted?'已使用提示，不计入今日好友榜':hintMove>=0?'高亮机关就是下一步的最短解':'胜负先看额外步数，再比完成速度'}</div>`);
}
function complete(){ms=duration();screen='result';totalMs+=ms;extra+=Math.max(0,moves-opt);if(moves===opt)perfect++;
 const last=mode==='daily'&&stage===2;
 if(mode==='campaign'){save.chapter=Math.max(save.chapter,chapter+1);persist();}
 else if(last&&!assistedDaily){const rec={day,extra,ms:Math.round(totalMs),perfect},best=save.daily[day];
   if(!best||rec.extra<best.extra||(rec.extra===best.extra&&rec.ms<best.ms)){save.daily[day]=rec;persist();}}
 const gap=moves-opt;
 render(head('棋局解封 · 荣耀属于真正的最优解')+
 `<div class="medal small">♛</div><div class="resulttitle">${gap===0?'完 美 复 原':gap<=2?'精 密 推 演':'密 令 已 解'}</div>
 <div class="resulttext">本关 ${moves} 步 / 理论最优 ${opt} 步<br>本关用时 ${format(ms)} · 多走 ${gap} 步<br>
 <strong>${mode==='daily'?`今日累计多 ${extra} 步 · ${format(totalMs)}`:`已解锁第 ${chapter+1} 关`}</strong><br>
 ${mode==='daily'?`完美复原 ${perfect} / ${stage+1} 关`:''}</div><div class="resultbuttons">
 ${btn(last?'分享战绩，邀请好友挑战':mode==='daily'?'进入下一道密令':'继续闯关',last?'share':'next','primary big')}
 ${last?btn('再次挑战','daily','big'):''}${btn('返回大厅','home','big')}${last?btn('好友榜','rank','big'):''}</div>
 <div class="fine">${assistedDaily?'包含练习提示，不参与今日好友榜':'仅真实解谜成绩有资格参与好友榜'}</div>`);
}
function share(){const url=new URL(location.href);url.search='day='+day;
 if(navigator.share){navigator.share({title:'九印王座｜今日密令等你破纪录',url:url.href}).catch(()=>{});return;}
 if(navigator.clipboard&&location.protocol.startsWith('http')){navigator.clipboard.writeText(url.href).then(()=>toast('挑战链接已复制')).catch(()=>toast('请复制浏览器地址'))}else toast('请复制浏览器地址分享');}
function rank(){screen='rank';const best=save.daily[day];render(head('真实好友，同题决胜')+
 `<div class="rank"><div><h2>微信好友排行榜</h2><p>浏览器没有微信好友关系链权限。</p><p>正式小游戏由微信开放数据域呈现真实好友成绩，不能在此伪造。</p><p>${best?`你的本机最佳：多 ${best.extra} 步 · ${format(best.ms)}`:'当前没有今日有效成绩'}</p></div></div>${btn('返回大厅','home','primary big')}`);}
function toast(s){document.querySelector('.toast')?.remove();const t=document.createElement('div');t.className='toast';t.textContent=s;document.body.appendChild(t);setTimeout(()=>t.remove(),2400);}
function solution(arr){const a=arr.join(''),b='123456789';if(a===b)return [];
 const seen=[new Map([[a,{p:null,m:-1}]]),new Map([[b,{p:null,m:-1}]])],front=[[a],[b]];let meet=null;
 for(let step=0;step<14&&front[0].length&&front[1].length&&meet===null;step++){
  const side=front[0].length<=front[1].length?0:1,other=1-side,next=[];
  outer:for(const state of front[side])for(let m=0;m<8;m++){
    const n=rotate(state.split('').map(Number),Math.floor(m/2),m%2===0?1:-1).join('');if(seen[side].has(n))continue;
    seen[side].set(n,{p:state,m});if(seen[other].has(n)){meet=n;break outer;}next.push(n);
  }
  front[side]=next;
 }
 if(meet===null)return[];const h=[],t=[];let x=meet;
 while(seen[0].get(x).p!==null){const l=seen[0].get(x);h.push(l.m);x=l.p;}h.reverse();x=meet;
 while(seen[1].get(x).p!==null){const l=seen[1].get(x);t.push(l.m^1);x=l.p;}
 return h.concat(t);
}
app.addEventListener('click',event=>{const target=event.target.closest('button');if(!target)return;
 if(target.dataset.rotor!==undefined){if(screen!=='play')return;board=rotate(board,Number(target.dataset.rotor),clockwise?1:-1);moves++;hintMove=-1;
   if(finished(board))complete();else play();return;}
 const act=target.dataset.action;
 if(act==='home')home();else if(act==='daily'||act==='campaign')begin(act);
 else if(act==='rank')rank();else if(act==='share')share();else if(act==='direction'){clockwise=!clockwise;play();}
 else if(act==='restart'){load();}else if(act==='next'){if(mode==='daily')stage++;else chapter++;load();}
 else if(act==='hint'){assisted=true;assistedDaily=true;const steps=solution(board);if(steps.length){hintMove=steps[0];clockwise=steps[0]%2===0;play();toast('高亮旋钮是最短解的一步')}else toast('棋盘已完成');}
});
setInterval(()=>{if(screen==='play'){const t=document.querySelector('#clock');if(t)t.textContent=format(duration());}},100);
home();
})();
