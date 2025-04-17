
// js/dataLoader.js

// Placeholder for where the loaded data will be stored
const modelData = {
    activityLevels: null,
    usefulEnergyConv: null,
    endUseTechMix: null,
    endUseTechEnergyCons: null,
    powerTechMix: null,
    hydrogenTechMix: null,
    hydrogenTechEff: null,
    powerTechEff: null,
    otherTransform: null,
    // Add other data pieces as needed
};

// List of CSV files to load
const csvFiles = {
    activityLevels: 'data/SEM dataset - Activity level.csv',
    usefulEnergyConv: 'data/SEM dataset - Useful energy conv.csv',
    endUseTechMix: 'data/SEM dataset - EndUseTechMix.csv',
    endUseTechEnergyCons: 'data/SEM dataset - EndUseTech energy cons.csv',
    powerTechMix: 'data/SEM dataset - Power tech mix.csv',
    hydrogenTechMix: 'data/SEM dataset - Hydrogen tech mix.csv',
    hydrogenTechEff: 'data/SEM dataset - Hydrogen tech eff.csv',
    powerTechEff: 'data/SEM dataset - Power tech eff.csv',
    otherTransform: 'data/SEM dataset - Other transform tech energy int.csv'
};

/**
 * Basic CSV parser (assumes comma delimiter and simple structure)
 * NOTE: For robust parsing, consider using a library like PapaParse:
 * https://www.papaparse.com/
 */
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 1) return [];
    // Use first line as header, trim whitespace from headers
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        // Skip empty lines
        if (!lines[i].trim()) continue;

        const values = lines[i].split(','); // Basic split, might need refinement for quoted values
        const entry = {};
        for (let j = 0; j < headers.length; j++) {
            // Trim whitespace and handle potential quotes (very basic)
            entry[headers[j]] = values[j] ? values[j].trim().replace(/^"|"$/g, '') : '';
        }
        data.push(entry);
    }
    return data;
}


/**
 * Fetches and parses all necessary CSV data.
 * Returns a promise that resolves when all data is loaded.
 */
async function loadAllData() {
    console.log("Starting data load...");
    const promises = Object.entries(csvFiles).map(async ([key, path]) => {
        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} for ${path}`);
            }
            const csvText = await response.text();
            // Store the parsed data
            modelData[key] = parseCSV(csvText);
            console.log(`Successfully loaded and parsed: ${path}`);
        } catch (error) {
            console.error(`Failed to load or parse ${path}:`, error);
            // Store null or empty array to indicate failure
            modelData[key] = null;
        }
    });

    // Wait for all fetch/parse operations to complete
    await Promise.all(promises);
    console.log("All data loading attempts finished.");
    // You might want to add checks here to ensure crucial data loaded correctly
    return modelData;
}

// Example of how to make data accessible (or main.js can import modelData)
// window.modelData = modelData; // Simple global exposure (consider better module patterns)
