// js/uiController.js
// Version: Added Balance Chart Filters & Event Handlers

// --- UI Helper Functions ---
function toggleGroup(el) { let content = el.nextElementSibling; if (!content || (!content.classList.contains('group-content') && !content.classList.contains('sub-group-content'))) { console.warn("Could not find content sibling for toggle element:", el); return; } if (content.style.display === "none" || content.style.display === "") { content.style.display = "block"; el.classList.remove("collapsed"); el.classList.add("expanded"); } else { content.style.display = "none"; el.classList.remove("expanded"); el.classList.add("collapsed"); } }
function sanitizeForId(str) { if (typeof str !== 'string') str = String(str); let sanitized = str.replace(/[^a-zA-Z0-9_-]/g, '_'); sanitized = sanitized.replace(/__+/g, '_'); sanitized = sanitized.replace(/^_+|_+$/g, ''); if (/^\d/.test(sanitized)) { sanitized = 'id_' + sanitized; } return sanitized || 'invalid_id'; }
function toggleSCurveInputs(selectElement, paramKey) { const containerId = `sCurveInputs_${sanitizeForId(paramKey)}`; const container = document.getElementById(containerId); if (container) { const isVisible = selectElement.value === 's-curve'; container.style.display = isVisible ? 'block' : 'none'; container.classList.toggle('visible', isVisible); } }

// --- Dynamic Input Creation Helpers ---
const defaultDeclineDemandTechsUI = { /* ... */ }; const defaultSCurveDemandTechsUI = { /* ... */ }; const defaultDeclinePowerTechsUI = ['Gas power', 'Coal power', 'Oil power']; const defaultSCurvePowerTechsUI = ['Solar PV', 'Wind']; const defaultDeclineHydrogenTechsUI = ['Blue']; const defaultSCurveHydrogenTechsUI = ['Green']; const uiStartYear = 2023; const uiEndYear = 2050;
const createSCurveParamInputs = (paramKey, baseValue) => { /* ... (k and t0 inputs - unchanged) ... */ const div = document.createElement('div'); div.className = 's-curve-inputs'; const sanitizedParamKey = sanitizeForId(paramKey); div.id = `sCurveInputs_${sanitizedParamKey}`; const targetInputId = `sCurveTarget_${sanitizedParamKey}`; const targetYearInputId = `sCurveTargetYear_${sanitizedParamKey}`; const kValueInputId = `sCurveKValue_${sanitizedParamKey}`; const midpointYearInputId = `sCurveMidpointYear_${sanitizedParamKey}`; const targetLabel = document.createElement('label'); targetLabel.htmlFor = targetInputId; targetLabel.textContent = `Target Share (%):`; const targetInput = document.createElement('input'); targetInput.type = 'number'; targetInput.id = targetInputId; targetInput.min = '0'; targetInput.max = '100'; targetInput.step = '1'; targetInput.value = Math.min(100, Math.max(0, baseValue + 5)).toFixed(1); div.appendChild(targetLabel); div.appendChild(targetInput); const targetYearLabel = document.createElement('label'); targetYearLabel.htmlFor = targetYearInputId; targetYearLabel.textContent = `Target Year:`; const targetYearInput = document.createElement('input'); targetYearInput.type = 'number'; targetYearInput.id = targetYearInputId; targetYearInput.min = String(uiStartYear + 1); targetYearInput.max = String(uiEndYear + 10); targetYearInput.step = '1'; targetYearInput.value = String(uiEndYear); div.appendChild(targetYearLabel); div.appendChild(targetYearInput); const kValueLabel = document.createElement('label'); kValueLabel.htmlFor = kValueInputId; kValueLabel.textContent = `Steepness (k):`; const kValueInput = document.createElement('input'); kValueInput.type = 'number'; kValueInput.id = kValueInputId; kValueInput.min = '0.01'; kValueInput.max = '1.0'; kValueInput.step = '0.01'; kValueInput.value = '0.15'; div.appendChild(kValueLabel); div.appendChild(kValueInput); const kValueHelp = document.createElement('small'); kValueHelp.textContent = "Controls growth rate (e.g., 0.1 ≈ 10%/yr initial relative growth)."; div.appendChild(kValueHelp); const midpointYearLabel = document.createElement('label'); midpointYearLabel.htmlFor = midpointYearInputId; midpointYearLabel.textContent = `Midpoint Year (t0):`; const midpointYearInput = document.createElement('input'); midpointYearInput.type = 'number'; midpointYearInput.id = midpointYearInputId; midpointYearInput.min = String(uiStartYear - 10); midpointYearInput.max = String(uiEndYear + 10); midpointYearInput.step = '1'; const defaultMidpoint = Math.round(uiStartYear + (parseInt(targetYearInput.value, 10) - uiStartYear) / 2); midpointYearInput.value = String(defaultMidpoint); div.appendChild(midpointYearLabel); div.appendChild(midpointYearInput); const midpointHelp = document.createElement('small'); midpointHelp.textContent = "Year when growth is fastest."; div.appendChild(midpointHelp); return div; };
const createTechInput = (categoryType, categoryKey, tech, baseMixObject) => { /* ... (unchanged) ... */ const container = document.createElement('div'); container.className = 'tech-input-container'; const legend = document.createElement('legend'); legend.textContent = tech; container.appendChild(legend); const paramKey = `${categoryType}|${categoryKey}|${tech}`; const sanitizedParamKey = sanitizeForId(paramKey); const baseValue = (typeof getValue === 'function') ? getValue(baseMixObject, [tech], 0) : (baseMixObject?.[tech] || 0); const behaviorDiv = document.createElement('div'); behaviorDiv.className = 'tech-behavior-selector'; const behaviorLabel = document.createElement('label'); behaviorLabel.htmlFor = `behavior_${sanitizedParamKey}`; behaviorLabel.textContent = 'Behavior: '; const behaviorSelect = document.createElement('select'); behaviorSelect.id = `behavior_${sanitizedParamKey}`; behaviorSelect.onchange = () => toggleSCurveInputs(behaviorSelect, paramKey); ['Fixed', 'S-Curve (Growth)', 'Decline'].forEach(opt => { const option = document.createElement('option'); option.value = opt.toLowerCase().split(' ')[0]; option.textContent = opt; behaviorSelect.appendChild(option); }); let defaultBehavior = 'fixed'; const fullCatKey = categoryKey; if ((categoryType === 'Demand' && defaultDeclineDemandTechsUI[fullCatKey] === tech) || (categoryType === 'Power' && defaultDeclinePowerTechsUI.includes(tech)) || (categoryType === 'Hydrogen' && defaultDeclineHydrogenTechsUI.includes(tech))) { defaultBehavior = 'decline'; } else if ((categoryType === 'Demand' && defaultSCurveDemandTechsUI[fullCatKey] === tech) || (categoryType === 'Power' && defaultSCurvePowerTechsUI.includes(tech)) || (categoryType === 'Hydrogen' && defaultSCurveHydrogenTechsUI.includes(tech))) { defaultBehavior = 's-curve'; } behaviorSelect.value = defaultBehavior; behaviorDiv.appendChild(behaviorLabel); behaviorDiv.appendChild(behaviorSelect); container.appendChild(behaviorDiv); const sCurveInputsDiv = createSCurveParamInputs(paramKey, baseValue); container.appendChild(sCurveInputsDiv); setTimeout(() => toggleSCurveInputs(behaviorSelect, paramKey), 0); return container; };

