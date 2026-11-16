(async()=>{'use strict';
const $=id=>document.getElementById(id), id=new URLSearchParams(location.search).get('id');
const point=await window.GeotochkaPointLoader.getById(id);
const form=$('form');const p=point?.properties||{};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
if(!point){$('point').textContent='Пункт не найден на опубликованной карте';return;}
const ref=window.GeotochkaRequestPoint(p);
if(!ref){$('point').textContent='Пункт загружен, но для заявки требуется обновлённая публикация каталога или GeoTochka ID.';return;}
const requestLabel=ref.point_code||'ID-'+ref.catalog_point_id;
$('point').innerHTML=`<strong>${esc(p.name)}</strong><div>${esc(p.point_code||'Без GeoTochka ID')} · ${esc(p.category||'')}</div><div>${esc(p.region||'')}</div><div class="muted">Текущий статус: ${esc(p.condition||'Неизвестно')}</div>`;
const today=new Date();
$('date').value=[today.getFullYear(),today.getMonth()+1,today.getDate()].map(n=>String(n).padStart(2,'0')).join('-');
form.hidden=false;
$('photos').addEventListener('change',()=>{$('photoNames').textContent=[...$('photos').files].map(x=>x.name).join(' · ')});
form.addEventListener('submit',async ev=>{ev.preventDefault();const btn=$('generate');btn.disabled=true;
try{
const files=[...$('photos').files];if(files.length>10)throw Error('Можно добавить не более 10 фотографий');
if(!window.JSZip)throw Error('Не загружена библиотека формирования ZIP');
const zip=new JSZip(),photos=[];
for(let i=0;i<files.length;i++){
 const file=files[i],ext=(file.name.match(/\.(jpe?g|png|webp)$/i)||[])[1]?.toLowerCase();
 if(!ext||file.size>12*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error(`Неверный формат или размер: ${file.name}`);
 const raw=await file.arrayBuffer();const head=new Uint8Array(raw.slice(0,12));
 if((ext==='jpg'||ext==='jpeg')&&!(head[0]===255&&head[1]===216&&head[2]===255))throw Error('Неверный JPEG');
 if(ext==='png'&&!(head[0]===137&&head[1]===80&&head[2]===78&&head[3]===71))throw Error('Неверный PNG');
 if(ext==='webp'&&!(head[0]===82&&head[1]===73&&head[2]===70&&head[3]===70))throw Error('Неверный WebP');
 const path=`photos/photo_${String(i+1).padStart(3,'0')}.${ext}`;zip.file(path,raw);photos.push({path,name:file.name,caption:''});
}
const request_id=crypto.randomUUID();
zip.file('visit.json',JSON.stringify({format:'geotochka-visit',version:1,request_id,...ref,point_name:p.name||'',visit_date:$('date').value,observer:$('observer').value.trim(),description:$('description').value.trim(),proposed_status:'',center_rating:$('center_rating').value,sign_rating:$('sign_rating').value,photos},null,2));
const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:5}});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`GT_VISIT_${requestLabel}_${$('date').value}_${request_id.slice(0,8)}.zip`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
$('result').hidden=false;$('result').className='msg';$('result').innerHTML='<b>ZIP-пакет создан и скачан.</b><p>Отправьте его вложением на <a href="mailto:geopointca@gmail.com?subject=GeoTochka%20Visit">geopointca@gmail.com</a>. Не меняйте содержимое архива. Спасибо за помощь проекту!</p>';
}catch(err){$('result').hidden=false;$('result').className='warn';$('result').textContent=err.message||String(err);}finally{btn.disabled=false;}
});
})().catch(err=>{const x=document.getElementById('point');if(x)x.textContent='Ошибка загрузки пункта: '+err.message;console.warn(err)});
