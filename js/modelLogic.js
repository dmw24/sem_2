// js/modelLogic.js

// --- Constants and Definitions ---
// REMOVED duplicate const startYear, endYear, years declarations.
// These values are now expected to be passed via the structuredData argument.

const GJ_PER_EJ = 1e9; // Conversion factor from GJ to EJ for results

// Default behavior mappings (from reference)
// These help initialize the UI state but the actual parameters are read from UI inputs.
const defaultDeclineDemandTechs = { 'Transport|Passenger cars': 'ICE', 'Transport|Trucks': 'ICE', 'Transport|Buses': 'ICE', 'Transport|2/3 wheelers': 'ICE', 'Transport|Ships': 'Conventional ship', 'Transport|Planes': 'Conventional plane', 'Transport|Trains': 'Diesel train', 'Industry|Steel': 'BF-BOF', 'Industry|Cement': 'Conventional kiln', 'Industry|Chemicals': 'Conventional', 'Industry|Low temp. heating': 'Fossil boiler', 'Industry|High temp. heating': 'Fossil furnace', 'Industry|Other industry - energy': 'Conventional', 'Buildings|Residential heating': 'Fossil boiler', 'Buildings|Residential cooking': 'Conventional fossil', 'Buildings|Residential lighting': 'Conventional', 'Buildings|Other residential': 'Conventional', 'Buildings|Building cooling': 'Low efficiency airco', 'Buildings|Commercial heating': 'Fossil boiler', 'Buildings|Commercial lighting': 'Conventional', 'Buildings|Other commercial': 'Conventional', 'Transport|Other transport': 'Conventional' };
const defaultSCurveDemandTechs = { 'Transport|Passenger cars': 'EV', 'Transport|Trucks': 'EV', 'Transport|Buses': 'EV', 'Transport|2/3 wheelers': 'EV', 'Transport|Ships': 'Ammonia ship', 'Transport|Planes': 'Electric plane', 'Transport|Trains': 'Electric train', 'Industry|Steel': 'DRI-EAF (H2)', 'Industry|Cement': 'Electric kiln', 'Industry|Chemicals': 'Electrified', 'Industry|Low temp. heating': 'Heat pump', 'Industry|High temp. heating': 'Electric furnace', 'Industry|Other industry - energy': 'Electrified', 'Buildings|Residential heating': 'Heat pump', 'Buildings|Residential cooking': 'Electrified', 'Buildings|Residential lighting': 'Full LED', 'Buildings|Other residential': 'Electrified', 'Buildings|Building cooling': 'High efficiency airco', 'Buildings|Commercial heating': 'Heat pump', 'Buildings|Commercial lighting': 'Full LED', 'Buildings|Other commercial': 'Electrified', 'Transport|Other transport': 'Electrified' };
const defaultDeclinePowerTechs = ['Gas power', 'Coal power', 'Oil power'];
const defaultSCurvePowerTechs = ['Solar PV', 'Wind'];
const defaultDeclineHydrogenTechs = ['Blue'];
const defaultSCurveHydrogenTechs = ['Green'];


// --- Helper Functions --- (Copied from reference)

/**
 * Safely gets a nested value from an object.
 * @param {object} obj - The source object.
 * @param {string[]} keys - An array of keys representing the path.
 * @param {*} defaultValue - The value to return if the path is not found.
 * @returns {*} The value found at the path or the default value.
 */
function getValue(obj, keys, defaultValue = 0) {
    let current = obj;
    for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
            current = current[key];
        } else {
            return defaultValue;
        }
    }
    // Handle cases where the final value is null or undefined
    return (current === null || current === undefined) ? defaultValue : current;
}

/**
 * Calculates the share based on an S-curve trajectory.
 * Uses baseYear and endYear passed via structuredData.
 */
