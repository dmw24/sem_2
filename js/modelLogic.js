// js/modelLogic.js
// Version: S-Curve uses Midpoint Year input

const GJ_PER_EJ = 1e9;

// Default behavior mappings (from reference)
const defaultDeclineDemandTechs = { 'Transport|Passenger cars': 'ICE', 'Transport|Trucks': 'ICE', 'Transport|Buses': 'ICE', 'Transport|2/3 wheelers': 'ICE', 'Transport|Ships': 'Conventional ship', 'Transport|Planes': 'Conventional plane', 'Transport|Trains': 'Diesel train', 'Industry|Steel': 'BF-BOF', 'Industry|Cement': 'Conventional kiln', 'Industry|Chemicals': 'Conventional', 'Industry|Low temp. heating': 'Fossil boiler', 'Industry|High temp. heating': 'Fossil furnace', 'Industry|Other industry - energy': 'Conventional', 'Buildings|Residential heating': 'Fossil boiler', 'Buildings|Residential cooking': 'Conventional fossil', 'Buildings|Residential lighting': 'Conventional', 'Buildings|Other residential': 'Conventional', 'Buildings|Building cooling': 'Low efficiency airco', 'Buildings|Commercial heating': 'Fossil boiler', 'Buildings|Commercial lighting': 'Conventional', 'Buildings|Other commercial': 'Conventional', 'Transport|Other transport': 'Conventional' };
const defaultSCurveDemandTechs = { 'Transport|Passenger cars': 'EV', 'Transport|Trucks': 'EV', 'Transport|Buses': 'EV', 'Transport|2/3 wheelers': 'EV', 'Transport|Ships': 'Ammonia ship', 'Transport|Planes': 'Electric plane', 'Transport|Trains': 'Electric train', 'Industry|Steel': 'DRI-EAF (H2)', 'Industry|Cement': 'Electric kiln', 'Industry|Chemicals': 'Electrified', 'Industry|Low temp. heating': 'Heat pump', 'Industry|High temp. heating': 'Electric furnace', 'Industry|Other industry - energy': 'Electrified', 'Buildings|Residential heating': 'Heat pump', 'Buildings|Residential cooking': 'Electrified', 'Buildings|Residential lighting': 'Full LED', 'Buildings|Other residential': 'Electrified', 'Buildings|Building cooling': 'High efficiency airco', 'Buildings|Commercial heating': 'Heat pump', 'Buildings|Commercial lighting': 'Full LED', 'Buildings|Other commercial': 'Electrified', 'Transport|Other transport': 'Electrified' };
const defaultDeclinePowerTechs = ['Gas power', 'Coal power', 'Oil power'];
const defaultSCurvePowerTechs = ['Solar PV', 'Wind'];
const defaultDeclineHydrogenTechs = ['Blue'];
const defaultSCurveHydrogenTechs = ['Green'];


// --- Helper Functions ---
function getValue(obj, keys, defaultValue = 0) { /* ... (unchanged) ... */
    let current = obj; for (const key of keys) { if (current && typeof current === 'object' && key in current) { current = current[key]; } else { return defaultValue; } } return (current === null || current === undefined) ? defaultValue : current; }

/**
 * Calculates the share based on an S-curve trajectory using Midpoint Year.
 * @param {number} year - Current year.
 * @param {number} startYearCurve - Year the curve calculation starts (usually baseYear).
 * @param {number} targetYear - Year the target share should be approached.
 * @param {number} midpointYearInput - The user-defined year for the curve's midpoint (t_0).
 * @param {number} startVal - Share at startYearCurve.
 * @param {number} endVal - Target share.
 * @param {number} baseYear - The model's base year.
 * @param {number} endYear - The model's end year (used for defaults).
 * @returns {number} Calculated share for the given year.
 */
