// js/charting.js

// We don't need to load Google Charts anymore. Plotly is loaded in index.html.

// State for chart types (default to 'bar' which is ColumnChart equivalent)
// Options: 'bar' (Stack), 'area' (Scatter with stackgroup), 'line' (Scatter)
const chartTypes = {};

// Color palette (same as before)
// Color palette (Semantic Grouping)
const techColors = {
    // Fossil Fuels (Dark/Earthy)
    'Coal': '#1f2937', // Gray 800
    'Oil': '#7f1d1d', // Red 900
    'Natural Gas': '#b45309', // Amber 700
    'Gas': '#b45309', // Amber 700 (Alias)

    // Electricity & Electrification (Blue/Teal)
    'Electricity': '#2563eb', // Blue 600
    'EV': '#3b82f6', // Blue 500
    'BEV': '#3b82f6', // Blue 500
    'Heat Pump': '#0ea5e9', // Sky 500
    'Electric Heater': '#0ea5e9', // Sky 500
    'Electric Stove': '#0ea5e9', // Sky 500
    'Arc Furnace': '#60a5fa', // Blue 400
    'Aluminum Smelting': '#60a5fa', // Blue 400
    'Lighting': '#fcd34d', // Amber 300 (Yellowish)
    'Cooling': '#06b6d4', // Cyan 500
    'Residential Cooling': '#06b6d4',
    'Commercial Cooling': '#06b6d4',
    'Appliances': '#818cf8', // Indigo 400
    'Residential Appliances': '#818cf8',
    'Commercial Appliances': '#818cf8',

    // Renewables (Green/Yellow/Cyan)
    'Solar': '#eab308', // Yellow 500
    'Solar PV': '#eab308',
    'Wind': '#06b6d4', // Cyan 500
    'Wind Onshore': '#06b6d4',
    'Wind Offshore': '#0891b2', // Cyan 600
    'Biomass': '#16a34a', // Green 600
    'Traditional Biomass': '#15803d', // Green 700
    'Hydro': '#1e40af', // Blue 800
    'Hydro Power': '#1e40af',
    'Geothermal': '#db2777', // Pink 600
    'Geothermal Power': '#db2777',
    'Other Renewables': '#14b8a6', // Teal 500

    // Nuclear (Violet)
    'Nuclear': '#7c3aed', // Violet 600
    'Nuclear Power': '#7c3aed',
    'SMR': '#8b5cf6', // Violet 500
    'SMR Nuclear': '#8b5cf6',
    'Uranium': '#7c3aed',

    // New Molecules (Purple/Pink)
    'Hydrogen': '#9333ea', // Purple 600
    'Hydrogen Power': '#9333ea',
    'Ammonia': '#c026d3', // Fuchsia 600
    'E-fuels': '#d946ef', // Fuchsia 500
    'FCEV': '#a855f7', // Purple 500
    'Electrolysis': '#2563eb', // Blue 600

    // Heat (Red/Orange)
    'District Heat': '#ef4444', // Red 500
    'Gas Boiler': '#f97316', // Orange 500
    'Oil Boiler': '#991b1b', // Red 800
    'Biomass Boiler': '#16a34a', // Green 600
    'Coal Stove': '#374151', // Gray 700
    'Biomass Stove': '#15803d', // Green 700
    'Gas Stove': '#f97316', // Orange 500

    // Transport Specifics (aligned with fuel)
    'ICE - Gasoline': '#991b1b', // Red 800
    'ICE - Diesel': '#7f1d1d', // Red 900
    'ICE - Gas': '#c2410c', // Orange 700
    'PHEV': '#10b981', // Emerald 500
    'Hybrid': '#84cc16', // Lime 500
    'Passenger Train': '#2563eb', // Electric Blue
    'Freight Train': '#1e40af', // Darker Blue
    'Bus': '#f59e0b', // Amber
    'Truck': '#78350f', // Brown
    'Ship': '#0e7490', // Cyan 700
    'Airplane': '#0ea5e9', // Sky 500

    // Industry Specifics
    'Blast Furnace': '#1f2937', // Coal
    'DRI': '#f97316', // Gas
    'Basic Oxygen Furnace': '#ef4444', // Red
    'Cement Kiln': '#57534e', // Stone Gray
    'Steam Cracker': '#f59e0b', // Gas
    'Methanol Synthesis': '#06b6d4', // Cyan
    'Ammonia Loop': '#c026d3', // Fuchsia
    'Alumina Refining': '#f472b6', // Pink
    'Aluminum Smelting': '#60a5fa', // Blue 400
    'Paper Machine': '#fcd34d', // Amber
    'Pulp Digester': '#fbbf24', // Amber
    'Food Processing': '#f87171', // Red 400
    'Textile Machinery': '#a78bfa', // Violet 400

    // CCS Variants (Darker/Desaturated)
    'Gas CCS': '#92400e', // Dark Amber
    'Coal CCS': '#111827', // Very Dark Gray
    'BECCS': '#14532d', // Dark Green
    'Gas Reforming': '#f59e0b', // Gas
    'Gas Reforming CCS': '#92400e', // Dark Amber
    'Coal Gasification': '#374151', // Gray
    'Coal Gasification CCS': '#111827', // Dark Gray
    'Biomass Gasification': '#16a34a', // Green
    'Biomass Gasification CCS': '#14532d', // Dark Green
    'Methane Pyrolysis': '#ea580c', // Orange 600

    // Storage
    'Battery Storage': '#4f46e5', // Indigo 600
    'Pumped Hydro': '#1e40af', // Blue 800

    // Sectors (for Sankey)
    'Buildings': '#64748b',
    'Industry': '#475569',
    'Transport': '#334155',
    'Power': '#2563eb',
    'Hydrogen Plants': '#9333ea',
    'Losses': '#e5e7eb'
};