function calculateSCurveShare(year, startYearCurve, targetYear, steepnessInput, startVal, endVal, baseYear, endYear) { // Added baseYear, endYear args
    // Ensure inputs are numbers
    year = Number(year);
    startYearCurve = Number(startYearCurve || baseYear); // Use passed baseYear
    targetYear = Number(targetYear || endYear);       // Use passed endYear
    steepnessInput = Number(steepnessInput || 5); // Default steepness 5
    startVal = Number(startVal || 0);
    endVal = Number(endVal || 0);

    // Handle edge cases
    if (year >= targetYear) return endVal;
    if (year <= startYearCurve) return startVal;
    if (targetYear <= startYearCurve) return endVal; // Target year must be after start
    if (Math.abs(startVal - endVal) < 0.01) return startVal; // Avoid calculation if start/end are too close

    // Midpoint calculation based on steepness (1=late, 10=early)
    const midpointFraction = 0.1 + (0.8 * (steepnessInput - 1) / 9);
    const midpointYear = startYearCurve + (targetYear - startYearCurve) * midpointFraction;

    // Logistic function parameter k calculation (simplified from reference)
    let k = 0.15;
    if (Math.abs(targetYear - midpointYear) > 0.1) {
         k = 4 / Math.abs(targetYear - midpointYear);
    }
    if (endVal < startVal && k > 0) k = -k;
    if (endVal > startVal && k < 0) k = -k;
    if (Math.abs(k) < 0.01) k = (endVal > startVal) ? 0.05 : -0.05;

    // Calculate the exponent, handling potential overflow/underflow
    const exponent = -k * (year - midpointYear);
    if (exponent > 700) return startVal;
    if (exponent < -700) return endVal;

    // Logistic function calculation
    const share = startVal + (endVal - startVal) / (1 + Math.exp(exponent));

    // Clamp result between startVal and endVal
    return Math.max(Math.min(startVal, endVal), Math.min(Math.max(startVal, endVal), share));
}

/**
 * Normalizes shares within an object to sum to 100%.
 * Handles a special case where one tech is forced to 100%.
 */
function normalizeShares(sharesObject, force100Tech = null) {
    let total = Object.values(sharesObject).reduce((sum, val) => sum + Number(val || 0), 0);
    const normalized = {};
    if (force100Tech && force100Tech in sharesObject && Math.abs(sharesObject[force100Tech] - 100) < 0.1) {
        for (const key in sharesObject) { normalized[key] = (key === force100Tech) ? 100 : 0; }
        return normalized;
    }
    if (total <= 0.001) { return sharesObject; }
    const scaleFactor = 100 / total;
    for (const key in sharesObject) { normalized[key] = (Number(sharesObject[key] || 0)) * scaleFactor; }
    if (force100Tech && normalized[force100Tech] && Math.abs(normalized[force100Tech] - 100) < 0.1) {
         for (const key in sharesObject) { normalized[key] = (key === force100Tech) ? 100 : 0; }
    }
    return normalized;
}


// --- CORE MODEL CALCULATION FUNCTION ---

/**
 * Runs the full energy model projection calculation.
 * @param {object} structuredData - The structured data object from dataLoader.js.
 * @param {object} userInputParameters - Object containing user inputs from the UI.
 * @returns {object} - An object containing yearly results: { year: { activity, demandTechMix, ..., pedByFuel }, ... }
 */
