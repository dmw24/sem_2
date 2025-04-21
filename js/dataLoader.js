// js/dataLoader.js
// Further refactored for maximum conciseness
// Fixed TypeError: ensurePath(...).add is not a function

const CSV_FILES = { activityLevel: 'data/Activity_level.csv', usefulEnergyConv: 'data/Useful_energy_conv.csv', endUseTechMix: 'data/EndUseTechMix.csv', endUseTechEnergyCons: 'data/EndUseTech_energy_cons.csv', powerTechMix: 'data/Power_tech_mix.csv', hydrogenTechMix: 'data/Hydrogen_tech_mix.csv', hydrogenTechEff: 'data/Hydrogen_tech_eff.csv', powerTechEff: 'data/Power_tech_eff.csv', otherTransform: 'data/Other_transform_tech_energy_int.csv' };
const START_YEAR = 2023;
const END_YEAR = 2050;
const YEARS = Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i);
const GJ_PER_TJ = 1000;
let structuredModelData = null;

// Concise CSV parser
const parseCSV = (text = '') => {
    const lines = text.trim().split(/[\r\n]+/);
    if (lines.length < 1) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1)
        .map(line => line.trim() ? line.split(',') : null)
        .filter(values => values && values.length === headers.length)
        .map(values => headers.reduce((obj, header, j) => {
            const val = values[j]?.trim().replace(/^"|"$/g, '') ?? '';
            obj[header] = header === String(START_YEAR) ? (parseFloat(val.replace(/,/g, '')) || 0) : val;
            return obj;
        }, {}));
};

