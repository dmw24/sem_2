// js/charting.js
// Further refactored for maximum conciseness
// Removed duplicate GJ_PER_EJ declaration

const chartInstances = {};
// const GJ_PER_EJ = 1e9; // REMOVED - Declared in modelLogic.js

// --- Color Palette & Mapping (Keep full for clarity) ---
const emberColors = { green_ember: '#13CE74', green_pine: '#06371F', green_forest: '#0B6638', green_grass: '#0F9A56', green_mint: '#89E7BA', blue_navy: '#204172', blue_azure: '#1E6DA9', blue_sky: '#37A6E6', blue_arctic: '#C4D9E9', fossil_fire: '#E04B00', fossil_clay: '#891B05', fossil_rust: '#BF3100', fossil_tangerine: '#EE7309', fossil_sunrise: '#FCA311', grey_smoke: '#999999', grey_fog: '#F7F7F7', grey_dark: '#718096', black: '#000000' };
const techColorMapping = { 'Solar PV': emberColors.green_ember, 'Wind': emberColors.green_grass, 'Hydro': emberColors.blue_sky, 'Nuclear power': emberColors.blue_azure, 'Biomass power': emberColors.green_forest, 'Gas power': emberColors.fossil_tangerine, 'Coal power': emberColors.fossil_clay, 'Oil power': emberColors.fossil_rust, 'Other power': emberColors.grey_smoke, 'Green': emberColors.green_ember, 'Blue': emberColors.blue_sky, 'Electricity': emberColors.blue_sky, 'Oil': emberColors.fossil_rust, 'Hydrogen': '#8b5cf6', 'Coal': emberColors.fossil_clay, 'Gas': emberColors.fossil_tangerine, 'Biomass': emberColors.green_forest, 'Solar': emberColors.fossil_sunrise, 'Uranium': emberColors.blue_azure, 'EV': emberColors.blue_sky, 'ICE': emberColors.fossil_rust, 'Ammonia ship': '#8b5cf6', 'Electric ship': emberColors.blue_sky, 'Conventional ship': emberColors.fossil_rust, 'Electric plane': emberColors.blue_sky, 'Conventional plane': emberColors.fossil_rust, 'Electric train': emberColors.blue_sky, 'Diesel train': emberColors.fossil_rust, 'BF-BOF': emberColors.fossil_clay, 'EAF': emberColors.blue_sky, 'DRI-EAF (H2)': '#8b5cf6', 'Conventional kiln': emberColors.fossil_clay, 'Electric kiln': emberColors.blue_sky, 'Conventional': emberColors.fossil_tangerine, 'Electrified': emberColors.blue_sky, 'Fossil boiler': emberColors.fossil_tangerine, 'Biomass boiler': emberColors.green_forest, 'Heat pump': emberColors.green_ember, 'Fossil furnace': emberColors.fossil_tangerine, 'Biomass furnace': emberColors.green_forest, 'Electric furnace': emberColors.blue_sky, 'Biomass heating': emberColors.green_forest, 'Electric heating': emberColors.blue_sky, 'Conventional fossil': emberColors.fossil_tangerine, 'Biomass cooking': emberColors.green_forest, 'Full LED': emberColors.green_ember, 'Low efficiency airco': emberColors.grey_smoke, 'High efficiency airco': emberColors.blue_sky, '_DEFAULT': emberColors.grey_smoke };
const getTechColor = (name = '', idx = 0) => techColorMapping[name] || emberColors[String(name).toLowerCase().replace(/ /g, '_')] || techColorMapping['_DEFAULT'];

// --- Chart Creation (Concise) ---
const createOrUpdateChart = (canvasId, type, data, options = {}) => {
    const canvas = document.getElementById(canvasId); if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    chartInstances[canvasId]?.destroy(); // Destroy previous

    const defaultOpts = { // Minimal defaults, rely on Chart.js defaults where possible
        responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 15, padding: 10, usePointStyle: true } } }
    };
    // Simple merge (overwrites defaults)
    const mergedOpts = { ...defaultOpts, ...options, plugins: { ...defaultOpts.plugins, ...options.plugins } };
    // Add titles if not provided in options
    mergedOpts.plugins.title ??= { display: true, text: canvas.closest('.chart-box')?.querySelector('h3')?.textContent || 'Chart' };
    mergedOpts.scales ??= {};
    mergedOpts.scales.x ??= { stacked: type === 'bar' };
    mergedOpts.scales.y ??= { stacked: type === 'bar', beginAtZero: true, title: { display: true, text: 'Value' } };

    try { chartInstances[canvasId] = new Chart(ctx, { type, data, options: mergedOpts }); }
    catch (err) { console.error(`Chart "${canvasId}" error:`, err); }
};

// Tooltip & Default Options (Concise)
const ejTooltip = ctx => `${ctx.dataset.label || ''}: ${ctx.parsed?.y != null ? ctx.parsed.y.toFixed(3) + ' EJ' : 'N/A'}`; // Uses GJ_PER_EJ implicitly via calculation results
const stackedBarOpts = yTitle => ({ plugins: { tooltip: { callbacks: { label: ejTooltip } } }, scales: { y: { title: { text: yTitle } } } });

