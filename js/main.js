// js/main.js

// Simple state object to hold shared data like latest results
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

        // 1. Load and structure data
        appState.structuredData = await loadAndStructureData();
        if (!appState.structuredData || !appState.structuredData.sectors || appState.structuredData.sectors.length === 0) { throw new Error("Essential data (sectors) failed to load or is empty."); }
        console.log("Data loaded and structured successfully.");

        // 2. Initialize UI elements
        if (typeof initializeSidebarInputs !== 'function' || typeof populateSubsectorDropdown !== 'function') { throw new Error("UI sidebar/dropdown init functions not defined."); }
        initializeSidebarInputs(appState.structuredData);
        populateSubsectorDropdown(appState.structuredData);
        if (typeof populateBalanceFilters !== 'function') { console.warn("populateBalanceFilters function not defined."); } else { populateBalanceFilters(appState.structuredData); }
        console.log("UI inputs and dropdown initialized."); // Moved log

        // 3. Setup event listeners
         if (typeof setupEventListeners !== 'function') { throw new Error("setupEventListeners function not defined."); }
        setupEventListeners(appState);
        console.log("UI event listeners configured.");

        // 4. Perform initial model run on load
        console.log("Performing initial model run...");
         if (runButton) { runButton.textContent = 'Calculating Initial...'; }
         if (typeof getUserInputsAndParams !== 'function') { throw new Error("getUserInputsAndParams function not defined."); }
         const initialUserInputs = getUserInputsAndParams(appState.structuredData);
         if (typeof runModelCalculation !== 'function') { throw new Error("runModelCalculation function not defined."); }
         appState.latestResults = await runModelCalculation(appState.structuredData, initialUserInputs);
         console.log("Initial calculation complete.");

         // *** ADDED LOGS before charting ***
         console.log("DEBUG (main.js): latestResults before initial chart update:", appState.latestResults ? "Exists" : "null/undefined");
         // Optional: Log a small part for structure check, avoid logging huge object
         if(appState.latestResults && appState.latestResults[2023]){
             console.log("DEBUG (main.js): Sample results for 2023:", {
                 fec: appState.latestResults[2023].fecByFuel,
                 ped: appState.latestResults[2023].pedByFuel,
                 mix: appState.latestResults[2023].demandTechMix?.Industry?.Steel // Example detail
             });
         }
         console.log("DEBUG (main.js): structuredData before initial chart update:", appState.structuredData ? "Exists" : "null/undefined");
         if(appState.structuredData){
             console.log("DEBUG (main.js): Config keys passed:", Object.keys(appState.structuredData));
         }
         // *** END OF ADDED LOGS ***


         // Display initial charts
         if (typeof updateCharts !== 'function') { throw new Error("updateCharts function not defined."); }
         const initialFilters = (typeof getCurrentFilters === 'function') ? getCurrentFilters() : {};
         updateCharts(appState.latestResults, appState.structuredData, initialFilters);
         console.log("Initial charts displayed.");

        // 5. Re-enable run button
        if (runButton) { runButton.disabled = false; runButton.textContent = 'Run Model & Update Charts'; }
        console.log("Application initialization successful.");

    } catch (error) {
        console.error("Error during application initialization:", error);
        alert(`A critical error occurred during initialization: ${error.message}. Check console.`);
        if (runButton) { runButton.textContent = 'Initialization Failed'; runButton.disabled = true; }
        const contentDiv = document.getElementById('content'); if (contentDiv) { contentDiv.innerHTML = `<h2 style='color: red;'>Initialization Error</h2><p style='color: red;'>${error.message}. Check console (F12).</p>`; }
    }
}

// --- Start the application ---
document.addEventListener('DOMContentLoaded', initializeApp);
