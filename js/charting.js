// js/charting.js
// Version: Applying Filters & Yearly Aggregation for Balance Charts

// --- Chart Instances Storage ---
const chartInstances = {};

// --- Color Palette & Mapping ---
const emberColors = { /* ... (unchanged) ... */ };
const techColorMapping = { /* ... (unchanged) ... */ };
function getTechColor(techName, index = 0) { /* ... (unchanged) ... */ }

// --- getValue Helper ---
function getValue(obj, keys, defaultValue = 0) { /* ... (unchanged) ... */ }

// --- Chart Creation Helper ---
function createChart(canvasId, type, data, options = {}) { /* ... (unchanged) ... */ }

// --- Main Chart Update Function ---
/**
 * Updates all charts based on model results, config, and filters.
 * @param {object} yearlyResults - Results from modelLogic.js.
 * @param {object} chartConfigData - Config data from dataLoader.js.
 * @param {object} filters - Filter settings from uiController.js { balanceSector, balanceSubsector, ueDisplayMode }.
 */
function updateCharts(yearlyResults, chartConfigData, filters = {}) {
    if (!yearlyResults || !chartConfigData) { console.error("Missing data for chart update."); return; }

    // Destructure config data
    const { years: chartLabels, endUseFuels, primaryFuels, powerTechs, hydrogenTechs, technologies, activityUnits, dataTypeLookup, sectors, subsectors } = chartConfigData;
    // Destructure filters with defaults
    const { balanceSector = 'all', balanceSubsector = 'all', ueDisplayMode = 'fuel' } = filters;

    if (!chartLabels || !Array.isArray(chartLabels) || chartLabels.length === 0) { console.error("Years array missing."); return; }

    const GJ_PER_EJ = 1e9;
    const subsectorSelect = document.getElementById('selectSubsector');
    const selectedSubsectorKey = subsectorSelect ? subsectorSelect.value : null;
    const [selectedSector, selectedSubsector] = selectedSubsectorKey ? selectedSubsectorKey.split('|') : [null, null];
    const subsectorNameSpan = document.getElementById('selectedSubsectorName');
    if (subsectorNameSpan) { subsectorNameSpan.textContent = selectedSubsector ? `${selectedSector} - ${selectedSubsector}` : 'Select Subsector'; }

    const ejTooltipCallback = (context) => { /* ... (unchanged) ... */ };

    // --- Subsector Charts (Unaffected by new filters) ---
    if (selectedSector && selectedSubsector) { /* ... (subsector chart logic unchanged) ... */ }
    else { /* ... (clear subsector charts unchanged) ... */ }


    // --- Overall Energy Balance Charts (Apply Filters) ---

    // Calculate filtered aggregates PER YEAR
    const filteredYearlyFecByFuel = {}; // { year: { fuel: value_GJ } }
    const filteredYearlyUeByFuel = {};  // { year: { fuel: value_GJ } }
    const filteredYearlyUeByType = {};  // { year: { type: value_GJ } }
    const uniqueTypes = new Set();      // Store all unique types found

    chartLabels.forEach(year => {
        const yearData = yearlyResults[year];
        if (!yearData) return;

        // Initialize aggregates for this year
        filteredYearlyFecByFuel[year] = endUseFuels.reduce((acc, f) => ({ ...acc, [f]: 0 }), {});
        filteredYearlyUeByFuel[year] = endUseFuels.reduce((acc, f) => ({ ...acc, [f]: 0 }), {});
        filteredYearlyUeByType[year] = {}; // Initialize empty, types added dynamically

        // Iterate through relevant sectors/subsectors/techs/fuels
        (sectors || []).forEach(s => {
             if (s === 'Power' || s === 'Energy industry') return; // Skip supply sectors

            (subsectors[s] || []).forEach(b => {
                // *** APPLY SECTOR/SUBSECTOR FILTER ***
                let matchesFilter = true;
                if (balanceSector !== 'all' && s !== balanceSector) {
                    matchesFilter = false;
                }
                if (matchesFilter && balanceSector !== 'all' && balanceSubsector !== 'all' && b !== balanceSubsector) {
                    matchesFilter = false;
                }

                if (matchesFilter) {
                    (technologies[s]?.[b] || []).forEach(t => {
                        // Aggregate FEC
                        (endUseFuels || []).forEach(f => {
                            const fecValue = getValue(yearData, ['fecDetailed', s, b, t, f], 0);
                            filteredYearlyFecByFuel[year][f] += fecValue;
                        });
                        // Aggregate UE (by Fuel and Type)
                        (endUseFuels || []).forEach(f => {
                            const ueValue = getValue(yearData, ['ueDetailed', s, b, t, f], 0);
                            if(ueValue > 0){ // Only process if there's UE
                                filteredYearlyUeByFuel[year][f] += ueValue;

                                // Aggregate by Type using the lookup
                                const type = getValue(dataTypeLookup, [s, b, t, f], 'Unknown');
                                uniqueTypes.add(type); // Keep track of all types encountered
                                filteredYearlyUeByType[year][type] = (filteredYearlyUeByType[year][type] || 0) + ueValue;
                            }
                        });
                    });
                }
            });
        });
    }); // End of yearly aggregation loop


    // 4. Total Final Energy (FEC) by Fuel (Filtered)
    const fecYAxisTitle = `Final Energy (FEC)${balanceSector !== 'all' ? ` (${balanceSector}${balanceSubsector !== 'all' ? ` - ${balanceSubsector}` : ''})` : ''} (EJ)`;
    createChart('fecFuelChart', 'bar',
        {
            labels: chartLabels,
            datasets: endUseFuels.map((fuel, fuelIndex) => ({
                label: fuel,
                // Use the yearly filtered data
                data: chartLabels.map(y => (filteredYearlyFecByFuel[y]?.[fuel] || 0) / GJ_PER_EJ),
                backgroundColor: getTechColor(fuel, fuelIndex),
            })).filter(ds => ds.data.some(v => v > 1e-9)) // Filter empty datasets
        },
        { plugins: { tooltip: { mode: 'index', callbacks: { label: ejTooltipCallback } } }, scales: { x: { stacked: true, title: { display: false } }, y: { stacked: true, beginAtZero: true, title: { display: true, text: fecYAxisTitle, font: {size: 12} } } } }
    );


    // 5. Total Primary Energy (PED) by Fuel (Still Unfiltered)
    createChart('pedFuelChart', 'bar',
        {
            labels: chartLabels,
            datasets: primaryFuels.map((fuel, fuelIndex) => ({
                label: fuel,
                data: chartLabels.map(y => getValue(yearlyResults, [y, 'pedByFuel', fuel], 0) / GJ_PER_EJ), // Always Total PED
                backgroundColor: getTechColor(fuel, fuelIndex),
            })).filter(ds => ds.data.some(v => v > 1e-9))
        },
        { plugins: { tooltip: { mode: 'index', callbacks: { label: ejTooltipCallback } } }, scales: { x: { stacked: true, title: { display: false } }, y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Total PED (EJ)', font: {size: 12} } } } }
    );

    // 6. Total Useful Energy (UE) (Filtered, By Fuel or Type)
    let ueDatasets = [];
    let ueYAxisTitle = `Useful Energy (UE)${balanceSector !== 'all' ? ` (${balanceSector}${balanceSubsector !== 'all' ? ` - ${balanceSubsector}` : ''})` : ''} (EJ)`;

    if (ueDisplayMode === 'fuel') {
        ueYAxisTitle = `UE by Fuel${balanceSector !== 'all' ? ` (${balanceSector}${balanceSubsector !== 'all' ? ` - ${balanceSubsector}` : ''})` : ''} (EJ)`;
        ueDatasets = endUseFuels.map((fuel, fuelIndex) => ({
            label: fuel,
            // Use the yearly filtered data
            data: chartLabels.map(y => (filteredYearlyUeByFuel[y]?.[fuel] || 0) / GJ_PER_EJ),
            backgroundColor: getTechColor(fuel, fuelIndex),
        })).filter(ds => ds.data.some(v => v > 1e-9));
    } else { // ueDisplayMode === 'type'
        ueYAxisTitle = `UE by Type${balanceSector !== 'all' ? ` (${balanceSector}${balanceSubsector !== 'all' ? ` - ${balanceSubsector}` : ''})` : ''} (EJ)`;
        const typeList = Array.from(uniqueTypes).sort(); // Sort types alphabetically
        ueDatasets = typeList.map((type, typeIndex) => ({
            label: type,
            // Use the yearly filtered data aggregated by type
            data: chartLabels.map(y => (filteredYearlyUeByType[y]?.[type] || 0) / GJ_PER_EJ),
            backgroundColor: getTechColor(type, typeIndex + endUseFuels.length), // Use color helper, offset index
        })).filter(ds => ds.data.some(v => v > 1e-9));
    }

    createChart('ueFuelChart', 'bar',
        { labels: chartLabels, datasets: ueDatasets },
        { plugins: { tooltip: { mode: 'index', callbacks: { label: ejTooltipCallback } } }, scales: { x: { stacked: true, title: { display: false } }, y: { stacked: true, beginAtZero: true, title: { display: true, text: ueYAxisTitle, font: {size: 12} } } } }
    );


    // --- Energy Supply & Transformations Charts (Unaffected by filters) ---
    // 7. Power Generation (Unchanged)
    const totalElectricityGenSeries = chartLabels.map(y => getValue(yearlyResults, [y, 'ecPostHydrogen', 'Electricity'], 0)); const powerMixDatasets = powerTechs.map((tech, techIndex) => ({ label: tech, data: chartLabels.map((y, yearIndex) => { const mixPercent = getValue(yearlyResults, [y, 'powerProdMix', tech], 0); return ((mixPercent / 100) * totalElectricityGenSeries[yearIndex]) / GJ_PER_EJ; }), backgroundColor: getTechColor(tech, techIndex), })).filter(ds => ds.data.some(v => v > 1e-9)); createChart('powerMixChart', 'bar', { labels: chartLabels, datasets: powerMixDatasets }, { plugins: { tooltip: { mode: 'index', callbacks: { label: ejTooltipCallback } } }, scales: { x: { stacked: true, title: { display: false } }, y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Power Generation (EJ)', font: {size: 12} } } } });
    // 8. Hydrogen Production (Unchanged)
    const totalHydrogenProdSeries = chartLabels.map(y => getValue(yearlyResults, [y, 'fecByFuel', 'Hydrogen'], 0)); const hydrogenMixDatasets = hydrogenTechs.map((tech, techIndex) => ({ label: tech, data: chartLabels.map((y, yearIndex) => { const mixPercent = getValue(yearlyResults, [y, 'hydrogenProdMix', tech], 0); return ((mixPercent / 100) * totalHydrogenProdSeries[yearIndex]) / GJ_PER_EJ; }), backgroundColor: getTechColor(tech, techIndex), })).filter(ds => ds.data.some(v => v > 1e-9)); createChart('hydrogenMixChart', 'bar', { labels: chartLabels, datasets: hydrogenMixDatasets }, { plugins: { tooltip: { mode: 'index', callbacks: { label: ejTooltipCallback } } }, scales: { x: { stacked: true, title: { display: false } }, y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Hydrogen Production (EJ)', font: {size: 12} } } } });
}
