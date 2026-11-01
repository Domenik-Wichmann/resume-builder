/* Fictional record neighborhoods and traversable search routes; no live retrieval. */
(function(root){
 'use strict';
 function choiceId(m,a,i,value){return `reply:${m.keys[i]}:${i===1?a.property+':':i===3?a.property+':'+a.venue+':'+a.change+':':''}${value}`;}
 function scene(m,a,index,approved=false){
  const sourceId=index?choiceId(m,a,index-1,a[m.keys[index-1]]):'collection';
  const sourceLabel=index?m.selectedLabel(a,index-1):'Grand Pines Collection';
  const options=index<7?m.step(a,index).options:[];
  const nodes=[],edges=[];
  const add=(id,label,x,y,extra={})=>{nodes.push({id,label,x,y,kind:'RECORD',...extra});return id;};
  const link=(from,to,cross=false)=>edges.push({id:from+'>'+to,from,to,cross});
  const source=(x,y)=>add(sourceId,sourceLabel,x,y,{kind:'START',source:true});
  const helper=(key,label,x,y,parent,excluded=false)=>{const id=add(`record:${index}:${key}`,label,x,y,{excluded});link(parent,id);return id;};
  const candidate=(i,x,y,parent)=>{const o=options[i];if(!o)return;const id=add(choiceId(m,a,index,o.id),o.label,x,y,{choice:o.id,kind:'MATCH'});link(parent,id);return id;};
  switch(index){
   case 0:{source(90,164);helper('reservations','Reservations',95,45,sourceId,true);const registry=helper('directory','Property directory',275,115,sourceId);const ops=helper('operations','Operations records',260,278,sourceId);candidate(0,475,55,registry);candidate(1,515,168,registry);candidate(2,475,288,ops);link(registry,ops,true);break;}
   case 1:{source(165,62);helper('guest','Guest services',65,173,sourceId,true);const dining=helper('dining','Dining directory',340,148,sourceId);candidate(0,520,53,dining);candidate(1,535,238,dining);const venues=helper('venues','Venue procedures',170,263,sourceId);candidate(2,345,290,venues);helper('spa','Spa treatments',65,295,venues,true);link(dining,venues,true);break;}
   case 2:{source(300,160);helper('menus','À la carte menu',295,43,sourceId,true);const opening=helper('opening','Opening procedure',120,65,sourceId);candidate(0,85,250,opening);const events=helper('events','Event operations',470,72,sourceId);candidate(1,540,222,events);candidate(2,335,292,sourceId);helper('cleaning','Cleaning rota',190,285,opening,true);link(opening,events,true);break;}
   case 3:{
    if(a.change==='hours'){source(90,63);const checklist=helper('checklist','Opening checklist',205,185,sourceId);helper('dinner','Dinner service',80,286,checklist,true);const kitchen=helper('kitchen','Kitchen readiness',355,105,checklist);candidate(0,535,47,kitchen);candidate(1,530,185,kitchen);candidate(2,395,287,checklist);link(sourceId,kitchen,true);}
    else if(a.change==='private'){source(95,167);const calendar=helper('calendar','Event bookings',285,70,sourceId);helper('old','Past functions',470,40,calendar,true);candidate(0,530,155,calendar);const terms=helper('terms','Group arrangements',300,265,sourceId);candidate(1,500,285,terms);helper('dinner','Evening bookings',95,290,terms,true);link(calendar,terms,true);}
    else{source(515,160);helper('rooms','Guest room inventory',520,45,sourceId,true);const directory=helper('directory','Alternative dining',330,73,sourceId);candidate(0,105,60,directory);const service=helper('service','Service locations',300,270,sourceId);candidate(1,95,240,service);link(directory,service,true);}
    break;
   }
   case 4:{source(320,45);const winter=helper('winter','December calendar',170,145,sourceId);candidate(0,75,280,winter);candidate(1,285,268,winter);const other=helper('other',a.change==='private'?'Spring calendar':'Standing policy',465,150,sourceId);candidate(2,535,286,other);helper('archive','Archived dates',555,47,other,true);link(winter,other,true);break;}
   case 5:{source(315,277);helper('roster','Staff rota',310,57,sourceId,true);const guest=helper('guest','Guest arrangements',115,175,sourceId);candidate(0,90,55,guest);const access=helper('access','Access & inclusions',500,170,sourceId);candidate(1,525,55,access);link(guest,access,true);break;}
   case 6:{source(85,215);helper('guest','Guest relations',95,55,sourceId,true);const owners=helper('owners','Approval registry',290,220,sourceId);helper('rota','Shift schedule',290,65,owners,true);candidate(0,485,80,owners);candidate(1,515,270,owners);break;}
   default:{source(85,157);const draft=helper('draft','Scoped breakfast update',280,155,sourceId);helper('dates',m.selectedLabel(a,4),205,47,draft);helper('audience',m.selectedLabel(a,5),110,285,draft);[['Guest guide',405,45],['Staff checklist',545,135],['Manager brief',495,280],['Training card',310,295]].forEach(([label,x,y])=>{const id=add('output:'+label,label,x,y,{kind:approved?'UPDATED':'READY'});link(draft,id);});}
  }
  // Stable variation between properties keeps the neighborhood organic, without random flicker.
  const shift=a.property==='alpine'?1:a.property==='garden'?-1:0;
  if(shift)nodes.forEach((n,i)=>{n.x+=shift*(i%2?9:-7);n.y+=shift*(i%3-1)*7;});
  return {nodes,edges,source:sourceId,height:345,count:options.length,title:approved?'One change, carried through.':['Find the right property.','Follow the dining records.','Trace the breakfast procedure.','Explore the service details.','Find the effective dates.','Follow the guest arrangements.','Find the responsible reviewer.','Trace the proposed impact.'][index],caption:approved?'Four connected views updated in this example.':index===7?'Review the scope before applying the example.':'Choose a reply to follow its connections.'};
 }
 function walk(scene){
  const visited=new Set([scene.source]),steps=[];
  const visit=id=>{for(const edge of scene.edges.filter(e=>e.from===id&&!e.cross)){if(visited.has(edge.to))continue;visited.add(edge.to);steps.push({from:id,to:edge.to,edge:edge.id,backtrack:false});visit(edge.to);steps.push({from:edge.to,to:id,edge:edge.id,backtrack:true});}};
  visit(scene.source);return steps;
 }
 const api={scene,walk,choiceId};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SonawayIntakeGraph=api;
})(typeof window!=='undefined'?window:globalThis);

