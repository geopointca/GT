(()=>{'use strict';
 const $=id=>document.getElementById(id);
 function render(){const list=window.GeoZayavkaBasket.items();$('items').replaceChildren();for(const item of list){
  const tr=document.createElement('tr');for(const val of [item.id,item.code,item.name]){const td=document.createElement('td');td.textContent=String(val||'');tr.append(td)}
  const td=document.createElement('td'),b=document.createElement('button');b.textContent='Удалить';b.onclick=()=>{window.GeoZayavkaBasket.toggle(item);render()};td.append(b);tr.append(td);$('items').append(tr)
 }if(!list.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=4;td.textContent='Нет выбранных пунктов';tr.append(td);$('items').append(tr)}}
 render();
 $('generate').addEventListener('click',async()=>{
  const m=$('message');m.textContent='';const points=window.GeoZayavkaBasket.items();const email=$('email').value.trim().toLowerCase();
  if(points.length<1||points.length>5){m.textContent='Выберите от 1 до 5 пунктов';return}
  if(!$('email').checkValidity()){m.textContent='Введите действительный email';return}
  try{const id=crypto.randomUUID(),zip=new JSZip();
   zip.file('request.json',JSON.stringify({format:'geozayavka-coordinates',version:1,request_id:id,email,
    points,comment:$('comment').value.slice(0,2000),created_at:new Date().toISOString()},null,2));
   const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE'}),url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='GEOZAYAVKA_'+id.slice(0,8)+'.zip';document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),15000);m.style.color='#176a3b';m.textContent='ZIP сформирован. Отправьте его владельцу каталога.';
   window.GeoZayavkaBasket.clear();render();
  }catch(e){m.textContent='Не удалось сформировать ZIP: '+e.message}
 });
})();
