// js/charting.js
// Version: Complete - Applying Filters & Yearly Aggregation for Balance Charts

// --- Chart Instances Storage ---
const chartInstances = {};

// --- Color Palette & Mapping ---
const emberColors = { green_ember: '#13CE74', green_pine: '#06371F', green_forest: '#0B6638', green_grass: '#0F9A56', green_mint: '#89E7BA', blue_navy: '#204172', blue_azure: '#1E6DA9', blue_sky: '#37A6E6', blue_arctic: '#C4D9E9', fossil_fire: '#E04B00', fossil_clay: '#891B05', fossil_rust: '#BF3100', fossil_tangerine: '#EE7309', fossil_sunrise: '#FCA311', grey_smoke: '#999999', grey_fog: '#F7F7F7', grey_dark: '#718096', black: '#000000' };
const techColorMapping = { 'Solar PV': emberColors.green_ember, 'Wind': emberColors.green_grass, 'Hydro': emberColors.blue_sky, 'Nuclear power': emberColors.blue_azure, 'Biomass power': emberColors.green_forest, 'Gas power': emberColors.fossil_tangerine, 'Coal power': emberColors.fossil_clay, 'Oil power': emberColors.fossil_rust, 'Other power': emberColors.grey_smoke, 'Green': emberColors.green_ember, 'Blue': emberColors.blue_sky, 'Electricity': emberColors.blue_sky, 'Oil': emberColors.fossil_rust, 'Hydrogen': '#8b5cf6', 'Coal': emberColors.fossil_clay, 'Gas': emberColors.fossil_tangerine, 'Biomass': emberColors.green_forest, 'Solar': emberColors.fossil_sunrise, 'Uranium': emberColors.blue_azure, 'EV': emberColors.blue_sky, 'ICE': emberColors.fossil_rust, 'Ammonia ship': '#8b5cf6', 'Electric ship': emberColors.blue_sky, 'Conventional ship': emberColors.fossil_rust, 'Electric plane': emberColors.blue_sky, 'Conventional plane': emberColors.fossil_rust, 'Electric train': emberColors.blue_sky, 'Diesel train': emberColors.fossil_rust, 'BF-BOF': emberColors.fossil_clay, 'EAF': emberColors.blue_sky, 'DRI-EAF (H2)': '#8b5cf6', 'Conventional kiln': emberColors.fossil_clay, 'Electric kiln': emberColors.blue_sky, 'Conventional': emberColors.fossil_tangerine, 'Electrified': emberColors.blue_sky, 'Fossil boiler': emberColors.fossil_tangerine, 'Biomass boiler': emberColors.green_forest, 'Heat pump': emberColors.green_ember, 'Fossil furnace': emberColors.fossil_tangerine, 'Biomass furnace': emberColors.green_forest, 'Electric furnace': emberColors.blue_sky, 'Biomass heating': emberColors.green_forest, 'Electric heating': emberColors.blue_sky, 'Conventional fossil': emberColors.fossil_tangerine, 'Biomass cooking': emberColors.green_forest, 'Full LED': emberColors.green_ember, 'Low efficiency airco': emberColors.grey_smoke, 'High efficiency airco': emberColors.blue_sky, '_DEFAULT': emberColors.grey_smoke };
function getTechColor(techName, index = 0) { return techColorMapping[techName] || emberColors[techName.toLowerCase().replace(/ /g, '_')] || techColorMapping['_DEFAULT']; }

// --- getValue Helper ---
function getValue(obj, keys, defaultValue = 0) { let current = obj; for (const key of keys) { if (current && typeof current === 'object' && key in current) { current = current[key]; } else { return defaultValue; } } return (current === null || current === undefined) ? defaultValue : current; }

