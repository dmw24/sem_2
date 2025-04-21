// js/charting.js
// Version: Complete - Filters, Conditional PED, UE Types, Sankey Chart

// --- Chart Instances Storage ---
const chartInstances = {}; // Stores Chart.js instances
// Note: D3 Sankey doesn't use instances in the same way, selection is managed directly.

// --- Color Palette & Mapping ---
const emberColors = { green_ember: '#13CE74', green_pine: '#06371F', green_forest: '#0B6638', green_grass: '#0F9A56', green_mint: '#89E7BA', blue_navy: '#204172', blue_azure: '#1E6DA9', blue_sky: '#37A6E6', blue_arctic: '#C4D9E9', fossil_fire: '#E04B00', fossil_clay: '#891B05', fossil_rust: '#BF3100', fossil_tangerine: '#EE7309', fossil_sunrise: '#FCA311', grey_smoke: '#999999', grey_fog: '#F7F7F7', grey_dark: '#718096', black: '#000000' };
const techColorMapping = { 'Solar PV': emberColors.green_ember, 'Wind': emberColors.green_grass, 'Hydro': emberColors.blue_sky, 'Nuclear power': emberColors.blue_azure, 'Biomass power': emberColors.green_forest, 'Gas power': emberColors.fossil_tangerine, 'Coal power': emberColors.fossil_clay, 'Oil power': emberColors.fossil_rust, 'Other power': emberColors.grey_smoke, 'Green': emberColors.green_ember, 'Blue': emberColors.blue_sky, 'Electricity': emberColors.blue_sky, 'Oil': emberColors.fossil_rust, 'Hydrogen': '#8b5cf6', 'Coal': emberColors.fossil_clay, 'Gas': emberColors.fossil_tangerine, 'Biomass': emberColors.green_forest, 'Solar': emberColors.fossil_sunrise, 'Uranium': emberColors.blue_azure, 'EV': emberColors.blue_sky, 'ICE': emberColors.fossil_rust, 'Ammonia ship': '#8b5cf6', 'Electric ship': emberColors.blue_sky, 'Conventional ship': emberColors.fossil_rust, 'Electric plane': emberColors.blue_sky, 'Conventional plane': emberColors.fossil_rust, 'Electric train': emberColors.blue_sky, 'Diesel train': emberColors.fossil_rust, 'BF-BOF': emberColors.fossil_clay, 'EAF': emberColors.blue_sky, 'DRI-EAF (H2)': '#8b5cf6', 'Conventional kiln': emberColors.fossil_clay, 'Electric kiln': emberColors.blue_sky, 'Conventional': emberColors.fossil_tangerine, 'Electrified': emberColors.blue_sky, 'Fossil boiler': emberColors.fossil_tangerine, 'Biomass boiler': emberColors.green_forest, 'Heat pump': emberColors.green_ember, 'Fossil furnace': emberColors.fossil_tangerine, 'Biomass furnace': emberColors.green_forest, 'Electric furnace': emberColors.blue_sky, 'Biomass heating': emberColors.green_forest, 'Electric heating': emberColors.blue_sky, 'Conventional fossil': emberColors.fossil_tangerine, 'Biomass cooking': emberColors.green_forest, 'Full LED': emberColors.green_ember, 'Low efficiency airco': emberColors.grey_smoke, 'High efficiency airco': emberColors.blue_sky, '_DEFAULT': emberColors.grey_smoke };
const ueTypeColorMapping = { 'Heating': emberColors.fossil_fire, 'Cooling': emberColors.blue_sky, 'Lighting': emberColors.fossil_sunrise, 'Motive Power': emberColors.ember_grass, 'Feedstock': emberColors.blue_navy, 'Other': emberColors.grey_smoke, 'Unknown': emberColors.grey_dark };

