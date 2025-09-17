// js/charting.js
// Enhanced visuals & resilient dataset handling

const chartInstances = {};
const chartSafeGet = (obj, path, fallback) => {
    let current = obj;
    for (let i = 0; i < path.length; i += 1) {
        if (current == null || !(path[i] in current)) return fallback;
        current = current[path[i]];
    }
    return current == null ? fallback : current;
};

// --- Color Palette & Mapping (Keep full for clarity) ---
const emberColors = {
    green_ember: '#13CE74', green_pine: '#06371F', green_forest: '#0B6638', green_grass: '#0F9A56', green_mint: '#89E7BA',
    blue_navy: '#204172', blue_azure: '#1E6DA9', blue_sky: '#37A6E6', blue_arctic: '#C4D9E9',
    fossil_fire: '#E04B00', fossil_clay: '#891B05', fossil_rust: '#BF3100', fossil_tangerine: '#EE7309', fossil_sunrise: '#FCA311',
    grey_smoke: '#999999', grey_fog: '#F7F7F7', grey_dark: '#718096', black: '#000000'
};

const techColorMapping = {
    'Solar PV': emberColors.green_ember,
    'Wind': emberColors.green_grass,
    'Hydro': emberColors.blue_sky,
    'Nuclear power': emberColors.blue_azure,
    'Biomass power': emberColors.green_forest,
    'Gas power': emberColors.fossil_tangerine,
    'Coal power': emberColors.fossil_clay,
    'Oil power': emberColors.fossil_rust,
    'Other power': emberColors.grey_smoke,
    'Green': emberColors.green_ember,
    'Blue': emberColors.blue_sky,
    'Electricity': emberColors.blue_sky,
    'Oil': emberColors.fossil_rust,
    'Hydrogen': '#8b5cf6',
    'Coal': emberColors.fossil_clay,
    'Gas': emberColors.fossil_tangerine,
    'Biomass': emberColors.green_forest,
    'Solar': emberColors.fossil_sunrise,
    'Uranium': emberColors.blue_azure,
    'EV': emberColors.blue_sky,
    'ICE': emberColors.fossil_rust,
    'Ammonia ship': '#8b5cf6',
    'Electric ship': emberColors.blue_sky,
    'Conventional ship': emberColors.fossil_rust,
    'Electric plane': emberColors.blue_sky,
    'Conventional plane': emberColors.fossil_rust,
    'Electric train': emberColors.blue_sky,
    'Diesel train': emberColors.fossil_rust,
    'BF-BOF': emberColors.fossil_clay,
    'EAF': emberColors.blue_sky,
    'DRI-EAF (H2)': '#8b5cf6',
    'Conventional kiln': emberColors.fossil_clay,
    'Electric kiln': emberColors.blue_sky,
    'Conventional': emberColors.fossil_tangerine,
    'Electrified': emberColors.blue_sky,
    'Fossil boiler': emberColors.fossil_tangerine,
    'Biomass boiler': emberColors.green_forest,
    'Heat pump': emberColors.green_ember,
    'Fossil furnace': emberColors.fossil_tangerine,
    'Biomass furnace': emberColors.green_forest,
    'Electric furnace': emberColors.blue_sky,
    'Biomass heating': emberColors.green_forest,
    'Electric heating': emberColors.blue_sky,
    'Conventional fossil': emberColors.fossil_tangerine,
    'Biomass cooking': emberColors.green_forest,
    'Full LED': emberColors.green_ember,
    'Low efficiency airco': emberColors.grey_smoke,
    'High efficiency airco': emberColors.blue_sky,
    '_DEFAULT': emberColors.grey_smoke
};

const getTechColor = (name = '') => techColorMapping[name]
    || emberColors[String(name).toLowerCase().replace(/ /g, '_')]
    || techColorMapping['_DEFAULT'];

const luminousGridPlugin = {
    id: 'luminousGrid',
    beforeDatasetsDraw(chart, args, opts = {}) {
        if (opts === false || opts.enabled === false) return;
        const { ctx, chartArea } = chart;
        if (!chartArea) return;
        const { left, top, right, bottom } = chartArea;
        ctx.save();
        const gradient = ctx.createLinearGradient(0, top, 0, bottom);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.08)');
        gradient.addColorStop(0.65, 'rgba(59, 130, 246, 0.04)');
        gradient.addColorStop(1, 'rgba(19, 206, 116, 0.05)');
        ctx.fillStyle = gradient;
        ctx.fillRect(left, top, right - left, bottom - top);
        ctx.restore();
    },
    afterDatasetsDraw(chart, args, opts = {}) {
        if (opts === false || opts.enabled === false) return;
        const { ctx, chartArea } = chart;
        if (!chartArea) return;
        const { left, top, right, bottom } = chartArea;
        ctx.save();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.32)';
        ctx.lineWidth = 1;
        ctx.strokeRect(left, top, right - left, bottom - top);
        ctx.restore();
    }
};

