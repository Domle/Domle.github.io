/* ==========================================================================
   globe_view.js
   3D Globe Engine for 1x1 Degree SDMs (0 - 100% Scale)
   Canvas Texture Rasterizer with Viridis Color Gradient & Injected Legend
   ========================================================================== */

let globeInstance = null;
let rawSdmData = [];

// Base texture CDN URLs
const DARK_BASE_TEXTURE = 'https://unpkg.com/three-globe/example/img/earth-dark.jpg';
const SATELLITE_TEXTURE = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg';

let currentLayerState = {
  satellite: false,
  borders: true,
  graticules: true
};

// Pre-load base textures for canvas composite rendering
const baseImageDark = new Image();
baseImageDark.crossOrigin = 'anonymous';
baseImageDark.src = DARK_BASE_TEXTURE;
baseImageDark.onload = () => updateGlobeSurfaceTexture();

const baseImageSat = new Image();
baseImageSat.crossOrigin = 'anonymous';
baseImageSat.src = SATELLITE_TEXTURE;
baseImageSat.onload = () => updateGlobeSurfaceTexture();

/**
 * Maps species richness percentage (0 - 100%) to a fine 1% Viridis color scale
 */
function getColorForValue(val) {
  // Quantize to exact 1% discrete intervals (0%, 1%, 2%, ..., 100%)
  const p = Math.max(0, Math.min(100, Math.round(val))) / 100;

  // Key Viridis color control stops (RGB)
  const stops = [
    { t: 0.00, r: 68,  g: 1,   b: 84  }, // 0%   - Deep Violet (#440154)
    { t: 0.25, r: 59,  g: 82,  b: 139 }, // 25%  - Dark Blue   (#3b528b)
    { t: 0.50, r: 33,  g: 145, b: 140 }, // 50%  - Teal        (#21918c)
    { t: 0.75, r: 94,  g: 201, b: 98  }, // 75%  - Green       (#5ec962)
    { t: 1.00, r: 253, g: 231, b: 37  }  // 100% - Yellow      (#fde725)
  ];

  let lower = stops[0];
  let upper = stops[stops.length - 1];

  for (let i = 0; i < stops.length - 1; i++) {
    if (p >= stops[i].t && p <= stops[i + 1].t) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }

  const range = upper.t - lower.t || 1;
  const factor = (p - lower.t) / range;

  const r = Math.round(lower.r + factor * (upper.r - lower.r));
  const g = Math.round(lower.g + factor * (upper.g - lower.g));
  const b = Math.round(lower.b + factor * (upper.b - lower.b));

  return `rgba(${r}, ${g}, ${b}, 0.85)`;
}

/**
 * Initializes the Globe.gl 3D viewport with a minimalist dark base,
 * injects layer controls, and attaches the Viridis color legend.
 * @param {string} containerId - DOM ID of the container element
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
 * Injects a floating Viridis color legend overlay into the bottom-left of the viewport
 * @param {HTMLElement} container - The globe container element
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
    width: 210px;
  `;

  legendBox.innerHTML = `
    <div style="font-weight: 600; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; font-size: 0.75rem;">
      Species Presence (%)
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
      <span>0%</span>
      <span>25%</span>
      <span>50%</span>
      <span>75%</span>
      <span>100%</span>
    </div>
  `;

  container.appendChild(legendBox);
}

/**
 * Fetches GeoJSON country boundaries and renders subtle vector coastlines
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

/**
 * Updates vector continental outline layers on the globe surface
 */
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
 * Injects floating layer toggle controls on top of the 3D globe viewport
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

  const satCheckbox = document.getElementById('toggle-satellite');
  const borderCheckbox = document.getElementById('toggle-borders');
  const graticuleCheckbox = document.getElementById('toggle-graticules');

  satCheckbox.addEventListener('change', (e) => {
    currentLayerState.satellite = e.target.checked;
    updateGlobeSurfaceTexture();
  });

  borderCheckbox.addEventListener('change', (e) => {
    currentLayerState.borders = e.target.checked;
    updateContinentalBorders();
  });

  graticuleCheckbox.addEventListener('change', (e) => {
    currentLayerState.graticules = e.target.checked;
    if (globeInstance) {
      globeInstance.showGraticules(currentLayerState.graticules);
    }
  });
}

/**
 * Composites the base map texture and 1x1 degree SDM raster data 
 * onto an offscreen canvas using 1% step Viridis color rendering.
 */
function updateGlobeSurfaceTexture() {
  if (!globeInstance) return;

  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // 1. Draw Background Base Texture
  const activeImage = currentLayerState.satellite ? baseImageSat : baseImageDark;
  
  if (activeImage.complete && activeImage.naturalWidth !== 0) {
    ctx.drawImage(activeImage, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = '#000814';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // 2. Draw 1x1 Degree Marine SDM Cells with 1% Viridis Scale
  if (rawSdmData && rawSdmData.length > 0) {
    const cellW = canvas.width / 360;  // 5.688 pixels per longitude degree
    const cellH = canvas.height / 180; // 5.688 pixels per latitude degree

    rawSdmData.forEach(d => {
      const lat = d.lat ?? d.latitude;
      const lon = d.lon ?? d.longitude ?? d.lng;
      const val = d.value ?? d.richness ?? d.val;

      if (lat !== undefined && lon !== undefined && val !== undefined && !isNaN(val) && val !== null) {
        const x = ((lon + 180) / 360) * canvas.width - (cellW / 2);
        const y = ((90 - lat) / 180) * canvas.height - (cellH / 2);

        ctx.fillStyle = getColorForValue(val);
        ctx.fillRect(x, y, cellW + 0.5, cellH + 0.5); // +0.5 seam overlap
      }
    });
  }

  // 3. Update Globe.gl surface texture
  const dataUrl = canvas.toDataURL('image/png');
  globeInstance.globeImageUrl(dataUrl);
}

/**
 * Loads 1x1 degree SDM CSV predictions (0 - 100% species presence)
 * and initiates canvas texture rasterization.
 * @param {string} dataSource - Path or HTTPS URL to the CSV dataset
 */
function renderGlobePlanktonData(dataSource) {
  if (!globeInstance) return;

  Papa.parse(dataSource, {
    download: true,
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: function (results) {
      rawSdmData = results.data.filter(
        row => row && 
               (row.lat !== undefined || row.latitude !== undefined) && 
               (row.lon !== undefined || row.longitude !== undefined || row.lng !== undefined)
      );

      // Clear extraneous geometry layers and update texture
      globeInstance
        .pointsData([])
        .ringsData([])
        .tilesData([]);

      updateGlobeSurfaceTexture();
    },
    error: function (err) {
      console.error(`Error loading SDM dataset from [${dataSource}]:`, err);
    }
  });
}