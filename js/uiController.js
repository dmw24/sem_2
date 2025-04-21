// js/uiController.js
// Version: Fixed - Trigger chart update on view change + k/t0 Inputs + Filters

// --- UI Helper Functions ---
/**
 * Toggles the display of collapsible group content.
 * @param {HTMLElement} el - The title element (h3 or h4) that was clicked.
 */
function toggleGroup(el) {
    let content = el.nextElementSibling;
    // Ensure the sibling is the content div we expect
    if (!content || (!content.classList.contains('group-content') && !content.classList.contains('sub-group-content'))) {
        console.warn("Could not find content sibling for toggle element:", el);
        return;
    }
    // Toggle display and arrow class
    if (content.style.display === "none" || content.style.display === "") {
        content.style.display = "block";
        el.classList.remove("collapsed");
        el.classList.add("expanded");
    } else {
        content.style.display = "none";
        el.classList.remove("expanded");
        el.classList.add("collapsed");
    }
}

/**
 * Sanitizes a string to be used as part of an HTML ID.
 * Replaces invalid characters with underscores.
 */
function sanitizeForId(str) {
    if (typeof str !== 'string') str = String(str);
    // Remove or replace characters invalid in IDs
    let sanitized = str.replace(/[^a-zA-Z0-9_-]/g, '_');
    // Collapse multiple consecutive underscores
    sanitized = sanitized.replace(/__+/g, '_');
    // Remove leading/trailing underscores
    sanitized = sanitized.replace(/^_+|_+$/g, '');
     // Prevent IDs starting with a digit
     if (/^\d/.test(sanitized)) {
         sanitized = 'id_' + sanitized;
     }
    // Fallback for empty or invalid strings
    return sanitized || 'invalid_id';
}

/**
 * Shows or hides the S-curve parameter inputs based on the behavior selection.
 * @param {HTMLSelectElement} selectElement - The behavior select dropdown.
 * @param {string} paramKey - The unique key for this parameter set.
 */
function toggleSCurveInputs(selectElement, paramKey) {
    const containerId = `sCurveInputs_${sanitizeForId(paramKey)}`;
    const container = document.getElementById(containerId);
    if (container) {
        const isVisible = selectElement.value === 's-curve';
        container.style.display = isVisible ? 'block' : 'none';
        container.classList.toggle('visible', isVisible);
    } else {
        // This might happen briefly during initialization, usually not an issue
        // console.warn("S-Curve input container not found for key:", paramKey, "ID:", containerId);
    }
}

// --- Dynamic Input Creation Helpers ---
// Default behavior mappings (needed for setting initial UI state)
const defaultDeclineDemandTechsUI = { 'Transport|Passenger cars': 'ICE', 'Transport|Trucks': 'ICE', 'Transport|Buses': 'ICE', 'Transport|2/3 wheelers': 'ICE', 'Transport|Ships': 'Conventional ship', 'Transport|Planes': 'Conventional plane', 'Transport|Trains': 'Diesel train', 'Industry|Steel': 'BF-BOF', 'Industry|Cement': 'Conventional kiln', 'Industry|Chemicals': 'Conventional', 'Industry|Low temp. heating': 'Fossil boiler', 'Industry|High temp. heating': 'Fossil furnace', 'Industry|Other industry - energy': 'Conventional', 'Buildings|Residential heating': 'Fossil boiler', 'Buildings|Residential cooking': 'Conventional fossil', 'Buildings|Residential lighting': 'Conventional', 'Buildings|Other residential': 'Conventional', 'Buildings|Building cooling': 'Low efficiency airco', 'Buildings|Commercial heating': 'Fossil boiler', 'Buildings|Commercial lighting': 'Conventional', 'Buildings|Other commercial': 'Conventional', 'Transport|Other transport': 'Conventional' };
const defaultSCurveDemandTechsUI = { 'Transport|Passenger cars': 'EV', 'Transport|Trucks': 'EV', 'Transport|Buses': 'EV', 'Transport|2/3 wheelers': 'EV', 'Transport|Ships': 'Ammonia ship', 'Transport|Planes': 'Electric plane', 'Transport|Trains': 'Electric train', 'Industry|Steel': 'DRI-EAF (H2)', 'Industry|Cement': 'Electric kiln', 'Industry|Chemicals': 'Electrified', 'Industry|Low temp. heating': 'Heat pump', 'Industry|High temp. heating': 'Electric furnace', 'Industry|Other industry - energy': 'Electrified', 'Buildings|Residential heating': 'Heat pump', 'Buildings|Residential cooking': 'Electrified', 'Buildings|Residential lighting': 'Full LED', 'Buildings|Other residential': 'Electrified', 'Buildings|Building cooling': 'High efficiency airco', 'Buildings|Commercial heating': 'Heat pump', 'Buildings|Commercial lighting': 'Full LED', 'Buildings|Other commercial': 'Electrified', 'Transport|Other transport': 'Electrified' };
const defaultDeclinePowerTechsUI = ['Gas power', 'Coal power', 'Oil power'];
const defaultSCurvePowerTechsUI = ['Solar PV', 'Wind'];
const defaultDeclineHydrogenTechsUI = ['Blue'];
const defaultSCurveHydrogenTechsUI = ['Green'];
// Define years locally for UI defaults
const uiStartYear = 2023;
const uiEndYear = 2050;

