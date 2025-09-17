// js/charting.js
// Further refactored for maximum conciseness
// Removed duplicate GJ_PER_EJ declaration

const chartInstances = {};
const chartSafeGet = (obj, path, fallback) => {
    let current = obj;
    for (let i = 0; i < path.length; i += 1) {
        if (current == null || !(path[i] in current)) return fallback;
        current = current[path[i]];
    }
    return current == null ? fallback : current;
};
// const GJ_PER_EJ = 1e9; // REMOVED - Declared in modelLogic.js

// --- Color Palette & Mapping (Keep full for clarity) ---
const emberColors = { green_ember: '#13CE74', green_pine: '#06371F', green_forest: '#0B6638', green_grass: '#0F9A56', green_mint: '#89E7BA', blue_navy: '#204172', blue_azure: '#1E6DA9', blue_sky: '#37A6E6', blue_arctic: '#C4D9E9', fossil_fire: '#E04B00', fossil_clay: '#891B05', fossil_rust: '#BF3100', fossil_tangerine: '#EE7309', fossil_sunrise: '#FCA311', grey_smoke: '#999999', grey_fog: '#F7F7F7', grey_dark: '#718096', black: '#000000' };
const techColorMapping = { 'Solar PV': emberColors.green_ember, 'Wind': emberColors.green_grass, 'Hydro': emberColors.blue_sky, 'Nuclear power': emberColors.blue_azure, 'Biomass power': emberColors.green_forest, 'Gas power': emberColors.fossil_tangerine, 'Coal power': emberColors.fossil_clay, 'Oil power': emberColors.fossil_rust, 'Other power': emberColors.grey_smoke, 'Green': emberColors.green_ember, 'Blue': emberColors.blue_sky, 'Electricity': emberColors.blue_sky, 'Oil': emberColors.fossil_rust, 'Hydrogen': '#8b5cf6', 'Coal': emberColors.fossil_clay, 'Gas': emberColors.fossil_tangerine, 'Biomass': emberColors.green_forest, 'Solar': emberColors.fossil_sunrise, 'Uranium': emberColors.blue_azure, 'EV': emberColors.blue_sky, 'ICE': emberColors.fossil_rust, 'Ammonia ship': '#8b5cf6', 'Electric ship': emberColors.blue_sky, 'Conventional ship': emberColors.fossil_rust, 'Electric plane': emberColors.blue_sky, 'Conventional plane': emberColors.fossil_rust, 'Electric train': emberColors.blue_sky, 'Diesel train': emberColors.fossil_rust, 'BF-BOF': emberColors.fossil_clay, 'EAF': emberColors.blue_sky, 'DRI-EAF (H2)': '#8b5cf6', 'Conventional kiln': emberColors.fossil_clay, 'Electric kiln': emberColors.blue_sky, 'Conventional': emberColors.fossil_tangerine, 'Electrified': emberColors.blue_sky, 'Fossil boiler': emberColors.fossil_tangerine, 'Biomass boiler': emberColors.green_forest, 'Heat pump': emberColors.green_ember, 'Fossil furnace': emberColors.fossil_tangerine, 'Biomass furnace': emberColors.green_forest, 'Electric furnace': emberColors.blue_sky, 'Biomass heating': emberColors.green_forest, 'Electric heating': emberColors.blue_sky, 'Conventional fossil': emberColors.fossil_tangerine, 'Biomass cooking': emberColors.green_forest, 'Full LED': emberColors.green_ember, 'Low efficiency airco': emberColors.grey_smoke, 'High efficiency airco': emberColors.blue_sky, '_DEFAULT': emberColors.grey_smoke };
const getTechColor = (name = '', idx = 0) => techColorMapping[name] || emberColors[String(name).toLowerCase().replace(/ /g, '_')] || techColorMapping['_DEFAULT'];

