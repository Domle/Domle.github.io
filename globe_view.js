/* ==========================================================================
   globe_view.js
   3D Globe Engine for 1x1 Degree SDMs
   Canvas Texture Rasterizer with Dynamic Auto-Scaling & Trimmed Header Ingestion
   ========================================================================== */

let globeInstance = null;
let rawSdmData = [];
let currentConfig = {
  unit: 'Species Richness',
  minVal: 0,
  maxVal: 15
};

// Base texture CDN URLs
const DARK_BASE_TEXTURE = 'https://unpkg.com/three-globe/example/img/earth-dark.jpg';
const SATELLITE_TEXTURE = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg';

let currentLayerState = {
  satellite: false,
  borders: true,
  graticules: true
};

// Pre-load base textures for offscreen canvas compositing
const baseImageDark = new Image();
baseImageDark.crossOrigin = 'anonymous';
baseImageDark.src = DARK_BASE_TEXTURE;
baseImageDark.onload = () => updateGlobeSurfaceTexture();

const baseImageSat = new Image();
baseImageSat.crossOrigin = 'anonymous';
baseImageSat.src = SATELLITE_TEXTURE;
baseImageSat.onload = () => updateGlobeSurfaceTexture();

/**
 * Maps input value to Viridis palette based on active dataset min/max range
 */
function getColorForValue(val) {
  if (val === undefined || val === null || isNaN(val)) return 'rgba(0,0,0,0)';

  const min = currentConfig.minVal;
  const max = currentConfig.maxVal;
  
  // Normalize value dynamically across the true dataset bounds
  const normalized = Math.max(0, Math.min(1, (val - min) / (max - min || 1)));

  // Key Viridis color control stops (RGB)
  const stops = [
    { t: 0.00, r: 68,  g: 1,   b: 84  }, // Deep Violet (#440154)
    { t: 0.25, r: 59,  g: 82,  b: 139 }, // Dark Blue   (#3b528b)
    { t: 0.50, r: 33,  g: 145, b: 140 }, // Teal        (#21918c)
    { t: 0.75, r: 94,  g: 201, b: 98  }, // Green       (#5ec962)
    { t: 1.00, r: 253, g: 231, b: 37  }  // Yellow      (#fde725)
  ];

  let lower = stops[0];
  let upper = stops[stops.length - 1];

  for (let i = 0; i < stops.length - 1; i++) {
    if (normalized >= stops[i].t && normalized <= stops[i + 1].t) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }

  const range = upper.t - lower.t || 1;
  const factor = (normalized - lower.t) / range;

  const r = Math.round(lower.r + factor * (upper.r - lower.r));
  const g = Math.round(lower.g + factor * (upper.g - lower.g));
  const b = Math.round(lower.b + factor * (upper.b - lower.b));

  return `rgba(${r}, ${g}, ${b}, 0.85)`;
}

/**
 * Initializes the Globe.gl 3D viewport
 */
function init3DGlobe(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!globeInstance) {
    globeInstance = Globe()(container)
      .globeImageUrl(DARK_BASE_TEXTURE)
      .backgroundColor('#000511')
      .showAtmosphere(true)
      .atmosphereColor('#0071e3')
      .atmosphereAltitude(0.12)
      .showGraticules(currentLayerState.graticules)
      .pointOfView({ lat: 15, lng: 0, altitude: 2.3 });

    window.globeInstance = globeInstance;

    fetchContinentalBorders();
    injectGlobeLayerControls(container);
    injectGlobeLegend(container);
  }
}

/**
 * Fetches GeoJSON country boundaries for coastlines
 */
function fetchContinentalBorders() {
  fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson')
    .then(res => res.json())
    .then(countries => {
      window.countryGeoJsonData = countries.features;
      updateContinentalBorders();
    })
    .catch(err => console.log('Notice: Could not load country outlines:', err));
}

function updateContinentalBorders() {
  if (!globeInstance || !window.countryGeoJsonData) return;

  if (currentLayerState.borders) {
    globeInstance
      .polygonsData(window.countryGeoJsonData)
      .polygonCapColor(() => 'rgba(0, 0, 0, 0)')
      .polygonSideColor(() => 'rgba(0, 0, 0, 0)')
      .polygonStrokeColor(() => 'rgba(255, 255, 255, 0.5)')
      .polygonAltitude(0.005);
  } else {
    globeInstance.polygonsData([]);
  }
}

