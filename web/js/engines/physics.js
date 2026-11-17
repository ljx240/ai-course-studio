(function(Z){
 const fmt=(n,p=2)=>Number(n).toFixed(p);
 let frame=0,startEpoch=0,lastElement=null;
 function calc(v0,h,g){const t=Math.sqrt(2*h/g);return {flight:t,range:v0*t,impact:Math.hypot(v0,g*t),vy:g*t};}
 function sceneSVG(v0,h,g,t){const metrics=calc(v0,h,g);t=Math.max(0,Math.min(t,metrics.flight));const end=metrics.flight;const left=100,ground=440,scaleX=92,scaleY=105;const top=ground-h*scaleY;const X=(p)=>left+v0*p*scaleX,Y=(p)=>top+.5*g*p*p*scaleY;
  const point=(p)=>`${fmt(X(p),1)} ${fmt(Y(p),1)}`;
  const path=Array.from({length:83},(_,i)=>`${i?'L':'M'}${point(i*end/82)}`).join(' ');
  const marks=Array.from({length:13},(_,i)=>{let p=i*end/12;return `<circle cx="${fmt(X(p),1)}" cy="${fmt(Y(p),1)}" r="3.2" fill="white" stroke="#aecaff" stroke-width="1"/>`}).join('');
  const ballX=X(t),ballY=Y(t);const vxLabel=fmt(v0,1),xEnd=fmt(X(end),1);
  return `<svg viewBox="0 0 1000 520" preserveAspectRatio="xMidYMid meet" aria-label="平抛运动轨迹示意图">
  <defs><linearGradient id="platform-p" x1="0" x2="1"><stop stop-color="#d1a179"/><stop offset="1" stop-color="#85634a"/></linearGradient><filter id="ball-glow"><feGaussianBlur stdDeviation="2"/></filter></defs>
  <rect x="25" y="${fmt(top+9,1)}" width="88" height="${fmt(ground-top+40,1)}" fill="url(#platform-p)"/><rect x="0" y="${fmt(top+1,1)}" width="142" height="23" rx="3" fill="#a67852"/><rect x="0" y="${fmt(top-3,1)}" width="142" height="10" fill="#dfbc8d"/>
  <line x1="${left}" y1="${fmt(top,1)}" x2="${left}" y2="440" stroke="#fff" stroke-width="1.5" stroke-dasharray="5 6" opacity=".8"/>
  <line x1="${left}" y1="440" x2="${xEnd}" y2="440" stroke="#fff" stroke-width="2" opacity=".9"/>
  <path d="${path}" stroke="white" stroke-width="3.2" fill="none" opacity=".98"/>
  ${marks}<circle cx="${fmt(ballX,1)}" cy="${fmt(ballY,1)}" r="11" fill="#fff" opacity=".23" filter="url(#ball-glow)"/><circle cx="${fmt(ballX,1)}" cy="${fmt(ballY,1)}" r="8" fill="#fff" stroke="#bed6ff" stroke-width="2"/>
  <line x1="${left}" y1="${fmt(top-24,1)}" x2="${left+65}" y2="${fmt(top-24,1)}" stroke="white" stroke-width="3"/><path d="M${left+65} ${fmt(top-24,1)}l-9 -6v12Z" fill="white"/>
  <text x="${left+14}" y="${fmt(top-35,1)}" fill="white" font-size="16" font-weight="600" paint-order="stroke" stroke="#4569a2" stroke-width="2">v₀=${vxLabel} m/s</text>
  <text x="${left-14}" y="${fmt(top+(ground-top)/2,1)}" text-anchor="end" fill="white" font-size="14">h=${fmt(h,1)} m</text>
  <text x="${xEnd}" y="466" text-anchor="middle" fill="#fff" font-size="15" paint-order="stroke" stroke="#646b6e" stroke-width="2">${fmt(metrics.range,2)} m</text>
 </svg>`;
 }
 function stage(){return `<div class="exp-stage" data-physics-stage>${sceneSVG(8,2,9.8,0)}<div class="exp-hud"><strong>实时运动数据</strong><div class="row"><span>飞行时间</span><b data-physt="" >0.00 s</b></div><div class="row"><span>水平位移</span><b data-physx="">0.00 m</b></div><div class="row"><span>竖直位移</span><b data-physy="">0.00 m</b></div><div class="row"><span>速度大小</span><b data-physv="">8.00 m/s</b></div></div></div>`}
 function update(el,time){if(!el)return;const s=Z.store.get(),v0=s.speed,h=s.height,g=s.gravity,metrics=calc(v0,h,g);const t=Math.min(metrics.flight,Math.max(0,time===undefined?s.labTime:time));const root=el.querySelector('svg');if(root)root.outerHTML=sceneSVG(v0,h,g,t);const pairs={physt:fmt(t)+' s',physx:fmt(v0*t)+' m',physy:fmt(.5*g*t*t)+' m',physv:fmt(Math.hypot(v0,g*t))+' m/s'};for(const [k,v] of Object.entries(pairs)){const n=el.querySelector(`[data-${k}]`);if(n)n.textContent=v}
  document.querySelectorAll('[data-physics-distance]').forEach(n=>n.textContent=fmt(metrics.range)+' m');document.querySelectorAll('[data-physics-flight]').forEach(n=>n.textContent=fmt(metrics.flight)+' s');document.querySelectorAll('[data-physics-impact]').forEach(n=>n.textContent=fmt(metrics.impact)+' m/s');document.querySelectorAll('[data-physics-current]').forEach(n=>n.textContent=fmt(t)+' s');
 }
 function stop(){if(frame)cancelAnimationFrame(frame);frame=0;lastElement=null;Z.store.set({labPaused:true})}
 function play(el){if(!el)return;stop();lastElement=el;const s=Z.store.get(),duration=calc(s.speed,s.height,s.gravity).flight;let initial=Math.min(duration,s.labTime);if(initial>=duration)initial=0;startEpoch=performance.now()-initial*1000/1.6;Z.store.set({labPaused:false,labTime:initial});const tick=(now)=>{const t=Math.min(duration,(now-startEpoch)*1.6/1000);Z.store.set({labTime:t});update(el,t);const timeline=document.querySelector('[data-lab-timeline]');if(timeline){timeline.max=String(duration);timeline.value=String(t)};if(t<duration){frame=requestAnimationFrame(tick)}else{frame=0;Z.store.set({labPaused:true})}};frame=requestAnimationFrame(tick)}
 function toggle(el){if(frame){stop();return false}play(el);return true}
 Z.engines=Z.engines||{};Z.engines.physics={calc,sceneSVG,stage,update,stop,play,toggle};
})(window.ZJ);
