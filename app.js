(() => {
  'use strict';
  function normalizeOmsCategory(v){
    const x=String(v||'').trim();
    return ['омс','омз','огс','пункт омс','пункт омз','пункт огс','oms','omz','ogs'].includes(x.toLowerCase())?'Пункт ОМС':x;
  }
  const $=id=>document.getElementById(id);
  const loader=window.GeotochkaPointLoader;
  const siteConfig=window.GEOTOCHKA_SITE_CONFIG||{};
  let overview=null;
  let renderTicket=0;
  let searchRows=null;
  let current=null;
  const markers=new Map();
  function renderProjectMessage(){
    if(siteConfig.project_name) document.title=`${siteConfig.project_name} — Геоточка`;
    const pn=$("publicProjectName");
    if(pn){
      const version=String(siteConfig.app_version||'—').replace(/^v/i,'');
      const updated=/^\d{4}-\d{2}-\d{2}$/.test(siteConfig.last_data_update||'') ? siteConfig.last_data_update : '—';
      pn.textContent=`v${version} · upd ${updated}`;
      pn.title=`${siteConfig.project_name||'Геоточка'}\nПоследнее изменение данных: ${updated}`;
    }
    const bar=$("projectMessageBar"), box=$("projectMessageText");
    if(!bar||!box||siteConfig.message_enabled===false||!String(siteConfig.message||"").trim()){ if(bar) bar.hidden=true; return; }
    const text=String(siteConfig.message||"");
    const re=/(https?:\/\/[^\s]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/ig;
    let last=0; box.innerHTML="";
    for(const m of text.matchAll(re)){
      if(m.index>last) box.appendChild(document.createTextNode(text.slice(last,m.index)));
      const token=m[0], a=document.createElement("a");
      a.textContent=token; a.href=token.includes("@")&&!/^https?:/i.test(token)?`mailto:${token}`:token;
      if(/^https?:/i.test(token)){a.target="_blank";a.rel="noopener";}
      box.appendChild(a); last=m.index+token.length;
    }
    if(last<text.length) box.appendChild(document.createTextNode(text.slice(last)));
    bar.hidden=false;
  }
  renderProjectMessage();
  function setupWelcomeDialog(){
    const dlg=$('welcomeDialog');
    const html=String(siteConfig.welcome_html||'').trim();
    if(!dlg||siteConfig.welcome_enabled!==true||!html)return;
    const content=$('welcomeDialogContent');
    content.innerHTML=html; // Server sanitizes with the same allowlist as the About page.
    const dismiss=()=>dlg.close();
    $('welcomeDismiss').addEventListener('click',dismiss);
    $('welcomeDismissX').addEventListener('click',dismiss);
    dlg.addEventListener('click',event=>{if(event.target===dlg)dismiss();});
    try{dlg.showModal();$('welcomeDismiss').focus();}catch(_){ /* Site remains usable if dialogs unavailable. */ }
  }
  setupWelcomeDialog();
  function setupHelpDialog(){
    const dlg=$('helpDialog'), button=$('openHelpBtn');
    if(!dlg || !button) return;
    const body=$('helpDialogContent');
    const help=String(siteConfig.help_html||'').trim();
    // Published HTML is sanitized by the same server allow-list as About/Welcome.
    if(help) body.innerHTML=help;
    else body.textContent='Раздел справки пока не заполнен.';
    const dismiss=()=>dlg.close();
    $('helpDismiss').addEventListener('click',dismiss);
    $('helpDismissX').addEventListener('click',dismiss);
    dlg.addEventListener('click',e=>{if(e.target===dlg)dismiss();});
    button.addEventListener('click',()=>{try{dlg.showModal();}catch(_){dlg.setAttribute('open','');}});
  }
  setupHelpDialog();

  const VIS_DEFAULT = () => ({showPoints:true,coord:true,height:true,visits:true,types:null});
  let visState = VIS_DEFAULT();
  let visTypes = [];
  function visHas(v) { return v!==null && v!==undefined && String(v).trim()!==''; }
  function visNumeric(v) { return visHas(v) && Number.isFinite(Number(v)); }
  function visAccept(p) {
    const coords = Array.isArray(p.coordinates) ? p.coordinates : [];
    if (!visState.coord && !coords.some(c=>visNumeric(c.x_coord)&&visNumeric(c.y_coord))) return false;
    if (!visState.height && !visNumeric(p.height) && !coords.some(c=>visNumeric(c.height))) return false;
    if (!visState.visits && !(Array.isArray(p.visits) && p.visits.length) && !p.gb_summary?.event_count && !p.gb_summary?.photo_count) return false;
    if (visState.types !== null && !visState.types.includes(normalizeOmsCategory(p.category||'Тип не определён'))) return false;
    return true;
  }
  function visStoreKey() { return 'geotochka.visibility.public.'+location.pathname; }
  function visRemember() { try { localStorage.setItem(visStoreKey(),JSON.stringify(visState)); } catch (_) {} }
  function visLoad() {
    visState=VIS_DEFAULT();
    try {
      const raw=JSON.parse(localStorage.getItem(visStoreKey())||'null');
      if(raw && typeof raw==='object'){
        for(const k of ['showPoints','coord','height','visits']) if(typeof raw[k]==='boolean')visState[k]=raw[k];
        if(Array.isArray(raw.types))visState.types=[...new Set(raw.types.filter(v=>typeof v==='string').map(normalizeOmsCategory))];
      }
    } catch (_) {}
    if(siteConfig.publish_coordinates===false)visState.coord=true;
  }
  function visSetup() {
    visTypes=[...new Set((overview?.types||[]).map(normalizeOmsCategory))].sort((a,b)=>a.localeCompare(b,'ru')); 
    const panel=$('publicVisibilityPanel');
    if(siteConfig.publish_coordinates===false){const checkbox=panel.querySelector('[data-vis-flag=coord]');if(checkbox){checkbox.disabled=true;checkbox.closest('label').hidden=true;}}
    const types=panel.querySelector('[data-vis-types]'); types.replaceChildren();
    for(const t of visTypes){
      const label=document.createElement('label');
      const ck=document.createElement('input');ck.type='checkbox';ck.dataset.visType=t;
      ck.addEventListener('change',()=>{visState.types=[...types.querySelectorAll('input:checked')].map(x=>x.dataset.visType);visUpdated();});
      label.append(ck,document.createTextNode(' '+t));types.append(label);
    }
    $('publicShowPoints').addEventListener('change',e=>{visState.showPoints=e.target.checked;visUpdated();});
    panel.querySelectorAll('[data-vis-flag]').forEach(ck=>ck.addEventListener('change',()=>{visState[ck.dataset.visFlag]=ck.checked;visUpdated();}));
    panel.querySelector('[data-vis-action="all"]').addEventListener('click',()=>{visState.types=null;visUpdated();});
    panel.querySelector('[data-vis-action="none"]').addEventListener('click',()=>{visState.types=[];visUpdated();});
    panel.querySelector('[data-vis-action="reset"]').addEventListener('click',()=>{visState=VIS_DEFAULT();visUpdated();});
    visSync();
  }
  function visSync() {
    const panel=$('publicVisibilityPanel');if(!panel)return;
    $('publicShowPoints').checked=visState.showPoints;
    panel.querySelectorAll('[data-vis-flag]').forEach(ck=>ck.checked=visState[ck.dataset.visFlag]);
    const enabled=visState.types===null?visTypes:visState.types;
    panel.querySelectorAll('[data-vis-type]').forEach(ck=>ck.checked=enabled.includes(ck.dataset.visType));
    panel.querySelector('[data-vis-count]').textContent=enabled.filter(v=>visTypes.includes(v)).length+' из '+visTypes.length;
    $('publicVisibilityBtn').classList.toggle('visibility-active',!visState.showPoints||!visState.coord||!visState.height||!visState.visits||visState.types!==null);
  }
  function visUpdated() {visSync();visRemember();render();searchResults();}

  $('publicVisibilityBtn').addEventListener('click',()=>{
    const panel=$('publicVisibilityPanel');panel.hidden=!panel.hidden;
    $('publicVisibilityBtn').setAttribute('aria-expanded',String(!panel.hidden));
  });
  document.addEventListener('click',e=>{
    if(!e.target.closest('#publicVisibilityShell')){
      $('publicVisibilityPanel').hidden=true;$('publicVisibilityBtn').setAttribute('aria-expanded','false');
    }
  });


  const map=L.map('map',{preferCanvas:true,zoomControl:false}).setView([56.87,35.93],5);
  const bases = {
    "OpenStreetMap": L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom:19, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}),
    "OpenTopoMap": L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {maxZoom:17, attribution:'Картоданные &copy; OpenStreetMap contributors, SRTM | Карта &copy; OpenTopoMap'}),
    "OSM Humanitarian": L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {maxZoom:20, attribution:'&copy; OpenStreetMap contributors, HOT'}),
    "Спутник (Esri)": L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {maxZoom:19, attribution:'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, GIS User Community'})
  };
  bases.OpenStreetMap.addTo(map);L.control.layers(bases,null,{collapsed:true}).addTo(map);
  const layer=L.layerGroup().addTo(map);
  const targetLayer=L.layerGroup().addTo(map);
  // A browser-only, never-published layer for the visitor’s own KML geometries.
  window.GeotochkaKmlImport.mount(map);
  function pointUrl(f){
    const p=f.properties||{},u=new URL(location.href);
    u.searchParams.delete('id');u.searchParams.delete('point');
    u.searchParams.delete('lat');u.searchParams.delete('lon');
    // Link by the internal ID: names and survey point numbers may repeat across regions.
    if(p.id!==null&&p.id!==undefined&&String(p.id)!=='')u.searchParams.set('id',String(p.id));
    if(p.point_code)u.searchParams.set('point',String(p.point_code));
    return u.href;
  }
  function writePointUrl(f){if(!history.replaceState)return;const u=new URL(pointUrl(f));history.replaceState(null,'',u.pathname+u.search+u.hash);}
  function showCoordinates(lat,lon,updateUrl=true){
    targetLayer.clearLayers();
    L.circleMarker([lat,lon],{radius:8,color:'#cc4027',weight:3,fillColor:'#fff',fillOpacity:.9}).addTo(targetLayer)
      .bindPopup(`Координаты WGS84: ${lat.toFixed(7)}, ${lon.toFixed(7)}`).openPopup();
    map.setView([lat,lon],Math.max(map.getZoom(),15));
    if(updateUrl){const u=new URL(location.href);for(const k of ['point','id'])u.searchParams.delete(k);
      u.searchParams.set('lat',lat.toFixed(7));u.searchParams.set('lon',lon.toFixed(7));history.replaceState(null,'',u.pathname+u.search+u.hash)}
  }
  function parseCoordinates(q){
    const raw=String(q||'').trim();
    let nums=raw.split(/\s+/).filter(Boolean);
    // Both "45.567 34.774" and "45,567 34,774"; also "45.567, 34.774".
    if(nums.length!==2)nums=raw.split(/[,;]/).map(x=>x.trim()).filter(Boolean);
    if(nums.length===2)nums=nums.map(x=>x.replace(/^[;,]|[;,]$/g,'').replace(',','.'));
    if(nums.length!==2||nums.some(n=>!/^[+-]?\d+(?:\.\d+)?$/.test(n)))return null;
    const lat=Number(nums[0]),lon=Number(nums[1]);
    return Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180?[lat,lon]:null;
  }
  function regionValue(p){return [p.region_code,p.region].filter(x=>x!==null&&x!==undefined&&x!=='').join(' — ');}
  function matchesOverviewGroup(r){
    const region=$('regionFilter').value;
    return (!region||r[3]===region)&&(visState.types===null||visState.types.includes(r[4]))&&
      (visState.coord||!!r[5])&&(visState.height||!!r[6])&&(visState.visits||!!r[7]);
  }
  function bboxPoint(bounds,lat,lon){
    if(lat<bounds.getSouth()||lat>bounds.getNorth())return false;
    const west=bounds.getWest(),east=bounds.getEast();
    const x=lon+360*Math.round((west+east-2*lon)/720);
    return x>=west&&x<=east;
  }
  function filteredTotal(){
    return (overview?.clouds||[]).reduce((sum,r)=>sum+(matchesOverviewGroup(r)?r[2]:0),0);
  }
  function drawOverview(){
    layer.clearLayers();markers.clear();
    if(!overview)return;
    const zoom=map.getZoom(),rows=zoom<=7?overview.clouds:overview.circles,
          bounds=map.getBounds().pad(.16),groups=new Map(),cellSize=zoom<=7?52:48;
    let total=0;
    for(const r of rows){
      if(!matchesOverviewGroup(r))continue;
      total+=r[2];
      if(!bboxPoint(bounds,r[0],r[1]))continue;
      const pt=map.project([r[0],r[1]],zoom),key=Math.floor(pt.x/cellSize)+':'+Math.floor(pt.y/cellSize);
      const cur=groups.get(key)||[0,0,0];cur[0]+=r[2];cur[1]+=r[0]*r[2];cur[2]+=r[1]*r[2];groups.set(key,cur);
    }
    $('pointCount').textContent=total.toLocaleString('ru-RU');
    for(const [_,v] of groups){
      const n=v[0],lat=v[1]/n,lon=v[2]/n;
      if(zoom<=7){
        const radius=Math.min(35,Math.max(8,7+Math.sqrt(n)*1.5));
        L.circleMarker([lat,lon],{radius,color:'#276ad7',weight:1,opacity:.24,fillColor:'#276ad7',fillOpacity:Math.min(.52,.12+Math.log2(n+1)*.06)})
          .addTo(layer).bindTooltip(n.toLocaleString('ru-RU')+' пунктов')
          .on('click',()=>map.setView([lat,lon],Math.min(9,zoom+4)));
      }else{
        const radius=Math.min(44,Math.max(27,26+Math.log2(n)*3));
        const icon=L.divIcon({className:'geo-cluster-icon',html:'<span>'+(n>999?'999+':n)+'</span>',iconSize:[radius,radius],iconAnchor:[radius/2,radius/2]});
        L.marker([lat,lon],{icon,keyboard:false}).addTo(layer)
          .bindTooltip(n.toLocaleString('ru-RU')+' пунктов · приблизить')
          .on('click',()=>map.setView([lat,lon],Math.min(12,Math.max(zoom+2,12))));
      }
    }
  }
  function tileVisible(t,b){
    if(t[3]<b.getSouth()||t[1]>b.getNorth())return false;
    for(const shift of [-360,0,360])if(t[0]+shift<=b.getEast()&&t[2]+shift>=b.getWest())return true;
    return false;
  }
  async function drawDetails(ticket){
    const idx=await loader.tileIndex();if(ticket!==renderTicket||!visState.showPoints||map.getZoom()<12)return;
    const b=map.getBounds().pad(.12),todo=idx.tiles.filter(t=>tileVisible(t,b));
    // Only detailed tiles intersecting the current viewport are requested.
    // Request in small batches, avoiding hundreds of simultaneous HTTP calls.
    let all=[];
    let failed=0;
    // One inaccessible tile must not blank an entire viewport. Render the
    // surviving blocks and report problems instead of silently hiding points.
    for(let i=0;i<todo.length;i+=8){
      const batch=await Promise.allSettled(todo.slice(i,i+8).map(t=>loader.tile(t[4])));
      if(ticket!==renderTicket||!visState.showPoints||map.getZoom()<12)return;
      batch.forEach((r,j)=>{
        if(r.status==='fulfilled')all.push(...(r.value.features||[]));
        else{failed++;console.warn('Не загружен геоблок',todo[i+j][4],r.reason);}
      });
    }
    if(failed){
      const message=`Не загружено блоков карты: ${failed} из ${todo.length}. Проверьте публикацию сайта.`;
      console.warn(message);
      const count=$('pointCount');if(count)count.title=message;
    }else{
      const count=$('pointCount');if(count)count.removeAttribute('title');
    }
    const region=$('regionFilter').value;
    // Keep the existing overview/markers visible if every requested detail tile failed.
    // The user can still navigate and retry rather than being left with an empty map.
    if(todo.length && failed === todo.length){
      console.warn('Все геоблоки текущей области недоступны; сохраняем прежние маркеры.');
      return;
    }
    const features=all.filter(f=>{
      const p=f.properties||{};
      return (!region||regionValue(p)===region)&&visAccept(p);
    });
    const newMarkers=window.GeoTochkaDensity.draw(map,layer,features.map(f=>{
      const [lon,lat]=f.geometry.coordinates;
      return {id:String(f.properties?.id||''),lat:Number(lat),lon:Number(lon),f};
    }),{icon:r=>pointIcon(r.f.properties?.category,r.f.properties?.condition,false),
       tooltip:r=>esc(r.f.properties?.name||'Без названия'),click:(r,m)=>show(r.f,m)});
    markers.clear();for(const [id,m] of newMarkers)markers.set(id,m);
    // The count in the header is the total currently matching the filters.
    // It is not a count of files already downloaded.
    $('pointCount').textContent=filteredTotal().toLocaleString('ru-RU');
  }
  function render(){
    const ticket=++renderTicket;
    if(!overview)return;
    if(!visState.showPoints){
      // The map remains fully navigable. Do not request the index or detailed tiles.
      layer.clearLayers();markers.clear();
      $('pointCount').textContent=filteredTotal().toLocaleString('ru-RU');
      return;
    }
    if(map.getZoom()<12){drawOverview();return;}
    // Keep previous symbols until detail tiles have loaded. Density.draw replaces them
    // atomically at the end of drawDetails, avoiding a blank map on slow HTTP/404.
    drawDetails(ticket).catch(e=>{if(ticket===renderTicket)console.warn('Не удалось загрузить блок карты',e)});
  }
  let zoomTimer;
  function onView(){clearTimeout(zoomTimer);zoomTimer=setTimeout(render,85)}
  map.on('zoomend',onView);map.on('moveend',onView);
  function color(cond){ const c=String(cond||"").trim().toLowerCase(); if(c==="действующий")return"#23894a";if(c==="утрачен"||c==="повреждён")return"#c83e3e";if(["подозрительный","не найден","возможно утрачен","конфликт статусов"].includes(c))return"#ee922e";return"#276ad7"; }
  function pointIcon(category, condition, selected=false){
    const c=color(condition), halo=selected?"#111827":"#ffffff", sw=selected?4.5:4; let body="";
    switch(normalizeOmsCategory(category)){
      case "Пункт ГГС": body=`<polygon points="14,3 25,24 3,24" fill="${c}" stroke="${halo}" stroke-width="${sw}" stroke-linejoin="round"/><polygon points="14,3 25,24 3,24" fill="${c}" stroke="${c}" stroke-width="1.2"/>`; break;
      case "Пункт полигонометрии": body=`<rect x="4" y="4" width="20" height="20" rx="1" fill="${c}" stroke="${halo}" stroke-width="${sw}"/><rect x="4" y="4" width="20" height="20" rx="1" fill="${c}" stroke="${c}" stroke-width="1.2"/>`; break;
      case "Пункт ОМС": body=`<circle cx="14" cy="14" r="10" fill="${c}" stroke="${halo}" stroke-width="${sw}"/><circle cx="14" cy="14" r="10" fill="${c}" stroke="${c}" stroke-width="1.2"/>`; break;
      case "Временный репер": body=`<circle cx="14" cy="14" r="10" fill="#fff" stroke="${halo}" stroke-width="${sw}"/><path d="M14 14 L14 4 A10 10 0 0 1 24 14 Z" fill="${c}"/><path d="M14 14 L14 24 A10 10 0 0 1 4 14 Z" fill="${c}"/><circle cx="14" cy="14" r="10" fill="none" stroke="${c}" stroke-width="1.8"/><path d="M14 4V24M4 14H24" stroke="${c}" stroke-width="1.25"/>`; break;
      default: body=`<circle cx="14" cy="14" r="8" fill="#fff" stroke="${halo}" stroke-width="${sw}"/><circle cx="14" cy="14" r="8" fill="#fff" stroke="${c}" stroke-width="2.2"/><path d="M14 1V27M1 14H27" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/><circle cx="14" cy="14" r="2.3" fill="${c}"/>`;
    }
    return L.divIcon({className:"geo-point-icon",html:`<svg viewBox="0 0 28 28" width="14" height="14" aria-hidden="true">${body}</svg>`,iconSize:[14,14],iconAnchor:[7,7],tooltipAnchor:[0,-8]});
  }
  function esc(s){return String(s??"").replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));}
  // Load imported history only for the currently open point.
  const histEsc=esc;
  let historyToken=0;
  function ratingBlock(votes,recent){
    const groups=[['center','Состояние центра'],['sign','Наружный знак']];
    let out='';for(const [key,title] of groups){const vals=votes?.[key]||{};
      const total=Object.values(vals).reduce((a,b)=>a+Number(b||0),0);
      if(!total)continue;
      out+=`<div class="rating-block"><h3>${histEsc(title)} · ${total}</h3>`+
        Object.entries(vals).filter(([,n])=>Number(n)>0).map(([name,n])=>`<div class="rating-line"><span class="rating-name">${histEsc(name)}</span><span class="rating-bar"><span class="rating-fill" style="display:block;width:${total?100*n/total:0}%"></span></span><b class="rating-number">${Number(n)||0}</b></div>`).join('')+`</div>`;
    }
    return out;
  }
  function safePhoto(url){try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='storage.yandexcloud.net'?u.href:null}catch{return null}}
  async function renderPublicHistory(p){
    const token=++historyToken;
    const timeline=$('publicVisitTimeline'), status=$('publicHistoryStatus'), box=$('publicVisitPhotos');
    $('publicRatings').innerHTML=ratingBlock(p.gb_summary?.votes,p.gb_summary?.recent_ratings);
    box.replaceChildren();box.hidden=true;
    const needsHistory=Boolean(p.gb_summary?.event_count||p.gb_summary?.photo_count);
    const visits=(p.visits||[]).map(v=>({date:v.visit_date||'',text:v.description||'',tag:'Посещение',author:v.visitor||v.observer||''}));
    let entries=[],shown=5,pending=needsHistory,failed=false;
    function draw(){
      timeline.replaceChildren();
      for(const entry of entries.slice(0,shown)){const card=document.createElement('div');card.className='history-card';const day=document.createElement('div');day.className='history-date';day.textContent=entry.date||'Без даты';const kind=document.createElement('span');kind.className='history-kind';kind.textContent=entry.tag;day.append(' · ',kind);const text=document.createElement('div');text.className='history-entry-text';text.innerHTML=window.GeotochkaLinks.html(entry.text||'—',p.links);card.append(day,text);if(entry.author){const author=document.createElement('small');author.className='history-author';author.textContent=entry.author;card.append(author)}timeline.append(card)}
      if(!entries.length&&!pending&&!failed){const empty=document.createElement('p');empty.textContent='Записей пока нет.';timeline.append(empty)}
      if(entries.length>shown){const btn=document.createElement('button');btn.className='history-load';btn.textContent='Показать ещё';btn.onclick=()=>{shown+=10;draw()};timeline.append(btn)}
      status.textContent=pending?'Загрузка дополнительных записей…':failed?'Не удалось загрузить дополнительные записи.':'';
      status.hidden=!status.textContent;
    }
    function update(hist){
      entries=[
        ...visits,
        ...(hist.comments||[]).map(v=>({date:v.date||'',text:v.text||'',tag:'Комментарий'})),
        ...(hist.ratings||[]).map(v=>({date:v.date||'',text:v.label||'',tag:v.object==='sign'?'Оценка знака':'Оценка центра'}))
      ].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
      draw();
      renderPhotos(hist);
    }
    function renderPhotos(hist){
      const localPhotos=[...(p.images||[])].sort((a,b)=>(Number(b.is_primary)-Number(a.is_primary))||String(b.date_taken||'').localeCompare(String(a.date_taken||'')));
      const photoLinks=[...localPhotos,...(hist.photos||[])].map(x=>x.url).filter(Boolean);
      box.replaceChildren();
      box.hidden=!photoLinks.length;
      if(!photoLinks.length)return;
      const h=document.createElement('h3');h.textContent='Фотографии ('+photoLinks.length+')';box.append(h);
      const grid=document.createElement('div');grid.className='history-photo-grid';box.append(grid);let photoShown=5;
      function drawPhotos(){grid.replaceChildren();for(const u of photoLinks.slice(0,photoShown)){const safe=safePhoto(u)||(/^images\/[0-9]+\/[a-zA-Z0-9_.-]+$/.test(u)?u:null);if(!safe)continue;const a=document.createElement('a');a.href=safe;a.rel='noopener noreferrer';a.target='_blank';const img=document.createElement('img');img.src=safe;img.loading='lazy';img.alt='Фото пункта';a.append(img);grid.append(a)}if(box.querySelector('.history-load'))box.querySelector('.history-load').remove();if(photoLinks.length>photoShown){const b=document.createElement('button');b.className='history-load';b.textContent='Показать ещё фото';b.onclick=()=>{photoShown+=10;drawPhotos()};box.append(b)}}drawPhotos();
    }
    update({});
    if(!needsHistory)return;
    let hist={};
    try{
      const bucket=String(Number(p.id)%256).padStart(3,'0');
      const res=await fetch('history/h_'+bucket+'.json?v='+encodeURIComponent(siteConfig.data_version||''));
      if(!res.ok)throw new Error('History unavailable');
      hist=(await res.json())[String(p.id)]||{};
    }catch(_){failed=true;}
    if(token!==historyToken)return;
    pending=false;
    update(hist);
  }
  function show(f,m,updateUrl=true){current=f; if(updateUrl)writePointUrl(f);const p=f.properties||{};const [lon,lat]=f.geometry.coordinates;$("panelEmpty").hidden=true;$("panelContent").hidden=false;$("infoPanel").classList.add("open");$("pointCategory").textContent=normalizeOmsCategory(p.category)||"Геодезический пункт";$("pointName").textContent=p.name||"Без названия";$("pointCode").textContent=p.point_code||"";const pill=$("conditionPill");pill.textContent=p.condition||"Состояние не указано";pill.style.color=color(p.condition);pill.style.background=color(p.condition)+"15";
    const rows=[
      ["Регион",[p.region_code,p.region].filter(Boolean).join(" — ")],["Район",p.district],["Положение WGS84",`${lat.toFixed(7)}, ${lon.toFixed(7)}`],["Описание",p.description]
    ];const box=$("detailsTable");box.innerHTML="";rows.filter(x=>x[1]!==null&&x[1]!==undefined&&x[1]!=="").forEach(([l,v])=>{const r=document.createElement("div");r.className="row";r.innerHTML=`<div class="label">${esc(l)}</div><div class="value ${l.includes("WGS84")?"coords":""}">${(l==="Описание")?window.GeotochkaLinks.html(v,p.links):esc(v)}</div>`;box.appendChild(r);});
    const coords=(p.coordinates||[]).filter(c=>[c.crs,c.x_coord,c.y_coord,c.height].some(v=>v!==null&&v!==undefined&&String(v)!==""));
    if(siteConfig.publish_coordinates!==false&&coords.length){
      const block=document.createElement("div");block.className="public-coords";
      block.innerHTML=`<div class="public-coords-title">Координаты</div><div class="public-coords-scroll"><table><thead><tr><th>СК</th><th>X</th><th>Y</th><th>H, м</th></tr></thead><tbody>${coords.map(c=>`<tr><td>${esc(c.crs||"")}</td><td>${esc(c.x_coord||"")}</td><td>${esc(c.y_coord||"")}</td><td>${esc(c.height??"")}</td></tr>`).join("")}</tbody></table></div>`;
      box.appendChild(block);
    }
    const mats=document.createElement("div");mats.className="public-materials";mats.innerHTML=window.GeotochkaLinks.listMarkup(p.links);if(mats.innerHTML)box.appendChild(mats);
    $('infoPanel').scrollTop=0;
    renderPublicHistory(p);
    const card=$("pointCardBtn"); if(card){card.onclick=()=>window.open(`point_card.html?id=${encodeURIComponent(p.id)}`,"_blank","noopener");}
    const addInfo=$("addInfoBtn"); if(addInfo) addInfo.onclick=()=>window.open(`visit.html?id=${encodeURIComponent(p.id)}`,"_blank","noopener");
    const reportBtn=$("reportErrorBtn"); if(reportBtn) reportBtn.onclick=()=>window.open(`report.html?id=${encodeURIComponent(p.id)}`,"_blank","noopener");
    const share=$('copyPointLinkBtn');
    if(share){share.onclick=async()=>{
      const url=pointUrl(f);
      try{
        if(!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
        await navigator.clipboard.writeText(url);
        share.textContent='Ссылка скопирована!';
        window.setTimeout(()=>{share.textContent='Копировать ссылку на пункт';},1800);
      }catch(_){window.prompt('Скопируйте ссылку на пункт:',url);}
    };}
    const kml=$("exportKmlBtn"); if(kml){kml.onclick=()=>window.GeotochkaPointTools?.downloadKml(f);}
    if(m)m.openTooltip();}

  let searchTicket=0;
  async function searchResults(){
    const ticket=++searchTicket,q=$('searchInput').value.trim(),box=$('searchResults');
    box.replaceChildren();
    if(!q){box.hidden=true;return;}
    const coords=parseCoordinates(q);if(coords){
      box.hidden=false;
      const el=document.createElement('div');el.className='search-item';el.textContent='⌖ Перейти к координатам '+coords.join(', ');
      el.onclick=()=>{box.hidden=true;showCoordinates(...coords)};box.append(el);return;
    }
    if(q.length<2){box.hidden=true;return;}
    box.hidden=false;box.textContent='Поиск пунктов…';
    try{
      const obj=await loader.searchIndex();if(ticket!==searchTicket)return;
      const needle=q.toLowerCase(),region=$('regionFilter').value;
      const results=[];
      for(const row of obj.rows){
        if(!row._text.includes(needle)||!loader.pointMatchesVisibility(row,visState,region))continue;
        results.push(row);if(results.length>=25)break;
      }
      box.replaceChildren();
      for(const row of results){
        const el=document.createElement('div');el.className='search-item';
        const main=document.createElement('div'),strong=document.createElement('strong'),small=document.createElement('small'),code=document.createElement('span');
        strong.textContent=row[2]||'Без названия';small.textContent=[row[3],row[4]].filter(Boolean).join(' · ');
        code.className='search-code';code.textContent=row[1];main.append(strong,small);el.append(main,code);
        el.onclick=async()=>{
          box.hidden=true;targetLayer.clearLayers();map.setView([row[5],row[6]],Math.max(map.getZoom(),15));
          try{const f=await loader.byRow(row);if(f)show(f,null);else console.warn('Пункт отсутствует в блоке:',row[7],row[0]);}
          catch(e){console.warn('Не удалось открыть карточку пункта',row[0],e);alert('Карта перемещена к пункту, но подробный блок недоступен. Проверьте публикацию сайта.');}
        };
        box.append(el);
      }
      if(!results.length){const x=document.createElement('div');x.className='search-empty';x.textContent='В каталоге не найдено. Нажмите Enter для поиска адреса.';box.append(x)}
    }catch(e){if(ticket===searchTicket){box.textContent='Поисковый индекс временно недоступен';console.warn(e)}}
  }
  let lastGeocodeRequest=0;
  function selectedRegionName(){
    const value=$('regionFilter').value;
    return value?value.replace(/^\s*\d+\s*[—-]\s*/, '').trim():'';
  }
  function regionalGeocodeUrl(endpoint,q){
    const selected=$('regionFilter').value,region=selectedRegionName();
    const query=region?(q+', '+region+', Россия'):q;
    const url=new URL(endpoint,location.href);
    url.searchParams.set('format','jsonv2');url.searchParams.set('limit','5');
    url.searchParams.set('q',query);
    if(region){
      url.searchParams.set('countrycodes','ru');
      const b=overview?.region_bounds?.[selected];
      if(Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)){
        // Nominatim's viewbox uses lon_W,lat_N,lon_E,lat_S.
        // Bounds are a point-catalogue envelope, NOT a legal regional polygon.
        const [south,west,north,east]=b;
        const pad=.12;
        url.searchParams.set('viewbox',[Math.max(-180,west-pad),Math.min(90,north+pad),Math.min(180,east+pad),Math.max(-90,south-pad)].join(','));
        url.searchParams.set('bounded','1');
      }
    }
    return url.toString();
  }
  async function geocodeAddress(q){
    const box=$('searchResults');box.hidden=false;box.textContent='Поиск адреса…';
    try{
      // Cache is scoped to region, so switching regions cannot reuse unrelated results.
      const cacheKey='geotochka.geocode.v2.'+$('regionFilter').value+'|'+q.trim().toLowerCase();
      let places=null;
      try{const cached=JSON.parse(localStorage.getItem(cacheKey)||'null');
        if(cached&&Date.now()-cached.timestamp<30*24*3600*1000&&Array.isArray(cached.results))places=cached.results;
      }catch(_){}
      if(!places){
        const delay=Math.max(0,1150-(Date.now()-lastGeocodeRequest));
        if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
        lastGeocodeRequest=Date.now();
        const endpoint=siteConfig.address_search_url||'https://nominatim.openstreetmap.org/search';
        const url=regionalGeocodeUrl(endpoint,q);
        const res=await fetch(url,{headers:{'Accept':'application/json'}});
        if(!res.ok)throw Error('HTTP '+res.status);
        places=await res.json();
        try{localStorage.setItem(cacheKey,JSON.stringify({timestamp:Date.now(),results:places}));}catch(_){}
      }
      box.replaceChildren();
      if(!places.length){box.textContent=$('regionFilter').value?'Адрес не найден в выбранном регионе':'Адрес не найден';return;}
      for(const place of places){
        const el=document.createElement('div');el.className='search-item';el.textContent=place.display_name;
        el.onclick=()=>{box.hidden=true;targetLayer.clearLayers();showCoordinates(Number(place.lat),Number(place.lon));};box.append(el);
      }
      const credit=document.createElement('div');credit.className='search-empty';
      const link=document.createElement('a');link.href='https://www.openstreetmap.org/copyright';link.target='_blank';link.rel='noopener';
      link.textContent='Адресный поиск: © OpenStreetMap, Nominatim';credit.append(link);box.append(credit);
    }catch(e){box.textContent='Адресный поиск недоступен. Проверьте интернет.';console.warn(e)}
  }
  async function submitSearch(){
    const q=$('searchInput').value.trim();if(!q)return;
    const coords=parseCoordinates(q);if(coords){$('searchResults').hidden=true;showCoordinates(...coords);return;}
    // A selected region is a hard filter for catalog entries, including Enter.
    try{
      const obj=await loader.searchIndex(),needle=q.toLowerCase(),region=$('regionFilter').value;
      const candidates=obj.rows.filter(r=>loader.pointMatchesVisibility(r,visState,region));
      const exact=candidates.filter(r=>r[1].toLowerCase()===needle||r[2].toLowerCase()===needle);
      if(exact.length===1){
        const row=exact[0];
        map.setView([row[5],row[6]],15);$('searchResults').hidden=true;
        try{const f=await loader.byRow(row);if(f)show(f,null);else console.warn('Пункт отсутствует в блоке',row[7]);}
        catch(e){console.warn('Ошибка загрузки карточки',e);alert('Карта перемещена к пункту, но подробный блок недоступен.');}
        return;
      }
      // For duplicate names or partial matches, show the choices. Never open a
      // random entry or silently fall through to a global address lookup.
      if(exact.length>1 || candidates.some(r=>r._text.includes(needle))){
        await searchResults();return;
      }
    }catch(e){console.warn(e)}
    await geocodeAddress(q);
  }
  let searchTimer;
  $('searchInput').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(searchResults,180)});
  $('searchInput').addEventListener('focus',searchResults);
  $('searchInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submitSearch()}});
  $('clearSearch').onclick=()=>{$('searchInput').value='';$('searchResults').hidden=true;};
  $('regionFilter').onchange=()=>{
    const region=$('regionFilter').value;
    if(region&&overview?.region_bounds?.[region]){
      const [s,w,n,e]=overview.region_bounds[region];
      map.fitBounds([[s,w],[n,e]],{padding:[25,25],maxZoom:11});
    }
    render();searchResults();
  };
  $('closePanel').onclick=()=>{$('infoPanel').classList.remove('open');current=null;++historyToken;const u=new URL(location.href);u.searchParams.delete('point');u.searchParams.delete('id');history.replaceState(null,'',u.pathname+u.search+u.hash)};
  $('copyCoords').onclick=async()=>{
    if(!current)return;const [lon,lat]=current.geometry.coordinates,t=`${lat.toFixed(7)}, ${lon.toFixed(7)}`;
    try{await navigator.clipboard.writeText(t);$('copyCoords').textContent='Скопировано';setTimeout(()=>$('copyCoords').textContent='Копировать WGS84',1000)}
    catch(_){prompt('Скопируйте координаты:',t)};
  };
  document.addEventListener('click',e=>{if(!e.target.closest('.search-wrap'))$('searchResults').hidden=true});
  async function restorePointFromUrl(){
    const p=new URLSearchParams(location.search);
    const code=p.get('point'),id=p.get('id'),lat=p.get('lat'),lon=p.get('lon');
    if(code||id){
      const f=id?await loader.getById(id):await loader.getByCode(code,$('regionFilter').value);
      if(!f){if(code&&!id){$('searchInput').value=code;await searchResults();}return false;}
      const [x,y]=f.geometry.coordinates;map.setView([y,x],16,{animate:false});show(f,null,false);return true;
    }
    const coords=parseCoordinates(lat!==null&&lon!==null?lat+' '+lon:'');
    const hashCoords=parseCoordinates(decodeURIComponent(location.hash.replace(/^#/,'')));
    const qCoords=parseCoordinates(p.get('q')||'');
    if(coords||hashCoords||qCoords){showCoordinates(...(coords||hashCoords||qCoords),false);return true;}
    return false;
  }
  async function boot(){
    try{
      overview=await loader.overview();
      const regions=overview.regions||[];
      for(const region of regions){const o=document.createElement('option');o.value=region;o.textContent=region;$('regionFilter').appendChild(o)}
      visLoad();visSetup();
      const url=new URLSearchParams(location.search);
      const hasLink=url.has('point')||url.has('id')||url.has('lat')||location.hash||url.has('q');
      if(!hasLink&&overview.total){
        const [s,w,n,e]=overview.bounds;map.fitBounds([[s,w],[n,e]],{padding:[25,25],maxZoom:7});
        // Start with aggregated clouds, never individual point details.
        if(map.getZoom()>7)map.setZoom(7);
      }
      render();
      if(hasLink)await restorePointFromUrl();
    }catch(e){console.error(e);$('pointCount').textContent='Ошибка загрузки карты';}
  }
  window.addEventListener('popstate',()=>{restorePointFromUrl().then(ok=>{if(!ok){$('infoPanel').classList.remove('open');current=null}}).catch(console.warn)});
  boot();
})();