/**
 * Injects floating layer toggle controls
 */
function injectGlobeLayerControls(container) {
  if (document.getElementById('globe-layer-controls')) return;

  const controlBox = document.createElement('div');
  controlBox.id = 'globe-layer-controls';
  controlBox.style.cssText = `
    position: absolute;
    top: 16px;
    right: 16px;
    background: rgba(10, 25, 47, 0.9);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.18);
    padding: 12px 16px;
    border-radius: 10px;
    color: #ffffff;
    font-size: 0.82rem;
    box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    z-index: 100;
    pointer-events: auto;
    font-family: system-ui, -apple-system, sans-serif;
  `;

  controlBox.innerHTML = `
    <div style="font-weight: 600; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Globe Layers</div>
    <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; cursor: pointer; text-transform: none; color: #f1f5f9; font-weight: normal;">
      <input type="checkbox" id="toggle-satellite" style="cursor: pointer;"> Satellite Topography
    </label>
    <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; cursor: pointer; text-transform: none; color: #f1f5f9; font-weight: normal;">
      <input type="checkbox" id="toggle-borders" checked style="cursor: pointer;"> Continental Outlines
    </label>
    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; text-transform: none; color: #f1f5f9; font-weight: normal;">
      <input type="checkbox" id="toggle-graticules" checked style="cursor: pointer;"> Lat/Lon Grid Lines
    </label>
  `;

  container.appendChild(controlBox);

  document.getElementById('toggle-satellite').addEventListener('change', (e) => {
    currentLayerState.satellite = e.target.checked;
    updateGlobeSurfaceTexture();
  });

  document.getElementById('toggle-borders').addEventListener('change', (e) => {
    currentLayerState.borders = e.target.checked;
    updateContinentalBorders();
  });

  document.getElementById('toggle-graticules').addEventListener('change', (e) => {
    currentLayerState.graticules = e.target.checked;
    if (globeInstance) globeInstance.showGraticules(currentLayerState.graticules);
  });
}

/**
 * Injects glassmorphic legend container
 */
function injectGlobeLegend(container) {
  if (document.getElementById('globe-legend')) return;

  const legendBox = document.createElement('div');
  legendBox.id = 'globe-legend';
  legendBox.style.cssText = `
    position: absolute;
    bottom: 20px;
    left: 20px;
    background: rgba(10, 25, 47, 0.9);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.18);
    padding: 10px 14px;
    border-radius: 10px;
    color: #ffffff;
    font-size: 0.78rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    z-index: 100;
    pointer-events: auto;
    font-family: system-ui, -apple-system, sans-serif;
    width: 220px;
  `;

  container.appendChild(legendBox);
  updateGlobeLegendUI();
}

/**
 * Updates legend labels dynamically based on current dataset min/max values
 */
function updateGlobeLegendUI() {
  const legendBox = document.getElementById('globe-legend');
  if (!legendBox) return;

  const min = currentConfig.minVal;
  const max = currentConfig.maxVal;
  const step = (max - min) / 4;

  const fmt = (v) => {
    if (v >= 10) return v.toFixed(1);
    return v.toFixed(2);
  };

  legendBox.innerHTML = `
    <div style="font-weight: 600; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; font-size: 0.75rem;">
      ${currentConfig.unit}
    </div>
    <div style="
      height: 10px; 
      width: 100%; 
      border-radius: 4px; 
      background: linear-gradient(to right, #440154, #3b528b, #21918c, #5ec962, #fde725);
      margin-bottom: 6px;
      border: 1px solid rgba(255, 255, 255, 0.2);
    "></div>
    <div style="display: flex; justify-content: space-between; color: #cbd5e1; font-size: 0.7rem; font-weight: 500;">
      <span>${fmt(min)}</span>
      <span>${fmt(min + step)}</span>
      <span>${fmt(min + step * 2)}</span>
      <span>${fmt(min + step * 3)}</span>
      <span>${fmt(max)}</span>
    </div>
  `;
}

