// js/dataLoader.js
// Version: Handles Fractional Percentages in CSV

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
    otherTransform: 'data/Other_transform_tech_energy_int.csv',
    scenarios: 'data/scenarios.csv'
};

// Define years range (needed by model logic and charting)
const startYear = 2023;
const endYear = 2050;
const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);


// Placeholder for the final structured data
let structuredModelData = null;

/**
 * Basic CSV parser (assumes comma delimiter and simple structure)
 */
function parseCSV(csvText) {
    const lines = csvText.replace(/[\r\n]+$/, '').split(/[\r\n]+/);
    if (lines.length < 1) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = lines[i].split(',');
        const entry = {};
        let isValidEntry = true;
        if (values.length !== headers.length) { isValidEntry = false; }
        if (isValidEntry) {
            for (let j = 0; j < headers.length; j++) {
                const header = headers[j];
                if (header === undefined) continue;
                const value = values[j] ? values[j].trim().replace(/^"|"$/g, '') : '';
                // Parse '2023' column as float, others as string
                if (header === '2023') {
                    // Remove only commas now, as % sign is not expected
                    const cleanedValue = value.replace(/,/g, '');
                    const floatValue = parseFloat(cleanedValue);
                    entry[header] = isNaN(floatValue) ? NaN : floatValue;
                } else { entry[header] = value; }
            }
            data.push(entry);
        }
    }
    return data;
}

// --- Data Transformation Functions ---
// UPDATED to handle fractional percentages in CSVs

function transformActivityData(parsedData) {
    // No change needed here, activity is not a percentage
    const baseActivity = {}; const activityUnits = {};
    parsedData.forEach(row => {
        const sector = row['Sector']; const subsector = row['Subsector']; const unit = row['Unit']; const value = row['2023'];
        if (sector && subsector) {
            if (!baseActivity[sector]) baseActivity[sector] = {}; if (!activityUnits[sector]) activityUnits[sector] = {};
            baseActivity[sector][subsector] = isNaN(value) ? 0 : value; activityUnits[sector][subsector] = unit || '';
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

            // Debug log from previous step (now shows fraction -> percent)
            if (sector === 'Industry' && subsector === 'Steel' && tech === 'EAF') {
                console.log(`DEBUG (dataLoader - transformEndUseMixData): Parsed Steel EAF 2023 fraction = ${valueFraction}, Stored as % = ${valuePercent}`);
            }
        }
    });
    return { baseDemandTechMix };
}

function transformEndUseEnergyConsData(parsedData) {
    // No change needed here, energy cons is not a percentage
    const unitEnergyConsumption = {}; const GJ_PER_TJ = 1000;
    parsedData.forEach(row => {
        const sector = row['Sector']; const subsector = row['Subsector']; const tech = row['Technology']; const fuel = row['Fuel']; const valueTJ = row['2023'];

        if (tech === 'DRI-EAF (H2)') {
            console.log(`DEBUG (dataLoader): Loading DRI-EAF (H2). Fuel: '${fuel}', ValueTJ: ${valueTJ}`);
        }

        if (sector && subsector && tech && fuel) {
            const valueGJ = (isNaN(valueTJ) ? 0 : valueTJ) * GJ_PER_TJ;
            if (!unitEnergyConsumption[sector]) unitEnergyConsumption[sector] = {}; if (!unitEnergyConsumption[sector][subsector]) unitEnergyConsumption[sector][subsector] = {}; if (!unitEnergyConsumption[sector][subsector][tech]) unitEnergyConsumption[sector][subsector][tech] = {};
            unitEnergyConsumption[sector][subsector][tech][fuel] = valueGJ;
        }
    });
    return { unitEnergyConsumption };
}

