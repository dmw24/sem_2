// js/dataLoader.js
// Version: Complete - Handles Fractional Percentages, Adds Type Lookup

// List of CSV files to load - using exact filenames provided
const csvFiles = {
    activityLevel: 'data/Activity_level.csv',
    // NOTE: 'Useful_energy_conv.csv' was not in the last list provided, but is likely needed. Please verify filename.
    usefulEnergyConv: 'data/Useful_energy_conv.csv',
    endUseTechMix: 'data/EndUseTechMix.csv',
    endUseTechEnergyCons: 'data/EndUseTech_energy_cons.csv',
    powerTechMix: 'data/Power_tech_mix.csv',
    hydrogenTechMix: 'data/Hydrogen_tech_mix.csv',
    hydrogenTechEff: 'data/Hydrogen_tech_eff.csv',
    powerTechEff: 'data/Power_tech_eff.csv',
    otherTransform: 'data/Other_transform_tech_energy_int.csv'
};

// Define years range (needed by model logic and charting)
const startYear = 2023;
const endYear = 2050;
const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);


// Placeholder for the final structured data
let structuredModelData = null;

/**
 * Basic CSV parser (assumes comma delimiter and simple structure)
 * NOTE: For robust parsing, consider using a library like PapaParse:
 * https://www.papaparse.com/
 */
function parseCSV(csvText) {
    // Trim trailing spaces/newlines, then split
    const lines = csvText.replace(/[\r\n]+$/, '').split(/[\r\n]+/);
    if (lines.length < 1) return [];

    // Use first line as header, trim whitespace from headers
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue; // Skip empty lines

        // Basic split - fragile if commas are within quoted fields
        const values = lines[i].split(',');
        const entry = {};
        let isValidEntry = true; // Flag to check if row has expected number of values
        if (values.length !== headers.length) {
             // console.warn(`Skipping row ${i+1}: Expected ${headers.length} columns, found ${values.length}. Line: "${lines[i]}"`);
             isValidEntry = false; // Don't process incomplete rows silently
        }

        if(isValidEntry){
            for (let j = 0; j < headers.length; j++) {
                const header = headers[j];
                 // Check if header exists before accessing value to prevent errors on malformed lines
                if (header === undefined) continue;
                // Trim whitespace and handle potential quotes (very basic)
                const value = values[j] ? values[j].trim().replace(/^"|"$/g, '') : '';

                // Store value based on header type (simple approach)
                if (header === '2023') {
                    // Remove only commas now, as % sign is not expected
                    const cleanedValue = value.replace(/,/g, '');
                    const floatValue = parseFloat(cleanedValue);
                    // Store NaN if parsing fails, let downstream functions handle it
                    entry[header] = isNaN(floatValue) ? NaN : floatValue;
                } else {
                    // Keep other columns as strings
                    entry[header] = value;
                }
            }
            data.push(entry);
        }
    }
    return data;
}


// --- Data Transformation Functions ---
// UPDATED to handle fractional percentages in CSVs

function transformActivityData(parsedData) {
    const baseActivity = {}; // Target: { Sector: { Subsector: Value_Float } }
    const activityUnits = {};  // Target: { Sector: { Subsector: Unit_String } }
    parsedData.forEach(row => {
        const sector = row['Sector']; // String
        const subsector = row['Subsector']; // String
        const unit = row['Unit']; // String
        const value = row['2023']; // Float (already parsed)

        if (sector && subsector) {
            if (!baseActivity[sector]) baseActivity[sector] = {};
            if (!activityUnits[sector]) activityUnits[sector] = {};
            // Use 0 if value is NaN (parsing failed or missing)
            baseActivity[sector][subsector] = isNaN(value) ? 0 : value;
            activityUnits[sector][subsector] = unit || '';
        }
    });
    return { baseActivity, activityUnits };
}

