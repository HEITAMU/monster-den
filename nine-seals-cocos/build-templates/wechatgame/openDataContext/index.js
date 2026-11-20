/* 微信小游戏开放数据域 — 主域不可读取好友关系链数据。此文件由 Cocos 构建模板复制。
   单日榜排序：额外步数升序，其次耗时升序。只显示相同 day 的有效成绩。 */
(function () {
  'use strict';
  if (typeof wx === 'undefined') return;
  var canvas = (typeof wx.getSharedCanvas === 'function') ? wx.getSharedCanvas() : (typeof sharedCanvas !== 'undefined' ? sharedCanvas : null);
  if (!canvas) return;
  canvas.width = 600; canvas.height = 760;
  var ctx = canvas.getContext('2d');
  var date = '', state = '尚未获取好友成绩', players = [], avatars = Object.create(null), generation = 0;
  function txt(s, x, y, size, color, align) {
    ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    ctx.font = 'bold ' + size + 'px sans-serif'; ctx.fillText(s, x, y);
  }
  function draw() {
    ctx.clearRect(0,0,600,760);
    ctx.fillStyle = '#152634'; ctx.fillRect(0,0,600,760);
    ctx.fillStyle = '#d2b882'; ctx.fillRect(28,76,544,2);
    txt('今日好友王座',300,45,36,'#f1d8a0','center');
    txt(date ? date.substring(0,4)+' / '+date.substring(4,6)+' / '+date.substring(6) : '',300,102,19,'#8eb8ca','center');
    if (!players.length) {
      txt(state,300,342,24,'#bbd3de','center');
      txt('仅显示已参与今日挑战的微信好友',300,388,18,'#8aa8b5','center');
    } else {
      var max = Math.min(players.length, 8);
      for (var i=0;i<max;i++) {
        var p=players[i], y=156+i*69;
        ctx.fillStyle = i===0 ? '#314237' : '#223947'; ctx.fillRect(25,y-6,550,62);
        txt(String(i+1).padStart(2,'0'),52,y+23,23,i===0?'#f7cf75':'#aac7d2');
        if (p.avatar && avatars[p.avatar] && avatars[p.avatar].complete) {
          try {ctx.drawImage(avatars[p.avatar],99,y+3,46,46);}catch(_){}
        } else { ctx.fillStyle='#627f8e';ctx.fillRect(99,y+3,46,46); }
        var nickname = String(p.name || '微信好友');
        if (nickname.length > 9) nickname=nickname.slice(0,9)+'…';
        txt(nickname,160,y+19,20,'#f3f0e9');
        txt('多 '+p.extra+' 步',160,y+44,16,'#abc4cf');
        txt((p.ms/1000).toFixed(1)+'s',553,y+23,23,'#f2d794','right');
      }
    }
    txt('排名规则：先比多走的步数，再比完成时间',300,721,17,'#90aab8','center');
  }
  function load(day, key) {
    date=day; state='正在读取微信好友数据…';players=[]; draw();
    var seq=++generation;
    wx.getFriendCloudStorage({ keyList:[key], success:function(res){
      if(seq!==generation)return;
      var data=(res&&res.data)||[], matched=[];
      data.forEach(function(entry){
        var values=entry.KVDataList||[], rec=values.find(function(x){return x.key===key;});
        if(!rec || !rec.value) return;
        var parts=String(rec.value).split('|');
        if(parts.length!==4 || parts[0]!==day)return;
        var surplus=Number(parts[1]), ms=Number(parts[2]);
        if(!Number.isInteger(surplus)||surplus<0||surplus>10000||!Number.isFinite(ms)||ms<=0||ms>86400000)return;
        matched.push({name:entry.nickname||'微信好友',avatar:entry.avatarUrl||'',extra:surplus,ms:ms});
      });
      matched.sort(function(a,b){return a.extra-b.extra||a.ms-b.ms;});
      players=matched;state='还没有好友提交今日成绩';draw();
      players.forEach(function(p){
        if(!p.avatar || avatars[p.avatar])return;
        var im=wx.createImage();avatars[p.avatar]=im;im.onload=draw;im.onerror=draw;im.src=p.avatar;
      });
    }, fail:function(){if(seq!==generation)return;state='好友数据暂不可用，请在微信真机重试';draw();} });
  }
  wx.onMessage(function(msg){
    if(!msg || msg.type!=='nine_seals:rank')return;
    if(!/^20\d{6}$/.test(String(msg.day||'')))return;
    var key=String(msg.key||'');if(key!=='nine_seals_daily_v1')return;
    load(msg.day,key);
  });
  draw();
})();
