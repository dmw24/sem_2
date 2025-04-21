// js/main.js
// Version: Corrected Initialization Order

// Simple state object to hold shared data
const appState = {
    structuredData: null,
    latestResults: null
};

/**
 * Main initialization function for the application.
 */
async function initializeApp() {
    console.log("Application starting initialization...");
    const runButton = document.getElementById('runModelBtn');

    try {
        if (runButton) { runButton.disabled = true; runButton.textContent = 'Loading Data...'; }

        // --- Step 1: Load and structure data ---
        appState.structuredData = await loadAndStructureData();
        if (!appState.structuredData || !appState.structuredData.sectors || appState.structuredData.sectors.length === 0) {
            throw new Error("Essential data (sectors) failed to load or is empty.");
        }
        console.log("Data loaded and structured successfully.");

        // --- Step 2: Initialize UI elements that DEPEND on structuredData ---
        // Check functions exist before calling
        if (typeof initializeSidebarInputs === 'function') {
            initializeSidebarInputs(appState.structuredData);
        } else { throw new Error("initializeSidebarInputs function not defined."); }

        if (typeof populateSubsectorDropdown === 'function') {
            populateSubsectorDropdown(appState.structuredData);
        } else { throw new Error("populateSubsectorDropdown function not defined."); }

        if (typeof populateBalanceFilters === 'function') {
            populateBalanceFilters(appState.structuredData);
        } else { console.warn("populateBalanceFilters function not defined."); }

        if (typeof populateSankeyYearSelector === 'function') {
            populateSankeyYearSelector(appState.structuredData);
        } else { console.warn("populateSankeyYearSelector function not defined."); }
        console.log("UI inputs and dropdowns initialized.");


        // --- Step 3: Perform initial model run ---
        console.log("Performing initial model run...");
        if (runButton) { runButton.textContent = 'Calculating Initial...'; }
        if (typeof getUserInputsAndParams !== 'function') { throw new Error("getUserInputsAndParams function not defined."); }
        const initialUserInputs = getUserInputsAndParams(appState.structuredData);
        if (typeof runModelCalculation !== 'function') { throw new Error("runModelCalculation function not defined."); }
        appState.latestResults = await runModelCalculation(appState.structuredData, initialUserInputs);
        console.log("Initial calculation complete.");


        // --- Step 4: Display initial charts ---
        if (typeof updateCharts !== 'function') { throw new Error("updateCharts function not defined."); }
        const initialFilters = (typeof getCurrentFilters === 'function') ? getCurrentFilters() : {};
        updateCharts(appState.latestResults, appState.structuredData, initialFilters);
        console.log("Initial charts displayed.");


        // --- Step 5: Setup event listeners (AFTER elements exist and initial charts drawn) ---
         if (typeof setupEventListeners !== 'function') { throw new Error("setupEventListeners function not defined."); }
        setupEventListeners(appState); // Call this last in the try block
        // Log moved inside setupEventListeners


        // --- Step 6: Finalize ---
        if (runButton) { runButton.disabled = false; runButton.textContent = 'Run Model & Update Charts'; }
        console.log("Application initialization successful.");

    } catch (error) {
        // --- Error Handling ---
        console.error("Error during application initialization:", error);
        alert(`A critical error occurred during initialization: ${error.message}. Check console.`);
        if (runButton) { runButton.textContent = 'Initialization Failed'; runButton.disabled = true; }
        const contentDiv = document.getElementById('content');
        if (contentDiv) { contentDiv.innerHTML = `<h2 style='color: red;'>Initialization Error</h2><p style='color: red;'>${error.message}. Check console (F12).</p>`; }
    }
}

// --- Start the application ---
document.addEventListener('DOMContentLoaded', initializeApp);