function calculateSCurveShare(year, startYearCurve, targetYear, midpointYearInput, startVal, endVal, baseYear, endYear) { // Changed signature
    // Ensure inputs are numbers
    year = Number(year);
    startYearCurve = Number(startYearCurve || baseYear);
    targetYear = Number(targetYear || endYear);
    // Use midpoint year input, default halfway if invalid
    const t_0 = Number(midpointYearInput || startYearCurve + Math.round((targetYear - startYearCurve)/2));
    startVal = Number(startVal || 0);
    endVal = Number(endVal || 0);

    // Handle edge cases
    if (year >= targetYear) return endVal; // Already at or past target year
    if (year <= startYearCurve) return startVal; // Before curve starts
    if (targetYear <= startYearCurve) return endVal; // Target year must be after start
    if (Math.abs(startVal - endVal) < 0.01) return startVal; // No change needed

    // Calculate growth rate 'k' based on reaching 99% of transition by targetYear
    let k = 0.15; // Default k if calculation fails
    const P = 0.99; // Proportion of transition to complete by targetYear
    const k_numerator = -Math.log((1 / P) - 1); // Approx 4.595
    const k_denominator = targetYear - t_0;

    if (Math.abs(k_denominator) < 0.1) {
        // Avoid division by zero/very small number if midpoint is very close to target year
        // Use a large k to simulate a sharp step if midpoint IS target year
        // Sign depends on whether endVal > startVal
        k = (endVal > startVal) ? 10 : -10; // Large k for steep transition
        console.warn(`Midpoint year ${t_0} is very close to target year ${targetYear}. Using large k=${k}.`);
    } else {
        k = k_numerator / k_denominator;
    }

     // Ensure k has the correct sign (logistic function expects positive k for growth)
     // The formula structure handles this automatically based on denominator sign
     // However, if L_end < L_start, the range (L_end - L_start) is negative,
     // and the standard logistic formula still works correctly with the calculated k.

    // Calculate the exponent
    const exponent = -k * (year - t_0);

    // Handle potential overflow/underflow
    if (exponent > 700) return startVal;
    if (exponent < -700) return endVal;

    // Logistic function calculation
    const share = startVal + (endVal - startVal) / (1 + Math.exp(exponent));

    // Clamp result between startVal and endVal
    return Math.max(Math.min(startVal, endVal), Math.min(Math.max(startVal, endVal), share));
}

function normalizeShares(sharesObject, force100Tech = null) { /* ... (unchanged) ... */
    let total = Object.values(sharesObject).reduce((sum, val) => sum + Number(val || 0), 0); const normalized = {}; if (force100Tech && force100Tech in sharesObject && Math.abs(sharesObject[force100Tech] - 100) < 0.1) { for (const key in sharesObject) { normalized[key] = (key === force100Tech) ? 100 : 0; } return normalized; } if (total <= 0.001) { return sharesObject; } const scaleFactor = 100 / total; for (const key in sharesObject) { normalized[key] = (Number(sharesObject[key] || 0)) * scaleFactor; } if (force100Tech && normalized[force100Tech] && Math.abs(normalized[force100Tech] - 100) < 0.1) { for (const key in sharesObject) { normalized[key] = (key === force100Tech) ? 100 : 0; } } return normalized; }


