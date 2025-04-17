// js/main.js

// Simple state object to hold shared data like latest results
const appState = {
    structuredData: null,
    latestResults: null
};

/**
 * Main initialization function for the application.
 * Loads data, sets up UI, runs initial model calculation, and sets up event listeners.
 */
async function initializeApp() {
    console.log("Application starting initialization...");
    const runButton = document.getElementById('runModelBtn'); // Get button early for error handling

    try {
        // Disable button during init
        if (runButton) {
            runButton.disabled = true;
            runButton.textContent = 'Loading Data...';
        }

        // 1. Load and structure data
        // Assumes loadAndStructureData is globally accessible from dataLoader.js
        appState.structuredData = await loadAndStructureData();

        // Check if essential data loaded
        if (!appState.structuredData || !appState.structuredData.sectors || appState.structuredData.sectors.length === 0) {
            throw new Error("Essential data (sectors) failed to load or is empty. Cannot initialize UI.");
        }
        console.log("Data loaded and structured successfully.");

        // 2. Initialize UI elements (sidebar inputs, dropdown)
        // Assumes functions are globally accessible from uiController.js
        if (typeof initializeSidebarInputs !== 'function' || typeof populateSubsectorDropdown !== 'function') {
             throw new Error("UI initialization functions (initializeSidebarInputs or populateSubsectorDropdown) are not defined.");
        }
        initializeSidebarInputs(appState.structuredData);
        populateSubsectorDropdown(appState.structuredData);
        console.log("UI inputs and dropdown initialized.");

        // 3. Setup event listeners (run button, dropdown change)
        // Assumes setupEventListeners is globally accessible from uiController.js
         if (typeof setupEventListeners !== 'function') {
              throw new Error("UI event listener setup function (setupEventListeners) is not defined.");
         }
        // Pass appState so event listeners can update/read latestResults
        setupEventListeners(appState);
        console.log("UI event listeners configured.");


        // 4. Perform initial model run on load
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
         appState.latestResults = await runModelCalculation(appState.structuredData, initialUserInputs);
         console.log("Initial calculation complete.");

         // Display initial charts
         // Assumes updateCharts is globally accessible from charting.js
          if (typeof updateCharts !== 'function') {
               throw new Error("Chart update function (updateCharts) is not defined.");
          }
         updateCharts(appState.latestResults, appState.structuredData);
         console.log("Initial charts displayed.");

        // 5. Re-enable run button
        if (runButton) {
            runButton.disabled = false;
            runButton.textContent = 'Run Model & Update Charts';
        }
        console.log("Application initialization successful.");

    } catch (error) {
        console.error("Error during application initialization:", error);
        alert(`A critical error occurred during initialization: ${error.message}. Check the console for details.`);
        // Keep button disabled or show error state
        if (runButton) {
             runButton.textContent = 'Initialization Failed';
             runButton.disabled = true; // Keep disabled on critical error
        }
         // Display error message in content area
         const contentDiv = document.getElementById('content');
         if (contentDiv) {
             contentDiv.innerHTML = `<h2 style='color: red;'>Initialization Error</h2><p style='color: red;'>${error.message}. Please check the console (F12) for more details.</p>`;
         }
    }
}

// --- Start the application ---
// Use DOMContentLoaded which fires after the HTML is parsed but before images/css load
document.addEventListener('DOMContentLoaded', initializeApp);