function runModelCalculation(structuredData, userInputParameters) {

    // Destructure needed data and parameters from arguments
    const {
        baseActivity, baseDemandTechMix, unitEnergyConsumption, placeholderUsefulEfficiency,
        basePowerProdMix, baseHydrogenProdMix, powerTechUnitEnergyCons, hydrogenTechUnitEnergyCons,
        otherTechUnitEnergyCons, baseOtherProdMix,
        // Derived structures:
        sectors, subsectors, technologies, endUseFuels, primaryFuels,
        hydrogenTechs, powerTechs, otherConvTechs,
        // Years needed for calculations
        startYear, endYear, years // <<<< Get years from structuredData
    } = structuredData;

    const { activityGrowthFactors, techBehaviorsAndParams } = userInputParameters;

    // Define baseYear locally based on startYear from data
    const baseYear = startYear;

    console.log(`--- Running Full Model Projection (${startYear}-${endYear}) ---`); // Use years from data

    const yearlyResults = {};

    // --- Yearly Calculation Loop ---
    for (const year of years) { // Use years array from structuredData
        yearlyResults[year] = {};

        // 1. Calculate Activity Levels
        const currentActivity = {};
        if (year === baseYear) {
             Object.assign(currentActivity, baseActivity);
        } else {
            const prevActivity = yearlyResults[year - 1].activity;
            sectors.forEach(s => {
                if(subsectors[s]){
                    currentActivity[s] = {};
                    subsectors[s].forEach(b => {
                        const growthInputKey = `${s}|${b}`;
                        const growthFactor = activityGrowthFactors[growthInputKey] !== undefined ? activityGrowthFactors[growthInputKey] : 1.0;
                        currentActivity[s][b] = getValue(prevActivity, [s, b], 0) * growthFactor;
                    });
                }
            });
        }
        yearlyResults[year].activity = currentActivity;

        // 2. Calculate Technology Mixes
        const calculateMixWithBehavior = (categoryType, categoryKey, techList, baseMixObject) => {
            // ... (rest of calculateMixWithBehavior function is unchanged,
            //      it calls calculateSCurveShare which now uses passed endYear) ...
            const currentShares = {}; let sCurveTotalShare = 0; let fixedBaseTotal = 0; let declineBaseTotal = 0;
            const sCurveTechs = []; const fixedTechs = []; const declineTechs = []; const baseMix = baseMixObject;
            let techTargeting100 = null;
            techList.forEach(t => {
                const paramKey = `${categoryType}|${categoryKey}|${t}`;
                const behaviorInfo = techBehaviorsAndParams[paramKey] || { behavior: 'fixed' };
                const baseValue = getValue(baseMix, [t], 0);
                if (behaviorInfo.behavior === 's-curve') {
                    // Pass baseYear and endYear from structuredData to S-curve calculation
                    const share = calculateSCurveShare(year, baseYear, behaviorInfo.targetYear, behaviorInfo.steepness, baseValue, behaviorInfo.targetShare, baseYear, endYear);
                    currentShares[t] = share; sCurveTotalShare += share; sCurveTechs.push(t);
                    if (Math.abs(behaviorInfo.targetShare - 100) < 0.01 && year >= behaviorInfo.targetYear) { techTargeting100 = t; }
                } else if (behaviorInfo.behavior === 'fixed') {
                    currentShares[t] = baseValue; fixedBaseTotal += baseValue; fixedTechs.push(t);
                } else { currentShares[t] = baseValue; declineBaseTotal += baseValue; declineTechs.push(t); }
            });
            if (techTargeting100) { return normalizeShares(currentShares, techTargeting100); }
            const availableForFixedAndDecline = Math.max(0, 100 - sCurveTotalShare);
            const targetFixedTotal = Math.min(fixedBaseTotal, availableForFixedAndDecline);
            const fixedScaleFactor = (fixedBaseTotal > 0.01) ? targetFixedTotal / fixedBaseTotal : 0;
            let fixedAllocatedTotal = 0;
            fixedTechs.forEach(t => { const scaledShare = currentShares[t] * fixedScaleFactor; currentShares[t] = scaledShare; fixedAllocatedTotal += scaledShare; });
            const availableForDecline = Math.max(0, availableForFixedAndDecline - fixedAllocatedTotal);
            const declineScaleFactor = (declineBaseTotal > 0.01) ? availableForDecline / declineBaseTotal : 0;
            declineTechs.forEach(t => { currentShares[t] *= declineScaleFactor; });
            return normalizeShares(currentShares, null);
        };

        try {
            const currentDemandTechMix = {}; sectors.forEach(s => { if(subsectors[s]){ currentDemandTechMix[s] = {}; subsectors[s].forEach(b => { const base = getValue(baseDemandTechMix, [s, b], {}); const techs = technologies[s]?.[b] || []; currentDemandTechMix[s][b] = calculateMixWithBehavior('Demand', `${s}|${b}`, techs, base); }); } }); yearlyResults[year].demandTechMix = currentDemandTechMix;
            yearlyResults[year].powerProdMix = calculateMixWithBehavior('Power', 'Power', powerTechs, basePowerProdMix);
            yearlyResults[year].hydrogenProdMix = calculateMixWithBehavior('Hydrogen', 'Hydrogen', hydrogenTechs, baseHydrogenProdMix);
        } catch (mixError) { console.error(`Error calculating mix for year ${year}:`, mixError); throw mixError; }

        // 3. Calculate Demand Technology Activity
        const currentDemandTechMix_yr = yearlyResults[year].demandTechMix; const currentActivity_yr = yearlyResults[year].activity; const currentDemandTechActivity = {}; sectors.forEach(s => { if(subsectors[s]){ currentDemandTechActivity[s] = {}; subsectors[s].forEach(b => { currentDemandTechActivity[s][b] = {}; const techs = technologies[s]?.[b] || []; techs.forEach(t => { const mixPercent = getValue(currentDemandTechMix_yr, [s, b, t], 0); const mixFraction = mixPercent / 100; const activityLevel = getValue(currentActivity_yr, [s, b], 0); currentDemandTechActivity[s][b][t] = mixFraction * activityLevel; }); }); } }); yearlyResults[year].demandTechActivity = currentDemandTechActivity;

        // 4. Calculate FEC and UE
        const currentFecDetailed = {}; const currentUeDetailed = {}; const currentFecByFuel = endUseFuels.reduce((acc, f) => ({ ...acc, [f]: 0 }), {}); const currentUeByFuel = endUseFuels.reduce((acc, f) => ({ ...acc, [f]: 0 }), {}); const currentUeBySubsector = {}; sectors.forEach(s => { if(subsectors[s]){ currentFecDetailed[s] = {}; currentUeDetailed[s] = {}; subsectors[s].forEach(b => { currentFecDetailed[s][b] = {}; currentUeDetailed[s][b] = {}; currentUeBySubsector[b] = 0; const techs = technologies[s]?.[b] || []; techs.forEach(t => { currentFecDetailed[s][b][t] = {}; currentUeDetailed[s][b][t] = {}; const techActivity = getValue(currentDemandTechActivity, [s, b, t], 0); const unitConsMap = getValue(unitEnergyConsumption, [s, b, t], {}); Object.keys(unitConsMap).forEach(f => { if (endUseFuels.includes(f)) { const unitCons = unitConsMap[f]; const energyCons = techActivity * unitCons; currentFecDetailed[s][b][t][f] = energyCons; currentFecByFuel[f] += energyCons; const efficiency = getValue(placeholderUsefulEfficiency, [s, b, t, f], getValue(placeholderUsefulEfficiency, [s, b, t], getValue(placeholderUsefulEfficiency, [s, b], getValue(placeholderUsefulEfficiency, '_default', 0.65)))); const usefulEnergy = energyCons * efficiency; currentUeDetailed[s][b][t][f] = usefulEnergy; currentUeByFuel[f] += usefulEnergy; currentUeBySubsector[b] += usefulEnergy; } }); }); }); } }); yearlyResults[year].fecDetailed = currentFecDetailed; yearlyResults[year].ueDetailed = currentUeDetailed; yearlyResults[year].fecByFuel = currentFecByFuel; yearlyResults[year].ueByFuel = currentUeByFuel; yearlyResults[year].ueBySubsector = currentUeBySubsector;

        // 5. Calculate Hydrogen Transformation
        const currentHydrogenProdMix_yr = yearlyResults[year].hydrogenProdMix; const fecHydrogen = currentFecByFuel['Hydrogen'] || 0; let currentHydrogenInputEnergyByFuel = primaryFuels.concat(endUseFuels).reduce((acc, f) => ({ ...acc, [f]: 0 }), {}); hydrogenTechs.forEach(ht => { const mixPercent = getValue(currentHydrogenProdMix_yr, [ht], 0); const mixFraction = mixPercent / 100; const unitConsMap = getValue(hydrogenTechUnitEnergyCons, [ht], {}); Object.keys(unitConsMap).forEach(f_input => { const unitCons = unitConsMap[f_input]; const demand = fecHydrogen * mixFraction * unitCons; currentHydrogenInputEnergyByFuel[f_input] = (currentHydrogenInputEnergyByFuel[f_input] || 0) + demand; }); }); const currentEcPostHydrogen = { ...currentFecByFuel }; delete currentEcPostHydrogen['Hydrogen']; Object.keys(currentHydrogenInputEnergyByFuel).forEach(f => { if (currentHydrogenInputEnergyByFuel[f] > 0.001) { currentEcPostHydrogen[f] = (currentEcPostHydrogen[f] || 0) + currentHydrogenInputEnergyByFuel[f]; } }); yearlyResults[year].ecPostHydrogen = currentEcPostHydrogen;

        // 6. Calculate Power Transformation
        const currentPowerProdMix_yr = yearlyResults[year].powerProdMix; const ecElectricity = currentEcPostHydrogen['Electricity'] || 0; let currentPowerInputEnergyByFuel = primaryFuels.concat(endUseFuels).reduce((acc, f) => ({ ...acc, [f]: 0 }), {}); powerTechs.forEach(pt => { const mixPercent = getValue(currentPowerProdMix_yr, [pt], 0); const mixFraction = mixPercent / 100; const unitConsMap = getValue(powerTechUnitEnergyCons, [pt], {}); Object.keys(unitConsMap).forEach(f_input => { const unitCons = unitConsMap[f_input]; const demand = ecElectricity * mixFraction * unitCons; currentPowerInputEnergyByFuel[f_input] = (currentPowerInputEnergyByFuel[f_input] || 0) + demand; }); }); const currentEcPostPower = { ...currentEcPostHydrogen }; delete currentEcPostPower['Electricity']; Object.keys(currentPowerInputEnergyByFuel).forEach(f => { if (currentPowerInputEnergyByFuel[f] > 0.001) { currentEcPostPower[f] = (currentEcPostPower[f] || 0) + currentPowerInputEnergyByFuel[f]; } }); yearlyResults[year].ecPostPower = currentEcPostPower;

        // 7. Calculate Other Transformations
        const currentOtherFuelDemand = {}; let currentOtherInputEnergyByFuel = primaryFuels.reduce((acc, p) => ({ ...acc, [p]: 0 }), {}); Object.keys(otherConvTechs).forEach(f_endUse => { if (f_endUse in currentEcPostPower && currentEcPostPower[f_endUse] > 0.001) { const fuelDemandToConvert = currentEcPostPower[f_endUse]; currentOtherFuelDemand[f_endUse] = {}; const techsForFuel = otherConvTechs[f_endUse] || []; techsForFuel.forEach(ot => { currentOtherFuelDemand[f_endUse][ot] = {}; const mixPercent = getValue(baseOtherProdMix, [f_endUse, ot], 0); const mixFraction = mixPercent / 100; const unitConsMap = getValue(otherTechUnitEnergyCons, [f_endUse, ot], {}); Object.keys(unitConsMap).forEach(p_primary => { if (primaryFuels.includes(p_primary)) { const unitCons = unitConsMap[p_primary]; const primaryDemand = fuelDemandToConvert * mixFraction * unitCons; currentOtherFuelDemand[f_endUse][ot][p_primary] = primaryDemand; currentOtherInputEnergyByFuel[p_primary] = (currentOtherInputEnergyByFuel[p_primary] || 0) + primaryDemand; } }); }); } });

        // 8. Calculate PED
        const currentPedByFuel = primaryFuels.reduce((acc, p) => ({ ...acc, [p]: 0 }), {}); Object.keys(currentOtherInputEnergyByFuel).forEach(p => { if (p in currentPedByFuel) { currentPedByFuel[p] += currentOtherInputEnergyByFuel[p]; } }); Object.keys(currentEcPostPower).forEach(f => { if (primaryFuels.includes(f)) { let isInputToOther = (f in currentOtherFuelDemand); if (!isInputToOther && currentEcPostPower[f] > 0.001) { currentPedByFuel[f] = (currentPedByFuel[f] || 0) + currentEcPostPower[f]; } } }); yearlyResults[year].pedByFuel = currentPedByFuel;

    } // --- End of year loop ---

    console.log("Model calculation complete.");
    return yearlyResults;
}
