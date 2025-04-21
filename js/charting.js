// js/charting.js
// Version: Added Supply Chart Logging + Filters/Conditional PED/UE Types

// --- Chart Instances Storage ---
const chartInstances = {};

// --- Color Palette & Mapping ---
const emberColors = { /* ... */ };
const techColorMapping = { /* ... */ };
const ueTypeColorMapping = { 'Heating': emberColors.fossil_fire, 'Cooling': emberColors.blue_sky, 'Lighting': emberColors.fossil_sunrise, 'Motive Power': emberColors.ember_grass, 'Feedstock': emberColors.blue_navy, 'Other': emberColors.grey_smoke, 'Unknown': emberColors.grey_dark };
function getTechColor(techName, index = 0) { /* ... */ }
function getUeTypeColor(typeName, index = 0) { return ueTypeColorMapping[typeName] || getTechColor(typeName, index + Object.keys(emberColors).length); } // Offset index further

// --- getValue Helper ---
function getValue(obj, keys, defaultValue = 0) { /* ... */ }

// --- Chart Creation Helper ---
function createChart(canvasId, type, data, options = {}) { /* ... (Includes check for hidden parent) ... */ }

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

    const ejTooltipCallback = (context) => { /* ... */ };

    // --- Subsector Charts (Unaffected by new filters, only check visibility) ---
    const subsectorChartsSection = document.getElementById('subsectorChartsSection');
    if (subsectorChartsSection && !subsectorChartsSection.classList.contains('hidden')) { /* ... (subsector chart logic unchanged) ... */ }


    // --- Overall Energy Balance Charts (Apply Filters & Visibility) ---
    const balanceChartsSection = document.getElementById('balanceChartsSection');
    if (balanceChartsSection && !balanceChartsSection.classList.contains('hidden')) {
        // Calculate filtered aggregates PER YEAR
        const filteredYearlyFecByFuel = {}; const filteredYearlyUeByFuel = {}; const filteredYearlyUeByType = {}; const uniqueTypes = new Set();
        chartLabels.forEach(year => { /* ... (yearly aggregation logic unchanged) ... */ });

        const showFecChart = !(balanceSector === 'Power' || balanceSector === 'Energy industry');
        const showUeChart = !(balanceSector === 'Power' || balanceSector === 'Energy industry');

        // 4. Primary Energy (PED) Chart (Conditional Content)
        let pedDatasets = []; let pedYAxisTitle = 'Primary Energy (PED) (EJ)';
        if (balanceSector === 'Power') { /* ... */ }
        else if (balanceSector === 'Energy industry') { /* ... */ }
        else { /* ... */ }
        createChart('pedFuelChart', 'bar', { labels: chartLabels, datasets: pedDatasets }, { /* ... options ... */ });

        // 5. Final Energy (FEC) by Fuel (Filtered & Conditional Visibility)
        if (showFecChart) { /* ... (FEC chart logic unchanged) ... */ }
        else { if (chartInstances['fecFuelChart']) { chartInstances['fecFuelChart'].destroy(); delete chartInstances['fecFuelChart']; } }

        // 6. Useful Energy (UE) (Filtered, By Fuel or Type & Conditional Visibility)
        if (showUeChart) { /* ... (UE chart logic unchanged) ... */ }
        else { if (chartInstances['ueFuelChart']) { chartInstances['ueFuelChart'].destroy(); delete chartInstances['ueFuelChart']; } }
    } // End of balance charts section update


    // --- Energy Supply & Transformations Charts (Unaffected by filters, check visibility) ---
    const supplyChartsSection = document.getElementById('supplyChartsSection');
    if (supplyChartsSection && !supplyChartsSection.classList.contains('hidden')) {
        console.log("DEBUG (charting.js): Updating Supply Charts..."); // Log entry

        // 7. Power Generation
        const totalElectricityGenSeries = chartLabels.map(y => getValue(yearlyResults, [y, 'ecPostHydrogen', 'Electricity'], 0));
        const powerMixDataForChart = chartLabels.map(y => getValue(yearlyResults, [y, 'powerProdMix'], {})); // Get mix object per year
        // *** ADDED LOGS for Power Chart ***
        console.log("DEBUG (charting.js): Power Techs List:", powerTechs);
        console.log("DEBUG (charting.js): Total Elec Gen Series (First 5, GJ):", totalElectricityGenSeries.slice(0,5));
        console.log("DEBUG (charting.js): Power Mix for 2023:", powerMixDataForChart[0]);

        const powerMixDatasets = (powerTechs || []).map((tech, techIndex) => ({
            label: tech,
            data: chartLabels.map((y, yearIndex) => {
                const mixPercent = getValue(yearlyResults, [y, 'powerProdMix', tech], 0);
                const totalGen = totalElectricityGenSeries[yearIndex] || 0; // Handle potential missing year
                return ((mixPercent / 100) * totalGen) / GJ_PER_EJ;
            }),
            backgroundColor: getTechColor(tech, techIndex),
        })).filter(ds => ds.data.some(v => v > 1e-9)); // Filter out empty datasets

        console.log(`DEBUG (charting.js): Datasets for powerMixChart: ${powerMixDatasets.length} datasets`);
        if (powerMixDatasets.length > 0) {
             console.log("DEBUG (charting.js): First dataset (Power):", powerMixDatasets[0].label, powerMixDatasets[0].data.slice(0,5));
        }

        createChart('powerMixChart', 'bar', { labels: chartLabels, datasets: powerMixDatasets }, { plugins: { tooltip: { mode: 'index', callbacks: { label: ejTooltipCallback } } }, scales: { x: { stacked: true, title: { display: false } }, y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Power Generation (EJ)', font: {size: 12} } } } });

        // 8. Hydrogen Production
        const totalHydrogenProdSeries = chartLabels.map(y => getValue(yearlyResults, [y, 'fecByFuel', 'Hydrogen'], 0));
        const hydrogenMixDataForChart = chartLabels.map(y => getValue(yearlyResults, [y, 'hydrogenProdMix'], {}));
         // *** ADDED LOGS for Hydrogen Chart ***
        console.log("DEBUG (charting.js): Hydrogen Techs List:", hydrogenTechs);
        console.log("DEBUG (charting.js): Total H2 Prod Series (First 5, GJ):", totalHydrogenProdSeries.slice(0,5));
        console.log("DEBUG (charting.js): Hydrogen Mix for 2023:", hydrogenMixDataForChart[0]);

        const hydrogenMixDatasets = (hydrogenTechs || []).map((tech, techIndex) => ({
            label: tech,
            data: chartLabels.map((y, yearIndex) => {
                const mixPercent = getValue(yearlyResults, [y, 'hydrogenProdMix', tech], 0);
                const totalProd = totalHydrogenProdSeries[yearIndex] || 0;
                return ((mixPercent / 100) * totalProd) / GJ_PER_EJ;
            }),
            backgroundColor: getTechColor(tech, techIndex),
        })).filter(ds => ds.data.some(v => v > 1e-9));

        console.log(`DEBUG (charting.js): Datasets for hydrogenMixChart: ${hydrogenMixDatasets.length} datasets`);
         if (hydrogenMixDatasets.length > 0) {
              console.log("DEBUG (charting.js): First dataset (Hydrogen):", hydrogenMixDatasets[0].label, hydrogenMixDatasets[0].data.slice(0,5));
         }

        createChart('hydrogenMixChart', 'bar', { labels: chartLabels, datasets: hydrogenMixDatasets }, { plugins: { tooltip: { mode: 'index', callbacks: { label: ejTooltipCallback } } }, scales: { x: { stacked: true, title: { display: false } }, y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Hydrogen Production (EJ)', font: {size: 12} } } } });
    } else {
         // Clear supply charts if section is hidden
         ['powerMixChart', 'hydrogenMixChart'].forEach(id => { if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; } });
    }
}