/**
 * Creates the HTML elements for S-curve parameters (Target Share, Target Year, Steepness k, Midpoint Year t0).
 * @param {string} paramKey - Unique identifier for the parameter set.
 * @param {number} baseValue - The base year share value (%) for default target.
 * @returns {HTMLDivElement} The container div with the input elements.
 */
const createSCurveParamInputs = (paramKey, baseValue) => {
    const div = document.createElement('div');
    div.className = 's-curve-inputs';
    const sanitizedParamKey = sanitizeForId(paramKey);
    div.id = `sCurveInputs_${sanitizedParamKey}`;

    const targetInputId = `sCurveTarget_${sanitizedParamKey}`;
    const targetYearInputId = `sCurveTargetYear_${sanitizedParamKey}`;
    const kValueInputId = `sCurveKValue_${sanitizedParamKey}`;
    const midpointYearInputId = `sCurveMidpointYear_${sanitizedParamKey}`; // t0 input ID

    // Target Share Input
    const targetLabel = document.createElement('label'); targetLabel.htmlFor = targetInputId; targetLabel.textContent = `Target Share (%):`;
    const targetInput = document.createElement('input'); targetInput.type = 'number'; targetInput.id = targetInputId; targetInput.min = '0'; targetInput.max = '100'; targetInput.step = '1'; targetInput.value = Math.min(100, Math.max(0, baseValue + 5)).toFixed(1);
    div.appendChild(targetLabel); div.appendChild(targetInput);

    // Target Year Input
    const targetYearLabel = document.createElement('label'); targetYearLabel.htmlFor = targetYearInputId; targetYearLabel.textContent = `Target Year:`;
    const targetYearInput = document.createElement('input'); targetYearInput.type = 'number'; targetYearInput.id = targetYearInputId; targetYearInput.min = String(uiStartYear + 1); targetYearInput.max = String(uiEndYear + 10); targetYearInput.step = '1'; targetYearInput.value = String(uiEndYear);
    div.appendChild(targetYearLabel); div.appendChild(targetYearInput);

    // Steepness (k) Input
    const kValueLabel = document.createElement('label'); kValueLabel.htmlFor = kValueInputId; kValueLabel.textContent = `Steepness (k):`;
    const kValueInput = document.createElement('input'); kValueInput.type = 'number'; kValueInput.id = kValueInputId; kValueInput.min = '0.01'; kValueInput.max = '1.0'; kValueInput.step = '0.01'; kValueInput.value = '0.15'; // Default k
    div.appendChild(kValueLabel); div.appendChild(kValueInput);
    const kValueHelp = document.createElement('small'); kValueHelp.textContent = "Controls growth rate (e.g., 0.1 ≈ 10%/yr initial relative growth).";
    div.appendChild(kValueHelp);

    // Midpoint Year (t0) Input
    const midpointYearLabel = document.createElement('label'); midpointYearLabel.htmlFor = midpointYearInputId; midpointYearLabel.textContent = `Midpoint Year (t0):`;
    const midpointYearInput = document.createElement('input'); midpointYearInput.type = 'number'; midpointYearInput.id = midpointYearInputId; midpointYearInput.min = String(uiStartYear - 10); // Allow midpoint before start year
    midpointYearInput.max = String(uiEndYear + 10); // Allow midpoint after target year
    midpointYearInput.step = '1';
    const defaultMidpoint = Math.round(uiStartYear + (parseInt(targetYearInput.value, 10) - uiStartYear) / 2); // Default halfway
    midpointYearInput.value = String(defaultMidpoint);
    div.appendChild(midpointYearLabel); div.appendChild(midpointYearInput);
    const midpointHelp = document.createElement('small'); midpointHelp.textContent = "Year when growth is fastest.";
    div.appendChild(midpointHelp);

    return div;
};

