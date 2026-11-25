/* ==========================================================================
   MAP STATE & INITIALIZATION
   ========================================================================== */
const MAX_MERCATOR_LAT = 85.05112877980659;
let map = null;
let baseLayers = {};
let neutralLandLayer = null;
let currentBasemap = null;
let bordersLayer = null;
let graticulesLayer = null;
let rasterOverlay = null;
let primaryPointsGroup = null;
let referenceStationsGroup = null;
let cachedReferenceStations = null;

let mpaLayer = null;
let cachedMpaGeoJson = null;

let activeRecords = [];
let gridLookup = {};
let activePlotMode = 'histogram';
let activeConfig = {
  unit: 'Species Richness',
  minVal: 0,
  maxVal: 100,
  colorScale: 'viridis',
  isDiscrete: false,
  isPoints: false,
  distinctValues: []
};

function initMap() {
  map = L.map('map', {
    center: [15, 0],
    zoom: 2,
    minZoom: 2,
    maxZoom: 10,
    worldCopyJump: true
  });

  // Solid grey land polygons placed in tilePane so data layers render cleanly on top
  neutralLandLayer = L.geoJSON(null, {
    pane: 'tilePane',
    style: {
      fillColor: '#d1d5db',
      fillOpacity: 1,
      color: '#cbd5e1',
      weight: 0.5
    },
    interactive: false
  });

  baseLayers = {
    bathymetry: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 10,
      attribution: 'Esri, GEBCO, NOAA'
    }),
    neutral: neutralLandLayer,
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 10,
      attribution: 'Tiles &copy; Esri'
    })
  };

  currentBasemap = baseLayers.bathymetry.addTo(map);

  // Graticule Layer (30-degree Lat/Lon lines)
  graticulesLayer = buildGraticuleLayer().addTo(map);

  // Country Outlines GeoJSON Layer
  bordersLayer = L.geoJSON(null, {
    style: {
      color: '#334155',
      weight: 0.9,
      opacity: 0.65,
      fillOpacity: 0
    },
    interactive: false
  }).addTo(map);

  // Fetch country polygons once and populate both neutral basemap and border outlines
  fetch(OVERLAY_SOURCES.countryBordersGeoJson)
    .then(res => res.json())
    .then(data => {
      neutralLandLayer.addData(data);
      bordersLayer.addData(data);
      updateBorderStyleForBasemap(document.getElementById('basemap-select').value);
    })
    .catch(() => {});

  primaryPointsGroup = L.layerGroup().addTo(map);
  referenceStationsGroup = L.layerGroup().addTo(map);

  // Live Cursor & Grid Cell Inspector
  map.on('mousemove', (e) => {
    const lat = e.latlng.lat;
    let lon = ((e.latlng.lng + 180) % 360 + 360) % 360 - 180;
    const inspector = document.getElementById('cursor-inspector');

    const key = `${Math.round(lat)}_${Math.round(lon)}`;
    const cellVal = gridLookup[key];

    if (cellVal !== undefined && !activeConfig.isPoints) {
      const formatted = activeConfig.isDiscrete
        ? Math.round(cellVal)
        : (cellVal >= 10 ? cellVal.toFixed(1) : cellVal.toFixed(3));
      inspector.innerHTML = `Lat: <span class="highlight">${lat.toFixed(2)}&deg;</span> | Lon: <span class="highlight">${lon.toFixed(2)}&deg;</span> &bull; ${activeConfig.unit}: <span class="highlight">${formatted}</span>`;
    } else {
      inspector.innerHTML = `Lat: <span class="highlight">${lat.toFixed(2)}&deg;</span> | Lon: <span class="highlight">${lon.toFixed(2)}&deg;</span>`;
    }
  });
}

function buildGraticuleLayer() {
  const lines = [];
  for (let lat = -60; lat <= 60; lat += 30) {
    lines.push(L.polyline([[lat, -180], [lat, 180]], {
      color: '#94a3b8',
      weight: lat === 0 ? 1.0 : 0.6,
      opacity: lat === 0 ? 0.55 : 0.35,
      dashArray: lat === 0 ? null : '4, 4',
      interactive: false
    }));
  }
  for (let lon = -180; lon <= 180; lon += 30) {
    lines.push(L.polyline([[-85, lon], [85, lon]], {
      color: '#94a3b8',
      weight: lon === 0 ? 1.0 : 0.6,
      opacity: lon === 0 ? 0.55 : 0.35,
      dashArray: lon === 0 ? null : '4, 4',
      interactive: false
    }));
  }
  return L.layerGroup(lines);
}

