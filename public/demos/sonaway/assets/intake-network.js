/* Persistent SVG neighborhood: moving focus, sequential traversal, and connected discoveries. */
(function(root){
 'use strict';
 const NS='http://www.w3.org/2000/svg';
 const el=(tag,attrs={})=>{const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e;};
 const wrap=s=>{const out=[];for(const word of s.split(' ')){if(!out.length||(out.at(-1)+' '+word).length>19)out.push(word);else out[out.length-1]+=' '+word;}return out;};
 function create(map,reduced){
  const svg=map.querySelector('.gi-network'),nodeLayer=map.querySelector('.gi-network-nodes'),edgeLayer=map.querySelector('.gi-network-edges');
  const title=map.querySelector('.gi-network-title'),caption=map.querySelector('.gi-network-caption');
  const points=new Map(),paths=new Map();let raf=0,token=0,scene=null,active=null,finish=null,stepIndex=0;
  const tracer=el('g',{class:'gi-traveller',opacity:0});tracer.append(el('circle',{r:11,class:'gi-traveller-glow'}),el('circle',{r:3.5,class:'gi-traveller-core'}));svg.append(tracer);
  const field=el('g',{class:'gi-distant-network','aria-hidden':'true'});svg.insertBefore(field,edgeLayer);
  const ambient=Array.from({length:23},(_,i)=>({x:25+(i*173)%590,y:20+(i*97)%305}));
  ambient.forEach((p,i)=>{const q=ambient[(i+5)%ambient.length];if(Math.hypot(p.x-q.x,p.y-q.y)<210)field.append(el('path',{d:`M${p.x},${p.y} L${q.x},${q.y}`}));field.append(el('circle',{cx:p.x,cy:p.y,r:i%3?1.4:2.5}));});
  function cancel(){token++;cancelAnimationFrame(raf);raf=0;active=null;finish=null;tracer.setAttribute('opacity',0);map.classList.remove('gi-exploring');map.querySelector('.gi-skip')?.remove();}
  function labelNode(p,n){
   p.el.replaceChildren();p.el.append(el('circle',{r:13,class:'gi-found-ring'}));p.el.append(el('circle',{r:n.source?15:n.choice||n.kind==='UPDATED'?10:6,class:'gi-orbit-halo'}),el('circle',{r:n.source?9:n.choice||n.kind==='UPDATED'?6:3.5,class:'gi-orbit-core'}));
   const text=el('text',{'text-anchor':'middle',class:'gi-orbit-label'});wrap(n.label).forEach((line,i)=>{const t=el('tspan',{x:0,y:26+i*16});t.textContent=line;text.append(t);});p.el.append(text);
   p.el.setAttribute('class','gi-orbit-node'+(n.source?' gi-orbit-source':'')+(n.choice?' gi-orbit-candidate':'')+(n.excluded?' gi-orbit-excluded':'')+(n.kind==='UPDATED'?' gi-orbit-updated':'')+(p.found?' gi-orbit-found':''));
   p.el.dataset.node=n.id;p.el.dataset.choice=n.choice||'';
  }
  function prepare(next,all){
   scene=next;svg.setAttribute('viewBox','0 0 640 360');title.textContent=next.title;caption.textContent=next.caption;
   map.classList.toggle('gi-applied',next.nodes.some(n=>n.kind==='UPDATED'));
   const wanted=new Set(next.nodes.map(n=>n.id));
   for(const [id,p] of points){if(!wanted.has(id)){p.ghost=true;p.targetOpacity=.04;p.el.classList.add('gi-orbit-ghost');}}
   next.nodes.forEach(n=>{
    let p=points.get(n.id);const parent=next.edges.find(e=>e.to===n.id&&!e.cross),origin=points.get(parent?.from)||points.get(next.source);
    if(!p){p={x:origin?.x??n.x,y:origin?.y??n.y,opacity:0,el:el('g')};nodeLayer.append(p.el);points.set(n.id,p);}
    p.node=n;p.ghost=false;p.motion={x:p.x,y:p.y,start:performance.now(),duration:n.source?900:650};p.tx=n.x;p.ty=n.y;p.revealed=all||n.source;p.targetOpacity=p.revealed?(n.excluded?.28:1):0;labelNode(p,n);
    if(reduced.matches){p.x=p.tx;p.y=p.ty;p.opacity=p.targetOpacity;p.motion=null;}
   });
   paths.clear();edgeLayer.replaceChildren();next.edges.forEach(e=>{const base=el('path',{class:'gi-web-edge'+(e.cross?' gi-web-cross':'')});const trail=el('path',{class:'gi-web-trail',pathLength:100});edgeLayer.append(base,trail);paths.set(e.id,{edge:e,base,trail,visited:false});});
  }
  function paint(){
   for(const p of points.values()){
    const motion=p.motion,t=motion?Math.min(1,(performance.now()-motion.start)/motion.duration):1,ease=t*t*(3-2*t);
    p.x=motion?motion.x+(p.tx-motion.x)*ease:p.tx;p.y=motion?motion.y+(p.ty-motion.y)*ease:p.ty;p.opacity+=(p.targetOpacity-p.opacity)*.1;
    p.el.setAttribute('transform',`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`);p.el.style.opacity=p.opacity;
   }
   for(const p of paths.values()){
    const a=points.get(p.edge.from),b=points.get(p.edge.to),dx=b.x-a.x,dy=b.y-a.y,bend=p.edge.cross?-20:14;
    const d=`M${a.x},${a.y} Q${(a.x+b.x)/2-dy*.1},${(a.y+b.y)/2+dx*.1+bend} ${b.x},${b.y}`;
    p.base.setAttribute('d',d);p.trail.setAttribute('d',d);const opacity=Math.min(a.opacity,b.opacity);
    p.base.style.opacity=opacity*(p.edge.cross?.2:.7);p.trail.style.opacity=p.visited?opacity*.85:0;
   }
   if(active){const path=paths.get(active.edge)?.base;if(path){const progress=Math.min(1,(performance.now()-active.start)/active.duration),pos=path.getPointAtLength(path.getTotalLength()*(active.reverse?1-progress:progress));tracer.setAttribute('transform',`translate(${pos.x} ${pos.y})`);tracer.setAttribute('opacity',1);}}
  }
  function settle(){
   for(const [id,p] of points){if(p.ghost){p.el.remove();points.delete(id);}else{p.targetOpacity=p.node.excluded?.16:1;p.el.classList.remove('gi-orbit-current');}}
   tracer.setAttribute('opacity',0);active=null;map.classList.remove('gi-exploring');map.querySelector('.gi-skip')?.remove();caption.textContent=scene.caption;
  }
  function tickUntil(ms){const until=performance.now()+ms;function tick(){paint();if(performance.now()<until)raf=requestAnimationFrame(tick);}tick();}
  function show(next){cancel();if(next.source==='collection')for(const p of points.values())p.found=false;prepare(next,true);settle();tickUntil(reduced.matches?0:1050);}
  function explore(next,onFinish,onStatus){
   cancel();const run=token;map.classList.add('gi-exploring');const route=root.SonawayIntakeGraph.walk(next);stepIndex=0;let prepared=false,handoffAt=performance.now()+650,pauseUntil=handoffAt+950;
   const selected=points.get(next.source);if(selected){selected.found=true;selected.el.classList.add('gi-orbit-found','gi-found-arrival');}
   const complete=()=>{if(run!==token)return;if(!prepared){prepare(next,true);prepared=true;}for(const p of points.values())if(!p.ghost){p.revealed=true;if(p.node.choice||p.node.kind==='UPDATED'){p.found=true;p.el.classList.add('gi-orbit-found');}}settle();paint();finish=null;onFinish();};finish=complete;
   if(reduced.matches){show(next);for(const p of points.values())if(p.node.choice||p.node.kind==='UPDATED')p.found=true;onFinish();return;}
   const skip=document.createElement('button');skip.type='button';skip.className='gi-skip';skip.textContent='Skip animation';skip.addEventListener('click',()=>{cancelAnimationFrame(raf);complete();});map.append(skip);
   const report=text=>{caption.textContent=text;onStatus?.(text);};report('Selected: '+next.nodes.find(n=>n.source).label+' · carrying this record forward…');
   function tick(now){
    if(run!==token)return;
    if(!prepared&&now>=handoffAt){prepare(next,false);prepared=true;report('Following connections from '+next.nodes.find(n=>n.source).label+'…');}
    paint();
    if(now>=pauseUntil){
     if(active){const dest=points.get(active.to);if(dest){dest.el.classList.remove('gi-orbit-current');if(!active.reverse&&(dest.node.choice||dest.node.kind==='UPDATED')){dest.found=true;dest.el.classList.add('gi-orbit-found','gi-found-arrival');}if(dest.node.excluded)dest.targetOpacity=.15;}active=null;}
     if(stepIndex>=route.length){complete();return;}
     const step=route[stepIndex++],dest=points.get(step.to),from=points.get(step.from);
     if(!dest.revealed){dest.x=from.x;dest.y=from.y;dest.motion={x:from.x,y:from.y,start:now,duration:600};dest.revealed=true;dest.targetOpacity=1;}
     dest.el.classList.add('gi-orbit-current');const p=paths.get(step.edge);p.visited=!dest.node.excluded;
     const duration=step.backtrack?160:380;active={edge:step.edge,to:step.to,start:now,duration,reverse:step.backtrack};pauseUntil=now+duration+(step.backtrack?30:220);
     if(!step.backtrack)report(dest.node.excluded?'Checking '+dest.node.label.toLowerCase()+' · outside this update':dest.node.choice?'Found: '+dest.node.label:'Following '+dest.node.label.toLowerCase()+'…');
    }
    raf=requestAnimationFrame(tick);
   }
   raf=requestAnimationFrame(tick);
  }
  return {show,explore,cancel};
 }
 root.SonawayIntakeNetwork={create};
})(window);

