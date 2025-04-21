// js/charting.js
// Version: Fuel Color Diversity Update

// --- Chart Instances Storage ---
// Stores references to active Chart.js instances to allow destruction before redraw
const chartInstances = {};

// --- Color Palette & Mapping ---
// Base color palette (Ember-inspired)
const emberColors = {
    green_ember: '#13CE74', green_pine: '#06371F', green_forest: '#0B6638',
    green_grass: '#0F9A56', green_mint: '#89E7BA', blue_navy: '#204172',
    blue_azure: '#1E6DA9', blue_sky: '#37A6E6', blue_arctic: '#C4D9E9', // Medium blue
    fossil_fire: '#E04B00', fossil_clay: '#891B05', fossil_rust: '#BF3100',
    fossil_tangerine: '#EE7309', fossil_sunrise: '#FCA311', grey_smoke: '#999999',
    grey_fog: '#F7F7F7', grey_dark: '#718096', black: '#000000'
};

// Mapping for specific technologies/fuels to colors
// *** UPDATED SECTION for better fuel color diversity ***
const techColorMapping = {
    // Power Generation Techs
    'Solar PV': emberColors.fossil_sunrise, // Changed from green_ember for primary association
    'Wind': emberColors.green_grass,
    'Hydro': emberColors.blue_sky,
    'Nuclear power': emberColors.blue_azure,
    'Biomass power': emberColors.green_forest,
    'Gas power': emberColors.fossil_tangerine,
    'Coal power': emberColors.fossil_clay,
    'Oil power': emberColors.fossil_rust,
    'Other power': emberColors.grey_smoke,

    // Hydrogen Production Techs
    'Green': emberColors.green_ember, // Hydrogen
    'Blue': emberColors.blue_arctic, // Hydrogen (Changed from sky blue to lighter blue)

    // ---- End Use Fuels (Updated for better diversity in UE/FEC charts) ----
    'Electricity': emberColors.blue_sky, // Keep vibrant blue
    'Oil': emberColors.fossil_rust,      // Keep distinct rust
    'Hydrogen': '#a855f7',              // Vibrant Purple (Hex code for better distinction)
    'Coal': emberColors.fossil_clay,     // Keep dark brown/clay
    'Gas': emberColors.fossil_tangerine, // Keep orange/tangerine
    'Biomass': emberColors.green_forest, // Keep distinct forest green

    // Primary Fuels (for PED chart - ensure they don't clash heavily with end-use)
    'Solar': emberColors.fossil_sunrise, // Primary Source
    'Uranium': emberColors.blue_navy,    // Primary Source (Darker blue)
    // Wind, Hydro, Coal, Gas, Oil, Biomass use above definitions

    // --- Selected Demand Technologies (Examples, keep consistent where possible) ---
    'EV': emberColors.blue_sky,
    'ICE': emberColors.fossil_rust,
    'Ammonia ship': '#a855f7', // Hydrogen based (match Hydrogen fuel)
    'Electric ship': emberColors.blue_sky,
    'Conventional ship': emberColors.fossil_rust,
    'Electric plane': emberColors.blue_sky,
    'Conventional plane': emberColors.fossil_rust,
    'Electric train': emberColors.blue_sky,
    'Diesel train': emberColors.fossil_rust,
    'BF-BOF': emberColors.fossil_clay, // Steel
    'EAF': emberColors.blue_sky,      // Steel
    'DRI-EAF (H2)': '#a855f7',         // Steel (match Hydrogen fuel)
    'Conventional kiln': emberColors.fossil_clay, // Cement
    'Electric kiln': emberColors.blue_sky,       // Cement
    'Conventional': emberColors.fossil_tangerine, // Generic conventional (often gas/oil)
    'Electrified': emberColors.blue_sky,        // Generic electrified
    'Fossil boiler': emberColors.fossil_tangerine,
    'Biomass boiler': emberColors.green_forest,
    'Heat pump': emberColors.green_ember, // Distinct bright green for high efficiency
    'Fossil furnace': emberColors.fossil_tangerine,
    'Biomass furnace': emberColors.green_forest,
    'Electric furnace': emberColors.blue_sky,
    'Biomass heating': emberColors.green_forest,
    'Electric heating': emberColors.blue_sky,
    'Conventional fossil': emberColors.fossil_tangerine, // Cooking/heating
    'Biomass cooking': emberColors.green_forest,
    'Full LED': emberColors.green_mint, // Lighting (lighter green)
    'Low efficiency airco': emberColors.grey_smoke,
    'High efficiency airco': emberColors.blue_sky,

    // Default Fallback
    '_DEFAULT': emberColors.grey_dark // Use a darker grey for fallback
};


