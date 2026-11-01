(function(){
 'use strict';
 const shell=document.querySelector('#guided-intake'),m=window.SonawayIntakeModel,g=window.SonawayIntakeGraph;
 if(!shell||!m||!g||!window.SonawayIntakeNetwork)return;
 const stage=shell.querySelector('.gi-conversation'),summary=shell.querySelector('.gi-summary'),map=shell.querySelector('.gi-map'),progress=shell.querySelector('.gi-progress'),status=shell.querySelector('.gi-status');
 let answers={},index=0,approved=false,busy=false,output='guest';
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 const network=window.SonawayIntakeNetwork.create(map,reduced);
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function cancel(){network.cancel();busy=false;shell.removeAttribute('aria-busy');map.classList.remove('gi-searching','gi-matched','gi-publishing');}
 function rewind(to){cancel();answers=Object.fromEntries(Object.entries(answers).filter(([k])=>m.keys.indexOf(k)<to));index=to;approved=false;render();}
 function bubble(role,html,extra=''){return `<div class="gi-message gi-message-${role} ${extra}"><span class="gi-message-avatar" aria-hidden="true">${role==='user'?'Y':'S'}</span><div class="gi-message-content"><span class="gi-message-name">${role==='user'?'YOU':'SONAWAY'}</span>${html}</div></div>`;}
 function history(){
  let html=bubble('user','<p>We need to change breakfast.</p>');
  for(let i=0;i<index;i++)html+=bubble('assistant',`<p>${escape(m.step(answers,i).question)}</p>`)+bubble('user',`<p>${escape(m.selectedLabel(answers,i))}</p><button type="button" class="gi-edit-message" data-edit="${i}">Edit reply</button>`);
  return html;
 }
 function reviewMessage(){const p=m.plan(answers);return bubble('assistant',`<p class="gi-chat-question">Does this look right?</p><div class="gi-review"><span>Current</span><p>${escape(p.baseline)}</p><span>Proposed</span><p>${escape(p.after)}</p></div><p>${escape(p.guest)}</p><p class="gi-chat-note">${escape(p.owner)} reviews this change. ${escape(p.fallback)}</p>`);}
 function renderChat(){
  let message='',choices='';
  if(approved){const p=m.plan(answers);message=bubble('assistant',`<p class="gi-chat-question">Your example update is applied.</p><p>Here’s the resulting guidance. Choose a view below.</p><div class="gi-result"><span>${escape(p.venue)} · ${escape(p.when)}</span><p>${escape(p[output])}</p></div>`);choices=`<div class="gi-output-tabs">${['guest','staff','manager'].map(k=>`<button type="button" data-output="${k}" aria-pressed="${output===k}">${k[0].toUpperCase()+k.slice(1)}</button>`).join('')}</div>`;
  }else if(index===7){message=reviewMessage();choices='<button type="button" class="gi-approve" data-approve>Approve example change <span>↗</span></button>';
  }else{const s=m.step(answers,index);message=bubble('assistant',`<p class="gi-chat-question" tabindex="-1">${escape(s.question)}</p><p class="gi-chat-note">${escape(s.hint)}</p>`);choices=`<span class="gi-reply-label">CHOOSE YOUR REPLY</span><div class="gi-choices">${s.options.map(o=>`<button type="button" data-choice="${o.id}" title="${escape(o.note)}"><span>${escape(o.label)}</span><span aria-hidden="true">↗</span></button>`).join('')}</div>`;}
  stage.innerHTML=`<div class="gi-chat-top"><span class="gi-chat-avatar">S</span><div><strong>Sonaway</strong><span>Your guided knowledge update</span></div><i aria-hidden="true"></i></div><div class="gi-transcript" role="log" aria-label="Update conversation" aria-live="off" tabindex="0">${history()}${approved?reviewMessage()+bubble('user','<p>Approved. Apply the example.</p>'):''}${message}</div><div class="gi-compose">${choices}</div>`;
  const log=stage.querySelector('.gi-transcript');log.scrollTop=log.scrollHeight;
 }
 function render(){
  progress.innerHTML=m.keys.map((k,i)=>`<span class="${i<index?'done':i===index?'current':''}" title="${m.labels[i]}"></span>`).join('');
  shell.querySelector('.gi-counter').textContent=approved?'Example applied':index===7?'Review & approve':`Clarification ${index+1} of 7`;
  shell.querySelector('[data-gi-back]').disabled=index===0;
  shell.classList.toggle('gi-complete',approved);shell.classList.toggle('gi-reviewing',index===7&&!approved);
  summary.innerHTML=m.keys.map((k,i)=>answers[k]?`<div><dt>${m.labels[i]}</dt><dd><button type="button" data-edit="${i}" aria-label="Edit ${m.labels[i]}: ${escape(m.selectedLabel(answers,i))}">${escape(m.selectedLabel(answers,i))}<span aria-hidden="true"> ↗</span></button></dd></div>`:'').join('');
  shell.querySelector('.gi-scope-empty').hidden=index>0;
  renderChat();drawMap();
  status.textContent=approved?'Simulation complete. No live records changed.':index===7?'Review the draft, then approve the example.':'Choose a reply. Watch the relevant knowledge come into focus.';
 }
 function drawMap(){network.show(g.scene(m,answers,index,approved));}
 function searching(choice,done,isApproval=false){
  busy=true;shell.setAttribute('aria-busy','true');
  stage.querySelectorAll('button').forEach(b=>b.disabled=true);
  const log=stage.querySelector('.gi-transcript');log.insertAdjacentHTML('beforeend',bubble('user',`<p>${escape(isApproval?'Approved. Apply the example.':m.selectedLabel(answers,index))}</p>`)+bubble('assistant','<span class="gi-typing" aria-label="Exploring connected records"><i></i><i></i><i></i></span>'));log.scrollTop=log.scrollHeight;
  const next=g.scene(m,answers,isApproval?7:index+1,isApproval);
  network.explore(next,()=>{busy=false;shell.removeAttribute('aria-busy');done();render();const target=stage.querySelector('.gi-chat-question');if(target){target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}},text=>{status.textContent=text;});
 }
 shell.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-gi-reset'))return rewind(0);
  if(b.hasAttribute('data-gi-back'))return rewind(Math.max(0,index-1));
  if(b.dataset.edit!==undefined)return rewind(Number(b.dataset.edit));
  if(busy)return;
  if(b.dataset.output){output=b.dataset.output;renderChat();stage.querySelector(`[data-output="${output}"]`).focus({preventScroll:true});return;}
  if(b.dataset.choice){const s=m.step(answers,index);if(!s.options.some(o=>o.id===b.dataset.choice))return;answers[m.keys[index]]=b.dataset.choice;searching(b.dataset.choice,()=>index++);}
  else if(b.hasAttribute('data-approve')&&index===7&&m.validate(answers))searching('',()=>approved=true,true);
 });
 render();shell.querySelector('.gi-interactive').hidden=false;shell.querySelector('.gi-fallback').hidden=true;
})();