// --- Main Chart Update (Concise) ---
function updateCharts(results, config) {
    if (!results || !config) return console.warn("Missing results/config for charts.");
    const { years = [], endUseFuels = [], primaryFuels = [], powerTechs = [], hydrogenTechs = [], technologies = {}, activityUnits = {} } = config;
    if (!years.length) return console.error("Years missing for charts.");
    const subKey = document.getElementById('selectSubsector')?.value;
    const [selSector, selSubsector] = subKey?.split('|') || [];

    // Helper to create dataset array
    // GJ_PER_EJ is used implicitly here when dividing results (which are in GJ)
    const createDatasets = (labels, dataMapFn, filterFn = ds => ds.data.some(v => Math.abs(v) > 1e-9)) =>
        labels.map(dataMapFn).filter(filterFn);

    // --- Subsector Charts ---
    if (selSector && selSubsector) {
        const subTechs = technologies?.[selSector]?.[selSubsector] ?? [];
        const actUnit = activityUnits?.[selSector]?.[selSubsector] ?? 'Units';
        createOrUpdateChart('subsectorActivityChart', 'bar', { labels: years, datasets: createDatasets(subTechs, (tech, i) => ({ label: tech, data: years.map(y => results?.[y]?.demandTechActivity?.[selSector]?.[selSubsector]?.[tech] ?? 0), backgroundColor: getTechColor(tech, i) })) }, { scales: { y: { title: { text: `Activity (${actUnit})` } } } });
        createOrUpdateChart('subsectorFecChart', 'bar', { labels: years, datasets: createDatasets(endUseFuels, (fuel, i) => ({ label: fuel, data: years.map(y => subTechs.reduce((sum, t) => sum + (results?.[y]?.fecDetailed?.[selSector]?.[selSubsector]?.[t]?.[fuel] ?? 0), 0) / GJ_PER_EJ), backgroundColor: getTechColor(fuel, i) })) }, stackedBarOpts('FEC (EJ)'));
        createOrUpdateChart('subsectorUeChart', 'bar', { labels: years, datasets: createDatasets(endUseFuels, (fuel, i) => ({ label: fuel, data: years.map(y => subTechs.reduce((sum, t) => sum + (results?.[y]?.ueDetailed?.[selSector]?.[selSubsector]?.[t]?.[fuel] ?? 0), 0) / GJ_PER_EJ), backgroundColor: getTechColor(fuel, i) })) }, stackedBarOpts('Useful Energy (EJ)'));
    } else { // Clear if no subsector selected
        ['subsectorActivityChart', 'subsectorFecChart', 'subsectorUeChart'].forEach(id => { chartInstances[id]?.destroy(); delete chartInstances[id]; const cvs = document.getElementById(id); cvs?.getContext('2d').clearRect(0, 0, cvs.width, cvs.height); });
    }

    // --- Balance Charts ---
    createOrUpdateChart('fecFuelChart', 'bar', { labels: years, datasets: createDatasets(endUseFuels, (fuel, i) => ({ label: fuel, data: years.map(y => (results?.[y]?.fecByFuel?.[fuel] ?? 0) / GJ_PER_EJ), backgroundColor: getTechColor(fuel, i) })) }, stackedBarOpts('Total FEC (EJ)'));
    createOrUpdateChart('pedFuelChart', 'bar', { labels: years, datasets: createDatasets(primaryFuels, (fuel, i) => ({ label: fuel, data: years.map(y => (results?.[y]?.pedByFuel?.[fuel] ?? 0) / GJ_PER_EJ), backgroundColor: getTechColor(fuel, i) })) }, stackedBarOpts('Total PED (EJ)'));
    createOrUpdateChart('ueFuelChart', 'bar', { labels: years, datasets: createDatasets(endUseFuels, (fuel, i) => ({ label: fuel, data: years.map(y => (results?.[y]?.ueByFuel?.[fuel] ?? 0) / GJ_PER_EJ), backgroundColor: getTechColor(fuel, i) })) }, stackedBarOpts('Total Useful Energy (EJ)'));

    // --- Supply Charts ---
    createOrUpdateChart('powerMixChart', 'bar', { labels: years, datasets: createDatasets(powerTechs, (tech, i) => ({ label: tech, data: years.map(y => (((results?.[y]?.powerProdMix?.[tech] ?? 0) / 100) * (results?.[y]?.ecPostHydrogen?.['Electricity'] ?? 0)) / GJ_PER_EJ), backgroundColor: getTechColor(tech, i) })) }, stackedBarOpts('Power Generation (EJ)'));
    createOrUpdateChart('hydrogenMixChart', 'bar', { labels: years, datasets: createDatasets(hydrogenTechs, (tech, i) => ({ label: tech, data: years.map(y => (((results?.[y]?.hydrogenProdMix?.[tech] ?? 0) / 100) * (results?.[y]?.fecByFuel?.['Hydrogen'] ?? 0)) / GJ_PER_EJ), backgroundColor: getTechColor(tech, i) })) }, stackedBarOpts('Hydrogen Production (EJ)'));

    console.log("Charts updated.");
}