function getTechColor(tech, index = 0) {
    if (techColors[tech]) return techColors[tech];

    // Partial match heuristics
    const lowerTech = tech.toLowerCase();
    if (lowerTech.includes('coal')) return techColors['Coal'];
    if (lowerTech.includes('oil')) return techColors['Oil'];
    if (lowerTech.includes('gas')) return techColors['Natural Gas'];
    if (lowerTech.includes('solar')) return techColors['Solar'];
    if (lowerTech.includes('wind')) return techColors['Wind'];
    if (lowerTech.includes('nuclear')) return techColors['Nuclear'];
    if (lowerTech.includes('hydro')) return techColors['Hydro'];
    if (lowerTech.includes('biomass')) return techColors['Biomass'];
    if (lowerTech.includes('electric') || lowerTech.includes('elec')) return techColors['Electricity'];
    if (lowerTech.includes('hydrogen') || lowerTech.includes('h2')) return techColors['Hydrogen'];

    const palette = [
        '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
        '#06b6d4', '#ec4899', '#f97316', '#6366f1', '#84cc16'
    ];
    return palette[index % palette.length];
}

// Expose for Sankey and other modules
window.getTechColor = getTechColor;

function getValue(obj, path, defaultValue) {
    let current = obj;
    for (let i = 0; i < path.length; i++) {
        if (current === undefined || current === null) return defaultValue;
        current = current[path[i]];
    }
    return current !== undefined ? current : defaultValue;
}

/**
 * Draws a Plotly Chart.
 */
function drawPlotlyChart(elementId, traces, title, vAxisTitle, isStacked = true) {
    const container = document.getElementById(elementId);
    if (!container) return;

    const layout = {
        title: {
            text: title,
            font: { size: 16, family: 'Poppins', weight: 'bold', color: '#1e293b' }
        },
        font: { family: 'Poppins' },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        xaxis: {
            title: { text: '' },
            tickangle: -45,
            automargin: true, // Fixes cutoff labels automatically
            gridcolor: '#f1f5f9'
        },
        yaxis: {
            title: { text: vAxisTitle, font: { weight: 'bold' } },
            gridcolor: '#e2e8f0',
            zerolinecolor: '#e2e8f0'
        },
        barmode: isStacked ? 'relative' : 'group', // 'relative' handles mixed positive/negative stacking correctly
        margin: { l: 60, r: 20, t: 40, b: 80 }, // Generous margins, but automargin helps too
        legend: {
            orientation: 'h', // Horizontal legend
            y: -0.3, // Move below chart
            x: 0.5,
            xanchor: 'center',
            font: { size: 12 }
        },
        hovermode: 'x unified' // Nice tooltip behavior
    };

    const config = {
        responsive: true,
        displayModeBar: false // Hide the toolbar for a cleaner look
    };

    Plotly.newPlot(elementId, traces, layout, config);
}