function updateBorderStyleForBasemap(basemapKey) {
  const mapEl = document.getElementById('map');
  if (mapEl) {
    mapEl.style.backgroundColor = basemapKey === 'neutral' ? '#ffffff' : '#0b192c';
  }

  if (!bordersLayer) return;
  const isSatellite = basemapKey === 'satellite';
  bordersLayer.setStyle({
    color: isSatellite ? '#e2e8f0' : (basemapKey === 'neutral' ? '#64748b' : '#334155'),
    weight: 0.9,
    opacity: isSatellite ? 0.55 : 0.7,
    fillOpacity: 0
  });
}

/* ==========================================================================
   MERCATOR CANVAS RENDERING FOR GRIDDED MODEL DATA
   ========================================================================== */
function latToMercatorNorm(lat) {
  const clamped = Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat));
  const rad = (clamped * Math.PI) / 180;
  const mercY = Math.log(Math.tan(Math.PI / 4 + rad / 2));
  return (1 - mercY / Math.PI) / 2;
}

function renderGriddedOverlay(records, cfg) {
  if (rasterOverlay) {
    map.removeLayer(rasterOverlay);
    rasterOverlay = null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 2160;
  canvas.height = 1440;
  const ctx = canvas.getContext('2d');

  records.forEach(d => {
    if (d.val === undefined || d.val === null || isNaN(d.val)) return;
    if (cfg.isDiscrete && d.val <= 0) return;

    const x1 = ((d.lon - 0.5 + 180) / 360) * canvas.width;
    const x2 = ((d.lon + 0.5 + 180) / 360) * canvas.width;
    const y1 = latToMercatorNorm(d.lat + 0.5) * canvas.height;
    const y2 = latToMercatorNorm(d.lat - 0.5) * canvas.height;

    ctx.fillStyle = getColorForValue(d.val, cfg);
    ctx.fillRect(x1, y1, (x2 - x1) + 0.6, (y2 - y1) + 0.6);
  });

  const opacity = parseInt(document.getElementById('opacity-slider').value, 10) / 100;
  const bounds = [[-MAX_MERCATOR_LAT, -180], [MAX_MERCATOR_LAT, 180]];

  rasterOverlay = L.imageOverlay(canvas.toDataURL('image/png'), bounds, {
    opacity: opacity,
    interactive: false
  }).addTo(map);

  if (bordersLayer && map.hasLayer(bordersLayer)) bordersLayer.bringToFront();
  if (primaryPointsGroup) primaryPointsGroup.bringToFront();
  if (referenceStationsGroup) referenceStationsGroup.bringToFront();
  if (mpaLayer && map.hasLayer(mpaLayer)) mpaLayer.bringToFront();
}

/* ==========================================================================
   POINT MARKERS RENDERING FOR SAMPLING STATIONS
   ========================================================================== */
function renderStationMarkers(records, cfg) {
  primaryPointsGroup.clearLayers();
  const opacity = parseInt(document.getElementById('opacity-slider').value, 10) / 100;

  records.forEach(d => {
    const color = getColorForValue(d.val, cfg);
    const marker = L.circleMarker([d.lat, d.lon], {
      radius: 5.5,
      fillColor: color,
      color: '#0f172a',
      weight: 0.9,
      opacity: 0.95,
      fillOpacity: opacity
    });

    marker.bindPopup(`
      <div style="font-family: Inter, sans-serif; font-size: 12.5px; line-height: 1.5;">
        <strong style="color: #0071e3;">Sampling Station</strong><br>
        <strong>Coordinates:</strong> ${d.lat.toFixed(2)}&deg;, ${d.lon.toFixed(2)}&deg;<br>
        <strong>${cfg.unit}:</strong> ${d.val.toFixed(1)}
      </div>
    `);

    primaryPointsGroup.addLayer(marker);
  });
}

function toggleReferenceStationsOverlay(show) {
  referenceStationsGroup.clearLayers();
  if (!show || activeConfig.isPoints) return;

  const drawStations = (rows) => {
    rows.forEach(pt => {
      const dot = L.circleMarker([pt.lat, pt.lon], {
        radius: 3.5,
        fillColor: '#ffffff',
        color: '#0f172a',
        weight: 1.1,
        opacity: 0.9,
        fillOpacity: 0.85
      });
      dot.bindPopup(`
        <div style="font-family: Inter, sans-serif; font-size: 12px; line-height: 1.4;">
          <strong>Metagenomic Station (Paper 2)</strong><br>
          Lat: ${pt.lat.toFixed(2)}&deg;, Lon: ${pt.lon.toFixed(2)}&deg;<br>
          Prokaryotic Richness: ${pt.val.toFixed(1)}
        </div>
      `);
      referenceStationsGroup.addLayer(dot);
    });
  };

  if (cachedReferenceStations) {
    drawStations(cachedReferenceStations);
    return;
  }

  Papa.parse(OVERLAY_SOURCES.referenceStations, {
    download: true,
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: (results) => {
      cachedReferenceStations = parseLatLonValRows(results.data);
      drawStations(cachedReferenceStations);
    }
  });
}

/* ==========================================================================
   MARINE PROTECTED AREAS (WDPA) POLYGON OVERLAY
   ========================================================================== */
function getMpaStyle(feature) {
  const p = feature.properties || {};
  const mode = document.getElementById('mpa-color-mode')?.value || 'iucn';

  if (mode === 'notake') {
    const nt = String(p.NO_TAKE || '').trim();
    if (nt === 'All') {
      return { color: '#e11d48', weight: 1.4, opacity: 0.95, fillColor: '#e11d48', fillOpacity: 0.34 };
    }
    if (nt === 'Part') {
      return { color: '#ea580c', weight: 1.2, opacity: 0.9, fillColor: '#ea580c', fillOpacity: 0.26 };
    }
    if (nt === 'None') {
      return { color: '#0d9488', weight: 1.1, opacity: 0.85, fillColor: '#0d9488', fillOpacity: 0.20 };
    }
    return { color: '#64748b', weight: 0.9, opacity: 0.75, fillColor: '#94a3b8', fillOpacity: 0.14 };
  }

  const cat = String(p.IUCN_CAT || '').trim();
  if (cat === 'Ia' || cat === 'Ib' || cat === 'II') {
    return { color: '#0284c7', weight: 1.3, opacity: 0.95, fillColor: '#0284c7', fillOpacity: 0.30 };
  }
  if (cat === 'III' || cat === 'IV') {
    return { color: '#0d9488', weight: 1.2, opacity: 0.9, fillColor: '#0d9488', fillOpacity: 0.24 };
  }
  if (cat === 'V' || cat === 'VI') {
    return { color: '#d97706', weight: 1.1, opacity: 0.88, fillColor: '#f59e0b', fillOpacity: 0.22 };
  }
  return { color: '#64748b', weight: 0.9, opacity: 0.75, fillColor: '#94a3b8', fillOpacity: 0.14 };
}

function updateMpaLegend() {
  const mode = document.getElementById('mpa-color-mode')?.value || 'iucn';
  const titleEl = document.getElementById('mpa-legend-title');
  const itemsEl = document.getElementById('mpa-legend-items');
  if (!titleEl || !itemsEl) return;

  const swatchRow = (border, bg, label) => `
    <div class="mpa-legend-row">
      <span class="mpa-swatch" style="border-color:${border}; background:${bg};"></span>
      <span>${label}</span>
    </div>`;

  if (mode === 'notake') {
    titleEl.textContent = 'MPAs — No-Take Status';
    itemsEl.innerHTML =
      swatchRow('#e11d48', 'rgba(225, 29, 72, 0.34)', 'Full No-Take (All, n = 751)') +
      swatchRow('#ea580c', 'rgba(234, 88, 12, 0.26)', 'Partial No-Take (Part, n = 460)') +
      swatchRow('#0d9488', 'rgba(13, 148, 136, 0.20)', 'Take Allowed (None, n = 996)') +
      swatchRow('#64748b', 'rgba(148, 163, 184, 0.14)', 'Not Reported (n = 14,919)');
  } else {
    titleEl.textContent = 'MPAs — IUCN Category';
    itemsEl.innerHTML =
      swatchRow('#0284c7', 'rgba(2, 132, 199, 0.30)', 'Strict Protection (Ia–II, n = 2,699)') +
      swatchRow('#0d9488', 'rgba(13, 148, 136, 0.24)', 'Habitat / Species Mgmt (III–IV, n = 4,730)') +
      swatchRow('#d97706', 'rgba(245, 158, 11, 0.22)', 'Sustainable Use (V–VI, n = 2,680)') +
      swatchRow('#64748b', 'rgba(148, 163, 184, 0.14)', 'Not Reported / Assigned (n = 7,017)');
  }
}

function toggleMpaOverlay(show) {
  const legendSection = document.getElementById('mpa-legend-section');
  const styleGroup = document.getElementById('mpa-style-group');
  const labelEl = document.getElementById('mpa-checkbox-label');

  if (!show) {
    if (mpaLayer && map.hasLayer(mpaLayer)) map.removeLayer(mpaLayer);
    if (legendSection) legendSection.classList.remove('visible');
    if (styleGroup) styleGroup.style.display = 'none';
    return;
  }

  if (styleGroup) styleGroup.style.display = 'flex';

  const renderMpaGeoJson = (geojson) => {
    if (mpaLayer) map.removeLayer(mpaLayer);

    mpaLayer = L.geoJSON(geojson, {
      renderer: L.canvas({ padding: 0.5 }),
      filter: (feature) => {
        const geomType = feature?.geometry?.type;
        return geomType === 'Polygon' || geomType === 'MultiPolygon';
      },
      style: getMpaStyle,
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};
        const name = p.NAME || 'Unnamed MPA';
        const desig = p.DESIG || 'Marine Protected Area';
        const iucn = p.IUCN_CAT || 'Not Reported';
        const noTake = p.NO_TAKE || 'Not Reported';
        const year = p.STATUS_YR && p.STATUS_YR > 0 ? p.STATUS_YR : 'N/A';
        const iso = p.ISO3 || 'N/A';
        const area = typeof p.AREA_KM2 === 'number'
          ? `${p.AREA_KM2.toLocaleString(undefined, { maximumFractionDigits: 1 })} km²`
          : 'N/A';

        layer.bindPopup(`
          <div style="font-family: Inter, sans-serif; font-size: 12.5px; line-height: 1.5; max-width: 260px;">
            <strong style="color: #0071e3; font-size: 13px;">${name}</strong><br>
            <span style="color: #636366;">${desig} (${iso})</span>
            <hr style="border: none; border-top: 1px solid #e5e5ea; margin: 6px 0;">
            <strong>IUCN Category:</strong> ${iucn}<br>
            <strong>No-Take Status:</strong> ${noTake}<br>
            <strong>Designated Year:</strong> ${year}<br>
            <strong>Area:</strong> ${area}
          </div>
        `);
      }
    }).addTo(map);

    if (primaryPointsGroup) primaryPointsGroup.bringToFront();
    if (referenceStationsGroup) referenceStationsGroup.bringToFront();
    updateMpaLegend();
    if (legendSection) legendSection.classList.add('visible');
  };

  if (cachedMpaGeoJson) {
    renderMpaGeoJson(cachedMpaGeoJson);
    return;
  }

  if (labelEl) labelEl.textContent = 'Loading 17,126 MPAs (WDPA)...';

  fetch(OVERLAY_SOURCES.wdpaMpaGeoJson)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      cachedMpaGeoJson = data;
      if (labelEl) labelEl.textContent = 'Overlay Marine Protected Areas (WDPA)';
      if (document.getElementById('chk-mpa-overlay').checked) {
        renderMpaGeoJson(cachedMpaGeoJson);
      }
    })
    .catch(err => {
      console.error('Failed to load MPA GeoJSON:', err);
      if (labelEl) labelEl.textContent = 'Overlay Marine Protected Areas (Load Failed)';
      document.getElementById('chk-mpa-overlay').checked = false;
      if (styleGroup) styleGroup.style.display = 'none';
    });
}