function transformUsefulEnergyConvData(parsedData) {
    const placeholderUsefulEfficiency = { '_default': 0.65 };
    const usefulEnergyTypeMap = {}; // New map for Type

    if (!parsedData || parsedData.length === 0) { console.warn("Useful Energy Conversion data is missing or empty. Using default efficiency only."); return { placeholderUsefulEfficiency, usefulEnergyTypeMap }; }
    parsedData.forEach(row => {
        const sector = row['Sector']; const subsector = row['Subsector']; const tech = row['Technology']; const fuel = row['Fuel'];
        const valueFraction = row['2023']; // Read the fraction directly (e.g., 0.9)
        const type = row['Type']; // Read the Type

        if (sector && subsector && tech && fuel) {
            if (!placeholderUsefulEfficiency[sector]) placeholderUsefulEfficiency[sector] = {}; if (!placeholderUsefulEfficiency[sector][subsector]) placeholderUsefulEfficiency[sector][subsector] = {}; if (!placeholderUsefulEfficiency[sector][subsector][tech]) placeholderUsefulEfficiency[sector][subsector][tech] = {};
            // *** Store the fraction directly ***
            placeholderUsefulEfficiency[sector][subsector][tech][fuel] = isNaN(valueFraction) ? 0 : valueFraction;

            // *** Store the Type ***
            if (type) {
                if (!usefulEnergyTypeMap[sector]) usefulEnergyTypeMap[sector] = {};
                if (!usefulEnergyTypeMap[sector][subsector]) usefulEnergyTypeMap[sector][subsector] = {};
                if (!usefulEnergyTypeMap[sector][subsector][tech]) usefulEnergyTypeMap[sector][subsector][tech] = {};
                usefulEnergyTypeMap[sector][subsector][tech][fuel] = type;
            }
        }
    });
    return { placeholderUsefulEfficiency, usefulEnergyTypeMap };
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
    // No change needed here, this file uses GJ_consumed/GJ_refined, not percentages
    const otherTechUnitEnergyCons = {};
    parsedData.forEach(row => {
        const subsector = row['Subsector']; const tech = row['Technology']; const primaryFuel = row['Fuel']; const valueGJconsumedPerGJrefined = row['2023'];
        let endUseFuel = null; if (subsector && subsector.toLowerCase().includes('gas')) endUseFuel = 'Gas'; else if (subsector && subsector.toLowerCase().includes('oil')) endUseFuel = 'Oil'; else if (subsector && subsector.toLowerCase().includes('coal')) endUseFuel = 'Coal'; else if (subsector && subsector.toLowerCase().includes('biomass')) endUseFuel = 'Biomass';
        if (endUseFuel && tech && primaryFuel) {
            const consumedPerRefined = isNaN(valueGJconsumedPerGJrefined) ? 0 : valueGJconsumedPerGJrefined; let unitCons = (primaryFuel === endUseFuel) ? 1 + consumedPerRefined : consumedPerRefined;
            if (unitCons > 0.0001) { if (!otherTechUnitEnergyCons[endUseFuel]) otherTechUnitEnergyCons[endUseFuel] = {}; if (!otherTechUnitEnergyCons[endUseFuel][tech]) otherTechUnitEnergyCons[endUseFuel][tech] = {}; otherTechUnitEnergyCons[endUseFuel][tech][primaryFuel] = unitCons; }
        }
    });
    if (!otherTechUnitEnergyCons['Biomass']) { otherTechUnitEnergyCons['Biomass'] = { 'Biomass refining': { 'Biomass': 1.1 } }; }
    if (otherTechUnitEnergyCons['Oil'] && otherTechUnitEnergyCons['Oil']['Oil refining']) { if (!otherTechUnitEnergyCons['Oil']['Oil refining']['Gas']) { otherTechUnitEnergyCons['Oil']['Oil refining']['Gas'] = 0.05; } if (!otherTechUnitEnergyCons['Oil']['Oil refining']['Oil']) { otherTechUnitEnergyCons['Oil']['Oil refining']['Oil'] = 1.05; } }
    const baseOtherProdMix = {}; Object.keys(otherTechUnitEnergyCons).forEach(fuel => { const techs = Object.keys(otherTechUnitEnergyCons[fuel]); if (techs.length > 0) { baseOtherProdMix[fuel] = {}; baseOtherProdMix[fuel][techs[0]] = 100; for (let i = 1; i < techs.length; i++) { baseOtherProdMix[fuel][techs[i]] = 0; } } });
    return { otherTechUnitEnergyCons, baseOtherProdMix };
}

function transformScenariosData(parsedData) {
    const scenarios = {};
    parsedData.forEach(row => {
        const scenario = row['Scenario'];
        const paramKey = row['ParameterKey'];
        const behavior = row['Behavior'];
        const targetShare = row['TargetShare'];
        const targetYear = row['TargetYear'];
        const kValue = row['KValue'];
        const midpointYear = row['MidpointYear'];

        if (scenario && paramKey && behavior) {
            if (!scenarios[scenario]) scenarios[scenario] = {};
            scenarios[scenario][paramKey] = {
                behavior,
                targetShare: parseFloat(targetShare) || 0,
                targetYear: parseInt(targetYear, 10) || 2050,
                kValue: parseFloat(kValue) || 0.15,
                midpointYear: parseInt(midpointYear, 10) || 2037
            };
        }
    });
    return { scenarios };
}
// --- End of Transformation Functions ---