/**
 * Creates the HTML elements for a single technology's behavior controls.
 */
const createTechInput = (categoryType, categoryKey, tech, baseMixObject) => {
    const container = document.createElement('div');
    container.className = 'tech-input-container';
    const legend = document.createElement('legend');
    legend.textContent = tech;
    container.appendChild(legend);
    const paramKey = `${categoryType}|${categoryKey}|${tech}`;
    const sanitizedParamKey = sanitizeForId(paramKey);
    // Use the getValue helper function if available globally, otherwise basic access
    const baseValue = (typeof getValue === 'function') ? getValue(baseMixObject, [tech], 0) : (baseMixObject?.[tech] || 0);
    const behaviorDiv = document.createElement('div');
    behaviorDiv.className = 'tech-behavior-selector';
    const behaviorLabel = document.createElement('label');
    behaviorLabel.htmlFor = `behavior_${sanitizedParamKey}`;
    behaviorLabel.textContent = 'Behavior: ';
    const behaviorSelect = document.createElement('select');
    behaviorSelect.id = `behavior_${sanitizedParamKey}`;
    behaviorSelect.onchange = () => toggleSCurveInputs(behaviorSelect, paramKey);
    ['Fixed', 'S-Curve (Growth)', 'Decline'].forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.toLowerCase().split(' ')[0]; // 'fixed', 's-curve', 'decline'
        option.textContent = opt;
        behaviorSelect.appendChild(option);
    });
    // Determine default behavior based on mappings
    let defaultBehavior = 'fixed';
    const fullCatKey = categoryKey; // Use the combined key directly for demand
    if ((categoryType === 'Demand' && defaultDeclineDemandTechsUI[fullCatKey] === tech) ||
        (categoryType === 'Power' && defaultDeclinePowerTechsUI.includes(tech)) ||
        (categoryType === 'Hydrogen' && defaultDeclineHydrogenTechsUI.includes(tech))) {
        defaultBehavior = 'decline';
    } else if ((categoryType === 'Demand' && defaultSCurveDemandTechsUI[fullCatKey] === tech) ||
               (categoryType === 'Power' && defaultSCurvePowerTechsUI.includes(tech)) ||
               (categoryType === 'Hydrogen' && defaultSCurveHydrogenTechsUI.includes(tech))) {
        defaultBehavior = 's-curve';
    }
    behaviorSelect.value = defaultBehavior;
    behaviorDiv.appendChild(behaviorLabel);
    behaviorDiv.appendChild(behaviorSelect);
    container.appendChild(behaviorDiv);
    // Create S-curve inputs (k and t0)
    const sCurveInputsDiv = createSCurveParamInputs(paramKey, baseValue);
    container.appendChild(sCurveInputsDiv);
    // Call toggle initially AFTER element is potentially added to DOM
    setTimeout(() => toggleSCurveInputs(behaviorSelect, paramKey), 0);
    return container;
};