function transformEndUseMixData(parsedData) {
    const baseDemandTechMix = {};
    parsedData.forEach(row => {
        const sector = row['Sector']; const subsector = row['Subsector']; const tech = row['Technology'];
        const valueFraction = row['2023']; // Read the fraction (e.g., 0.3)

        if (sector && subsector && tech) {
            if (!baseDemandTechMix[sector]) baseDemandTechMix[sector] = {};
            if (!baseDemandTechMix[sector][subsector]) baseDemandTechMix[sector][subsector] = {};
            // *** Store as percentage number (0-100) for modelLogic compatibility ***
            const valuePercent = isNaN(valueFraction) ? 0 : valueFraction * 100;
            baseDemandTechMix[sector][subsector][tech] = valuePercent;
        }
    });
    return { baseDemandTechMix };
}

function transformEndUseEnergyConsData(parsedData) {
    const unitEnergyConsumption = {}; const GJ_PER_TJ = 1000;
    parsedData.forEach(row => {
        const sector = row['Sector']; const subsector = row['Subsector']; const tech = row['Technology']; const fuel = row['Fuel'];
        const valueTJ = row['2023']; // Assumed TJ value

        if (sector && subsector && tech && fuel) {
            const valueGJ = (isNaN(valueTJ) ? 0 : valueTJ) * GJ_PER_TJ; // Convert TJ to GJ
            if (!unitEnergyConsumption[sector]) unitEnergyConsumption[sector] = {};
            if (!unitEnergyConsumption[sector][subsector]) unitEnergyConsumption[sector][subsector] = {};
            if (!unitEnergyConsumption[sector][subsector][tech]) unitEnergyConsumption[sector][subsector][tech] = {};
            unitEnergyConsumption[sector][subsector][tech][fuel] = valueGJ;
        }
    });
    return { unitEnergyConsumption };
}

function transformUsefulEnergyConvData(parsedData) {
    // Creates BOTH efficiency lookup AND type lookup
    const placeholderUsefulEfficiency = { '_default': 0.65 };
    const dataTypeLookup = {}; // New: { Sector: { Subsector: { Tech: { Fuel: TypeString }}}}

    if (!parsedData || parsedData.length === 0) {
        console.warn("Useful Energy Conversion data is missing or empty. Using default efficiency only. Type information unavailable.");
        return { placeholderUsefulEfficiency, dataTypeLookup }; // Return empty lookup
    }
    parsedData.forEach(row => {
        const sector = row['Sector']; const subsector = row['Subsector']; const tech = row['Technology']; const fuel = row['Fuel'];
        const efficiencyFraction = row['2023']; // Read the fraction directly (e.g., 0.9)
        const type = row['Type'] || 'Unknown'; // Get the Type string

        if (sector && subsector && tech && fuel) {
            // Populate efficiency lookup
            if (!placeholderUsefulEfficiency[sector]) placeholderUsefulEfficiency[sector] = {};
            if (!placeholderUsefulEfficiency[sector][subsector]) placeholderUsefulEfficiency[sector][subsector] = {};
            if (!placeholderUsefulEfficiency[sector][subsector][tech]) placeholderUsefulEfficiency[sector][subsector][tech] = {};
            placeholderUsefulEfficiency[sector][subsector][tech][fuel] = isNaN(efficiencyFraction) ? 0 : efficiencyFraction;

            // Populate type lookup
            if (!dataTypeLookup[sector]) dataTypeLookup[sector] = {};
            if (!dataTypeLookup[sector][subsector]) dataTypeLookup[sector][subsector] = {};
            if (!dataTypeLookup[sector][subsector][tech]) dataTypeLookup[sector][subsector][tech] = {};
            dataTypeLookup[sector][subsector][tech][fuel] = type;
        }
    });
    return { placeholderUsefulEfficiency, dataTypeLookup }; // Return both
}

function transformPowerMixData(parsedData) {
    const basePowerProdMix = {};
    parsedData.forEach(row => {
        const tech = row['Technology'];
        const valueFraction = row['2023']; // Read fraction (e.g., 0.05)
        if (tech) {
            // *** Store as percentage number (0-100) ***
            const valuePercent = isNaN(valueFraction) ? 0 : valueFraction * 100;
            basePowerProdMix[tech] = valuePercent;
        }
    });
    if (!basePowerProdMix['Other power']) { basePowerProdMix['Other power'] = 0; }
    return { basePowerProdMix };
}

