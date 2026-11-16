(() => {
  const el = id => document.getElementById(id);
  const safe = s => String(s ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const param = new URLSearchParams(location.search);
  const id = param.get('id');
  const isEditor = location.pathname.startsWith('/print-card/');
  const empty = s => s===null || s===undefined || String(s).trim()==='';
  // The QR on the printed card always points to the public map by unique ID.
  // A local preview must never encode localhost or a private/nonpublished point.
  function renderPointQr(feature, editorPublicUrl){
    const link=el('pointQrLink'),box=el('pointQrArt');
    link.hidden=true;box.replaceChildren();link.removeAttribute('href');
    const p=feature?.properties||{};
    const pointId=p.id;
    if(pointId===null||pointId===undefined||String(pointId)==='')return;
    let publicUrl='';
    if(isEditor){
      publicUrl=String(editorPublicUrl||'').trim();
    }else{
      // The card is served next to index.html on the public static website.
      const url=new URL('index.html',location.href);
      url.search='';url.hash='';url.searchParams.set('id',String(pointId));
      publicUrl=url.href;
    }
    if(!/^https:\/\//i.test(publicUrl)||typeof window.GeotochkaQR?.toSVG!=='function')return;
    try{
      box.appendChild(window.GeotochkaQR.toSVG(publicUrl));
      link.href=publicUrl;
      link.title='Открыть пункт на карте: '+publicUrl;
      link.hidden=false;
    }catch(e){console.warn('Не удалось создать QR-код:',e);}
  }
  // Only published catalog photos and explicitly permitted external GeoBridge media.
  function safePhoto(url){
    const s=String(url||'').trim();
    if(/^images\/[0-9]+\/[A-Za-z0-9_.-]+$/.test(s))return s;
    if(/^\/media\/point_[0-9]+\/[A-Za-z0-9_.-]+$/.test(s))return s;
    try{const u=new URL(s);if(u.protocol==='https:'&&u.hostname==='storage.yandexcloud.net')return u.href;}catch(_){}
    return null;
  }
  function renderRatings(history){
    const votes=history?.votes||{};
    const groups=[['center','Состояние центра'],['sign','Наружный знак']];
    const labels=['Сохранён','Не найден','Повреждён','Утрачен'];
    let any=false;
    const cards=[];
    for(const [key,title] of groups){
      const vals=votes[key]||{};
      const entries=labels.filter(label=>label in vals).map(label=>[label,Number(vals[label])||0]);
      const total=entries.reduce((a,entry)=>a+entry[1],0);
      if(!total)continue;
      any=true;
      cards.push(`<div class="rating-chart"><h3>${safe(title)}</h3>${entries.map(([label,n])=>`<div class="rating-row"><span>${safe(label)}</span><div class="rating-track"><span class="rating-fill" style="width:${(100*n/total).toFixed(2)}%"></span></div><b>${n}</b></div>`).join('')}<div class="rating-total">Всего оценок: ${total}</div></div>`);
    }
    el('ratingSection').hidden=!any;
    el('ratingSummary').innerHTML=cards.join('');
  }
  function renderComments(history,links){
    const comments=Array.isArray(history?.comments)?history.comments:[];
    const entries=comments.filter(c=>!empty(c.text)).slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
    el('commentsSection').hidden=!entries.length;
    el('commentsBody').innerHTML=entries.map(c=>`<tr><td class="number">${safe(c.date||'—')}</td><td>${window.GeotochkaLinks.html(c.text,links)}</td></tr>`).join('');
  }
  function render(feature, editorPublicUrl='', history=null){
    if(!feature){el('notFound').hidden=false; return;}
    const p=feature.properties||{};
    const c=feature.geometry?.coordinates||[];
    const lon=Number(c[0]), lat=Number(c[1]);
    document.title=`${p.name||p.point_code||'Пункт'} — карточка Геоточка`;
    el('card').hidden=false;
    renderPointQr(feature,editorPublicUrl);
    el('name').textContent=p.name||p.point_code||'Без названия';
    el('code').textContent=p.point_code||'—';
    el('condition').textContent=p.condition||'Неизвестно';
    el('category').textContent=p.category||'Не определён';
    el('region').textContent=[p.region_code,p.region].filter(Boolean).join(' — ')||'—';
    // Display the public catalogue attributes, never private provenance fields.
    const extraFields=[['Район',p.district]];
    const present=extraFields.filter(([,v])=>!empty(v));
    el('otherFields').hidden=!present.length;
    el('otherFields').innerHTML=present.map(([label,value])=>`<div class="field"><span class="label">${safe(label)}</span><strong>${safe(value)}</strong></div>`).join('');
    el('publicNotesSection').hidden=true;
    el('publicNotes').textContent='';
    const publishCfg=window.GEOTOCHKA_SITE_CONFIG||{};
    el('descriptionSection').hidden=publishCfg.publish_description===false;
    el('centerSection').hidden=publishCfg.publish_description===false;
    el('xySection').hidden=publishCfg.publish_coordinates===false;
    el('description').innerHTML=window.GeotochkaLinks.html(p.description||'Сведения отсутствуют',p.links);
    el('centerDescription').innerHTML=window.GeotochkaLinks.html(p.center_description||'Сведения отсутствуют',p.links);
    el('wgs84').textContent=Number.isFinite(lat)&&Number.isFinite(lon)?`${lat.toFixed(8)}°, ${lon.toFixed(8)}°`:'Не определено';
    const coords=publishCfg.publish_coordinates!==false&&Array.isArray(p.coordinates)?p.coordinates:[];
    const cr=coords.map(row=>`<tr><td>${safe(row.crs||'—')}</td><td class="number">${safe(row.x_coord??'—')}</td><td class="number">${safe(row.y_coord??'—')}</td><td class="number">${safe(row.height??'—')}</td></tr>`).join('');
    el('coordinatesBody').innerHTML= (Number.isFinite(lat)&&Number.isFinite(lon)?`<tr><td><b>WGS84</b></td><td class="number">${lat.toFixed(8)}°</td><td class="number">${lon.toFixed(8)}°</td><td>—</td></tr>`:'')+cr||'<tr><td colspan="4">Координаты не указаны</td></tr>';
    const formatVisitDate=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s||'')))return s||'—';const [y,m,d]=s.split('-').map(Number);return `${d} ${['','января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'][m]} ${y}`;};
    const visits=(Array.isArray(p.visits)?p.visits:[]).slice().sort((a,b)=>String(b.visit_date||b.date||'').localeCompare(String(a.visit_date||a.date||'')));
    el('visitsBody').innerHTML=visits.length?visits.map(v=>`<tr><td>${safe(formatVisitDate(v.visit_date||v.date))}</td><td>${safe(v.visitor||v.observer||'—')}</td><td>${window.GeotochkaLinks.html(v.description||'—',p.links)}</td></tr>`).join(''):'<tr><td>—</td><td>—</td><td>Подтверждённых посещений пока нет.</td></tr>';
    const obs=history||p.observation_history||{};
    renderRatings(obs);
    renderComments(obs,p.links);
    // Merge catalogue images with external photo URLs, retaining all distinct photographs.
    const images=[...(Array.isArray(p.images)?p.images:[]),...(Array.isArray(obs.photos)?obs.photos:[]).map(x=>({...x,date_taken:x.date,image_type:'Фото пункта'}))];
    const seen=new Set(),photos=[];
    for(const ph of images){
      const url=safePhoto(ph?.url||ph?.local_url);
      if(!url||seen.has(url))continue;
      seen.add(url);photos.push({...ph,safe_url:url});
    }
    const photosBox=el('photos');
    el('photosSection').hidden=!photos.length;
    photosBox.innerHTML=photos.map((ph,i)=>{
      const description=ph.caption||ph.image_type||`Фото ${i+1}`;
      return `<figure class="photo"><img src="${safe(ph.safe_url)}" alt="${safe(description)}" loading="eager"><figcaption><span>${safe(description)}</span>${ph.date_taken?` · ${safe(ph.date_taken)}`:''}</figcaption></figure>`;
    }).join('');
    // Real, scannable QR codes. QR content is always the full original URL.
    const materials=(p.links||[]).filter(l=>window.GeotochkaLinks.valid(l.url));
    const grid=el('materialsPrintGrid');grid.replaceChildren();el('materialsPrintSection').hidden=!materials.length;
    for(const l of materials){
      const url=window.GeotochkaLinks.valid(l.url);const tile=document.createElement('div');tile.className='material-qr-tile';
      const heading=document.createElement('div');heading.className='material-qr-heading';heading.textContent='['+l.number+'] '+(l.title||'Материал');
      const qr=document.createElement('div');qr.className='material-qr-art';
      try{qr.append(window.GeotochkaQR.toSVG(url));}catch(e){qr.textContent='QR недоступен';}
      const anchor=document.createElement('a');anchor.href=url;anchor.target='_blank';anchor.rel='noopener noreferrer';anchor.className='material-qr-url';anchor.textContent=l.url;
      tile.append(heading,qr,anchor);grid.append(tile);
    }
    el('creationDate').textContent=new Date().toLocaleDateString('ru-RU');
  }
  async function init(){
    if(!id){render(null);return;}
    if(isEditor){
      const res=await fetch('/api/print-point?id='+encodeURIComponent(id),{cache:'no-store'});
      if(!res.ok)throw Error('Ошибка получения пункта');
      const json=await res.json(); render(json.ok?json.feature:null,json.public_url||'');
    }else{
      const feature=await window.GeotochkaPointLoader.getById(id);
      if(!feature){render(null);return;}
      // The same full observation history is already published for the visit tab.
      // Fetch it on demand so the map itself remains fast with millions of points.
      let history=null;
      const p=feature.properties||{};
      if(p.gb_summary?.event_count||p.gb_summary?.photo_count){
        const dataVersion=window.GEOTOCHKA_SITE_CONFIG?.data_version||'';
        const bucket=String(Number(id)%256).padStart(3,'0');
        const path='history/h_'+bucket+'.json?v='+encodeURIComponent(dataVersion);
        try{const response=await fetch(path);if(response.ok)history=(await response.json())[String(id)]||null;}
        catch(err){console.warn('Не удалось загрузить историю пункта:',err);}
      }
      render(feature,'',history);
    }
  }
  el('printBtn').addEventListener('click',()=>window.print());
  init().catch(err=>{el('notFound').hidden=false;el('notFound').textContent=err.message;});
})();