// --- UI Initialization ---
/**
 * Dynamically creates the input groups in the sidebar based on loaded data.
 */
function initializeSidebarInputs(structuredData) {
    console.log("Initializing sidebar inputs...");
    const sidebarInputContainer = document.getElementById('inputGroupsContainer');
    if (!sidebarInputContainer) { console.error("Sidebar input container (#inputGroupsContainer) not found!"); return; }
    sidebarInputContainer.innerHTML = ''; // Clear previous inputs

    // Log data used for UI generation
    // console.log("DEBUG (uiController - initializeSidebarInputs): Data received:", { sectors: structuredData?.sectors, subsectors: structuredData?.subsectors, technologies: structuredData?.technologies, baseDemandTechMix: structuredData?.baseDemandTechMix });

    const { sectors, subsectors, technologies, baseDemandTechMix, basePowerProdMix, baseHydrogenProdMix, powerTechs, hydrogenTechs } = structuredData || {};

     if (!sectors || !subsectors || !technologies || !baseDemandTechMix || !basePowerProdMix || !baseHydrogenProdMix || !powerTechs || !hydrogenTechs) { console.error("DEBUG (uiController - initializeSidebarInputs): Missing essential data structures for building inputs!"); sidebarInputContainer.innerHTML = '<p style="color: red;">Error: Could not load data needed to build parameter inputs.</p>'; return; }
     let groupsAddedCount = 0;

    // Create End-Use Sector Groups
    (sectors || []).forEach(s => {
        if (s === 'Power' || s === 'Energy industry') return;
        const sectorSubsectors = subsectors[s] || [];
        // console.log(`DEBUG (uiController - initializeSidebarInputs): Processing Sector "${s}", Subsectors: [${sectorSubsectors.join(', ')}]`);
        if (sectorSubsectors.length === 0) return;

        const sectorGroup = document.createElement('div'); sectorGroup.className = 'group';
        const sectorTitle = document.createElement('h3'); sectorTitle.className = 'group-title collapsed'; sectorTitle.textContent = s; sectorTitle.onclick = function() { toggleGroup(this); };
        const sectorContent = document.createElement('div'); sectorContent.className = 'group-content'; sectorContent.style.display = 'none';

        sectorSubsectors.forEach(b => {
            const subGroup = document.createElement('div'); subGroup.className = 'sub-group';
            const subTitle = document.createElement('h4'); subTitle.className = 'sub-group-title collapsed'; subTitle.textContent = b; subTitle.onclick = function() { toggleGroup(this); };
            const subContent = document.createElement('div'); subContent.className = 'sub-group-content'; subContent.style.display = 'none';
            const activityDiv = document.createElement('div'); activityDiv.className = 'activity-growth-input'; const activityLabel = document.createElement('label'); const activityInputId = `growth_${sanitizeForId(s)}_${sanitizeForId(b)}`; activityLabel.htmlFor = activityInputId; activityLabel.textContent = `Activity Growth (%/yr):`; const activityInput = document.createElement('input'); activityInput.type = 'number'; activityInput.id = activityInputId; activityInput.value = '0.5'; activityInput.step = '0.1'; activityDiv.appendChild(activityLabel); activityDiv.appendChild(activityInput); subContent.appendChild(activityDiv);
            const techs = technologies[s]?.[b] || [];
            const baseMix = getValue(baseDemandTechMix, [s, b], {});
            // console.log(`DEBUG (uiController - initializeSidebarInputs):   Subsector "${b}", Techs: [${techs.join(', ')}], BaseMix:`, baseMix);
            if (techs.length === 0) { subContent.innerHTML += '<p><small>No technologies defined.</small></p>'; }
            else { techs.forEach(t => { subContent.appendChild(createTechInput('Demand', `${s}|${b}`, t, baseMix)); }); }
            subGroup.appendChild(subTitle); subGroup.appendChild(subContent); sectorContent.appendChild(subGroup);
        });
        sectorGroup.appendChild(sectorTitle); sectorGroup.appendChild(sectorContent); sidebarInputContainer.appendChild(sectorGroup); groupsAddedCount++;
    });

    // Create Power Generation Group
    const powerGroup = document.createElement('div'); powerGroup.className = 'group'; const powerTitle = document.createElement('h3'); powerTitle.className = 'group-title collapsed'; powerTitle.textContent = 'Power Generation'; powerTitle.onclick = function() { toggleGroup(this); }; const powerContent = document.createElement('div'); powerContent.className = 'group-content'; powerContent.style.display = 'none';
    // console.log(`DEBUG (uiController - initializeSidebarInputs): Processing Power, Techs: [${(powerTechs || []).join(', ')}]`);
    (powerTechs || []).forEach(t => { powerContent.appendChild(createTechInput('Power', 'Power', t, basePowerProdMix)); });
    powerGroup.appendChild(powerTitle); powerGroup.appendChild(powerContent); sidebarInputContainer.appendChild(powerGroup); groupsAddedCount++;

    // Create Hydrogen Production Group
    const hydrogenGroup = document.createElement('div'); hydrogenGroup.className = 'group'; const hydrogenTitle = document.createElement('h3'); hydrogenTitle.className = 'group-title collapsed'; hydrogenTitle.textContent = 'Hydrogen Production'; hydrogenTitle.onclick = function() { toggleGroup(this); }; const hydrogenContent = document.createElement('div'); hydrogenContent.className = 'group-content'; hydrogenContent.style.display = 'none';
    // console.log(`DEBUG (uiController - initializeSidebarInputs): Processing Hydrogen, Techs: [${(hydrogenTechs || []).join(', ')}]`);
    (hydrogenTechs || []).forEach(t => { hydrogenContent.appendChild(createTechInput('Hydrogen', 'Hydrogen', t, baseHydrogenProdMix)); });
    hydrogenGroup.appendChild(hydrogenTitle); hydrogenGroup.appendChild(hydrogenContent); sidebarInputContainer.appendChild(hydrogenGroup); groupsAddedCount++;

    // console.log(`DEBUG (uiController - initializeSidebarInputs): Finished adding ${groupsAddedCount} groups to sidebar.`);
    if(groupsAddedCount === 0) { sidebarInputContainer.innerHTML = '<p style="color: orange;">Warning: No input groups were generated.</p>'; }

    console.log("Sidebar inputs initialized.");
}