// --- Chart Creation Helper ---
function createChart(canvasId, type, data, options = {}) { const canvas = document.getElementById(canvasId); if (!canvas) { console.error(`Canvas element with id "${canvasId}" not found.`); return null; } const ctx = canvas.getContext('2d'); if (!ctx) { console.error(`Could not get 2D context for canvas "${canvasId}".`); return null; } if (chartInstances[canvasId]) { chartInstances[canvasId].destroy(); } const defaultOptions = { responsive: true, maintainAspectRatio: false, animation: { duration: 400 }, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 15, padding: 10, usePointStyle: true } }, title: { display: false }, tooltip: { bodyFont: { size: 12 }, titleFont: { size: 13, weight: 'bold'}, boxPadding: 4 } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 11 } } }, y: { beginAtZero: true, grid: { color: '#e0e0e0', borderDash: [2, 3] }, ticks: { font: { size: 11 } } } } }; const chartOptions = { ...defaultOptions, ...options, plugins: { ...defaultOptions.plugins, ...(options.plugins || {}), legend: { ...defaultOptions.plugins.legend, ...(options.plugins?.legend || {}) }, title: { ...defaultOptions.plugins.title, ...(options.plugins?.title || {}) }, tooltip: { ...defaultOptions.plugins.tooltip, ...(options.plugins?.tooltip || {}) } }, scales: { ...(defaultOptions.scales || {}), ...(options.scales || {}), x: { ...(defaultOptions.scales?.x || {}), ...(options.scales?.x || {}) }, y: { ...(defaultOptions.scales?.y || {}), ...(options.scales?.y || {}) } } }; try { const chart = new Chart(ctx, { type, data, options: chartOptions }); chartInstances[canvasId] = chart; return chart; } catch (error) { console.error(`Error creating chart "${canvasId}":`, error); return null; } };

// --- Main Chart Update Function ---
/**
 * Updates all charts based on model results, config, and filters.
 */
