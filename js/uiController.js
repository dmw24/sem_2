// js/uiController.js
// Version: Trigger chart update on view change + Balance Filters

// --- UI Helper Functions ---
function toggleGroup(el) { let content = el.nextElementSibling; if (!content || (!content.classList.contains('group-content') && !content.classList.contains('sub-group-content'))) { console.warn("Could not find content sibling for toggle element:", el); return; } if (content.style.display === "none" || content.style.display === "") { content.style.display = "block"; el.classList.remove("collapsed"); el.classList.add("expanded"); } else { content.style.display = "none"; el.classList.remove("expanded"); el.classList.add("collapsed"); } }
function sanitizeForId(str) { if (typeof str !== 'string') str = String(str); let sanitized = str.replace(/[^a-zA-Z0-9_-]/g, '_'); sanitized = sanitized.replace(/__+/g, '_'); sanitized = sanitized.replace(/^_+|_+$/g, ''); if (/^\d/.test(sanitized)) { sanitized = 'id_' + sanitized; } return sanitized || 'invalid_id'; }
function toggleSCurveInputs(selectElement, paramKey) { const containerId = `sCurveInputs_${sanitizeForId(paramKey)}`; const container = document.getElementById(containerId); if (container) { const isVisible = selectElement.value === 's-curve'; container.style.display = isVisible ? 'block' : 'none'; container.classList.toggle('visible', isVisible); } }

// --- Dynamic Input Creation Helpers ---
const defaultDeclineDemandTechsUI = { /* ... */ }; const defaultSCurveDemandTechsUI = { /* ... */ }; const defaultDeclinePowerTechsUI = ['Gas power', 'Coal power', 'Oil power']; const defaultSCurvePowerTechsUI = ['Solar PV', 'Wind']; const defaultDeclineHydrogenTechsUI = ['Blue']; const defaultSCurveHydrogenTechsUI = ['Green']; const uiStartYear = 2023; const uiEndYear = 2050;
const createSCurveParamInputs = (paramKey, baseValue) => { /* ... (k and t0 inputs) ... */ };
const createTechInput = (categoryType, categoryKey, tech, baseMixObject) => { /* ... */ };

// --- UI Initialization ---
function initializeSidebarInputs(structuredData) { /* ... */ }
function populateSubsectorDropdown(structuredData) { /* ... */ }
function populateBalanceFilters(structuredData) { /* ... */ }
function updateBalanceSubsectorFilter(selectedSector, structuredData) { /* ... */ }
function updateBalanceChartVisibility(selectedSector) { /* ... */ }

// --- Input Gathering ---
function getUserInputsAndParams(structuredData) { /* ... (reads k and t0) ... */ }

// --- Event Listener Setup ---

// Helper to trigger chart update - defined outside setupEventListeners to be callable
function triggerChartUpdate() {
    // Ensure necessary functions and state are available (assuming global scope or proper import/export)
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
    // Check if results exist before triggering
     if (typeof appState !== 'object' || !appState.latestResults) {
         console.log("No results yet, skipping chart update on view change.");
     } else {
         // Only trigger update if the relevant section is now visible
         if ((showSubsector && !subsectorChartsSection.classList.contains('hidden')) ||
             (showBalance && !balanceChartsSection.classList.contains('hidden')) ||
             (showSupply && !supplyChartsSection.classList.contains('hidden')))
         {
              console.log("View changed, triggering chart update for visible section.");
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
