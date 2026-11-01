/* Scripted hospitality intake: each choice changes the reviewed plan. No AI or backend calls. */
(function(root){
 'use strict';
 const properties={
  lakeside:{label:'Lakeside Resort',venues:[['main','Main Restaurant','7–10 AM'],['terrace','Terrace Bistro','7–10:30 AM'],['spa','Spa Café','8–11 AM']]},
  garden:{label:'Garden Hotel',venues:[['garden','Garden Restaurant','7–10 AM'],['courtyard','Courtyard Café','7–11 AM'],['lobby','Lobby Lounge','8–11 AM']]},
  alpine:{label:'Alpine Lodges',venues:[['lodgeA','Lodge A Dining Room','6:30–10 AM'],['lodgeB','Lodge B Dining Room','6:30–10 AM'],['summit','Summit Dining Room','7–10 AM']]}
 };
 const keys=['property','venue','change','detail','period','scope','owner'];
 const labels=['Property','Dining venue','Change','Exact detail','When','Who / alternative','Approver'];
 const option=(id,label,note='')=>({id,label,note});
 function venue(a){return properties[a.property]?.venues.find(v=>v[0]===a.venue);}
 function step(a,index){
  const p=properties[a.property],v=venue(a);
  switch(index){
   case 0:return {question:'Which property is changing breakfast?',hint:'I found three properties with separate dining guidance.',status:'Matching property records…',options:Object.entries(properties).map(([id,p])=>option(id,p.label,'Explore its dining locations'))};
   case 1:return {question:`Where at ${p.label}?`,hint:'Each venue has its own breakfast procedure. We’ll leave the others alone.',status:'Finding dining locations and their source policies…',options:p.venues.map(v=>option(v[0],v[1],`Current breakfast: ${v[2]}`))};
   case 2:return {question:'What is actually changing?',hint:`Let’s narrow down the change to ${v[1]}.`,status:'Checking the current breakfast procedure…',options:[option('hours','Change the opening time','Keep the venue and closing time'),option('private','Reserve it for a private event','Arrange an alternative for other guests'),option('move','Move breakfast somewhere else','Keep the current service hours')]};
   case 3:
    if(a.change==='hours')return {question:'What time should breakfast start?',hint:`It currently runs ${v[2]}. The closing time stays the same.`,status:'Comparing the proposed service times…',options:[option('06:00','6 AM','An earlier start'),option('08:00','8 AM','A later start'),option('09:00','9 AM','A shorter morning service')]};
    if(a.change==='private')return {question:'Who is the private booking for?',hint:'This determines whose access instructions need to change.',status:'Matching the event and access instructions…',options:[option('wedding','A wedding party','Private breakfast for wedding guests'),option('conference','A conference group','Private breakfast for registered delegates')]};
    return {question:'Where will breakfast move to?',hint:'Choose another dining space at the same property.',status:'Checking alternative venues…',options:p.venues.filter(x=>x[0]!==a.venue).map(x=>option(x[0],x[1],'Use this venue for the affected breakfast service'))};
   case 4:return {question:'When should this apply?',hint:a.change==='private'?'The reservation applies only on its approved event date.':'A temporary change should not replace the normal year-round procedure.',status:'Checking the dates and normal-policy fallback…',options:a.change==='private'?[option('dec18','December 18 only','One wedding or conference date'),option('dec25','December 25 only','An event during Christmas'),option('apr16','April 16 only','A spring event')]:[option('dec18','December 18 only','Return to normal the next day'),option('christmas','December 24–30','Christmas week, then return to normal'),option('ongoing','From December 1 onward','No scheduled end date')]};
   case 5:
    if(a.change==='private'){const alternative=p.venues.find(x=>x[0]!==a.venue);return {question:'What should other hotel guests do?',hint:'Closing access is only half the instruction. Guests also need a clear alternative.',status:'Tracing the guest notice and service handoff…',options:[option('alternative',`Breakfast at ${alternative[1]}`,`Keep their breakfast inclusion; use ${v[2]}`),option('room','Use included room service',`Offer breakfast delivery during ${v[2]}`)]};}
    return {question:'Who does the change apply to?',hint:'The audience changes both the published notice and the staff instructions.',status:'Matching the affected guest and staff guidance…',options:[option('all','All hotel guests','One arrangement for everyone'),option('event','Event guests only','Other guests keep their normal arrangements')]};
   case 6:return {question:'Who should approve this change?',hint:'We now have a specific draft. Choose who is responsible for reviewing it.',status:'Preparing the impact summary for review…',options:[option('fb','Food & beverage manager','Review dining capacity and service procedures'),option('duty','Duty manager','Review guest arrangements and the operational handoff')]};
   default:return null;
  }
 }
 function selectedLabel(a,index){return step(a,index)?.options.find(o=>o.id===a[keys[index]])?.label||'';}
 function validate(a){return keys.every((key,index)=>Boolean(step(a,index)?.options.some(o=>o.id===a[key])));}
 function plan(a){
  if(!validate(a))throw new Error('Complete all intake choices before approval');
  const p=properties[a.property],v=venue(a),detail=selectedLabel(a,3),when=selectedLabel(a,4),owner=selectedLabel(a,6);
  const period={dec18:'December 18, 2026',dec25:'December 25, 2026',apr16:'April 16, 2026',christmas:'December 24–30, 2026',ongoing:'December 1, 2026 onward'}[a.period];
  const fallback=a.period==='ongoing'?'Remains in effect until an approved replacement.':'The normal procedure returns after the approved period.';
  const baseline=`${v[1]} · ${v[2]} · all hotel guests`;
  let after,guest,staff;
  if(a.change==='hours'){
   const scope=a.scope==='all'?'All hotel guests':'Event guests';
   const closing=v[2].split('–')[1];
   after=`${detail} start · ${scope.toLowerCase()}`;
   guest=`${scope}: breakfast at ${v[1]} starts at ${detail} and closes at ${closing} for ${period}.${a.scope==='event'?' Other guests keep their normal breakfast arrangement.':''}`;
   staff=`Prepare ${v[1]} for the ${detail} opening, with the existing ${closing} close. Update the opening checklist and brief reception.${a.scope==='event'?' Apply the change only to event guests; retain normal guidance for everyone else.':''}`;
  }else if(a.change==='private'){
   const party=a.detail==='wedding'?'wedding party':'conference group';
   const alternative=p.venues.find(x=>x[0]!==a.venue);
   const destination=a.scope==='room'?'included breakfast room service':`breakfast at ${alternative[1]}`;
   after=`Private ${party} · alternative arranged`;
   guest=`${v[1]} is reserved for a ${party} on ${period}. Other hotel guests can use ${destination} during ${v[2]}, with their existing breakfast inclusion.`;
   staff=`Use the event list for access to ${v[1]}. Direct other guests to ${destination}, ${v[2]}. Confirm capacity with the kitchen and brief reception before service.`;
  }else{
   const destination=p.venues.find(x=>x[0]===a.detail)[1],scope=a.scope==='all'?'All hotel guests':'Event guests';
   after=`${destination} · ${v[2]}`;
   guest=`${scope}: breakfast moves from ${v[1]} to ${destination}, ${v[2]}, for ${period}.${a.scope==='event'?' Other guests keep their normal venue.':''}`;
   staff=`Set up ${destination} for ${v[2]} service. Update signs and brief reception.${a.scope==='event'?' Redirect only event guests; retain normal service for other guests.':' Redirect all hotel guests from the original venue.'}`;
  }
  return {property:p.label,venue:v[1],baseline,after,when,period,owner,fallback,guest,staff,manager:`${owner} owns this change at ${p.label}. Confirm the venue, guest scope and dates before publishing. ${fallback}`,outputs:['Staff checklist','Guest guide','Manager brief','Training card']};
 }
 const model={properties,keys,labels,step,venue,selectedLabel,validate,plan};
 if(typeof module!=='undefined'&&module.exports)module.exports=model;else root.SonawayIntakeModel=model;
})(typeof window!=='undefined'?window:globalThis);

