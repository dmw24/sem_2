// js/modelLogic.js
// Version: Complete - Implements PED Back-Allocation + User's 4-Step S-Curve

const GJ_PER_EJ = 1e9;

// Default behavior mappings (from reference) - Used if behavior is 'fixed' or 'decline'
const defaultDeclineDemandTechs = { 'Transport|Passenger cars': 'ICE', 'Transport|Trucks': 'ICE', 'Transport|Buses': 'ICE', 'Transport|2/3 wheelers': 'ICE', 'Transport|Ships': 'Conventional ship', 'Transport|Planes': 'Conventional plane', 'Transport|Trains': 'Diesel train', 'Industry|Steel': 'BF-BOF', 'Industry|Cement': 'Conventional kiln', 'Industry|Chemicals': 'Conventional', 'Industry|Low temp. heating': 'Fossil boiler', 'Industry|High temp. heating': 'Fossil furnace', 'Industry|Other industry - energy': 'Conventional', 'Buildings|Residential heating': 'Fossil boiler', 'Buildings|Residential cooking': 'Conventional fossil', 'Buildings|Residential lighting': 'Conventional', 'Buildings|Other residential': 'Conventional', 'Buildings|Building cooling': 'Low efficiency airco', 'Buildings|Commercial heating': 'Fossil boiler', 'Buildings|Commercial lighting': 'Conventional', 'Buildings|Other commercial': 'Conventional', 'Transport|Other transport': 'Conventional' };
const defaultSCurveDemandTechs = { 'Transport|Passenger cars': 'EV', 'Transport|Trucks': 'EV', 'Transport|Buses': 'EV', 'Transport|2/3 wheelers': 'EV', 'Transport|Ships': 'Ammonia ship', 'Transport|Planes': 'Electric plane', 'Transport|Trains': 'Electric train', 'Industry|Steel': 'DRI-EAF (H2)', 'Industry|Cement': 'Electric kiln', 'Industry|Chemicals': 'Electrified', 'Industry|Low temp. heating': 'Heat pump', 'Industry|High temp. heating': 'Electric furnace', 'Industry|Other industry - energy': 'Electrified', 'Buildings|Residential heating': 'Heat pump', 'Buildings|Residential cooking': 'Electrified', 'Buildings|Residential lighting': 'Full LED', 'Buildings|Other residential': 'Electrified', 'Buildings|Building cooling': 'High efficiency airco', 'Buildings|Commercial heating': 'Heat pump', 'Buildings|Commercial lighting': 'Full LED', 'Buildings|Other commercial': 'Electrified', 'Transport|Other transport': 'Electrified' };
const defaultDeclinePowerTechs = ['Gas power', 'Coal power', 'Oil power'];
const defaultSCurvePowerTechs = ['Solar PV', 'Wind'];
const defaultDeclineHydrogenTechs = ['Blue'];
const defaultSCurveHydrogenTechs = ['Green'];


// --- Helper Functions ---
/**
 * Safely gets a nested value from an object.
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
    return (current === null || current === undefined) ? defaultValue : current;
}

// Basic sigmoid function (Step 1 of user logic)
function sigma(t, k, t0) {
    // Handle k=0 case explicitly to avoid issues later
    if (Math.abs(k) < 1e-9) {
        return (t < t0) ? 0 : (t > t0) ? 1 : 0.5; // Step function at t0 if k is zero
    }
    const exponent = -k * (t - t0);
    // Prevent overflow
    if (exponent > 700) return 0;
    if (exponent < -700) return 1;
    return 1 / (1 + Math.exp(exponent));
}

/**
 * Calculates the S-curve share using the 4-step logic provided by the user,
 * forcing the curve through start and end points given k and t0,
 * and capping the result after the target year.
 *
 * @param {number} year - Current year (t)
 * @param {number} kUserInput - User-defined steepness (k)
 * @param {number} t0UserInput - User-defined midpoint year (t0)
 * @param {number} baseYear - Start year (t_start)
 * @param {number} startVal - Share at baseYear (InitialValue, 0-100 scale)
 * @param {number} targetYear - Target year (t_target)
 * @param {number} targetVal - Share at targetYear (TargetValue, 0-100 scale)
 * @returns {number} Calculated share for the given year (0-100 scale).
 */