// --- CORE MODEL CALCULATION FUNCTION ---
function runModelCalculation(structuredData, userInputParameters) {
    const {
        baseActivity = {}, baseDemandTechMix = {}, unitEnergyConsumption = {}, placeholderUsefulEfficiency = {'_default': 0.65},
        basePowerProdMix = {}, baseHydrogenProdMix = {}, powerTechUnitEnergyCons = {}, hydrogenTechUnitEnergyCons = {},
        otherTechUnitEnergyCons = {}, baseOtherProdMix = {},
        sectors = [], subsectors = {}, technologies = {}, endUseFuels = [], primaryFuels = [],
        hydrogenTechs = [], powerTechs = [], otherConvTechs = {},
        startYear, endYear, years
    } = structuredData || {};

     if (!years || !Array.isArray(years) || years.length === 0) { throw new Error("Model Calculation Error: 'years' array is missing or invalid."); }
     if (!startYear || !endYear) { throw new Error("Model Calculation Error: 'startYear' or 'endYear' is missing."); }

    const { activityGrowthFactors = {}, techBehaviorsAndParams = {} } = userInputParameters || {};
    const baseYear = startYear;
    console.log(`--- Running Full Model Projection (${startYear}-${endYear}) ---`);
    const yearlyResults = {};

    for (const year of years) {
        yearlyResults[year] = {};
        // 1. Activity Levels
        const currentActivity = {};
        if (year === baseYear) { Object.assign(currentActivity, baseActivity); }
        else { /* ... (activity calculation unchanged) ... */
            const prevResults = yearlyResults[year - 1]; if (!prevResults || !prevResults.activity) { throw new Error(`Cannot calculate activity for ${year}: Previous year (${year-1}) data missing.`); } const prevActivity = prevResults.activity; sectors.forEach(s => { if(subsectors[s]){ currentActivity[s] = {}; subsectors[s].forEach(b => { const growthInputKey = `${s}|${b}`; const growthFactor = activityGrowthFactors[growthInputKey] !== undefined ? activityGrowthFactors[growthInputKey] : 1.0; currentActivity[s][b] = getValue(prevActivity, [s, b], 0) * growthFactor; }); } });
        }
        yearlyResults[year].activity = currentActivity;

        // 2. Technology Mixes
        const calculateMixWithBehavior = (categoryType, categoryKey, techList, baseMixObject) => {
            const currentShares = {}; let sCurveTotalShare = 0; let fixedBaseTotal = 0; let declineBaseTotal = 0; const sCurveTechs = []; const fixedTechs = []; const declineTechs = []; const baseMix = baseMixObject || {}; let techTargeting100 = null;
            (techList || []).forEach(t => {
                const paramKey = `${categoryType}|${categoryKey}|${t}`;
                const behaviorInfo = techBehaviorsAndParams[paramKey] || { behavior: 'fixed' };
                const baseValue = getValue(baseMix, [t], 0);
                if (behaviorInfo.behavior === 's-curve') {
                    // *** UPDATED CALL to calculateSCurveShare ***
                    const share = calculateSCurveShare(
                        year,
                        baseYear, // startYearCurve
                        behaviorInfo.targetYear,
                        behaviorInfo.midpointYear, // Pass midpoint year instead of steepness
                        baseValue,
                        behaviorInfo.targetShare,
                        baseYear, // Pass baseYear for defaults inside S-curve func
                        endYear   // Pass endYear for defaults inside S-curve func
                    );
                    currentShares[t] = share; sCurveTotalShare += share; sCurveTechs.push(t);
                    if (Math.abs(behaviorInfo.targetShare - 100) < 0.01 && year >= behaviorInfo.targetYear) { techTargeting100 = t; }
                } else if (behaviorInfo.behavior === 'fixed') {
                    currentShares[t] = baseValue; fixedBaseTotal += baseValue; fixedTechs.push(t);
                } else { // decline
                    currentShares[t] = baseValue; declineBaseTotal += baseValue; declineTechs.push(t);
                 }
            });
            // Normalize logic remains the same...
            if (techTargeting100) { return normalizeShares(currentShares, techTargeting100); } const availableForFixedAndDecline = Math.max(0, 100 - sCurveTotalShare); const targetFixedTotal = Math.min(fixedBaseTotal, availableForFixedAndDecline); const fixedScaleFactor = (fixedBaseTotal > 0.01) ? targetFixedTotal / fixedBaseTotal : 0; let fixedAllocatedTotal = 0; fixedTechs.forEach(t => { const scaledShare = currentShares[t] * fixedScaleFactor; currentShares[t] = scaledShare; fixedAllocatedTotal += scaledShare; }); const availableForDecline = Math.max(0, availableForFixedAndDecline - fixedAllocatedTotal); const declineScaleFactor = (declineBaseTotal > 0.01) ? availableForDecline / declineBaseTotal : 0; declineTechs.forEach(t => { currentShares[t] *= declineScaleFactor; }); return normalizeShares(currentShares, null);
        };

        try {
            // *** DEBUG LOGS from previous step (can be removed if stable) ***
            if (year === baseYear) { console.log(`DEBUG (modelLogic - Base Year ${year}): Received baseDemandTechMix for Steel:`, JSON.stringify(getValue(baseDemandTechMix, ['Industry', 'Steel'], {}))); }

            const currentDemandTechMix = {}; sectors.forEach(s => { if(subsectors[s]){ currentDemandTechMix[s] = {}; subsectors[s].forEach(b => { const base = getValue(baseDemandTechMix, [s, b], {}); const techs = technologies[s]?.[b] || []; currentDemandTechMix[s][b] = calculateMixWithBehavior('Demand', `${s}|${b}`, techs, base); }); } }); yearlyResults[year].demandTechMix = currentDemandTechMix;
            yearlyResults[year].powerProdMix = calculateMixWithBehavior('Power', 'Power', powerTechs, basePowerProdMix);
            yearlyResults[year].hydrogenProdMix = calculateMixWithBehavior('Hydrogen', 'Hydrogen', hydrogenTechs, baseHydrogenProdMix);

            if (year === baseYear) { console.log(`DEBUG (modelLogic - Base Year ${year}): Calculated demandTechMix for Steel:`, JSON.stringify(yearlyResults[year].demandTechMix?.Industry?.Steel)); }

        } catch (mixError) { console.error(`Error calculating mix for year ${year}:`, mixError); throw mixError; }

        // 3. Demand Technology Activity (Unchanged)
        const currentDemandTechMix_yr = yearlyResults[year].demandTechMix; const currentActivity_yr = yearlyResults[year].activity; const currentDemandTechActivity = {}; sectors.forEach(s => { if(subsectors[s]){ currentDemandTechActivity[s] = {}; subsectors[s].forEach(b => { currentDemandTechActivity[s][b] = {}; const techs = technologies[s]?.[b] || []; techs.forEach(t => { const mixPercent = getValue(currentDemandTechMix_yr, [s, b, t], 0); const mixFraction = mixPercent / 100; const activityLevel = getValue(currentActivity_yr, [s, b], 0); currentDemandTechActivity[s][b][t] = mixFraction * activityLevel; }); }); } }); yearlyResults[year].demandTechActivity = currentDemandTechActivity;

        // 4. FEC and UE (Unchanged)
        const currentFecDetailed = {}; const currentUeDetailed = {}; const currentFecByFuel = endUseFuels.reduce((acc, f) => ({ ...acc, [f]: 0 }), {}); const currentUeByFuel = endUseFuels.reduce((acc, f) => ({ ...acc, [f]: 0 }), {}); const currentUeBySubsector = {}; sectors.forEach(s => { if(subsectors[s]){ currentFecDetailed[s] = {}; currentUeDetailed[s] = {}; subsectors[s].forEach(b => { currentFecDetailed[s][b] = {}; currentUeDetailed[s][b] = {}; currentUeBySubsector[b] = 0; const techs = technologies[s]?.[b] || []; techs.forEach(t => { currentFecDetailed[s][b][t] = {}; currentUeDetailed[s][b][t] = {}; const techActivity = getValue(currentDemandTechActivity, [s, b, t], 0); const unitConsMap = getValue(unitEnergyConsumption, [s, b, t], {}); Object.keys(unitConsMap).forEach(f => { if (endUseFuels.includes(f)) { const unitCons = unitConsMap[f]; const energyCons = techActivity * unitCons; currentFecDetailed[s][b][t][f] = energyCons; currentFecByFuel[f] += energyCons; const efficiency = getValue(placeholderUsefulEfficiency, [s, b, t, f], getValue(placeholderUsefulEfficiency, [s, b, t], getValue(placeholderUsefulEfficiency, [s, b], getValue(placeholderUsefulEfficiency, '_default', 0.65)))); const usefulEnergy = energyCons * efficiency; currentUeDetailed[s][b][t][f] = usefulEnergy; currentUeByFuel[f] += usefulEnergy; currentUeBySubsector[b] += usefulEnergy; } }); }); }); } }); yearlyResults[year].fecDetailed = currentFecDetailed; yearlyResults[year].ueDetailed = currentUeDetailed; yearlyResults[year].fecByFuel = currentFecByFuel; yearlyResults[year].ueByFuel = currentUeByFuel; yearlyResults[year].ueBySubsector = currentUeBySubsector;

        // 5. Hydrogen Transformation (Unchanged)
        const currentHydrogenProdMix_yr = yearlyResults[year].hydrogenProdMix; const fecHydrogen = currentFecByFuel['Hydrogen'] || 0; let currentHydrogenInputEnergyByFuel = primaryFuels.concat(endUseFuels).reduce((acc, f) => ({ ...acc, [f]: 0 }), {}); hydrogenTechs.forEach(ht => { const mixPercent = getValue(currentHydrogenProdMix_yr, [ht], 0); const mixFraction = mixPercent / 100; const unitConsMap = getValue(hydrogenTechUnitEnergyCons, [ht], {}); Object.keys(unitConsMap).forEach(f_input => { const unitCons = unitConsMap[f_input]; const demand = fecHydrogen * mixFraction * unitCons; currentHydrogenInputEnergyByFuel[f_input] = (currentHydrogenInputEnergyByFuel[f_input] || 0) + demand; }); }); const currentEcPostHydrogen = { ...currentFecByFuel }; delete currentEcPostHydrogen['Hydrogen']; Object.keys(currentHydrogenInputEnergyByFuel).forEach(f => { if (currentHydrogenInputEnergyByFuel[f] > 0.001) { currentEcPostHydrogen[f] = (currentEcPostHydrogen[f] || 0) + currentHydrogenInputEnergyByFuel[f]; } }); yearlyResults[year].ecPostHydrogen = currentEcPostHydrogen;

        // 6. Power Transformation (Unchanged)
        const currentPowerProdMix_yr = yearlyResults[year].powerProdMix; const ecElectricity = currentEcPostHydrogen['Electricity'] || 0; let currentPowerInputEnergyByFuel = primaryFuels.concat(endUseFuels).reduce((acc, f) => ({ ...acc, [f]: 0 }), {}); powerTechs.forEach(pt => { const mixPercent = getValue(currentPowerProdMix_yr, [pt], 0); const mixFraction = mixPercent / 100; const unitConsMap = getValue(powerTechUnitEnergyCons, [pt], {}); Object.keys(unitConsMap).forEach(f_input => { const unitCons = unitConsMap[f_input]; const demand = ecElectricity * mixFraction * unitCons; currentPowerInputEnergyByFuel[f_input] = (currentPowerInputEnergyByFuel[f_input] || 0) + demand; }); }); const currentEcPostPower = { ...currentEcPostHydrogen }; delete currentEcPostPower['Electricity']; Object.keys(currentPowerInputEnergyByFuel).forEach(f => { if (currentPowerInputEnergyByFuel[f] > 0.001) { currentEcPostPower[f] = (currentEcPostPower[f] || 0) + currentPowerInputEnergyByFuel[f]; } }); yearlyResults[year].ecPostPower = currentEcPostPower;

        // 7. Other Transformations (Unchanged)
        const currentOtherFuelDemand = {}; let currentOtherInputEnergyByFuel = primaryFuels.reduce((acc, p) => ({ ...acc, [p]: 0 }), {}); Object.keys(otherConvTechs).forEach(f_endUse => { if (f_endUse in currentEcPostPower && currentEcPostPower[f_endUse] > 0.001) { const fuelDemandToConvert = currentEcPostPower[f_endUse]; currentOtherFuelDemand[f_endUse] = {}; const techsForFuel = otherConvTechs[f_endUse] || []; techsForFuel.forEach(ot => { currentOtherFuelDemand[f_endUse][ot] = {}; const mixPercent = getValue(baseOtherProdMix, [f_endUse, ot], 0); const mixFraction = mixPercent / 100; const unitConsMap = getValue(otherTechUnitEnergyCons, [f_endUse, ot], {}); Object.keys(unitConsMap).forEach(p_primary => { if (primaryFuels.includes(p_primary)) { const unitCons = unitConsMap[p_primary]; const primaryDemand = fuelDemandToConvert * mixFraction * unitCons; currentOtherFuelDemand[f_endUse][ot][p_primary] = primaryDemand; currentOtherInputEnergyByFuel[p_primary] = (currentOtherInputEnergyByFuel[p_primary] || 0) + primaryDemand; } }); }); } });

        // 8. Calculate PED (Unchanged)
        const currentPedByFuel = primaryFuels.reduce((acc, p) => ({ ...acc, [p]: 0 }), {}); Object.keys(currentOtherInputEnergyByFuel).forEach(p => { if (p in currentPedByFuel) { currentPedByFuel[p] += currentOtherInputEnergyByFuel[p]; } }); Object.keys(currentEcPostPower).forEach(f => { if (primaryFuels.includes(f)) { let isInputToOther = (f in currentOtherFuelDemand); if (!isInputToOther && currentEcPostPower[f] > 0.001) { currentPedByFuel[f] = (currentPedByFuel[f] || 0) + currentEcPostPower[f]; } } }); yearlyResults[year].pedByFuel = currentPedByFuel;

    } // --- End of year loop ---

    console.log("Model calculation complete.");
    return yearlyResults;
}
