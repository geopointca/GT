/* GeoTochka v0.59 — public link references. Only http(s) URLs appear in anchors. */
window.GeotochkaLinks = (() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function valid(raw) {
    try {const u=new URL(raw);return ['https:','http:'].includes(u.protocol)&&!!u.hostname&&!u.username&&!u.password?u.href:null;}catch {return null;}
  }
  function html(value, links){
    const index=new Map((links||[]).map(l=>[Number(l.number),l]));
    const str=String(value??'');let out='',at=0;
    for(const found of str.matchAll(/\[(\d{1,8})\]/g)){
      out+=esc(str.slice(at,found.index));const n=Number(found[1]);const l=index.get(n);const url=l&&valid(l.url);
      if(url)out+=`<a class="material-ref" href="${esc(url)}" title="${esc(l.title||'Материал '+n)}" target="_blank" rel="noopener noreferrer">[${n}]</a>`;
      else out+=esc(found[0]);at=found.index+found[0].length;
    }
    return out+esc(str.slice(at));
  }
  function listMarkup(links){
    const rows=(links||[]).filter(l=>valid(l.url));
    if(!rows.length)return '';
    return `<div class="material-list-title">Материалы и ссылки <span>${rows.length}</span></div><div class="material-list-rows">${rows.map(l=>`<div class="material-list-row"><span class="material-number">[${Number(l.number)}]</span><div><a href="${esc(valid(l.url))}" target="_blank" rel="noopener noreferrer">${esc(l.title||'Материал '+l.number)}</a><div class="material-address" title="${esc(l.url)}">${esc(l.url)}</div></div></div>`).join('')}</div>`;
  }
  return {esc,valid,html,listMarkup};
})();
