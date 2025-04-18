// js/charting.js
// Version: Added More Logging & Applying Filters

// --- Chart Instances Storage ---
const chartInstances = {};

// --- Color Palette & Mapping ---
const emberColors = { /* ... */ }; const techColorMapping = { /* ... */ };
function getTechColor(techName, index = 0) { /* ... */ }

// --- getValue Helper ---
function getValue(obj, keys, defaultValue = 0) { /* ... */ }

// --- Chart Creation Helper ---
function createChart(canvasId, type, data, options = {}) { /* ... */ }

// --- Main Chart Update Function ---
/**
 * Updates all charts based on model results, config, and filters.
 */
function updateCharts(yearlyResults, chartConfigData, filters = {}) {
    // *** ADDED LOGS ***
    console.log("DEBUG (charting.js - updateCharts): Received yearlyResults:", yearlyResults ? "Exists" : "null/undefined");
    console.log("DEBUG (charting.js - updateCharts): Received chartConfigData:", chartConfigData ? "Exists" : "null/undefined");
    console.log("DEBUG (charting.js - updateCharts): Received filters:", filters);

    if (!yearlyResults || !chartConfigData) { console.error("Missing data for chart update."); return; }

    const { years: chartLabels, endUseFuels, primaryFuels, powerTechs, hydrogenTechs, technologies, activityUnits, dataTypeLookup, sectors, subsectors } = chartConfigData;
    const { balanceSector = 'all', balanceSubsector = 'all', ueDisplayMode = 'fuel' } = filters;

    if (!chartLabels || !Array.isArray(chartLabels) || chartLabels.length === 0) { console.error("Years array missing."); return; }

    const GJ_PER_EJ = 1e9;
    const subsectorSelect = document.getElementById('selectSubsector');
    const selectedSubsectorKey = subsectorSelect ? subsectorSelect.value : null;
    const [selectedSector, selectedSubsector] = selectedSubsectorKey ? selectedSubsectorKey.split('|') : [null, null];
    const subsectorNameSpan = document.getElementById('selectedSubsectorName');
    if (subsectorNameSpan) { subsectorNameSpan.textContent = selectedSubsector ? `${selectedSector} - ${selectedSubsector}` : 'Select Subsector'; }

    const ejTooltipCallback = (context) => { /* ... */ };

    // --- Subsector Charts ---
    if (selectedSector && selectedSubsector) {
        const subsectorTechs = getValue(technologies, [selectedSector, selectedSubsector], []);
        const activityUnit = getValue(activityUnits, [selectedSector, selectedSubsector], 'Units');
        // 1. Activity
        const activityByTechDatasets = subsectorTechs.map((tech, techIndex) => ({ label: tech, data: chartLabels.map(y => getValue(yearlyResults, [y, 'demandTechActivity', selectedSector, selectedSubsector, tech], 0)), backgroundColor: getTechColor(tech, techIndex), })).filter(ds => ds.data.some(v => Math.abs(v) > 1e-3));
        console.log(`DEBUG (charting.js - updateCharts): Datasets for subsectorActivityChart: ${activityByTechDatasets.length} datasets`); // Log dataset count
        createChart('subsectorActivityChart', 'bar', { labels: chartLabels, datasets: activityByTechDatasets }, { plugins: { tooltip: { mode: 'index' } }, scales: { x: { stacked: true, title: { display: false } }, y: { stacked: true, beginAtZero: true, title: { display: true, text: `Activity (${activityUnit})`, font: {size: 12} } } } });
        // 2. FEC
        const subsectorFecDatasets = endUseFuels.map((fuel, fuelIndex) => ({ label: fuel, data: chartLabels.map(y => { let totalFuel = 0; subsectorTechs.forEach(tech => { totalFuel += getValue(yearlyResults, [y, 'fecDetailed', selectedSector, selectedSubsector, tech, fuel], 0); }); return totalFuel / GJ_PER_EJ; }), backgroundColor: getTechColor(fuel, fuelIndex), })).filter(ds => ds.data.some(v => v > 1e-9));
        console.log(`DEBUG (charting.js - updateCharts): Datasets for subsectorFecChart: ${subsectorFecDatasets.length} datasets`); // Log dataset count
        createChart('subsectorFecChart', 'bar', { labels: chartLabels, datasets: subsectorFecDatasets }, { plugins: { tooltip: { mode: 'index', callbacks: { label: ejTooltipCallback } } }, scales: { x: { stacked: true, title: { display: false } }, y: { stacked: true, beginAtZero: true, title: { display: true, text: 'FEC (EJ)', font: {size: 12} } } } });
        // 3. UE
        const subsectorUeDatasets = endUseFuels.map((fuel, fuelIndex) => ({ label: fuel, data: chartLabels.map(y => { let totalFuel = 0; subsectorTechs.forEach(tech => { totalFuel += getValue(yearlyResults, [y, 'ueDetailed', selectedSector, selectedSubsector, tech, fuel], 0); }); return totalFuel / GJ_PER_EJ; }), backgroundColor: getTechColor(fuel, fuelIndex), })).filter(ds => ds.data.some(v => v > 1e-9));
        console.log(`DEBUG (charting.js - updateCharts): Datasets for subsectorUeChart: ${subsectorUeDatasets.length} datasets`); // Log dataset co