// --- Main Loading Function ---
async function loadAndStructureData() {
    if (structuredModelData) { console.log("Returning cached structured data."); return structuredModelData; }
    console.log("Starting data load and transformation...");
    const rawData = {};
    const loadPromises = Object.entries(csvFiles).map(async ([key, path]) => { /* ... (fetch/parse logic unchanged) ... */
        try {
            const response = await fetch(`${path}?t=${Date.now()}`);
            if (!response.ok) { if (response.status === 404) { console.warn(`File not found: ${path}. Treating as empty.`); rawData[key] = []; return; } throw new Error(`HTTP error! status: ${response.status} for ${path}`); }
            const csvText = await response.text(); rawData[key] = parseCSV(csvText); console.log(`Successfully loaded and parsed: ${path}`);
        } catch (error) { console.error(`Failed to load or parse ${path}:`, error); rawData[key] = []; }
    });
    await Promise.all(loadPromises);
    console.log("All raw data loading attempts finished. Starting transformation...");

    try {
        // Perform transformations with updated logic
        const { baseActivity, activityUnits } = transformActivityData(rawData.activityLevel || []);
        const { baseDemandTechMix } = transformEndUseMixData(rawData.endUseTechMix || []); // Now stores 0-100
        const { unitEnergyConsumption } = transformEndUseEnergyConsData(rawData.endUseTechEnergyCons || []);
        const { placeholderUsefulEfficiency, usefulEnergyTypeMap } = transformUsefulEnergyConvData(rawData.usefulEnergyConv || []); // Now stores 0-1
        const { basePowerProdMix } = transformPowerMixData(rawData.powerTechMix || []); // Now stores 0-100
        const { baseHydrogenProdMix } = transformHydrogenMixData(rawData.hydrogenTechMix || []); // Now stores 0-100
        const { powerTechUnitEnergyCons } = transformPowerEffData(rawData.powerTechEff || []); // Now uses 0-1 input
        const { hydrogenTechUnitEnergyCons } = transformHydrogenEffData(rawData.hydrogenTechEff || []); // Now uses 0-1 input
        const { otherTechUnitEnergyCons, baseOtherProdMix } = transformOtherTransformData(rawData.otherTransform || []);
        const { scenarios } = transformScenariosData(rawData.scenarios || []);

        // Debug log from previous step (now shows fraction -> percent)
        console.log("DEBUG (dataLoader - loadAndStructureData): Final baseDemandTechMix for Steel:", JSON.stringify(baseDemandTechMix?.Industry?.Steel));

        // Derive secondary structures (logic unchanged)
        let allSectors = new Set(); let allSubsectors = {}; let allTechnologies = {};
        const processRow = (row) => { if (!row || !row.Sector) return; const sector = row.Sector; allSectors.add(sector); const subsector = row.Subsector; if (subsector) { if (!allSubsectors[sector]) allSubsectors[sector] = new Set(); allSubsectors[sector].add(subsector); const tech = row.Technology; if (tech) { if (!allTechnologies[sector]) allTechnologies[sector] = {}; if (!allTechnologies[sector][subsector]) allTechnologies[sector][subsector] = new Set(); allTechnologies[sector][subsector].add(tech); } } };
        (rawData.activityLevel || []).forEach(processRow); (rawData.endUseTechMix || []).forEach(processRow); (rawData.endUseTechEnergyCons || []).forEach(processRow);
        allSectors.add('Power'); allSubsectors['Power'] = new Set(['Electricity']); allTechnologies['Power'] = { 'Electricity': new Set(Object.keys(basePowerProdMix)) };
        allSectors.add('Energy industry'); allSubsectors['Energy industry'] = new Set(['Hydrogen']); allTechnologies['Energy industry'] = { 'Hydrogen': new Set(Object.keys(baseHydrogenProdMix)) };
        const sectors = Array.from(allSectors); const subsectors = {}; sectors.forEach(s => { subsectors[s] = Array.from(allSubsectors[s] || new Set()); }); const technologies = {}; sectors.forEach(s => { technologies[s] = {}; (subsectors[s] || []).forEach(b => { technologies[s][b] = Array.from(allTechnologies[s]?.[b] || new Set()); }); });

        const endUseFuels = ["Biomass", "Coal", "Electricity", "Gas", "Hydrogen", "Oil"]; const primaryFuels = ["Biomass", "Coal", "Gas", "Hydro", "Oil", "Other", "Solar", "Uranium", "Wind"];
        const hydrogenTechs = Object.keys(baseHydrogenProdMix); const powerTechs = Object.keys(basePowerProdMix); const otherConvTechs = {}; Object.keys(otherTechUnitEnergyCons).forEach(fuel => { otherConvTechs[fuel] = Object.keys(otherTechUnitEnergyCons[fuel]); });
        const allEndUseSubsectors = sectors.filter(s => s !== 'Power' && s !== 'Energy industry').flatMap(s => (subsectors[s] || []).map(b => ({ sector: s, subsector: b })));

        structuredModelData = {
            baseActivity, activityUnits, baseDemandTechMix, unitEnergyConsumption, placeholderUsefulEfficiency, usefulEnergyTypeMap, basePowerProdMix, baseHydrogenProdMix, powerTechUnitEnergyCons, hydrogenTechUnitEnergyCons, otherTechUnitEnergyCons, baseOtherProdMix,
            sectors, subsectors, technologies, endUseFuels, primaryFuels, hydrogenTechs, powerTechs, otherConvTechs, allEndUseSubsectors,
            scenarios,
            startYear, endYear, years
        };
        console.log("Data transformation complete.");
        return structuredModelData;
    } catch (transformError) { console.error("Error during data transformation:", transformError); structuredModelData = null; throw transformError; }
}