// --- UI Initialization ---
function initializeSidebarInputs(structuredData) { /* ... (unchanged) ... */ }
function populateSubsectorDropdown(structuredData) { /* ... (unchanged) ... */ }

/**
 * Populates the sector filter dropdown for the balance charts.
 * @param {object} structuredData - The data object from dataLoader.js.
 */
function populateBalanceFilters(structuredData) {
    const sectorSelect = document.getElementById('selectBalanceSector');
    if (!sectorSelect) { console.error("Balance chart sector filter not found!"); return; }
    sectorSelect.innerHTML = '<option value="all" selected>All Sectors</option>'; // Reset

    // Populate with end-use sectors only for filtering balance charts
    const endUseSectors = structuredData.sectors?.filter(s => s !== 'Power' && s !== 'Energy industry') || [];
    endUseSectors.forEach(sector => {
        const option = document.createElement('option');
        option.value = sector;
        option.textContent = sector;
        sectorSelect.appendChild(option);
    });
     // Ensure subsector filter is initially hidden
     const subsectorContainer = document.getElementById('balanceSubsectorFilterContainer');
     if (subsectorContainer) {
         subsectorContainer.classList.add('hidden');
     }
     console.log("Balance chart filters populated.");
}

/**
 * Updates the subsector filter dropdown based on the selected sector.
 * @param {string} selectedSector - The currently selected sector ('all' or a specific sector).
 * @param {object} structuredData - The data object from dataLoader.js.
 */
