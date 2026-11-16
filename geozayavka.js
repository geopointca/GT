/* Experimental GeoZayavka coordinate request basket. No coordinates are stored. */
(()=>{'use strict';
 const KEY='geozayavka.requests.v1';
 const read=()=>{try{let d=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(d)?d.filter(p=>p&&Number.isInteger(Number(p.id))).slice(0,5):[]}catch(_){return []}};
 let items=read();
 const save=()=>{localStorage.setItem(KEY,JSON.stringify(items));render()};
 function render(){let b=document.getElementById('coordBasketBtn');if(b)b.textContent=`ЗАЯВКИ (${items.length}/5)`;}
 function toggle(p){const id=Number(p.id);if(!Number.isInteger(id)||id<=0)throw Error('Некорректный пункт');
  if(items.some(x=>Number(x.id)===id))items=items.filter(x=>Number(x.id)!==id);
  else{if(items.length>=5)throw Error('Максимум 5 пунктов в одной заявке. Сформируйте ZIP или удалите один пункт.');items.push({id,code:String(p.code||'').slice(0,90),name:String(p.name||'').slice(0,200)})}save();}
 function has(id){return items.some(x=>Number(x.id)===Number(id))}
 window.GeoZayavkaBasket={toggle,has,items:()=>items.slice(),clear:()=>{items=[];save()}};
 document.addEventListener('DOMContentLoaded',()=>{render();document.getElementById('coordBasketBtn')?.addEventListener('click',()=>{location.href='coord_request.html'})});
})();
