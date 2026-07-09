/**
 * The spectator app — a self-contained, dependency-free HTML page that renders
 * the town on a canvas and polls /snapshot.json for the live world. Characters
 * walk between buildings as their plans unfold; click one to follow their
 * thoughts, plan, posts, and reply to them (the audience-coupling, made visible).
 *
 * Served at GET / by the spectator server. No external assets (CSP-safe). When
 * opened as a local file it falls back to the deployed origin (CORS-enabled).
 */
export function renderAppHtml(deployOrigin = "http://47.237.78.57", embedded: unknown = null): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>The Feed — a town of AI minds</title>
<style>
  :root{
    --bg:#12151c; --panel:#171b24; --panel2:#1e2431; --line:#2a3140; --ink:#eef1f6; --dim:#95a0b3; --amber:#ecb44a; --live:#f0575f;
    --grass:#7bbf6a; --grass2:#71b661; --path:#d8c39a; --water:#6fb7d8;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%;background:var(--bg);color:var(--ink);font-family:ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif;overflow:hidden}
  #app{display:flex;flex-direction:column;height:100vh;height:100dvh}
  header{display:flex;align-items:center;gap:14px;padding:10px 16px;background:var(--panel);border-bottom:1px solid var(--line);flex:0 0 auto}
  .live{display:inline-flex;align-items:center;gap:7px;color:var(--live);font-weight:700;font-size:12px;letter-spacing:.12em;font-family:ui-monospace,Menlo,monospace}
  .dot{width:9px;height:9px;border-radius:50%;background:var(--live);animation:pulse 1.6s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
  h1{font-size:17px;font-weight:800;letter-spacing:.02em}
  h1 b{color:var(--amber)}
  .clock{margin-left:auto;font-family:ui-monospace,Menlo,monospace;color:var(--dim);font-size:13px}
  .stat{font-family:ui-monospace,Menlo,monospace;color:var(--dim);font-size:12px}
  main{flex:1;display:flex;min-height:0}
  #stage{position:relative;flex:1;min-width:0;background:var(--grass)}
  canvas{display:block;width:100%;height:100%;touch-action:manipulation}
  #hint{position:absolute;left:12px;bottom:12px;background:rgba(0,0,0,.5);color:#fff;font-size:12px;padding:6px 10px;border-radius:8px;pointer-events:none}
  aside{flex:0 0 340px;background:var(--panel);border-left:1px solid var(--line);display:flex;flex-direction:column;min-height:0}
  .apanel{padding:14px 15px;overflow-y:auto;flex:1;min-height:0;-webkit-overflow-scrolling:touch}
  @media(max-width:980px){aside{flex-basis:300px}}
  @media(max-width:760px){
    main{flex-direction:column}
    #stage{flex:0 0 54dvh;min-height:240px}
    aside{flex:1 1 auto;flex-basis:auto;border-left:none;border-top:1px solid var(--line)}
    header{flex-wrap:wrap;gap:6px 12px;padding:8px 12px}
    h1{font-size:16px}.stat{flex-basis:100%;order:9}
    #hint{font-size:11px;left:8px;bottom:8px}
  }
  .ptitle{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);margin:2px 0 10px}
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
  .back{color:var(--amber);cursor:pointer;font-size:12px;font-weight:700}
  .ticker{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;color:var(--dim)}
  .ticker .t{padding:5px 0;border-bottom:1px solid var(--line)}
</style></head>
<body><div id="app">
  <header>
    <span class="live"><span class="dot"></span>LIVE</span>
    <h1>The <b>Feed</b></h1>
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
  var T=0, sheets={};
  function getSheet(id){var i=(hue(id)%5)+1;if(!sheets[i]){var im=new Image();im.src=base()+"/assets/characters/c"+i+".png";sheets[i]=im;}return sheets[i];}

  // --- decoration layer: real LimeZu props scattered to make it a lived-in town ---
  var props={};
  var SCATTER=[
    {k:"tree_green",x:9,y:13},{k:"tree_autumn",x:23,y:7},{k:"tree_green",x:39,y:9},{k:"tree_autumn",x:57,y:7},{k:"tree_green",x:73,y:9},{k:"tree_autumn",x:91,y:13},
    {k:"tree_green",x:5,y:31},{k:"tree_autumn",x:95,y:33},{k:"tree_autumn",x:6,y:56},{k:"tree_green",x:94,y:59},
    {k:"tree_green",x:18,y:92},{k:"tree_autumn",x:33,y:94},{k:"tree_green",x:67,y:94},{k:"tree_autumn",x:83,y:92},
    {k:"lamp",x:40,y:63},{k:"lamp",x:61,y:61},
    {k:"bush_pink",x:28,y:36},{k:"bush_white",x:73,y:33},{k:"bush_pink",x:47,y:67},
    {k:"flowers",x:32,y:22},{k:"flowers",x:69,y:21},{k:"flowers",x:23,y:47},{k:"flowers",x:79,y:50},{k:"flowers",x:50,y:88},{k:"flowers",x:36,y:71},{k:"flowers",x:64,y:70}
  ];
  function propH(k){return k.slice(0,4)==="tree"?58:k==="lamp"?52:k==="fountain"?48:(k==="bush_pink"||k==="bush_white")?15:k==="bench"?24:16;}
  function drawProp(im,cx,cy,h){if(!(im&&im.complete&&im.naturalWidth))return;var s=h/im.naturalHeight,w=im.naturalWidth*s;ctx.drawImage(im,Math.round(cx-w/2),Math.round(cy-h),Math.round(w),Math.round(h));}

  var canvas=document.getElementById("c"), ctx=canvas.getContext("2d");
  var stage=document.getElementById("stage");
  var W=0,H=0,DPR=Math.min(2,window.devicePixelRatio||1);
  function resize(){W=stage.clientWidth;H=stage.clientHeight;canvas.width=W*DPR;canvas.height=H*DPR;canvas.style.width=W+"px";canvas.style.height=H+"px";ctx.setTransform(DPR,0,0,DPR,0,0);}
  window.addEventListener("resize",resize);

  var snap=null, sprites={}, selected=null, lastErr="";
  function px(p){return {x:p.x/100*W, y:p.y/100*H};}

  function ingest(s){
    snap=s;
    document.getElementById("clock").textContent="🕗 "+(s.clock||"--:--");
    document.getElementById("stat").textContent=(s.stats?(s.stats.agents+" souls · "+s.stats.memories+" memories · "+s.stats.edges+" bonds"):"");
    var places={}; (s.places||[]).forEach(function(p){places[p.id]=p;});
    // per-place fan-out so co-located characters don't overlap
    var atPlace={}; (s.agents||[]).forEach(function(a){atPlace[a.location]=(atPlace[a.location]||[]).concat(a.id);});
    (s.agents||[]).forEach(function(a){
      var pl=places[a.location]||places.plaza||{x:50,y:50};
      var group=atPlace[a.location], idx=group.indexOf(a.id), n=group.length;
      var c=px({x:pl.x, y:pl.y});
      // stand in a row IN FRONT OF (below) the building; pixel-based gap so
      // co-located folks never merge into one blob regardless of screen size.
      var spreadPx=(n>1?(idx-(n-1)/2):0)*54;
      var downPx=Math.max(44, H*0.05);
      var t={x:c.x+spreadPx, y:c.y+downPx};
      var sp=sprites[a.id]||(sprites[a.id]={x:t.x,y:t.y,tx:t.x,ty:t.y});
      sp.tx=t.x; sp.ty=t.y; sp.a=a;
    });
    // drop gone agents
    Object.keys(sprites).forEach(function(id){ if(!(s.agents||[]).some(function(a){return a.id===id;})) delete sprites[id]; });
    renderPanel();
  }

  function drawBuilding(p){
    var c=px(p), w=Math.max(40,W*0.066), h=w*0.72;
    var x=c.x-w/2, y=c.y-h/2;
    var roof={cafe:"#c8623e",bakery:"#d9a441",home:"#7d6bb0",plaza:"#8a94a6",park:"#4f9d54"}[p.type]||"#8a94a6";
    var wall={cafe:"#efe3d0",bakery:"#f2ead2",home:"#e7e2ef",plaza:"#d9dde4",park:"#cfeccd"}[p.type]||"#e7e2ef";
    if(p.type==="park"){
      // a little grove + bench instead of a flat disc
      ctx.fillStyle="rgba(70,140,70,.28)";ctx.beginPath();ctx.ellipse(c.x,c.y+16,w*0.78,w*0.44,0,0,7);ctx.fill();
      drawProp(props.tree_green,c.x-17,c.y+9,56);
      drawProp(props.tree_autumn,c.x+17,c.y+11,52);
      drawProp(props.bench,c.x,c.y+22,24);
    } else if(p.type==="plaza"){
      // paved circle + a real stone fountain
      ctx.fillStyle="#cdd2da";ctx.beginPath();ctx.arc(c.x,c.y+6,w*0.64,0,7);ctx.fill();
      ctx.fillStyle="#c1c7d0";ctx.beginPath();ctx.arc(c.x,c.y+6,w*0.46,0,7);ctx.fill();
      drawProp(props.fountain,c.x,c.y+14,48);
    } else {
      // shadow, wall, roof
      ctx.fillStyle="rgba(0,0,0,.16)";rr(x+3,y+6,w,h,7);ctx.fill();
      ctx.fillStyle=wall;rr(x,y,w,h,7);ctx.fill();
      ctx.fillStyle=roof;ctx.beginPath();ctx.moveTo(x-4,y+2);ctx.lineTo(c.x,y-h*0.42);ctx.lineTo(x+w+4,y+2);ctx.closePath();ctx.fill();
      ctx.fillStyle="#7a5a3a";var dw=w*0.24;rr(c.x-dw/2,y+h-h*0.42,dw,h*0.42,3);ctx.fill();
      ctx.fillStyle="#bfe0ef";rr(x+w*0.14,y+h*0.28,w*0.2,h*0.24,3);ctx.fill();rr(x+w*0.66,y+h*0.28,w*0.2,h*0.24,3);ctx.fill();
    }
    ctx.fillStyle="rgba(0,0,0,.62)";ctx.font="600 12px ui-sans-serif";ctx.textAlign="center";
    var ly=p.type==="park"||p.type==="plaza"?c.y+w*0.55+13:y+h+15;
    ctx.fillText(p.label,c.x,ly);
  }
  function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}

  function drawChar(a,sp){
    var talking=/talking|chat|conversation/i.test(a.action||"");
    var sel=selected===a.id;
    var img=getSheet(a.id), dw=40,dh=40, footY=sp.y+2, topY=footY-dh;
    // shadow + selection ring at the feet
    ctx.fillStyle="rgba(0,0,0,.25)";ctx.beginPath();ctx.ellipse(sp.x,footY-4,15,6,0,0,7);ctx.fill();
    if(sel){ctx.strokeStyle="#ecb44a";ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(sp.x,footY-4,18,7,0,0,7);ctx.stroke();}
    if(img&&img.complete&&img.naturalWidth){
      var fcol=sp.moving?Math.floor(T/7)%6:0, sx=fcol*32;
      ctx.save();
      if(sp.face===-1){ctx.translate(sp.x,0);ctx.scale(-1,1);ctx.translate(-sp.x,0);}
      ctx.drawImage(img,sx,0,32,32,sp.x-dw/2,topY,dw,dh);
      ctx.restore();
    } else { // fallback figure while the sheet loads
      ctx.fillStyle=color(a.id);ctx.beginPath();ctx.arc(sp.x,footY-22,13,0,7);ctx.fill();
    }
    // name plate above the head
    ctx.textAlign="center";ctx.font="700 13px ui-sans-serif";
    var nw=ctx.measureText(a.name).width+12, ny=topY+8;
    ctx.fillStyle="rgba(10,14,20,.72)";rr(sp.x-nw/2,ny-13,nw,17,8);ctx.fill();
    ctx.fillStyle=sel?"#ecb44a":"#fff";ctx.fillText(a.name,sp.x,ny);
    // activity emoji badge
    ctx.font="16px serif";ctx.fillText(emojiFor(a.action),sp.x+dw/2-6,footY-dh/2);
    // speech bubble
    if(talking){ctx.fillStyle="#fff";rr(sp.x+dw/2-8,topY+14,22,16,7);ctx.fill();ctx.fillStyle="#333";ctx.font="12px serif";ctx.fillText("💬",sp.x+dw/2+3,topY+26);}
  }

  function frame(){
    if(!W||!H)resize();
    T++; ctx.imageSmoothingEnabled=false;
    // grass with subtle checker
    for(var gy=0;gy<H;gy+=44)for(var gx=0;gx<W;gx+=44){ctx.fillStyle=((gx+gy)/44)%2?"#7bbf6a":"#74b863";ctx.fillRect(gx,gy,44,44);}
    if(snap){
      // paths from plaza to each place
      var plaza=(snap.places||[]).filter(function(p){return p.id==="plaza";})[0];
      if(plaza){var pc=px(plaza);ctx.strokeStyle="rgba(216,195,154,.85)";ctx.lineWidth=10;ctx.lineCap="round";
        (snap.places||[]).forEach(function(p){if(p.id!=="plaza"){var c=px(p);ctx.beginPath();ctx.moveTo(pc.x,pc.y);ctx.lineTo(c.x,c.y);ctx.stroke();}});}
      // decoration layer (edge trees, lamps, bushes, flowers) — behind buildings & people
      SCATTER.forEach(function(d){var c=px(d);drawProp(props[d.k],c.x,c.y,propH(d.k));});
      (snap.places||[]).forEach(drawBuilding);
      // move + draw characters (sorted by y for depth)
      var list=Object.keys(sprites).map(function(id){return sprites[id];}).sort(function(a,b){return a.y-b.y;});
      list.forEach(function(sp){var dx=sp.tx-sp.x,dy=sp.ty-sp.y;sp.moving=Math.hypot(dx,dy)>1.5;if(Math.abs(dx)>0.6)sp.face=dx<0?-1:1;sp.x+=dx*0.08;sp.y+=dy*0.08;if(sp.a)drawChar(sp.a,sp);});
    } else {
      ctx.fillStyle="rgba(0,0,0,.5)";ctx.font="14px ui-sans-serif";ctx.textAlign="center";
      ctx.fillText(lastErr||"connecting to the town…",W/2,H/2);
    }
    requestAnimationFrame(frame);
  }

  canvas.addEventListener("click",function(e){
    var r=canvas.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top,best=null,bd=1e9;
    Object.keys(sprites).forEach(function(id){var sp=sprites[id];var d=Math.hypot(sp.x-mx,sp.y-my);if(d<34&&d<bd){bd=d;best=id;}});
    selected=best; document.getElementById("hint").style.display=best?"none":"block"; renderPanel();
  });

  function esc(s){return (s==null?"":String(s)).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"}[c];});}

  function renderPanel(){
    var el=document.getElementById("panel"); if(!snap){el.innerHTML="";return;}
    if(!selected){
      var roster=(snap.agents||[]).map(function(a){return '<div class="rrow" data-id="'+a.id+'"><span class="rdot" style="background:'+color(a.id)+'"></span><div style="min-width:0"><div class="rn">'+esc(a.name)+'</div><div class="ra">'+emojiFor(a.action)+" "+esc(a.action)+'</div></div></div>';}).join("");
      var hls=(snap.highlights||[]).slice(0,5).map(function(b){return '<div class="hl">'+esc(b.text)+'</div>';}).join("")||'<div class="hl">the day is just beginning…</div>';
      el.innerHTML='<div class="ptitle">The Town · Today</div><div class="roster">'+roster+'</div>'+
        '<div class="sec"><div class="h">Today\\'s highlights</div>'+hls+'</div>';
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

  function base(){return (location.protocol==="file:")?DEPLOY:"";}
  function poll(){
    fetch(base()+"/snapshot.json",{cache:"no-store"}).then(function(r){return r.json();}).then(function(s){lastErr="";if(s&&s.agents)ingest(s);})
      .catch(function(e){lastErr="waiting for the world…";});
  }
  for(var _p=1;_p<=5;_p++){var _im=new Image();_im.src=base()+"/assets/characters/c"+_p+".png";sheets[_p]=_im;}
  ["tree_green","tree_autumn","bush_pink","bush_white","bench","flowers","fountain","lamp"].forEach(function(n){var im=new Image();im.src=base()+"/assets/props/"+n+".png";props[n]=im;});
  resize();frame();
  if(EMBEDDED&&EMBEDDED.agents)ingest(EMBEDDED);
  poll();setInterval(poll,4000);
})();
</script>
</body></html>`;
}
