/* Геоточка v0.57 — import of a local KML into an ephemeral client-side Leaflet layer.
   No upload, persistence, network request, or modification of published geodetic points. */
(() => {
  'use strict';
  const MAX_BYTES = 12 * 1024 * 1024;
  const MAX_VERTICES = 200000;
  const MAX_GEOMETRIES = 10000;
  const GEOMETRIES = new Set(['Point', 'LineString', 'Polygon', 'MultiGeometry']);
  const ownChildren = (node, name) => Array.from(node?.children || []).filter(el => el.localName === name);
  const firstChild = (node, name) => ownChildren(node, name)[0] || null;

  function readCoordinates(node, state) {
    if (!node) return [];
    const result = [];
    for (const tuple of (node.textContent || '').trim().split(/\s+/)) {
      if (!tuple) continue;
      const parts = tuple.split(',');
      if (parts.length < 2 || parts.some((part, i) => i < 2 && !part.trim())) continue;
      const lon = Number(parts[0]), lat = Number(parts[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
      if (++state.vertices > MAX_VERTICES) throw new Error('Слишком много вершин в KML (лимит 200 000).');
      result.push([lat, lon]); // KML is longitude,latitude[,alt]; Leaflet is latitude,longitude.
    }
    return result;
  }

  function makeFeature(kind, coords, name, state) {
    if (++state.geometries > MAX_GEOMETRIES) throw new Error('Слишком много объектов в KML (лимит 10 000).');
    return { kind, coords, name };
  }

  function polygonRing(node, state) {
    return readCoordinates(firstChild(firstChild(node, 'LinearRing'), 'coordinates'), state);
  }

  function parseGeometry(node, name, state, output) {
    switch (node.localName) {
      case 'MultiGeometry':
        for (const child of Array.from(node.children)) if (GEOMETRIES.has(child.localName)) parseGeometry(child, name, state, output);
        break;
      case 'Point': {
        const points = readCoordinates(firstChild(node, 'coordinates'), state);
        if (points.length) output.push(makeFeature('Point', points[0], name, state));
        break;
      }
      case 'LineString': {
        const points = readCoordinates(firstChild(node, 'coordinates'), state);
        if (points.length >= 2) output.push(makeFeature('LineString', points, name, state));
        break;
      }
      case 'Polygon': {
        const outer = firstChild(node, 'outerBoundaryIs');
        const ring = polygonRing(outer, state);
        if (ring.length < 3) break;
        const holes = ownChildren(node, 'innerBoundaryIs').map(h => polygonRing(h, state)).filter(h => h.length >= 3);
        output.push(makeFeature('Polygon', [ring, ...holes], name, state));
        break;
      }
    }
  }

  function parse(text) {
    if (/<!DOCTYPE\b/i.test(text)) throw new Error('KML с декларацией DOCTYPE не поддерживается.');
    const doc = new DOMParser().parseFromString(String(text), 'application/xml');
    if (Array.from(doc.getElementsByTagName('*')).some(n => n.localName === 'parsererror') ||
        doc.documentElement?.localName !== 'kml') throw new Error('Неверный формат KML или ошибка XML.');
    const state = { vertices: 0, geometries: 0 };
    const features = [];
    const placemarks = Array.from(doc.getElementsByTagName('*')).filter(el => el.localName === 'Placemark');
    for (const placemark of placemarks) {
      // Do not read HTML descriptions, external resources, NetworkLink or embedded styles.
      const name = (firstChild(placemark, 'name')?.textContent || '').trim().slice(0, 160);
      for (const geom of Array.from(placemark.children)) {
        if (GEOMETRIES.has(geom.localName)) parseGeometry(geom, name, state, features);
      }
    }
    if (!features.length) throw new Error('В файле нет подходящих точек, линий или полигонов KML.');
    return features;
  }

  async function readKmlText(file) {
    const bytes = await file.arrayBuffer();
    const prefix = new TextDecoder('windows-1252').decode(bytes.slice(0, 256));
    const headerEncoding = prefix.match(/<\?xml[^>]*encoding\s*=\s*["']([^"']+)["']/i)?.[1];
    const view = new Uint8Array(bytes);
    const encoding = view[0] === 0xff && view[1] === 0xfe ? 'utf-16le'
      : view[0] === 0xfe && view[1] === 0xff ? 'utf-16be'
      : headerEncoding || 'utf-8';
    try { return new TextDecoder(encoding, {fatal: true}).decode(bytes); }
    catch (_) { throw new Error('Не удалось прочитать кодировку KML (' + encoding + ').'); }
  }

  function popupText(name, kind) {
    const box = document.createElement('div');
    const heading = document.createElement('strong');
    heading.textContent = name || 'Загруженный объект';
    const meta = document.createElement('div');
    meta.style.cssText = 'margin-top:4px;color:#777;font-size:11px';
    meta.textContent = { Point:'Точка KML', LineString:'Линия KML', Polygon:'Полигон KML' }[kind];
    box.append(heading, meta);
    return box;
  }

  function mount(map) {
    const $ = id => document.getElementById(id);
    const browse = $('importKmlBtn'), input = $('importKmlFile');
    const status = $('temporaryKmlStatus'), note = $('temporaryKmlText');
    const zoom = $('temporaryKmlZoom'), clear = $('temporaryKmlClear');
    if (!browse || !input || !status || !note || !zoom || !clear) return null;

    // Independent panes keep KML outlines above base shapes and imported red points readable.
    map.createPane('temporaryKmlShapes').style.zIndex = 445;
    map.createPane('temporaryKmlPoints').style.zIndex = 625;
    const layer = L.featureGroup().addTo(map);
    let hasLayer = false, token = 0;

    function setStatus(message, error = false) {
      note.textContent = message;
      status.hidden = !message;
      status.classList.toggle('is-error', error);
      zoom.hidden = !hasLayer;
      clear.hidden = !hasLayer;
    }
    function showBounds() {
      if (!hasLayer) return;
      const bounds = layer.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, {padding: [44,44], maxZoom: 16});
    }
    function makeLayer(feature) {
      let shape;
      if (feature.kind === 'Point') {
        shape = L.circleMarker(feature.coords, {
          pane: 'temporaryKmlPoints',radius: 7,color:'#fff',weight:2,
          fillColor:'#d9362e',fillOpacity:1,interactive:true
        });
      } else if (feature.kind === 'LineString') {
        shape = L.polyline(feature.coords, {
          pane:'temporaryKmlShapes',color:'#de2828',weight:3,opacity:.95,interactive:true
        });
      } else {
        shape = L.polygon(feature.coords, {
          pane:'temporaryKmlShapes',color:'#de2828',weight:3,opacity:1,
          fillColor:'#ed4747',fillOpacity:.15,interactive:true
        });
      }
      if (feature.name) shape.bindPopup(popupText(feature.name, feature.kind));
      return shape;
    }
    browse.addEventListener('click', () => input.click());
    zoom.addEventListener('click', showBounds);
    clear.addEventListener('click', () => {
      token++;layer.clearLayers();hasLayer=false;setStatus('');input.value='';
    });
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      // Reset the input so the same file may be selected again, including after an error.
      input.value = '';
      if (!file) return;
      const currentToken = ++token;
      if (!/\.kml$/i.test(file.name)) {setStatus('Выберите файл с расширением .kml (не KMZ).', true);return;}
      if (file.size > MAX_BYTES) {setStatus('Размер файла KML не должен превышать 12 МБ.', true);return;}
      setStatus('Чтение KML…');
      try {
        const text = await readKmlText(file);
        if (currentToken !== token) return;
        const features = parse(text);
        // Build all layers before clearing the previous import. An invalid file leaves it intact.
        const newShapes = features.map(makeLayer);
        if (currentToken !== token) return;
        layer.clearLayers();
        newShapes.forEach(s => layer.addLayer(s));
        hasLayer=true;
        const counts={Point:0,LineString:0,Polygon:0};
        for (const f of features) counts[f.kind]++;
        setStatus('KML: '+file.name+' · '+[
          counts.Point && 'точек: '+counts.Point, counts.LineString && 'линий: '+counts.LineString,
          counts.Polygon && 'полигонов: '+counts.Polygon
        ].filter(Boolean).join(', '));
        showBounds();
      } catch (e) {
        if (currentToken === token) setStatus('Ошибка импорта: '+(e?.message||'не удалось прочитать файл'), true);
      }
    });
    return {layer, clear: () => clear.click(), zoom: showBounds};
  }
  window.GeotochkaKmlImport = { parse, mount };
})();
