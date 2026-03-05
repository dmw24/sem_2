// js/charting.js

// High-end chart rendering uses Apache ECharts (loaded in index.html).

// State for chart types
// Options: 'bar' (stacked bars), 'area' (stacked area), 'line' (line)
const chartTypes = {};
const chartInstances = {};
const legendSelectionState = {};

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
    'District heat': '#ef4444', // Alias used in fuel tables
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
    'BF-BOF + CCS': '#111827', // Dark Gray (Coal-like)
    'Conventional + CCS': '#374151', // Gray 700
    'Furnace + CCS': '#78350f', // Dark Brown
    'District heating': '#ef4444', // Red 500 (Matches District Heat fuel)

    // Storage
    'Battery Storage': '#4f46e5', // Indigo 600
    'Pumped Hydro': '#1e40af', // Blue 800

    // Sectors (for Sankey) - Distinct colors
    'Buildings': '#f59e0b', // Amber 500 (warm orange)
    'Industry': '#3b82f6', // Blue 500 (bright blue)
    'Transport': '#10b981', // Emerald 500 (green)
    'Power': '#2563eb', // Blue 600
    'Hydrogen Plants': '#9333ea', // Purple 600
    'Losses': '#e5e7eb' // Gray 200
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
        '#13ce74', '#0f9a56', '#3a7d65', '#f59e0b', '#0ea5e9',
        '#2b6cb0', '#d97706', '#16a34a', '#0d9488', '#84cc16'
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

function getOrCreateChartInstance(elementId) {
    if (typeof echarts === 'undefined') return null;
    const container = document.getElementById(elementId);
    if (!container) return null;

    let chart = echarts.getInstanceByDom(container);
    if (!chart) {
        chart = echarts.init(container, null, { renderer: 'canvas' });
    }

    chartInstances[elementId] = chart;

    if (!chart.__legendListenerAttached) {
        chart.on('legendselectchanged', (event) => {
            legendSelectionState[elementId] = { ...event.selected };
        });
        chart.__legendListenerAttached = true;
    }

    return chart;
}

function disposeChartInstance(elementId) {
    if (typeof echarts === 'undefined') return;
    const container = document.getElementById(elementId);
    if (!container) return;
    const chart = echarts.getInstanceByDom(container);
    if (chart && !chart.isDisposed()) {
        chart.dispose();
    }
    delete chartInstances[elementId];
}

function showChartMessage(elementId, message) {
    disposeChartInstance(elementId);
    const container = document.getElementById(elementId);
    if (!container) return;
    container.innerHTML = `<div style="padding:20px; text-align:center; color:#3f5f54;">${message}</div>`;
}

function resizeEnergyCharts(ids) {
    if (typeof echarts === 'undefined') return;
    const targetIds = Array.isArray(ids) && ids.length > 0 ? ids : Object.keys(chartInstances);
    targetIds.forEach((id) => {
        const container = document.getElementById(id);
        if (!container) return;
        const chart = echarts.getInstanceByDom(container) || chartInstances[id];
        if (chart && !chart.isDisposed()) {
            chart.resize();
        }
    });
}

window.resizeEnergyCharts = resizeEnergyCharts;
if (!window.__energyChartsWindowResizeBound) {
    window.addEventListener('resize', () => resizeEnergyCharts());
    window.__energyChartsWindowResizeBound = true;
}

/**
 * Draws charts with ECharts. Kept as drawPlotlyChart to avoid touching all call-sites.
 */