function transformHydrogenMixData(parsedData) {
    const baseHydrogenProdMix = {};
    parsedData.forEach(row => {
        const tech = row['Technology'];
        const valueFraction = row['2023']; // Read fraction (e.g., 0.5)
        if (tech) {
            // *** Store as percentage number (0-100) ***
            const valuePercent = isNaN(valueFraction) ? 0 : valueFraction * 100;
            baseHydrogenProdMix[tech] = valuePercent;
        }
    });
    return { baseHydrogenProdMix };
}

function transformPowerEffData(parsedData) {
    const powerTechUnitEnergyCons = {};
    parsedData.forEach(row => {
        const tech = row['Technology']; const fuel = row['Fuel'];
        const efficiencyFraction = row['2023']; // Read fraction directly (e.g., 0.35)

        if (!fuel && tech) { console.warn(`Missing 'Fuel' column in Power tech eff data for Tech: ${tech}.`); return; }
        if (tech && fuel) {
            // *** Use fraction directly ***
            const effFrac = isNaN(efficiencyFraction) ? 0 : efficiencyFraction;
            const unitCons = (effFrac > 0.001) ? 1 / effFrac : 0; // Calculate 1 / efficiency
            if (!powerTechUnitEnergyCons[tech]) powerTechUnitEnergyCons[tech] = {};
            powerTechUnitEnergyCons[tech][fuel] = unitCons;
        }
    });
    if (!powerTechUnitEnergyCons['Other power']) { powerTechUnitEnergyCons['Other power'] = { 'Other': 2.5 }; }
    return { powerTechUnitEnergyCons };
}

function transformHydrogenEffData(parsedData) {
     const hydrogenTechUnitEnergyCons = {};
     parsedData.forEach(row => {
         const tech = row['Technology']; const fuel = row['Fuel'];
         const efficiencyFraction = row['2023']; // Read fraction directly (e.g., 0.71)

         if (!fuel && tech) { console.warn(`Missing 'Fuel' column in Hydrogen tech eff data for Tech: ${tech}.`); return; }
         if (tech && fuel) {
             // *** Use fraction directly ***
             const effFrac = isNaN(efficiencyFraction) ? 0 : efficiencyFraction;
             const unitCons = (effFrac > 0.001) ? 1 / effFrac : 0; // Calculate 1 / efficiency
             if (!hydrogenTechUnitEnergyCons[tech]) hydrogenTechUnitEnergyCons[tech] = {};
             hydrogenTechUnitEnergyCons[tech][fuel] = unitCons;
         }
     });
     return { hydrogenTechUnitEnergyCons };
}

function transformOtherTransformData(parsedData) {
    const otherTechUnitEnergyCons = {};
    parsedData.forEach(row => {
        const subsector = row['Subsector']; const tech = row['Technology']; const primaryFuel = row['Fuel'];
        const valueGJconsumedPerGJrefined = row['2023']; // Not a percentage

        let endUseFuel = null;
        if (subsector && subsector.toLowerCase().includes('gas')) endUseFuel = 'Gas';
        else if (subsector && subsector.toLowerCase().includes('oil')) endUseFuel = 'Oil';
        else if (subsector && subsector.toLowerCase().includes('coal')) endUseFuel = 'Coal';
        else if (subsector && subsector.toLowerCase().includes('biomass')) endUseFuel = 'Biomass';

        if (endUseFuel && tech && primaryFuel) {
            const consumedPerRefined = isNaN(valueGJconsumedPerGJrefined) ? 0 : valueGJconsumedPerGJrefined;
            let unitCons = (primaryFuel === endUseFuel) ? 1 + consumedPerRefined : consumedPerRefined; // Input/Output ratio
            if (unitCons > 0.0001) {
                 if (!otherTechUnitEnergyCons[endUseFuel]) otherTechUnitEnergyCons[endUseFuel] = {};
                 if (!otherTechUnitEnergyCons[endUseFuel][tech]) otherTechUnitEnergyCons[endUseFuel][tech] = {};
                 otherTechUnitEnergyCons[endUseFuel][tech][primaryFuel] = unitCons;
            }
        }
    });
    // Add default/missing transformations
    if (!otherTechUnitEnergyCons['Biomass']) { otherTechUnitEnergyCons['Biomass'] = { 'Biomass refining': { 'Biomass': 1.1 } }; }
    if (otherTechUnitEnergyCons['Oil'] && otherTechUnitEnergyCons['Oil']['Oil refining']) { if (!otherTechUnitEnergyCons['Oil']['Oil refining']['Gas']) { otherTechUnitEnergyCons['Oil']['Oil refining']['Gas'] = 0.05; } if (!otherTechUnitEnergyCons['Oil']['Oil refining']['Oil']) { otherTechUnitEnergyCons['Oil']['Oil refining']['Oil'] = 1.05; } }
    // Calculate base mix for other transforms (assume 100% for first/only tech per fuel)
    const baseOtherProdMix = {};
    Object.keys(otherTechUnitEnergyCons).forEach(fuel => {
        const techs = Object.keys(otherTechUnitEnergyCons[fuel]);
        if (techs.length > 0) { baseOtherProdMix[fuel] = {}; baseOtherProdMix[fuel][techs[0]] = 100; for(let i = 1; i < techs.length; i++){ baseOtherProdMix[fuel][techs[i]] = 0; } }
    });
    return { otherTechUnitEnergyCons, baseOtherProdMix };
}
// --- End of Transformation Functions ---


