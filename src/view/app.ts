/**
 * The spectator app — a self-contained, dependency-free HTML page that renders
 * the town on a canvas and polls /snapshot.json for the live world. It is built
 * to read like a live pixel soap opera: characters walk the streets between
 * buildings as their plans unfold, real dialogue lines play out as speech
 * bubbles, a news chyron scrolls the day's drama, and the whole scene lives
 * through a sim-clock-driven day/night cycle with lamps, smoke, and birds.
 * Click a character to follow their thoughts, plan, posts, and reply to them
 * (the audience-coupling, made visible).
 *
 * Served at GET / by the spectator server. No external assets (CSP-safe). When
 * opened as a local file it falls back to the deployed origin (CORS-enabled).
 * Debug: append ?hh=22 to force the ambience hour (screenshot verification).
 */
export function renderAppHtml(deployOrigin = "http://47.237.78.57", embedded: unknown = null): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>The Feed — a live AI soap opera</title>
<style>
  :root{
    --bg:#12151c; --panel:#171b24; --panel2:#1e2431; --line:#2a3140; --ink:#eef1f6; --dim:#95a0b3; --amber:#ecb44a; --live:#f0575f;
    --grass:#7bbf6a; --grass2:#71b661; --path:#d8c39a; --water:#6fb7d8;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%;background:var(--bg);color:var(--ink);font-family:ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif;overflow:hidden}
  #app{display:flex;flex-direction:column;height:100vh;height:100dvh}
  header{display:flex;align-items:center;gap:12px;padding:10px 16px;background:var(--panel);border-bottom:1px solid var(--line);flex:0 0 auto}
  .live{display:inline-flex;align-items:center;gap:7px;color:var(--live);font-weight:700;font-size:12px;letter-spacing:.12em;font-family:ui-monospace,Menlo,monospace}
  .dot{width:9px;height:9px;border-radius:50%;background:var(--live);animation:pulse 1.6s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
  h1{font-size:17px;font-weight:800;letter-spacing:.02em}
  h1 b{color:var(--amber)}
  .sub{font-size:11px;color:var(--dim)}
  .clock{margin-left:auto;font-family:ui-monospace,Menlo,monospace;color:var(--dim);font-size:13px;white-space:nowrap}
  .stat{font-family:ui-monospace,Menlo,monospace;color:var(--dim);font-size:12px}
  main{flex:1;display:flex;min-height:0}
  #stage{position:relative;flex:1;min-width:0;background:var(--grass)}
  canvas{display:block;width:100%;height:100%;touch-action:manipulation}
  #hint{position:absolute;left:12px;bottom:42px;background:rgba(0,0,0,.5);color:#fff;font-size:12px;padding:6px 10px;border-radius:8px;pointer-events:none}
  aside{flex:0 0 340px;background:var(--panel);border-left:1px solid var(--line);display:flex;flex-direction:column;min-height:0}
  .apanel{padding:14px 15px;overflow-y:auto;flex:1;min-height:0;-webkit-overflow-scrolling:touch}
  @media(max-width:980px){aside{flex-basis:300px}.sub{display:none}}
  @media(max-width:760px){
    main{flex-direction:column}
    #stage{flex:0 0 54dvh;min-height:240px}
    aside{flex:1 1 auto;flex-basis:auto;border-left:none;border-top:1px solid var(--line)}
    header{flex-wrap:wrap;gap:6px 12px;padding:8px 12px}
    h1{font-size:16px}.stat{flex-basis:100%;order:9}.sub{display:none}
    #hint{font-size:11px;left:8px;bottom:38px}
  }
  .ptitle{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);margin:2px 0 10px}
  .scene{background:linear-gradient(90deg,#2b1e2e,#1e2431);border:1px solid #4a3550;border-radius:10px;padding:9px 11px;font-size:12.5px;margin-bottom:12px;color:#f0c9d4}
  .who{display:flex;align-items:center;gap:10px;margin-bottom:8px}
  .avatar{width:34px;height:34px;border-radius:50%;flex:0 0 auto;border:2px solid #0007}
  .wn{font-weight:800;font-size:18px}
  .wl{font-size:12px;color:var(--dim)}
  .doing{background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:10px 0;font-size:13px}
  .doing .k{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin-bottom:3px}
  .sec{margin-top:14px}
  .sec>.h{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin-bottom:6px}
  .mem{font-size:12.5px;padding:6px 0;border-bottom:1px solid var(--line);line-height:1.4}
  .mem .kd{font-family:ui-monospace,Menlo,monospace;font-size:10px;font-weight:700;text-transform:uppercase;margin-right:6px}
  .post{font-size:13px;background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:9px 11px;margin-bottom:8px}
  .replybox{display:flex;gap:6px;margin-top:8px}
  .replybox input{flex:1;background:var(--panel2);border:1px solid var(--line);border-radius:8px;color:var(--ink);padding:8px 10px;font-size:13px}
  .replybox button{background:var(--amber);color:#1a1305;border:none;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer}
  .replybox button:disabled{opacity:.5;cursor:default}
  .replymsg{font-size:12px;margin-top:6px;min-height:16px;color:var(--dim)}
  .roster{display:flex;flex-direction:column;gap:2px}
  .rrow{display:flex;align-items:center;gap:9px;padding:7px 8px;border-radius:9px;cursor:pointer}
  .rrow:hover{background:var(--panel2)}
  .rdot{width:22px;height:22px;border-radius:50%;flex:0 0 auto;border:2px solid #0006}
  .rn{font-weight:700;font-size:13px}
  .ra{font-size:11px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .hl{font-size:12px;padding:6px 0;border-bottom:1px solid var(--line);color:var(--dim)}
  .bond{display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:5px 0;border-bottom:1px solid var(--line)}
  .hearts{color:#e0637a;letter-spacing:2px;font-size:11px}
  .back{color:var(--amber);cursor:pointer;font-size:12px;font-weight:700}
</style></head>
<body><div id="app">
  <header>
    <span class="live"><span class="dot"></span>LIVE</span>
    <h1>The <b>Feed</b></h1>
    <span class="sub">a soap opera played by AI minds — talk to the cast, change the story</span>
    <span class="clock" id="clock">--:--</span>
    <span class="stat" id="stat"></span>
  </header>
  <main>
    <div id="stage"><canvas id="c"></canvas><div id="hint">Click a character to follow their life →</div></div>
    <aside><div class="apanel" id="panel"></div></aside>
  </main>
</div>
<script>
(function(){
  "use strict";
  var DEPLOY = ${JSON.stringify(deployOrigin)};
  var EMBEDDED = ${embedded ? JSON.stringify(embedded) : "null"};
  var KIND_COLOR = {observation:"#57b6ce",dialogue:"#5fc28e",reflection:"#9e8cff",plan:"#ecb44a",injection:"#f0a020"};
  var EMOJI = [[/bakery|pastry|bread|flour|dough|oven/,"🥐"],[/caf|coffee|barista|brew|espresso|tables|counter|shop/,"☕"],[/park|walk|stroll|garden|air|outside/,"🌳"],[/home|shower|dress|sleep|bed|waking|nap|rest|breakfast|winding/,"🏠"],[/talking|chat|conversation|apolog|clear the air/,"💬"],[/read|journal|note/,"📓"],[/greet|neighbou?r/,"👋"]];
  function emojiFor(a){a=(a||"").toLowerCase();for(var i=0;i<EMOJI.length;i++)if(EMOJI[i][0].test(a))return EMOJI[i][1];return "🙂";}
  function hue(id){var h=0;for(var i=0;i<id.length;i++)h=(h*31+id.charCodeAt(i))>>>0;return h%360;}
  function color(id){return "hsl("+hue(id)+",62%,58%)";}
  function clamp(v,a,b){return v<a?a:(v>b?b:v);}
  function lerp(a,b,t){return a+(b-a)*t;}
  var T=0, sheets={};
  function base(){return (location.protocol==="file:")?DEPLOY:"";}
  // load an image with a couple of retries so a transient blip doesn't leave
  // permanent placeholder circles/boxes on a 24/7 spectator tab
  function loadImg(src){var im=new Image(),tries=0;im.onerror=function(){if(tries<2){tries++;setTimeout(function(){im.src=src+"?r="+tries;},2200*tries);}};im.src=src;return im;}
  // character atlases are ~9MB decoded each — load lazily, only the cast's own
  function getSheet(id){var i=(hue(id)%5)+1;if(!sheets[i])sheets[i]=loadImg(base()+"/assets/characters/c"+i+".png");return sheets[i];}
  // LimeZu premade atlas: 32x64 characters, 6 frames x 4 directions per band.
  // Band y=64 is idle, y=128 is walk. Direction column offsets within a band:
  var DIRCOL={R:0,U:6,L:12,D:18}, IDLE_Y=64, WALK_Y=128;
  var CW=34, CH=68; // on-screen character size
  var HHOVR=null; try{var q=new URLSearchParams(location.search).get("hh"); if(q!==null&&q!==""&&isFinite(+q))HHOVR=clamp(+q,0,23.99);}catch(e){}

  // --- image assets: character sheets, props, real LimeZu buildings ---
  var props={}, buildings={};
  var BLDG={cafe:"cafe",bakery:"bakery",maya_home:"home1",tom_home:"home2",ana_home:"home3",leo_home:"home4"};
  ["tree_green","tree_autumn","bush_pink","bush_white","bench","flowers","fountain","lamp"].forEach(function(n){props[n]=loadImg(base()+"/assets/props/"+n+".png");});
  ["table_umbrella","stall"].forEach(function(n){props[n]=loadImg(base()+"/assets/buildings/"+n+".png");});
  Object.keys(BLDG).forEach(function(k){buildings[k]=loadImg(base()+"/assets/buildings/"+BLDG[k]+".png");});
  function ok(im){return im&&im.complete&&im.naturalWidth>0;}

  // --- decoration layer: props scattered off the streets (percent coords) ---
  var SCATTER=[
    {k:"tree_green",x:7,y:11},{k:"tree_autumn",x:25,y:8},{k:"tree_green",x:42,y:9},{k:"tree_autumn",x:58,y:8},{k:"tree_green",x:75,y:9},{k:"tree_autumn",x:93,y:11},
    {k:"tree_green",x:5,y:32},{k:"tree_autumn",x:95,y:32},{k:"tree_autumn",x:5,y:64},{k:"tree_green",x:95,y:66},
    {k:"tree_green",x:26,y:95},{k:"tree_autumn",x:41,y:96},{k:"tree_green",x:59,y:96},{k:"tree_autumn",x:74,y:95},
    {k:"lamp",x:38,y:55},{k:"lamp",x:62,y:55},{k:"lamp",x:16,y:44},{k:"lamp",x:84,y:44},
    {k:"bush_pink",x:30,y:60},{k:"bush_white",x:70,y:60},{k:"bush_pink",x:57,y:33},
    {k:"flowers",x:24,y:28},{k:"flowers",x:76,y:28},{k:"flowers",x:43,y:33},{k:"flowers",x:27,y:63},{k:"flowers",x:73,y:63},{k:"flowers",x:36,y:89},{k:"flowers",x:64,y:89},
    {k:"table_umbrella",x:24.5,y:47},{k:"stall",x:75.5,y:47}
  ];
  function propH(k){var m=clamp(H/760,0.9,1.3);return (k.slice(0,4)==="tree"?62:k==="lamp"?56:k==="fountain"?66:k==="table_umbrella"?50:k==="stall"?46:(k==="bush_pink"||k==="bush_white")?16:k==="bench"?26:17)*m;}
  function drawProp(im,cx,cy,h){if(!ok(im))return;var s=h/im.naturalHeight,w=im.naturalWidth*s;ctx.drawImage(im,Math.round(cx-w/2),Math.round(cy-h),Math.round(w),Math.round(h));}

  var canvas=document.getElementById("c"), ctx=canvas.getContext("2d");
  var stage=document.getElementById("stage");
  var W=0,H=0,DPR=Math.min(2,window.devicePixelRatio||1);
  var stars=[];
  function resize(){
    W=stage.clientWidth;H=stage.clientHeight;canvas.width=W*DPR;canvas.height=H*DPR;canvas.style.width=W+"px";canvas.style.height=H+"px";ctx.setTransform(DPR,0,0,DPR,0,0);
    stars=[];var s=7;function rnd(){s=(s*1103515245+12345)%2147483648;return s/2147483648;}
    var n=Math.round(W*H/26000);for(var i=0;i<n;i++)stars.push({x:rnd()*W,y:rnd()*H*0.55,r:rnd()<0.2?1.6:1,ph:rnd()*6.28});
    if(snap)ingest(snap,true);
  }
  var rszT=null;window.addEventListener("resize",function(){clearTimeout(rszT);rszT=setTimeout(resize,120);});

  var snap=null, sprites={}, selected=null, lastErr="", pairs={};
  function px(p){return {x:p.x/100*W, y:p.y/100*H};}
  function streetY(){return 0.52*H;}
  function plazaR(){return Math.max(56, W*0.04);}

  // --- geometry of a place: where its building sits, its door, its baseline ---
  function geomOf(p){
    var c=px(p);
    if(p.type==="plaza"){var rx=Math.max(56,W*0.078);return {c:c,rx:rx,ry:rx*0.6,bottom:c.y+rx*0.6,base:c.y+16};}
    if(p.type==="park"){return {c:c,rx:Math.max(50,W*0.062),bottom:c.y+34,base:c.y+8};}
    var bh=clamp(H*0.21,104,176)*(p.type==="home"?0.94:1);
    var im=buildings[p.id]||buildings[p.type];
    var bw=ok(im)?im.naturalWidth*(bh/im.naturalHeight):bh*0.8;
    var bottom=c.y+bh*0.45;
    return {c:c,bh:bh,bw:bw,top:bottom-bh,bottom:bottom,base:bottom};
  }
  function doorOf(p){
    var g=geomOf(p);
    if(p.type==="plaza")return {x:g.c.x, y:g.c.y+10};
    if(p.type==="park")return {x:g.c.x, y:g.c.y+20};
    return {x:g.c.x, y:g.bottom+8};
  }

  // --- per-place standing slots (the plaza is a ring AROUND the fountain) ---
  var RING=[100,45,155,10,170,70,130,270];
  function slotsFor(p,n){
    var g=geomOf(p),out=[],i;
    if(p.type==="plaza"){
      var R=plazaR();
      for(i=0;i<n;i++){var a=RING[i%RING.length]*Math.PI/180;out.push({x:g.c.x+Math.cos(a)*R, y:g.c.y+10+Math.sin(a)*R*0.62});}
    } else if(p.type==="park"){
      for(i=0;i<n;i++)out.push({x:g.c.x+(n>1?(i-(n-1)/2):0)*56, y:g.c.y+26+(i%2)*9});
    } else {
      for(i=0;i<n;i++)out.push({x:g.c.x+(n>1?(i-(n-1)/2):0)*56, y:g.bottom+16+(i%2)*9});
    }
    return out;
  }

  // --- walking: route along the street grid (dips around the plaza fountain) ---
  function route(from,place,slot){
    var d=doorOf(place), sy=streetY(), cx=0.5*W;
    var dip=px({x:50,y:52}).y+plazaR()*0.62+12;
    var pts=[];
    if(Math.abs(from.y-sy)>4)pts.push({x:from.x,y:sy});
    var x1=from.x,x2=d.x;
    if(Math.min(x1,x2)-6<cx&&cx<Math.max(x1,x2)+6){
      if(Math.abs(x2-cx)<6){pts.push({x:cx,y:dip});}
      else {pts.push({x:cx,y:dip});pts.push({x:x2,y:sy});}
    } else if(Math.abs(x2-x1)>4)pts.push({x:x2,y:sy});
    // the plaza's "door" is the fountain itself — never walk into it; ring
    // slots are reached straight from the southern dip point
    if(place.type!=="plaza"&&Math.abs(d.y-sy)>6)pts.push({x:d.x,y:d.y});
    pts.push(slot);
    var out=[],last=from;
    for(var i=0;i<pts.length;i++){if(Math.hypot(pts[i].x-last.x,pts[i].y-last.y)>3){out.push(pts[i]);last=pts[i];}}
    return out;
  }

  // --- ingest a world snapshot: place everyone, queue new dialogue beats ---
  function ingest(s,reset){
    snap=s;
    var h=hourNow(), nn=nightness(h);
    var day=Math.floor((s.t-Date.UTC(2026,6,10))/86400000)+1;
    var ph=nn>0.6?"🌙":h<8?"🌅":h<17?"☀️":"🌇";
    document.getElementById("clock").textContent=(day>=1&&day<1000?"S1 · Day "+day+" · ":"")+ph+" "+(s.clock||"--:--");
    document.getElementById("stat").textContent=(s.stats?(s.stats.agents+" souls · "+s.stats.memories+" memories · "+s.stats.edges+" bonds"):"");
    var places={}; (s.places||[]).forEach(function(p){places[p.id]=p;});
    var idByName={}; (s.agents||[]).forEach(function(a){idByName[a.name.toLowerCase()]=a.id;});
    // mutual "talking with X" pairs at the same location
    var want={};
    (s.agents||[]).forEach(function(a){var m=/^talking with (.+)$/i.exec(a.action||"");if(m)want[a.id]=idByName[m[1].trim().toLowerCase()]||null;});
    pairs={};
    (s.agents||[]).forEach(function(a){
      var pid=want[a.id];
      if(pid&&want[pid]===a.id){var b=(s.agents||[]).filter(function(x){return x.id===pid;})[0];if(b&&b.location===a.location)pairs[a.id]=pid;}
    });
    // per-place groups → slots
    var atPlace={}; (s.agents||[]).forEach(function(a){atPlace[a.location]=(atPlace[a.location]||[]).concat(a.id);});
    var slotBy={};
    Object.keys(atPlace).forEach(function(loc){
      var p=places[loc]||places.plaza||{x:50,y:52,type:"plaza",id:"plaza"};
      var group=atPlace[loc], slots=slotsFor(p,group.length);
      group.forEach(function(id,i){slotBy[id]=slots[i];});
    });
    // conversation pairs stand face to face (on the plaza: side by side on the ring)
    Object.keys(pairs).forEach(function(id){
      var pid=pairs[id]; if(id>pid)return;
      var a2=(s.agents||[]).filter(function(x){return x.id===id;})[0];
      var pl=a2?places[a2.location]:null;
      if(pl&&pl.type==="plaza"){
        var g=geomOf(pl),R=plazaR();
        [[id,68],[pid,121]].forEach(function(e){
          var an=e[1]*Math.PI/180;
          slotBy[e[0]]={x:g.c.x+Math.cos(an)*R, y:g.c.y+10+Math.sin(an)*R*0.62};
        });
        return;
      }
      var sa=slotBy[id],sb=slotBy[pid]; if(!sa||!sb)return;
      var mx=(sa.x+sb.x)/2,my=(sa.y+sb.y)/2;
      slotBy[id]={x:mx-22,y:my}; slotBy[pid]={x:mx+22,y:my};
    });
    (s.agents||[]).forEach(function(a){
      var slot=slotBy[a.id]||{x:W/2,y:H/2};
      var sp=sprites[a.id];
      if(!sp||reset){sp=sprites[a.id]={x:slot.x,y:slot.y,place:a.location,path:null,dir:"D",idleAt:0};}
      else if(sp.place!==a.location){sp.path=route({x:sp.x,y:sp.y},places[a.location]||places.plaza,slot);sp.place=a.location;}
      else if(!sp.path&&Math.hypot((sp.slot?sp.slot.x:slot.x)-slot.x,(sp.slot?sp.slot.y:slot.y)-slot.y)>5){sp.path=[slot];}
      sp.slot=slot; sp.a=a;
    });
    Object.keys(sprites).forEach(function(id){ if(!(s.agents||[]).some(function(a){return a.id===id;})) delete sprites[id]; });
    pushBeats(s);
    setChyron(s);
    renderPanel();
  }

  // ===================== the soap layer: dialogue beats =====================
  var seen={}, beats=[], cur=null, curUntil=0, gapUntil=0, replayPool=[], replayAt=0;
  function beatKey(l){return l.t+"|"+l.speakerId+"|"+l.text;}
  function pushBeats(s){
    var fresh=false;
    ((s.dialogue)||[]).forEach(function(l){
      var k=beatKey(l); if(seen[k])return; seen[k]=1; fresh=true;
      beats.push({kind:"say",sid:l.speakerId,lid:l.listenerId,text:l.text,dur:clamp(1600+55*l.text.length,3200,7000)});
    });
    if(fresh){replayPool=[];((s.dialogue)||[]).slice(-4).forEach(function(l){replayPool.push({kind:"say",sid:l.speakerId,lid:l.listenerId,text:l.text,dur:clamp(1600+55*l.text.length,3200,7000)});});}
    // a couple of fresh reflections become thought bubbles (watch the mind)
    var refl=(s.ticker||[]).filter(function(t){return t.kind==="reflection";}).slice(0,2);
    refl.forEach(function(r){
      var k=r.t+"|"+r.agentId+"|"+r.text; if(seen[k])return; seen[k]=1;
      beats.push({kind:"think",sid:r.agentId,lid:null,text:r.text,dur:clamp(1500+45*r.text.length,2800,5200)});
    });
    if(beats.length>10)beats=beats.slice(-10);
  }
  function stepBeats(now){
    if(cur&&now>curUntil){cur=null;gapUntil=now+420;}
    if(!cur&&now>gapUntil){
      if(beats.length){cur=beats.shift();curUntil=now+cur.dur;}
      else if(replayPool.length&&now>replayAt){
        // loop the last scene while the pair is still mid-conversation
        var l=replayPool[0];
        if(pairs[l.sid]===l.lid){replayPool.forEach(function(b){beats.push({kind:b.kind,sid:b.sid,lid:b.lid,text:b.text,dur:b.dur});});replayAt=now+replayPool.length*5000+6000;}
        else replayPool=[];
      }
    }
  }
  function wrap(text,maxw){
    var words=String(text).split(" "),lines=[],line="",bw=0;
    for(var i=0;i<words.length;i++){
      var t=line?line+" "+words[i]:words[i];
      if(ctx.measureText(t).width>maxw&&line){lines.push(line);line=words[i];if(lines.length===3)break;}
      else line=t;
    }
    if(lines.length<3&&line)lines.push(line);
    else if(lines.length===3&&line!==""){lines[2]=lines[2].replace(/\\s*$/,"")+"…";}
    for(var j=0;j<lines.length;j++)bw=Math.max(bw,ctx.measureText(lines[j]).width);
    return {lines:lines,bw:bw};
  }
  function drawBubble(sp,beat){
    var think=beat.kind==="think";
    ctx.font=think?"italic 600 12px ui-sans-serif":"600 12.5px ui-sans-serif";
    if(!beat.w||beat.mw!==Math.min(210,W*0.45)){beat.mw=Math.min(210,W*0.45);var wr=wrap(beat.text,beat.mw);beat.lines=wr.lines;beat.w=wr.bw;}
    var lh=16, bw=beat.w+20, bh=beat.lines.length*lh+12;
    var bx=clamp(sp.x-bw/2,6,W-bw-6), by=sp.y-CH-22-bh; if(by<6)by=6;
    ctx.fillStyle=think?"rgba(224,229,238,.94)":"rgba(255,255,255,.96)";
    rr(bx,by,bw,bh,9);ctx.fill();
    if(think){
      ctx.beginPath();ctx.arc(sp.x-4,by+bh+5,3.4,0,7);ctx.fill();
      ctx.beginPath();ctx.arc(sp.x+1,by+bh+11,2.1,0,7);ctx.fill();
    } else {
      ctx.beginPath();ctx.moveTo(clamp(sp.x-7,bx+8,bx+bw-22),by+bh-1);ctx.lineTo(clamp(sp.x+7,bx+22,bx+bw-8),by+bh-1);ctx.lineTo(sp.x,by+bh+9);ctx.closePath();ctx.fill();
    }
    ctx.fillStyle=think?"#3c4759":"#182230";ctx.textAlign="left";
    for(var i=0;i<beat.lines.length;i++)ctx.fillText(beat.lines[i],bx+10,by+16+i*lh);
    ctx.textAlign="center";
  }
  function drawDots(sp){
    var bw=32,bh=17,bx=clamp(sp.x-bw/2,4,W-bw-4),by=sp.y-CH-18-bh;if(by<4)by=4;
    ctx.fillStyle="rgba(255,255,255,.85)";rr(bx,by,bw,bh,8);ctx.fill();
    for(var k=0;k<3;k++){ctx.globalAlpha=.35+.35*(1+Math.sin(T*0.16+k*1.1))/2;ctx.fillStyle="#4a5668";ctx.beginPath();ctx.arc(bx+9+k*7,by+bh/2,2.2,0,7);ctx.fill();}
    ctx.globalAlpha=1;
  }

  // ===================== the news chyron =====================
  var chy={src:null,w:0,x:0};
  var CHYFONT="700 11px ui-monospace,Menlo,monospace";
  function setChyron(s){
    var t=((s.highlights)||[]).map(function(b){return b.text;}).join("   ✦   ");
    if(!t)t="a new day in town — the cameras are rolling";
    t=t.toUpperCase();
    if(t!==chy.src){
      var first=chy.src===null;
      chy.src=t;ctx.font=CHYFONT;chy.w=ctx.measureText(t).width;
      // keep the crawl position on refresh — resetting offscreen on every
      // highlights change left the bar permanently blank
      if(first)chy.x=110;else if(chy.x<-chy.w)chy.x=W+24;
    }
  }
  function drawChyron(dt){
    if(!chy.src)return;
    var h=24,y=H-h;
    ctx.fillStyle="rgba(8,10,16,.84)";ctx.fillRect(0,y,W,h);
    ctx.save();ctx.beginPath();ctx.rect(96,y,W-96,h);ctx.clip();
    ctx.font=CHYFONT;ctx.textAlign="left";ctx.fillStyle="#f2d99a";
    ctx.fillText(chy.src,chy.x,y+16);
    ctx.restore();ctx.textAlign="center";
    chy.x-=dt*0.072; if(chy.x<-chy.w)chy.x=W+24;
    ctx.fillStyle="#2a0d12";ctx.fillRect(0,y,96,h);
    ctx.fillStyle="#f0575f";ctx.beginPath();ctx.arc(12,y+12,3.5,0,7);ctx.globalAlpha=.55+.45*Math.sin(T*0.1);ctx.fill();ctx.globalAlpha=1;
    ctx.font="800 10px ui-monospace,Menlo,monospace";ctx.textAlign="left";ctx.fillStyle="#ffd9dc";ctx.fillText("THE FEED",22,y+16);ctx.textAlign="center";
  }

  // ===================== ambience: the day/night cycle =====================
  function hourNow(){
    if(HHOVR!==null)return HHOVR;
    if(!snap||!snap.clock)return 12;
    var p=String(snap.clock).split(":"),h=+p[0],m=+p[1];
    if(!isFinite(h))return 12;
    return clamp(h+(isFinite(m)?m/60:0),0,24);
  }
  var AMB=[[0,[14,18,52,.46]],[5,[14,18,52,.46]],[6.6,[255,160,95,.16]],[8.2,[0,0,0,0]],[16.8,[0,0,0,0]],[18.2,[255,146,66,.14]],[19.8,[74,58,120,.30]],[21.2,[14,18,52,.46]],[24,[14,18,52,.46]]];
  function ambTint(h){
    for(var i=1;i<AMB.length;i++){
      if(h<=AMB[i][0]){
        var a=AMB[i-1],b=AMB[i],t=(h-a[0])/(b[0]-a[0]||1);
        return [lerp(a[1][0],b[1][0],t),lerp(a[1][1],b[1][1],t),lerp(a[1][2],b[1][2],t),lerp(a[1][3],b[1][3],t)];
      }
    }
    return [0,0,0,0];
  }
  function nightness(h){
    if(h>=21.2||h<5)return 1;
    if(h>=19.2)return (h-19.2)/2;
    if(h<6.8)return 1-(h-5)/1.8;
    return 0;
  }

  // ===================== ambient life =====================
  var puffs=[], birds=[], nextFlock=0, lastSmokeT=-1;
  function spawnSmoke(){
    if(!snap||T===lastSmokeT)return;
    lastSmokeT=T;
    (snap.places||[]).forEach(function(p,i){
      if(p.type!=="home")return;
      if((T+i*17)%56!==0)return;
      var g=geomOf(p);
      puffs.push({x:g.c.x+g.bw*0.22,y:g.top+g.bh*0.12,r:2.2,a:.5,vx:.06+Math.random()*.08,vy:-.24-Math.random()*.12});
    });
    if(puffs.length>60)puffs=puffs.slice(-60);
  }
  function drawSmoke(dt){
    for(var i=puffs.length-1;i>=0;i--){
      var s=puffs[i];s.x+=s.vx*dt*0.06+Math.sin(T*0.05+i)*0.08;s.y+=s.vy*dt*0.06;s.r+=dt*0.0035;s.a-=dt*0.00022;
      if(s.a<=0){puffs.splice(i,1);continue;}
      ctx.fillStyle="rgba(206,211,222,"+s.a.toFixed(3)+")";ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,7);ctx.fill();
    }
  }
  function stepBirds(now,dt,nn){
    if(nn<0.4&&now>nextFlock){
      nextFlock=now+14000+Math.random()*22000;
      var dir=Math.random()<0.5?1:-1, y0=H*0.06+Math.random()*H*0.2, n=3+Math.floor(Math.random()*3);
      for(var i=0;i<n;i++)birds.push({x:dir>0?-30-i*26:W+30+i*26,y:y0+(i%2)*12+i*4,v:dir*(0.07+Math.random()*0.03),ph:Math.random()*6});
    }
    for(var j=birds.length-1;j>=0;j--){
      var b=birds[j];b.x+=b.v*dt;b.y+=Math.sin(T*0.06+b.ph)*0.3;
      if(b.x<-60||b.x>W+60){birds.splice(j,1);continue;}
      var f=Math.sin(T*0.35+b.ph)*3.2;
      ctx.strokeStyle="rgba(38,46,60,.82)";ctx.lineWidth=1.6;ctx.beginPath();
      ctx.moveTo(b.x-5,b.y-f);ctx.quadraticCurveTo(b.x-2,b.y+2,b.x,b.y);ctx.quadraticCurveTo(b.x+2,b.y+2,b.x+5,b.y-f);ctx.stroke();
    }
  }
  function drawButterflies(nn){
    if(nn>0.15)return;
    var anchors=[{x:24,y:28},{x:73,y:63},{x:43,y:33}];
    for(var i=0;i<anchors.length;i++){
      var c=px(anchors[i]),t=T*0.03+i*2.1;
      var bx=c.x+Math.sin(t*1.3)*16,by=c.y-10+Math.sin(t*2.1)*8;
      var open=Math.abs(Math.sin(T*0.3+i));
      ctx.fillStyle=i===1?"#f5f0ff":"#ffe9a8";
      ctx.beginPath();ctx.ellipse(bx-2*open-1,by,2.4*open+0.6,1.8,0,0,7);ctx.fill();
      ctx.beginPath();ctx.ellipse(bx+2*open+1,by,2.4*open+0.6,1.8,0,0,7);ctx.fill();
    }
  }
  function drawFountainWater(g){
    var fx=g.c.x, fy=g.c.y+16, fh=propH("fountain");
    var top=fy-fh*0.72;
    for(var i=0;i<10;i++){
      var s=((T*0.9+i*13)%60)/60, dir=i%2?1:-1;
      var wx=fx+dir*s*13*(0.6+((i*7)%5)/8), wy=top-Math.sin(Math.PI*s)*13+s*15;
      ctx.fillStyle="rgba(190,233,255,"+(0.75-s*0.55).toFixed(2)+")";
      ctx.fillRect(wx,wy,2,2.6);
    }
  }

  // ===================== drawing the town =====================
  function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
  function roadSegs(){
    var sy=streetY();
    return [
      [{x:0.12*W,y:sy},{x:0.88*W,y:sy}],
      [{x:0.16*W,y:0.22*H},{x:0.16*W,y:0.84*H}],
      [{x:0.84*W,y:0.22*H},{x:0.84*W,y:0.84*H}],
      [{x:0.50*W,y:sy},{x:0.50*W,y:0.78*H}]
    ];
  }
  function drawRoads(){
    var rw=clamp(W*0.017,14,26),segs=roadSegs(),i;
    ctx.lineCap="round";
    for(var pass=0;pass<2;pass++){
      ctx.strokeStyle=pass?"#d9c496":"#b7996b";ctx.lineWidth=pass?rw:rw+6;
      for(i=0;i<segs.length;i++){ctx.beginPath();ctx.moveTo(segs[i][0].x,segs[i][0].y);ctx.lineTo(segs[i][1].x,segs[i][1].y);ctx.stroke();}
    }
  }
  var plates=[], namePlates=[];
  function drawNamePlates(){
    // nudge colliding nameplates apart so gathering scenes stay readable
    namePlates.sort(function(a,b){return a.y-b.y;});
    for(var i=0;i<namePlates.length;i++)for(var j=0;j<i;j++){
      var A=namePlates[i],B=namePlates[j];
      if(Math.abs(A.x-B.x)<64&&Math.abs(A.y-B.y)<16){A.y=B.y-18;j=-1;}
    }
    namePlates.forEach(function(p){
      ctx.textAlign="center";ctx.font="700 13px ui-sans-serif";
      var nw=ctx.measureText(p.name).width+12;
      ctx.fillStyle="rgba(10,14,20,.72)";rr(p.x-nw/2,p.y-13,nw,17,8);ctx.fill();
      ctx.fillStyle=p.sel?"#ecb44a":"#fff";ctx.fillText(p.name,p.x,p.y);
      ctx.font="13px serif";ctx.fillText(p.em,p.emX,p.emY);
    });
  }
  function plateLabel(text,x,y,dark){
    plates.push(function(){
      ctx.font="600 11px ui-sans-serif";ctx.textAlign="center";
      var w=ctx.measureText(text).width+12;
      ctx.fillStyle=dark||"rgba(10,14,20,.58)";rr(x-w/2,y-11,w,15,7);ctx.fill();
      ctx.fillStyle="rgba(255,255,255,.93)";ctx.fillText(text,x,y+1);
    });
  }
  function drawBuilding(p,g){
    if(p.type==="park"){
      ctx.fillStyle="rgba(70,140,70,.30)";ctx.beginPath();ctx.ellipse(g.c.x,g.c.y+14,g.rx,g.rx*0.5,0,0,7);ctx.fill();
      drawProp(props.tree_green,g.c.x-g.rx*0.42,g.c.y+6,60);
      drawProp(props.tree_autumn,g.c.x+g.rx*0.42,g.c.y+9,54);
      drawProp(props.bench,g.c.x,g.c.y+20,25);
      plateLabel(p.label,g.c.x,g.c.y+g.rx*0.5+22);
      return;
    }
    if(p.type==="plaza"){
      ctx.fillStyle="#cdd2da";ctx.beginPath();ctx.ellipse(g.c.x,g.c.y+8,g.rx,g.ry,0,0,7);ctx.fill();
      ctx.fillStyle="#c1c7d0";ctx.beginPath();ctx.ellipse(g.c.x,g.c.y+8,g.rx*0.7,g.ry*0.7,0,0,7);ctx.fill();
      drawProp(props.fountain,g.c.x,g.c.y+16,propH("fountain"));
      drawFountainWater(g);
      plateLabel(p.label,g.c.x,g.c.y+g.ry+16);
      return;
    }
    var im=buildings[p.id]||buildings[p.type];
    if(ok(im)){
      var s=g.bh/im.naturalHeight,w=im.naturalWidth*s;
      ctx.fillStyle="rgba(0,0,0,.18)";ctx.beginPath();ctx.ellipse(g.c.x,g.bottom+3,w*0.5,7,0,0,7);ctx.fill();
      ctx.drawImage(im,Math.round(g.c.x-w/2),Math.round(g.bottom-g.bh),Math.round(w),Math.round(g.bh));
      if(p.type==="bakery"){
        // paint the shop name onto the sprite's blank sign board
        var sx2=g.c.x,sy2=g.bottom-g.bh*0.80;
        plates.push(function(){ctx.font="700 12px ui-monospace,Menlo,monospace";ctx.textAlign="center";ctx.fillStyle="#6b4a2f";ctx.fillText(p.label.toUpperCase(),sx2,sy2);});
        return;
      }
    } else {
      var bw2=Math.max(64,W*0.075),bh2=bw2*0.72,x=g.c.x-bw2/2,y=g.bottom-bh2;
      var roof={cafe:"#c8623e",bakery:"#d9a441",home:"#7d6bb0"}[p.type]||"#8a94a6";
      ctx.fillStyle="rgba(0,0,0,.16)";rr(x+3,y+6,bw2,bh2,7);ctx.fill();
      ctx.fillStyle="#efe6d4";rr(x,y,bw2,bh2,7);ctx.fill();
      ctx.fillStyle=roof;ctx.beginPath();ctx.moveTo(x-4,y+2);ctx.lineTo(g.c.x,y-bh2*0.42);ctx.lineTo(x+bw2+4,y+2);ctx.closePath();ctx.fill();
      ctx.fillStyle="#7a5a3a";var dw=bw2*0.24;rr(g.c.x-dw/2,y+bh2-bh2*0.42,dw,bh2*0.42,3);ctx.fill();
    }
    plateLabel(p.label,g.c.x,g.bottom-g.bh-8);
  }

  function drawChar(a,sp){
    var sel=selected===a.id;
    var img=getSheet(a.id), footY=sp.y+2, topY=footY-CH;
    ctx.fillStyle="rgba(0,0,0,.25)";ctx.beginPath();ctx.ellipse(sp.x,footY-3,13,5,0,0,7);ctx.fill();
    if(sel){ctx.strokeStyle="#ecb44a";ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(sp.x,footY-3,17,7,0,0,7);ctx.stroke();}
    if(ok(img)){
      var band=sp.moving?WALK_Y:IDLE_Y;
      var fcol=sp.moving?Math.floor(T/6)%6:Math.floor(T/16)%6;
      var sx=(DIRCOL[sp.dir||"D"]+fcol)*32;
      ctx.drawImage(img,sx,band,32,64,Math.round(sp.x-CW/2),Math.round(topY),CW,CH);
    } else {
      ctx.fillStyle=color(a.id);ctx.beginPath();ctx.arc(sp.x,footY-22,13,0,7);ctx.fill();
    }
    namePlates.push({x:sp.x,y:topY-4,name:a.name,sel:sel,em:emojiFor(a.action),emX:sp.x+CW/2+6,emY:topY+16});
  }

  // --- sprite movement: constant-speed walking + idle micro-wander ---
  function stepSprite(sp,dt,now){
    var speed=clamp(W*0.045,46,72)/1000;
    sp.moving=false;
    if(sp.path&&sp.path.length){
      var t=sp.path[0],dx=t.x-sp.x,dy=t.y-sp.y,d=Math.hypot(dx,dy),step=speed*dt;
      if(d<=step||d<1.5){sp.x=t.x;sp.y=t.y;sp.path.shift();if(!sp.path.length){sp.path=null;sp.idleAt=now+5000+Math.random()*8000;sp.dir="D";}}
      else {sp.x+=dx/d*step;sp.y+=dy/d*step;sp.dir=Math.abs(dx)>Math.abs(dy)?(dx<0?"L":"R"):(dy<0?"U":"D");}
      sp.moving=true;
    } else {
      var partner=sp.a&&pairs[sp.a.id]?sprites[pairs[sp.a.id]]:null;
      if(partner){sp.dir=partner.x<sp.x?"L":"R";}
      else if(now>sp.idleAt&&sp.slot){
        sp.idleAt=now+6000+Math.random()*9000;
        var ox=(Math.random()*2-1)*20,oy=(Math.random()*2-1)*9;
        sp.path=[{x:sp.slot.x+ox,y:sp.slot.y+oy}];
      }
    }
  }

  var lastTs=0;
  function frame(ts){
    if(stage.clientWidth!==W||stage.clientHeight!==H)resize();
    var dt=clamp(ts-lastTs||16,1,50);lastTs=ts;
    // time-based phase counter (~one unit per 60Hz frame) so 120Hz displays
    // don't animate everything at double speed
    T=Math.floor(ts*0.06);var now=ts;
    ctx.imageSmoothingEnabled=false;
    // grass
    for(var gy=0;gy<H;gy+=44)for(var gx=0;gx<W;gx+=44){ctx.fillStyle=((gx+gy)/44)%2?"#7bbf6a":"#74b863";ctx.fillRect(gx,gy,44,44);}
    plates=[];namePlates=[];
    if(snap){
      var h=HHOVR!==null?HHOVR:hourNow(), tint=ambTint(h), nn=nightness(h);
      drawRoads();
      stepBeats(now);
      // painter list: props + buildings + characters, sorted by baseline
      var items=[];
      SCATTER.forEach(function(d){var c=px(d);items.push({y:c.y,f:function(){drawProp(props[d.k],c.x,c.y,propH(d.k));}});});
      var placeGeom={};
      (snap.places||[]).forEach(function(p){var g=geomOf(p);placeGeom[p.id]=g;items.push({y:g.base,f:function(){drawBuilding(p,g);}});});
      Object.keys(sprites).forEach(function(id){
        var sp=sprites[id];stepSprite(sp,dt,now);
        if(sp.a)items.push({y:sp.y,f:function(){drawChar(sp.a,sp);}});
      });
      items.sort(function(a,b){return a.y-b.y;});
      items.forEach(function(it){it.f();});
      // ambient life above the world
      spawnSmoke();drawSmoke(dt);
      stepBirds(now,dt,nn);
      drawButterflies(nn);
      // day/night grade
      if(tint[3]>0.004){ctx.fillStyle="rgba("+Math.round(tint[0])+","+Math.round(tint[1])+","+Math.round(tint[2])+","+tint[3].toFixed(3)+")";ctx.fillRect(0,0,W,H);}
      if(nn>0.02){
        ctx.save();ctx.globalCompositeOperation="lighter";
        SCATTER.forEach(function(d){
          if(d.k!=="lamp")return;var c=px(d),ly=c.y-propH("lamp")*0.74;
          var g2=ctx.createRadialGradient(c.x,ly,2,c.x,ly,46);
          g2.addColorStop(0,"rgba(255,196,110,"+(0.5*nn).toFixed(2)+")");g2.addColorStop(1,"rgba(255,196,110,0)");
          ctx.fillStyle=g2;ctx.beginPath();ctx.arc(c.x,ly,46,0,7);ctx.fill();
        });
        (snap.places||[]).forEach(function(p){
          if(p.type==="park"||p.type==="plaza")return;var g=placeGeom[p.id];if(!g)return;
          var wy=g.bottom-g.bh*0.30;
          var g3=ctx.createRadialGradient(g.c.x,wy,3,g.c.x,wy,g.bh*0.42);
          g3.addColorStop(0,"rgba(255,190,96,"+(0.24*nn).toFixed(2)+")");g3.addColorStop(1,"rgba(255,190,96,0)");
          ctx.fillStyle=g3;ctx.beginPath();ctx.arc(g.c.x,wy,g.bh*0.42,0,7);ctx.fill();
        });
        ctx.restore();
        for(var si=0;si<stars.length;si++){
          var st=stars[si];
          ctx.globalAlpha=nn*(0.4+0.6*Math.abs(Math.sin(T*0.02+st.ph)));
          ctx.fillStyle="#eef3ff";ctx.fillRect(st.x,st.y,st.r,st.r);
        }
        ctx.globalAlpha=1;
        if(nn>0.5){
          ctx.fillStyle="rgba(245,240,220,"+(0.9*nn).toFixed(2)+")";ctx.beginPath();ctx.arc(W*0.91,44,12,0,7);ctx.fill();
          var mg=ctx.createRadialGradient(W*0.91,44,12,W*0.91,44,34);
          mg.addColorStop(0,"rgba(245,240,220,"+(0.25*nn).toFixed(2)+")");mg.addColorStop(1,"rgba(245,240,220,0)");
          ctx.fillStyle=mg;ctx.beginPath();ctx.arc(W*0.91,44,34,0,7);ctx.fill();
        }
      }
      // nameplates, labels, bubbles, chyron — always readable, above the grade
      plates.forEach(function(f){f();});
      drawNamePlates();
      if(cur){
        var ssp=sprites[cur.sid];
        if(ssp)drawBubble(ssp,cur);
        // listener "…" only when the pair is really mid-conversation and far
        // enough apart that the pill can't sit on the speaker's bubble text
        var lsp=(cur.kind==="say"&&cur.lid&&pairs[cur.sid]===cur.lid)?sprites[cur.lid]:null;
        if(lsp&&ssp&&Math.hypot(lsp.x-ssp.x,lsp.y-ssp.y)>140)drawDots(lsp);
      }
      drawChyron(dt);
    } else {
      ctx.fillStyle="rgba(0,0,0,.5)";ctx.font="14px ui-sans-serif";ctx.textAlign="center";
      ctx.fillText(lastErr||"connecting to the town…",W/2,H/2);
    }
    requestAnimationFrame(frame);
  }

  canvas.addEventListener("click",function(e){
    var r=canvas.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top,best=null,bd=1e9;
    Object.keys(sprites).forEach(function(id){var sp=sprites[id];var d=Math.hypot(sp.x-mx,(sp.y-26)-my);if(d<38&&d<bd){bd=d;best=id;}});
    selected=best; document.getElementById("hint").style.display=best?"none":"block"; renderPanel();
  });

  function esc(s){return (s==null?"":String(s)).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"}[c];});}

  function renderPanel(){
    var el=document.getElementById("panel"); if(!snap){el.innerHTML="";return;}
    // never wipe a reply in progress: the poll re-render must not eat user input
    var ae=document.activeElement, rin0=document.getElementById("rin");
    if(rin0&&(rin0.value||ae===rin0||(ae&&ae.id==="rbtn")))return;
    var nameOf={}; (snap.agents||[]).forEach(function(a){nameOf[a.id]=a.name;});
    var placeOf={}; (snap.places||[]).forEach(function(p){placeOf[p.id]=p.label;});
    if(!selected){
      var sceneHtml="";
      var pk=Object.keys(pairs).filter(function(id){return id<pairs[id];})[0];
      if(pk){
        var pa=(snap.agents||[]).filter(function(x){return x.id===pk;})[0];
        sceneHtml='<div class="scene">🎬 LIVE SCENE · '+esc(nameOf[pk])+' &amp; '+esc(nameOf[pairs[pk]])+(pa?' at '+esc(placeOf[pa.location]||pa.location):"")+'</div>';
      }
      var roster=(snap.agents||[]).map(function(a){return '<div class="rrow" data-id="'+a.id+'"><span class="rdot" style="background:'+color(a.id)+'"></span><div style="min-width:0"><div class="rn">'+esc(a.name)+'</div><div class="ra">'+emojiFor(a.action)+" "+esc(a.action)+'</div></div></div>';}).join("");
      var hls=(snap.highlights||[]).slice(0,5).map(function(b){return '<div class="hl">'+esc(b.text)+'</div>';}).join("")||'<div class="hl">the day is just beginning…</div>';
      var bonds=(snap.relationships||[]).slice().sort(function(a,b){return b.weight-a.weight;}).slice(0,6).map(function(e){
        var hearts="";for(var i2=0;i2<Math.min(5,e.weight);i2++)hearts+="♥";
        return '<div class="bond"><span>'+esc(nameOf[e.a]||e.a)+' ↔ '+esc(nameOf[e.b]||e.b)+'</span><span class="hearts">'+hearts+'</span></div>';
      }).join("");
      el.innerHTML='<div class="ptitle">The Town · Today</div>'+sceneHtml+'<div class="roster">'+roster+'</div>'+
        '<div class="sec"><div class="h">Today\\'s drama</div>'+hls+'</div>'+
        (bonds?'<div class="sec"><div class="h">Bonds</div>'+bonds+'</div>':"");
      Array.prototype.forEach.call(el.querySelectorAll(".rrow"),function(row){row.onclick=function(){selected=row.getAttribute("data-id");document.getElementById("hint").style.display="none";renderPanel();};});
      return;
    }
    var a=(snap.agents||[]).filter(function(x){return x.id===selected;})[0];
    if(!a){selected=null;return renderPanel();}
    var place=(snap.places||[]).filter(function(p){return p.id===a.location;})[0];
    var mems=(snap.ticker||[]).filter(function(t){return t.agentId===selected;}).slice(0,8);
    var posts=(snap.feed||[]).filter(function(p){return p.agentId===selected;});
    var memHtml=mems.map(function(m){return '<div class="mem"><span class="kd" style="color:'+(KIND_COLOR[m.kind]||"#888")+'">'+esc(m.kind)+'</span>'+esc(m.text)+'</div>';}).join("")||'<div class="mem" style="color:var(--dim)">quiet mind so far…</div>';
    var postHtml=posts.map(function(p){return '<div class="post">'+esc(p.text)+' <span style="color:var(--dim);font-size:11px">· '+p.replies+' repl'+(p.replies===1?"y":"ies")+'</span></div>';}).join("")||'<div style="color:var(--dim);font-size:12px">no posts yet</div>';
    el.innerHTML=
      '<div class="back" id="back">← back to town</div>'+
      '<div class="who" style="margin-top:10px"><span class="avatar" style="background:'+color(a.id)+'"></span><div><div class="wn">'+esc(a.name)+'</div><div class="wl">'+emojiFor(a.action)+" at "+esc(place?place.label:a.location)+'</div></div></div>'+
      '<div class="doing"><div class="k">Right now</div>'+esc(a.action)+(a.planActivity?'<div style="color:var(--dim);margin-top:5px;font-size:12px">📋 plan: '+esc(a.planActivity)+'</div>':"")+'</div>'+
      '<div class="sec"><div class="h">💬 Say something to '+esc(a.name)+'</div><div class="replybox"><input id="rin" maxlength="240" placeholder="a message they\\'ll remember…"/><button id="rbtn">Send</button></div><div class="replymsg" id="rmsg">Your reply becomes a memory that can change what they do next.</div></div>'+
      '<div class="sec"><div class="h">Their thoughts</div>'+memHtml+'</div>'+
      '<div class="sec"><div class="h">Their posts</div>'+postHtml+'</div>';
    document.getElementById("back").onclick=function(){selected=null;document.getElementById("hint").style.display="block";renderPanel();};
    var btn=document.getElementById("rbtn"),inp=document.getElementById("rin"),msg=document.getElementById("rmsg");
    function send(){var text=inp.value.trim();if(!text)return;btn.disabled=true;msg.textContent="sending…";
      fetch(base()+"/reply",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({agentId:a.id,handle:"guest",text:text})})
        .then(function(r){return r.json();}).then(function(res){btn.disabled=false;
          if(res.ok){inp.value="";msg.innerHTML='✓ '+esc(a.name)+" heard you (salience "+res.importance+"). Watch for it in their thoughts.";}
          else{msg.textContent="✗ "+(res.reason||"not sent");}}).catch(function(){btn.disabled=false;msg.textContent="✗ network error";});}
    btn.onclick=send; inp.onkeydown=function(e){if(e.key==="Enter")send();};
  }

  function poll(){
    fetch(base()+"/snapshot.json",{cache:"no-store"}).then(function(r){return r.json();}).then(function(s){lastErr="";if(s&&s.agents)ingest(s);})
      .catch(function(e){lastErr="waiting for the world…";});
  }
  resize();requestAnimationFrame(frame);
  if(EMBEDDED&&EMBEDDED.agents)ingest(EMBEDDED);
  poll();setInterval(poll,4000);
})();
</script>
</body></html>`;
}
