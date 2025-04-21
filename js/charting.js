// js/charting.js
// Version: Complete - Applying Filters, Conditional PED, UE by Type Colors, Yearly Aggregation

// --- Chart Instances Storage ---
const chartInstances = {};

// --- Color Palette & Mapping ---
const emberColors = { green_ember: '#13CE74', green_pine: '#06371F', green_forest: '#0B6638', green_grass: '#0F9A56', green_mint: '#89E7BA', blue_navy: '#204172', blue_azure: '#1E6DA9', blue_sky: '#37A6E6', blue_arctic: '#C4D9E9', fossil_fire: '#E04B00', fossil_clay: '#891B05', fossil_rust: '#BF3100', fossil_tangerine: '#EE7309', fossil_sunrise: '#FCA311', grey_smoke: '#999999', grey_fog: '#F7F7F7', grey_dark: '#718096', black: '#000000' };
const techColorMapping = { 'Solar PV': emberColors.green_ember, 'Wind': emberColors.green_grass, 'Hydro': emberColors.blue_sky, 'Nuclear power': emberColors.blue_azure, 'Biomass power': emberColors.green_forest, 'Gas power': emberColors.fossil_tangerine, 'Coal power': emberColors.fossil_clay, 'Oil power': emberColors.fossil_rust, 'Other power': emberColors.grey_smoke, 'Green': emberColors.green_ember, 'Blue': emberColors.blue_sky, 'Electricity': emberColors.blue_sky, 'Oil': emberColors.fossil_rust, 'Hydrogen': '#8b5cf6', 'Coal': emberColors.fossil_clay, 'Gas': emberColors.fossil_tangerine, 'Biomass': emberColors.green_forest, 'Solar': emberColors.fossil_sunrise, 'Uranium': emberColors.blue_azure, 'EV': emberColors.blue_sky, 'ICE': emberColors.fossil_rust, 'Ammonia ship': '#8b5cf6', 'Electric ship': emberColors.blue_sky, 'Conventional ship': emberColors.fossil_rust, 'Electric plane': emberColors.blue_sky, 'Conventional plane': emberColors.fossil_rust, 'Electric train': emberColors.blue_sky, 'Diesel train': emberColors.fossil_rust, 'BF-BOF': emberColors.fossil_clay, 'EAF': emberColors.blue_sky, 'DRI-EAF (H2)': '#8b5cf6', 'Conventional kiln': emberColors.fossil_clay, 'Electric kiln': emberColors.blue_sky, 'Conventional': emberColors.fossil_tangerine, 'Electrified': emberColors.blue_sky, 'Fossil boiler': emberColors.fossil_tangerine, 'Biomass boiler': emberColors.green_forest, 'Heat pump': emberColors.green_ember, 'Fossil furnace': emberColors.fossil_tangerine, 'Biomass furnace': emberColors.green_forest, 'Electric furnace': emberColors.blue_sky, 'Biomass heating': emberColors.green_forest, 'Electric heating': emberColors.blue_sky, 'Conventional fossil': emberColors.fossil_tangerine, 'Biomass cooking': emberColors.green_forest, 'Full LED': emberColors.green_ember, 'Low efficiency airco': emberColors.grey_smoke, 'High efficiency airco': emberColors.blue_sky, '_DEFAULT': emberColors.grey_smoke };
const ueTypeColorMapping = { 'Heating': emberColors.fossil_fire, 'Cooling': emberColors.blue_sky, 'Lighting': emberColors.fossil_sunrise, 'Motive Power': emberColors.ember_grass, 'Feedstock': emberColors.blue_navy, 'Other': emberColors.grey_smoke, 'Unknown': emberColors.grey_dark };

// Color helper functions
function getTechColor(techName, index = 0) { return techColorMapping[techName] || emberColors[techName.toLowerCase().replace(/ /g, '_')] || techColorMapping['_DEFAULT']; }
function getUeTypeColor(typeName, index = 0) { return ueTypeColorMapping[typeName] || getTechColor(typeName, index + Object.keys(emberColors).length); } // Offset index further

// --- getValue Helper ---
function getValue(obj, keys, defaultValue = 0) { let current = obj; for (const key of keys) { if (current && typeof current === 'object' && key in current) { current = current[key]; } else { return defaultValue; } } return (current === null || current === undefined) ? defaultValue : current; }

// --- Chart Creation Helper ---
/**
 * Creates or updates a Chart.js chart instance.
 */