// Color helper functions
function getTechColor(techName, index = 0) { return techColorMapping[techName] || emberColors[techName.toLowerCase().replace(/ /g, '_')] || techColorMapping['_DEFAULT']; }
function getUeTypeColor(typeName, index = 0) { return ueTypeColorMapping[typeName] || getTechColor(typeName, index + Object.keys(emberColors).length); } // Offset index further
// Simple distinct color generator for Sankey nodes if needed
const sankeyColorScale = d3.scaleOrdinal(d3.schemeCategory10); // Using a standard D3 categorical scale


// --- getValue Helper ---
/**
 * Safely gets a nested value from an object using an array of keys.
 * @param {object} obj - The source object.
 * @param {string[]} keys - An array of keys representing the path.
 * @param {*} defaultValue - The value to return if the path is not found or value is null/undefined.
 * @returns {*} The value found at the path or the default value.
 */
function getValue(obj, keys, defaultValue = 0) {
    let current = obj;
    for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
            current = current[key];
        } else {
            return defaultValue;
        }
    }
    return (current === null || current === undefined) ? defaultValue : current;
}


// --- Chart Creation Helper (Chart.js) ---
/**
 * Creates or updates a Chart.js chart instance.
 * Skips creation if the canvas or its parent section is hidden.
 * @param {string} canvasId - The ID of the canvas element.
 * @param {string} type - The type of chart (e.g., 'bar', 'line').
 * @param {object} data - The Chart.js data object { labels, datasets }.
 * @param {object} options - The Chart.js options object.
 * @returns {Chart|null} The Chart.js instance or null if not created.
 */
function createChart(canvasId, type, data, options = {}) {
    // console.log(`DEBUG createChart: Attempting to create chart for canvasId: ${canvasId}`); // DEBUG
    const canvas = document.getElementById(canvasId); if (!canvas) { console.error(`Canvas element with id "${canvasId}" not found.`); return null; }

    // Check if the canvas's parent chart box OR section is hidden
    const chartBox = canvas.closest('.chart-box');
    const parentSection = canvas.closest('section');
    if ((chartBox && chartBox.classList.contains('hidden')) || (parentSection && parentSection.classList.contains('hidden'))) {
        // console.log(`Skipping chart creation for hidden canvas: ${canvasId}`); // DEBUG
        if (chartInstances[canvasId]) { // Destroy any previous instance if now hidden
             chartInstances[canvasId].destroy();
             delete chartInstances[canvasId];
        }
        return null; // Don't create chart if hidden
    }

    const ctx = canvas.getContext('2d'); if (!ctx) { console.error(`Could not get 2D context for canvas "${canvasId}".`); return null; }

    // Destroy existing chart instance on the canvas if it exists
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
        delete chartInstances[canvasId]; // Remove reference
    }

    // Define default Chart.js options
    const defaultOptions = {
        responsive: true,
        maintainAspectRatio: false, // Crucial for respecting CSS height
        animation: { duration: 400 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 15, padding: 10, usePointStyle: true } },
            title: { display: false },
            tooltip: { bodyFont: { size: 12 }, titleFont: { size: 13, weight: 'bold'}, boxPadding: 4 }
        }, // Added missing comma here
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 } } },
            y: { beginAtZero: true, grid: { color: '#e0e0e0', borderDash: [2, 3] }, ticks: { font: { size: 11 } } }
        }
    };

    // Deep merge default and custom options (simple merge shown)
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

    // Create the new chart
    try {
        const chart = new Chart(ctx, { type, data, options: chartOptions });
        chartInstances[canvasId] = chart; // Store the new instance
        return chart;
    } catch (error) {
        console.error(`Error creating chart "${canvasId}":`, error);
        return null;
    }
};


// --- SANKEY CHART CREATION (D3.js) ---
/**
 * Creates/updates the Sankey diagram using D3.js.
 * @param {number} selectedYear - The year to display data for.
 * @param {object} yearlyResults - Full results object.
 * @param {object} chartConfigData - Config data object.
 */
