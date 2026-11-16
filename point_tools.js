(() => {
  function xmlEscape(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
    }[ch]));
  }

  function safeFilename(value) {
    const s = String(value || "point")
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, " ")
      .slice(0, 120);
    return s || "point";
  }

  function addData(rows, name, displayName, value) {
    if (value === null || value === undefined || String(value).trim() === "") return;
    rows.push(
      `<Data name="${xmlEscape(name)}"><displayName>${xmlEscape(displayName)}</displayName><value>${xmlEscape(value)}</value></Data>`
    );
  }

  function buildKml(feature) {
    const p = feature?.properties || {};
    const geometry = feature?.geometry || {};
    const coords = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    const altitude = Number.isFinite(Number(p.height)) ? Number(p.height) : 0;
    const ext = [];

    addData(ext, "ID", "ID", p.id);
    addData(ext, "POINT_CODE", "Номер / код пункта", p.point_code);
    addData(ext, "NAME", "Название", p.name);
    addData(ext, "POINT_TYPE", "Тип пункта", p.category);
    addData(ext, "NETWORK", "Сеть", p.network);
    addData(ext, "REGION_CODE", "Код региона", p.region_code);
    addData(ext, "REGION", "Регион", p.region);
    addData(ext, "DISTRICT", "Район", p.district);
    if (Number.isFinite(lat)) addData(ext, "WGS84_LAT", "Широта WGS84", lat.toFixed(8));
    if (Number.isFinite(lon)) addData(ext, "WGS84_LON", "Долгота WGS84", lon.toFixed(8));
    addData(ext, "HEIGHT", "Высота", p.height);
    addData(ext, "CONDITION", "Состояние", p.condition);
    addData(ext, "SURVEY_DATE", "Дата обследования", p.survey_date);
    addData(ext, "DESCRIPTION", "Описание / подход", p.description);
    addData(ext, "PUBLISH_STATUS", "Статус публикации", p.publish_status);

    const photos = Array.isArray(p.images) ? p.images : [];
    addData(ext, "PHOTO_COUNT", "Количество опубликованных изображений", photos.length);
    photos.forEach((ph, idx) => {
      const n = idx + 1;
      addData(ext, `PHOTO_${n}_DATE`, `Фото ${n}: дата`, ph.date_taken);
      addData(ext, `PHOTO_${n}_TYPE`, `Фото ${n}: тип`, ph.image_type);
      addData(ext, `PHOTO_${n}_CAPTION`, `Фото ${n}: подпись`, ph.caption);
      addData(ext, `PHOTO_${n}_FILE`, `Фото ${n}: файл`, ph.url);
    });

    const systems = Array.isArray(p.coordinates) ? p.coordinates : [];
    systems.forEach((c, idx) => {
      const n = idx + 1;
      addData(ext, `CRS_${n}`, `СК ${n}`, c.crs);
      addData(ext, `X_${n}`, `X ${n}`, c.x_coord);
      addData(ext, `Y_${n}`, `Y ${n}`, c.y_coord);
      addData(ext, `H_${n}`, `H ${n}`, c.height);
    });

    const name = p.name || p.point_code || "Геодезический пункт";
    const descrParts = [
      p.point_code ? `Номер: ${p.point_code}` : "",
      p.category ? `Тип: ${p.category}` : "",
      p.condition ? `Состояние: ${p.condition}` : "",
      p.description || ""
    ].filter(Boolean);

    const coordText = (Number.isFinite(lon) && Number.isFinite(lat))
      ? `${lon.toFixed(8)},${lat.toFixed(8)},${altitude}`
      : "0,0,0";

    return `<?xml version="1.0" encoding="UTF-8"?>\n` +
`<kml xmlns="http://www.opengis.net/kml/2.2">\n` +
`  <Document>\n` +
`    <name>${xmlEscape(name)}</name>\n` +
`    <Placemark>\n` +
`      <name>${xmlEscape(name)}</name>\n` +
`      <description>${xmlEscape(descrParts.join("\n"))}</description>\n` +
`      <ExtendedData>\n        ${ext.join("\n        ")}\n      </ExtendedData>\n` +
`      <Point><coordinates>${coordText}</coordinates></Point>\n` +
`    </Placemark>\n` +
`  </Document>\n` +
`</kml>\n`;
  }

  function downloadKml(feature) {
    if (!feature) return;
    const p = feature.properties || {};
    const kml = buildKml(feature);
    const blob = new Blob([kml], {type: "application/vnd.google-earth.kml+xml;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const base = [p.point_code, p.name].filter(Boolean).join("_") || "geotochka_point";
    a.href = url;
    a.download = safeFilename(base) + ".kml";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function findFeatureById(id) {
    const data = window.GEOTOCHKA_POINTS || {features: []};
    return (data.features || []).find(f => String(f?.properties?.id) === String(id)) || null;
  }

  window.GeotochkaPointTools = { buildKml, downloadKml, findFeatureById, safeFilename };
})();