function calculateForcedLogisticShare(year, kUserInput, t0UserInput, baseYear, startVal, targetYear, targetVal) {

    const t = year;
    const k_input = Number(kUserInput); // User k (magnitude)
    const t0 = Number(t0UserInput);
    const t_start = baseYear;
    const InitialValue = Number(startVal); // Share % (0-100)
    const t_target = targetYear;
    const TargetValue = Number(targetVal); // Share % (0-100)

    // --- Input Validation and Edge Cases ---
    if (isNaN(k_input) || isNaN(t0) || isNaN(InitialValue) || isNaN(TargetValue)) {
        console.warn("Invalid input to calculateForcedLogisticShare (NaN). Returning startVal.", {year, kUserInput, t0UserInput, baseYear, startVal, targetYear, targetVal});
        return startVal;
    }
     // If k is effectively zero, return start value (no change)
     if (Math.abs(k_input) < 1e-9) {
        return InitialValue;
     }
     // If start and target values are the same, return that value
     if (Math.abs(TargetValue - InitialValue) < 0.01) {
         return InitialValue;
     }
     // If start and target times are the same, invalid input
     if (Math.abs(t_target - t_start) < 0.1) {
          console.warn("Start year and target year are the same. Returning startVal.", {t_start, t_target});
          return InitialValue;
     }

    // Determine sign of k based on growth/decline
    const k_signed = (TargetValue > InitialValue) ? Math.abs(k_input) : -Math.abs(k_input);

    // --- Step 2: Compute σ at start and target points ---
    const sigma_s = sigma(t_start, k_signed, t0);
    const sigma_t = sigma(t_target, k_signed, t0);

    // --- Step 3: Solve for implied asymptotes L_start (A) and L_end (B) ---
    let L_start_asymptote, L_end_asymptote;
    const sigma_diff = sigma_t - sigma_s;

    if (Math.abs(sigma_diff) < 1e-9) {
        // This happens if k=0 (handled above) or if t_start/t_target are placed
        // symmetrically around t0 with the same k, or if t_start=t_target (handled above).
        // Indicates parameters might be inconsistent or curve is flat between points.
        console.warn("Sigma values at start and target are too close; cannot determine asymptotes reliably. Using linear interpolation.", {sigma_s, sigma_t, k_signed, t0, t_start, t_target});
        // Fallback: linear interpolation
        if (t <= t_start) return InitialValue;
        if (t >= t_target) return TargetValue;
        // Linear interpolation between start and target
        return InitialValue + (TargetValue - InitialValue) * (t - t_start) / (t_target - t_start);
    } else {
        // Calculate asymptotes using user's formulas
        L_start_asymptote = (InitialValue * sigma_t - TargetValue * sigma_s) / sigma_diff;
        L_end_asymptote = (TargetValue * (1 - sigma_s) - InitialValue * (1 - sigma_t)) / sigma_diff;
    }

    // --- Step 4: Define the full logistic curve value for the current year t ---
    const sigma_current = sigma(t, k_signed, t0);
    const logisticValue = L_start_asymptote + (L_end_asymptote - L_start_asymptote) * sigma_current;

    // --- Apply Capping Logic & Clamping ---
    if (year > targetYear) {
        // If past the target year, hold the target value
        return TargetValue;
    } else {
        // Otherwise, return the calculated logistic value
        // Clamp results between the initial and target values for robustness,
        // in case calculated asymptotes are non-physical due to input combination.
        const minVal = Math.min(InitialValue, TargetValue);
        const maxVal = Math.max(InitialValue, TargetValue);
        // Ensure we don't return NaN if logisticValue calculation failed somehow
        const clampedValue = Math.max(minVal, Math.min(maxVal, logisticValue));
        return isNaN(clampedValue) ? InitialValue : clampedValue; // Fallback to InitialValue if NaN
    }
}