function updateBalanceSubsectorFilter(selectedSector, structuredData) {
    const subsectorContainer = document.getElementById('balanceSubsectorFilterContainer');
    const subsectorSelect = document.getElementById('selectBalanceSubsector');
    if (!subsectorContainer || !subsectorSelect) { console.error("Balance subsector filter elements not found!"); return; }

    // Reset dropdown
    subsectorSelect.innerHTML = '<option value="all" selected>All Subsectors</option>';

    if (selectedSector === 'all' || !structuredData.subsectors || !structuredData.subsectors[selectedSector]) {
        subsectorContainer.classList.add('hidden'); // Hide if 'All Sectors' or no subsectors
    } else {
        // Populate with subsectors for the selected sector
        (structuredData.subsectors[selectedSector] || []).forEach(subsector => { // Add default empty array
            const option = document.createElement('option');
            option.value = subsector;
            option.textContent = subsector;
            subsectorSelect.appendChild(option);
        });
        subsectorContainer.classList.remove('hidden'); // Show the dropdown
    }
}


// --- Input Gathering ---
function getUserInputsAndParams(structuredData) { /* ... (unchanged - reads k and t0) ... */
    const { sectors, subsectors, technologies, powerTechs, hydrogenTechs, allEndUseSubsectors, startYear, endYear } = structuredData; const userInputParameters = { activityGrowthFactors: {}, techBehaviorsAndParams: {} }; (allEndUseSubsectors || []).forEach(({ sector, subsector }) => { const inputId = `growth_${sanitizeForId(sector)}_${sanitizeForId(subsector)}`; const inputElement = document.getElementById(inputId); const growthPercent = inputElement ? parseFloat(inputElement.value) : 0; const growthFactor = isNaN(growthPercent) ? 1.0 : 1 + (growthPercent / 100); userInputParameters.activityGrowthFactors[`${sector}|${subsector}`] = growthFactor; }); const readTechInputs = (categoryType, categoryKey, techList) => { (techList || []).forEach(t => { const paramKey = `${categoryType}|${categoryKey}|${t}`; const sanitizedParamKey = sanitizeForId(paramKey); const behaviorEl = document.getElementById(`behavior_${sanitizedParamKey}`); const behavior = behaviorEl ? behaviorEl.value : 'fixed'; const techParams = { behavior: behavior }; if (behavior === 's-curve') { const targetEl = document.getElementById(`sCurveTarget_${sanitizedParamKey}`); const targetYearEl = document.getElementById(`sCurveTargetYear_${sanitizedParamKey}`); const kValueEl = document.getElementById(`sCurveKValue_${sanitizedParamKey}`); const midpointYearEl = document.getElementById(`sCurveMidpointYear_${sanitizedParamKey}`); techParams.targetShare = targetEl ? parseFloat(targetEl.value) : 0; techParams.targetYear = targetYearEl ? parseInt(targetYearEl.value, 10) : endYear; techParams.kValue = kValueEl ? parseFloat(kValueEl.value) : 0.15; techParams.midpointYear = midpointYearEl ? parseInt(midpointYearEl.value, 10) : Math.round(startYear + (endYear - startYear) / 2); if (isNaN(techParams.targetShare)) techParams.targetShare = 0; if (isNaN(techParams.targetYear)) techParams.targetYear = endYear; if (isNaN(techParams.kValue) || techParams.kValue <= 0) techParams.kValue = 0.15; if (isNaN(techParams.midpointYear)) { techParams.midpointYear = Math.round(startYear + (techParams.targetYear - startYear) / 2); } } userInputParameters.techBehaviorsAndParams[paramKey] = techParams; }); }; sectors.forEach(s => { if (subsectors[s]){ subsectors[s].forEach(b => { readTechInputs('Demand', `${s}|${b}`, technologies[s]?.[b] || []); }); } }); readTechInputs('Power', 'Power', powerTechs); readTechInputs('Hydrogen', 'Hydrogen', hydrogenTechs); return userInputParameters; }


// --- Event Listener Setup ---
/**
 * Handles changes in the main chart view selector dropdown.
 */
function handleChartViewChange() { /* ... (unchanged) ... */
    const chartViewSelect = document.getElementById('selectChartView'); const subsectorSelectorDiv = document.getElementById('subsectorSelector'); const subsectorChartsSection = document.getElementById('subsectorChartsSection'); const balanceChartsSection = document.getElementById('balanceChartsSection'); const supplyChartsSection = document.getElementById('supplyChartsSection'); if (!chartViewSelect || !subsectorSelectorDiv || !subsectorChartsSection || !balanceChartsSection || !supplyChartsSection) { console.error("One or more chart view elements not found!"); return; } const selectedView = chartViewSelect.value; if (selectedView === 'subsector') { subsectorSelectorDiv.classList.remove('hidden'); } else { subsectorSelectorDiv.classList.add('hidden'); } subsectorChartsSection.classList.toggle('hidden', selectedView !== 'subsector'); balanceChartsSection.classList.toggle('hidden', selectedView !== 'balance'); supplyChartsSection.classList.toggle('hidden', selectedView !== 'supply'); console.log(`Chart view changed to: ${selectedView}`); }