/**
 * Prepares data for Plotly traces.
 */
function preparePlotlyData(years, seriesKeys, valueGetter, type = 'bar') {
    const traces = [];

    seriesKeys.forEach((key, index) => {
        const xValues = [];
        const yValues = [];

        years.forEach(year => {
            xValues.push(year);
            yValues.push(valueGetter(year, key));
        });

        const trace = {
            x: xValues,
            y: yValues,
            name: key,
            type: type === 'area' ? 'scatter' : type, // 'area' is scatter with fill
            marker: { color: getTechColor(key, index) }
        };

        if (type === 'area') {
            trace.stackgroup = 'one'; // Enables stacking for area charts
            trace.fill = 'tonexty';
            trace.mode = 'none'; // No lines, just fill
        } else if (type === 'line') {
            trace.mode = 'lines';
            trace.line = { width: 3, color: getTechColor(key, index) };
        }

        traces.push(trace);
    });

    return traces;
}

function updateCharts(yearlyResults, chartConfigData) {
    if (!yearlyResults || Object.keys(yearlyResults).length === 0) return;
    if (!chartConfigData) return;

    try {
        const { years, endUseFuels, primaryFuels, powerTechs, hydrogenTechs, technologies, activityUnits } = chartConfigData;
        const GJ_PER_EJ = 1e9;

        // --- Subsector Charts ---
        const subsectorSelect = document.getElementById('selectSubsector');
        const selectedSubsectorKey = subsectorSelect ? subsectorSelect.value : null;

        if (selectedSubsectorKey) {
            const [selectedSector, selectedSubsector] = selectedSubsectorKey.split('|');
            const subsectorNameSpan = document.getElementById('selectedSubsectorName');
            if (subsectorNameSpan) subsectorNameSpan.textContent = `${selectedSector} - ${selectedSubsector}`;

            const subsectorTechs = getValue(technologies, [selectedSector, selectedSubsector], []);
            const activityUnit = getValue(activityUnits, [selectedSector, selectedSubsector], 'Units');

            // 1. Activity
            const activeTechs = subsectorTechs.filter(tech => {
                return years.some(y => Math.abs(getValue(yearlyResults, [y, 'demandTechActivity', selectedSector, selectedSubsector, tech], 0)) > 1e-3);
            });

            if (activeTechs.length > 0) {
                const traces = preparePlotlyData(years, activeTechs, (y, tech) =>
                    getValue(yearlyResults, [y, 'demandTechActivity', selectedSector, selectedSubsector, tech], 0),
                    'bar'
                );
                drawPlotlyChart('subsectorActivityChart', traces, '', `Activity (${activityUnit})`, true);
            } else {
                document.getElementById('subsectorActivityChart').innerHTML = '<div style="padding:20px; text-align:center; color:#666;">No activity data to display</div>';
            }

            // 2. FEC
            const activeFuelsFEC = endUseFuels.filter(fuel => {
                return years.some(y => {
                    let total = 0;
                    subsectorTechs.forEach(tech => total += getValue(yearlyResults, [y, 'fecDetailed', selectedSector, selectedSubsector, tech, fuel], 0));
                    return total > 1e-9;
                });
            });

            if (activeFuelsFEC.length > 0) {
                const traces = preparePlotlyData(years, activeFuelsFEC, (y, fuel) => {
                    let total = 0;
                    subsectorTechs.forEach(tech => total += getValue(yearlyResults, [y, 'fecDetailed', selectedSector, selectedSubsector, tech, fuel], 0));
                    return total / GJ_PER_EJ;
                }, 'bar');
                drawPlotlyChart('subsectorFecChart', traces, '', 'FEC (EJ)', true);
            } else {
                document.getElementById('subsectorFecChart').innerHTML = '<div style="padding:20px; text-align:center; color:#666;">No FEC data to display</div>';
            }

            // 3. UE
            const activeFuelsUE = endUseFuels.filter(fuel => {
                return years.some(y => {
                    let total = 0;
                    subsectorTechs.forEach(tech => total += getValue(yearlyResults, [y, 'ueDetailed', selectedSector, selectedSubsector, tech, fuel], 0));
                    return total > 1e-9;
                });
            });

            if (activeFuelsUE.length > 0) {
                const traces = preparePlotlyData(years, activeFuelsUE, (y, fuel) => {
                    let total = 0;
                    subsectorTechs.forEach(tech => total += getValue(yearlyResults, [y, 'ueDetailed', selectedSector, selectedSubsector, tech, fuel], 0));
                    return total / GJ_PER_EJ;
                }, 'bar');
                drawPlotlyChart('subsectorUeChart', traces, '', 'Useful Energy (EJ)', true);
            } else {
                document.getElementById('subsectorUeChart').innerHTML = '<div style="padding:20px; text-align:center; color:#666;">No Useful Energy data to display</div>';
            }
        }

        // --- Overall Energy Balance ---
        // 4. Total FEC
        const activeTotalFecFuels = endUseFuels.filter(fuel => years.some(y => getValue(yearlyResults, [y, 'fecByFuel', fuel], 0) > 1e-9));
        if (activeTotalFecFuels.length > 0) {
            const traces = preparePlotlyData(years, activeTotalFecFuels, (y, fuel) =>
                getValue(yearlyResults, [y, 'fecByFuel', fuel], 0) / GJ_PER_EJ,
                'bar'
            );
            drawPlotlyChart('fecFuelChart', traces, '', 'Total FEC (EJ)', true);
        }

        // 5. Total PED
        const activePedFuels = primaryFuels.filter(fuel => years.some(y => getValue(yearlyResults, [y, 'pedByFuel', fuel], 0) > 1e-9));
        if (activePedFuels.length > 0) {
            const traces = preparePlotlyData(years, activePedFuels, (y, fuel) =>
                getValue(yearlyResults, [y, 'pedByFuel', fuel], 0) / GJ_PER_EJ,
                'bar'
            );
            drawPlotlyChart('pedFuelChart', traces, '', 'Total PED (EJ)', true);
        }

        // 6. Total UE
        const activeUeFuels = endUseFuels.filter(fuel => years.some(y => getValue(yearlyResults, [y, 'ueByFuel', fuel], 0) > 1e-9));
        if (activeUeFuels.length > 0) {
            const traces = preparePlotlyData(years, activeUeFuels, (y, fuel) =>
                getValue(yearlyResults, [y, 'ueByFuel', fuel], 0) / GJ_PER_EJ,
                'bar'
            );
            drawPlotlyChart('ueFuelChart', traces, '', 'Total Useful Energy (EJ)', true);
        }

        // --- Supply ---
        // 7. Power Mix
        const activePowerTechs = powerTechs.filter(tech => years.some(y => getValue(yearlyResults, [y, 'powerProdMix', tech], 0) > 0));
        if (activePowerTechs.length > 0) {
            const traces = preparePlotlyData(years, activePowerTechs, (y, tech) => {
                const totalElec = getValue(yearlyResults, [y, 'ecPostHydrogen', 'Electricity'], 0);
                const mix = getValue(yearlyResults, [y, 'powerProdMix', tech], 0);
                return ((mix / 100) * totalElec) / GJ_PER_EJ;
            }, 'bar');
            drawPlotlyChart('powerMixChart', traces, '', 'Power Generation (EJ)', true);
        }

        // 8. Hydrogen Mix
        const activeH2Techs = hydrogenTechs.filter(tech => years.some(y => getValue(yearlyResults, [y, 'hydrogenProdMix', tech], 0) > 0));
        if (activeH2Techs.length > 0) {
            const traces = preparePlotlyData(years, activeH2Techs, (y, tech) => {
                const totalH2 = getValue(yearlyResults, [y, 'ecPostHydrogen', 'Hydrogen'], 0);
                const mix = getValue(yearlyResults, [y, 'hydrogenProdMix', tech], 0);
                return ((mix / 100) * totalH2) / GJ_PER_EJ;
            }, 'bar');
            drawPlotlyChart('hydrogenMixChart', traces, '', 'Hydrogen Production (EJ)', true);
        }

    } catch (error) {
        console.error("Error in updateCharts:", error);
    }
}