/**
 * Helper function to retrieve a color for a given technology or fuel name.
 * Falls back through different matching strategies and finally to a default color.
 * @param {string} techName - The name of the technology or fuel.
 * @param {number} index - An optional index (currently unused, but could be for palette cycling).
 * @returns {string} The hex color code.
 */
function getTechColor(techName, index = 0) {
    // Try direct match first
    if (techColorMapping[techName]) {
        return techColorMapping[techName];
    }
    // Try lowercase/underscore match (simple cases)
    const simplifiedName = techName.toLowerCase().replace(/ /g, '_');
    if (emberColors[simplifiedName]) {
        return emberColors[simplifiedName];
    }
    // Fallback to default
    // console.warn(`Color not found for "${techName}", using default.`); // Optional warning
    return techColorMapping['_DEFAULT'];
}


/**
 * Helper function to safely retrieve a value from a nested object using an array of keys.
 * @param {object} obj - The object to traverse.
 * @param {string[]} keys - An array of keys representing the path.
 * @param {*} defaultValue - The value to return if the path is not found or the value is null/undefined.
 * @returns {*} The value found at the path or the defaultValue.
 */
function getValue(obj, keys, defaultValue = 0) {
    let current = obj;
    // Ensure keys is an array
    if (!Array.isArray(keys)) {
        console.warn("getValue expected keys to be an array, received:", keys);
        return defaultValue;
    }
    // Traverse the object path
    for (const key of keys) {
        // Check if current level is an object and the key exists
        if (current && typeof current === 'object' && key in current) {
            current = current[key];
        } else {
            // Path segment not found, return default value
            // Optionally log if a path segment is missing for debugging:
            // console.warn(`getValue: Key '${key}' not found in path [${keys.join(', ')}]`);
            return defaultValue;
        }
    }
    // Handle cases where the final value exists but is null or undefined
    return (current === null || current === undefined) ? defaultValue : current;
}


/**
 * Creates or updates a Chart.js chart instance on a given canvas.
 * It first destroys any existing chart on the canvas to prevent conflicts.
 * Applies default styling and merges custom options.
 * @param {string} canvasId - The ID of the HTML canvas element.
 * @param {string} type - The type of chart (e.g., 'bar', 'line').
 * @param {object} data - The Chart.js data object (labels, datasets).
 * @param {object} options - Custom Chart.js options to merge with defaults.
 * @returns {Chart|null} The created Chart.js instance or null if an error occurred.
 */