/**
 * Gets the current filter settings from the UI.
 * @returns {object} Filters object { balanceSector, balanceSubsector, ueDisplayMode }
 */
function getCurrentFilters() {
    const balanceSectorSelect = document.getElementById('selectBalanceSector');
    const balanceSubsectorSelect = document.getElementById('selectBalanceSubsector');
    const ueModeFuel = document.querySelector('input[name="ueDisplayMode"][value="fuel"]');

    return {
        balanceSector: balanceSectorSelect ? balanceSectorSelect.value : 'all',
        balanceSubsector: balanceSubsectorSelect ? balanceSubsectorSelect.value : 'all',
        ueDisplayMode: ueModeFuel?.checked ? 'fuel' : 'type'
    };
}


/**
 * Sets up event listeners for the Run button and all dropdowns/filters.
 * @param {object} appState - The shared application state object from main.js
 */
function setupEventListeners(appState) {
    const runButton = document.getElementById('runModelBtn');
    const subsectorSelect = document.getElementById('selectSubsector'); // For subsector view
    const chartViewSelect = document.getElementById('selectChartView'); // Main view selector
    const balanceSectorSelect = document.getElementById('selectBalanceSector'); // Balance sector filter
    const balanceSubsectorSelect = document.getElementById('selectBalanceSubsector'); // Balance subsector filter
    const ueDisplayModeRadios = document.querySelectorAll('input[name="ueDisplayMode"]'); // UE display mode

    const { structuredData } = appState;
    if (!structuredData) { console.error("Cannot setup event listeners: structuredData is missing."); return; }

    // --- Helper to trigger chart update ---
    const triggerChartUpdate = () => {
        if (typeof updateCharts !== 'function') { console.error("updateCharts function is not defined."); return; }
        if (appState.latestResults) {
            const filters = getCurrentFilters(); // Get current filter state
            console.log("Triggering chart update with filters:", filters);
            updateCharts(appState.latestResults, structuredData, filters); // Pass filters
        } else { console.warn("No model results available to update charts."); }
    };

    // --- Check elements exist ---
    if (!runButton || !subsectorSelect || !chartViewSelect || !balanceSectorSelect || !balanceSubsectorSelect || !ueDisplayModeRadios) {
        console.error("One or more UI elements for event listeners not found!");
        return;
    }

    // --- Assign Listeners ---

    // Run Model Button Click Handler
    runButton.onclick = async () => { /* ... (unchanged - calls triggerChartUpdate) ... */
        runButton.disabled = true; runButton.textContent = 'Calculating...'; console.log("Run button clicked..."); try { const userInputs = getUserInputsAndParams(structuredData); if (typeof runModelCalculation !== 'function') { throw new Error("runModelCalculation function is not defined."); } const modelResults = await runModelCalculation(structuredData, userInputs); appState.latestResults = modelResults; triggerChartUpdate(); } catch (error) { console.error("Error during model execution or chart update:", error); alert(`An error occurred: ${error.message}.`); } finally { runButton.disabled = false; runButton.textContent = 'Run Model & Update Charts'; } };

     // Subsector Dropdown Change Handler (for subsector view)
     subsectorSelect.onchange = () => { /* ... (unchanged - calls triggerChartUpdate) ... */
         console.log("Subsector selection changed."); triggerChartUpdate(); };

     // Chart View Dropdown Change Handler
     chartViewSelect.onchange = () => { /* ... (unchanged - calls handleChartViewChange) ... */
         handleChartViewChange(); };

     // Balance Sector Filter Change Handler
     balanceSectorSelect.onchange = () => {
         console.log("Balance sector filter changed.");
         const selectedSector = balanceSectorSelect.value;
         updateBalanceSubsectorFilter(selectedSector, structuredData); // Update subsector dropdown
         triggerChartUpdate(); // Update charts with new filters
     };

     // Balance Subsector Filter Change Handler
     balanceSubsectorSelect.onchange = () => {
          console.log("Balance subsector filter changed.");
          triggerChartUpdate(); // Update charts with new filters
     };

     // UE Display Mode Change Handler
     ueDisplayModeRadios.forEach(radio => {
         radio.onchange = () => {
             if (radio.checked) {
                 console.log(`UE display mode changed to: ${radio.value}`);
                 triggerChartUpdate(); // Update charts with new mode
             }
         };
     });

     // Initial setup for visibility based on default selection
     handleChartViewChange();

     console.log("UI Event listeners set up.");
}

