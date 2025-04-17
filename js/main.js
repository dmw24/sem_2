// js/main.js

// Main application logic starts here

// 1. Initialize UI Controls
initializeUI(); // Set up sliders, buttons etc.

// 2. Initialize empty charts
initializeCharts(); // Create chart instances

// 3. Load Data and Run Initial Calculation on page load
async function initializeApp() {
    try {
        // Load all data first
        const data = await loadAllData(); // from dataLoader.js

        // Check if essential data loaded
        if (!data || !data.activityLevels) {
             throw new Error("Essential data failed to load. Cannot proceed.");
        }

        // Get initial inputs (e.g., default year)
        const initialInputs = getUserInputs(); // from uiController.js

        // Perform initial calculation
        const initialResults = calculateEnergyModel(data, initialInputs); // from modelLogic.js

        // Display initial results and charts
        displayResults(initialResults); // from uiController.js

        console.log("Application initialized successfully.");

        // Add event listeners to controls (e.g., button click)
        // to trigger recalculations via handleCalculationRequest in uiController.js
        // Example (assuming a button with id='calculateButton'):
        const calcButton = document.getElementById('calculateButton'); // Define button in HTML
        if (calcButton) {
            // Need to make handleCalculationRequest globally accessible or import/export
            // calcButton.addEventListener('click', handleCalculationRequest);
            calcButton.addEventListener('click', () => {
                 console.log("Calculate button clicked - Placeholder - Hook up handleCalculationRequest");
                 alert("Calculation logic needs to be fully connected!");
                 // Ideally call handleCalculationRequest here after ensuring it's accessible
            });
        } else {
            console.warn("Calculate button not found. Add it to index.html and controls section.");
        }


    } catch (error) {
        console.error("Error during application initialization:", error);
        // Display an error message to the user in the UI
        const resultsSection = document.getElementById('results');
        if (resultsSection) {
            resultsSection.innerHTML = `<p style="color: red;">Error initializing the model: ${error.message}</p>`;
        }
    }
}

// Start the application initialization process
initializeApp();
