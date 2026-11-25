/* ==========================================================================
   LEGEND, SUMMARY STATISTICS & PLOTLY CHARTS
   ========================================================================== */
function updateLegendUI(cfg) {
  document.getElementById('legend-unit').textContent = cfg.unit;
  const body = document.getElementById('legend-body');

  if (cfg.isDiscrete) {
    const ints = cfg.distinctValues && cfg.distinctValues.length > 0 ? cfg.distinctValues : [1, 2, 3, 4, 5];
    let swatches = '<div class="discrete-swatches">';
    let labels = '<div class="discrete-labels">';

    ints.forEach(v => {
      const idx = Math.max(0, Math.min(DISCRETE_SWATCH_COLORS.length - 1, v - 1));
      swatches += `<div class="discrete-swatch-item" style="background:${DISCRETE_SWATCH_COLORS[idx]};"></div>`;
      labels += `<span>${v}</span>`;
    });

    swatches += '</div>';
    labels += '</div>';
    body.innerHTML = swatches + labels;
    return;
  }

  const min = cfg.minVal;
  const max = cfg.maxVal;
  const step = (max - min) / 4;
  const fmt = (v) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));
  const gradient = LEGEND_GRADIENTS[cfg.colorScale] || LEGEND_GRADIENTS['viridis'];

  body.innerHTML = `
    <div class="legend-gradient-bar" style="background: ${gradient};"></div>
    <div class="legend-ticks">
      <span>${fmt(min)}</span>
      <span>${fmt(min + step)}</span>
      <span>${fmt(min + step * 2)}</span>
      <span>${fmt(min + step * 3)}</span>
      <span>${fmt(max)}</span>
    </div>
  `;
}

function updateSummaryStats(records, cfg) {
  const vals = records
    .map(r => r.val)
    .filter(v => v !== undefined && v !== null && !isNaN(v) && (!cfg.isDiscrete || v > 0))
    .sort((a, b) => a - b);

  document.getElementById('stats-count').textContent = `n = ${vals.length.toLocaleString()}`;

  if (vals.length === 0) {
    ['stat-min', 'stat-median', 'stat-mean', 'stat-max'].forEach(id => {
      document.getElementById(id).textContent = '-';
    });
    return;
  }

  const min = vals[0];
  const max = vals[vals.length - 1];
  const mid = Math.floor(vals.length / 2);
  const median = vals.length % 2 !== 0 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
  const mean = vals.reduce((acc, v) => acc + v, 0) / vals.length;

  const fmt = (v) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));

  document.getElementById('stat-min').textContent = fmt(min);
  document.getElementById('stat-median').textContent = fmt(median);
  document.getElementById('stat-mean').textContent = fmt(mean);
  document.getElementById('stat-max').textContent = fmt(max);
}

function renderSidebarPlot(records, cfg) {
  const valid = records.filter(r => r.val !== undefined && r.val !== null && !isNaN(r.val) && (!cfg.isDiscrete || r.val > 0));
  if (valid.length === 0) return;

  const plotDiv = document.getElementById('sidebar-plotly-chart');
  const baseLayout = {
    margin: { t: 16, r: 14, b: 38, l: 44 },
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
    font: { family: 'Inter, sans-serif', size: 11, color: '#3a3a3c' },
    xaxis: { gridcolor: '#f1f5f9', zeroline: false },
    yaxis: { gridcolor: '#f1f5f9', zeroline: false }
  };

  if (activePlotMode === 'histogram') {
    const vals = valid.map(r => r.val);
    const barColor = cfg.colorScale === 'white-red' ? '#de2d26' : '#21918c';

    Plotly.newPlot(plotDiv, [{
      x: vals,
      type: 'histogram',
      nbinsx: cfg.isDiscrete ? 6 : 24,
      marker: {
        color: barColor,
        line: { color: '#ffffff', width: 0.8 }
      }
    }], {
      ...baseLayout,
      xaxis: { ...baseLayout.xaxis, title: { text: cfg.unit, font: { size: 11 } } },
      yaxis: { ...baseLayout.yaxis, title: { text: 'Count', font: { size: 11 } } }
    }, { displayModeBar: false, responsive: true });
  } else {
    const sampled = valid.length > 2500
      ? valid.filter((_, idx) => idx % Math.ceil(valid.length / 2500) === 0)
      : valid;

    Plotly.newPlot(plotDiv, [{
      x: sampled.map(r => r.lat),
      y: sampled.map(r => r.val),
      mode: 'markers',
      type: 'scattergl',
      marker: {
        size: cfg.isPoints ? 5 : 3.5,
        color: sampled.map(r => getColorForValue(r.val, cfg)),
        opacity: 0.75
      }
    }], {
      ...baseLayout,
      xaxis: { ...baseLayout.xaxis, title: { text: 'Latitude (°N / °S)', font: { size: 11 } }, range: [-90, 90] },
      yaxis: { ...baseLayout.yaxis, title: { text: cfg.unit, font: { size: 11 } } }
    }, { displayModeBar: false, responsive: true });
  }
}

