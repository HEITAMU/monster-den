/* The genuine WeChat Open Data Context — no simulated friends or scores. */
(function(){'use strict';if(typeof wx==='undefined')return;
var canvas=typeof wx.getSharedCanvas==='function'?wx.getSharedCanvas():typeof sharedCanvas!=='undefined'?sharedCanvas:null;
if(!canvas)return;
canvas.width=600;canvas.height=760;
var ctx=canvas.getContext('2d'),day='',players=[],status='等待今日好友数据',generation=0,avatars={};
function label(s,x,y,size,c,align){ctx.textAlign=align||'left';ctx.textBaseline='middle';ctx.fillStyle=c;ctx.font='bold '+size+'px sans-serif';ctx.fillText(s,x,y);}
function render(){
 ctx.clearRect(0,0,600,760);ctx.fillStyle='#152c3a';ctx.fillRect(0,0,600,760);
 label('好友王座',300,47,35,'#e9ce94','center');label(day?day.slice(0,4)+' / '+day.slice(4,6)+' / '+day.slice(6):'',300,94,18,'#9ac4cf','center');
 ctx.strokeStyle='#ac8a57';ctx.beginPath();ctx.moveTo(30,120);ctx.lineTo(570,120);ctx.stroke();
 if(!players.length){label(status,300,330,22,'#e1e8e9','center');label('仅展示完成今日三关的真实微信好友',300,380,18,'#9cb8c0','center');}
 players.slice(0,8).forEach(function(p,i){var y=156+i*69;
  ctx.fillStyle=i===0?'#344943':'#234050';ctx.fillRect(24,y-7,553,64);
  label(String(i+1).padStart(2,'0'),48,y+26,22,'#f2d69b');
  if(p.avatar&&avatars[p.avatar]&&avatars[p.avatar].complete){try{ctx.drawImage(avatars[p.avatar],93,y,48,48);}catch(_){}}
  else{ctx.fillStyle='#637f89';ctx.fillRect(93,y,48,48);}
  var name=String(p.name||'微信好友');if(name.length>9)name=name.slice(0,9)+'…';
  label(name,158,y+14,21,'#ebf1f1');label('多 '+p.extra+' 步',158,y+42,16,'#aac4cd');
  label((p.ms/1000).toFixed(1)+'s',554,y+28,22,'#e6d19e','right');
 });
 label('同题排名：先比额外步数，后比用时',300,714,17,'#91b3c0','center');
}
function refresh(d,key){day=d;players=[];status='读取微信好友成绩…';render();var seq=++generation;
 wx.getFriendCloudStorage({keyList:[key],success:function(r){if(seq!==generation)return;
  ((r&&r.data)||[]).forEach(function(e){var rec=(e.KVDataList||[]).find(function(x){return x.key===key;});if(!rec)return;
   var parts=String(rec.value).split('|');if(parts.length!==4||parts[0]!==d)return;
   var extra=Number(parts[1]),ms=Number(parts[2]);
   if(!Number.isInteger(extra)||extra<0||extra>10000||!Number.isFinite(ms)||ms<=0||ms>86400000)return;
   players.push({name:e.nickname,avatar:e.avatarUrl,extra:extra,ms:ms});
  });players.sort(function(a,b){return a.extra-b.extra||a.ms-b.ms;});
  status='暂无好友提交今日成绩';render();players.forEach(function(p){if(!p.avatar||avatars[p.avatar])return;
    var image=wx.createImage();avatars[p.avatar]=image;image.onload=render;image.onerror=render;image.src=p.avatar;});
 },fail:function(){if(seq!==generation)return;status='好友成绩读取失败，请到微信真机重试';render();}});
}
wx.onMessage(function(msg){if(!msg||msg.type!=='crown:rank')return;
 if(!/^20\d{6}$/.test(String(msg.day||''))||msg.key!=='nine_seals_daily_v1')return;
 refresh(msg.day,msg.key);
});render();
})();