/**
 * Populates the subsector selection dropdown.
 */
function populateSubsectorDropdown(structuredData) {
    const subsectorSelect = document.getElementById('selectSubsector'); if (!subsectorSelect) { console.error("Subsector select dropdown not found!"); return; } subsectorSelect.innerHTML = ''; const { allEndUseSubsectors } = structuredData; let firstSubsectorKey = null; if (!allEndUseSubsectors || allEndUseSubsectors.length === 0) { console.warn("No end-use subsectors found in data to populate dropdown."); const option = document.createElement('option'); option.value = ""; option.textContent = "No subsectors available"; subsectorSelect.appendChild(option); return; } allEndUseSubsectors.forEach(({ sector, subsector }) => { const option = document.createElement('option'); const key = `${sector}|${subsector}`; option.value = key; option.textContent = `${sector} - ${subsector}`; subsectorSelect.appendChild(option); if (!firstSubsectorKey) firstSubsectorKey = key; }); if (firstSubsectorKey) { subsectorSelect.value = firstSubsectorKey; const subsectorNameSpan = document.getElementById('selectedSubsectorName'); if (subsectorNameSpan) { const [selSector, selSubsector] = firstSubsectorKey.split('|'); subsectorNameSpan.textContent = `${selSector} - ${selSubsector}`; } } console.log("Subsector dropdown populated."); }

/**
 * Populates the sector filter dropdown for the balance charts.
 */