// --- Chart Creation (Concise) ---
const createOrUpdateChart = (canvasId, type, data, options = {}) => {
    const canvas = document.getElementById(canvasId); if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy(); // Destroy previous

    const defaultOpts = { // Minimal defaults, rely on Chart.js defaults where possible
        responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 15, padding: 10, usePointStyle: true } } }
    };
    // Simple merge (overwrites defaults)
    const mergedOpts = {
        responsive: defaultOpts.responsive,
        maintainAspectRatio: defaultOpts.maintainAspectRatio,
        animation: options.animation || defaultOpts.animation,
        interaction: options.interaction || defaultOpts.interaction,
        plugins: {},
        scales: {}
    };
    const defaultPlugins = defaultOpts.plugins || {};
    const optionPlugins = options.plugins || {};
    Object.keys(defaultPlugins).forEach(key => {
        mergedOpts.plugins[key] = typeof defaultPlugins[key] === 'object' && defaultPlugins[key] !== null
            ? JSON.parse(JSON.stringify(defaultPlugins[key]))
            : defaultPlugins[key];
    });
    Object.keys(optionPlugins).forEach(key => {
        mergedOpts.plugins[key] = typeof optionPlugins[key] === 'object' && optionPlugins[key] !== null
            ? JSON.parse(JSON.stringify(optionPlugins[key]))
            : optionPlugins[key];
    });
    const optionScales = options.scales || {};
    Object.keys(optionScales).forEach(key => {
        mergedOpts.scales[key] = typeof optionScales[key] === 'object' && optionScales[key] !== null
            ? JSON.parse(JSON.stringify(optionScales[key]))
            : optionScales[key];
    });
    // Add titles if not provided in options
    if (!mergedOpts.plugins) mergedOpts.plugins = {};
    if (!mergedOpts.plugins.title) {
        const chartBox = canvas.closest('.chart-box');
        const heading = chartBox ? chartBox.querySelector('h3') : null;
        mergedOpts.plugins.title = { display: true, text: heading ? heading.textContent : 'Chart' };
    }
    if (!mergedOpts.scales) mergedOpts.scales = {};
    if (!mergedOpts.scales.x) mergedOpts.scales.x = { stacked: type === 'bar' };
    if (!mergedOpts.scales.y) mergedOpts.scales.y = { stacked: type === 'bar', beginAtZero: true, title: { display: true, text: 'Value' } };

    try { chartInstances[canvasId] = new Chart(ctx, { type, data, options: mergedOpts }); }
    catch (err) { console.error(`Chart "${canvasId}" error:`, err); }
};

// Tooltip & Default Options (Concise)
const ejTooltip = ctx => {
    const label = ctx.dataset && ctx.dataset.label ? ctx.dataset.label : '';
    const parsed = ctx.parsed ? ctx.parsed.y : undefined;
    const value = parsed !== undefined && parsed !== null ? `${parsed.toFixed(3)} EJ` : 'N/A';
    return `${label || ''}: ${value}`;
}; // Uses GJ_PER_EJ implicitly via calculation results
const stackedBarOpts = yTitle => ({ plugins: { tooltip: { callbacks: { label: ejTooltip } } }, scales: { y: { title: { text: yTitle } } } });