function createChart(canvasId, type, data, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error(`Canvas element with id "${canvasId}" not found.`);
        return null;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error(`Could not get 2D context for canvas "${canvasId}".`);
        return null;
    }

    // Destroy existing chart instance if it exists on this canvas
    if (chartInstances[canvasId]) {
        try {
            chartInstances[canvasId].destroy();
            delete chartInstances[canvasId]; // Remove the reference
        } catch (e) {
            console.error(`Error destroying chart instance ${canvasId}:`, e);
            // Continue even if destruction fails, Chart.js might handle it
        }
    }

    // Define sensible default options for all charts
    const defaultOptions = {
        responsive: true,
        maintainAspectRatio: false, // Important for fitting charts in boxes
        animation: {
            duration: 400 // Slightly faster animation
        },
        interaction: {
            mode: 'index', // Tooltip shows all datasets at that index
            intersect: false // Tooltip appears even when not directly hovering over point/bar
        },
        plugins: {
            legend: {
                position: 'bottom', // Place legend below the chart
                labels: {
                    font: { size: 11 },
                    boxWidth: 15, // Size of the color box
                    padding: 10, // Spacing around legend items
                    usePointStyle: true // Use point style (circles) for legend items
                }
            },
            title: {
                display: false // Default to no title, using the H3 in chart-box instead
            },
            tooltip: {
                bodyFont: { size: 12 },
                titleFont: { size: 13, weight: 'bold'},
                boxPadding: 4, // Padding inside the tooltip
                backgroundColor: 'rgba(0,0,0,0.75)', // Semi-transparent black tooltip
                // Enable external tooltips or custom rendering if needed later
            }
        },
        scales: {
            x: {
                grid: { display: false }, // Cleaner look without vertical grid lines
                ticks: { font: { size: 11 } },
                title: { display: false } // X-axis title usually clear from context
            },
            y: {
                beginAtZero: true, // Start Y-axis at zero
                grid: {
                    color: '#e0e0e0', // Lighter grid lines
                    borderDash: [2, 3] // Dashed horizontal grid lines
                },
                ticks: {
                    font: { size: 11 },
                    // Add callback for formatting large numbers if needed (e.g., M for millions)
                    // callback: function(value) { return value >= 1e6 ? (value / 1e6) + 'M' : value >= 1e3 ? (value / 1e3) + 'k' : value; }
                },
                title: {
                    display: true, // Show Y-axis title
                    font: { size: 12 },
                    // text: will be set dynamically in the calling function
                }
            }
        }
    };

    // Deep merge custom options provided into the defaults
    // Note: This is a basic merge; for very complex nested options, a library might be better
    const mergedOptions = {
        ...defaultOptions,
        ...options, // Overwrite top-level simple properties
        plugins: { // Merge plugins object carefully
            ...defaultOptions.plugins,
            ...(options.plugins || {}),
            legend: { ...defaultOptions.plugins.legend, ...(options.plugins?.legend || {}) },
            title: { ...defaultOptions.plugins.title, ...(options.plugins?.title || {}) },
            tooltip: { ...defaultOptions.plugins.tooltip, ...(options.plugins?.tooltip || {}) }
        },
        scales: { // Merge scales object carefully
             ...(defaultOptions.scales || {}),
             ...(options.scales || {}),
             x: { ...(defaultOptions.scales?.x || {}), ...(options.scales?.x || {}) },
             y: { ...(defaultOptions.scales?.y || {}), ...(options.scales?.y || {}) }
        }
    };


    // Create the new chart instance
    try {
        const chart = new Chart(ctx, {
            type,
            data,
            options: mergedOptions
        });
        chartInstances[canvasId] = chart; // Store the new instance reference
        return chart;
    } catch (error) {
        console.error(`Error creating chart "${canvasId}":`, error, {type, data, mergedOptions});
        // Optionally clear canvas or show an error message directly on the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'red';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Chart Error', canvas.width / 2, canvas.height / 2);
        return null;
    }
}

/**
 * Main function to update all charts on the page.
 * It retrieves the latest model results and configuration data,
 * processes the data for each chart, and calls createChart to draw/redraw.
 * @param {object} yearlyResults - The main results object from modelLogic.js, keyed by year.
 * @param {object} chartConfigData - Object containing lists needed for charts (years, fuels, techs, etc.).
 */