function populateBalanceFilters(structuredData) {
    const sectorSelect = document.getElementById('selectBalanceSector'); if (!sectorSelect) { console.error("Balance chart sector filter not found!"); return; } sectorSelect.innerHTML = '<option value="all" selected>All Sectors</option>';
    (structuredData.sectors || []).forEach(sector => { const option = document.createElement('option'); option.value = sector; option.textContent = (sector === 'Energy industry') ? 'Hydrogen Supply' : sector; sectorSelect.appendChild(option); });
    const subsectorContainer = document.getElementById('balanceSubsectorFilterContainer'); if (subsectorContainer) { subsectorContainer.classList.add('hidden'); } console.log("Balance chart filters populated."); }

/**
 * Updates the subsector filter dropdown based on the selected sector.
 */
function updateBalanceSubsectorFilter(selectedSector, structuredData) {
    const subsectorContainer = document.getElementById('balanceSubsectorFilterContainer'); const subsectorSelect = document.getElementById('selectBalanceSubsector'); if (!subsectorContainer || !subsectorSelect) { console.error("Balance subsector filter elements not found!"); return; } subsectorSelect.innerHTML = '<option value="all" selected>All Subsectors</option>'; const isEndUseSector = selectedSector && selectedSector !== 'all' && selectedSector !== 'Power' && selectedSector !== 'Energy industry'; if (isEndUseSector && structuredData.subsectors && structuredData.subsectors[selectedSector]) { (structuredData.subsectors[selectedSector] || []).forEach(subsector => { const option = document.createElement('option'); option.value = subsector; option.textContent = subsector; subsectorSelect.appendChild(option); }); subsectorContainer.classList.remove('hidden'); } else { subsectorContainer.classList.add('hidden'); } }

/**
 * Updates visibility of FEC and UE charts based on selected sector filter.
 */
function updateBalanceChartVisibility(selectedSector) {
    const fecChartBox = document.getElementById('fecChartBox');
    const ueChartBox = document.getElementById('ueChartBox');
    const hideFecUe = (selectedSector === 'Power' || selectedSector === 'Energy industry');
    if (fecChartBox) fecChartBox.classList.toggle('hidden', hideFecUe);
    if (ueChartBox) ueChartBox.classList.toggle('hidden', hideFecUe);
}


// --- Input Gathering ---
/**
 * Reads the current values from all sidebar inputs.
 */
function getUserInputsAndParams(structuredData) {
    const { sectors, subsectors, technologies, powerTechs, hydrogenTechs, allEndUseSubsectors, startYear, endYear } = structuredData;
    const userInputParameters = { activityGrowthFactors: {}, techBehaviorsAndParams: {} };

    // Read Activity Growth Rates
    (allEndUseSubsectors || []).forEach(({ sector, subsector }) => { const inputId = `growth_${sanitizeForId(sector)}_${sanitizeForId(subsector)}`; const inputElement = document.getElementById(inputId); const growthPercent = inputElement ? parseFloat(inputElement.value) : 0; const growthFactor = isNaN(growthPercent) ? 1.0 : 1 + (growthPercent / 100); userInputParameters.activityGrowthFactors[`${sector}|${subsector}`] = growthFactor; });

    // Read Technology Behaviors and S-Curve Parameters
    const readTechInputs = (categoryType, categoryKey, techList) => {
        (techList || []).forEach(t => {
            const paramKey = `${categoryType}|${categoryKey}|${t}`;
            const sanitizedParamKey = sanitizeForId(paramKey);
            const behaviorEl = document.getElementById(`behavior_${sanitizedParamKey}`);
            const behavior = behaviorEl ? behaviorEl.value : 'fixed';
            const techParams = { behavior: behavior };

            if (behavior === 's-curve') {
                const targetEl = document.getElementById(`sCurveTarget_${sanitizedParamKey}`);
                const targetYearEl = document.getElementById(`sCurveTargetYear_${sanitizedParamKey}`);
                const kValueEl = document.getElementById(`sCurveKValue_${sanitizedParamKey}`);
                const midpointYearEl = document.getElementById(`sCurveMidpointYear_${sanitizedParamKey}`);

                techParams.targetShare = targetEl ? parseFloat(targetEl.value) : 0;
                techParams.targetYear = targetYearEl ? parseInt(targetYearEl.value, 10) : endYear;
                techParams.kValue = kValueEl ? parseFloat(kValueEl.value) : 0.15; // Read k
                techParams.midpointYear = midpointYearEl ? parseInt(midpointYearEl.value, 10) : Math.round(startYear + (endYear - startYear) / 2); // Read t0

                // Basic validation/defaults
                if (isNaN(techParams.targetShare)) techParams.targetShare = 0;
                if (isNaN(techParams.targetYear)) techParams.targetYear = endYear;
                if (isNaN(techParams.kValue) || techParams.kValue <= 0) techParams.kValue = 0.15;
                if (isNaN(techParams.midpointYear)) { techParams.midpointYear = Math.round(startYear + (techParams.targetYear - startYear) / 2); }
            }
            userInputParameters.techBehaviorsAndParams[paramKey] = techParams;
        });
    };

    // Read Demand, Power, Hydrogen Techs
    sectors.forEach(s => { if (subsectors[s]){ subsectors[s].forEach(b => { readTechInputs('Demand', `${s}|${b}`, technologies[s]?.[b] || []); }); } });
    readTechInputs('Power', 'Power', powerTechs);
    readTechInputs('Hydrogen', 'Hydrogen', hydrogenTechs);

    return userInputParameters;
}