// --- Main Chart Update (Concise) ---
function updateCharts(results, config) {
    if (!results || !config) return console.warn("Missing results/config for charts.");
    const years = config.years || [];
    const endUseFuels = config.endUseFuels || [];
    const primaryFuels = config.primaryFuels || [];
    const powerTechs = config.powerTechs || [];
    const hydrogenTechs = config.hydrogenTechs || [];
    const technologies = config.technologies || {};
    const activityUnits = config.activityUnits || {};
    if (!years.length) {
        console.error("Years missing for charts.");
        return;
    }
    const subSelect = document.getElementById('selectSubsector');
    const subKey = subSelect ? subSelect.value : '';
    const subParts = subKey ? subKey.split('|') : [];
    const selSector = subParts[0] || '';
    const selSubsector = subParts[1] || '';

    // Helper to create dataset array
    // GJ_PER_EJ is used implicitly here when dividing results (which are in GJ)
    const createDatasets = (labels, dataMapFn, filterFn) => {
        const useFilter = typeof filterFn === 'function' ? filterFn : function (ds) {
            return ds.data.some(v => Math.abs(v) > 1e-9);
        };
        return labels.map(dataMapFn).filter(useFilter);
    };

    // --- Subsector Charts ---
    if (selSector && selSubsector) {
        const subTechs = chartSafeGet(technologies, [selSector, selSubsector], []);
        const actUnit = chartSafeGet(activityUnits, [selSector, selSubsector], 'Units');
        createOrUpdateChart('subsectorActivityChart', 'bar', {
            labels: years,
            datasets: createDatasets(subTechs, (tech, i) => ({
                label: tech,
                data: years.map(y => chartSafeGet(results, [y, 'demandTechActivity', selSector, selSubsector, tech], 0)),
                backgroundColor: getTechColor(tech, i)
            }))
        }, { scales: { y: { title: { text: `Activity (${actUnit})` } } } });
        createOrUpdateChart('subsectorFecChart', 'bar', {
            labels: years,
            datasets: createDatasets(endUseFuels, (fuel, i) => ({
                label: fuel,
                data: years.map(y => {
                    return subTechs.reduce((sum, t) => {
                        const val = chartSafeGet(results, [y, 'fecDetailed', selSector, selSubsector, t, fuel], 0);
                        return sum + val;
                    }, 0) / GJ_PER_EJ;
                }),
                backgroundColor: getTechColor(fuel, i)
            }))
        }, stackedBarOpts('FEC (EJ)'));
        createOrUpdateChart('subsectorUeChart', 'bar', {
            labels: years,
            datasets: createDatasets(endUseFuels, (fuel, i) => ({
                label: fuel,
                data: years.map(y => {
                    return subTechs.reduce((sum, t) => {
                        const val = chartSafeGet(results, [y, 'ueDetailed', selSector, selSubsector, t, fuel], 0);
                        return sum + val;
                    }, 0) / GJ_PER_EJ;
                }),
                backgroundColor: getTechColor(fuel, i)
            }))
        }, stackedBarOpts('Useful Energy (EJ)'));
    } else { // Clear if no subsector selected
        ['subsectorActivityChart', 'subsectorFecChart', 'subsectorUeChart'].forEach(id => {
            if (chartInstances[id]) {
                chartInstances[id].destroy();
                delete chartInstances[id];
            }
            const cvs = document.getElementById(id);
            if (cvs) {
                const ctx = cvs.getContext('2d');
                if (ctx) ctx.clearRect(0, 0, cvs.width, cvs.height);
            }
        });
    }

    // --- Balance Charts ---
    createOrUpdateChart('fecFuelChart', 'bar', {
        labels: years,
        datasets: createDatasets(endUseFuels, (fuel, i) => ({
            label: fuel,
            data: years.map(y => chartSafeGet(results, [y, 'fecByFuel', fuel], 0) / GJ_PER_EJ),
            backgroundColor: getTechColor(fuel, i)
        }))
    }, stackedBarOpts('Total FEC (EJ)'));
    createOrUpdateChart('pedFuelChart', 'bar', {
        labels: years,
        datasets: createDatasets(primaryFuels, (fuel, i) => ({
            label: fuel,
            data: years.map(y => chartSafeGet(results, [y, 'pedByFuel', fuel], 0) / GJ_PER_EJ),
            backgroundColor: getTechColor(fuel, i)
        }))
    }, stackedBarOpts('Total PED (EJ)'));
    createOrUpdateChart('ueFuelChart', 'bar', {
        labels: years,
        datasets: createDatasets(endUseFuels, (fuel, i) => ({
            label: fuel,
            data: years.map(y => chartSafeGet(results, [y, 'ueByFuel', fuel], 0) / GJ_PER_EJ),
            backgroundColor: getTechColor(fuel, i)
        }))
    }, stackedBarOpts('Total Useful Energy (EJ)'));

    // --- Supply Charts ---
    createOrUpdateChart('powerMixChart', 'bar', {
        labels: years,
        datasets: createDatasets(powerTechs, (tech, i) => ({
            label: tech,
            data: years.map(y => {
                const mix = chartSafeGet(results, [y, 'powerProdMix', tech], 0) / 100;
                const total = chartSafeGet(results, [y, 'ecPostHydrogen', 'Electricity'], 0);
                return (mix * total) / GJ_PER_EJ;
            }),
            backgroundColor: getTechColor(tech, i)
        }))
    }, stackedBarOpts('Power Generation (EJ)'));
    createOrUpdateChart('hydrogenMixChart', 'bar', {
        labels: years,
        datasets: createDatasets(hydrogenTechs, (tech, i) => ({
            label: tech,
            data: years.map(y => {
                const mix = chartSafeGet(results, [y, 'hydrogenProdMix', tech], 0) / 100;
                const total = chartSafeGet(results, [y, 'fecByFuel', 'Hydrogen'], 0);
                return (mix * total) / GJ_PER_EJ;
            }),
            backgroundColor: getTechColor(tech, i)
        }))
    }, stackedBarOpts('Hydrogen Production (EJ)'));

    console.log("Charts updated.");
}