function drawPlotlyChart(elementId, traces, title, vAxisTitle, isStacked = true) {
    const chart = getOrCreateChartInstance(elementId);
    if (!chart) return;

    const safeTraces = Array.isArray(traces) ? traces : [];
    const xCategories = safeTraces.length > 0 && Array.isArray(safeTraces[0].x)
        ? safeTraces[0].x.map((x) => String(x))
        : [];
    const categoryIndex = new Map(xCategories.map((x, idx) => [x, idx]));

    const selectedMap = { ...(legendSelectionState[elementId] || {}) };

    const series = safeTraces.map((trace, index) => {
        const traceName = trace.name || `Series ${index + 1}`;
        if (selectedMap[traceName] === undefined) {
            selectedMap[traceName] = trace.visible !== false && trace.visible !== 'legendonly';
        }

        const data = new Array(xCategories.length).fill(0);
        if (Array.isArray(trace.x) && Array.isArray(trace.y)) {
            trace.x.forEach((xVal, i) => {
                const idx = categoryIndex.get(String(xVal));
                if (idx !== undefined) data[idx] = trace.y[i];
            });
        } else if (Array.isArray(trace.y)) {
            trace.y.forEach((value, i) => {
                if (i < data.length) data[i] = value;
            });
        }

        const hasStackGroup = Boolean(trace.stackgroup);
        const isArea = trace.fill === 'tonexty' || hasStackGroup;
        const isLine = trace.type === 'line' || trace.type === 'scatter' || isArea;
        const baseColor = trace.marker?.color || trace.line?.color || getTechColor(traceName, index);

        if (isLine) {
            return {
                name: traceName,
                type: 'line',
                smooth: true,
                symbol: 'none',
                stack: hasStackGroup ? 'area-stack' : undefined,
                lineStyle: {
                    width: trace.line?.width || 2.5,
                    color: baseColor
                },
                areaStyle: isArea ? { opacity: 0.2, color: baseColor } : undefined,
                itemStyle: { color: baseColor },
                emphasis: { focus: 'series' },
                data
            };
        }

        return {
            name: traceName,
            type: 'bar',
            stack: isStacked ? 'bar-stack' : undefined,
            barMaxWidth: 28,
            itemStyle: {
                color: baseColor,
                borderRadius: 0
            },
            emphasis: { focus: 'series' },
            data
        };
    });

    const hasMainTitle = Boolean(title);
    const hasMetricLabel = Boolean(vAxisTitle);
    const topPadding = hasMetricLabel ? 58 : (hasMainTitle ? 42 : 24);
    const hasBarSeries = series.some((s) => s.type === 'bar');

    const option = {
        animationDuration: 500,
        backgroundColor: 'transparent',
        title: [
            ...(hasMainTitle ? [{
                text: title,
                left: 8,
                top: 4,
                textStyle: {
                    color: '#0a2416',
                    fontFamily: 'Inter',
                    fontWeight: 600,
                    fontSize: 14
                }
            }] : []),
            ...(hasMetricLabel ? [{
                text: vAxisTitle,
                left: 8,
                top: hasMainTitle ? 24 : 8,
                textStyle: {
                    color: '#1f3f33',
                    fontFamily: 'Inter',
                    fontWeight: 500,
                    fontSize: 15
                }
            }] : [])
        ],
        legend: {
            type: 'scroll',
            right: 8,
            top: hasMetricLabel ? 34 : 8,
            itemWidth: 10,
            itemHeight: 10,
            textStyle: {
                color: '#3f5f54',
                fontFamily: 'Inter',
                fontSize: 11
            },
            selected: selectedMap
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: hasBarSeries ? 'shadow' : 'line'
            },
            backgroundColor: 'rgba(255, 255, 255, 0.97)',
            borderColor: '#bfd8c8',
            borderWidth: 1,
            textStyle: {
                color: '#0a2416',
                fontFamily: 'Inter',
                fontSize: 12
            }
        },
        grid: {
            top: topPadding,
            right: 18,
            bottom: 42,
            left: 56
        },
        xAxis: {
            type: 'category',
            data: xCategories,
            axisLine: { lineStyle: { color: '#8ea79b', width: 1 } },
            axisTick: { show: false },
            axisLabel: {
                color: '#2e4d40',
                fontFamily: 'Inter',
                fontSize: 11,
                rotate: 0,
                hideOverlap: true
            }
        },
        yAxis: {
            type: 'value',
            name: '',
            splitLine: { lineStyle: { color: '#d7e5dc', width: 1 } },
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: {
                color: '#2e4d40',
                fontFamily: 'Inter',
                fontSize: 11
            }
        },
        series
    };

    chart.setOption(option, true);
    chart.resize();
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
                showChartMessage('subsectorActivityChart', 'No activity data to display');
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
                showChartMessage('subsectorFecChart', 'No FEC data to display');
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
                showChartMessage('subsectorUeChart', 'No Useful Energy data to display');
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
            const h2MixData = preparePlotlyData(years, activeH2Techs, (y, tech) => {
                const totalH2 = getValue(yearlyResults, [y, 'fecByFuel', 'Hydrogen'], 0);
                const mix = getValue(yearlyResults, [y, 'hydrogenProdMix', tech], 0);
                return ((mix / 100) * totalH2) / GJ_PER_EJ;
            }, 'bar');
            drawPlotlyChart('hydrogenMixChart', h2MixData, '', 'Hydrogen Production (EJ)', true);
        } else {
            showChartMessage('hydrogenMixChart', 'No hydrogen production data to display');
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

function updateEmissionsCharts(yearlyResults, chartConfigData) {
    if (!yearlyResults || Object.keys(yearlyResults).length === 0) return;
    if (!chartConfigData) return;

    const { years, primaryFuels } = chartConfigData;

    // 1. Global Emissions Chart
    // We want to show Net Emissions by Fuel (Stacked Bar)
    // And Captured Emissions (Line or separate trace)

    // Filter fuels that have emissions
    const activeEmissionFuels = primaryFuels.filter(fuel => {
        return years.some(y => {
            const val = getValue(yearlyResults, [y, 'emissions', 'byFuel', fuel], 0);
            return Math.abs(val) > 1e-3;
        });
    });

    const traces = [];

    // Net Emissions by Fuel (Approximation: We show Gross by Fuel stacked, and then a negative bar for captured? 
    // Or just show Net? 
    // The logic in modelLogic calculates 'net' total, but 'byFuel' is gross.
    // Let's show Gross Emissions by Fuel as stacked bars.
    // And then show "Captured" as a separate trace (maybe a line or a negative bar?).
    // If we want "Net" to be the visual total, we should subtract captured from the stack?
    // But captured isn't easily attributed to a specific fuel in the aggregate 'captured' number without more logic.
    // Let's show Gross Emissions Stacked, and a Line for "Net Emissions".
    // AND a Line for "Captured Emissions".

    // Trace 1..N: Gross Emissions by Fuel (Stacked Bar)
    activeEmissionFuels.forEach((fuel, index) => {
        const xValues = [];
        const yValues = [];
        years.forEach(year => {
            xValues.push(year);
            yValues.push(getValue(yearlyResults, [year, 'emissions', 'byFuel', fuel], 0));
        });

        traces.push({
            x: xValues,
            y: yValues,
            name: fuel,
            type: 'bar',
            marker: { color: getTechColor(fuel, index) }
        });
    });

    // Trace N+1: Captured Emissions (Negative Bar)
    const capturedX = [];
    const capturedY = [];
    years.forEach(year => {
        capturedX.push(year);
        // Make negative for display
        capturedY.push(-getValue(yearlyResults, [year, 'emissions', 'captured'], 0));
    });

    traces.push({
        x: capturedX,
        y: capturedY,
        name: 'Captured (CCS)',
        type: 'bar',
        marker: { color: '#10b981' } // Green
    });

    // Trace N+2: Net Emissions (Line)
    const netX = [];
    const netY = [];
    years.forEach(year => {
        netX.push(year);
        netY.push(getValue(yearlyResults, [year, 'emissions', 'net'], 0));
    });

    traces.push({
        x: netX,
        y: netY,
        name: 'Net Emissions',
        type: 'scatter',
        mode: 'lines',
        line: { color: '#000000', width: 4 }, // Black solid line
        visible: true
    });

    drawPlotlyChart('globalEmissionsChart', traces, '', 'Emissions (Mt CO2)', true);

    // 2. CCS by Subsector Chart
    // We want to show which sectors are capturing emissions
    // Stacked bar chart of captured emissions (positive values here for clarity)

    // Identify active subsectors for CCS
    const allSubsectors = new Set();
    years.forEach(y => {
        const subMap = getValue(yearlyResults, [y, 'emissions', 'capturedBySubsector'], {});
        Object.keys(subMap).forEach(k => allSubsectors.add(k));
    });
    const activeCcsSubsectors = Array.from(allSubsectors);

    if (activeCcsSubsectors.length > 0) {
        const ccsTraces = [];
        activeCcsSubsectors.forEach((sub, index) => {
            const xVals = [];
            const yVals = [];
            years.forEach(year => {
                xVals.push(year);
                yVals.push(getValue(yearlyResults, [year, 'emissions', 'capturedBySubsector', sub], 0));
            });

            ccsTraces.push({
                x: xVals,
                y: yVals,
                name: sub,
                type: 'bar',
                // Use a distinct color palette or reuse tech colors if applicable
                marker: { color: getTechColor(sub, index) }
            });
        });
        drawPlotlyChart('ccsBySubsectorChart', ccsTraces, '', 'Captured Emissions (Mt CO2)', true);
    } else {
        showChartMessage('ccsBySubsectorChart', 'No Captured Emissions (CCS) active');
    }
}

window.updateCharts = updateCharts;
window.updateDeltaCharts = updateDeltaCharts;
window.updateEmissionsCharts = updateEmissionsCharts;
window.chartTypes = chartTypes;