// --- Main Loading Function ---
async function loadAndStructureData() {
    // Return cached data if available
    if (structuredModelData) {
        console.log("Returning cached structured data.");
        return structuredModelData;
    }

    console.log("Starting data load and transformation...");
    const rawData = {}; // To store parsed data from each file

    // Create promises for fetching and parsing each CSV file
    const loadPromises = Object.entries(csvFiles).map(async ([key, path]) => {
        try {
            const response = await fetch(path); // Fetch the CSV file
            if (!response.ok) {
                 // Handle non-OK responses (e.g., 404 Not Found)
                 if (response.status === 404) {
                     console.warn(`File not found: ${path}. Treating as empty.`);
                     rawData[key] = []; // Assign empty array if file not found
                     return; // Stop processing this file
                 }
                 // Throw error for other HTTP issues
                 throw new Error(`HTTP error! status: ${response.status} for ${path}`);
            }
            const csvText = await response.text(); // Read file content as text
            rawData[key] = parseCSV(csvText); // Parse CSV text into an array of objects
            // console.log(`Successfully loaded and parsed: ${path}`); // Reduce console noise
        } catch (error) {
            // Log errors during fetch/parse and assign empty array
            console.error(`Failed to load or parse ${path}:`, error);
            rawData[key] = [];
        }
    });

    // Wait for all fetch/parse promises to complete
    await Promise.all(loadPromises);
    console.log("All raw data loading attempts finished. Starting transformation...");

    try {
        // Perform transformations on the parsed data
        const { baseActivity, activityUnits } = transformActivityData(rawData.activityLevel || []);
        const { baseDemandTechMix } = transformEndUseMixData(rawData.endUseTechMix || []);
        const { unitEnergyConsumption } = transformEndUseEnergyConsData(rawData.endUseTechEnergyCons || []);
        const { placeholderUsefulEfficiency, dataTypeLookup } = transformUsefulEnergyConvData(rawData.usefulEnergyConv || []); // Gets both now
        const { basePowerProdMix } = transformPowerMixData(rawData.powerTechMix || []);
        const { baseHydrogenProdMix } = transformHydrogenMixData(rawData.hydrogenTechMix || []);
        const { powerTechUnitEnergyCons } = transformPowerEffData(rawData.powerTechEff || []);
        const { hydrogenTechUnitEnergyCons } = transformHydrogenEffData(rawData.hydrogenTechEff || []);
        const { otherTechUnitEnergyCons, baseOtherProdMix } = transformOtherTransformData(rawData.otherTransform || []);

        // Derive secondary structures (lists of sectors, subsectors, technologies)
        let allSectors = new Set();
        let allSubsectors = {}; // { sector: Set(subsector1, subsector2) }
        let allTechnologies = {}; // { sector: { subsector: Set(tech1, tech2) } }

        // Helper function to populate sets from various data sources
        const processRow = (row) => {
            if (!row || !row.Sector) return;
            const sector = row.Sector;
            allSectors.add(sector);
            const subsector = row.Subsector;
            if (subsector) {
                if (!allSubsectors[sector]) allSubsectors[sector] = new Set();
                allSubsectors[sector].add(subsector);
                const tech = row.Technology;
                if (tech) {
                    if (!allTechnologies[sector]) allTechnologies[sector] = {};
                    if (!allTechnologies[sector][subsector]) allTechnologies[sector][subsector] = new Set();
                    allTechnologies[sector][subsector].add(tech);
                }
            }
        };

        // Process relevant CSV data to build the sets
        (rawData.activityLevel || []).forEach(processRow);
        (rawData.endUseTechMix || []).forEach(processRow);
        (rawData.endUseTechEnergyCons || []).forEach(processRow);
        // Manually add supply sectors and their technologies
        allSectors.add('Power');
        allSubsectors['Power'] = new Set(['Electricity']); // Single 'subsector' for power
        allTechnologies['Power'] = { 'Electricity': new Set(Object.keys(basePowerProdMix)) };

        allSectors.add('Energy industry');
        allSubsectors['Energy industry'] = new Set(['Hydrogen']); // Single 'subsector' for hydrogen
        allTechnologies['Energy industry'] = { 'Hydrogen': new Set(Object.keys(baseHydrogenProdMix)) };
        // TODO: Add 'Other Transformations' if needed as distinct sectors/subsectors/techs

        // Convert Sets to Arrays for easier use later
        const sectors = Array.from(allSectors).sort(); // Sort for consistent order
        const subsectors = {};
        sectors.forEach(s => { subsectors[s] = Array.from(allSubsectors[s] || new Set()).sort(); });
        const technologies = {};
        sectors.forEach(s => {
            technologies[s] = {};
            (subsectors[s] || []).forEach(b => {
                technologies[s][b] = Array.from(allTechnologies[s]?.[b] || new Set()).sort();
            });
        });

        // Define standard lists based on processed data and known categories
        const endUseFuels = ["Biomass", "Coal", "Electricity", "Gas", "Hydrogen", "Oil"]; // Standard list
        const primaryFuels = ["Biomass", "Coal", "Gas", "Hydro", "Oil", "Other", "Solar", "Uranium", "Wind"]; // Standard list
        const hydrogenTechs = Object.keys(baseHydrogenProdMix).sort();
        const powerTechs = Object.keys(basePowerProdMix).sort();
        const otherConvTechs = {}; Object.keys(otherTechUnitEnergyCons).forEach(fuel => { otherConvTechs[fuel] = Object.keys(otherTechUnitEnergyCons[fuel]).sort(); });
        const allEndUseSubsectors = sectors.filter(s => s !== 'Power' && s !== 'Energy industry').flatMap(s => (subsectors[s] || []).map(b => ({ sector: s, subsector: b })));

        // Assemble final structured data object to be returned
        structuredModelData = {
            // Base data objects from transformations
            baseActivity, activityUnits, baseDemandTechMix, unitEnergyConsumption,
            placeholderUsefulEfficiency, basePowerProdMix, baseHydrogenProdMix,
            powerTechUnitEnergyCons, hydrogenTechUnitEnergyCons, otherTechUnitEnergyCons,
            baseOtherProdMix,
            dataTypeLookup, // Added Type lookup

            // Derived/defined structures and lists
            sectors, subsectors, technologies, endUseFuels, primaryFuels,
            hydrogenTechs, powerTechs, otherConvTechs, allEndUseSubsectors,
            startYear, endYear, years
        };

        console.log("Data transformation complete.");
        return structuredModelData; // Return the structured data

    } catch (transformError) {
        // Catch and log errors during the transformation phase
        console.error("Error during data transformation:", transformError);
        structuredModelData = null; // Ensure data is null on error
        throw transformError; // Re-throw error to be caught by initializeApp
    }
}