function updateCharts(yearlyResults, chartConfigData, filters = {}) {
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

    const ejTooltipCallback = (context) => { let label = context.dataset.label || ''; if (label) { label += ': '; } let value = context.parsed?.y; if (value !== null && !isNaN(value)) { label += value.toFixed(3) + ' EJ'; } else { label += 'N/A'; } return label; };

    // --- Subsector Charts (Unaffected by new filters) ---
    if (selectedSector && selectedSubsector) {
        const subsectorTechs = getValue(technologies, [selectedSector, selectedSubsector], []);
        const activityUnit = getValue(activityUnits, [selectedSector, selectedSubsector], 'Units');
        // 1. Activity
        const activityByTechDatasets = subsectorTechs.map((tech, techIndex) => ({ label: tech, data: chartLabels.map(y => getValue(yearlyResults, [y, 'demandTechActivity', selectedSector, selectedSubsector, tech], 0)), backgroundColor: getTechColor(tech, techIndex), })).filter(ds => ds.data.some(v => Math.abs(v) > 1e-3));
        createChart('subsectorActivityChart', 'bar', { labels: chartLabels, datasets: activityByTechDatasets }, { plugins: { tooltip: { mode: 'index' } }, scales: { x: { stacked: true, title: { display: false } }, y: { stacked: true, beginAtZero: true, title: { display: true, text: `Activity (${activityUnit})`, font: {size: 12} } } } });
        // 2. FEC
        const subsectorFecDatasets = endUseFuels.map((fuel, fuelIndex) => ({ label: fuel, data: chartLabels.map(y => { let totalFuel = 0; subsectorTechs.forEach(tech => { totalFuel += getValue(yearlyResults, [y, 'fecDetailed', selectedSector, selectedSubsector, tech, fuel], 0); }); return totalFuel / GJ_PER_EJ; }), backgroundColor: getTechColor(fuel, fuelIndex), })).filter(ds => ds.data.some(v => v > 1e-9));
        createChart('subsectorFecChart', 'bar', { labels: chartLabels, datasets: subsectorFecDatasets }, { plugins: { tooltip: { mode: 'index', callbacks: { label: ejTooltipCallback } } }, scales: { x: { stacked: true, title: { display: false } }, y: { stacked: true, beginAtZero: true, title: { display: true, text: 'FEC (EJ)', font: {size: 12} } } } });
        // 3. UE
        const subsectorUeDatasets = endUseFuels.map((fuel, fuelIndex) => ({ label: fuel, data: chartLabels.map(y => { let totalFuel = 0; subsectorTechs.forEach(tech => { totalFuel += getValue(yearlyResults, [y, 'ueDetailed', selectedSector, selectedSubsector, tech, fuel], 0); }); return totalFuel / GJ_PER_EJ; }), backgroundColor: getTechColor(fuel, fuelIndex), })).filter(ds => ds.data.some(v => v > 1e-9));
        createChart('subsectorUeChart', 'bar', { labels: chartLabels, datasets: subsectorUeDatasets }, { plugins: { tooltip: { mode: 'index', callbacks: { label: ejTooltipCallback } } }, scales: { x: { stacked: true, title: { display: false } }, y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Useful Energy (EJ)', font: {size: 12} } } } });
    } else {
        ['subsectorActivityChart', 'subsectorFecChart', 'subsectorUeChart'].forEach(id => { if (chartInstances[id]) chartInstances[id].destroy(); const canvas = document.getElementById(id); if(canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height); });
    }

    // --- Overall Energy Balance Charts (Apply Filters) ---

    // Calculate filtered aggregates PER YEAR
    const filteredYearlyFecByFuel = {}; const filteredYearlyUeByFuel = {}; const filteredYearlyUeByType = {};
    const uniqueTypes = new Set();

    chartLabels.forEach(year => {
        const yearData = yearlyResults[year]; if (!yearData) return;
        filteredYearlyFecByFuel[year] = endUseFuels.reduce((acc, f) => ({ ...acc, [f]: 0 }), {});
        filteredYearlyUeByFuel[year] = endUseFuels.reduce((acc, f) => ({ ...acc, [f]: 0 }), {});
        filteredYearlyUeByType[year] = {};

        (sectors || []).forEach(s => {
             if (s === 'Power' || s === 'Energy industry') return;
            (subsectors[s] || []).forEach(b => {
                let matchesFilter = true; if (balanceSector !== 'all' && s !== balanceSector) { matchesFilter = false; } if (matchesFilter && balanceSector !== 'all' && balanceSubsector !== 'all' && b !== balanceSubsector) { matchesFilter = false; }
                if (matchesFilter) {
                    (technologies[s]?.[b] || []).forEach(t => {
                        (endUseFuels || []).forEach(f => { const fecValue = getValue(yearData, ['fecDetailed', s, b, t, f], 0); filteredYearlyFecByFuel[year][f] += fecValue; });
                        (endUseFuels || []).forEach(f => { const ueValue = getValue(yearData, ['ueDetailed', s, b, t, f], 0); if(ueValue > 0){ filteredYearlyUeByFuel[year][f] += ueValue; const type = getValue(dataTypeLookup, [s, b, t, f], 'Unknown'); uniqueTypes.add(type); filteredYearlyUeByType[year][type] = (filteredYearlyUeByType[year][type] || 0) + ueValue; } });
                    });
                }
            });
        });
    });

    // 4. Total Final Energy (FEC) by Fuel (Filtered)
    const fecYAxisTitle = `Final Energy (FEC)${balanceSector !== 'all' ? ` (${balanceSector}${balanceSubsector !== 'all' ? ` - ${balanceSubsector}` : ''})` : ''} (EJ)`;
    createChart('fecFuelChart', 'bar',
        { labels: chartLabels, datasets: endUseFuels.map((fuel, fuelIndex) => ({ label: fuel, data: chartLabels.map(y => (filteredYearlyFecByFuel[y]?.[fuel] || 0) / GJ_PER_EJ), backgroundColor: getTechColor(fuel, fuelIndex), })).filter(ds => ds.data.some(v => v > 1e-9)) },
        { plugins: { tooltip: { mode: 'index', callbacks: { label: ejTooltipCallback } } }, scales: { x: { stacked: true, title: { display: false } }, y: { stacked: true, beginAtZero: true, title: { display: true, text: fecYAxisTitle, font: {size: 12} } } } }
    );

    // 5. Total Primary Energy (PED) by Fuel (Still Unfiltered)
    createChart('pedFuelChart', 'bar',
        { labels: chartLabels, datasets: primaryFuels.map((fuel, fuelIndex) => ({ label: fuel, data: chartLabels.map(y => getValue(yearlyResults, [y, 'pedByFuel', fuel], 0) / GJ_PER_EJ), backgroundColor: getTechColor(fuel, fuelIndex), })).filter(ds => ds.data.some(v => v > 1e-9)) },
        { plugins: { tooltip: { mode: 'index', callbacks: { label: ejTooltipCallback } } }, scales: { x: { stacked: true, title: { display: false } }, y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Total PED (EJ)', font: {size: 12} } } } }
    );

    // 6. Total Useful Energy (UE) (Filtered, By Fuel or Type)
    let ueDatasets = []; let ueYAxisTitle = `Useful Energy (UE)${balanceSector !== 'all' ? ` (${balanceSector}${balanceSubsector !== 'all' ? ` - ${balanceSubsector}` : ''})` : ''} (EJ)`;
    if (ueDisplayMode === 'fuel') {
        ueYAxisTitle = `UE by Fuel${balanceSector !== 'all' ? ` (${balanceSector}${balanceSubsector !== 'all' ? ` - ${balanceSubsector}` : ''})` : ''} (EJ)`;
        ueDatasets = endUseFuels.map((fuel, fuelIndex) => ({ label: fuel, data: chartLabels.map(y => (filteredYearlyUeByFuel[y]?.[fuel] || 0) / GJ_PER_EJ), backgroundColor: getTechColor(fuel, fuelIndex), })).filter(ds => ds.data.some(v => v > 1e-9));
    } else { // ueDisplayMode === 'type'
        ueYAxisTitle = `UE by Type${balanceSector !== 'all' ? ` (${balanceSector}${balanceSubsector !== 'all' ? ` - ${balanceSubsector}` : ''})` : ''} (EJ)`;
        const typeList = Array.from(uniqueTypes).sort();
        ueDatasets = typeList.map((type, typeIndex) => ({ label: type, data: chartLabels.map(y => (filteredYearlyUeByType[y]?.[type] || 0) / GJ_PER_EJ), backgroundColor: getTechColor(type, typeIndex + endUseFuels.length), })).filter(ds => ds.data.some(v => v > 1e-9));
    }
    createChart('ueFuelChart', 'bar', { labels: chartLabels, datasets: ueDatasets }, { plugins: { tooltip: { mode: 'index', callbacks: { label: ejTooltipCallback } } }, scales: { x: { stacked: true, title: { display: false } }, y: { stacked: true, beginAtZero: true, title: { display: true, text: ueYAxisTitle, font: {size: 12} } } } } );

    // --- Energy Supply & Transformations Charts (Unaffected by filters) ---
    // 7. Power Generation
    const totalElectricityGenSeries = chartLabels.map(y => getValue(yearlyResults, [y, 'ecPostHydrogen', 'Electricity'], 0)); const powerMixDatasets = powerTechs.map((tech, techIndex) => ({ label: tech, data: chartLabels.map((y, yearIndex) => { const mixPercent = getValue(yearlyResults, [y, 'powerProdMix', tech], 0); return ((mixPercent / 100) * totalElectricityGenSeries[yearIndex]) / GJ_PER_EJ; }), backgroundColor: getTechColor(tech, techIndex), })).filter(ds => ds.data.some(v => v > 1e-9)); createChart('powerMixChart', 'bar', { labels: chartLabels, datasets: powerMixDatasets }, { plugins: { tooltip: { mode: 'index', callbacks: { label: ejTooltipCallback } } }, scales: { x: { stacked: true, title: { display: false } }, y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Power Generation (EJ)', font: {size: 12} } } } });
    // 8. Hydrogen Production
    const totalHydrogenProdSeries = chartLabels.map(y => getValue(yearlyResults, [y, 'fecByFuel', 'Hydrogen'], 0)); const hydrogenMixDatasets = hydrogenTechs.map((tech, techIndex) => ({ label: tech, data: chartLabels.map((y, yearIndex) => { const mixPercent = getValue(yearlyResults, [y, 'hydrogenProdMix', tech], 0); return ((mixPercent / 100) * totalHydrogenProdSeries[yearIndex]) / GJ_PER_EJ; }), backgroundColor: getTechColor(tech, techIndex), })).filter(ds => ds.data.some(v => v > 1e-9)); createChart('hydrogenMixChart', 'bar', { labels: chartLabels, datasets: hydrogenMixDatasets }, { plugins: { tooltip: { mode: 'index', callbacks: { label: ejTooltipCallback } } }, scales: { x: { stacked: true, title: { display: false } }, y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Hydrogen Production (EJ)', font: {size: 12} } } } });
}