/* ==========================================================================
   CSV PARSING & DATASET LOADING
   ========================================================================== */
function parseLatLonValRows(rawRows) {
  if (!rawRows || rawRows.length === 0) return [];
  const sample = rawRows[0];
  const keys = Object.keys(sample);

  const latKey = keys.find(k => ['lat', 'latitude'].includes(k.trim().toLowerCase()));
  const lonKey = keys.find(k => ['lon', 'longitude', 'lng'].includes(k.trim().toLowerCase()));
  const valKey = keys.find(k => ['value', 'val', 'richness'].includes(k.trim().toLowerCase()));

  if (!latKey || !lonKey || !valKey) return [];

  const parsed = [];
  rawRows.forEach(row => {
    const lat = parseFloat(row[latKey]);
    const lon = parseFloat(row[lonKey]);
    const val = parseFloat(row[valKey]);
    if (!isNaN(lat) && !isNaN(lon) && !isNaN(val)) {
      parsed.push({ lat, lon, val });
    }
  });
  return parsed;
}

function loadSelectedDataset() {
  const paperKey = document.getElementById('paper-select').value;
  const figKey = document.getElementById('figure-select').value;
  const panelKey = document.getElementById('panel-select').value;

  const paperObj = datasetSchema[paperKey];
  const panelConfig = paperObj.figures[figKey].panels[panelKey];

  document.getElementById('map-active-title').textContent = panelConfig.label;
  document.getElementById('data-description').innerHTML = `
    <strong>Source File:</strong> <code>${panelConfig.file}</code><br>
    <strong>Variable:</strong> ${panelConfig.unit}<br>
    <strong>Study:</strong> <em>${paperObj.title}</em>
  `;

  Papa.parse(panelConfig.file, {
    download: true,
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: (results) => {
      activeRecords = parseLatLonValRows(results.data);
      gridLookup = {};

      activeRecords.forEach(r => {
        gridLookup[`${Math.round(r.lat)}_${Math.round(r.lon)}`] = r.val;
      });

      const vals = activeRecords.map(r => r.val);
      const posVals = vals.filter(v => v > 0);

      activeConfig = {
        unit: panelConfig.unit || 'Value',
        colorScale: panelConfig.colorScale || 'viridis',
        isDiscrete: Boolean(panelConfig.isDiscrete),
        isPoints: Boolean(panelConfig.isPoints),
        distinctValues: [],
        minVal: 0,
        maxVal: 1
      };

      if (activeConfig.isDiscrete) {
        activeConfig.distinctValues = Array.from(new Set(posVals.map(v => Math.round(v)))).sort((a, b) => a - b);
      } else if (vals.length > 0) {
        const dataMin = Math.min(...vals);
        const dataMax = Math.max(...vals);
        activeConfig.minVal = panelConfig.minVal !== undefined ? panelConfig.minVal : dataMin;
        activeConfig.maxVal = panelConfig.maxVal !== undefined ? panelConfig.maxVal : dataMax;
      }

      if (rasterOverlay) {
        map.removeLayer(rasterOverlay);
        rasterOverlay = null;
      }
      primaryPointsGroup.clearLayers();

      if (activeConfig.isPoints) {
        renderStationMarkers(activeRecords, activeConfig);
        referenceStationsGroup.clearLayers();
      } else {
        renderGriddedOverlay(activeRecords, activeConfig);
        toggleReferenceStationsOverlay(document.getElementById('chk-stations-overlay').checked);
      }

      updateLegendUI(activeConfig);
      updateSummaryStats(activeRecords, activeConfig);
      renderSidebarPlot(activeRecords, activeConfig);
    }
  });
}