function createSankeyChart(selectedYear, yearlyResults, chartConfigData) {
    const containerId = 'sankeyChartContainer';
    const container = d3.select(`#${containerId}`); // Use D3 to select
    if (container.empty()) { console.error(`Sankey container #${containerId} not found.`); return; }
    container.selectAll("*").remove(); // Clear previous SVG content

    const yearData = yearlyResults[selectedYear];
    const { primaryFuels, endUseFuels, sectors, subsectors, technologies, dataTypeLookup } = chartConfigData;
    const endUseSectors = sectors.filter(s => s !== 'Power' && s !== 'Energy industry');

    if (!yearData) { container.append('p').style('padding', '20px').text(`No data available for year ${selectedYear}.`); return; }
    console.log(`DEBUG (Sankey): Creating Sankey for year ${selectedYear}`);

    // --- 1. Prepare Nodes and Links ---
    const nodes = [];
    const links = [];
    const nodeMap = new Map(); // Helper to get node index by name
    let nodeIndex = 0;
    const GJ_PER_EJ = 1e9;
    const MIN_FLOW_THRESHOLD_GJ = 0.001 * GJ_PER_EJ; // Minimum flow in GJ to display (e.g., 0.001 EJ)

    // Helper to add unique nodes
    const addNode = (name, category = 'default') => {
        if (!nodeMap.has(name)) {
            nodes.push({ name: name, category: category });
            nodeMap.set(name, nodeIndex++);
        }
        return nodeMap.get(name);
    };

    // --- Node Categories & Definitions ---
    const NODE_CAT = { PED: 'PED', ELEC_GEN: 'Electricity', H2_PROD: 'Hydrogen', REFINING: 'Refining', FEC_SECTOR: 'End Use Sector', UE_TYPE: 'Useful Energy', LOSS_TRANSFORM: 'Losses', LOSS_ENDUSE: 'Losses' };
    const intermediateFuelNodes = {}; // Store indices for intermediate fuels

    // Primary Energy Nodes
    primaryFuels.forEach(p => addNode(p, NODE_CAT.PED));
    // Intermediate Fuel Nodes (Outputs of Transformations)
    intermediateFuelNodes['Electricity'] = addNode('Electricity', NODE_CAT.ELEC_GEN);
    intermediateFuelNodes['Hydrogen'] = addNode('Hydrogen', NODE_CAT.H2_PROD);
    Object.keys(getValue(yearData, ['otherTransformOutputs'], {})).forEach(f_refined => {
        intermediateFuelNodes[f_refined] = addNode(`Refined ${f_refined}`, NODE_CAT.REFINING);
    });
    // End Use Sector Nodes
    endUseSectors.forEach(s => addNode(s, NODE_CAT.FEC_SECTOR));
    // Useful Energy Type Nodes
    const ueTypes = Object.keys(getValue(yearData, ['ueByType'], {}));
    ueTypes.forEach(type => addNode(type, NODE_CAT.UE_TYPE));
    // Loss Nodes (simplified)
    const transformLossNode = addNode('Transformation Losses', NODE_CAT.LOSS_TRANSFORM);
    const endUseLossNode = addNode('End Use Losses', NODE_CAT.LOSS_ENDUSE);

    // --- Define Links ---
    let totalTransformationInputGJ = 0;
    let totalIntermediateOutputGJ = 0;
    let totalFecGJ = 0;
    let totalUeGJ = 0;

    // 1. PED to Intermediate Fuels + Direct End Use Primary
    primaryFuels.forEach(p => {
        const pedSourceIndex = nodeMap.get(p);
        // To Electricity
        const toElec = getValue(yearData, ['powerPrimaryInputsByFuel', p], 0);
        if (toElec > MIN_FLOW_THRESHOLD_GJ) { links.push({ source: pedSourceIndex, target: intermediateFuelNodes['Electricity'], value: toElec }); totalTransformationInputGJ += toElec; }
        // To Hydrogen
        const toH2 = getValue(yearData, ['hydrogenPrimaryInputsByFuel', p], 0);
        if (toH2 > MIN_FLOW_THRESHOLD_GJ) { links.push({ source: pedSourceIndex, target: intermediateFuelNodes['Hydrogen'], value: toH2 }); totalTransformationInputGJ += toH2; }
        // To Other Refining
        Object.keys(intermediateFuelNodes).filter(f => f !== 'Electricity' && f !== 'Hydrogen').forEach(f_refined_key => {
            const f_refined = f_refined_key.replace('Refined ', '');
            const toRefined = getValue(yearData, ['otherPrimaryInputsByRefinedFuel', f_refined, p], 0);
            if (toRefined > MIN_FLOW_THRESHOLD_GJ) { links.push({ source: pedSourceIndex, target: intermediateFuelNodes[f_refined_key], value: toRefined }); totalTransformationInputGJ += toRefined; }
        });
        // Direct to End Use Sectors
        let directPrimaryToSector = 0;
        endUseSectors.forEach(s => {
             let val = getValue(yearData, ['fecByEndUse', s, 'all', p], 0); // Need FEC aggregated by sector/fuel
             // Temp fix: sum subsectors if fecByEndUse structure is [s][b][f]
             let directToSector = 0;
             (subsectors[s] || []).forEach(b => { directToSector += getValue(yearData, ['fecByEndUse', s, b, p], 0); });
             val = directToSector;

             if (val > MIN_FLOW_THRESHOLD_GJ) {
                 links.push({ source: pedSourceIndex, target: nodeMap.get(s), value: val });
                 totalFecGJ += val; // Add direct primary use to FEC total
             }
             directPrimaryToSector += val;
        });
    });

    // 2. Intermediate Inputs to Hydrogen (e.g., Elec for Green H2)
    const h2Inputs = getValue(yearData, ['hydrogenPrimaryInputsByFuel'], {});
    if (h2Inputs['Electricity'] > MIN_FLOW_THRESHOLD_GJ) { links.push({ source: intermediateFuelNodes['Electricity'], target: intermediateFuelNodes['Hydrogen'], value: h2Inputs['Electricity'] }); totalTransformationInputGJ += h2Inputs['Electricity']; }
    // Add other intermediate inputs if necessary

    // 3. Intermediate Fuels to End Use Sectors
    Object.keys(intermediateFuelNodes).forEach(fuelKey => {
        const sourceNodeIndex = intermediateFuelNodes[fuelKey];
        const fuelName = (fuelKey === 'Electricity' || fuelKey === 'Hydrogen') ? fuelKey : fuelKey.replace('Refined ', ''); // Get original fuel name
        let fuelOutputTotal = 0;
        endUseSectors.forEach(s => {
            let fuelToSector = 0;
            (subsectors[s] || []).forEach(b => { fuelToSector += getValue(yearData, ['fecByEndUse', s, b, fuelName], 0); });
            if (fuelToSector > MIN_FLOW_THRESHOLD_GJ) {
                links.push({ source: sourceNodeIndex, target: nodeMap.get(s), value: fuelToSector });
                totalFecGJ += fuelToSector; // Add intermediate use to FEC total
            }
            fuelOutputTotal += fuelToSector; // Sum up where the intermediate fuel went
        });
        totalIntermediateOutputGJ += fuelOutputTotal; // Sum total intermediate outputs used by end-use
    });

    // 4. End Use Sectors to Useful Energy Types & Losses
    endUseSectors.forEach(s => {
        const sectorNodeIndex = nodeMap.get(s);
        const sectorTotalUe = getValue(yearData, ['ueByEndUseSector', s], 0);
        let sectorTotalFec = 0;
        endUseFuels.forEach(f => { (subsectors[s] || []).forEach(b => { sectorTotalFec += getValue(yearData, ['fecByEndUse', s, b, f], 0); }); });
        primaryFuels.forEach(p => { (subsectors[s] || []).forEach(b => { sectorTotalFec += getValue(yearData, ['fecByEndUse', s, b, p], 0); }); }); // Include direct primary use in sector FEC

        // Link Sector -> UE Types
        // Need UE aggregated by type *within* this sector. Let's approximate for now.
        // A simpler Sankey might go Intermediate Fuel -> UE Type + Losses
        // For now, link total Sector UE to individual UE types proportionally?
        const sectorUeByType = {}; // Recalculate UE by type just for this sector
        (subsectors[s] || []).forEach(b => {
             (technologies[s]?.[b] || []).forEach(t => {
                 (endUseFuels || []).forEach(f => {
                     const ueValue = getValue(yearData, ['ueDetailed', s, b, t, f], 0);
                     if(ueValue > 0){
                         const type = getValue(dataTypeLookup, [s, b, t, f], 'Unknown');
                         sectorUeByType[type] = (sectorUeByType[type] || 0) + ueValue;
                     }
                 });
             });
        });
        Object.entries(sectorUeByType).forEach(([type, ueValue]) => {
            if (ueValue > MIN_FLOW_THRESHOLD_GJ) {
                links.push({ source: sectorNodeIndex, target: nodeMap.get(type), value: ueValue });
            }
        });
        totalUeGJ += sectorTotalUe; // Sum total UE

        // Link to End Use Losses
        const endUseLoss = sectorTotalFec - sectorTotalUe;
        if (endUseLoss > MIN_FLOW_THRESHOLD_GJ) {
            links.push({ source: sectorNodeIndex, target: endUseLossNode, value: endUseLoss });
        }
    });

     // 5. Transformation Losses (Approximate)
     const transformationLoss = totalTransformationInputGJ - totalIntermediateOutputGJ;
     if (transformationLoss > MIN_FLOW_THRESHOLD_GJ) {
         // Distribute loss back to input nodes proportionally? Simpler: just link intermediates to loss.
         Object.keys(intermediateFuelNodes).forEach(fuelKey => {
             const sourceNodeIndex = intermediateFuelNodes[fuelKey];
             // Approximate loss based on output share - very rough
             const output = getValue(yearData, [`total${fuelKey}Output`], 0) || totalIntermediateSupply[fuelKey] || 0; // Get output if stored
             const proportionalLoss = transformationLoss * safeDivide(output, totalIntermediateOutputGJ);
             if (proportionalLoss > MIN_FLOW_THRESHOLD_GJ) {
                 links.push({ source: sourceNodeIndex, target: transformLossNode, value: proportionalLoss });
             }
         });
     }

    // --- Filter tiny links ---
    const finalLinks = links.filter(link => link.value > MIN_FLOW_THRESHOLD_GJ);
    if (finalLinks.length === 0) { container.append('p').style('padding', '20px').text(`No significant energy flows found for ${selectedYear}.`); return; }

    // --- Setup D3 Sankey Layout ---
    const containerWidth = container.node().getBoundingClientRect().width;
    const containerHeight = container.node().getBoundingClientRect().height;
    const margin = {top: 20, right: 150, bottom: 20, left: 150};
    const width = Math.max(500, containerWidth - margin.left - margin.right); // Ensure min width
    const height = Math.max(400, containerHeight - margin.top - margin.bottom); // Ensure min height

    const svg = container.append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
      .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const sankey = d3.sankey()
        .nodeId(d => d.name)
        .nodeAlign(d3.sankeyLeft) // Align nodes to left
        .nodeWidth(15)
        .nodePadding(10)
        .extent([[1, 1], [width - 1, height - 1]]);

    // Compute the Sankey layout
    let graph;
    try {
         graph = sankey({
             nodes: nodes.map(d => Object.assign({}, d)), // Create copies
             links: finalLinks.map(d => Object.assign({}, d)) // Create copies
         });
    } catch (error) {
        console.error("Error computing Sankey layout:", error);
        container.append('p').style('padding', '20px').text(`Error computing Sankey layout for ${selectedYear}. Check console.`);
        return;
    }


    // --- Draw Links ---
    svg.append("g")
        .attr("fill", "none")
        .attr("stroke-opacity", 0.4)
      .selectAll("path") // Use path directly
      .data(graph.links)
      .join("path")
        .attr("class", "sankey-link")
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke", d => sankeyColorScale(d.source.category)) // Color link by source category
        .attr("stroke-width", d => Math.max(1, d.width))
      .append("title") // Tooltip for links
        .text(d => `${d.source.name} → ${d.target.name}\n${(d.value / GJ_PER_EJ).toFixed(3)} EJ`);

    // --- Draw Nodes ---
    const node = svg.append("g")
        .attr("stroke", "#000")
        .attr("stroke-width", 0.5)
      .selectAll("rect")
      .data(graph.nodes)
      .join("rect")
       .attr("class", "sankey-node")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("height", d => Math.max(0.5, d.y1 - d.y0)) // Ensure min height > 0
        .attr("width", d => d.x1 - d.x0)
        .attr("fill", d => sankeyColorScale(d.category)); // Color node by category

    node.append("title") // Tooltip for nodes
        .text(d => `${d.name}\n${(d.value / GJ_PER_EJ).toFixed(3)} EJ`);

    // --- Add Labels ---
    svg.append("g")
        .attr("font-family", "sans-serif")
        .attr("font-size", 10)
        .attr("fill", "#000") // Ensure text is visible
      .selectAll("text")
      .data(graph.nodes)
      .join("text")
        .attr("x", d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6) // Position labels left/right
        .attr("y", d => (d.y1 + d.y0) / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end") // Anchor text start/end
        .text(d => d.name)
        .append("tspan") // Add value tspan
            .attr("fill-opacity", 0.7)
            .attr("dx", "0.2em") // Add small space before value
            .text(d => `(${(d.value / GJ_PER_EJ).toFixed(1)} EJ)`);

}


// --- Main Chart Update Function ---
/**
 * Updates all charts based on model results, config, and filters.
 */
function updateCharts(yearlyResults, chartConfigData, filters = {}) {
    if (!yearlyResults || !chartConfigData) { console.error("Missing data for chart update."); return; }
    const { years: chartLabels, /* ... other config ... */ } = chartConfigData;
    const { balanceSector = 'all', balanceSubsector = 'all', ueDisplayMode = 'fuel', sankeyYear = null } = filters;
    if (!chartLabels || !Array.isArray(chartLabels) || chartLabels.length === 0) { console.error("Years array missing."); return; }

    // --- Update charts based on selected VIEW ---
    const chartViewSelect = document.getElementById('selectChartView');
    const selectedView = chartViewSelect ? chartViewSelect.value : 'subsector';

    // --- Subsector Charts ---
    const subsectorChartsSection = document.getElementById('subsectorChartsSection');
    if (selectedView === 'subsector' && subsectorChartsSection && !subsectorChartsSection.classList.contains('hidden')) {
        // ... (Subsector chart logic) ...
    }

    // --- Overall Energy Balance Charts ---
    const balanceChartsSection = document.getElementById('balanceChartsSection');
    if (selectedView === 'balance' && balanceChartsSection && !balanceChartsSection.classList.contains('hidden')) {
        // ... (Balance chart logic with filtering) ...
    }

    // --- Energy Supply & Transformations Charts ---
    const supplyChartsSection = document.getElementById('supplyChartsSection');
    if (selectedView === 'supply' && supplyChartsSection && !supplyChartsSection.classList.contains('hidden')) {
        // ... (Supply chart logic) ...
    }

    // --- Sankey Diagram ---
    const sankeyChartSection = document.getElementById('sankeyChartSection');
    if (selectedView === 'sankey' && sankeyChartSection && !sankeyChartSection.classList.contains('hidden')) {
         if (sankeyYear && yearlyResults[sankeyYear]) {
             console.log(`DEBUG (charting.js): Calling createSankeyChart for year ${sankeyYear}`);
             createSankeyChart(sankeyYear, yearlyResults, chartConfigData);
         } else {
             console.warn(`Sankey view selected, but year ${sankeyYear} or its data is invalid.`);
             const container = d3.select('#sankeyChartContainer'); container.selectAll("*").remove(); container.append('p').style('padding', '20px').text(`Please select a valid year.`);
         }
    } else {
         // Clear Sankey if view is changed away from it
         const container = d3.select('#sankeyChartContainer'); container.selectAll("*").remove();
    }
}