/**
 * Composites base map texture and 1x1 degree SDM raster onto offscreen canvas
 */
function updateGlobeSurfaceTexture() {
  if (!globeInstance) return;

  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  const activeImage = currentLayerState.satellite ? baseImageSat : baseImageDark;
  if (activeImage.complete && activeImage.naturalWidth !== 0) {
    ctx.drawImage(activeImage, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = '#000814';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (rawSdmData && rawSdmData.length > 0) {
    const cellW = canvas.width / 360;
    const cellH = canvas.height / 180;

    rawSdmData.forEach(d => {
      if (d.lat !== undefined && d.lon !== undefined && d.val !== undefined && !isNaN(d.val) && d.val !== null) {
        const x = ((d.lon + 180) / 360) * canvas.width - (cellW / 2);
        const y = ((90 - d.lat) / 180) * canvas.height - (cellH / 2);

        ctx.fillStyle = getColorForValue(d.val);
        ctx.fillRect(x, y, cellW + 0.5, cellH + 0.5);
      }
    });
  }

  const dataUrl = canvas.toDataURL('image/png');
  globeInstance.globeImageUrl(dataUrl);
}

/**
 * Ingests CSV datasets, matching 'Lon', 'Lat', and 'Value' headers (trimmed),
 * computes dynamic min/max ranges, and updates the globe texture.
 * @param {string} dataSource - Path or URL to the CSV file
 * @param {Object} options - Metadata options ({ unit })
 */
function renderGlobePlanktonData(dataSource, options = {}) {
  if (!globeInstance) return;

  currentConfig.unit = options.unit || 'Species Richness';

  Papa.parse(dataSource, {
    download: true,
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: function (results) {
      if (!results.data || results.data.length === 0) {
        console.warn(`[Globe Engine] Empty CSV returned from: ${dataSource}`);
        return;
      }

      // 1. Identify Lon, Lat, and Value columns with whitespace trimming
      const sampleRow = results.data[0];
      const rawKeys = Object.keys(sampleRow);

      const latKey = rawKeys.find(k => k.trim().toLowerCase() === 'lat' || k.trim().toLowerCase() === 'latitude');
      const lonKey = rawKeys.find(k => k.trim().toLowerCase() === 'lon' || k.trim().toLowerCase() === 'longitude' || k.trim().toLowerCase() === 'lng');
      const valKey = rawKeys.find(k => k.trim().toLowerCase() === 'value' || k.trim().toLowerCase() === 'val' || k.trim().toLowerCase() === 'richness');

      if (!latKey || !lonKey || !valKey) {
        console.error(`[Globe Engine] Header mapping failed for ${dataSource}. Found headers:`, rawKeys);
        return;
      }

      // 2. Parse and filter valid marine rows
      rawSdmData = [];
      const extractedVals = [];

      results.data.forEach(row => {
        if (row && row[latKey] !== undefined && row[lonKey] !== undefined && row[valKey] !== undefined) {
          const lat = parseFloat(row[latKey]);
          const lon = parseFloat(row[lonKey]);
          const val = parseFloat(row[valKey]);

          if (!isNaN(lat) && !isNaN(lon) && !isNaN(val)) {
            rawSdmData.push({ lat, lon, val });
            extractedVals.push(val);
          }
        }
      });

      // 3. Compute dynamic min and max for auto-scaling
      if (extractedVals.length > 0) {
        currentConfig.minVal = 0; // Baseline at 0 species
        currentConfig.maxVal = Math.max(...extractedVals); // Max observed richness
      }

      console.log(`[Globe Engine] Successfully parsed ${rawSdmData.length} grid cells from ${dataSource}. Max Value: ${currentConfig.maxVal}`);

      updateGlobeLegendUI();

      // Clear extraneous geometry layers and update texture
      globeInstance
        .pointsData([])
        .ringsData([])
        .tilesData([]);

      updateGlobeSurfaceTexture();
    },
    error: function (err) {
      console.error(`Error loading CSV dataset from [${dataSource}]:`, err);
    }
  });
}