// --- Event Listener Setup ---

// Helper to trigger chart update - defined globally within this file's scope
function triggerChartUpdate() {
    // Ensure necessary functions and state are available
    // Assumes appState, updateCharts, getCurrentFilters are accessible globally or imported
    if (typeof updateCharts !== 'function') { console.error("updateCharts function is not defined."); return; }
    if (typeof getCurrentFilters !== 'function') { console.error("getCurrentFilters function is not defined."); return; }
    if (typeof appState !== 'object' || !appState.latestResults || !appState.structuredData) {
         console.warn("Cannot trigger chart update: Results or structured data not available in appState.");
         return;
    }
    const filters = getCurrentFilters(); // Get current filter state
    console.log("Triggering chart update with filters:", filters);
    updateCharts(appState.latestResults, appState.structuredData, filters); // Pass filters
};

/**
 * Handles changes in the main chart view selector dropdown.
 */
function handleChartViewChange() {
    const chartViewSelect = document.getElementById('selectChartView');
    const subsectorSelectorDiv = document.getElementById('subsectorSelector');
    const subsectorChartsSection = document.getElementById('subsectorChartsSection');
    const balanceChartsSection = document.getElementById('balanceChartsSection');
    const supplyChartsSection = document.getElementById('supplyChartsSection');
    const balanceSectorSelect = document.getElementById('selectBalanceSector'); // Needed for visibility check

    if (!chartViewSelect || !subsectorSelectorDiv || !subsectorChartsSection || !balanceChartsSection || !supplyChartsSection || !balanceSectorSelect) {
        console.error("One or more chart view elements not found!");
        return;
    }

    const selectedView = chartViewSelect.value;
    const selectedBalanceSector = balanceSectorSelect.value;

    // Show/hide subsector selector
    subsectorSelectorDiv.classList.toggle('hidden', selectedView !== 'subsector');

    // Show/hide chart sections
    const showSubsector = selectedView === 'subsector';
    const showBalance = selectedView === 'balance';
    const showSupply = selectedView === 'supply';

    subsectorChartsSection.classList.toggle('hidden', !showSubsector);
    balanceChartsSection.classList.toggle('hidden', !showBalance);
    supplyChartsSection.classList.toggle('hidden', !showSupply);

    console.log(`Chart view changed to: ${selectedView}`);

    // Update visibility of balance charts specifically if balance view is selected
    if (showBalance) {
        updateBalanceChartVisibility(selectedBalanceSector);
    }

    // *** ADDED: Trigger chart update AFTER visibility is set ***
    // This ensures charts are drawn when their section becomes visible
     if (typeof appState !== 'object' || !appState.latestResults) {
         console.log("No results yet, skipping chart update on view change.");
     } else {
         // Only trigger update if the relevant section is now visible
         if ((showSubsector && !subsectorChartsSection.classList.contains('hidden')) ||
             (showBalance && !balanceChartsSection.classList.contains('hidden')) ||
             (showSupply && !supplyChartsSection.classList.contains('hidden')))
         {
              console.log("View changed, triggering chart update for visible section.");
              // Use the globally defined helper
              triggerChartUpdate();
         }
     }
}