/**
 * Normalizes shares within an object to sum to 100%.
 */
function normalizeShares(sharesObject, force100Tech = null) {
    let total = Object.values(sharesObject).reduce((sum, val) => sum + Number(val || 0), 0);
    const normalized = {};
    if (force100Tech && force100Tech in sharesObject && Math.abs(sharesObject[force100Tech] - 100) < 0.1) {
        for (const key in sharesObject) { normalized[key] = (key === force100Tech) ? 100 : 0; }
        return normalized;
    }
    if (total <= 0.001) { // Handle sum being zero or very close
        for (const key in sharesObject) { normalized[key] = 0; }
        return normalized;
    }
    const scaleFactor = 100 / total;
    for (const key in sharesObject) {
        normalized[key] = (Number(sharesObject[key] || 0)) * scaleFactor;
    }
    if (force100Tech && normalized[force100Tech] && Math.abs(normalized[force100Tech] - 100) < 0.1) {
         for (const key in sharesObject) { normalized[key] = (key === force100Tech) ? 100 : 0; }
    }
    // Final check for sum due to potential floating point issues
    let finalSum = Object.values(normalized).reduce((sum, val) => sum + val, 0);
    if (Math.abs(finalSum - 100) > 0.1 && finalSum > 0) { // Avoid adjusting if sum is zero
        let maxShare = -Infinity;
        let maxKey = null;
        for(const key in normalized){
            if(normalized[key] > maxShare){
                maxShare = normalized[key];
                maxKey = key;
            }
        }
        if(maxKey){
            normalized[maxKey] += (100 - finalSum);
        }
    }
    return normalized;
}

// Added safe divide helper
const safeDivide = (num, den) => (den == 0 ? 0 : num / den);


