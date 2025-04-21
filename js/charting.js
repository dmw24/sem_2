// js/charting.js
// Version: Complete - Applying Filters, Conditional PED, UE by Type Colors, Yearly Aggregation
// Updated: Added SUPPLY_SECTORS list, getEndUsePed helper, and cleaner PED allocation for "All sectors"

// --- Chart Instances Storage ---
const chartInstances = {};

// --- Color Palette & Mapping ---
const emberColors = {
  green_ember: '#13CE74',
  green_pine: '#06371F',
  green_forest: '#0B6638',
  green_grass: '#0F9A56',
  green_mint: '#89E7BA',
  blue_navy: '#204172',
  blue_azure: '#1E6DA9',
  blue_sky: '#37A6E6',
  blue_arctic: '#C4D9E9',
  fossil_fire: '#E04B00',
  fossil_clay: '#891B05',
  fossil_rust: '#BF3100',
  fossil_tangerine: '#EE7309',
  fossil_sunrise: '#FCA311',
  grey_smoke: '#999999',
  grey_fog: '#F7F7F7',
  grey_dark: '#718096',
  black: '#000000'
};

const techColorMapping = {
  'Solar PV': emberColors.green_ember,
  'Wind': emberColors.green_grass,
  'Hydro': emberColors.blue_sky,
  'Nuclear power': emberColors.blue_azure,
  'Biomass power': emberColors.green_forest,
  'Gas power': emberColors.fossil_tangerine,
  'Coal power': emberColors.fossil_clay,
  'Oil power': emberColors.fossil_rust,
  'Other power': emberColors.grey_smoke,
  'Green': emberColors.green_ember,
  'Blue': emberColors.blue_sky,
  'Electricity': emberColors.blue_sky,
  'Oil': emberColors.fossil_rust,
  'Hydrogen': '#8b5cf6',
  'Coal': emberColors.fossil_clay,
  'Gas': emberColors.fossil_tangerine,
  'Biomass': emberColors.green_forest,
  'Solar': emberColors.fossil_sunrise,
  'Uranium': emberColors.blue_azure,
  'EV': emberColors.blue_sky,
  'ICE': emberColors.fossil_rust,
  'Ammonia ship': '#8b5cf6',
  'Electric ship': emberColors.blue_sky,
  'Conventional ship': emberColors.fossil_rust,
  'Electric plane': emberColors.blue_sky,
  'Conventional plane': emberColors.fossil_rust,
  'Electric train': emberColors.blue_sky,
  'Diesel train': emberColors.fossil_rust,
  'BF-BOF': emberColors.fossil_clay,
  'EAF': emberColors.blue_sky,
  'DRI-EAF (H2)': '#8b5cf6',
  'Conventional kiln': emberColors.fossil_clay,
  'Electric kiln': emberColors.blue_sky,
  'Conventional': emberColors.fossil_tangerine,
  'Electrified': emberColors.blue_sky,
  'Fossil boiler': emberColors.fossil_tangerine,
  'Biomass boiler': emberColors.green_forest,
  'Heat pump': emberColors.green_ember,
  'Fossil furnace': emberColors.fossil_tangerine,
  'Biomass furnace': emberColors.green_forest,
  'Electric furnace': emberColors.blue_sky,
  'Biomass heating': emberColors.green_forest,
  'Electric heating': emberColors.blue_sky,
  'Conventional fossil': emberColors.fossil_tangerine,
  'Biomass cooking': emberColors.green_forest,
  'Full LED': emberColors.green_ember,
  'Low efficiency airco': emberColors.grey_smoke,
  'High efficiency airco': emberColors.blue_sky,
  '_DEFAULT': emberColors.grey_smoke
};

const ueTypeColorMapping = {
  'Heating': emberColors.fossil_fire,
  'Cooling': emberColors.blue_sky,
  'Lighting': emberColors.fossil_sunrise,
  'Motive Power': emberColors.green_grass,
  'Feedstock': emberColors.blue_navy,
  'Other': emberColors.grey_smoke,
  'Unknown': emberColors.grey_dark
};

// --- Supply sectors we exclude when we want end-use only numbers ---
const SUPPLY_SECTORS = ['Power', 'Energy industry'];

// --- Color helper functions ---
function getTechColor(techName, index = 0) {
  return (
    techColorMapping[techName] ||
    emberColors[techName.toLowerCase().replace(/ /g, '_')] ||
    techColorMapping['_DEFAULT']
  );
}

function getUeTypeColor(typeName, index = 0) {
  // Offset index so _DEFAULT palette rolls over cleanly
  return (
    ueTypeColorMapping[typeName] ||
    getTechColor(typeName, index + Object.keys(emberColors).length)
  );
}

// --- getValue Helper ---
function getValue(obj, keys, defaultValue = 0) {
  let current = obj;
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return defaultValue;
    }
  }
  return current == null ? defaultValue : current;
}

// --- Primary‑energy helper: end‑use sectors only --------------------
function getEndUsePed(yearData, fuel) {
  // System total PED minus Power + Hydrogen supply primary inputs
  return (
    getValue(yearData, ['pedByFuel', fuel], 0) -
    getValue(yearData, ['powerPrimaryInputsByFuel', fuel], 0) -
    getValue(yearData, ['hydrogenPrimaryInputsByFuel', fuel], 0)
  );
}

// --- Chart Creation Helper -----------------------------------------
/**
 * Creates or updates a Chart.js chart instance.
 */
