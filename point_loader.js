/* GeoTochka 0.51: lazy loading of adaptive geographic blocks.
   At the overview/cluster scales only overview.json is requested.
   A detail tile is requested at zoom >= 12, or by an explicit point lookup. */
(() => {
  'use strict';
  const promises=new Map(), loaded=new Map(), MAX_CACHED_TILES=48;
  const version=()=>encodeURIComponent(window.GEOTOCHKA_SITE_CONFIG?.data_version||'');
  function jsonFile(path){
    if(!promises.has(path)){
      const p=fetch(path+(path.includes('?')?'&':'?')+'v='+version()).then(r=>{if(!r.ok)throw Error(`HTTP ${r.status}: ${path}`);return r.json();}).catch(e=>{promises.delete(path);throw e});
      promises.set(path,p);
    }
    return promises.get(path);
  }
  const overview=()=>jsonFile('overview.json');
  const tileIndex=()=>jsonFile('tiles-index.json');
  async function tile(file){
    if(!/^[a-z0-9_+\-]+\.json$/.test(String(file)))throw Error('Неправильное имя блока');
    if(loaded.has(file)){
      const val=loaded.get(file);loaded.delete(file);loaded.set(file,val);return val;
    }
    const result=await jsonFile('tiles/'+encodeURIComponent(file));
    loaded.set(file,result);
    while(loaded.size>MAX_CACHED_TILES){
      const old=loaded.keys().next().value;
      loaded.delete(old);promises.delete('tiles/'+old);
    }
    return result;
  }
  let searchPromise;
  function searchIndex(){
    if(!searchPromise){
      searchPromise=jsonFile('search-index.json').then(obj=>{
        obj.byId=new Map();obj.byCode=new Map();
        for(const row of obj.rows||[]){
          obj.byId.set(String(row[0]),row);
          if(row[1]){
            const key=String(row[1]).toUpperCase();
            if(!obj.byCode.has(key))obj.byCode.set(key,[]);
            obj.byCode.get(key).push(row);
          }
          row._text=[row[1],row[2],row[3],row[4],row[9],row[10]].filter(Boolean).join(' ').toLowerCase();
        }
        return obj;
      }).catch(e=>{searchPromise=null;throw e});
    }
    return searchPromise;
  }
  async function byRow(row){
    if(!row)return null;
    const json=await tile(row[7]);
    return (json.features||[]).find(f=>String(f.properties?.id)===String(row[0]))||null;
  }
  async function getById(id){const index=await searchIndex();return byRow(index.byId.get(String(id)));}
  async function getByCode(code,region=''){
    const index=await searchIndex(),candidates=index.byCode.get(String(code).toUpperCase())||[];
    const scoped=region?candidates.filter(row=>row[4]===region):candidates;
    // An old code-only link must not select an arbitrary duplicate.
    return scoped.length===1?byRow(scoped[0]):null;
  }
  const pointMatchesVisibility=(row, v, region)=>{
    if(region && row[4]!==region)return false;
    if(v){const flag=Number(row[8])||0;
      if(!v.coord && !(flag&1))return false;
      if(!v.height && !(flag&2))return false;
      if(!v.visits && !(flag&4))return false;
    }
    return true;
  };
  function clearCache(){for(const name of loaded.keys())promises.delete('tiles/'+name);loaded.clear();}
  window.GeotochkaPointLoader={overview,tileIndex,tile,searchIndex,getById,getByCode,byRow,pointMatchesVisibility,clearCache};
})();
