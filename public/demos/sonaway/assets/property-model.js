/* Local, fictional property-policy edits. Matching parent values automatically rejoin the inherited branch. */
(function(root){
  'use strict';
  const nodes={
    core:{name:'Grand Pines Collection',short:'Group',parent:null,source:'Group checkout policy'},
    lake:{name:'Lakeside Resort',short:'Lakeside',parent:'core',source:'Lakeside checkout policy'},
    garden:{name:'Garden Hotel',short:'Garden',parent:'core',source:'Garden checkout policy'},
    alpine:{name:'Alpine Lodges',short:'Alpine',parent:'core',source:'Alpine transfer agreement'},
    suites:{name:'Lakeside · spa suites',short:'Spa suites',parent:'lake',source:'Lakeside spa package'},
    rooms:{name:'Garden · standard rooms',short:'Standard rooms',parent:'garden',source:'Standard-room checkout policy'},
    lodgeA:{name:'Alpine · Lodge A',short:'Lodge A',parent:'alpine',source:'Lodge A checkout policy'},
    lodgeB:{name:'Alpine · Lodge B',short:'Lodge B',parent:'alpine',source:'Lodge B checkout policy'},
    chalet:{name:'Alpine · Summit Chalet',short:'Chalet',parent:'alpine',source:'Summit shuttle schedule'}
  };
  const defaults={core:'11:00',alpine:'10:00',suites:'13:00',chalet:'09:00'};
  function createState(){return {...defaults};}
  function sourceFor(id,state){if(!nodes[id])throw new Error('Unknown property');return Object.hasOwn(state,id)?id:sourceFor(nodes[id].parent,state);}
  function valueFor(id,state){return state[sourceFor(id,state)];}
  function lineage(id){return nodes[id].parent?[...lineage(nodes[id].parent),id]:[id];}
  function affected(id,state){return Object.keys(nodes).filter(key=>sourceFor(key,state)===id);}
  function format(time){const [h,m]=time.split(':').map(Number);return `${h%12||12}${m?':'+String(m).padStart(2,'0'):''} ${h<12?'AM':'PM'}`;}
  function normalize(state){
    const next={...state};
    Object.keys(nodes).sort((a,b)=>lineage(a).length-lineage(b).length).forEach(id=>{
      const parent=nodes[id].parent;
      if(parent&&Object.hasOwn(next,id)&&next[id]===valueFor(parent,next))delete next[id];
    });
    return next;
  }
  function changed(before,after){return Object.keys(nodes).filter(id=>valueFor(id,before)!==valueFor(id,after)||sourceFor(id,before)!==sourceFor(id,after));}
  function edit(state,id,time){
    if(!nodes[id]||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error('Invalid property or time');
    return normalize({...state,[id]:time});
  }
  function inherit(state,id){if(!nodes[id]||id==='core')throw new Error('The group must own its standard');const next={...state};delete next[id];return normalize(next);}
  const model={nodes,createState,sourceFor,valueFor,lineage,affected,format,edit,inherit,normalize,changed};
  if(typeof module!=='undefined'&&module.exports)module.exports=model;else root.SonawayPropertyModel=model;
})(typeof window!=='undefined'?window:globalThis);

