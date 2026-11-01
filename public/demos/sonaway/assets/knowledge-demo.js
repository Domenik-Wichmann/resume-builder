'use strict';

// Fictional, deterministic examples. No client data, API calls or permissions logic.
(() => {
  const lab = document.querySelector('#knowledge-lab');
  if (!lab) return;
  const $ = selector => lab.querySelector(selector);
  const $$ = selector => [...lab.querySelectorAll(selector)];
  const property = window.SonawayPropertyModel;
  const nodes = property.nodes;
  let policyState = property.createState();
  let selected = 'core';
  let editing = null;
  let flow = null;
  let flowTimer;
  let policyMessage = 'Select a property or its time to edit. Matching a parent’s time rejoins its branch automatically.';
  const sourceFor = id => property.sourceFor(id,policyState);
  const cardFor = id => $(`[data-policy-node="${id}"]`);
  const sourceName = id => nodes[id].short;
  function stopFlow(){
    clearTimeout(flowTimer);flow=null;
    $$('[data-policy-node]').forEach(card=>{card.classList.remove('kl-arrival');card.style.removeProperty('--arrival-delay');});
  }
  function startFlow(origin,targets){
    stopFlow();
    flow={origin,targets,started:performance.now()};
    void lab.offsetWidth;
    const depth=property.lineage(origin).length;
    targets.forEach(id=>{
      const card=cardFor(id),delay=Math.max(0,property.lineage(id).length-depth)*850;
      card.style.setProperty('--arrival-delay',`${delay}ms`);
      card.classList.add('kl-arrival');
    });
    drawMaps();
    flowTimer=setTimeout(()=>{stopFlow();drawMaps();},4000);
  }
  function renderPolicy(){
    $$('[data-policy-node]').forEach(card=>{
      const id=card.dataset.policyNode,source=sourceFor(id),value=property.valueFor(id,policyState);
      card.dataset.rule=source;
      card.dataset.selected=String(selected===id);
      card.classList.toggle('kl-editing',editing===id);
      const trigger=card.querySelector('.kl-node-trigger');
      trigger.setAttribute('aria-expanded',String(editing===id));
      trigger.setAttribute('aria-label',`${nodes[id].name}, checkout ${property.format(value)}. Edit checkout time.`);
      card.querySelector('.kl-node-time').textContent=property.format(value);
      card.querySelector('.kl-node-origin').textContent=id==='core'?'Group standard':Object.hasOwn(policyState,id)?'Own approved rule':`Inherits · ${sourceName(source)}`;
      const input=card.querySelector('.kl-inline-time');input.hidden=editing!==id;input.value=value;
    });
    const source=sourceFor(selected),own=source===selected;
    $('#kl-policy-detail').dataset.rule=source;
    $('#kl-detail-name').textContent=nodes[selected].name;
    $('#kl-detail-time').textContent=property.format(property.valueFor(selected,policyState));
    $('#kl-detail-description').textContent=own?`${nodes[selected].name} owns this rule. Edits flow to inheriting descendants. Local rules that match their parent rejoin that branch.`:`Currently follows ${nodes[source].name}. A different time creates a local rule. Match the parent’s time to rejoin its branch.`;
    $('#kl-detail-source').textContent=`Approved source: ${nodes[source].source}`;
    $('#kl-detail-path').textContent=property.lineage(selected).map(id=>nodes[id].name).join(' → ');
    $('#kl-inherit').hidden=selected==='core'||!own;
    if(nodes[selected].parent)$('#kl-inherit').textContent=`Use ${nodes[nodes[selected].parent].short} rule instead`;
    $('#kl-policy-status').textContent=policyMessage;
    const defaults=property.createState();
    $('#kl-reset').disabled=Object.keys(defaults).length===Object.keys(policyState).length&&Object.keys(defaults).every(id=>defaults[id]===policyState[id]);
    const legend=$('.kl-legend');legend.replaceChildren(...Object.keys(policyState).map(id=>{
      const label=document.createElement('span');label.dataset.rule=id;
      label.append(document.createElement('i'),document.createTextNode(nodes[id].short));return label;
    }));
    requestAnimationFrame(drawMaps);
  }
  function closeEditor(id){
    if(editing!==id)return;editing=null;renderPolicy();
  }
  $$('[data-policy-node]').forEach(card=>{
    const id=card.dataset.policyNode,trigger=card.querySelector('.kl-node-trigger'),input=card.querySelector('.kl-inline-time');
    input.setAttribute('aria-label',`Checkout time for ${nodes[id].name}`);
    for(let minutes=0;minutes<1440;minutes+=30){
      const value=`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
      const option=document.createElement('option');option.value=value;option.textContent=property.format(value);input.append(option);
    }
    trigger.addEventListener('click',()=>{selected=id;editing=id;renderPolicy();input.focus({preventScroll:true});});
    input.addEventListener('change',()=>{
      if(input.value===property.valueFor(id,policyState))return;
      const before=policyState;
      policyState=property.edit(policyState,id,input.value);selected=id;
      const targets=property.changed(before,policyState);
      const joined=Object.keys(before).filter(key=>key!=='core'&&!Object.hasOwn(policyState,key));
      const origin=sourceFor(id)===id?id:nodes[id].parent;
      policyMessage=`${nodes[id].name}: ${property.format(input.value)}. ${targets.length} connected view${targets.length===1?'':'s'} updated.${joined.length?` ${joined.length} matching local rule${joined.length===1?' rejoins':'s rejoin'} the parent branch.`:' Different local rules stay separate.'}`;
      renderPolicy();startFlow(origin,targets);
    });
    input.addEventListener('blur',()=>closeEditor(id));
    input.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();closeEditor(id);trigger.focus({preventScroll:true});}
    });
  });
  $('#kl-inherit').addEventListener('click',()=>{
    const before=policyState,parent=nodes[selected].parent;
    policyState=property.inherit(policyState,selected);editing=null;
    const targets=property.changed(before,policyState);
    policyMessage=`${nodes[selected].name} follows ${nodes[sourceFor(selected)].name} again: ${property.format(property.valueFor(selected,policyState))}.`;
    renderPolicy();startFlow(parent,targets);
  });
  $('#kl-reset').addEventListener('click',()=>{
    stopFlow();policyState=property.createState();selected='core';editing=null;
    policyMessage='Example restored. Select any property to try another change.';renderPolicy();
  });

  const model = window.SonawayDemoModel;
  const dateInput = $('#kl-date');
  const policyInput = $('#kl-policy-select');
  function renderContext() {
    const result = model.resolve(dateInput.value, policyInput.value);
    if (!result || !dateInput.validity.valid) {
      dateInput.setAttribute('aria-invalid','true');
      $('#kl-effective').hidden = true;
      $$('.kl-context-card').forEach(card=>{card.classList.remove('kl-on-path','kl-answer-node'); card.removeAttribute('aria-current');});
      $('#kl-context-status').textContent = 'Choose one of the example dates to explore its policy.';
      requestAnimationFrame(drawMaps); return;
    }
    dateInput.removeAttribute('aria-invalid'); $('#kl-effective').hidden = false;
    const policy = policyInput.value;
    $$('.kl-context-card').forEach(card => {
      const key = card.dataset.context;
      const value = model.inherited(key,policy);
      const active = result.path.includes(key);
      card.classList.toggle('kl-on-path',active);
      card.classList.toggle('kl-answer-node',result.source === key);
      card.setAttribute('aria-current',String(result.leaf === key));
      const cardValue = value.value === 'Reserved for wedding guests' ? 'Wedding only' : value.value.split(' · ')[0];
      card.querySelector('.kl-context-value').textContent = cardValue;
      card.querySelector('.kl-context-origin').textContent = result.source === key ? '● Supplies this answer' : value.source === key ? 'Own approved rule' : `Inherits ${model.contexts[value.source].name.toLowerCase()}`;
    });
    const label = new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(dateInput.value+'T12:00:00Z'));
    $('#kl-answer-date').textContent = label;
    $('#kl-context-question').textContent = model.policies[policy].question;
    $('#kl-context-value').textContent = result.value;
    $('#kl-context-answer').textContent = result.answer;
    $('#kl-context-source').textContent = model.contexts[result.source].name;
    $('#kl-context-reason').textContent = result.source === result.leaf ? (result.source === 'base' ? 'No seasonal or event exception applies on this date.' : 'This more specific approved rule replaces the inherited answer for this date.') : `${model.contexts[result.leaf].name} has no separate ${model.policies[policy].short.toLowerCase()} rule, so it keeps the ${model.contexts[result.source].name.toLowerCase()} rule.`;
    $('#kl-active-path').textContent = result.path.map(id=>model.contexts[id].name).join(' → ');
    $('#kl-context-status').textContent = `${label}: ${result.value}. Source: ${model.contexts[result.source].name}. Dates repeat annually in this fictional example.`;
    requestAnimationFrame(drawMaps);
  }
  dateInput.addEventListener('change',renderContext);
  policyInput.addEventListener('change',renderContext);
  $$('.kl-context-card').forEach(card=>card.addEventListener('click',()=>{dateInput.value=model.contexts[card.dataset.context].sample;renderContext();}));
  $('#kl-context-reset').addEventListener('click',()=>{dateInput.value='2026-06-15';renderContext();});

  const audiences = {
    guest: { name:'Guest',tag:'GUEST INFORMATION',intro:'The main buffet is reserved for a private wedding on December 18. Your breakfast is ready at Terrace Bistro from 7–10:30 AM, with the same breakfast inclusion as your booking.',rows:[['Where to go','Follow the Terrace Bistro signs beside reception. The team can help with seating and dietary requests.']],boundaryTitle:'Useful to a guest',boundary:'Hours, location and booking inclusions. No internal instructions or commercial terms.',source:'Approved guest breakfast notice' },
    staff: { name:'Staff member',tag:'SERVICE PROCEDURE',intro:'Direct non-wedding guests to Terrace Bistro, 7–10:30 AM. Serve the wedding party at the main buffet, 8–11 AM.',rows:[['Before service','Set up the bistro by 6:45 AM. Put the wedding-reservation sign at the main buffet and check wedding access against the event list.'],['During service','Honor each room’s breakfast inclusion in the bistro. Send access disputes or requests outside the plan to the duty manager.']],boundaryTitle:'Useful to the service team',boundary:'Service steps and escalation guidance. Management staffing plans and contract terms stay restricted.',source:'Guest breakfast notice + wedding service checklist' },
    manager: { name:'Manager',tag:'RESTRICTED MANAGEMENT DETAIL',intro:'Wedding party: main buffet, 8–11 AM. Other guests: Terrace Bistro, 7–10:30 AM, with their usual breakfast inclusion.',rows:[['Staffing & readiness','Assign 4 buffet staff, 2 bistro staff and 1 shared runner. Check rooms and kitchen at 6:45 AM.'],['Commercial commitment','Example contract: 60 breakfasts at $24 each. Event lead approves extra covers.'],['Control the handoff','Duty manager handles access and queues. Review final covers with F&B after service.']],boundaryTitle:'Useful to the manager',boundary:'Managers also see staffing, negotiated pricing and approval responsibility.',source:'Breakfast notice · service checklist · event contract & staffing plan' }
  };
  function renderAudience(key) {
    const view = audiences[key];
    $$('button[data-audience]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.audience===key)));
    $('#kl-audience-preview').dataset.audience=key;
    $('#kl-question-role').textContent=view.name.toUpperCase()+' ASKS';
    $('#kl-audience-tag').textContent=view.tag;
    $('#kl-audience-intro').textContent=view.intro;
    $('#kl-audience-rows').replaceChildren(...view.rows.map(([title,description])=>{
      const row=document.createElement('div'), heading=document.createElement('h5'), p=document.createElement('p');
      heading.textContent=title;p.textContent=description;row.append(heading,p);return row;
    }));
    $('#kl-boundary-title').textContent=view.boundaryTitle;
    $('#kl-audience-boundary').textContent=view.boundary;
    $('#kl-audience-source').textContent=view.source;
    $('#kl-audience-status').textContent=`${view.name} answer selected. ${view.boundary}`;
  }
  $$('button[data-audience]').forEach(button=>button.addEventListener('click',()=>renderAudience(button.dataset.audience)));

  // Keep the base connectors visible and animate only the inheriting paths downstream of the edit.
  function drawMaps(){
    $$('.kl-map').forEach(map=>{
      if(!map.getClientRects().length)return;
      const svg=map.querySelector('svg'),bounds=map.getBoundingClientRect();
      svg.setAttribute('viewBox',`0 0 ${bounds.width} ${bounds.height}`);svg.replaceChildren();
      map.querySelectorAll('[data-parent]').forEach(child=>{
        const parent=map.querySelector(`[data-policy-node="${child.dataset.parent}"], [data-context="${child.dataset.parent}"]`);
        const a=parent.getBoundingClientRect(),b=child.getBoundingClientRect();
        const x1=a.left+a.width/2-bounds.left,y1=a.bottom-bounds.top,x2=b.left+b.width/2-bounds.left,y2=b.top-bounds.top;
        const junction=y2-9;
        const d=`M${x1},${y1} V${junction} H${x2} V${y2}`;
        const path=document.createElementNS('http://www.w3.org/2000/svg','path');
        path.setAttribute('d',d);
        if(child.classList.contains('kl-on-path'))path.classList.add('kl-active-edge');
        svg.append(path);
        const id=child.dataset.policyNode;
        if(flow&&id&&id!==flow.origin&&flow.targets.includes(id)){
          const level=property.lineage(id).length-property.lineage(flow.origin).length;
          const elapsed=performance.now()-flow.started,delay=(level-1)*850;
          if(elapsed>delay+1900)return;
          const pulse=path.cloneNode();pulse.setAttribute('pathLength','100');
          pulse.classList.add('kl-flow-line');pulse.dataset.to=id;
          pulse.style.stroke=getComputedStyle(cardFor(flow.origin)).getPropertyValue('--rule');
          pulse.style.animationDelay=`${delay-elapsed}ms`;
          svg.append(pulse);
        }
      });
    });
  }
  const tabs=$$('[role="tab"]');
  function activateTab(tab,focus=false) {
    tabs.forEach(button=>{const active=button===tab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;$(`#${button.getAttribute('aria-controls')}`).hidden=!active;});
    if(focus)tab.focus();requestAnimationFrame(drawMaps);
  }
  tabs.forEach((tab,i)=>{
    tab.addEventListener('click',()=>activateTab(tab));
    tab.addEventListener('keydown',e=>{
      let next;
      if(e.key==='ArrowRight')next=(i+1)%tabs.length;
      if(e.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;
      if(e.key==='Home')next=0;
      if(e.key==='End')next=tabs.length-1;
      if(next!==undefined){e.preventDefault();activateTab(tabs[next],true);}
    });
  });
  renderPolicy();renderContext();renderAudience('guest');
  $('#kl-interactive').hidden=false;
  new ResizeObserver(()=>requestAnimationFrame(drawMaps)).observe(lab);
  if(document.fonts)document.fonts.ready.then(drawMaps);
  window.addEventListener('load',()=>{
    if(['#knowledge-lab','#reclaim-calculator'].includes(location.hash)){
      document.querySelector(location.hash)?.scrollIntoView({block:'start',behavior:'instant'});
    }
  },{once:true});
})();