function createChart(canvasId, type, data, options = {}) {
    // console.log(`DEBUG createChart: Attempting to create chart for canvasId: ${canvasId}`); // DEBUG
    const canvas = document.getElementById(canvasId); if (!canvas) { console.error(`Canvas element with id "${canvasId}" not found.`); return null; }
    // Check if the canvas's parent chart box OR section is hidden
    const chartBox = canvas.closest('.chart-box');
    const parentSection = canvas.closest('section');
    if ((chartBox && chartBox.classList.contains('hidden')) || (parentSection && parentSection.classList.contains('hidden'))) {
        // console.log(`Skipping chart creation for hidden canvas: ${canvasId}`);
        if (chartInstances[canvasId]) { chartInstances[canvasId].destroy(); delete chartInstances[canvasId]; }
        return null;
    }

    const ctx = canvas.getContext('2d'); if (!ctx) { console.error(`Could not get 2D context for canvas "${canvasId}".`); return null; }
    if (chartInstances[canvasId]) { chartInstances[canvasId].destroy(); }
    const defaultOptions = { responsive: true, maintainAspectRatio: false, animation: { duration: 400 }, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 15, padding: 10, usePointStyle: true } }, title: { display: false }, tooltip: { bodyFont: { size: 12 }, titleFont: { size: 13, weight: 'bold'}, boxPadding: 4 } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 11 } } }, y: { beginAtZero: true, grid: { color: '#e0e0e0', borderDash: [2, 3] }, ticks: { font: { size: 11 } } } } };
    const chartOptions = { ...defaultOptions, ...options, plugins: { ...defaultOptions.plugins, ...(options.plugins || {}), legend: { ...defaultOptions.plugins.legend, ...(options.plugins?.legend || {}) }, title: { ...defaultOptions.plugins.title, ...(options.plugins?.title || {}) }, tooltip: { ...defaultOptions.plugins.tooltip, ...(options.plugins?.tooltip || {}) } }, scales: { ...(defaultOptions.scales || {}), ...(options.scales || {}), x: { ...(defaultOptions.scales?.x || {}), ...(options.scales?.x || {}) }, y: { ...(defaultOptions.scales?.y || {}), ...(options.scales?.y || {}) } } };
    try { const chart = new Chart(ctx, { type, data, options: chartOptions }); chartInstances[canvasId] = chart; return chart; } catch (error) { console.error(`Error creating chart "${canvasId}":`, error); return null; } };

// --- Main Chart Update Function ---
/**
 * Updates all charts based on model results, config, and filters.
 */