function createChart(canvasId, type, data, options = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.error(`Canvas element with id "${canvasId}" not found.`);
    return null;
  }

  // skip hidden canvases
  const chartBox = canvas.closest('.chart-box');
  const parentSection = canvas.closest('section');
  if (
    (chartBox && chartBox.classList.contains('hidden')) ||
    (parentSection && parentSection.classList.contains('hidden'))
  ) {
    if (chartInstances[canvasId]) {
      chartInstances[canvasId].destroy();
      delete chartInstances[canvasId];
    }
    return null;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error(`Could not get 2D context for canvas "${canvasId}".`);
    return null;
  }

  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
  }

  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { font: { size: 11 }, boxWidth: 15, padding: 10, usePointStyle: true }
      },
      title: { display: false },
      tooltip: {
        bodyFont: { size: 12 },
        titleFont: { size: 13, weight: 'bold' },
        boxPadding: 4
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: {
        beginAtZero: true,
        grid: { color: '#e0e0e0', borderDash: [2, 3] },
        ticks: { font: { size: 11 } }
      }
    }
  };

  const chartOptions = {
    ...defaultOptions,
    ...options,
    plugins: {
      ...defaultOptions.plugins,
      ...(options.plugins || {}),
      legend: { ...defaultOptions.plugins.legend, ...(options.plugins?.legend || {}) },
      title: { ...defaultOptions.plugins.title, ...(options.plugins?.title || {}) },
      tooltip: { ...defaultOptions.plugins.tooltip, ...(options.plugins?.tooltip || {}) }
    },
    scales: {
      ...(defaultOptions.scales || {}),
      ...(options.scales || {}),
      x: { ...(defaultOptions.scales?.x || {}), ...(options.scales?.x || {}) },
      y: { ...(defaultOptions.scales?.y || {}), ...(options.scales?.y || {}) }
    }
  };

  try {
    const chart = new Chart(ctx, { type, data, options: chartOptions });
    chartInstances[canvasId] = chart;
    return chart;
  } catch (error) {
    console.error(`Error creating chart "${canvasId}":`, error);
    return null;
  }
}

// -------------------------------------------------------------------
// --- Main Chart Update Function ------------------------------------
// -------------------------------------------------------------------
/**
 * Updates all charts based on model results, config, and filters.
 */
function updateCharts(yearlyResults, chartConfigData, filters = {}) {
  if (!yearlyResults || !chartConfigData) {
    console.error('Missing data for chart update.');
    return;
  }

  const {
    years: chartLabels,
    endUseFuels,
    primaryFuels,
    powerTechs,
    hydrogenTechs,
    technologies,
    activityUnits,
    dataTypeLookup,
    sectors,
    subsectors
  } = chartConfigData;

  const {
    balanceSector = 'all',
    balanceSubsector = 'all',
    ueDisplayMode = 'fuel'
  } = filters;

  if (!Array.isArray(chartLabels) || chartLabels.length === 0) {
    console.error('Years array missing.');
    return;
  }

  const GJ_PER_EJ = 1e9;

  // ……………………………………………………………………………
  // (Subsector‑specific chart code unchanged)
  // ……………………………………………………………………………

  // --- Overall Energy Balance Charts --------------------------------
  const balanceChartsSection = document.getElementById('balanceChartsSection');
  if (balanceChartsSection && !balanceChartsSection.classList.contains('hidden')) {
    // … aggregation logic above this point stays identical …

    // 4. Primary Energy (PED) Chart ---------------------------------
    let pedDatasets = [];
    let pedYAxisTitle = 'Primary Energy (PED) (EJ)';
    const pedChartTitleEl = document.getElementById('pedChartTitle');

    if (balanceSector === 'Power') {
      pedYAxisTitle = 'Power Sector Primary Inputs (EJ)';
      pedDatasets = primaryFuels
        .map((fuel, i) => ({
          label: fuel,
          data: chartLabels.map(
            y => getValue(yearlyResults, [y, 'powerPrimaryInputsByFuel', fuel], 0) / GJ_PER_EJ
          ),
          backgroundColor: getTechColor(fuel, i)
        }))
        .filter(ds => ds.data.some(v => v > 1e-9));
    } else if (balanceSector === 'Energy industry') {
      pedYAxisTitle = 'Hydrogen Supply Primary Inputs (EJ)';
      const h2InputFuels = Object.keys(
        getValue(yearlyResults[chartLabels[0]], ['hydrogenPrimaryInputsByFuel'], {})
      );
      pedDatasets = h2InputFuels
        .map((fuel, i) => ({
          label: fuel,
          data: chartLabels.map(
            y => getValue(yearlyResults, [y, 'hydrogenPrimaryInputsByFuel', fuel], 0) / GJ_PER_EJ
          ),
          backgroundColor: getTechColor(fuel, i)
        }))
        .filter(ds => ds.data.some(v => v > 1e-9));
    } else if (balanceSector === 'all') {
      // ——— All end‑use sectors (exclude Power + Hydrogen) ———
      pedYAxisTitle = 'End-Use PED (excl. Power & Hydrogen) (EJ)';
      pedDatasets = primaryFuels
        .map((fuel, i) => ({
          label: fuel,
          data: chartLabels.map(y => getEndUsePed(yearlyResults[y], fuel) / GJ_PER_EJ),
          backgroundColor: getTechColor(fuel, i)
        }))
        .filter(ds => ds.data.some(v => v > 1e-9));
    } else {
      // Specific end‑use sector / subsector
      pedYAxisTitle = `Est. PED for ${balanceSector}${