// Concise Data Transformation
const transformData = (rawData) => {
    const d = { // Use shorter variable 'd' for data object
        baseActivity: {}, activityUnits: {}, baseDemandTechMix: {}, unitEnergyConsumption: {},
        placeholderUsefulEfficiency: { '_default': 0.65 }, basePowerProdMix: {}, baseHydrogenProdMix: {},
        powerTechUnitEnergyCons: {}, hydrogenTechUnitEnergyCons: {}, otherTechUnitEnergyCons: {},
        baseOtherProdMix: {}, allSectors: new Set(), allSubsectors: {}, allTechnologies: {},
        endUseFuels: new Set(["Biomass", "Coal", "Electricity", "Gas", "Hydrogen", "Oil"]),
        primaryFuels: new Set(["Biomass", "Coal", "Gas", "Hydro", "Oil", "Other", "Solar", "Uranium", "Wind"]),
    };
    const val2023 = String(START_YEAR);
    const ensurePath = (obj, path) => path.reduce((acc, key) => (acc[key] = acc[key] || {}), obj);

    // Helper to add sector/subsector/tech meta
    const addMeta = (r, fuelsSet = null) => {
        if (!r?.Sector) return;
        d.allSectors.add(r.Sector);
        // Ensure subsector Set exists and add subsector
        if (r.Subsector) (d.allSubsectors[r.Sector] = d.allSubsectors[r.Sector] || new Set()).add(r.Subsector);
        // Ensure technology Set exists and add technology
        if (r.Subsector && r.Technology) {
            // 1. Ensure the Sector object exists in allTechnologies
            const techSectorContainer = ensurePath(d.allTechnologies, [r.Sector]); // Gets d.allTechnologies[r.Sector] or creates {}
            // 2. Ensure the Subsector property within that Sector object holds a Set
            techSectorContainer[r.Subsector] = techSectorContainer[r.Subsector] || new Set();
            // 3. Add the technology to that Set
            techSectorContainer[r.Subsector].add(r.Technology);
        }
        // Add fuel if applicable
        if (fuelsSet && r.Fuel) fuelsSet.add(r.Fuel);
    };

    rawData.activityLevel?.forEach(r => {
        if (!r.Sector || !r.Subsector) return;
        ensurePath(d.baseActivity, [r.Sector])[r.Subsector] = r[val2023] || 0;
        ensurePath(d.activityUnits, [r.Sector])[r.Subsector] = r.Unit || '';
        addMeta(r);
    });
    rawData.endUseTechMix?.forEach(r => {
        if (!r.Sector || !r.Subsector || !r.Technology) return;
        ensurePath(d.baseDemandTechMix, [r.Sector, r.Subsector])[r.Technology] = (r[val2023] || 0) * 100;
        addMeta(r); // Will add Sector, Subsector, and Technology to metadata Sets
    });
    rawData.endUseTechEnergyCons?.forEach(r => {
        if (!r.Sector || !r.Subsector || !r.Technology || !r.Fuel) return;
        ensurePath(d.unitEnergyConsumption, [r.Sector, r.Subsector, r.Technology])[r.Fuel] = (r[val2023] || 0) * GJ_PER_TJ;
        addMeta(r, d.endUseFuels); // Will add S/S/T and Fuel
    });
    rawData.usefulEnergyConv?.forEach(r => {
        if (!r.Sector || !r.Subsector || !r.Technology || !r.Fuel) return;
        ensurePath(d.placeholderUsefulEfficiency, [r.Sector, r.Subsector, r.Technology])[r.Fuel] = r[val2023] || 0;
        addMeta(r, d.endUseFuels); // Will add S/S/T and Fuel
    });
    rawData.powerTechMix?.forEach(r => r.Technology && (d.basePowerProdMix[r.Technology] = (r[val2023] || 0) * 100));
    rawData.powerTechEff?.forEach(r => {
        if (!r.Technology || !r.Fuel) return;
        const eff = r[val2023] || 0;
        ensurePath(d.powerTechUnitEnergyCons, [r.Technology])[r.Fuel] = eff > 1e-3 ? 1 / eff : 0;
        d.primaryFuels.add(r.Fuel);
    });
    d.basePowerProdMix['Other power'] ??= 0; // Use nullish assignment
    d.powerTechUnitEnergyCons['Other power'] ??= { 'Other': 2.5 };

    rawData.hydrogenTechMix?.forEach(r => r.Technology && (d.baseHydrogenProdMix[r.Technology] = (r[val2023] || 0) * 100));
    rawData.hydrogenTechEff?.forEach(r => {
        if (!r.Technology || !r.Fuel) return;
        const eff = r[val2023] || 0;
        ensurePath(d.hydrogenTechUnitEnergyCons, [r.Technology])[r.Fuel] = eff > 1e-3 ? 1 / eff : 0;
        d.endUseFuels.add(r.Fuel); // Input fuels
        d.primaryFuels.add(r.Fuel);
    });

    rawData.otherTransform?.forEach(r => {
        if (!r.Subsector || !r.Technology || !r.Fuel) return;
        const subLower = r.Subsector.toLowerCase();
        const endUseFuel = subLower.includes('gas') ? 'Gas' : subLower.includes('oil') ? 'Oil' : subLower.includes('coal') ? 'Coal' : subLower.includes('biomass') ? 'Biomass' : null;
        if (!endUseFuel) return;
        const primaryFuel = r.Fuel;
        const consumedPerRefined = r[val2023] || 0;
        const unitCons = primaryFuel === endUseFuel ? 1 + consumedPerRefined : consumedPerRefined;
        if (unitCons > 1e-4) ensurePath(d.otherTechUnitEnergyCons, [endUseFuel, r.Technology])[primaryFuel] = unitCons;
        d.endUseFuels.add(endUseFuel);
        d.primaryFuels.add(primaryFuel);
    });
    d.otherTechUnitEnergyCons['Biomass'] ??= { 'Biomass refining': { 'Biomass': 1.1 } };
    const oilRefining = d.otherTechUnitEnergyCons['Oil']?.['Oil refining'];
    if (oilRefining) { oilRefining['Gas'] ??= 0.05; oilRefining['Oil'] ??= 1.05; }

    Object.entries(d.otherTechUnitEnergyCons).forEach(([fuel, techs]) => {
        const techNames = Object.keys(techs);
        if (techNames.length > 0) d.baseOtherProdMix[fuel] = techNames.reduce((mix, name, i) => ({ ...mix, [name]: i === 0 ? 100 : 0 }), {});
    });

    // Finalize structures
    d.sectors = Array.from(d.allSectors).concat(['Power', 'Energy industry']);
    d.subsectors = d.sectors.reduce((acc, s) => ({ ...acc, [s]: Array.from(d.allSubsectors[s] || []) }), {});
    d.subsectors['Power'] = ['Electricity']; d.subsectors['Energy industry'] = ['Hydrogen'];
    // Convert nested technology Sets to Arrays
    d.technologies = d.sectors.reduce((acc, s) => {
        acc[s] = {}; // Ensure sector object exists
        if (d.allTechnologies[s]) { // Check if sector exists in the temp structure
             Object.entries(d.allTechnologies[s]).forEach(([subsector, techSet]) => {
                 if (techSet instanceof Set) { // Check if it's a Set before converting
                     acc[s][subsector] = Array.from(techSet);
                 } else {
                     console.warn(`Expected Set for technologies[${s}][${subsector}], found:`, techSet);
                     acc[s][subsector] = []; // Default to empty array if not a Set
                 }
             });
        }
        // Ensure subsectors defined in d.subsectors but maybe not in d.allTechnologies get an empty array
        (d.subsectors[s] || []).forEach(b => {
             acc[s][b] = acc[s][b] || [];
        });
        return acc;
    }, {});

    d.technologies['Power'] = { 'Electricity': Object.keys(d.basePowerProdMix) };
    d.technologies['Energy industry'] = { 'Hydrogen': Object.keys(d.baseHydrogenProdMix) };
    d.endUseFuels = Array.from(d.endUseFuels); d.primaryFuels = Array.from(d.primaryFuels);
    d.hydrogenTechs = Object.keys(d.baseHydrogenProdMix); d.powerTechs = Object.keys(d.basePowerProdMix);
    d.otherConvTechs = Object.entries(d.otherTechUnitEnergyCons).reduce((acc, [fuel, techs]) => ({ ...acc, [fuel]: Object.keys(techs) }), {});
    d.allEndUseSubsectors = d.sectors.filter(s => !['Power', 'Energy industry'].includes(s)).flatMap(s => (d.subsectors[s] || []).map(b => ({ sector: s, subsector: b })));
    d.startYear = START_YEAR; d.endYear = END_YEAR; d.years = YEARS;
    delete d.allSectors; delete d.allSubsectors; delete d.allTechnologies; // Cleanup temp sets
    return d;
};

// Concise Loading Function
async function loadAndStructureData() {
    if (structuredModelData) return structuredModelData;
    console.log("Loading data...");
    const rawData = {};
    await Promise.all(Object.entries(CSV_FILES).map(async ([key, path]) => {
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error(`${response.status} for ${path}`);
            rawData[key] = parseCSV(await response.text());
        } catch (error) {
            console.warn(`Failed to load ${path}: ${error.message}. Using empty.`);
            rawData[key] = [];
        }
    }));
    console.log("Raw data loaded. Transforming...");
    try {
        structuredModelData = transformData(rawData);
        console.log("Data transformed.");
        return structuredModelData;
    } catch (transformError) {
        console.error("Data transformation error:", transformError);
        structuredModelData = null; throw transformError; // Re-throw error
    }
}