/* ==========================================================================
   UI EVENT WIRING & INITIALIZATION
   ========================================================================== */
const paperSelect = document.getElementById('paper-select');
const figureSelect = document.getElementById('figure-select');
const panelSelect = document.getElementById('panel-select');

function populatePapers() {
  paperSelect.innerHTML = '';
  for (const key in datasetSchema) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = datasetSchema[key].title;
    if (key === DEFAULT_PAPER_KEY) opt.selected = true;
    paperSelect.appendChild(opt);
  }
  populateFigures();
}

function populateFigures() {
  const figs = datasetSchema[paperSelect.value].figures;
  figureSelect.innerHTML = '';
  for (const key in figs) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = figs[key].title;
    figureSelect.appendChild(opt);
  }
  populatePanels();
}

function populatePanels() {
  const panels = datasetSchema[paperSelect.value].figures[figureSelect.value].panels;
  panelSelect.innerHTML = '';
  for (const key in panels) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = panels[key].label;
    panelSelect.appendChild(opt);
  }
  loadSelectedDataset();
}

paperSelect.addEventListener('change', populateFigures);
figureSelect.addEventListener('change', populatePanels);
panelSelect.addEventListener('change', loadSelectedDataset);

// Basemap Selector
document.getElementById('basemap-select').addEventListener('change', (e) => {
  const selected = e.target.value;
  if (currentBasemap) map.removeLayer(currentBasemap);
  currentBasemap = baseLayers[selected].addTo(map);
  currentBasemap.bringToBack();
  updateBorderStyleForBasemap(selected);
});

// Layer Checkboxes
document.getElementById('chk-borders').addEventListener('change', (e) => {
  if (!bordersLayer) return;
  if (e.target.checked) bordersLayer.addTo(map);
  else map.removeLayer(bordersLayer);
});

document.getElementById('chk-graticules').addEventListener('change', (e) => {
  if (!graticulesLayer) return;
  if (e.target.checked) graticulesLayer.addTo(map);
  else map.removeLayer(graticulesLayer);
});

document.getElementById('chk-stations-overlay').addEventListener('change', (e) => {
  toggleReferenceStationsOverlay(e.target.checked);
});

document.getElementById('chk-mpa-overlay').addEventListener('change', (e) => {
  toggleMpaOverlay(e.target.checked);
});

document.getElementById('mpa-color-mode').addEventListener('change', () => {
  if (mpaLayer) {
    mpaLayer.setStyle(getMpaStyle);
    updateMpaLegend();
  }
});

// Opacity Slider
document.getElementById('opacity-slider').addEventListener('input', (e) => {
  const pct = parseInt(e.target.value, 10);
  document.getElementById('opacity-label').textContent = `${pct}%`;
  const alpha = pct / 100;

  if (rasterOverlay) rasterOverlay.setOpacity(alpha);
  primaryPointsGroup.eachLayer(layer => {
    if (layer.setStyle) layer.setStyle({ fillOpacity: alpha });
  });
});

// Sidebar Plot Tabs (Histogram vs Latitudinal Profile)
document.querySelectorAll('.plot-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.plot-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activePlotMode = btn.dataset.plot;
    renderSidebarPlot(activeRecords, activeConfig);
  });
});

// Sidebar Collapse / Expand Toggle
const sidebarPane = document.getElementById('sidebar-pane');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');

sidebarToggleBtn.addEventListener('click', () => {
  const isCollapsed = sidebarPane.classList.toggle('collapsed');
  sidebarToggleBtn.classList.toggle('collapsed', isCollapsed);
  sidebarToggleBtn.innerHTML = isCollapsed ? '&lsaquo;' : '&rsaquo;';

  setTimeout(() => {
    if (map) map.invalidateSize();
  }, 260);
});

// Initialize Application
initMap();
setTimeout(() => map.invalidateSize(), 100);
populatePapers();