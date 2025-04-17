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

// Define years range (needed by model logic and charting)
// Copied from modelLogic.js for consistency - centralize if preferred
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
// (Keep all transform...Data functions as they were in the previous response)
function transformActivityData(parsedData) {
    const baseActivity = {}; // Target: { Sector: { Subsector: Value_Float } }
    const activityUnits = {};  // Target: { Sector: { Subsector: Unit_String } }
    parsedData.forEach(row => {
        const sector = row['Sector']; const subsector = row['Subsector']; const unit = row['Unit']; const value = row['2023'];
        if (sector && subsector) {
            if (!baseActivity[sector]) baseActivity[sector] = {};
            if (!activityUnits[sector]) activityUnits[sector] = {};
            baseActivity[sector][subsector] = isNaN(value) ? 0 : value;
            activityUnits[sector][subsector] = unit || '';
        }
    });
    return { baseActivity, activityUnits };
}
function transformEndUseMixData(parsedData) {
    const baseDemandTechMix = {}; // Target: { Sector: { Subsector: { Technology: Value_Float_% } } }
    parsedData.forEach(row => {
        const sector = row['Sector']; const subsector = row['Subsector']; const tech = row['Technology']; const valuePercent = row['2023'];
        if (sector && subsector && tech) {
            if (!baseDemandTechMix[sector]) baseDemandTechMix[sector] = {};
            if (!baseDemandTechMix[sector][subsector]) baseDemandTechMix[sector][subsector] = {};
            baseDemandTechMix[sector][subsector][tech] = isNaN(valuePercent) ? 0 : valuePercent;
        }
    });
    return { baseDemandTechMix };
}
function transformEndUseEnergyConsData(parsedData) {
    const unitEnergyConsumption = {}; // Target: { Sector: { Subsector: { Tech: { Fuel: Value_GJ } } } }
    const GJ_PER_TJ = 1000;
    parsedData.forEach(row => {
        const sector = row['Sector']; const subsector = row['Subsector']; const tech = row['Technology']; const fuel = row['Fuel']; const valueTJ = row['2023'];
        if (sector && subsector && tech && fuel) {
            const valueGJ = (isNaN(valueTJ) ? 0 : valueTJ) * GJ_PER_TJ;
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
    placeholderUsefulEfficiency['_default'] = 0.65;
    if (!parsedData || parsedData.length === 0) {
        console.warn("Useful Energy Conversion data is missing or empty. Using default efficiency only.");
        return { placeholderUsefulEfficiency };
    }
    parsedData.forEach(row => {
        const sector = row['Sector']; const subsector = row['Subsector']; const tech = row['Technology']; const fuel = row['Fuel']; const valuePercent = row['2023'];
        const valueFraction = isNaN(valuePercent) ? 0 : valuePercent / 100;
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
    parsedData.forEach(row => {
        const sector = row['Sector']; const tech = row['Technology']; const fuel = row['Fuel']; const valuePercent = row['2023'];
        if (tech) { basePowerProdMix[tech] = isNaN(valuePercent) ? 0 : valuePercent; }
    });
    if (!basePowerProdMix['Other power']) { basePowerProdMix['Other power'] = 0; }
    return { basePowerProdMix };
}
function transformHydrogenMixData(parsedData) {
    const baseHydrogenProdMix = {}; // Target: { Technology: Value_% }
    parsedData.forEach(row => {
        const sector = row['Sector']; const subsector = row['Subsector']; const tech = row['Technology']; const valuePercent = row['2023'];
        if (tech) { baseHydrogenProdMix[tech] = isNaN(valuePercent) ? 0 : valuePercent; }
    });
    return { baseHydrogenProdMix };
}
function transformPowerEffData(parsedData) {
    const powerTechUnitEnergyCons = {}; // Target: { Tech: { Fuel: Value_GJ_in_per_GJ_out } }
    parsedData.forEach(row => {
        const sector = row['Sector']; const tech = row['Technology']; const fuel = row['Fuel']; const efficiencyPercent = row['2023'];
        const efficiencyFraction = isNaN(efficiencyPercent) ? 0 : efficiencyPercent / 100;
        const unitCons = (efficiencyFraction > 0.001) ? 1 / efficiencyFraction : 0;
        if (!fuel && tech) { console.warn(`Missing 'Fuel' column in Power tech eff data for Tech: ${tech}. Cannot calculate Unit Energy Consumption.`); return; }
        if (tech && fuel) {
             if (!powerTechUnitEnergyCons[tech]) powerTechUnitEnergyCons[tech] = {};
             powerTechUnitEnergyCons[tech][fuel] = unitCons;
        }
    });
    if (!powerTechUnitEnergyCons['Other power']) { powerTechUnitEnergyCons['Other power'] = { 'Other': 2.5 }; }
    return { powerTechUnitEnergyCons };
}
function transformHydrogenEffData(parsedData) {
     const hydrogenTechUnitEnergyCons = {}; // Target: { Tech: { Fuel: Value_GJ_in_per_GJ_out } }
     parsedData.forEach(row => {
         const sector = row['Sector']; const subsector = row['Subsector']; const tech = row['Technology']; const fuel = row['Fuel']; const efficiencyPercent = row['2023'];
         const efficiencyFraction = isNaN(efficiencyPercent) ? 0 : efficiencyPercent / 100;
         const unitCons = (efficiencyFraction > 0.001) ? 1 / efficiencyFraction : 0;
         if (!fuel && tech) { console.warn(`Missing 'Fuel' column in Hydrogen tech eff data for Tech: ${tech}. Cannot calculate Unit Energy Consumption.`); return; }
         if (tech && fuel) {
              if (!hydrogenTechUnitEnergyCons[tech]) hydrogenTechUnitEnergyCons[tech] = {};
              hydrogenTechUnitEnergyCons[tech][fuel] = unitCons;
         }
     });
     return { hydrogenTechUnitEnergyCons };
}
function transformOtherTransformData(parsedData) {
    const otherTechUnitEnergyCons = {}; // Target: { EndUseFuel: { Technology: { PrimaryFuel: Value_GJ_input_per_GJ_output } } }
    parsedData.forEach(row => {
        const sector = row['Sector']; const subsector = row['Subsector']; const tech = row['Technology']; const primaryFuel = row['Fuel']; const valueGJconsumedPerGJrefined = row['2023'];
        let endUseFuel = null;
        if (subsector && subsector.toLowerCase().includes('gas')) endUseFuel = 'Gas'; else if (subsector && subsector.toLowerCase().includes('oil')) endUseFuel = 'Oil'; else if (subsector && subsector.toLowerCase().includes('coal')) endUseFuel = 'Coal'; else if (subsector && subsector.toLowerCase().includes('biomass')) endUseFuel = 'Biomass';
        if (endUseFuel && tech && primaryFuel) {
            const consumedPerRefined = isNaN(valueGJconsumedPerGJrefined) ? 0 : valueGJconsumedPerGJrefined;
            let unitCons = (primaryFuel === endUseFuel) ? 1 + consumedPerRefined : consumedPerRefined;
            if (unitCons > 0.0001) {
                 if (!otherTechUnitEnergyCons[endUseFuel]) otherTechUnitEnergyCons[endUseFuel] = {};
                 if (!otherTechUnitEnergyCons[endUseFuel][tech]) otherTechUnitEnergyCons[endUseFuel][tech] = {};
                 otherTechUnitEnergyCons[endUseFuel][tech][primaryFuel] = unitCons;
            }
        }
    });
    if (!otherTechUnitEnergyCons['Biomass']) { otherTechUnitEnergyCons['Biomass'] = { 'Biomass refining': { 'Biomass': 1.1 } }; }
    if (otherTechUnitEnergyCons['Oil'] && otherTechUnitEnergyCons['Oil']['Oil refining']) { if (!otherTechUnitEnergyCons['Oil']['Oil refining']['Gas']) { otherTechUnitEnergyCons['Oil']['Oil refining']['Gas'] = 0.05; } if (!otherTechUnitEnergyCons['Oil']['Oil refining']['Oil']) { otherTechUnitEnergyCons['Oil']['Oil refining']['Oil'] = 1.05; } }
    const baseOtherProdMix = {};
    Object.keys(otherTechUnitEnergyCons).forEach(fuel => {
        const techs = Object.keys(otherTechUnitEnergyCons[fuel]);
        if (techs.length > 0) { baseOtherProdMix[fuel] = {}; baseOtherProdMix[fuel][techs[0]] = 100; for(let i = 1; i < techs.length; i++){ baseOtherProdMix[fuel][techs[i]] = 0; } }
    });
    return { otherTechUnitEnergyCons, baseOtherProdMix };
}
// --- End of Transformation Functions ---


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
                 if (response.status === 404) { console.warn(`File not found: ${path}. Treating as empty.`); rawData[key] = []; return; }
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
        const { placeholderUsefulEfficiency } = transformUsefulEnergyConvData(rawData.usefulEnergyConv || []);
        const { basePowerProdMix } = transformPowerMixData(rawData.powerTechMix || []);
        const { baseHydrogenProdMix } = transformHydrogenMixData(rawData.hydrogenTechMix || []);
        const { powerTechUnitEnergyCons } = transformPowerEffData(rawData.powerTechEff || []);
        const { hydrogenTechUnitEnergyCons } = transformHydrogenEffData(rawData.hydrogenTechEff || []);
        const { otherTechUnitEnergyCons, baseOtherProdMix } = transformOtherTransformData(rawData.otherTransform || []);

        // Derive secondary structures
        let allSectors = new Set(); let allSubsectors = {}; let allTechnologies = {};
        const processRow = (row) => { /* ... (keep processRow logic as before) ... */
            if (!row || !row.Sector) return;
            const sector = row.Sector; allSectors.add(sector); const subsector = row.Subsector;
            if (subsector) { if (!allSubsectors[sector]) allSubsectors[sector] = new Set(); allSubsectors[sector].add(subsector); const tech = row.Technology;
                if (tech) { if (!allTechnologies[sector]) allTechnologies[sector] = {}; if (!allTechnologies[sector][subsector]) allTechnologies[sector][subsector] = new Set(); allTechnologies[sector][subsector].add(tech); }
            }
        };
        (rawData.activityLevel || []).forEach(processRow); (rawData.endUseTechMix || []).forEach(processRow); (rawData.endUseTechEnergyCons || []).forEach(processRow);
        allSectors.add('Power'); allSubsectors['Power'] = new Set(['Electricity']); allTechnologies['Power'] = { 'Electricity': new Set(Object.keys(basePowerProdMix)) };
        allSectors.add('Energy industry'); allSubsectors['Energy industry'] = new Set(['Hydrogen']); allTechnologies['Energy industry'] = { 'Hydrogen': new Set(Object.keys(baseHydrogenProdMix)) };
        const sectors = Array.from(allSectors); const subsectors = {}; sectors.forEach(s => { subsectors[s] = Array.from(allSubsectors[s] || new Set()); }); const technologies = {}; sectors.forEach(s => { technologies[s] = {}; (subsectors[s] || []).forEach(b => { technologies[s][b] = Array.from(allTechnologies[s]?.[b] || new Set()); }); });

        const endUseFuels = ["Biomass", "Coal", "Electricity", "Gas", "Hydrogen", "Oil"];
        const primaryFuels = ["Biomass", "Coal", "Gas", "Hydro", "Oil", "Other", "Solar", "Uranium", "Wind"];
        const hydrogenTechs = Object.keys(baseHydrogenProdMix);
        const powerTechs = Object.keys(basePowerProdMix);
        const otherConvTechs = {}; Object.keys(otherTechUnitEnergyCons).forEach(fuel => { otherConvTechs[fuel] = Object.keys(otherTechUnitEnergyCons[fuel]); });
        const allEndUseSubsectors = sectors.filter(s => s !== 'Power' && s !== 'Energy industry').flatMap(s => (subsectors[s] || []).map(b => ({ sector: s, subsector: b })));

        structuredModelData = {
            // Base data objects
            baseActivity, activityUnits, baseDemandTechMix, unitEnergyConsumption,
            placeholderUsefulEfficiency, basePowerProdMix, baseHydrogenProdMix,
            powerTechUnitEnergyCons, hydrogenTechUnitEnergyCons, otherTechUnitEnergyCons,
            baseOtherProdMix,
            // Derived/defined structures
            sectors, subsectors, technologies, endUseFuels, primaryFuels,
            hydrogenTechs, powerTechs, otherConvTechs, allEndUseSubsectors,
            // Include years array <<<< FIX ADDED HERE
            startYear, endYear, years
        };

        console.log("Data transformation complete.");
        // console.log("Structured Data:", structuredModelData); // DEBUG
        return structuredModelData;

    } catch (transformError) {
        console.error("Error during data transformation:", transformError);
        structuredModelData = null;
        throw transformError;
    }
}
