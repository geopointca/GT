(() => {
  window.GeotochkaRequestPoint=(p,config=window.GEOTOCHKA_SITE_CONFIG||{})=>{
    const code=String(p.point_code||'').trim().toUpperCase();
    if(/^[A-Z]{2}-[0-9BCDEFGHJKMNPQRSTUVWXYZ]{5}-[0-9]{2}-[A-Z]+$/.test(code))
      return {point_code:code};
    const id=Number(p.id),catalog=String(config.catalog_id||'');
    if(Number.isSafeInteger(id)&&id>0&&catalog.trim()&&catalog.length<=128)
      return {point_code:'',catalog_point_id:id,catalog_id:catalog};
    return null;
  };
})();