function updateCharts(yearlyResults, chartConfigData, filters = {}) {
    // console.log("DEBUG (charting.js - updateCharts): Function called."); // DEBUG
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

    // console.log(`DEBUG (charting.js - updateCharts): Current subsector selection: ${selectedSubsectorKey}`); // DEBUG

    const ejTooltipCallback = (context) => { let label = context.dataset.label || ''; if (label) { label += ': '; } let value = context.parsed?.y; if (value !== null && !isNaN(value)) { label += value.toFixed(3) + ' EJ'; } else { label += 'N/A'; } return label; };

    // --- Subsector Charts (Unaffected by new filters, only check visibility) ---
    const subsectorChartsSection = document.getElementById('subsectorChartsSection');
    // console.log(`DEBUG (charting.js - updateCharts): Subsector section hidden? ${subsectorChartsSection?.classList.contains('hidden')}`); // DEBUG
    if (subsectorChartsSection && !subsectorChartsSection.classList.contains('hidden')) {
        // console.log("DEBUG (charting.js - updateCharts): Updating Subsector Charts..."); // DEBUG
        if (selectedSector && selectedSubsector) {
            const subsectorTechs = getValue(technologies, [selectedSector, selectedSubsector], []);
            const activityUnit = getValue(activityUnits, [selectedSector, selectedSubsector], 'Units');
            // console.log(`DEBUG (charting.js - updateCharts): Subsector ${selectedSector}|${selectedSubsector}, Techs: [${subsectorTechs.join(', ')}]`); // DEBUG

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
             // console.log("DEBUG (charting.js - updateCharts): Clearing subsector charts as selection is invalid."); // DEBUG
            ['subsectorActivityChart', 'subsectorFecChart', 'subsectorUeChart'].forEach(id => { if (chartInstances[id]) chartInstances[id].destroy(); const canvas = document.getElementById(id); if(canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height); });
        }
    }


    // --- Overall Energy Balance Charts (Apply Filters & Visibility) ---
    const balanceChartsSection = document.getElementById('balanceChartsSection');
    // console.log(`DEBUG (charting.js - updateCharts): Balance section hidden? ${balanceChartsSection?.classList.contains('hidden')}`); // DEBUG
    if (balanceChartsSection && !balanceChartsSection.classList.contains('hidden')) {
        // console.log("DEBUG (charting.js - updateCharts): Updating Balance Charts..."); // DEBUG
        // Calculate filtered aggregates PER YEAR
        const filteredYearlyFecByFuel = {}; const filteredYearlyUeByFuel = {}; const filteredYearlyUeByType = {};
        const uniqueTypes = new Set();
        const allocatedPedByPrimaryFuel = {}; // Store allocated PED per year { year: { primaryFuel: value } }

        chartLabels.forEach(year => {
            const yearData = yearlyResults[year]; if (!yearData) return;
            filteredYearlyFecByFuel[year] = endUseFuels.reduce((acc, f) => ({ ...acc, [f]: 0 }), {});
            filteredYearlyUeByFuel[year] = endUseFuels.reduce((acc, f) => ({ ...acc, [f]: 0 }), {});
            filteredYearlyUeByType[year] = {};
            allocatedPedByPrimaryFuel[year] = primaryFuels.reduce((acc, p) => ({ ...acc, [p]: 0 }), {}); // Init allocated PED for the year

            // Aggregate filtered FEC/UE first
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

            // Calculate allocated PED for this year based on the filtered FEC
             if (balanceSector !== 'all' && !sectors.includes(balanceSector)) {
                 // Handle case where sector filter might be invalid (e.g. 'Hydrogen Supply')
                 console.warn(`Invalid sector selected for PED allocation: ${balanceSector}`);
             } else if (balanceSector !== 'all' && balanceSector !== 'Power' && balanceSector !== 'Energy industry') {
                 // Perform allocation only if a specific end-use sector/subsector is selected
                 const yearAllocPed = allocatedPedByPrimaryFuel[year]; // Reference to this year's allocated PED object
                 const yearFilteredFec = filteredYearlyFecByFuel[year];
                 const totalElecDemand = getValue(yearData, ['ecPostHydrogen', 'Electricity'], 0);
                 const totalH2Demand = getValue(yearData, ['fecByFuel', 'Hydrogen'], 0);
                 // Note: Need total refined fuel outputs if allocating 'Other Transformations'
                 // This requires passing `otherTransformOutputs` from modelLogic or recalculating here.
                 // For now, allocation for 'Other' might be incomplete.

                 // --- Allocate Power PED ---
                 const elecDemandFiltered = yearFilteredFec['Electricity'] || 0;
                 const allocFactorElec = safeDivide(elecDemandFiltered, totalElecDemand);
                 primaryFuels.forEach(p => { yearAllocPed[p] += getValue(yearData, ['powerPrimaryInputsByFuel', p], 0) * allocFactorElec; });

                 // --- Allocate Hydrogen PED ---
                 const h2DemandFiltered = yearFilteredFec['Hydrogen'] || 0;
                 const allocFactorH2 = safeDivide(h2DemandFiltered, totalH2Demand);
                 const h2Inputs = getValue(yearData, ['hydrogenPrimaryInputsByFuel'], {});
                 primaryFuels.forEach(p => { yearAllocPed[p] += getValue(h2Inputs, [p], 0) * allocFactorH2; });
                 const elecForH2 = getValue(h2Inputs, ['Electricity'], 0);
                 const elecForH2Filtered = elecForH2 * allocFactorH2;
                 const allocFactorElecForH2 = safeDivide(elecForH2Filtered, totalElecDemand);
                 primaryFuels.forEach(p => { yearAllocPed[p] += getValue(yearData, ['powerPrimaryInputsByFuel', p], 0) * allocFactorElecForH2; });
                 // TODO: Add allocation for other intermediate inputs to H2

                 // --- Allocate Other Transformation PED ---
                 // Requires total outputs of refined fuels & inputs per refined fuel
                 // For now, this part is simplified / potentially incomplete
                 // Add direct primary use by filtered sector
                 primaryFuels.forEach(p => { yearAllocPed[p] += yearFilteredFec[p] || 0; });

             }


        }); // End of yearly aggregation loop

        // --- Determine which charts to show/update based on filters ---
        const showFecChart = !(balanceSector === 'Power' || balanceSector === 'Energy industry');
        const showUeChart = !(balanceSector === 'Power' || balanceSector === 'Energy industry');

        // 4. Primary Energy (PED) Chart (Conditional Content)
        let pedDatasets = []; let pedYAxisTitle = 'Primary Energy (PED) (EJ)';
        const pedChartTitleEl = document.getElementById('pedChartTitle'); // Get title element

        if (balanceSector === 'Power') {
            pedYAxisTitle = 'Power Sector Primary Inputs (EJ)';
            pedDatasets = primaryFuels.map((fuel, fuelIndex) => ({ label: fuel, data: chartLabels.map(y => getValue(yearlyResults, [y, 'powerPrimaryInputsByFuel', fuel], 0) / GJ_PER_EJ), backgroundColor: getTechColor(fuel, fuelIndex), })).filter(ds => ds.data.some(v => v > 1e-9));
        } else if (balanceSector === 'Energy industry') { // Hydrogen Supply
             pedYAxisTitle = 'Hydrogen Supply Primary Inputs (EJ)';
             const h2InputFuels = Object.keys(getValue(yearlyResults[chartLabels[0]], ['hydrogenPrimaryInputsByFuel'], {}));
             pedDatasets = h2InputFuels.map((fuel, fuelIndex) => ({ label: fuel, data: chartLabels.map(y => getValue(yearlyResults, [y, 'hydrogenPrimaryInputsByFuel', fuel], 0) / GJ_PER_EJ), backgroundColor: getTechColor(fuel, fuelIndex), })).filter(ds => ds.data.some(v => v > 1e-9));
        } else if (balanceSector === 'all') { // All Sectors
            pedYAxisTitle = `Total System PED (EJ)`;
            pedDatasets = primaryFuels.map((fuel, fuelIndex) => ({ label: fuel, data: chartLabels.map(y => getValue(yearlyResults, [y, 'pedByFuel', fuel], 0) / GJ_PER_EJ), backgroundColor: getTechColor(fuel, fuelIndex), })).filter(ds => ds.data.some(v => v > 1e-9));
        } else { // Specific End-Use Sector(s) selected
             pedYAxisTitle = `Est. PED for ${balanceSector}${balanceSubsector !== 'all' ? ` - ${balanceSubsector}` : ''} (EJ)`;
             pedDatasets = primaryFuels.map((fuel, fuelIndex) => ({
                 label: fuel,
                 data: chartLabels.map(y => (allocatedPedByPrimaryFuel[y]?.[fuel] || 0) / GJ_PER_EJ),
                 backgroundColor: getTechColor(fuel, fuelIndex),
             })).filter(ds => ds.data.some(v => v > 1e-9));
        }
        // Update chart title in DOM
        if(pedChartTitleEl) pedChartTitleEl.textContent = pedYAxisTitle.replace(" (EJ)",""); // Remove unit for title
        createChart('pedFuelChart', 'bar', { labels: chartLabels, datasets: pedDatasets }, { plugins: { tooltip: { mode: 'index', callbacks: { label: ejTooltipCallback } } }, scales: { x: { stacked: true, title: { display: false } }, y: { stacked: true, beginAtZero: true, title: { display: true, text: pedYAxisTitle, font: {size: 12} } } } });


        // 5. Final Energy (FEC) by Fuel (Filtered & Conditional Visibility)
        const fecChartBox = document.getElementById('fecChartBox');
        const fecChartTitleEl = document.getElementById('fecChartTitle');
        if (showFecChart && fecChartBox) {
            fecChartBox.classList.remove('hidden');
            const fecYAxisTitle = `Final Energy (FEC)${balanceSector !== 'all' ? ` (${balanceSector}${balanceSubsector !== 'all' ? ` - ${balanceSubsector}` : ''})` : ''} (EJ)`;
            if(fecChartTitleEl) fecChartTitleEl.textContent = fecYAxisTitle.replace(" (EJ)","");
            const fecDatasets = endUseFuels.map((fuel, fuelIndex) => ({ label: fuel, data: chartLabels.map(y => (filteredYearlyFecByFuel[y]?.[fuel] || 0) / GJ_PER_EJ), backgroundColor: getTechColor(fuel, fuelIndex), })).filter(ds => ds.data.some(v => v > 1e-9));
            createChart('fecFuelChart', 'bar', { labels: chartLabels, datasets: fecDatasets }, { plugins: { tooltip: { mode: 'index', callbacks: { label: ejTooltipCallback } } }, scales: { x: { stacked: true, title: { display: false } }, y: { stacked: true, beginAtZero: true, title: { display: true, text: fecYAxisTitle, font: {size: 12} } } } });
        } else { if (chartInstances['fecFuelChart']) { chartInstances['fecFuelChart'].destroy(); delete chartInstances['fecFuelChart']; } }

        // 6. Useful Energy (UE) (Filtered, By Fuel or Type & Conditional Visibility)
        const ueChartBox = document.getElementById('ueChartBox');
        const ueChartTitleEl = document.getElementById('ueChartTitle');
        if (showUeChart && ueChartBox) {
            ueChartBox.classList.remove('hidden');
            let ueDatasets = []; let ueYAxisTitle = `Useful Energy (UE)${balanceSector !== 'all' ? ` (${balanceSector}${balanceSubsector !== 'all' ? ` - ${balanceSubsector}` : ''})` : ''} (EJ)`;
            let ueTitleBase = `Useful Energy (UE)${balanceSector !== 'all' ? ` (${balanceSector}${balanceSubsector !== 'all' ? ` - ${balanceSubsector}` : ''})` : ''}`;

            if (ueDisplayMode === 'fuel') {
                ueYAxisTitle = `${ueTitleBase} by Fuel (EJ)`;
                ueDatasets = endUseFuels.map((fuel, fuelIndex) => ({ label: fuel, data: chartLabels.map(y => (filteredYearlyUeByFuel[y]?.[fuel] || 0) / GJ_PER_EJ), backgroundColor: getTechColor(fuel, fuelIndex), })).filter(ds => ds.data.some(v => v > 1e-9));
            } else { // ueDisplayMode === 'type'
                ueYAxisTitle = `${ueTitleBase} by Type (EJ)`;
                const typeList = Array.from(uniqueTypes).sort();
                ueDatasets = typeList.map((type, typeIndex) => ({ label: type, data: chartLabels.map(y => (filteredYearlyUeByType[y]?.[type] || 0) / GJ_PER_EJ), backgroundColor: getUeTypeColor(type, typeIndex), })).filter(ds => ds.data.some(v => v > 1e-9));
            }
            if(ueChartTitleEl) ueChartTitleEl.textContent = ueYAxisTitle.replace(" (EJ)","");
            createChart('ueFuelChart', 'bar', { labels: chartLabels, datasets: ueDatasets }, { plugins: { tooltip: { mode: 'index', callbacks: { label: ejTooltipCallback } } }, scales: { x: { stacked: true, title: { display: false } }, y: { stacked: true, beginAtZero: true, title: { display: true, text: ueYAxisTitle, font: {size: 12} } } } } );
        } else { if (chartInstances['ueFuelChart']) { chartInstances['ueFuelChart'].destroy(); delete chartInstances['ueFuelChart']; } }
    } // End of balance charts section update


    // --- Energy Supply & Transformations Charts (Unaffected by filters, check visibility) ---
    const supplyChartsSection = document.getElementById('supplyChartsSection');
    if (supplyChartsSection && !supplyChartsSection.classList.contains('hidden')) {
        // 7. Power Generation
        const totalElectricityGenSeries = chartLabels.map(y => getValue(yearlyResults, [y, 'ecPostHydrogen', 'Electricity'], 0)); const powerMixDatasets = (powerTechs || []).map((tech, techIndex) => ({ label: tech, data: chartLabels.map((y, yearIndex) => { const mixPercent = getValue(yearlyResults, [y, 'powerProdMix', tech], 0); const totalGen = totalElectricityGenSeries[yearIndex] || 0; return ((mixPercent / 100) * totalGen) / GJ_PER_EJ; }), backgroundColor: getTechColor(tech, techIndex), })).filter(ds => ds.data.some(v => v > 1e-9)); createChart('powerMixChart', 'bar', { labels: chartLabels, datasets: powerMixDatasets }, { plugins: { tooltip: { mode: 'index', callbacks: { label: ejTooltipCallback } } }, scales: { x: { stacked: true, title: { display: false } }, y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Power Generation (EJ)', font: {size: 12} } } } });
        // 8. Hydrogen Production
        const totalHydrogenProdSeries = chartLabels.map(y => getValue(yearlyResults, [y, 'fecByFuel', 'Hydrogen'], 0)); const hydrogenMixDatasets = (hydrogenTechs || []).map((tech, techIndex) => ({ label: tech, data: chartLabels.map((y, yearIndex) => { const mixPercent = getValue(yearlyResults, [y, 'hydrogenProdMix', tech], 0); const totalProd = totalHydrogenProdSeries[yearIndex] || 0; return ((mixPercent / 100) * totalProd) / GJ_PER_EJ; }), backgroundColor: getTechColor(tech, techIndex), })).filter(ds => ds.data.some(v => v > 1e-9)); createChart('hydrogenMixChart', 'bar', { labels: chartLabels, datasets: hydrogenMixDatasets }, { plugins: { tooltip: { mode: 'index', callbacks: { label: ejTooltipCallback } } }, scales: { x: { stacked: true, title: { display: false } }, y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Hydrogen Production (EJ)', font: {size: 12} } } } });
    } else {
         ['powerMixChart', 'hydrogenMixChart'].forEach(id => { if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; } });
    }
}