if (typeof Chart !== 'undefined') {
    Chart.register(luminousGridPlugin);
    Chart.defaults.font.family = "'Poppins', sans-serif";
    Chart.defaults.color = '#1e2a3d';
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxWidth = 12;
    Chart.defaults.plugins.legend.labels.boxHeight = 12;
    Chart.defaults.plugins.legend.labels.color = '#0f172a';
    Chart.defaults.plugins.legend.labels.font = { size: 12, weight: '500' };
    Chart.defaults.plugins.tooltip.cornerRadius = 10;
    Chart.defaults.plugins.tooltip.padding = 12;
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.92)';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(255, 255, 255, 0.08)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.luminousGrid = { enabled: true };
}

const hexToRgba = (hex, alpha = 1) => {
    if (!hex || typeof hex !== 'string') return hex;
    const normalized = hex.replace('#', '');
    if (normalized.length !== 3 && normalized.length !== 6) return hex;
    const full = normalized.length === 3
        ? normalized.split('').map(ch => ch + ch).join('')
        : normalized;
    const num = parseInt(full, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const applyAlpha = (color, alpha) => {
    if (Array.isArray(color)) return color.map(c => applyAlpha(c, alpha));
    if (typeof color === 'string' && color.startsWith('#')) return hexToRgba(color, alpha);
    if (typeof color === 'string' && color.startsWith('rgb')) {
        return color.replace(/rgba?\(([^)]+)\)/, (_, inner) => {
            const parts = inner.split(',').map(p => p.trim());
            const [r, g, b] = parts;
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        });
    }
    return color;
};

const mergeDeep = (target = {}, source = {}) => {
    const output = { ...target };
    Object.keys(source).forEach(key => {
        const srcVal = source[key];
        const tgtVal = output[key];
        if (srcVal && typeof srcVal === 'object' && !Array.isArray(srcVal)) {
            output[key] = mergeDeep(tgtVal || {}, srcVal);
        } else {
            output[key] = srcVal;
        }
    });
    return output;
};

const stylizeDatasets = (datasets = [], type) => datasets.map(ds => {
    const cloned = { ...ds };
    const baseColorSource = Array.isArray(cloned.backgroundColor) && cloned.backgroundColor.length
        ? cloned.backgroundColor[0]
        : cloned.backgroundColor || cloned.borderColor || '#718096';
    const fillOpacity = type === 'bar' ? 0.68 : 0.22;
    cloned.backgroundColor = applyAlpha(cloned.backgroundColor || baseColorSource, fillOpacity);
    cloned.hoverBackgroundColor = applyAlpha(baseColorSource, type === 'bar' ? 0.9 : 0.35);
    const borderAlpha = type === 'bar' ? 0.95 : 0.65;
    cloned.borderColor = applyAlpha(cloned.borderColor || baseColorSource, borderAlpha);
    cloned.hoverBorderColor = applyAlpha(baseColorSource, 1);
    if (type === 'bar') {
        cloned.borderRadius = cloned.borderRadius != null ? cloned.borderRadius : 12;
        cloned.borderSkipped = false;
        cloned.borderWidth = cloned.borderWidth != null ? cloned.borderWidth : 1.6;
        cloned.maxBarThickness = cloned.maxBarThickness || 42;
        cloned.categoryPercentage = cloned.categoryPercentage || 0.62;
        cloned.barPercentage = cloned.barPercentage || 0.78;
    } else {
        cloned.borderWidth = cloned.borderWidth != null ? cloned.borderWidth : 2.4;
        cloned.pointRadius = cloned.pointRadius != null ? cloned.pointRadius : 3.5;
        cloned.pointHoverRadius = cloned.pointHoverRadius != null ? cloned.pointHoverRadius : 5.5;
        cloned.pointBackgroundColor = cloned.pointBackgroundColor || applyAlpha(baseColorSource, 0.85);
        cloned.pointBorderColor = cloned.pointBorderColor || applyAlpha(baseColorSource, 1);
        cloned.tension = cloned.tension != null ? cloned.tension : 0.28;
        cloned.fill = cloned.fill != null ? cloned.fill : false;
    }
    return cloned;
});

// --- Chart Creation ---
const createOrUpdateChart = (canvasId, type, data, options = {}) => {
    const canvas = document.getElementById(canvasId); if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    const defaultOpts = {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false, axis: 'x' },
        layout: { padding: { top: 8, bottom: 18, left: 14, right: 14 } },
        plugins: {
            legend: {
                position: 'bottom',
                align: 'center',
                labels: {
                    padding: 16,
                    color: '#0f172a',
                    font: { size: 12, weight: '500' },
                    usePointStyle: true
                }
            },
            title: {
                display: true,
                color: '#0f172a',
                font: { size: 16, weight: '600' },
                padding: { top: 6, bottom: 18 }
            },
            tooltip: { callbacks: { label: ejTooltip } },
            luminousGrid: { enabled: true }
        },
        scales: {
            x: {
                stacked: type === 'bar',
                grid: {
                    color: 'rgba(148, 163, 184, 0.18)',
                    drawBorder: false,
                    drawOnChartArea: false,
                    drawTicks: false
                },
                border: { display: false },
                ticks: {
                    padding: 12,
                    color: 'rgba(15, 23, 42, 0.82)',
                    maxRotation: 0,
                    autoSkipPadding: 12,
                    font: { size: 12, weight: '500' }
                }
            },
            y: {
                stacked: type === 'bar',
                beginAtZero: true,
                grid: {
                    color: 'rgba(148, 163, 184, 0.22)',
                    drawBorder: false,
                    borderDash: [4, 6],
                    drawTicks: false
                },
                border: { display: false },
                ticks: {
                    padding: 10,
                    color: 'rgba(15, 23, 42, 0.78)',
                    font: { size: 12, weight: '500' }
                },
                title: { display: true, text: 'Value', color: '#1f2937', font: { size: 13, weight: '500' } }
            }
        }
    };

    const mergedOpts = mergeDeep(defaultOpts, options);
    if (!mergedOpts.plugins) mergedOpts.plugins = {};
    if (!mergedOpts.plugins.title || !mergedOpts.plugins.title.text) {
        const chartBox = canvas.closest('.chart-box');
        const heading = chartBox ? chartBox.querySelector('h3') : null;
        mergedOpts.plugins.title = mergeDeep({ display: true }, mergedOpts.plugins.title || {});
        mergedOpts.plugins.title.text = heading ? heading.textContent : 'Chart';
    }
    mergedOpts.scales = mergedOpts.scales || {};
    mergedOpts.scales.x = mergeDeep({ stacked: type === 'bar' }, mergedOpts.scales.x || {});
    mergedOpts.scales.y = mergeDeep({ stacked: type === 'bar', beginAtZero: true }, mergedOpts.scales.y || {});

    const preparedData = {
        ...(data || {}),
        datasets: stylizeDatasets((data && data.datasets) || [], type)
    };

    try {
        chartInstances[canvasId] = new Chart(ctx, { type, data: preparedData, options: mergedOpts });
    } catch (err) {
        console.error(`Chart "${canvasId}" error:`, err);
    }
};