function updateCharts(yearlyResults, chartConfigData) {
    // --- Input Validation ---
    // Check if results are available
    if (!yearlyResults || Object.keys(yearlyResults).length === 0) {
        console.warn("No model results available to update charts.");
        // Optionally clear existing charts or display a message on canvases
        Object.keys(chartInstances).forEach(id => {
             if (chartInstances[id]) {
                 try { chartInstances[id].destroy(); } catch(e){}
                 delete chartInstances[id];
             }
             const canvas = document.getElementById(id);
             if(canvas) {
                 const ctx = canvas.getContext('2d');
                 ctx.clearRect(0, 0, canvas.width, canvas.height);
                 ctx.fillStyle = '#666'; // Grey text
                 ctx.font = '14px sans-serif';
                 ctx.textAlign = 'center';
                 ctx.fillText('No results loaded', canvas.width / 2, canvas.height / 2);
             }
        });
        return; // Stop execution if no results
    }
    // Check if configuration data is available
    if (!chartConfigData) {
        console.error("Chart configuration data is missing. Cannot update charts.");
        return; // Stop execution if config is missing
    }

    // --- Destructure Configuration Data ---
    // Extract necessary arrays and objects from chartConfigData with fallbacks
    const {
        years: chartLabels, // Use 'years' array as labels for the x-axis
        endUseFuels = [],
        primaryFuels = [],
        powerTechs = [],
        hydrogenTechs = [],
        technologies = {}, // Nested object: { sector: { subsector: [tech1, tech2] } }
        activityUnits = {}  // Nested object: { sector: { subsector: 'unit_string' } }
    } = chartConfigData;

    // Validate that we have years to use as labels
    if (!chartLabels || !Array.isArray(chartLabels) || chartLabels.length === 0) {
        console.error("Years array ('chartLabels') is missing or invalid in chartConfigData.", chartConfigData);
        return; // Stop if no labels are available
    }

    // --- Constants and Setup ---
    const GJ_PER_EJ = 1e9; // Conversion factor from GigaJoules (model unit) to ExaJoules (chart unit)

    // Get the currently selected subsector from the dropdown
    const subsectorSelect = document.getElementById('selectSubsector');
    const selectedSubsectorKey = subsectorSelect ? subsectorSelect.value : null;
    let selectedSector = null;
    let selectedSubsector = null;
    const subsectorNameSpan = document.getElementById('selectedSubsectorName'); // Span to display current selection

    // Parse the selected subsector key (e.g., "Industry|Steel")
    if (selectedSubsectorKey && selectedSubsectorKey.includes('|')) {
        [selectedSector, selectedSubsector] = selectedSubsectorKey.split('|');
        // Update the display span
        if (subsectorNameSpan) {
            subsectorNameSpan.textContent = `${selectedSector} - ${selectedSubsector}`;
        }
    } else {
        // Handle cases where no valid subsector is selected
        console.warn("Subsector key is missing or invalid. Cannot update subsector charts.");
        if (subsectorNameSpan) {
             subsectorNameSpan.textContent = 'Select Subsector'; // Reset display span
        }
        // Clear the subsector-specific charts if none is selected
         ['subsectorActivityChart', 'subsectorFecChart', 'subsectorUeChart'].forEach(id => {
             if (chartInstances[id]) {
                try { chartInstances[id].destroy(); } catch(e){}
                delete chartInstances[id];
             }
             const canvas = document.getElementById(id);
             if (canvas) { // Draw a placeholder message
                 const ctx = canvas.getContext('2d');
                 ctx.clearRect(0, 0, canvas.width, canvas.height);
                 ctx.fillStyle = '#666';
                 ctx.font = '14px sans-serif';
                 ctx.textAlign = 'center';
                 ctx.fillText('Select subsector', canvas.width / 2, canvas.height / 2);
             }
         });
         // Allow execution to continue to update the aggregate charts below this block.
    }

    // --- Tooltip Formatting ---
    // Custom callback function for tooltips to display values in ExaJoules (EJ)
    const ejTooltipCallback = (context) => {
        let label = context.dataset.label || ''; // Get the dataset label (e.g., 'Coal')
        if (label) { label += ': '; }
        let value = context.parsed?.y; // Get the parsed Y value for the hovered item
        // Check if the value is a valid number
        if (value !== null && typeof value !== 'undefined' && !isNaN(value)) {
            label += value.toFixed(3) + ' EJ'; // Format to 3 decimal places and add unit
        } else {
            label += 'N/A'; // Display N/A if value is invalid
        }
        return label;
    };

    // ========================================================================
    // --- Subsector Charts (Only update if a valid subsector is selected) ---
    // ========================================================================
    if (selectedSector && selectedSubsector) {
        // Get the list of technologies for the selected subsector
        const subsectorTechs = getValue(technologies, [selectedSector, selectedSubsector], []);
        // Get the activity unit string for the selected subsector
        const activityUnit = getValue(activityUnits, [selectedSector, selectedSubsector], 'Units');

        // --- 1. Subsector Activity by Technology ---
        // Create datasets for each technology in the subsector
        const activityByTechDatasets = subsectorTechs.map((tech, techIndex) => ({
            label: tech, // Technology name as label
            // Map through each year to get the activity value for this tech
            data: chartLabels.map(y => getValue(yearlyResults, [y, 'demandTechActivity', selectedSector, selectedSubsector, tech], 0)),
            backgroundColor: getTechColor(tech, techIndex), // Assign color using the helper
        }))
        // Filter out datasets that have no data or only negligible values
        .filter(ds => ds.data.some(v => Math.abs(v) > 1e-3)); // Check if any value is significant

        // Create/update the activity chart
        createChart('subsectorActivityChart', 'bar', // Use a bar chart
            { labels: chartLabels, datasets: activityByTechDatasets },
            { // Custom options for this chart
                plugins: {
                    tooltip: { mode: 'index' }, // Show tooltip for all bars at that index
                    title: { display: false } // Use the H3 in the chart-box as the title
                },
                scales: {
                    x: { stacked: true, title: { display: false } }, // Stack bars horizontally
                    y: { stacked: true, beginAtZero: true, title: { display: true, text: `Activity (${activityUnit})` } } // Stack bars vertically, add Y-axis title with unit
                }
            });

        // --- 2. Subsector Final Energy Consumption (FEC) by Fuel ---
        // Create datasets for each end-use fuel
        const subsectorFecDatasets = endUseFuels.map((fuel, fuelIndex) => ({
            label: fuel, // Fuel name as label
            // Map through each year, summing FEC for this fuel across all techs in the subsector
            data: chartLabels.map(y => {
                let totalFuel = 0;
                subsectorTechs.forEach(tech => {
                    totalFuel += getValue(yearlyResults, [y, 'fecDetailed', selectedSector, selectedSubsector, tech, fuel], 0);
                });
                return totalFuel / GJ_PER_EJ; // Convert total from GJ to EJ
            }),
            backgroundColor: getTechColor(fuel, fuelIndex), // Assign color using the helper (uses updated fuel colors)
        }))
        .filter(ds => ds.data.some(v => v > 1e-9)); // Filter out zero/negligible datasets

        // Create/update the FEC chart
        createChart('subsectorFecChart', 'bar',
            { labels: chartLabels, datasets: subsectorFecDatasets },
            {
                plugins: {
                    tooltip: { mode: 'index', callbacks: { label: ejTooltipCallback } }, // Use EJ tooltip format
                    title: { display: false }
                },
                scales: {
                    x: { stacked: true, title: { display: false } },
                    y: { stacked: true, beginAtZero: true, title: { display: true, text: 'FEC (EJ)' } } // Y-axis title
                }
            });

        // --- 3. Subsector Useful Energy (UE) by Fuel ---
        // Create datasets for each end-use fuel
        const subsectorUeDatasets = endUseFuels.map((fuel, fuelIndex) => ({
            label: fuel, // Fuel name as label
            // Map through each year, summing UE for this fuel across all techs in the subsector
            data: chartLabels.map(y => {
                let totalFuel = 0;
                subsectorTechs.forEach(tech => {
                    totalFuel += getValue(yearlyResults, [y, 'ueDetailed', selectedSector, selectedSubsector, tech, fuel], 0);
                });
                return totalFuel / GJ_PER_EJ; // Convert total from GJ to EJ
            }),
            backgroundColor: getTechColor(fuel, fuelIndex), // Assign color using the helper (uses updated fuel colors)
        }))
        .filter(ds => ds.data.some(v => v > 1e-9)); // Filter out zero/negligible datasets

        // Create/update the UE chart
        createChart('subsectorUeChart', 'bar',
            { labels: chartLabels, datasets: subsectorUeDatasets },
            {
                plugins: {
                    tooltip: { mode: 'index', callbacks: { label: ejTooltipCallback } }, // Use EJ tooltip format
                     title: { display: false }
                },
                scales: {
                    x: { stacked: true, title: { display: false } },
                    y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Useful Energy (EJ)' } } // Y-axis title
                }
            });
    } // End of subsector-specific chart updates

    // ========================================================================
    // --- Overall Energy Balance Charts (Always update) ---
    // ========================================================================

    // --- 4. Total Final Energy Consumption (FEC) by Fuel ---
    const totalFecDatasets = endUseFuels.map((fuel, fuelIndex) => ({
        label: fuel,
        // Map through years, getting the total FEC for this fuel directly from results
        data: chartLabels.map(y => getValue(yearlyResults, [y, 'fecByFuel', fuel], 0) / GJ_PER_EJ), // Convert GJ to EJ
        backgroundColor: getTechColor(fuel, fuelIndex), // Use updated fuel colors
    }))
    .filter(ds => ds.data.some(v => v > 1e-9)); // Filter out zero/negligible datasets

    createChart('fecFuelChart', 'bar',
        { labels: chartLabels, datasets: totalFecDatasets },
        {
            plugins: {
                tooltip: { mode: 'index', callbacks: { label: ejTooltipCallback } },
                title: { display: false }
            },
            scales: {
                x: { stacked: true, title: { display: false } },
                y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Total FEC (EJ)' } }
            }
        });

    // --- 5. Total Primary Energy Demand (PED) by Fuel ---
    const totalPedDatasets = primaryFuels.map((fuel, fuelIndex) => ({
        label: fuel,
        // Map through years, getting the total PED for this primary fuel
        data: chartLabels.map(y => getValue(yearlyResults, [y, 'pedByFuel', fuel], 0) / GJ_PER_EJ), // Convert GJ to EJ
        backgroundColor: getTechColor(fuel, fuelIndex), // Use primary fuel colors
    }))
    .filter(ds => ds.data.some(v => v > 1e-9));

    createChart('pedFuelChart', 'bar',
        { labels: chartLabels, datasets: totalPedDatasets },
        {
            plugins: {
                tooltip: { mode: 'index', callbacks: { label: ejTooltipCallback } },
                title: { display: false }
            },
            scales: {
                x: { stacked: true, title: { display: false } },
                y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Total PED (EJ)' } }
            }
        });

    // --- 6. Total Useful Energy (UE) by Fuel ---
    const totalUeDatasets = endUseFuels.map((fuel, fuelIndex) => ({
        label: fuel,
        // Map through years, getting the total UE for this end-use fuel
        data: chartLabels.map(y => getValue(yearlyResults, [y, 'ueByFuel', fuel], 0) / GJ_PER_EJ), // Convert GJ to EJ
        backgroundColor: getTechColor(fuel, fuelIndex), // Use updated fuel colors
    }))
    .filter(ds => ds.data.some(v => v > 1e-9));

    createChart('ueFuelChart', 'bar',
        { labels: chartLabels, datasets: totalUeDatasets },
        {
            plugins: {
                tooltip: { mode: 'index', callbacks: { label: ejTooltipCallback } },
                title: { display: false }
            },
            scales: {
                x: { stacked: true, title: { display: false } },
                y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Total Useful Energy (EJ)' } }
            }
        });

    // ========================================================================
    // --- Energy Supply & Transformations Charts (Always update) ---
    // ========================================================================

    // --- 7. Power Generation by Technology ---
    // First, get the total electricity generated each year (post-hydrogen demand)
    const totalElectricityGenSeries = chartLabels.map(y => getValue(yearlyResults, [y, 'ecPostHydrogen', 'Electricity'], 0));
    // Then, create datasets for each power generation technology
    const powerMixDatasets = powerTechs.map((tech, techIndex) => ({
        label: tech,
        // Map through years, calculating generation based on mix % and total generation
        data: chartLabels.map((y, yearIndex) => {
            const mixPercent = getValue(yearlyResults, [y, 'powerProdMix', tech], 0);
            // Calculate generation: (mix fraction * total electricity) / conversion factor
            return ((mixPercent / 100) * totalElectricityGenSeries[yearIndex]) / GJ_PER_EJ;
        }),
        backgroundColor: getTechColor(tech, techIndex), // Use power tech colors
    }))
    .filter(ds => ds.data.some(v => v > 1e-9));

    createChart('powerMixChart', 'bar',
        { labels: chartLabels, datasets: powerMixDatasets },
        {
            plugins: {
                tooltip: { mode: 'index', callbacks: { label: ejTooltipCallback } },
                title: { display: false }
            },
            scales: {
                x: { stacked: true, title: { display: false } },
                y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Power Generation (EJ)' } }
            }
        });

    // --- 8. Hydrogen Production by Technology ---
    // First, get the total hydrogen demand (FEC) each year
    const totalHydrogenProdSeries = chartLabels.map(y => getValue(yearlyResults, [y, 'fecByFuel', 'Hydrogen'], 0));
    // Then, create datasets for each hydrogen production technology
    const hydrogenMixDatasets = hydrogenTechs.map((tech, techIndex) => ({
        label: tech,
        // Map through years, calculating production based on mix % and total demand
        data: chartLabels.map((y, yearIndex) => {
            const mixPercent = getValue(yearlyResults, [y, 'hydrogenProdMix', tech], 0);
            // Calculate production: (mix fraction * total hydrogen) / conversion factor
            return ((mixPercent / 100) * totalHydrogenProdSeries[yearIndex]) / GJ_PER_EJ;
        }),
        backgroundColor: getTechColor(tech, techIndex), // Use hydrogen tech colors
    }))
    .filter(ds => ds.data.some(v => v > 1e-9));

    createChart('hydrogenMixChart', 'bar',
        { labels: chartLabels, datasets: hydrogenMixDatasets },
        {
            plugins: {
                tooltip: { mode: 'index', callbacks: { label: ejTooltipCallback } },
                title: { display: false }
            },
            scales: {
                x: { stacked: true, title: { display: false } },
                y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Hydrogen Production (EJ)' } }
            }
        });

    console.log("Charts updated successfully."); // Log success at the end
}
