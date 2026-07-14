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
 * Served at GET / by the spectator server. No external assets load by default
 * (CSP-safe); the opt-in voices toggle dynamically imports Kokoro TTS from the
 * jsdelivr CDN and runs it in the viewer's browser (WebGPU, WASM fallback).
 * When opened as a local file it falls back to the deployed origin (CORS-enabled).
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
  #vbtn{margin-left:auto;background:var(--panel2);border:1px solid var(--line);border-radius:8px;color:var(--dim);padding:5px 10px;font-size:12px;cursor:pointer;white-space:nowrap}
  #vbtn.on{color:#8fd49a;border-color:#3a5c42}
  #vbtn.busy{color:var(--amber)}
  .clock{font-family:ui-monospace,Menlo,monospace;color:var(--dim);font-size:13px;white-space:nowrap}
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
  .story{background:linear-gradient(120deg,#241a12,#1a1e28);border:1px solid #4a3a24;border-radius:10px;padding:10px 12px;margin-bottom:12px}
  .story .st{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--amber);font-weight:800;margin-bottom:5px}
  .story .sp{font-size:12px;line-height:1.5;color:#d9cbb2}
  .ra2{font-size:11px;color:#7f8ba0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-style:italic}
  .bio{background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:9px 11px;margin:8px 0;font-size:12.5px;line-height:1.5}
  .bio .role{color:var(--ink);font-weight:600}
  .bio .traits{color:var(--dim);margin-top:3px}
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
    <button id="vbtn" title="Kokoro TTS runs in your browser — one-time ~110MB download">🔇 voices</button>
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
  var HHOVR=null,DBG=false,NOCOLD=false,WXOVR=null; try{var usp=new URLSearchParams(location.search);var q=usp.get("hh"); if(q!==null&&q!==""&&isFinite(+q))HHOVR=clamp(+q,0,23.99);DBG=usp.get("dbg")==="1";NOCOLD=usp.get("nocold")==="1";var wq=usp.get("wx");if(wq==="rain"||wq==="overcast"||wq==="clear")WXOVR=wq;}catch(e){}
  function wxNow(){return WXOVR||((snap&&snap.weather)||"clear");}

  // --- image assets: character sheets, legacy props, LimeZu buildings + CITY set ---
  var props={}, buildings={}, citybld={};
  var BLDG={cafe:"cafe",bakery:"bakery",maya_home:"home1",tom_home:"home2",ana_home:"home3",leo_home:"home4"};
  ["tree_green","tree_autumn","bush_pink","bush_white","bench","flowers","fountain","lamp"].forEach(function(n){props[n]=loadImg(base()+"/assets/props/"+n+".png");});
  ["table_umbrella","stall"].forEach(function(n){props[n]=loadImg(base()+"/assets/buildings/"+n+".png");});
  Object.keys(BLDG).forEach(function(k){buildings[k]=loadImg(base()+"/assets/buildings/"+BLDG[k]+".png");});
  // NEW: the staged LimeZu city set — served from /assets/city/<slot>.png
  var CITY_PROP=["car_a","car_b","car_c","car_d","traffic_light","hydrant","bus_stop","mailbox","trash_bin","planter","city_bench","bench_b","street_sign","phone_booth","streetlamp_modern","tree_city","vending","park_statue","pigeons"];
  var CITY_BLD=["shop_a","shop_b","shop_c","office","civic","hotel","house_a","house_b"];
  CITY_PROP.forEach(function(n){props[n]=loadImg(base()+"/assets/city/"+n+".png");});
  CITY_BLD.forEach(function(n){citybld[n]=loadImg(base()+"/assets/city/"+n+".png");});
  // manifest draw-heights (px at the reference unit 176) for every new city slot
  var DRAWH={shop_a:120,shop_b:120,shop_c:120,office:175,civic:165,hotel:190,house_a:140,house_b:130,
    car_a:40,car_b:40,car_c:40,car_d:40,traffic_light:72,hydrant:44,bus_stop:60,mailbox:44,trash_bin:44,planter:26,
    city_bench:40,bench_b:40,street_sign:48,phone_booth:84,streetlamp_modern:92,tree_city:84,
    vending:54,park_statue:110,pigeons:16};
  function ok(im){return im&&im.complete&&im.naturalWidth>0;}

  // ======================= the CITY layout plan (percent coords) =======================
  var MOBILE_W=560;
  function isMobile(){return W<MOBILE_W;}
  function shown(o){return o.mobile!==false||!isMobile();}
  // street graph (Manhattan): two horizontal corridors + vertical rails
  var HSTREETS=[
    {y:48,x1:6,x2:94,kind:"main"},
    {y:70,x1:8,x2:92,kind:"side",mobile:false}   // the promenade (plaza-south)
  ];
  var VSTREETS=[
    {x:13,y1:19,y2:85,kind:"side"},               // west residential ave
    {x:87,y1:19,y2:85,kind:"side"},               // east residential ave
    {x:50,y1:48,y2:88,kind:"main"}                // center boulevard
    // NB: no cross-streets at x=30/x=70 — the DINER (shop_c) and clock tower
    // (civic) sit there on the downtown sidewalk; a road under them read as a
    // building standing in the middle of the street.
  ];
  var CROSSWALKS=[
    {x:50,y:48,dir:"v"},                          // the rivalry crossing @ MAIN
    {x:13,y:48,dir:"h"},
    {x:87,y:48,dir:"h"},
    {x:50,y:70,dir:"v",mobile:false}
  ];
  var DISTRICT={x1:8,y1:42,x2:92,y2:73};          // paved downtown rectangle
  // decorative buildings (desktop only). x/hScale nudged from the raw plan so that
  // NOTHING overlaps at real canvas heights (H~=755, not the plan's 1500 — towers
  // are ~2x taller in %H there). Verified collision-free across W 560..1280.
  var DECOR=[
    {id:"office",  slot:"office", x:22, y:34, hScale:1.15, mobile:false},
    {id:"hotel",   slot:"hotel",  x:78, y:34, hScale:0.95, mobile:false},
    {id:"shop_a",  slot:"shop_a", x:31, y:35, hScale:1.00, sign:"FLOWERS", mobile:false},
    {id:"shop_b",  slot:"shop_b", x:68, y:35, hScale:1.00, sign:"BOOKS", mobile:false},
    {id:"shop_c",  slot:"shop_c", x:30, y:58, hScale:1.00, sign:"DINER", mobile:false},
    {id:"civic",   slot:"civic",  x:68, y:58, hScale:0.95, mobile:false},
    {id:"house_bl",slot:"house_b",x:28, y:82, hScale:0.85, mobile:false},
    {id:"house_br",slot:"house_a",x:74, y:82, hScale:0.85, mobile:false}
  ];
  // props: cars, signage, sidewalk furniture, terraces, benches, lamps, greenery.
  // legacy slots keep propH heights; new city slots use manifest DRAWH*m; flip
  // mirrors the sprite around its own x.
  var PROPS=[
    {slot:"car_a",x:23,y:46},{slot:"car_b",x:77,y:46},
    {slot:"car_b",x:35,y:51,flip:true,mobile:false},{slot:"car_a",x:66,y:51,flip:true,mobile:false},
    {slot:"car_c",x:59,y:46,mobile:false},{slot:"car_d",x:21,y:69,mobile:false},
    {slot:"vending",x:81,y:51,mobile:false},
    {slot:"park_statue",x:43,y:87,mobile:false},
    {slot:"bench_b",x:36,y:69,mobile:false},{slot:"bench_b",x:64,y:69,flip:true,mobile:false},
    {slot:"pigeons",x:50,y:67},{slot:"pigeons",x:26,y:47,mobile:false},
    {slot:"traffic_light",x:46,y:46},{slot:"traffic_light",x:30,y:45,mobile:false},{slot:"traffic_light",x:70,y:45,flip:true,mobile:false},
    {slot:"street_sign",x:13,y:44},{slot:"street_sign",x:87,y:44,flip:true},
    {slot:"bus_stop",x:16,y:50},
    {slot:"phone_booth",x:20,y:50,mobile:false},
    {slot:"hydrant",x:44,y:51},{slot:"mailbox",x:56,y:51},
    {slot:"trash_bin",x:34,y:45,mobile:false},{slot:"trash_bin",x:66,y:45,mobile:false},
    {slot:"tree_city",x:24,y:45,mobile:false},{slot:"tree_city",x:76,y:45,mobile:false},
    {slot:"table_umbrella",x:45,y:42},{slot:"stall",x:55,y:42},
    {slot:"city_bench",x:43,y:66},{slot:"city_bench",x:57,y:66,flip:true},
    {slot:"planter",x:44,y:55},{slot:"planter",x:56,y:55},
    {slot:"planter",x:24,y:51,mobile:false},{slot:"planter",x:76,y:51,mobile:false},
    {slot:"city_bench",x:24,y:69,mobile:false},{slot:"city_bench",x:76,y:69,flip:true,mobile:false},
    {slot:"lamp",x:17,y:45},{slot:"lamp",x:33,y:45},{slot:"lamp",x:67,y:45},{slot:"lamp",x:83,y:45},
    {slot:"lamp",x:42,y:56},{slot:"lamp",x:58,y:56},
    {slot:"streetlamp_modern",x:44,y:69,mobile:false},{slot:"streetlamp_modern",x:56,y:69,mobile:false},
    {slot:"lamp",x:17,y:68,mobile:false},{slot:"lamp",x:83,y:68,mobile:false},
    {slot:"tree_green",x:6,y:10},{slot:"tree_autumn",x:46,y:9,mobile:false},{slot:"tree_green",x:94,y:10},
    {slot:"tree_autumn",x:6,y:40,mobile:false},{slot:"tree_green",x:94,y:40,mobile:false},
    {slot:"tree_green",x:6,y:90},{slot:"tree_autumn",x:94,y:90},
    {slot:"tree_green",x:40,y:90},{slot:"tree_autumn",x:60,y:90},
    {slot:"bush_pink",x:20,y:74,mobile:false},{slot:"bush_white",x:80,y:74,mobile:false},
    {slot:"flowers",x:46,y:63},{slot:"flowers",x:54,y:63},
    {slot:"flowers",x:33,y:90,mobile:false},{slot:"flowers",x:67,y:90,mobile:false}
  ];
  function mFac(){return clamp(H/760,0.9,1.3);}
  function propH(k){var m=mFac();return (k.slice(0,4)==="tree"?62:k==="lamp"?56:k==="fountain"?66:k==="table_umbrella"?50:k==="stall"?46:(k==="bush_pink"||k==="bush_white")?16:k==="bench"?26:17)*m;}
  // unified prop height: new city slots use manifest DRAWH*m, legacy slots use propH
  function pHeight(slot){return DRAWH[slot]?DRAWH[slot]*mFac():propH(slot);}
  function drawProp(im,cx,cy,h,flip){
    if(!ok(im))return;var s=h/im.naturalHeight,w=im.naturalWidth*s;
    var y=Math.round(cy-h),wr=Math.round(w),hr=Math.round(h);
    if(flip){ctx.save();ctx.translate(Math.round(cx),0);ctx.scale(-1,1);ctx.drawImage(im,Math.round(-w/2),y,wr,hr);ctx.restore();}
    else ctx.drawImage(im,Math.round(cx-w/2),y,wr,hr);
  }

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
  // --- the broadcast camera: wide shot by default, auto-director nudges in on
  // live scenes, click-to-follow goes close (the Truman feel) ---
  var cam={cx:0,cy:0,z:1};
  // roaming coverage: when nothing is playing and nobody is followed, the
  // control room drifts a camera to someone for a while (all-day watchability)
  var roam=null, roamAt=0;
  function viewBounds(){var hw=W/(2*cam.z),hh=H/(2*cam.z);return {x1:cam.cx-hw,y1:cam.cy-hh,x2:cam.cx+hw,y2:cam.cy+hh};}
  function stepCam(dt,now){
    if(!cam.cx){cam.cx=W/2;cam.cy=H/2;}
    if(!selected&&!cur&&snap&&(!coldOpen||coldOpen.done)){
      if(roam&&now>roam.until)roam=null;
      if(!roam&&now>roamAt){
        var ids=Object.keys(sprites);
        if(ids.length){roam={sid:ids[Math.floor(Math.random()*ids.length)],until:now+12000};roamAt=now+30000+Math.random()*20000;}
      }
    } else roam=null;
    var tz=1,tcx=W/2,tcy=H/2;
    var fsp=selected?sprites[selected]:null;
    if(fsp){tz=isMobile()?1.45:1.6;tcx=fsp.x;tcy=fsp.y-34;}
    else if(cur&&sprites[cur.sid]){
      var s1=sprites[cur.sid],s2=(cur.lid&&sprites[cur.lid])?sprites[cur.lid]:null;
      tz=1.22;tcx=s2?(s1.x+s2.x)/2:s1.x;tcy=(s2?(s1.y+s2.y)/2:s1.y)-30;
    }
    else if(roam&&sprites[roam.sid]){var rs=sprites[roam.sid];tz=1.18;tcx=rs.x;tcy=rs.y-32;}
    var hw=W/(2*tz),hh=H/(2*tz);
    tcx=clamp(tcx,hw,W-hw);tcy=clamp(tcy,hh,H-hh);
    var kz=Math.min(1,dt*0.0016),kp=Math.min(1,dt*0.0024);
    cam.z+=(tz-cam.z)*kz;cam.cx+=(tcx-cam.cx)*kp;cam.cy+=(tcy-cam.cy)*kp;
    var hw2=W/(2*cam.z),hh2=H/(2*cam.z);
    cam.cx=clamp(cam.cx,hw2,W-hw2);cam.cy=clamp(cam.cy,hh2,H-hh2);
  }
  function camApply(){ctx.setTransform(DPR*cam.z,0,0,DPR*cam.z,DPR*(W/2-cam.z*cam.cx),DPR*(H/2-cam.z*cam.cy));}
  function camReset(){ctx.setTransform(DPR,0,0,DPR,0,0);}
  function px(p){return {x:p.x/100*W, y:p.y/100*H};}
  function plazaR(){return Math.max(56, W*0.04);}
  // responsive building base height: scale with the smaller of H and W so the
  // dense downtown row fits horizontally at narrow desktop widths without ever
  // overlapping (and never gets tiny on a phone).
  function unitB(){return isMobile()?clamp(Math.min(H*0.21,W*0.235),100,150):clamp(Math.min(H*0.21,W*0.122),78,150);}
  // horizontal corridors (MAIN always; PROMENADE desktop-only) and through-rails.
  // x30/x70 are drawn as downtown cross-streets but NOT used for routing (shop_c /
  // civic sit on them); characters traverse only x13/x50/x87.
  function hCorrs(){return isMobile()?[0.48*H]:[0.48*H,0.70*H];}
  function nearestH(y){var c=hCorrs(),b=c[0],i;for(i=1;i<c.length;i++)if(Math.abs(y-c[i])<Math.abs(y-b))b=c[i];return b;}
  function nearestRailPx(xp){var r=[13,87],b=px({x:r[0],y:0}).x,i,xx;for(i=1;i<r.length;i++){xx=px({x:r[i],y:0}).x;if(Math.abs(xx-xp)<Math.abs(b-xp))b=xx;}return b;}

  // --- geometry of a place: where its building sits, its door, its baseline ---
  function geomOf(p){
    var c=px(p);
    if(p.type==="plaza"){var rx=Math.max(56,W*0.078);return {c:c,rx:rx,ry:rx*0.6,bottom:c.y+rx*0.6,base:c.y+16};}
    if(p.type==="park"){return {c:c,rx:Math.max(50,W*0.062),bottom:c.y+34,base:c.y+8};}
    var bh=unitB()*(p.type==="home"?0.94:1);
    var im=buildings[p.id]||buildings[p.type];
    var bw=ok(im)?im.naturalWidth*(bh/im.naturalHeight):bh*0.8;
    var bottom=c.y+bh*0.45;
    return {c:c,bh:bh,bw:bw,top:bottom-bh,bottom:bottom,base:bottom};
  }
  // decorative building geometry (drawH-based, bottom-anchored like functional)
  function decorGeom(l){
    var c=px(l), bh=(DRAWH[l.slot]||120)*l.hScale*(unitB()/176);
    var im=citybld[l.slot];
    var bw=ok(im)?im.naturalWidth*(bh/im.naturalHeight):bh*0.7;
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

  // --- walking: route along the ladder street grid (dips around the fountain) ---
  // Rungs = MAIN (y48) + PROMENADE (y70, desktop). Rails = x13/x50/x87. Each place
  // exits onto its own corridor; the plaza & park (behind the fountain on the
  // boulevard) are reached via the southern dip, skirting the water — never a
  // head-on walk through the fountain, on desktop OR phone.
  function route(from,place,slot){
    var main=0.48*H;
    var pc=px({x:50,y:60}), cx50=pc.x, pr=plazaR(), rxp=Math.max(56,W*0.078);
    var dipY=pc.y+pr*0.62+12;
    var d=doorOf(place);
    var isPlaza=place.type==="plaza", isPark=place.type==="park";
    var pts=[], f={x:from.x,y:from.y};

    if(isPlaza||isPark){
      if(f.y>pc.y+6){
        // coming from the south (the park): rise straight up the clear blvd to the dip
        if(Math.abs(f.x-cx50)>6)pts.push({x:cx50,y:f.y});
        pts.push({x:cx50,y:dipY});
      } else {
        // coming from the north: slide MAIN to just outside the pad, drop beside it,
        // then step in from the side so the fountain is never crossed
        var s0=f.x<=cx50?-1:1, sk0=clamp(cx50+s0*(rxp+14),8,W-8);
        if(Math.abs(f.y-main)>6)pts.push({x:f.x,y:main});
        pts.push({x:sk0,y:main});
        pts.push({x:sk0,y:dipY});
        pts.push({x:cx50,y:dipY});
      }
      if(isPark)pts.push({x:cx50,y:d.y});   // continue down the clear blvd to the park
      pts.push(slot);
    } else {
      // leaving the boulevard south of MAIN (a plaza/park slot)? skirt the fountain
      // before climbing north (needed on phone where there is no promenade)
      var band=f.y>main+8 && Math.abs(f.x-cx50)<rxp+8 && (f.y<dipY+40 || isMobile());
      if(band){
        if(f.y>dipY){pts.push({x:cx50,y:dipY});f={x:cx50,y:dipY};}
        var s1=f.x<=cx50?-1:1, sk1=clamp(cx50+s1*(rxp+14),8,W-8);
        pts.push({x:sk1,y:dipY});f={x:sk1,y:dipY};
      }
      var hy=nearestH(f.y);
      if(Math.abs(f.y-hy)>6)pts.push({x:f.x,y:hy});
      if(place.type==="cafe"||place.type==="bakery"){
        // exits onto MAIN; switch rungs (if needed) via the nearest through-rail
        if(hy!==main){var vx=nearestRailPx(d.x);pts.push({x:vx,y:hy});pts.push({x:vx,y:main});}
        pts.push({x:d.x,y:main});
        pts.push(d);
      } else {
        // home: ride its nearest vertical rail (x13/x87) to the door row
        var vx2=nearestRailPx(d.x);
        pts.push({x:vx2,y:hy});
        pts.push({x:vx2,y:d.y});
        if(Math.abs(d.x-vx2)>4)pts.push(d);
      }
      pts.push(slot);
    }
    var out=[],last=from;
    for(var i=0;i<pts.length;i++){if(Math.hypot(pts[i].x-last.x,pts[i].y-last.y)>3){out.push(pts[i]);last=pts[i];}}
    return out;
  }

  // --- ingest a world snapshot: place everyone, queue new dialogue beats ---
  function ingest(s,reset){
    snap=s;
    // measure the real cadence of sim ticks so the director can pace the show
    if(s.t!==lastSimT){
      var nwT=performance.now();
      if(lastTickWall)tickGapMs=clamp(nwT-lastTickWall,8000,360000);
      lastTickWall=nwT; lastSimT=s.t;
    }
    var h=hourNow(), nn=nightness(h);
    var day=Math.floor((s.t-Date.UTC(2026,6,10))/86400000)+1;
    // broadcast package: recap for drop-in viewers, title card on day change
    if(coldOpen===null){
      if(NOCOLD)coldOpen={done:true,lines:[]};
      else coldOpen={lines:(s.highlights||[]).slice(0,3).map(function(b){return b.text;}),start:performance.now(),day:day};
    }
    if(lastDay&&day!==lastDay&&day>=1)dayCard={text:"DAY "+day,start:performance.now()};
    if(day>=1)lastDay=day;
    var wx=wxNow();
    var ph=wx==="rain"?"🌧":wx==="overcast"?"☁️":nn>0.6?"🌙":h<8?"🌅":h<17?"☀️":"🌇";
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
      var p=places[loc]||places.plaza||{x:50,y:60,type:"plaza",id:"plaza"};
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
      else if(sp.place!==a.location){
        // staggered departure: don't send everyone marching the instant the
        // snapshot lands — people leave one by one over the next few seconds
        var pl2=places[a.location]||places.plaza;
        if(sp.pend)sp.pend={place:pl2,slot:slot};
        else {sp.pend={place:pl2,slot:slot};sp.departAt=performance.now()+1200+Math.random()*12000;}
        sp.place=a.location; sp.path=null; sp.vig=null; sp.vigText=null;
      }
      else if(!sp.path&&!sp.pend&&Math.hypot((sp.slot?sp.slot.x:slot.x)-slot.x,(sp.slot?sp.slot.y:slot.y)-slot.y)>5){sp.path=[slot];sp.vig=null;sp.vigText=null;}
      sp.slot=slot; sp.a=a;
    });
    Object.keys(sprites).forEach(function(id){ if(!(s.agents||[]).some(function(a){return a.id===id;})) delete sprites[id]; });
    pushBeats(s);
    setChyron(s);
    renderPanel();
  }

  // ===================== the soap layer: dialogue beats =====================
  // The show director: instead of dumping each tick's dialogue in one burst and
  // going silent for minutes, beats are SCHEDULED across the measured gap
  // between sim ticks, so something is always about to happen.
  var seen={}, beats=[], cur=null, curUntil=0, gapUntil=0, replayPool=[], replayAt=0;
  var lastSimT=0, lastTickWall=0, tickGapMs=45000, lastSchedAt=0, everPushed=false;
  function beatKey(l){return l.t+"|"+l.speakerId+"|"+l.text;}
  function sayDur(len){return clamp(2600+62*len,4200,9000);}
  function pushBeats(s){
    var freshBeats=[], firstPush=!everPushed;
    everPushed=true;
    // on first load skip straight to the latest scene instead of replaying
    // minutes of backlog line by line
    var lines=((s.dialogue)||[]);
    var startAt=firstPush?Math.max(0,lines.length-5):0;
    lines.forEach(function(l,li){
      var k=beatKey(l); if(seen[k])return; seen[k]=1;
      if(li<startAt)return;
      freshBeats.push({kind:"say",sid:l.speakerId,lid:l.listenerId,text:l.text,dur:sayDur(l.text.length)});
    });
    if(freshBeats.length){replayPool=[];((s.dialogue)||[]).slice(-4).forEach(function(l){replayPool.push({kind:"say",sid:l.speakerId,lid:l.listenerId,text:l.text,dur:sayDur(l.text.length)});});}
    // audience replies surface ON the broadcast — the viewer's message becomes
    // part of the show, over the character who received it. They jump the
    // queue (play next) and are never evicted by the beat cap. On first load
    // only the latest one replays.
    var audl=((s.audience)||[]);
    audl.forEach(function(r,ai){
      var k=r.t+"|"+r.agentId+"|inj"; if(seen[k])return; seen[k]=1;
      if(firstPush&&ai<audl.length-1)return;
      var txt="📨 @"+r.handle+": “"+r.text+"”";
      beats.unshift({kind:"aud",sid:r.agentId,lid:null,text:txt,dur:clamp(1800+50*txt.length,3600,7500),at:performance.now()+1200});
    });
    // a couple of fresh reflections become thought bubbles (watch the mind)
    var refl=(s.ticker||[]).filter(function(t){return t.kind==="reflection";}).slice(0,2);
    refl.forEach(function(r){
      var k=r.t+"|"+r.agentId+"|"+r.text; if(seen[k])return; seen[k]=1;
      freshBeats.push({kind:"think",sid:r.agentId,lid:null,text:r.text,dur:clamp(1500+45*r.text.length,2800,5200)});
    });
    if(freshBeats.length){
      var nw=performance.now();
      var spacing=clamp(tickGapMs*0.6/freshBeats.length,9000,40000);
      // never let the schedule run further ahead than one tick gap — if the
      // sim ticks faster than lines can play, drop pace to "always something
      // queued soon" instead of starving the screen
      var t0=Math.max(nw+2500,Math.min(lastSchedAt+spacing*0.5,nw+tickGapMs*0.8));
      freshBeats.forEach(function(b,i){b.at=t0+i*spacing+(i?(Math.random()*4000-2000):0);beats.push(b);});
      lastSchedAt=Math.min(t0+(freshBeats.length-1)*spacing,nw+tickGapMs*1.2);
    }
    if(beats.length>10){
      var audK=beats.filter(function(b){return b.kind==="aud";});
      var oth=beats.filter(function(b){return b.kind!=="aud";}).slice(-(Math.max(0,10-audK.length)));
      beats=audK.concat(oth).sort(function(a,b){return a.at-b.at;});
    }
  }
  function stepBeats(now){
    if(cur&&now>curUntil){cur=null;gapUntil=now+800;}
    if(!cur&&now>gapUntil){
      // self-heal a runaway schedule (fast tick bursts): never sit silent for
      // more than a beat-gap while lines are waiting
      if(beats.length&&beats[0].at-now>tickGapMs*0.9)beats[0].at=now+3000;
      if(beats.length&&now>=beats[0].at){cur=beats.shift();curUntil=now+cur.dur;if(voicesOn&&cur.kind==="say")playVoice(cur);}
      else if(!beats.length&&replayPool.length&&now>replayAt){
        // re-run the last scene, slowly, while the pair is still mid-conversation
        var l=replayPool[0];
        if(pairs[l.sid]===l.lid){
          var t0=now+1500;
          replayPool.forEach(function(b,i){beats.push({kind:b.kind,sid:b.sid,lid:b.lid,text:b.text,dur:b.dur,at:t0+i*16000});});
          replayAt=now+replayPool.length*16000+30000;
        }
        else replayPool=[];
      }
    }
  }

  // ===================== Kokoro voices (opt-in, in-browser TTS) ==============
  // Nothing loads until the user clicks the voices toggle (a user gesture also
  // unlocks audio). Kokoro-82M runs locally: WebGPU when a real adapter exists,
  // else single-thread WASM q8. Lines are pre-generated in the background so
  // audio is usually ready when a scheduled bubble appears.
  var VOICE={maya:"af_heart",ana:"af_bella",tom:"am_michael",leo:"am_puck"};
  var voicesOn=false, ttsP=null, tts=null, audioCtx=null, voiceCache={}, voiceOrder=[], genBusy=false, voiceState="off";
  function vkey(b){return (VOICE[b.sid]||"af_sky")+"|"+b.text;}
  function enableVoices(){
    if(ttsP)return ttsP;
    voiceState="loading";
    ttsP=(async function(){
      var mod=await import("https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm");
      var device="wasm",dtype="q8";
      if(navigator.gpu){try{if(await navigator.gpu.requestAdapter()){device="webgpu";dtype="fp32";}}catch(e){}}
      tts=await mod.KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX",{dtype:dtype,device:device});
      voiceState="ready";
      return tts;
    })();
    ttsP.catch(function(){voiceState="error";});
    return ttsP;
  }
  function pumpVoices(){
    if(!voicesOn||!tts||genBusy)return;
    var next=null;
    if(cur&&cur.kind==="say"&&!voiceCache[vkey(cur)])next=cur;
    else for(var i=0;i<beats.length;i++){if(beats[i].kind==="say"&&!voiceCache[vkey(beats[i])]){next=beats[i];break;}}
    if(!next)return;
    genBusy=true;
    var k=vkey(next);
    tts.generate(next.text,{voice:VOICE[next.sid]||"af_sky"}).then(function(a){
      voiceCache[k]=a;voiceOrder.push(k);
      if(voiceOrder.length>30)delete voiceCache[voiceOrder.shift()];
      if(cur&&vkey(cur)===k&&!cur.spoken)playVoice(cur);
      genBusy=false;
    }).catch(function(){voiceCache[k]=null;genBusy=false;});
  }
  function playVoice(beat){
    var a=voiceCache[vkey(beat)];
    if(!a||!audioCtx||beat.spoken)return;
    beat.spoken=true;
    try{
      var buf=audioCtx.createBuffer(1,a.audio.length,a.sampling_rate);
      buf.getChannelData(0).set(a.audio);
      var src=audioCtx.createBufferSource();
      src.buffer=buf;src.connect(audioCtx.destination);src.start();
      var ms=a.audio.length/a.sampling_rate*1000;
      curUntil=Math.max(curUntil,performance.now()+ms+300);
    }catch(e){}
  }
  (function(){
    var b=document.getElementById("vbtn");
    if(!b)return;
    b.onclick=function(){
      if(!voicesOn){
        voicesOn=true;
        if(!audioCtx){try{audioCtx=new (window.AudioContext||window.webkitAudioContext)();audioCtx.resume();}catch(e){}}
        enableVoices();
        b.className="busy";b.textContent="⏳ voices";
        var iv=setInterval(function(){
          if(voiceState==="ready"){b.className="on";b.textContent="🔊 voices";clearInterval(iv);}
          if(voiceState==="error"){b.className="";b.textContent="🔇 voices n/a";voicesOn=false;clearInterval(iv);}
        },500);
      } else {voicesOn=false;b.className="";b.textContent="🔇 voices";}
    };
  })();

  // --- stage directions: an idle character narrates what they're doing, in place ---
  var emote=null, emoteUntil=0, nextEmoteAt=0, emoteIdx=0;
  function stepEmotes(now){
    if(emote&&now>emoteUntil)emote=null;
    if(emote||!snap)return;
    if(!nextEmoteAt){nextEmoteAt=now+6000;return;}
    if(now<nextEmoteAt)return;
    var ags=(snap.agents||[]);
    for(var k=0;k<ags.length;k++){
      var a=ags[(emoteIdx+k)%ags.length], sp=sprites[a.id];
      if(!sp||sp.moving)continue;
      if(pairs[a.id])continue;                                   // their scene is the dialogue
      if(cur&&(cur.sid===a.id||cur.lid===a.id))continue;
      if(cur&&sprites[cur.sid]&&Math.hypot(sp.x-sprites[cur.sid].x,sp.y-sprites[cur.sid].y)<120)continue;
      emoteIdx=(emoteIdx+k+1)%ags.length;
      var txt=sp.vigText||a.action||"";
      if(!txt)break;
      emote={sid:a.id,kind:"stage",text:emojiFor(a.action)+" "+txt,dur:clamp(2200+45*txt.length,3200,5600)};
      emoteUntil=now+emote.dur;
      nextEmoteAt=now+9000+Math.random()*10000;
      return;
    }
    nextEmoteAt=now+6000;
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
    var think=beat.kind==="think", stage=beat.kind==="stage", aud=beat.kind==="aud";
    ctx.font=stage?"italic 600 11px ui-sans-serif":think?"italic 600 12px ui-sans-serif":"600 12.5px ui-sans-serif";
    var mw=stage?Math.min(180,W*0.4):Math.min(210,W*0.45);
    if(!beat.w||beat.mw!==mw){beat.mw=mw;var wr=wrap(beat.text,mw);beat.lines=wr.lines;beat.w=wr.bw;}
    var lh=stage?14:16, bw=beat.w+(stage?16:20), bh=beat.lines.length*lh+(stage?10:12);
    var vb=viewBounds();
    var bx=clamp(sp.x-bw/2,vb.x1+6,vb.x2-bw-6), by=sp.y-CH-(stage?14:22)-bh; if(by<vb.y1+6)by=vb.y1+6;
    ctx.fillStyle=aud?"rgba(255,241,212,.97)":stage?"rgba(16,22,32,.78)":think?"rgba(224,229,238,.94)":"rgba(255,255,255,.96)";
    rr(bx,by,bw,bh,stage?7:9);ctx.fill();
    if(aud){ctx.strokeStyle="#d9a441";ctx.lineWidth=1.5;rr(bx,by,bw,bh,9);ctx.stroke();}
    if(think){
      ctx.beginPath();ctx.arc(sp.x-4,by+bh+5,3.4,0,7);ctx.fill();
      ctx.beginPath();ctx.arc(sp.x+1,by+bh+11,2.1,0,7);ctx.fill();
    } else if(!stage){
      ctx.beginPath();ctx.moveTo(clamp(sp.x-7,bx+8,bx+bw-22),by+bh-1);ctx.lineTo(clamp(sp.x+7,bx+22,bx+bw-8),by+bh-1);ctx.lineTo(sp.x,by+bh+9);ctx.closePath();ctx.fill();
    }
    ctx.fillStyle=aud?"#453110":stage?"#dfe7f4":think?"#3c4759":"#182230";ctx.textAlign="left";
    for(var i=0;i<beat.lines.length;i++)ctx.fillText(beat.lines[i],bx+(stage?8:10),by+(stage?14:16)+i*lh);
    ctx.textAlign="center";
  }
  function drawDots(sp){
    var bw=32,bh=17,bx=clamp(sp.x-bw/2,4,W-bw-4),by=sp.y-CH-18-bh;if(by<4)by=4;
    ctx.fillStyle="rgba(255,255,255,.85)";rr(bx,by,bw,bh,8);ctx.fill();
    for(var k=0;k<3;k++){ctx.globalAlpha=.35+.35*(1+Math.sin(T*0.16+k*1.1))/2;ctx.fillStyle="#4a5668";ctx.beginPath();ctx.arc(bx+9+k*7,by+bh/2,2.2,0,7);ctx.fill();}
    ctx.globalAlpha=1;
  }

  // ============ broadcast package: cold open + day title cards ==============
  var coldOpen=null, dayCard=null, lastDay=0;
  function drawColdOpen(now){
    if(!coldOpen||coldOpen.done)return;
    var el=now-coldOpen.start, n=coldOpen.lines.length;
    var LEAD=1500,PER=2600,TAIL=700, total=n?LEAD+n*PER+TAIL:2800;
    if(el>=total){coldOpen.done=true;return;}
    var a=el<400?el/400:el>total-600?(total-el)/600:1;
    ctx.fillStyle="rgba(6,8,14,"+(0.9*a).toFixed(3)+")";ctx.fillRect(0,0,W,H);
    ctx.globalAlpha=Math.max(0,a);ctx.textAlign="center";
    if(n){
      ctx.font="700 12px ui-monospace,Menlo,monospace";ctx.fillStyle="#ecb44a";
      ctx.fillText("P R E V I O U S L Y   O N",W/2,H*0.3);
      ctx.font="800 30px ui-sans-serif";ctx.fillStyle="#fff";
      ctx.fillText("The Feed",W/2,H*0.3+38);
      var li=Math.floor((el-LEAD)/PER);
      if(el>LEAD&&li>=0&&li<n){
        var t2=(el-LEAD-li*PER)/PER, la=t2<0.15?t2/0.15:t2>0.85?(1-t2)/0.15:1;
        ctx.globalAlpha=Math.max(0,a*la);
        ctx.font="600 15px ui-sans-serif";ctx.fillStyle="#dfe6f2";
        var wr=wrap(coldOpen.lines[li],W*0.62);
        for(var i=0;i<wr.lines.length;i++)ctx.fillText(wr.lines[i],W/2,H*0.52+i*22);
      }
    } else {
      ctx.font="800 36px ui-monospace,Menlo,monospace";ctx.fillStyle="#fff";
      ctx.fillText("DAY "+(coldOpen.day||1),W/2,H*0.46);
      ctx.font="700 12px ui-monospace,Menlo,monospace";ctx.fillStyle="#ecb44a";
      ctx.fillText("THE STORY BEGINS",W/2,H*0.46+26);
    }
    ctx.globalAlpha=1;
  }
  function drawDayCard(now){
    if(!dayCard)return;
    var el=now-dayCard.start, total=3000;
    if(el>=total){dayCard=null;return;}
    var a=el<300?el/300:el>total-500?(total-el)/500:1;
    ctx.fillStyle="rgba(6,8,14,"+(0.6*a).toFixed(3)+")";ctx.fillRect(0,H*0.4,W,H*0.2);
    ctx.globalAlpha=Math.max(0,a);ctx.textAlign="center";
    ctx.font="800 34px ui-monospace,Menlo,monospace";ctx.fillStyle="#fff";
    ctx.fillText(dayCard.text,W/2,H*0.5+6);
    ctx.font="700 11px ui-monospace,Menlo,monospace";ctx.fillStyle="#ecb44a";
    ctx.fillText("A NEW EPISODE BEGINS",W/2,H*0.5+30);
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
    var anchors=[{x:46,y:62},{x:54,y:62},{x:40,y:90}];
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
  // --- procedural city ground: paved district, asphalt streets, crosswalks ---
  function drawGround(nn){
    var mob=isMobile();
    // 1. the paved downtown district — sidewalk concrete laid over the grass
    var d1=px({x:DISTRICT.x1,y:DISTRICT.y1}), d2=px({x:DISTRICT.x2,y:DISTRICT.y2});
    ctx.fillStyle="#c3c7cf";ctx.fillRect(d1.x,d1.y,d2.x-d1.x,d2.y-d1.y);
    ctx.strokeStyle="#aab0ba";ctx.lineWidth=1;
    var sx,sy;
    for(sx=d1.x+64;sx<d2.x;sx+=64){ctx.beginPath();ctx.moveTo(Math.round(sx)+0.5,d1.y);ctx.lineTo(Math.round(sx)+0.5,d2.y);ctx.stroke();}
    for(sy=d1.y+64;sy<d2.y;sy+=64){ctx.beginPath();ctx.moveTo(d1.x,Math.round(sy)+0.5);ctx.lineTo(d2.x,Math.round(sy)+0.5);ctx.stroke();}
    ctx.fillStyle="rgba(120,126,138,.16)";ctx.fillRect(d1.x,d2.y-6,d2.x-d1.x,6);
    // 2. streets: sidewalk band, asphalt, curb lines, dashed centerline (main)
    var aHalf=clamp(W*0.014,9,17)*(mob?0.72:1);
    var swW=clamp(W*0.006,4,8)*(mob?0.72:1);
    var asph=nn>0.5?"#3f444e":"#4b515c";
    var segs=[];
    HSTREETS.forEach(function(s){if(!shown(s))return;var a=px({x:s.x1,y:s.y}),b=px({x:s.x2,y:s.y});segs.push({o:"h",a:a,b:b,kind:s.kind});});
    VSTREETS.forEach(function(s){if(!shown(s))return;var a=px({x:s.x,y:s.y1}),b=px({x:s.x,y:s.y2});segs.push({o:"v",a:a,b:b,kind:s.kind});});
    ctx.fillStyle="#c3c7cf";
    segs.forEach(function(g){if(g.o==="h")ctx.fillRect(g.a.x,g.a.y-aHalf-swW,g.b.x-g.a.x,(aHalf+swW)*2);else ctx.fillRect(g.a.x-aHalf-swW,g.a.y,(aHalf+swW)*2,g.b.y-g.a.y);});
    ctx.fillStyle=asph;
    segs.forEach(function(g){if(g.o==="h")ctx.fillRect(g.a.x,g.a.y-aHalf,g.b.x-g.a.x,aHalf*2);else ctx.fillRect(g.a.x-aHalf,g.a.y,aHalf*2,g.b.y-g.a.y);});
    ctx.strokeStyle="#8b909b";ctx.lineWidth=1.4;
    segs.forEach(function(g){ctx.beginPath();
      if(g.o==="h"){ctx.moveTo(g.a.x,Math.round(g.a.y-aHalf)+0.5);ctx.lineTo(g.b.x,Math.round(g.a.y-aHalf)+0.5);ctx.moveTo(g.a.x,Math.round(g.a.y+aHalf)-0.5);ctx.lineTo(g.b.x,Math.round(g.a.y+aHalf)-0.5);}
      else{ctx.moveTo(Math.round(g.a.x-aHalf)+0.5,g.a.y);ctx.lineTo(Math.round(g.a.x-aHalf)+0.5,g.b.y);ctx.moveTo(Math.round(g.a.x+aHalf)-0.5,g.a.y);ctx.lineTo(Math.round(g.a.x+aHalf)-0.5,g.b.y);}
      ctx.stroke();});
    ctx.strokeStyle="#c9a24b";ctx.lineWidth=2;ctx.setLineDash([14,12]);
    segs.forEach(function(g){if(g.kind!=="main")return;ctx.beginPath();ctx.moveTo(g.a.x,g.a.y);ctx.lineTo(g.b.x,g.b.y);ctx.stroke();});
    ctx.setLineDash([]);
    // 3. zebra crosswalks across each flagged road
    var n=mob?4:6, stw=4, gap=3, tot=n*stw+(n-1)*gap, i;
    ctx.fillStyle="rgba(233,236,241,.9)";
    CROSSWALKS.forEach(function(cw){if(!shown(cw))return;var c=px(cw);
      if(cw.dir==="v"){for(i=0;i<n;i++){var yy=c.y-tot/2+i*(stw+gap);ctx.fillRect(c.x-aHalf,yy,aHalf*2,stw);}}
      else{for(i=0;i<n;i++){var xx=c.x-tot/2+i*(stw+gap);ctx.fillRect(xx,c.y-aHalf,stw,aHalf*2);}}
    });
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
      // clamp x so corner-home labels (x13/x87) stay fully on-canvas
      var nx=clamp(p.x,nw/2+4,W-nw/2-4), dx=nx-p.x;
      ctx.fillStyle="rgba(10,14,20,.72)";rr(nx-nw/2,p.y-13,nw,17,8);ctx.fill();
      ctx.fillStyle=p.sel?"#ecb44a":"#fff";ctx.fillText(p.name,nx,p.y);
      ctx.font="13px serif";ctx.fillText(p.em,clamp(p.emX+dx,10,W-10),p.emY);
    });
  }
  function plateLabel(text,x,y,dark){
    plates.push(function(){
      ctx.font="600 11px ui-sans-serif";ctx.textAlign="center";
      var w=ctx.measureText(text).width+12, cx=clamp(x,w/2+3,W-w/2-3);
      ctx.fillStyle=dark||"rgba(10,14,20,.58)";rr(cx-w/2,y-11,w,15,7);ctx.fill();
      ctx.fillStyle="rgba(255,255,255,.93)";ctx.fillText(text,cx,y+1);
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

  // decorative city building: soft shadow, bottom-anchored sprite, optional
  // shop name painted onto its blank upper billboard (like the bakery sign)
  function drawDecor(l,g){
    var im=citybld[l.slot];
    ctx.fillStyle="rgba(0,0,0,.18)";ctx.beginPath();ctx.ellipse(g.c.x,g.bottom+3,Math.max(10,g.bw*0.46),7,0,0,7);ctx.fill();
    if(ok(im))ctx.drawImage(im,Math.round(g.c.x-g.bw/2),Math.round(g.bottom-g.bh),Math.round(g.bw),Math.round(g.bh));
    if(l.sign){
      var sx=g.c.x, sy=g.bottom-g.bh*0.70, fs=Math.max(8,Math.round(g.bh*0.085));
      plates.push(function(){ctx.font="800 "+fs+"px ui-monospace,Menlo,monospace";ctx.textAlign="center";
        ctx.fillStyle="rgba(20,22,28,.30)";ctx.fillText(l.sign,sx+1,sy+1);
        ctx.fillStyle="#f4efe2";ctx.fillText(l.sign,sx,sy);});
    }
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

  // --- vignettes: idle characters use the environment around them ---
  var VIG={city_bench:"taking a seat for a moment",bench_b:"resting on the bench",bench:"resting on the bench",stall:"browsing the flower cart",table_umbrella:"settling in at a table",phone_booth:"making a quick call",mailbox:"checking the mail",planter:"admiring the flowers",flowers:"admiring the flowers",bus_stop:"waiting at the bus stop",tree_city:"enjoying the shade",vending:"grabbing a drink from the machine",park_statue:"admiring the old statue",pigeons:"feeding the pigeons"};
  function insideBuilding(x,y){
    var hit=false;
    (snap.places||[]).forEach(function(p){
      if(p.type==="park"||p.type==="plaza")return;
      var g=geomOf(p);
      if(x>g.c.x-g.bw/2&&x<g.c.x+g.bw/2&&y>g.top+g.bh*0.3&&y<g.bottom)hit=true;
    });
    DECOR.forEach(function(l){
      if(!shown(l))return;var g=decorGeom(l);
      if(x>g.c.x-g.bw/2&&x<g.c.x+g.bw/2&&y>g.top+g.bh*0.3&&y<g.bottom)hit=true;
    });
    return hit;
  }
  function blockedLine(a,b){
    for(var i=1;i<=4;i++){
      if(insideBuilding(a.x+(b.x-a.x)*i/4,a.y+(b.y-a.y)*i/4))return true;
    }
    return false;
  }
  function pickVignette(sp){
    var best=null,bd=1e9;
    PROPS.forEach(function(p){
      var txt=VIG[p.slot]; if(!txt||!shown(p))return;
      var c=px(p), spot={x:c.x,y:c.y+10};
      var d=Math.hypot(spot.x-sp.x,spot.y-sp.y);
      if(d<28||d>170||d>=bd)return;
      if(blockedLine(sp,spot))return;
      bd=d;best={spot:spot,txt:txt};
    });
    return best;
  }

  // --- background extras: the town's other residents (pure set dressing, the
  // Truman Show crowd) — they stroll the streets on loops, no minds, no names ---
  var extras=null;
  function extraTarget(){
    var r=Math.random();
    if(r<0.55)return {x:(10+Math.random()*80)/100*W, y:0.48*H};
    if(r<0.8&&!isMobile())return {x:(10+Math.random()*80)/100*W, y:0.70*H};
    var rails=[13,50,87], rx=rails[Math.floor(Math.random()*3)];
    return {x:rx/100*W, y:(28+Math.random()*50)/100*H};
  }
  function extraRoute(from,to){
    var hs=hCorrs(), hy=hs[0], best=Math.abs(from.y-hs[0])+Math.abs(to.y-hs[0]);
    for(var i=1;i<hs.length;i++){var c=Math.abs(from.y-hs[i])+Math.abs(to.y-hs[i]);if(c<best){best=c;hy=hs[i];}}
    var pts=[];
    if(Math.abs(from.y-hy)>6)pts.push({x:from.x,y:hy});
    if(Math.abs(to.x-from.x)>6)pts.push({x:to.x,y:hy});
    if(Math.abs(to.y-hy)>6)pts.push(to);
    return pts.length?pts:[to];
  }
  function stepExtras(dt,now,nn){
    if(!snap)return;
    if(!extras){
      extras=[];
      var n=isMobile()?3:6;
      for(var i=0;i<n;i++){
        var t0=extraTarget();
        extras.push({img:loadImg(base()+"/assets/characters/x"+(i+1)+".png"),x:t0.x,y:t0.y,path:null,dir:"D",waitUntil:now+i*2500,speed:(26+Math.random()*14)/1000,night:i<2});
      }
    }
    extras.forEach(function(ex){
      // after dark most extras head home (the set empties out)
      ex.hidden=nn>0.75&&!ex.night;
      if(ex.hidden)return;
      if(ex.path&&ex.path.length){
        var t=ex.path[0],dx=t.x-ex.x,dy=t.y-ex.y,d=Math.hypot(dx,dy),step=ex.speed*dt;
        if(d<=step||d<1.5){ex.x=t.x;ex.y=t.y;ex.path.shift();if(!ex.path.length){ex.path=null;ex.waitUntil=now+2000+Math.random()*9000;ex.dir="D";}}
        else {ex.x+=dx/d*step;ex.y+=dy/d*step;ex.dir=Math.abs(dx)>Math.abs(dy)?(dx<0?"L":"R"):(dy<0?"U":"D");}
        ex.moving=true;
      } else {
        ex.moving=false;
        if(now>ex.waitUntil)ex.path=extraRoute({x:ex.x,y:ex.y},extraTarget());
      }
    });
  }
  function drawExtra(ex){
    if(ex.hidden||!ok(ex.img))return;
    var footY=ex.y+2, topY=footY-CH;
    ctx.fillStyle="rgba(0,0,0,.2)";ctx.beginPath();ctx.ellipse(ex.x,footY-3,12,4.5,0,0,7);ctx.fill();
    var band=ex.moving?WALK_Y:IDLE_Y;
    var fcol=ex.moving?Math.floor(T/6)%6:Math.floor(T/18)%6;
    ctx.drawImage(ex.img,(DIRCOL[ex.dir||"D"]+fcol)*32,band,32,64,Math.round(ex.x-CW/2),Math.round(topY),CW,CH);
  }

  // --- sprite movement: unhurried walking, staggered departures, vignettes ---
  function stepSprite(sp,dt,now){
    var speed=clamp(W*0.03,30,46)/1000;
    sp.moving=false;
    if(sp.pend&&now>=sp.departAt){
      sp.path=route({x:sp.x,y:sp.y},sp.pend.place,sp.pend.slot);
      sp.pend=null; sp.vig=null; sp.vigText=null;
    }
    if(sp.path&&sp.path.length){
      var t=sp.path[0],dx=t.x-sp.x,dy=t.y-sp.y,d=Math.hypot(dx,dy),step=speed*dt;
      if(d<=step||d<1.5){
        sp.x=t.x;sp.y=t.y;sp.path.shift();
        if(!sp.path.length){
          sp.path=null;
          if(sp.vig&&sp.vigPhase==="go"){sp.vigPhase="linger";sp.vigUntil=now+5500+Math.random()*3500;sp.vigText=sp.vig.txt;sp.dir="U";}
          else if(sp.vig&&sp.vigPhase==="back"){sp.vig=null;sp.vigText=null;sp.idleAt=now+6000+Math.random()*9000;sp.dir="D";}
          else {sp.idleAt=now+5000+Math.random()*8000;sp.dir="D";}
        }
      }
      else {sp.x+=dx/d*step;sp.y+=dy/d*step;sp.dir=Math.abs(dx)>Math.abs(dy)?(dx<0?"L":"R"):(dy<0?"U":"D");}
      sp.moving=true;
    } else {
      var partner=sp.a&&pairs[sp.a.id]?sprites[pairs[sp.a.id]]:null;
      if(partner){sp.dir=partner.x<sp.x?"L":"R";sp.vig=null;sp.vigText=null;}
      else if(sp.vig&&sp.vigPhase==="linger"){
        if(now>sp.vigUntil&&sp.slot){sp.vigPhase="back";sp.path=[{x:sp.slot.x,y:sp.slot.y}];}
      }
      else if(!sp.pend&&now>sp.idleAt&&sp.slot){
        sp.idleAt=now+9000+Math.random()*12000;
        var v=Math.random()<0.55?pickVignette(sp):null;
        if(v){sp.vig=v;sp.vigPhase="go";sp.path=[v.spot];}
        else {
          var ox=(Math.random()*2-1)*20,oy=(Math.random()*2-1)*9;
          sp.path=[{x:sp.slot.x+ox,y:sp.slot.y+oy}];
        }
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
    stepCam(dt,now);camApply();
    // grass
    for(var gy=0;gy<H;gy+=44)for(var gx=0;gx<W;gx+=44){ctx.fillStyle=((gx+gy)/44)%2?"#7bbf6a":"#74b863";ctx.fillRect(gx,gy,44,44);}
    plates=[];namePlates=[];
    if(snap){
      var h=HHOVR!==null?HHOVR:hourNow(), tint=ambTint(h), nn=nightness(h), wx=wxNow();
      drawGround(nn);
      // drifting cloud shadows under grey skies
      if(wx!=="clear"){
        ctx.fillStyle="rgba(18,26,40,.09)";
        for(var ci=0;ci<3;ci++){
          var cx2=((T*(0.5+ci*0.2)+ci*W*0.45)%(W+520))-260, cy2=H*(0.18+ci*0.3);
          ctx.beginPath();ctx.ellipse(cx2,cy2,W*0.22,H*0.13,0,0,7);ctx.fill();
        }
      }
      stepBeats(now);
      stepEmotes(now);
      pumpVoices();
      if(DBG)document.title="DBG t="+Math.round(now/1000)+" beats="+beats.length+(beats.length?" b0in="+Math.round((beats[0].at-now)/1000):"")+" cur="+(cur?cur.kind+":"+cur.sid:"-")+" emote="+(emote?emote.sid:"-")+" gap="+Math.round(tickGapMs/1000)+" sched="+Math.round((lastSchedAt-now)/1000)+" seen="+Object.keys(seen).length+" vox="+voiceState+"/"+Object.keys(voiceCache).length+" cam="+cam.z.toFixed(2)+" roam="+(roam?roam.sid:"-")+" cold="+(coldOpen&&!coldOpen.done?"on":"off");
      // painter list: props + decorative + functional buildings + characters, by baseline
      var items=[], placeGeom={}, decGeom={};
      PROPS.forEach(function(p){if(!shown(p))return;var c=px(p);items.push({y:c.y,f:function(){drawProp(props[p.slot],c.x,c.y,pHeight(p.slot),p.flip);}});});
      DECOR.forEach(function(l){if(!shown(l))return;var g=decorGeom(l);decGeom[l.id]=g;items.push({y:g.base,f:function(){drawDecor(l,g);}});});
      (snap.places||[]).forEach(function(p){var g=geomOf(p);placeGeom[p.id]=g;items.push({y:g.base,f:function(){drawBuilding(p,g);}});});
      stepExtras(dt,now,nn);
      (extras||[]).forEach(function(ex){items.push({y:ex.y,f:function(){drawExtra(ex);}});});
      Object.keys(sprites).forEach(function(id){
        var sp=sprites[id];stepSprite(sp,dt,now);
        if(sp.a)items.push({y:sp.y,f:function(){drawChar(sp.a,sp);}});
      });
      items.sort(function(a,b){return a.y-b.y;});
      items.forEach(function(it){it.f();});
      // ambient life above the world (birds and butterflies sit out the rain)
      spawnSmoke();drawSmoke(dt);
      if(wx!=="rain")stepBirds(now,dt,nn);
      if(wx==="clear")drawButterflies(nn);
      // rain: slanted streaks over the whole set
      if(wx==="rain"){
        ctx.strokeStyle="rgba(178,198,228,.34)";ctx.lineWidth=1;
        ctx.beginPath();
        for(var ri=0;ri<140;ri++){
          var rx2=(((ri*127)^(ri<<3))+T*9)%(W+60)-30, ry2=((ri*211+T*23)%(H+40))-20;
          ctx.moveTo(rx2,ry2);ctx.lineTo(rx2-2.5,ry2+10);
        }
        ctx.stroke();
      }
      // day/night grade (+ grey weather grade)
      if(wx==="rain"){ctx.fillStyle="rgba(56,68,90,.20)";ctx.fillRect(0,0,W,H);}
      else if(wx==="overcast"){ctx.fillStyle="rgba(84,96,114,.15)";ctx.fillRect(0,0,W,H);}
      if(tint[3]>0.004){ctx.fillStyle="rgba("+Math.round(tint[0])+","+Math.round(tint[1])+","+Math.round(tint[2])+","+tint[3].toFixed(3)+")";ctx.fillRect(0,0,W,H);}
      if(nn>0.02){
        ctx.save();ctx.globalCompositeOperation="lighter";
        // street lamps, modern lamps + traffic signals all glow after dark
        PROPS.forEach(function(p){if(!shown(p))return;
          var isL=p.slot==="lamp"||p.slot==="streetlamp_modern", isT=p.slot==="traffic_light";
          if(!isL&&!isT)return;
          var c=px(p),hh=pHeight(p.slot),ly=c.y-hh*(isT?0.62:0.8),rad=isT?24:46;
          var col=isT?"255,150,90":"255,196,110",al=(isT?0.26:0.5)*nn;
          var g2=ctx.createRadialGradient(c.x,ly,2,c.x,ly,rad);
          g2.addColorStop(0,"rgba("+col+","+al.toFixed(2)+")");g2.addColorStop(1,"rgba("+col+",0)");
          ctx.fillStyle=g2;ctx.beginPath();ctx.arc(c.x,ly,rad,0,7);ctx.fill();
        });
        // warm window glow — functional homes/shops AND the decorative skyline
        function winGlow(g){var wy=g.bottom-g.bh*0.30,r=g.bh*0.42;
          var g3=ctx.createRadialGradient(g.c.x,wy,3,g.c.x,wy,r);
          g3.addColorStop(0,"rgba(255,190,96,"+(0.24*nn).toFixed(2)+")");g3.addColorStop(1,"rgba(255,190,96,0)");
          ctx.fillStyle=g3;ctx.beginPath();ctx.arc(g.c.x,wy,r,0,7);ctx.fill();}
        (snap.places||[]).forEach(function(p){if(p.type==="park"||p.type==="plaza")return;var g=placeGeom[p.id];if(g)winGlow(g);});
        DECOR.forEach(function(l){if(!shown(l))return;var g=decGeom[l.id];if(g)winGlow(g);});
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
      if(emote&&sprites[emote.sid])drawBubble(sprites[emote.sid],emote);
      if(cur){
        var ssp=sprites[cur.sid];
        if(ssp)drawBubble(ssp,cur);
        // listener "…" only when the pair is really mid-conversation and far
        // enough apart that the pill can't sit on the speaker's bubble text
        var lsp=(cur.kind==="say"&&cur.lid&&pairs[cur.sid]===cur.lid)?sprites[cur.lid]:null;
        if(lsp&&ssp&&Math.hypot(lsp.x-ssp.x,lsp.y-ssp.y)>140)drawDots(lsp);
      }
      camReset();
      // broadcast framing while following a life (screen-space, on top)
      if(selected&&sprites[selected]&&sprites[selected].a){
        var vg=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.42,W/2,H/2,Math.max(W,H)*0.72);
        vg.addColorStop(0,"rgba(0,0,0,0)");vg.addColorStop(1,"rgba(4,6,12,.42)");
        ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);
        ctx.fillStyle="rgba(8,10,16,.72)";rr(10,10,168,26,8);ctx.fill();
        ctx.fillStyle="#f0575f";ctx.globalAlpha=.55+.45*Math.sin(T*0.1);ctx.beginPath();ctx.arc(24,23,4,0,7);ctx.fill();ctx.globalAlpha=1;
        ctx.font="700 10px ui-monospace,Menlo,monospace";ctx.textAlign="left";ctx.fillStyle="#ffdfe2";
        ctx.fillText("CAM 02 · FOLLOWING "+sprites[selected].a.name.toUpperCase(),36,26);
        ctx.textAlign="center";
      }
      drawChyron(dt);
      drawDayCard(now);
      drawColdOpen(now);
    } else {
      camReset();
      ctx.fillStyle="rgba(0,0,0,.5)";ctx.font="14px ui-sans-serif";ctx.textAlign="center";
      ctx.fillText(lastErr||"connecting to the town…",W/2,H/2);
    }
    requestAnimationFrame(frame);
  }

  canvas.addEventListener("click",function(e){
    var r=canvas.getBoundingClientRect(),sx=e.clientX-r.left,sy=e.clientY-r.top,best=null,bd=1e9;
    // screen → world (the camera may be zoomed in)
    var mx=(sx-(W/2-cam.z*cam.cx))/cam.z, my=(sy-(H/2-cam.z*cam.cy))/cam.z;
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
      var storyHtml=snap.premise?'<div class="story"><div class="st">📺 The Story</div><div class="sp">'+esc(snap.premise)+'</div></div>':"";
      el.innerHTML='<div class="ptitle">The Town · Today</div>'+sceneHtml+storyHtml+'<div class="roster">'+roster+'</div>'+
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
    // who is this: split the bio into a role clause + personality traits
    var bio=a.bio||"", si=bio.indexOf(";"), role=si<0?bio:bio.slice(0,si), traits=si<0?"":bio.slice(si+1).trim();
    var bioHtml=bio?'<div class="bio"><div class="role">'+esc(role.replace(/\\.$/,""))+'</div>'+(traits?'<div class="traits">'+esc(traits.replace(/\\.$/,""))+'</div>':"")+'</div>':"";
    // their relationships, from their point of view (who they've bonded with)
    var rels=(snap.relationships||[]).filter(function(e){return e.a===selected||e.b===selected;})
      .sort(function(x,y){return y.weight-x.weight;}).map(function(e){
        var other=e.a===selected?e.b:e.a, hearts="";for(var i3=0;i3<Math.min(5,e.weight);i3++)hearts+="♥";
        return '<div class="bond"><span>'+esc(nameOf[other]||other)+'</span><span class="hearts">'+hearts+'</span></div>';
      }).join("");
    el.innerHTML=
      '<div class="back" id="back">← back to town</div>'+
      '<div class="who" style="margin-top:10px"><span class="avatar" style="background:'+color(a.id)+'"></span><div><div class="wn">'+esc(a.name)+'</div><div class="wl">'+emojiFor(a.action)+" at "+esc(place?place.label:a.location)+'</div></div></div>'+
      bioHtml+
      '<div class="doing"><div class="k">Right now</div>'+esc(a.action)+(a.planActivity?'<div style="color:var(--dim);margin-top:5px;font-size:12px">📋 plan: '+esc(a.planActivity)+'</div>':"")+'</div>'+
      '<div class="sec"><div class="h">💬 Say something to '+esc(a.name)+'</div><div class="replybox"><input id="rin" maxlength="240" placeholder="a message they\\'ll remember…"/><button id="rbtn">Send</button></div><div class="replymsg" id="rmsg">Your reply becomes a memory that can change what they do next.</div></div>'+
      (rels?'<div class="sec"><div class="h">Who '+esc(a.name)+' knows</div>'+rels+'</div>':"")+
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