// Tooltip & Default Options
const ejTooltip = ctx => {
    const label = ctx.dataset && ctx.dataset.label ? ctx.dataset.label : '';
    const parsed = ctx.parsed ? ctx.parsed.y : undefined;
    const value = parsed !== undefined && parsed !== null ? `${parsed.toFixed(3)} EJ` : 'N/A';
    return `${label || ''}: ${value}`;
};

const stackedBarOpts = yTitle => ({ scales: { y: { title: { text: yTitle } } } });

// --- Main Chart Update ---
function updateCharts(results, config) {
    if (!results || !config) return console.warn('Missing results/config for charts.');
    const years = config.years || [];
    const endUseFuels = config.endUseFuels || [];
    const primaryFuels = config.primaryFuels || [];
    const powerTechs = config.powerTechs || [];
    const hydrogenTechs = config.hydrogenTechs || [];
    const technologies = config.technologies || {};
    const activityUnits = config.activityUnits || {};
    if (!years.length) {
        console.error('Years missing for charts.');
        return;
    }
    const subSelect = document.getElementById('selectSubsector');
    const subKey = subSelect ? subSelect.value : '';
    const subParts = subKey ? subKey.split('|') : [];
    const selSector = subParts[0] || '';
    const selSubsector = subParts[1] || '';

    const createDatasets = (labels, dataMapFn, filterFn) => {
        const built = labels.map(dataMapFn);
        const useFilter = typeof filterFn === 'function' ? filterFn : function (ds) {
            return Array.isArray(ds.data) && ds.data.some(v => Math.abs(v) > 1e-12);
        };
        const filtered = built.filter(useFilter);
        return filtered.length ? filtered : built;
    };

    // --- Subsector Charts ---
    if (selSector && selSubsector) {
        const subTechs = chartSafeGet(technologies, [selSector, selSubsector], []);
        const actUnit = chartSafeGet(activityUnits, [selSector, selSubsector], 'Units');
        createOrUpdateChart('subsectorActivityChart', 'bar', {
            labels: years,
            datasets: createDatasets(subTechs, (tech) => ({
                label: tech,
                data: years.map(y => chartSafeGet(results, [y, 'demandTechActivity', selSector, selSubsector, tech], 0)),
                backgroundColor: getTechColor(tech)
            }))
        }, { scales: { y: { title: { text: `Activity (${actUnit})` } } } });
        createOrUpdateChart('subsectorFecChart', 'bar', {
            labels: years,
            datasets: createDatasets(endUseFuels, (fuel) => ({
                label: fuel,
                data: years.map(y => {
                    return subTechs.reduce((sum, t) => {
                        const val = chartSafeGet(results, [y, 'fecDetailed', selSector, selSubsector, t, fuel], 0);
                        return sum + val;
                    }, 0) / GJ_PER_EJ;
                }),
                backgroundColor: getTechColor(fuel)
            }))
        }, stackedBarOpts('FEC (EJ)'));
        createOrUpdateChart('subsectorUeChart', 'bar', {
            labels: years,
            datasets: createDatasets(endUseFuels, (fuel) => ({
                label: fuel,
                data: years.map(y => {
                    return subTechs.reduce((sum, t) => {
                        const val = chartSafeGet(results, [y, 'ueDetailed', selSector, selSubsector, t, fuel], 0);
                        return sum + val;
                    }, 0) / GJ_PER_EJ;
                }),
                backgroundColor: getTechColor(fuel)
            }))
        }, stackedBarOpts('Useful Energy (EJ)'));
    } else {
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
        datasets: createDatasets(endUseFuels, (fuel) => ({
            label: fuel,
            data: years.map(y => chartSafeGet(results, [y, 'fecByFuel', fuel], 0) / GJ_PER_EJ),
            backgroundColor: getTechColor(fuel)
        }))
    }, stackedBarOpts('Total FEC (EJ)'));

    createOrUpdateChart('pedFuelChart', 'bar', {
        labels: years,
        datasets: createDatasets(primaryFuels, (fuel) => ({
            label: fuel,
            data: years.map(y => chartSafeGet(results, [y, 'pedByFuel', fuel], 0) / GJ_PER_EJ),
            backgroundColor: getTechColor(fuel)
        }))
    }, stackedBarOpts('Total PED (EJ)'));

    createOrUpdateChart('ueFuelChart', 'bar', {
        labels: years,
        datasets: createDatasets(endUseFuels, (fuel) => ({
            label: fuel,
            data: years.map(y => chartSafeGet(results, [y, 'ueByFuel', fuel], 0) / GJ_PER_EJ),
            backgroundColor: getTechColor(fuel)
        }))
    }, stackedBarOpts('Total Useful Energy (EJ)'));

    // --- Supply Charts ---
    createOrUpdateChart('powerMixChart', 'bar', {
        labels: years,
        datasets: createDatasets(powerTechs, (tech) => ({
            label: tech,
            data: years.map(y => {
                const mix = chartSafeGet(results, [y, 'powerProdMix', tech], 0) / 100;
                const total = chartSafeGet(results, [y, 'ecPostHydrogen', 'Electricity'], 0);
                return (mix * total) / GJ_PER_EJ;
            }),
            backgroundColor: getTechColor(tech)
        }))
    }, stackedBarOpts('Power Generation (EJ)'));

    createOrUpdateChart('hydrogenMixChart', 'bar', {
        labels: years,
        datasets: createDatasets(hydrogenTechs, (tech) => ({
            label: tech,
            data: years.map(y => {
                const mix = chartSafeGet(results, [y, 'hydrogenProdMix', tech], 0) / 100;
                const total = chartSafeGet(results, [y, 'fecByFuel', 'Hydrogen'], 0);
                return (mix * total) / GJ_PER_EJ;
            }),
            backgroundColor: getTechColor(tech)
        }))
    }, stackedBarOpts('Hydrogen Production (EJ)'));

    console.log('Charts updated.');
}