// --- CORE MODEL CALCULATION FUNCTION ---
/**
 * Runs the full energy model projection calculation.
 */
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

    // Get list of end-use sectors for allocation
    const endUseSectors = sectors.filter(s => s !== 'Power' && s !== 'Energy industry');

    for (const year of years) {
        yearlyResults[year] = {};

        // 1. Activity Levels
        const currentActivity = {};
        if (year === baseYear) {
            Object.assign(currentActivity, baseActivity);
        } else {
            const prevResults = yearlyResults[year - 1];
            if (!prevResults || !prevResults.activity) { throw new Error(`Cannot calculate activity for ${year}: Previous year (${year-1}) data missing.`); }
            const prevActivity = prevResults.activity;
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

        // 2. Technology Mixes
        const calculateMixWithBehavior = (categoryType, categoryKey, techList, baseMixObject) => {
            const currentShares = {};
            let sCurveTotalShare = 0; let fixedBaseTotal = 0; let declineBaseTotal = 0;
            const sCurveTechs = []; const fixedTechs = []; const declineTechs = [];
            const baseMix = baseMixObject || {}; let techTargeting100 = null;

            (techList || []).forEach(t => {
                const paramKey = `${categoryType}|${categoryKey}|${t}`;
                const behaviorInfo = techBehaviorsAndParams[paramKey] || { behavior: 'fixed' };
                const baseValue = getValue(baseMix, [t], 0);

                if (behaviorInfo.behavior === 's-curve') {
                    const share = calculateForcedLogisticShare( year, behaviorInfo.kValue, behaviorInfo.midpointYear, baseYear, baseValue, behaviorInfo.targetYear, behaviorInfo.targetShare );
                    currentShares[t] = share; sCurveTotalShare += share; sCurveTechs.push(t);
                    if (Math.abs(behaviorInfo.targetShare - 100) < 0.01 && year >= behaviorInfo.targetYear) { techTargeting100 = t; }
                } else if (behaviorInfo.behavior === 'fixed') {
                    currentShares[t] = baseValue; fixedBaseTotal += baseValue; fixedTechs.push(t);
                } else { // decline
                    currentShares[t] = baseValue; declineBaseTotal += baseValue; declineTechs.push(t);
                 }
            });
            // Normalization
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
            // Calculate mixes using the updated behavior logic
            const currentDemandTechMix = {}; sectors.forEach(s => { if(subsectors[s]){ currentDemandTechMix[s] = {}; subsectors[s].forEach(b => { const base = getValue(baseDemandTechMix, [s, b], {}); const techs = technologies[s]?.[b] || []; currentDemandTechMix[s][b] = calculateMixWithBehavior('Demand', `${s}|${b}`, techs, base); }); } }); yearlyResults[year].demandTechMix = currentDemandTechMix;
            yearlyResults[year].powerProdMix = calculateMixWithBehavior('Power', 'Power', powerTechs, basePowerProdMix);
            yearlyResults[year].hydrogenProdMix = calculateMixWithBehavior('Hydrogen', 'Hydrogen', hydrogenTechs, baseHydrogenProdMix);
        } catch (mixError) { console.error(`Error calculating mix for year ${year}:`, mixError); throw mixError; }

        // 3. Demand Technology Activity
        const currentDemandTechMix_yr = yearlyResults[year].demandTechMix; const currentActivity_yr = yearlyResults[year].activity; const currentDemandTechActivity = {}; sectors.forEach(s => { if(subsectors[s]){ currentDemandTechActivity[s] = {}; subsectors[s].forEach(b => { currentDemandTechActivity[s][b] = {}; const techs = technologies[s]?.[b] || []; techs.forEach(t => { const mixPercent = getValue(currentDemandTechMix_yr, [s, b, t], 0); const mixFraction = mixPercent / 100; const activityLevel = getValue(currentActivity_yr, [s, b], 0); currentDemandTechActivity[s][b][t] = mixFraction * activityLevel; }); }); } }); yearlyResults[year].demandTechActivity = currentDemandTechActivity;

        // 4. FEC and UE
        const currentFecDetailed = {}; const currentUeDetailed = {};
        const currentFecByFuel = endUseFuels.reduce((acc, f) => ({ ...acc, [f]: 0 }), {});
        const currentUeByFuel = endUseFuels.reduce((acc, f) => ({ ...acc, [f]: 0 }), {});
        const currentUeBySubsector = {};
        const fecByEndUse = {}; // Store FEC by end-use sector/subsector/fuel

        sectors.forEach(s => {
            if(subsectors[s]){
                currentFecDetailed[s] = {}; currentUeDetailed[s] = {};
                if (endUseSectors.includes(s)) fecByEndUse[s] = {};

                subsectors[s].forEach(b => {
                    currentFecDetailed[s][b] = {}; currentUeDetailed[s][b] = {};
                    if (endUseSectors.includes(s)) fecByEndUse[s][b] = endUseFuels.reduce((acc, f) => ({ ...acc, [f]: 0 }), {});

                    currentUeBySubsector[b] = 0;
                    const techs = technologies[s]?.[b] || [];
                    techs.forEach(t => {
                        currentFecDetailed[s][b][t] = {}; currentUeDetailed[s][b][t] = {};
                        const techActivity = getValue(currentDemandTechActivity, [s, b, t], 0);
                        const unitConsMap = getValue(unitEnergyConsumption, [s, b, t], {});
                        Object.keys(unitConsMap).forEach(f => {
                            if (endUseFuels.includes(f)) {
                                const unitCons = unitConsMap[f]; const energyCons = techActivity * unitCons;
                                currentFecDetailed[s][b][t][f] = energyCons; currentFecByFuel[f] += energyCons;
                                if (endUseSectors.includes(s)) { fecByEndUse[s][b][f] += energyCons; }
                                const efficiency = getValue(placeholderUsefulEfficiency, [s, b, t, f], getValue(placeholderUsefulEfficiency, [s, b, t], getValue(placeholderUsefulEfficiency, [s, b], getValue(placeholderUsefulEfficiency, '_default', 0.65))));
                                const usefulEnergy = energyCons * efficiency; currentUeDetailed[s][b][t][f] = usefulEnergy; currentUeByFuel[f] += usefulEnergy; currentUeBySubsector[b] += usefulEnergy;
                            }
                        });
                    });
                });
            }
        });
        yearlyResults[year].fecDetailed = currentFecDetailed; yearlyResults[year].ueDetailed = currentUeDetailed;
        yearlyResults[year].fecByFuel = currentFecByFuel; yearlyResults[year].ueByFuel = currentUeByFuel;
        yearlyResults[year].ueBySubsector = currentUeBySubsector;
        yearlyResults[year].fecByEndUse = fecByEndUse;

        // 5. Calculate Hydrogen Transformation
        const currentHydrogenProdMix_yr = yearlyResults[year].hydrogenProdMix;
        const totalHydrogenDemand = currentFecByFuel['Hydrogen'] || 0;
        let hydrogenPrimaryInputsByFuel = primaryFuels.concat(endUseFuels).reduce((acc, f) => ({ ...acc, [f]: 0 }), {});
        hydrogenTechs.forEach(ht => { const mixPercent = getValue(currentHydrogenProdMix_yr, [ht], 0); const mixFraction = mixPercent / 100; const unitConsMap = getValue(hydrogenTechUnitEnergyCons, [ht], {}); Object.keys(unitConsMap).forEach(f_input => { const unitCons = unitConsMap[f_input]; const demand = totalHydrogenDemand * mixFraction * unitCons; hydrogenPrimaryInputsByFuel[f_input] = (hydrogenPrimaryInputsByFuel[f_input] || 0) + demand; }); });
        yearlyResults[year].hydrogenPrimaryInputsByFuel = hydrogenPrimaryInputsByFuel;
        const currentEcPostHydrogen = { ...currentFecByFuel }; delete currentEcPostHydrogen['Hydrogen']; Object.keys(hydrogenPrimaryInputsByFuel).forEach(f => { if (hydrogenPrimaryInputsByFuel[f] > 0.001) { currentEcPostHydrogen[f] = (currentEcPostHydrogen[f] || 0) + hydrogenPrimaryInputsByFuel[f]; } }); yearlyResults[year].ecPostHydrogen = currentEcPostHydrogen;

        // 6. Calculate Power Transformation
        const currentPowerProdMix_yr = yearlyResults[year].powerProdMix;
        const totalElectricityDemand = currentEcPostHydrogen['Electricity'] || 0;
        let powerPrimaryInputsByFuel = primaryFuels.concat(endUseFuels).reduce((acc, f) => ({ ...acc, [f]: 0 }), {});
        powerTechs.forEach(pt => { const mixPercent = getValue(currentPowerProdMix_yr, [pt], 0); const mixFraction = mixPercent / 100; const unitConsMap = getValue(powerTechUnitEnergyCons, [pt], {}); Object.keys(unitConsMap).forEach(f_input => { const unitCons = unitConsMap[f_input]; const demand = totalElectricityDemand * mixFraction * unitCons; powerPrimaryInputsByFuel[f_input] = (powerPrimaryInputsByFuel[f_input] || 0) + demand; }); });
        yearlyResults[year].powerPrimaryInputsByFuel = powerPrimaryInputsByFuel;
        const currentEcPostPower = { ...currentEcPostHydrogen }; delete currentEcPostPower['Electricity']; Object.keys(powerPrimaryInputsByFuel).forEach(f => { if (powerPrimaryInputsByFuel[f] > 0.001) { currentEcPostPower[f] = (currentEcPostPower[f] || 0) + powerPrimaryInputsByFuel[f]; } }); yearlyResults[year].ecPostPower = currentEcPostPower;

        // 7. Calculate Other Transformations
        const currentOtherFuelDemand = {}; // Tracks primary inputs per refined fuel tech { refined: { tech: { primary: val } } }
        let otherPrimaryInputsByFuel = primaryFuels.reduce((acc, p) => ({ ...acc, [p]: 0 }), {}); // Total primary inputs for 'Other'
        const otherTransformOutputs = {}; // Store total output GJ for each refined fuel
        const otherPrimaryInputsByRefinedFuel = {}; // Store total primary input GJ per refined fuel { refinedFuel: {primaryFuel: value} }

        Object.keys(otherConvTechs).forEach(f_endUse => {
            otherPrimaryInputsByRefinedFuel[f_endUse] = primaryFuels.reduce((acc, p) => ({ ...acc, [p]: 0 }), {}); // Init
            if (f_endUse in currentEcPostPower && currentEcPostPower[f_endUse] > 0.001) {
                const fuelDemandToConvert = currentEcPostPower[f_endUse]; // This is the OUTPUT needed
                otherTransformOutputs[f_endUse] = (otherTransformOutputs[f_endUse] || 0) + fuelDemandToConvert;
                currentOtherFuelDemand[f_endUse] = {};
                const techsForFuel = otherConvTechs[f_endUse] || [];
                techsForFuel.forEach(ot => {
                    currentOtherFuelDemand[f_endUse][ot] = {}; const mixPercent = getValue(baseOtherProdMix, [f_endUse, ot], 0); const mixFraction = mixPercent / 100;
                    const unitConsMap = getValue(otherTechUnitEnergyCons, [f_endUse, ot], {});
                    Object.keys(unitConsMap).forEach(p_input => { // Can be primary or intermediate
                         const unitCons = unitConsMap[p_input]; const inputDemand = fuelDemandToConvert * mixFraction * unitCons;
                         currentOtherFuelDemand[f_endUse][ot][p_input] = inputDemand; // Store input demand (might be intermediate)
                         if (primaryFuels.includes(p_input)) { // Track only primary inputs for PED here
                             otherPrimaryInputsByFuel[p_input] = (otherPrimaryInputsByFuel[p_input] || 0) + inputDemand;
                             otherPrimaryInputsByRefinedFuel[f_endUse][p_input] = (otherPrimaryInputsByRefinedFuel[f_endUse][p_input] || 0) + inputDemand;
                         }
                    });
                });
            }
        });
        yearlyResults[year].otherPrimaryInputsByRefinedFuel = otherPrimaryInputsByRefinedFuel; // Store primary inputs per refined fuel

        // 8. Calculate PED (Total System PED)
        const currentPedByFuel = primaryFuels.reduce((acc, p) => ({ ...acc, [p]: 0 }), {});
        // Add primary inputs from Power, H2, Other
        primaryFuels.forEach(p => {
            currentPedByFuel[p] += getValue(powerPrimaryInputsByFuel, [p], 0);
            currentPedByFuel[p] += getValue(hydrogenPrimaryInputsByFuel, [p], 0);
            currentPedByFuel[p] += getValue(otherPrimaryInputsByFuel, [p], 0);
        });
        // Add direct use of primary fuels that were NOT inputs to 'Other Transformations'
        Object.keys(currentEcPostPower).forEach(f => {
            if (primaryFuels.includes(f)) {
                let isInputToOther = false; // Check if f was an input to any 'other' process this year
                Object.keys(currentOtherFuelDemand).forEach(f_out => {
                    Object.keys(currentOtherFuelDemand[f_out]).forEach(ot => {
                        if (f in currentOtherFuelDemand[f_out][ot]) { isInputToOther = true; }
                    });
                });
                if (!isInputToOther && currentEcPostPower[f] > 0.001) {
                    currentPedByFuel[f] = (currentPedByFuel[f] || 0) + currentEcPostPower[f];
                }
            }
        });
        yearlyResults[year].pedByFuel = currentPedByFuel; // Store total system PED


        // *** 9. Calculate Allocated PED for each End-Use Sector/Subsector ***
        yearlyResults[year].allocatedPed = {}; // { sector: { subsector: { primaryFuel: value } } }

        endUseSectors.forEach(s => {
            yearlyResults[year].allocatedPed[s] = {};
            (subsectors[s] || []).forEach(b => {
                const allocatedPedForSubsector = primaryFuels.reduce((acc, p) => ({ ...acc, [p]: 0 }), {});
                const filteredFec = fecByEndUse[s]?.[b] || {}; // Get FEC for this specific s/b

                // --- Allocate Power PED ---
                const elecDemandFiltered = filteredFec['Electricity'] || 0;
                const allocFactorElec = safeDivide(elecDemandFiltered, totalElectricityDemand);
                primaryFuels.forEach(p => {
                    allocatedPedForSubsector[p] += getValue(powerPrimaryInputsByFuel, [p], 0) * allocFactorElec;
                });

                // --- Allocate Hydrogen PED ---
                const h2DemandFiltered = filteredFec['Hydrogen'] || 0;
                const allocFactorH2 = safeDivide(h2DemandFiltered, totalHydrogenDemand);
                // Allocate direct primary inputs for H2
                primaryFuels.forEach(p => {
                     allocatedPedForSubsector[p] += getValue(hydrogenPrimaryInputsByFuel, [p], 0) * allocFactorH2;
                });
                // Allocate indirect electricity input for H2
                const elecForH2 = getValue(hydrogenPrimaryInputsByFuel, ['Electricity'], 0);
                const elecForH2Filtered = elecForH2 * allocFactorH2;
                const allocFactorElecForH2 = safeDivide(elecForH2Filtered, totalElectricityDemand); // Allocation factor for this specific slice of electricity
                 primaryFuels.forEach(p => {
                     allocatedPedForSubsector[p] += getValue(powerPrimaryInputsByFuel, [p], 0) * allocFactorElecForH2;
                 });
                 // TODO: Add allocation for other intermediate inputs to H2 if any (e.g., Gas -> H2 -> Transport)

                // --- Allocate Other Transformation PED ---
                Object.keys(otherConvTechs).forEach(f_refined => {
                    const refinedDemandFiltered = filteredFec[f_refined] || 0;
                    const totalRefinedOutput = otherTransformOutputs[f_refined] || 0;
                    const allocFactorOther = safeDivide(refinedDemandFiltered, totalRefinedOutput);

                    if (allocFactorOther > 0) {
                        // Allocate direct primary inputs for this refined fuel
                        primaryFuels.forEach(p => {
                            allocatedPedForSubsector[p] += getValue(otherPrimaryInputsByRefinedFuel, [f_refined, p], 0) * allocFactorOther;
                        });
                        // TODO: Allocate intermediate inputs (like electricity/gas used in refining) back using their respective allocation factors
                        // Example for electricity used in oil refining:
                        // elecForOilRefining = getValue(currentOtherFuelDemand, [f_refined, 'Oil refining', 'Electricity'], 0); // Need total elec used for this tech
                        // elecForOilRefiningFiltered = elecForOilRefining * allocFactorOther;
                        // allocFactorElecForOilRefining = safeDivide(elecForOilRefiningFiltered, totalElectricityDemand);
                        // primaryFuels.forEach(p => { allocatedPedForSubsector[p] += getValue(powerPrimaryInputsByFuel, [p], 0) * allocFactorElecForOilRefining; });
                    }
                });

                // --- Allocate Direct Primary Use ---
                primaryFuels.forEach(p => {
                    allocatedPedForSubsector[p] += filteredFec[p] || 0; // Add direct use of primary fuels
                });

                yearlyResults[year].allocatedPed[s][b] = allocatedPedForSubsector; // Store result
            });
        });

    } // --- End of year loop ---

    console.log("Model calculation complete.");
    return yearlyResults;
}