function updateDeltaCharts(yearlyResults, chartConfigData) {
    if (!yearlyResults || Object.keys(yearlyResults).length === 0) return;
    if (!chartConfigData) return;

    const { years, endUseFuels, primaryFuels, powerTechs } = chartConfigData;
    const GJ_PER_EJ = 1e9;
    const deltaLabels = years.slice(1);

    const getDelta = (y, getter) => {
        const idx = years.indexOf(y);
        if (idx <= 0) return 0;
        const prevYear = years[idx - 1];
        return getter(y) - getter(prevYear);
    };

    // 1. PED Delta
    const activePedFuels = primaryFuels.filter(fuel => years.some(y => Math.abs(getValue(yearlyResults, [y, 'pedByFuel', fuel], 0)) > 1e-9));
    if (activePedFuels.length > 0) {
        const traces = preparePlotlyData(deltaLabels, activePedFuels, (y, fuel) =>
            getDelta(y, (yr) => getValue(yearlyResults, [yr, 'pedByFuel', fuel], 0) / GJ_PER_EJ),
            'bar'
        );
        drawPlotlyChart('pedDeltaChart', traces, '', 'Delta PED (EJ)', true);
    }

    // 2. Elec Gen Delta
    const activePowerTechs = powerTechs.filter(tech => years.some(y => getValue(yearlyResults, [y, 'powerProdMix', tech], 0) > 0));
    if (activePowerTechs.length > 0) {
        const traces = preparePlotlyData(deltaLabels, activePowerTechs, (y, tech) =>
            getDelta(y, (yr) => {
                const total = getValue(yearlyResults, [yr, 'ecPostHydrogen', 'Electricity'], 0);
                const mix = getValue(yearlyResults, [yr, 'powerProdMix', tech], 0);
                return ((mix / 100) * total) / GJ_PER_EJ;
            }),
            'bar'
        );
        drawPlotlyChart('elecGenDeltaChart', traces, '', 'Delta Elec Gen (EJ)', true);
    }

    // 3. FEC Delta
    const activeFecFuels = endUseFuels.filter(fuel => years.some(y => Math.abs(getValue(yearlyResults, [y, 'fecByFuel', fuel], 0)) > 1e-9));
    if (activeFecFuels.length > 0) {
        const traces = preparePlotlyData(deltaLabels, activeFecFuels, (y, fuel) =>
            getDelta(y, (yr) => getValue(yearlyResults, [yr, 'fecByFuel', fuel], 0) / GJ_PER_EJ),
            'bar'
        );
        drawPlotlyChart('fecDeltaChart', traces, '', 'Delta FEC (EJ)', true);
    }

    // 4. UE Delta
    const activeUeFuels = endUseFuels.filter(fuel => years.some(y => Math.abs(getValue(yearlyResults, [y, 'ueByFuel', fuel], 0)) > 1e-9));
    if (activeUeFuels.length > 0) {
        const traces = preparePlotlyData(deltaLabels, activeUeFuels, (y, fuel) =>
            getDelta(y, (yr) => getValue(yearlyResults, [yr, 'ueByFuel', fuel], 0) / GJ_PER_EJ),
            'bar'
        );
        drawPlotlyChart('ueDeltaChart', traces, '', 'Delta UE (EJ)', true);
    }
}

window.updateCharts = updateCharts;
window.updateDeltaCharts = updateDeltaCharts;
window.chartTypes = chartTypes;
