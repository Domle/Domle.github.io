/* ==========================================================================
   OVERLAY DATA ENDPOINTS (Swap to Hugging Face /resolve/main/ URLs anytime)
   ========================================================================== */
const OVERLAY_SOURCES = {
  referenceStations: "Data/p2_fig1.csv",
  wdpaMpaGeoJson: "Data/wdpa_mpa_web.geojson",
  countryBordersGeoJson: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson"
};

/* ==========================================================================
   DATASET SCHEMA (All CSV files & visualization parameters)
   ========================================================================== */
const DEFAULT_PAPER_KEY = "paper2";

const datasetSchema = {
  paper1: {
    title: "Nitrogen fixation rates increase with diazotroph richness in the global ocean",
    figures: {
      fig1: {
        title: "Figure 1: Global Diazotroph Species Richness",
        panels: {
          panel_a: {
            label: "Panel A: Total Diazotroph Richness (n = 15)",
            file: "Data/p1_fig1_panel_a.csv",
            unit: "Normalized Richness (0 - 1)",
            colorScale: "viridis",
            minVal: 0,
            maxVal: 1
          },
          panel_c: {
            label: "Panel C: Cyanobacterial Diazotrophs (n = 9)",
            file: "Data/p1_fig1_panel_c.csv",
            unit: "Normalized Richness (0 - 1)",
            colorScale: "viridis",
            minVal: 0,
            maxVal: 1
          },
          panel_e: {
            label: "Panel E: Non-Cyanobacterial Diazotrophs (n = 6)",
            file: "Data/p1_fig1_panel_e.csv",
            unit: "Normalized Richness (0 - 1)",
            colorScale: "viridis",
            minVal: 0,
            maxVal: 1
          }
        }
      },
      fig3: {
        title: "Figure 3: Spatial Turnover & Community Dissimilarity",
        panels: {
          panel_a: {
            label: "Panel A: Annual Beta Ratio (Nestedness / Jaccard)",
            file: "Data/p1_fig3_panel_a.csv",
            unit: "Beta Ratio (0.0 - 1.0)",
            colorScale: "viridis",
            minVal: 0,
            maxVal: 1
          }
        }
      }
    }
  },
  paper2: {
    title: "Variations in the latitudinal diversity gradients of the ocean microbiome",
    figures: {
      fig1: {
        title: "Figure 1: Metagenomic Sampling Baseline",
        panels: {
          all: {
            label: "Global Sampling Stations: Prokaryotic Richness (rarefied to 5,000)",
            file: "Data/p2_fig1.csv",
            unit: "Prokaryotic Richness (rarefied to 5,000)",
            colorScale: "viridis",
            isPoints: true,
            autoScale: true
          }
        }
      },
      fig3: {
        title: "Figure 3: SML Microbiome Modeled Richness & Seasonal Variation",
        panels: {
          panel_a_bacteria: {
            label: "Panel A: Bacteria Annual Richness (SML)",
            file: "Data/p2_fig3_panel_a_bacteria.csv",
            unit: "Modeled Species Richness",
            colorScale: "viridis",
            autoScale: true
          },
          panel_a_archaea: {
            label: "Panel A: Archaea Annual Richness (SML)",
            file: "Data/p2_fig3_panel_a_archaea.csv",
            unit: "Modeled Species Richness",
            colorScale: "viridis",
            autoScale: true
          },
          panel_b_bacteria: {
            label: "Panel B: Bacteria Seasonal Variation (Dec vs. Jun)",
            file: "Data/p2_fig3_panel_b_bacteria.csv",
            unit: "Absolute Richness Delta (|Dec - Jun|)",
            colorScale: "white-red",
            autoScale: true
          },
          panel_b_archaea: {
            label: "Panel B: Archaea Seasonal Variation (Dec vs. Jun)",
            file: "Data/p2_fig3_panel_b_archaea.csv",
            unit: "Absolute Richness Delta (|Dec - Jun|)",
            colorScale: "white-red",
            autoScale: true
          }
        }
      },
      fig6: {
        title: "Figure 6: Consensus Diversity Hotspots",
        panels: {
          panel_b_group1: {
            label: "Panel B: Hotspot Classes - Group 1",
            file: "Data/p2_fig6_panel_b_group1.csv",
            unit: "Hotspot Class Count",
            isDiscrete: true
          },
          panel_b_group2: {
            label: "Panel B: Hotspot Classes - Group 2",
            file: "Data/p2_fig6_panel_b_group2.csv",
            unit: "Hotspot Class Count",
            isDiscrete: true
          },
          panel_b_group3: {
            label: "Panel B: Hotspot Classes - Group 3",
            file: "Data/p2_fig6_panel_b_group3.csv",
            unit: "Hotspot Class Count",
            isDiscrete: true
          },
          panel_b_group4: {
            label: "Panel B: Hotspot Classes - Group 4",
            file: "Data/p2_fig6_panel_b_group4.csv",
            unit: "Hotspot Class Count",
            isDiscrete: true
          }
        }
      }
    }
  }
};

/* ==========================================================================
   COLOR PALETTES & SCALES
   ========================================================================== */
const COLOR_PALETTES = {
  'viridis': [
    { t: 0.00, r: 68,  g: 1,   b: 84  },
    { t: 0.25, r: 59,  g: 82,  b: 139 },
    { t: 0.50, r: 33,  g: 145, b: 140 },
    { t: 0.75, r: 94,  g: 201, b: 98  },
    { t: 1.00, r: 253, g: 231, b: 37  }
  ],
  'white-red': [
    { t: 0.00, r: 255, g: 255, b: 255 },
    { t: 0.33, r: 252, g: 146, b: 114 },
    { t: 0.66, r: 222, g: 45,  b: 38  },
    { t: 1.00, r: 140, g: 0,   b: 0   }
  ]
};

const DISCRETE_SWATCH_COLORS = [
  '#38bdf8', // 1 - Sky Blue
  '#34d399', // 2 - Emerald Green
  '#facc15', // 3 - Bright Yellow
  '#fb923c', // 4 - Orange
  '#f87171', // 5 - Coral Red
  '#e11d48'  // 6 - Crimson
];

const LEGEND_GRADIENTS = {
  'viridis': 'linear-gradient(to right, #440154, #3b528b, #21918c, #5ec962, #fde725)',
  'white-red': 'linear-gradient(to right, #ffffff, #fc9272, #de2d26, #8c0000)'
};

function getColorForValue(val, cfg) {
  if (val === undefined || val === null || isNaN(val)) return 'rgba(0,0,0,0)';

  if (cfg.isDiscrete) {
    if (val <= 0) return 'rgba(0,0,0,0)';
    const intVal = Math.round(val);
    const idx = Math.max(0, Math.min(DISCRETE_SWATCH_COLORS.length - 1, intVal - 1));
    return DISCRETE_SWATCH_COLORS[idx];
  }

  const min = cfg.minVal;
  const max = cfg.maxVal;
  const normalized = Math.max(0, Math.min(1, (val - min) / (max - min || 1)));
  const stops = COLOR_PALETTES[cfg.colorScale] || COLOR_PALETTES['viridis'];

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

  return `rgb(${r}, ${g}, ${b})`;
}