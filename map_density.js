/* GeoTochka 0.26 — spatial index + viewport-culling + screen clustering.
   O(visible points) on pan/zoom after one O(n) index creation.
   Does not change IDs, records, DB or publication format. */
(function(){
  'use strict';
  const CACHE=new WeakMap();
  function build(records){
    let idx=CACHE.get(records);if(idx)return idx;
    const buckets=new Map();let valid=0;
    for(const r of records){
      const lat=Number(r.lat),lon=Number(r.lon);
      if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)continue;
      const y=Math.floor(lat),x=Math.floor(lon),key=x+','+y;
      let b=buckets.get(key);if(!b){b=[];buckets.set(key,b)} b.push(r);valid++;
    }
    idx={buckets,valid}; CACHE.set(records,idx);return idx;
  }
  function visible(map,idx){
    // Padding keeps symbols/clusters from disappearing abruptly at edges.
    const b=map.getBounds().pad(0.18);
    const south=Math.max(-90,Math.floor(b.getSouth())),north=Math.min(89,Math.floor(b.getNorth()));
    let west=Math.floor(b.getWest()),east=Math.floor(b.getEast());
    if(east-west>=360){west=-180;east=179}
    const out=[];
    for(let x=west;x<=east;x++){
      const nx=((x+180)%360+360)%360-180;
      for(let y=south;y<=north;y++){
        const bin=idx.buckets.get(nx+','+y);if(!bin)continue;
        for(const r of bin){const lat=Number(r.lat),lon=Number(r.lon);
          const adjusted=lon+360*Math.round(((west+east)/2-lon)/360);
          if(lat>=b.getSouth()&&lat<=b.getNorth()&&adjusted>=b.getWest()&&adjusted<=b.getEast())out.push(r);
        }
      }
    }
    return out;
  }
  function draw(map,layer,records,opts={}){
    layer.clearLayers();
    const markers=new Map(),z=map.getZoom(),dense=z<=7,shown=visible(map,build(records));
    if(z>=12){
      for(const r of shown){
        const m=L.marker([Number(r.lat),Number(r.lon)],{icon:opts.icon(r),keyboard:false}).addTo(layer);
        m.bindTooltip(opts.tooltip?.(r)||'',opts.showLabels
          ?{permanent:true,direction:'right',offset:[9,0],className:'geo-name-label'}
          :{direction:'top',offset:[0,-4]});
        m.on('click',()=>opts.click?.(r,m));markers.set(String(r.id),m);
      }
      return markers;
    }
    const size=dense?46:58,grid=new Map();
    for(const r of shown){
      const lat=Number(r.lat),lon=Number(r.lon),xy=map.project([lat,lon],z);
      const key=Math.floor(xy.x/size)+':'+Math.floor(xy.y/size);
      let g=grid.get(key);if(!g){g={n:0,lat:0,lon:0,first:r};grid.set(key,g)}
      g.n++;g.lat+=lat;g.lon+=lon;
    }
    for(const g of grid.values()){
      const n=g.n,lat=g.lat/n,lon=g.lon/n;
      if(dense){
        const radius=Math.min(34,Math.max(8,6+Math.sqrt(n)*3));
        const c=L.circleMarker([lat,lon],{radius,color:'#276ad7',weight:1,opacity:.26,fillColor:'#276ad7',fillOpacity:Math.min(.5,.10+Math.log2(n+1)*.065),interactive:true}).addTo(layer);
        c.bindTooltip(n+' пунктов в зоне',{direction:'top'});
        c.on('click',()=>map.flyTo([lat,lon],Math.min(9,map.getMaxZoom()),{duration:.35}));
      }else if(n===1){
        const r=g.first,m=L.marker([Number(r.lat),Number(r.lon)],{icon:opts.icon(r),keyboard:false}).addTo(layer);
        m.bindTooltip(opts.tooltip?.(r)||'',{direction:'top',offset:[0,-4]});m.on('click',()=>opts.click?.(r,m));markers.set(String(r.id),m);
      }else{
        const d=Math.min(44,Math.max(28,26+Math.log2(n)*3));
        const icon=L.divIcon({className:'geo-cluster-icon',html:'<span>'+(n>999?'999+':n)+'</span>',iconSize:[d,d],iconAnchor:[d/2,d/2]});
        const m=L.marker([lat,lon],{icon,keyboard:false}).addTo(layer);
        m.bindTooltip(n+' пунктов · нажмите для приближения',{direction:'top'});
        m.on('click',()=>map.flyTo([lat,lon],Math.min(12,map.getMaxZoom()),{duration:.35}));
      }
    }
    return markers;
  }
  window.GeoTochkaDensity={draw,build};
})();
