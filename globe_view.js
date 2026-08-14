// globe_view.js - Modular 3D Globe Rendering Logic

let worldInstance = null;
let planktonDataCache = [];

/**
 * Initializes the Globe.gl instance inside a target DOM container.
 * @param {string} containerId - The ID of the HTML element holding the globe.
 */
function init3DGlobe(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Prevent multiple initializations on the same container
  if (worldInstance) {
    worldInstance.width(container.clientWidth);
    worldInstance.height(container.clientHeight);
    return;
  }

  const darkTexture = 'https://unpkg.com/three-globe/example/img/earth-dark.jpg';

  worldInstance = Globe()(container)
    .globeImageUrl(darkTexture)
    .backgroundImageUrl('https://unpkg.com/three-globe/example/img/night-sky.png')
    .showAtmosphere(true)
    .atmosphereColor('#38bdf8')
    .atmosphereAltitude(0.18);

  worldInstance.controls().autoRotate = false;
  worldInstance.pointOfView({ lat: 20, lng: 0, altitude: 2.0 });
}

/**
 * Parses CSV text or fetches a file path to render hex bins on the globe.
 * @param {string} csvSource - CSV text string or URL path to CSV.
 */
function renderGlobePlanktonData(csvSource) {
  if (!worldInstance) return;

  if (csvSource.endsWith('.csv') || csvSource.startsWith('Data/')) {
    fetch(csvSource)
      .then(res => res.text())
      .then(csvText => processAndDrawGlobeData(csvText))
      .catch(() => generateGlobeDummyData());
  } else {
    processAndDrawGlobeData(csvSource);
  }
}

function processAndDrawGlobeData(csvText) {
  planktonDataCache = parseGlobeCSV(csvText);
  if (planktonDataCache.length === 0) {
    generateGlobeDummyData();
    return;
  }

  worldInstance
    .hexBinPointLat(d => d.lat)
    .hexBinPointLng(d => d.lng)
    .hexBinPointWeight(d => d.weight)
    .hexBinResolution(4.2)
    .hexMargin(0)
    .hexBinMerge(true)
    .hexTopColor(d => getContinuousViridisColor(d.sumWeight / d.points.length, 0, 75))
    .hexSideColor(d => getContinuousViridisColor(d.sumWeight / d.points.length, 0, 75))
    .hexAltitude(d => Math.max(0.001, ((d.sumWeight / d.points.length) / 100) * 0.0015))
    .hexBinPointsData(planktonDataCache);
}

function parseGlobeCSV(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));

  let lngIdx = headers.findIndex(h => ['x', 'lng', 'lon', 'longitude'].includes(h));
  let latIdx = headers.findIndex(h => ['y', 'lat', 'latitude'].includes(h));
  let valIdx = headers.findIndex(h => ['z', 'val', 'value', 'richness'].includes(h));

  if (lngIdx === -1) lngIdx = 0;
  if (latIdx === -1) latIdx = 1;
  if (valIdx === -1) valIdx = 2;

  const points = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (row.length < 2) continue;
    let lat = parseFloat(row[latIdx]), lng = parseFloat(row[lngIdx]), val = parseFloat(row[valIdx]);
    if (isNaN(lat) || isNaN(lng) || isNaN(val)) continue;
    if (lng > 180) lng -= 360;
    if (lng < -180) lng += 360;
    points.push({ lat, lng, weight: val });
  }
  return points;
}

function getContinuousViridisColor(val, minVal = 0, maxVal = 70) {
  let t = Math.max(0, Math.min(1, (val - minVal) / (maxVal - minVal)));
  const colors = [
    { r: 30,  g: 136, b: 229 },
    { r: 68,  g: 1,   b: 84  },
    { r: 33,  g: 145, b: 140 },
    { r: 94,  g: 201, b: 98  },
    { r: 253, g: 231, b: 37  }
  ];
  const scaledT = t * (colors.length - 1);
  const idx = Math.floor(scaledT);
  const frac = scaledT - idx;

  if (idx >= colors.length - 1) return `rgb(${colors[colors.length - 1].r}, ${colors[colors.length - 1].g}, ${colors[colors.length - 1].b})`;

  const c1 = colors[idx], c2 = colors[idx + 1];
  return `rgb(${Math.round(c1.r + frac * (c2.r - c1.r))}, ${Math.round(c1.g + frac * (c2.g - c1.g))}, ${Math.round(c1.b + frac * (c2.b - c1.b))})`;
}

function generateGlobeDummyData() {
  const dummyPoints = Array.from({ length: 300 }, () => ({
    lat: (Math.random() - 0.5) * 120,
    lng: (Math.random() - 0.5) * 360,
    weight: Math.random() * 80
  }));
  worldInstance
    .hexBinPointLat(d => d.lat)
    .hexBinPointLng(d => d.lng)
    .hexBinPointWeight(d => d.weight)
    .hexBinResolution(4.2)
    .hexMargin(0)
    .hexBinMerge(true)
    .hexTopColor(d => getContinuousViridisColor(d.sumWeight / d.points.length, 0, 75))
    .hexSideColor(d => getContinuousViridisColor(d.sumWeight / d.points.length, 0, 75))
    .hexAltitude(d => Math.max(0.001, ((d.sumWeight / d.points.length) / 100) * 0.0015))
    .hexBinPointsData(dummyPoints);
}