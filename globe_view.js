/* ==========================================================================
   globe_view.js
   3D Globe Engine for 1x1 Degree SDMs with Dynamic Layer Controls
   ========================================================================== */

let globeInstance = null;

// Reliable texture CDN URLs for seamless, infinite layer toggling
const DARK_BASE_TEXTURE = 'https://unpkg.com/three-globe/example/img/earth-dark.jpg';
const SATELLITE_TEXTURE = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg';

let currentLayerState = {
  satellite: false,
  borders: true,
  graticules: true
};

/**
 * Initializes the Globe.gl 3D viewport with a minimalist dark base
 * and injects interactive layer toggles into the container.
 * @param {string} containerId - DOM ID of the container element
 */
function init3DGlobe(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!globeInstance) {
    // 1. Initialize Minimalist Dark Base Globe
    globeInstance = Globe()(container)
      .globeImageUrl(DARK_BASE_TEXTURE)
      .backgroundColor('#000511')
      .showAtmosphere(true)
      .atmosphereColor('#0071e3')
      .atmosphereAltitude(0.12)
      .showGraticules(currentLayerState.graticules)
      .pointOfView({ lat: 15, lng: 0, altitude: 2.3 });

    window.globeInstance = globeInstance;

    // 2. Fetch and render vector continental outlines
    fetchContinentalBorders();

    // 3. Inject clickable layer controls overlay into container
    injectGlobeLayerControls(container);
  }
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
      .polygonStrokeColor(() => 'rgba(255, 255, 255, 0.45)')
      .polygonAltitude(0.003);
  } else {
    globeInstance.polygonsData([]);
  }
}

/**
 * Injects floating layer toggle controls on top of the 3D globe viewport
 * @param {HTMLElement} container - The globe container element
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
    updateGlobeTexture();
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
 * Updates the globe surface texture reliably without dropping WebGL materials
 */
function updateGlobeTexture() {
  if (!globeInstance) return;

  const targetTexture = currentLayerState.satellite ? SATELLITE_TEXTURE : DARK_BASE_TEXTURE;
  globeInstance.globeImageUrl(targetTexture);
}

/**
 * Loads 1x1 degree SDM predictions and renders overlapping spatial density 
 * discs across ocean basins.
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
      const rawData = results.data.filter(
        row => row && (row.lat !== undefined || row.latitude !== undefined) && (row.lon !== undefined || row.longitude !== undefined || row.lng !== undefined)
      );

      const rings = rawData.map(d => {
        const lat = d.lat ?? d.latitude;
        const lon = d.lon ?? d.longitude ?? d.lng;
        const val = d.value ?? d.richness ?? d.val ?? 0;

        return {
          lat: lat,
          lng: lon,
          val: val,
          month: d.month || 'Year-round'
        };
      });

      globeInstance
        .ringsData(rings)
        .ringLat(d => d.lat)
        .ringLng(d => d.lng)
        .ringColor(d => {
          const val = d.val;
          if (val > 75) return t => `rgba(215, 48, 39, ${0.85 * (1 - t)})`;  // High Richness
          if (val > 50) return t => `rgba(252, 141, 89, ${0.85 * (1 - t)})`;  // Medium-High
          if (val > 25) return t => `rgba(254, 224, 139, ${0.85 * (1 - t)})`; // Medium-Low
          return t => `rgba(217, 239, 139, ${0.85 * (1 - t)})`;               // Low Richness
        })
        .ringMaxRadius(1.25)
        .ringPropagationSpeed(0)
        .ringRepeatPeriod(0)
        .ringAltitude(0.005);
    },
    error: function (err) {
      console.error(`Error loading SDM dataset from [${dataSource}]:`, err);
    }
  });
}