/**
 * Gets the current filter settings from the UI.
 */
function getCurrentFilters() { const balanceSectorSelect = document.getElementById('selectBalanceSector'); const balanceSubsectorSelect = document.getElementById('selectBalanceSubsector'); const ueModeFuel = document.querySelector('input[name="ueDisplayMode"][value="fuel"]'); return { balanceSector: balanceSectorSelect ? balanceSectorSelect.value : 'all', balanceSubsector: balanceSubsectorSelect ? balanceSubsectorSelect.value : 'all', ueDisplayMode: ueModeFuel?.checked ? 'fuel' : 'type' }; }

/**
 * Sets up event listeners for the Run button and all dropdowns/filters.
 * @param {object} appState - The shared application state object from main.js
 */
function setupEventListeners(appState) {
    const runButton = document.getElementById('runModelBtn');
    const subsectorSelect = document.getElementById('selectSubsector');
    const chartViewSelect = document.getElementById('selectChartView');
    const balanceSectorSelect = document.getElementById('selectBalanceSector');
    const balanceSubsectorSelect = document.getElementById('selectBalanceSubsector');
    const ueDisplayModeRadios = document.querySelectorAll('input[name="ueDisplayMode"]');

    const { structuredData } = appState;
    if (!structuredData) { console.error("Cannot setup event listeners: structuredData missing."); return; }

    // Check elements exist
    if (!runButton || !subsectorSelect || !chartViewSelect || !balanceSectorSelect || !balanceSubsectorSelect || !ueDisplayModeRadios) { console.error("One or more UI elements for event listeners not found!"); return; }

    // Assign Listeners
    runButton.onclick = async () => { runButton.disabled = true; runButton.textContent = 'Calculating...'; console.log("Run button clicked..."); try { const userInputs = getUserInputsAndParams(structuredData); if (typeof runModelCalculation !== 'function') { throw new Error("runModelCalculation function is not defined."); } const modelResults = await runModelCalculation(structuredData, userInputs); appState.latestResults = modelResults; triggerChartUpdate(); } catch (error) { console.error("Error during model execution or chart update:", error); alert(`An error occurred: ${error.message}.`); } finally { runButton.disabled = false; runButton.textContent = 'Run Model & Update Charts'; } };
    subsectorSelect.onchange = () => { console.log("Subsector selection changed."); triggerChartUpdate(); };
    chartViewSelect.onchange = handleChartViewChange; // Use the updated handler
    balanceSectorSelect.onchange = () => { console.log("Balance sector filter changed."); const selectedSector = balanceSectorSelect.value; updateBalanceSubsectorFilter(selectedSector, structuredData); updateBalanceChartVisibility(selectedSector); triggerChartUpdate(); };
    balanceSubsectorSelect.onchange = () => { console.log("Balance subsector filter changed."); triggerChartUpdate(); };
    ueDisplayModeRadios.forEach(radio => { radio.onchange = () => { if (radio.checked) { console.log(`UE display mode changed to: ${radio.value}`); triggerChartUpdate(); } }; });

    // Initial setup for visibility
    handleChartViewChange();
    updateBalanceChartVisibility(balanceSectorSelect.value);

    console.log("UI Event listeners set up.");
}
