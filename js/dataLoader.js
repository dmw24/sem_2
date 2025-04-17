// js/dataLoader.js

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
                    // Clean potential formatting (commas, percentages) before parsing float
                    const cleanedValue = value.replace(/,|\%/g, '');
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
// Updated based on specific CSV column instructions

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
    const baseDemandTechMix = {}; // Target: { Sector: { Subsector: { Technology: Value_Float_% } } }
    parsedData.forEach(row => {
        const sector = row['Sector']; // String
        const subsector = row['Subsector']; // String
        const tech = row['Technology']; // String
        // Type, Unit columns are ignored for this structure based on reference
        const valuePercent = row['2023']; // Float (already parsed, assumed % value)

        if (sector && subsector && tech) {
            if (!baseDemandTechMix[sector]) baseDemandTechMix[sector] = {};
            if (!baseDemandTechMix[sector][subsector]) baseDemandTechMix[sector][subsector] = {};
             // Use 0 if value is NaN
            baseDemandTechMix[sector][subsector][tech] = isNaN(valuePercent) ? 0 : valuePercent;
        }
    });
    return { baseDemandTechMix };
}

function transformEndUseEnergyConsData(parsedData) {
    const unitEnergyConsumption = {}; // Target: { Sector: { Subsector: { Tech: { Fuel: Value_GJ } } } }
    const GJ_PER_TJ = 1000;
    parsedData.forEach(row => {
        const sector = row['Sector']; // String
        const subsector = row['Subsector']; // String
        const tech = row['Technology']; // String
        const fuel = row['Fuel']; // String
        // Type, Unit columns ignored for structure
        const valueTJ = row['2023']; // Float (already parsed, assumed TJ value)

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
    const placeholderUsefulEfficiency = {}; // Target: { Sector: { Subsector: { Tech: { Fuel: Value_fraction }}}}
    placeholderUsefulEfficiency['_default'] = 0.65; // Default from reference

    // Check if data is empty or null
    if (!parsedData || parsedData.length === 0) {
        console.warn("Useful Energy Conversion data is missing or empty. Using default efficiency only.");
        return { placeholderUsefulEfficiency };
    }


    parsedData.forEach(row => {
        const sector = row['Sector']; // String
        const subsector = row['Subsector']; // String
        const tech = row['Technology']; // String
        const fuel = row['Fuel']; // String
        // Type, Unit columns ignored for structure
        const valuePercent = row['2023']; // Float (already parsed, assumed % value)
        const valueFraction = isNaN(valuePercent) ? 0 : valuePercent / 100; // Convert % to fraction

        if (sector && subsector && tech && fuel) {
            if (!placeholderUsefulEfficiency[sector]) placeholderUsefulEfficiency[sector] = {};
            if (!placeholderUsefulEfficiency[sector][subsector]) placeholderUsefulEfficiency[sector][subsector] = {};
            if (!placeholderUsefulEfficiency[sector][subsector][tech]) placeholderUsefulEfficiency[sector][subsector][tech] = {};
            placeholderUsefulEfficiency[sector][subsector][tech][fuel] = valueFraction;
        }
    });
    return { placeholderUsefulEfficiency };
}

function transformPowerMixData(parsedData) {
    const basePowerProdMix = {}; // Target: { Technology: Value_% }
    // Filter for 'Power' sector if needed, though likely only power techs are in this file
    parsedData.forEach(row => {
        const sector = row['Sector']; // String (Expected 'Power')
        const tech = row['Technology']; // String
        const fuel = row['Fuel']; // String (Input fuel, ignored for mix % based on reference structure)
        // Unit column ignored
        const valuePercent = row['2023']; // Float (already parsed, assumed % value)

        // Assuming we only care about the tech mix, keying by Technology
        if (tech) { // Could add check: && sector === 'Power'
            basePowerProdMix[tech] = isNaN(valuePercent) ? 0 : valuePercent;
        }
    });
    // Add 'Other power' if missing from CSV but expected by reference model logic
    if (!basePowerProdMix['Other power']) {
        basePowerProdMix['Other power'] = 0; // Or calculate remaining % if desired
    }
    return { basePowerProdMix };
}

function transformHydrogenMixData(parsedData) {
    const baseHydrogenProdMix = {}; // Target: { Technology: Value_% }
     // Filter for 'Energy industry'/'Hydrogen' if needed
    parsedData.forEach(row => {
        const sector = row['Sector']; // String (Expected 'Energy industry')
        const subsector = row['Subsector']; // String (Expected 'Hydrogen')
        const tech = row['Technology']; // String
        // Unit column ignored
        const valuePercent = row['2023']; // Float (already parsed, assumed % value)

        // Key mix by Technology
        if (tech) { // Could add check: && sector === 'Energy industry' && subsector === 'Hydrogen'
            baseHydrogenProdMix[tech] = isNaN(valuePercent) ? 0 : valuePercent;
        }
    });
    return { baseHydrogenProdMix };
}

function transformPowerEffData(parsedData) {
    // Target: { Tech: { Fuel: Value_GJ_in_per_GJ_out } }
    const powerTechUnitEnergyCons = {};
    parsedData.forEach(row => {
        const sector = row['Sector']; // String (Expected 'Power')
        const tech = row['Technology']; // String
        // *** Assuming 'Fuel' column exists based on logic/previous data ***
        const fuel = row['Fuel']; // String (Input fuel)
        // Unit column ignored
        const efficiencyPercent = row['2023']; // Float (already parsed, assumed % efficiency)
        const efficiencyFraction = isNaN(efficiencyPercent) ? 0 : efficiencyPercent / 100;
        // Calculate Input/Output = 1 / Efficiency
        const unitCons = (efficiencyFraction > 0.001) ? 1 / efficiencyFraction : 0; // Avoid division by zero

        // Check if Fuel was actually found - if not, this calculation is invalid
        if (!fuel && tech) { // Check tech exists to avoid warning on empty rows
             console.warn(`Missing 'Fuel' column in Power tech eff data for Tech: ${tech}. Cannot calculate Unit Energy Consumption.`);
             // If Fuel is truly missing from the CSV as per user spec, this section needs rework
             // Maybe efficiency is defined differently? For now, skip if no fuel.
             return;
        }

        if (tech && fuel) { // Could add check: && sector === 'Power'
             if (!powerTechUnitEnergyCons[tech]) powerTechUnitEnergyCons[tech] = {};
             powerTechUnitEnergyCons[tech][fuel] = unitCons;
        }
    });
     // Add 'Other power' from reference if needed and not derived from CSV
     if (!powerTechUnitEnergyCons['Other power']) {
         powerTechUnitEnergyCons['Other power'] = { 'Other': 2.5 }; // Value from reference
     }
    return { powerTechUnitEnergyCons };
}

function transformHydrogenEffData(parsedData) {
     // Target: { Tech: { Fuel: Value_GJ_in_per_GJ_out } }
     const hydrogenTechUnitEnergyCons = {};
     parsedData.forEach(row => {
         const sector = row['Sector']; // String (Expected 'Energy industry')
         const subsector = row['Subsector']; // String (Expected 'Hydrogen')
         const tech = row['Technology']; // String
          // *** Assuming 'Fuel' column exists based on logic/previous data ***
         const fuel = row['Fuel']; // String (Input fuel)
         // Unit column ignored
         const efficiencyPercent = row['2023']; // Float (already parsed, assumed % efficiency)
         const efficiencyFraction = isNaN(efficiencyPercent) ? 0 : efficiencyPercent / 100;
         const unitCons = (efficiencyFraction > 0.001) ? 1 / efficiencyFraction : 0;

         if (!fuel && tech) { // Check tech exists
             console.warn(`Missing 'Fuel' column in Hydrogen tech eff data for Tech: ${tech}. Cannot calculate Unit Energy Consumption.`);
             // If Fuel is truly missing from the CSV as per user spec, this section needs rework
             return; // Skip row
         }

         if (tech && fuel) { // Could add check: && sector === 'Energy industry' && subsector === 'Hydrogen'
              if (!hydrogenTechUnitEnergyCons[tech]) hydrogenTechUnitEnergyCons[tech] = {};
              hydrogenTechUnitEnergyCons[tech][fuel] = unitCons;
         }
     });
     return { hydrogenTechUnitEnergyCons };
}

function transformOtherTransformData(parsedData) {
    // Target: { EndUseFuel: { Technology: { PrimaryFuel: Value_GJ_input_per_GJ_output } } }
    const otherTechUnitEnergyCons = {};
    parsedData.forEach(row => {
        const sector = row['Sector']; // String (e.g., 'Energy industry')
        const subsector = row['Subsector']; // String (e.g., 'Gas processing')
        const tech = row['Technology']; // String (e.g., 'Gas refining')
        const primaryFuel = row['Fuel']; // String (Input fuel, e.g., 'Gas')
        // Unit column ignored
        const valueGJconsumedPerGJrefined = row['2023']; // Float (already parsed)

        // Map subsector to end-use fuel (simple example based on naming)
        let endUseFuel = null;
        if (subsector && subsector.toLowerCase().includes('gas')) endUseFuel = 'Gas';
        else if (subsector && subsector.toLowerCase().includes('oil')) endUseFuel = 'Oil';
        else if (subsector && subsector.toLowerCase().includes('coal')) endUseFuel = 'Coal';
        else if (subsector && subsector.toLowerCase().includes('biomass')) endUseFuel = 'Biomass'; // If biomass refining exists

        if (endUseFuel && tech && primaryFuel) {
            const consumedPerRefined = isNaN(valueGJconsumedPerGJrefined) ? 0 : valueGJconsumedPerGJrefined;

             // Calculate GJ *input* per GJ *output*
             // If input fuel = output fuel, Input/Output = 1 + Consumed/Refined
             // If input fuel != output fuel, Input/Output = Consumed/Refined
            let unitCons;
            if (primaryFuel === endUseFuel) {
                unitCons = 1 + consumedPerRefined;
            } else {
                unitCons = consumedPerRefined;
            }

            // Store only if unitCons is non-zero (meaning consumption > 0)
            if (unitCons > 0.0001) {
                 if (!otherTechUnitEnergyCons[endUseFuel]) otherTechUnitEnergyCons[endUseFuel] = {};
                 if (!otherTechUnitEnergyCons[endUseFuel][tech]) otherTechUnitEnergyCons[endUseFuel][tech] = {};
                 otherTechUnitEnergyCons[endUseFuel][tech][primaryFuel] = unitCons;
            }
        }
    });

    // Add Biomass refining assumption from reference if not derived from CSV
    if (!otherTechUnitEnergyCons['Biomass']) {
        otherTechUnitEnergyCons['Biomass'] = { 'Biomass refining': { 'Biomass': 1.1 } }; // Assumes 0.1 consumption
    }
    // Ensure Oil Refining structure from reference is present if derived differently
     if (otherTechUnitEnergyCons['Oil'] && otherTechUnitEnergyCons['Oil']['Oil refining']) {
         if (!otherTechUnitEnergyCons['Oil']['Oil refining']['Gas']) {
            // Add missing Gas input if needed, value based on reference (0.05 cons/refined)
            otherTechUnitEnergyCons['Oil']['Oil refining']['Gas'] = 0.05;
         }
         if (!otherTechUnitEnergyCons['Oil']['Oil refining']['Oil']) {
             // Add missing Oil input if needed, value based on reference (1 + 0.05 cons/refined)
             otherTechUnitEnergyCons['Oil']['Oil refining']['Oil'] = 1.05;
         }
     }


    // Add baseOtherProdMix (assuming 100% for the single tech per fuel type) - needed by model logic
    const baseOtherProdMix = {};
    Object.keys(otherTechUnitEnergyCons).forEach(fuel => {
        const techs = Object.keys(otherTechUnitEnergyCons[fuel]);
        if (techs.length > 0) {
            baseOtherProdMix[fuel] = {};
            // Assume 100% mix for the first (often only) tech found per fuel
            baseOtherProdMix[fuel][techs[0]] = 100;
            for(let i = 1; i < techs.length; i++){
                baseOtherProdMix[fuel][techs[i]] = 0; // Set others to 0
            }
        }
    });

    return { otherTechUnitEnergyCons, baseOtherProdMix };
}


// --- Main Loading Function ---

/**
 * Fetches all CSV data, parses it, and transforms it into the required
 * nested object structure.
 * Returns a promise that resolves with the structured data object.
 */
async function loadAndStructureData() {
    if (structuredModelData) {
        console.log("Returning cached structured data.");
        return structuredModelData;
    }

    console.log("Starting data load and transformation...");
    const rawData = {};
    const loadPromises = Object.entries(csvFiles).map(async ([key, path]) => {
        try {
            const response = await fetch(path);
            if (!response.ok) {
                 // If a file is missing (e.g., Useful_energy_conv), treat as empty
                if (response.status === 404) {
                     console.warn(`File not found: ${path}. Treating as empty.`);
                     rawData[key] = [];
                     return; // Resolve promise successfully with empty data
                }
                throw new Error(`HTTP error! status: ${response.status} for ${path}`);
            }
            const csvText = await response.text();
            rawData[key] = parseCSV(csvText); // Store parsed array
            console.log(`Successfully loaded and parsed: ${path}`);
        } catch (error) {
            console.error(`Failed to load or parse ${path}:`, error);
            rawData[key] = []; // Store empty array on failure
        }
    });

    await Promise.all(loadPromises);
    console.log("All raw data loading attempts finished. Starting transformation...");

    // Perform transformations
    try {
        const { baseActivity, activityUnits } = transformActivityData(rawData.activityLevel || []);
        const { baseDemandTechMix } = transformEndUseMixData(rawData.endUseTechMix || []);
        const { unitEnergyConsumption } = transformEndUseEnergyConsData(rawData.endUseTechEnergyCons || []);
        // Pass empty array if file was missing to avoid error, function handles empty data
        const { placeholderUsefulEfficiency } = transformUsefulEnergyConvData(rawData.usefulEnergyConv || []);
        const { basePowerProdMix } = transformPowerMixData(rawData.powerTechMix || []);
        const { baseHydrogenProdMix } = transformHydrogenMixData(rawData.hydrogenTechMix || []);
        const { powerTechUnitEnergyCons } = transformPowerEffData(rawData.powerTechEff || []);
        const { hydrogenTechUnitEnergyCons } = transformHydrogenEffData(rawData.hydrogenTechEff || []);
        const { otherTechUnitEnergyCons, baseOtherProdMix } = transformOtherTransformData(rawData.otherTransform || []);

        // Derive secondary structures (sectors, subsectors, technologies) more robustly
        // Combine sectors/subsectors/techs found in activity, mix, consumption files
         let allSectors = new Set();
         let allSubsectors = {}; // { sector: Set(subsector) }
         let allTechnologies = {}; // { sector: { subsector: Set(tech) } }

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

         (rawData.activityLevel || []).forEach(processRow);
         (rawData.endUseTechMix || []).forEach(processRow);
         (rawData.endUseTechEnergyCons || []).forEach(processRow);
         // Add Power/Hydrogen sectors/subsectors/techs manually based on their mixes
         allSectors.add('Power');
         allSubsectors['Power'] = new Set(['Electricity']); // Assume subsector
         allTechnologies['Power'] = { 'Electricity': new Set(Object.keys(basePowerProdMix)) };

         allSectors.add('Energy industry');
         allSubsectors['Energy industry'] = new Set(['Hydrogen']); // Assume subsector
         allTechnologies['Energy industry'] = { 'Hydrogen': new Set(Object.keys(baseHydrogenProdMix)) };


         // Convert Sets to Arrays for the final structure
         const sectors = Array.from(allSectors);
         const subsectors = {};
         sectors.forEach(s => { subsectors[s] = Array.from(allSubsectors[s] || new Set()); });
         const technologies = {};
         sectors.forEach(s => {
             technologies[s] = {};
             (subsectors[s] || []).forEach(b => {
                 technologies[s][b] = Array.from(allTechnologies[s]?.[b] || new Set());
             });
         });


         // Define fuel lists etc based on reference or derive if possible
         const endUseFuels = ["Biomass", "Coal", "Electricity", "Gas", "Hydrogen", "Oil"]; // From reference
         const primaryFuels = ["Biomass", "Coal", "Gas", "Hydro", "Oil", "Other", "Solar", "Uranium", "Wind"]; // From reference
         const hydrogenTechs = Object.keys(baseHydrogenProdMix);
         const powerTechs = Object.keys(basePowerProdMix);
         const otherConvTechs = {};
         Object.keys(otherTechUnitEnergyCons).forEach(fuel => {
             otherConvTechs[fuel] = Object.keys(otherTechUnitEnergyCons[fuel]);
         });
         // Derive allEndUseSubsectors for UI population
         const allEndUseSubsectors = sectors
             .filter(s => s !== 'Power' && s !== 'Energy industry') // Filter out supply sectors
             .flatMap(s => (subsectors[s] || []).map(b => ({ sector: s, subsector: b })));


        structuredModelData = {
            baseActivity,
            activityUnits,
            baseDemandTechMix,
            unitEnergyConsumption,
            placeholderUsefulEfficiency,
            basePowerProdMix,
            baseHydrogenProdMix,
            powerTechUnitEnergyCons,
            hydrogenTechUnitEnergyCons,
            otherTechUnitEnergyCons,
            baseOtherProdMix,
            // Derived/defined structures needed by model logic/UI
            sectors,
            subsectors,
            technologies,
            endUseFuels,
            primaryFuels,
            hydrogenTechs,
            powerTechs,
            otherConvTechs,
            allEndUseSubsectors // Added for UI dropdown
        };

        console.log("Data transformation complete.");
        // console.log("Structured Data:", structuredModelData); // DEBUG: Uncomment to inspect the final structure
        return structuredModelData;

    } catch (transformError) {
        console.error("Error during data transformation:", transformError);
        structuredModelData = null; // Ensure data is not partially structured
        throw transformError; // Re-throw error to be caught by caller
    }
}
