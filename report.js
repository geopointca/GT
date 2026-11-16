(async()=>{'use strict';const $=id=>document.getElementById(id);const id=new URLSearchParams(location.search).get('id');const point=await window.GeotochkaPointLoader.getById(id);const p=point?.properties||{};
if(!point){$('point').textContent='Пункт не найден на опубликованной карте';return;}
const ref=window.GeotochkaRequestPoint(p);
if(!ref){$('point').textContent='Пункт загружен, но для заявки требуется обновлённая публикация каталога или GeoTochka ID.';return;}
const requestLabel=ref.point_code||'ID-'+ref.catalog_point_id;
$('point').textContent=[p.name||'Пункт',p.point_code].filter(Boolean).join(' · ');$('form').hidden=false;
const fields=[['name','Название / номер'],['category','Тип пункта'],['region','Регион'],['district','Район'],['condition','Состояние'],['description','Описание / подход'],['center_description','Описание центра'],['height','Высота H, м'],['lat','Широта WGS84'],['lon','Долгота WGS84']];
// The visitor cannot propose arbitrary statuses or point types. Keep choices in
// sync with editor/index.html. Historical values that are not in these lists
// are shown as "Без изменения" rather than silently rewritten.
const STATUS_CHOICES=['Действующий','Неизвестно','Подозрительный','Не найден','Повреждён','Утрачен'];
const CATEGORY_CHOICES=['Пункт ГГС','Пункт полигонометрии','Пункт ОМС','Временный репер','Пользовательская геоточка','Тип не определён'];
const OMS_ALIASES=new Set(['омс','омз','огс','пункт омс','пункт омз','пункт огс','oms','omz','ogs','пункт oms','пункт omz','пункт ogs']);
const canonicalType=v=>OMS_ALIASES.has(String(v||'').trim().toLowerCase())?'Пункт ОМС':String(v||'').trim();
const KEEP='__geotochka_keep_original__';
const originals={};const inputs={};const selectInitial={};
const config=window.GEOTOCHKA_SITE_CONFIG||{};
$('reportXYSection').hidden=config.publish_coordinates===false;
const coords=(config.publish_coordinates===false?[]:(p.coordinates||[])).map(c=>({crs:String(c.crs||''),x_coord:String(c.x_coord??''),y_coord:String(c.y_coord??''),height:String(c.height??'')}));
for(const [key,label] of fields){
  if(config.publish_description===false&&['description','center_description'].includes(key))continue;
  let value=(key==='lat'?point.geometry.coordinates[1]:key==='lon'?point.geometry.coordinates[0]:p[key]);
  value=String(value??'');originals[key]=value;
  const wrap=document.createElement('div');wrap.className='field'+(key==='description'?' wide':'');
  const lab=document.createElement('label');lab.textContent=label;
  let input;
  if(key==='category'||key==='condition'){
    input=document.createElement('select');
    const choices=key==='category'?CATEGORY_CHOICES:STATUS_CHOICES;
    const current=key==='category'?canonicalType(value):value;
    if(!choices.includes(current)){
      const opt=document.createElement('option');opt.value=KEEP;
      opt.textContent='— Не менять (сейчас: '+(value||'не указано')+')';
      input.append(opt);
    }
    for(const choice of choices){
      const opt=document.createElement('option');opt.value=choice;opt.textContent=choice;
      input.append(opt);
    }
    const initial=choices.includes(current)?current:KEEP;
    input.value=initial;selectInitial[key]=initial;
    input.onchange=()=>wrap.classList.toggle('changed',input.value!==initial&&input.value!==KEEP);
  }else{
    input=key==='description'?document.createElement('textarea'):document.createElement('input');
    input.value=value;input.maxLength=8000;
    input.oninput=()=>wrap.classList.toggle('changed',input.value!==value);
  }
  wrap.append(lab,input);$('fields').append(wrap);inputs[key]=input;
}
function addCoord(c={},added=false){const row=document.createElement('div');row.className='coord';const fields=['crs','x_coord','y_coord','height'];for(let i=0;i<4;i++){const el=document.createElement('input');el.value=c[fields[i]]??'';el.placeholder=['СК / система','X','Y','H'][i];el.dataset.field=fields[i];row.append(el);}const remove=document.createElement('button');remove.type='button';remove.className='remove';remove.textContent='×';remove.title='Убрать новую строку';remove.disabled=!added;remove.onclick=()=>row.remove();row.append(remove);$('coordinates').append(row);}
coords.forEach(c=>addCoord(c));$('addCoord').onclick=()=>addCoord({},true);
$('form').onsubmit=async e=>{e.preventDefault();try{const changes={};for(const [key] of fields){
  if(!inputs[key])continue;
  const v=inputs[key].value;
  if(key in selectInitial){
    // Do not submit a historical free-text status or type as a proposed edit.
    if(v!==KEEP&&v!==selectInitial[key])changes[key]=v;
  }else if(v!==originals[key])changes[key]=v;
}const updated=[...$('coordinates').children].map(row=>{const x={};row.querySelectorAll('input').forEach(input=>x[input.dataset.field]=input.value.trim());return x;}).filter(x=>x.crs||x.x_coord||x.y_coord||x.height);if(config.publish_coordinates!==false&&JSON.stringify(updated)!==JSON.stringify(coords))changes.coordinates=updated;
const wrong=$('wrongCoords').checked,comment=$('comment').value.trim();if(!Object.keys(changes).length&&!wrong&&!comment)throw Error('Не указано ни одного исправления');
const zip=new JSZip(),uid=crypto.randomUUID();zip.file('report.json',JSON.stringify({format:'geotochka-report',version:1,request_id:uid,...ref,point_name:p.name||'',snapshot:{fields:originals,coordinates:coords},changes,wrong_coordinates:wrong,comment,created_at:new Date().toISOString()},null,2));const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`GT_REPORT_${requestLabel}_${uid.slice(0,8)}.zip`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);$('result').className='ok';$('result').textContent='Заявка скачана. Отправь ZIP владельцу каталога для рассмотрения.';
}catch(err){$('result').className='warn';$('result').textContent=err.message;}};
})().catch(err=>{const x=document.getElementById('point');if(x)x.textContent='Ошибка загрузки пункта: '+err.message;console.warn(err)});
