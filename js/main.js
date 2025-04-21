// js/main.js
// Version: Complete - Final Initialization

// Simple state object to hold shared data like latest results
// This allows event handlers and other functions to access current data
const appState = {
    structuredData: null, // Holds data loaded by dataLoader.js
    latestResults: null   // Holds the most recent results from modelLogic.js
};

/**
 * Main initialization function for the application.
 * Loads data, sets up UI, runs initial model calculation, and sets up event listeners.
 */
async function initializeApp() {
    console.log("Application starting initialization...");
    const runButton = document.getElementById('runModelBtn'); // Get button early for error handling

    try {
        // Disable button during initialization to prevent premature clicks
        if (runButton) {
            runButton.disabled = true;
            runButton.textContent = 'Loading Data...';
        }

        // --- Step 1: Load and structure data ---
        // Assumes loadAndStructureData is globally accessible from dataLoader.js
        // It fetches CSVs, parses them, transforms data, and returns the structured object.
        appState.structuredData = await loadAndStructureData();

        // Basic check to ensure essential data was loaded before proceeding
        if (!appState.structuredData || !appState.structuredData.sectors || appState.structuredData.sectors.length === 0) {
            throw new Error("Essential data (sectors) failed to load or is empty. Cannot initialize UI.");
        }
        console.log("Data loaded and structured successfully.");

        // --- Step 2: Initialize UI elements (sidebar inputs, dropdowns) ---
        // Assumes these functions are globally accessible from uiController.js
        if (typeof initializeSidebarInputs !== 'function' || typeof populateSubsectorDropdown !== 'function') {
             throw new Error("UI initialization functions (initializeSidebarInputs or populateSubsectorDropdown) are not defined.");
        }
        // Create the collapsible input groups in the sidebar
        initializeSidebarInputs(appState.structuredData);
        // Populate the dropdown used in the "Subsector Details" view
        populateSubsectorDropdown(appState.structuredData);

        // Populate the new filter dropdowns in the "Overall Energy Balance" view
        if (typeof populateBalanceFilters !== 'function') {
            console.warn("UI initialization function (populateBalanceFilters) is not defined."); // Warn if function missing
        } else {
            populateBalanceFilters(appState.structuredData);
            // Log moved inside function
        }
        // Populate the Sankey year selector dropdown
         if (typeof populateSankeyYearSelector !== 'function') {
             console.warn("UI initialization function (populateSankeyYearSelector) is not defined.");
         } else {
             populateSankeyYearSelector(appState.structuredData);
             // Log moved inside function
         }

        console.log("UI inputs and dropdowns initialized."); // General log


        // --- Step 3: Setup event listeners ---
        // Attaches handlers to buttons, dropdowns, etc.
        // Assumes setupEventListeners is globally accessible from uiController.js
         if (typeof setupEventListeners !== 'function') {
              throw new Error("UI event listener setup function (setupEventListeners) is not defined.");
         }
        // Pass appState so event listeners can update/read latestResults and trigger updates
        setupEventListeners(appState);
        // Log moved inside function


        // --- Step 4: Perform initial model run on load ---
        console.log("Performing initial model run...");
         if (runButton) {
             runButton.textContent = 'Calculating Initial...';
         }
         // Get initial inputs (default values set during UI init)
         // Assumes getUserInputsAndParams is globally accessible from uiController.js
          if (typeof getUserInputsAndParams !== 'function') {
               throw new Error("UI input gathering function (getUserInputsAndParams) is not defined.");
          }
         const initialUserInputs = getUserInputsAndParams(appState.structuredData);

         // Run calculation
         // Assumes runModelCalculation is globally accessible from modelLogic.js
          if (typeof runModelCalculation !== 'function') {
               throw new Error("Model calculation function (runModelCalculation) is not defined.");
          }
         // Store results in the shared state object
         appState.latestResults = await runModelCalculation(appState.structuredData, initialUserInputs);
         console.log("Initial calculation complete.");

         // --- Step 5: Display initial charts ---
         // Assumes updateCharts is globally accessible from charting.js
          if (typeof updateCharts !== 'function') {
               throw new Error("Chart update function (updateCharts) is not defined.");
          }

         // Get initial filter state (needed by updateCharts)
         // Assumes getCurrentFilters is globally accessible from uiController.js
         const initialFilters = (typeof getCurrentFilters === 'function') ? getCurrentFilters() : {};
         // Call updateCharts with results, config data, and filters
         updateCharts(appState.latestResults, appState.structuredData, initialFilters);
         console.log("Initial charts displayed.");

        // --- Step 6: Re-enable run button ---
        if (runButton) {
            runButton.disabled = false;
            runButton.textContent = 'Run Model & Update Charts';
        }
        console.log("Application initialization successful.");

    } catch (error) {
        // --- Error Handling ---
        // Catch any errors during the initialization process
        console.error("Error during application initialization:", error);
        // Inform the user via an alert and potentially update the UI
        alert(`A critical error occurred during initialization: ${error.message}. Check the console for details.`);
        // Keep button disabled or show error state
        if (runButton) {
             runButton.textContent = 'Initialization Failed';
             runButton.disabled = true; // Keep disabled on critical error
        }
         // Display error message in content area as fallback
         const contentDiv = document.getElementById('content');
         if (contentDiv) {
             contentDiv.innerHTML = `<h2 style='color: red;'>Initialization Error</h2><p style='color: red;'>${error.message}. Please check the console (F12) for more details.</p>`;
         }
    }
}

// --- Start the application ---
// Use DOMContentLoaded which fires after the HTML is parsed but before images/css load,
// ensuring all necessary DOM elements are available when initializeApp runs.
document.addEventListener('DOMContentLoaded', initializeApp);
