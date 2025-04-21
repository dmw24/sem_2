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
    return (current === null || current === undefined) ? defaultValue : current;
}

/**
 * Basic sigmoid function (Step 1 of user logic).
 * Represents the proportion (0 to 1) of the transition completed.
 * @param {number} t - Current time/year.
 * @param {number} k - Growth rate (steepness). Sign indicates direction.
 * @param {number} t0 - Midpoint time/year.
 * @returns {number} Proportion of transition (0 to 1).
 */
function sigma(t, k, t0) {
    // Handle k=0 case explicitly to avoid issues later
    if (Math.abs(k) < 1e-9) {
        return (t < t0) ? 0 : (t > t0) ? 1 : 0.5; // Step function at t0 if k is zero
    }
    const exponent = -k * (t - t0);
    // Prevent numerical overflow/underflow with Math.exp
    if (exponent > 700) return 0; // exp(>700) is effectively Infinity
    if (exponent < -700) return 1; // exp(<-700) is effectively 0
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

    // Determine sign of k based on growth/decline for internal calculations
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
 * Handles edge cases like zero sum and floating point inaccuracies.
 * @param {object} sharesObject - Object where keys are categories and values are shares.
 * @param {string|null} force100Tech - If specified, forces this tech to 100% and others to 0.
 * @returns {object} Object with normalized shares summing to 100.
 */
function normalizeShares(sharesObject, force100Tech = null) {
    let total = Object.values(sharesObject).reduce((sum, val) => sum + Number(val || 0), 0);
    const normalized = {};

    // Handle case where one technology should dominate entirely
    if (force100Tech && force100Tech in sharesObject && Math.abs(sharesObject[force100Tech] - 100) < 0.1) {
        for (const key in sharesObject) {
            normalized[key] = (key === force100Tech) ? 100 : 0;
        }
        return normalized;
    }

    // Avoid division by zero or normalizing an empty/zero object
    if (total <= 0.001) {
        // If sum is zero, return object with zeros
        for (const key in sharesObject) { normalized[key] = 0; }
        return normalized; // Return object with zeros
    }

    // Calculate normalized shares
    const scaleFactor = 100 / total;
    for (const key in sharesObject) {
        normalized[key] = (Number(sharesObject[key] || 0)) * scaleFactor;
    }

    // Re-check force100Tech case after normalization (can happen if S-curve reaches target)
    if (force100Tech && normalized[force100Tech] && Math.abs(normalized[force100Tech] - 100) < 0.1) {
         for (const key in sharesObject) {
             normalized[key] = (key === force100Tech) ? 100 : 0;
         }
         return normalized; // Return immediately after forcing
    }

    // Final check for sum due to potential floating point issues after scaling
    let finalSum = Object.values(normalized).reduce((sum, val) => sum + val, 0);
    if (Math.abs(finalSum - 100) > 0.1 && finalSum > 0) { // Avoid adjusting if sum is zero
        // Adjust the largest share slightly to make sum exactly 100
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
        // console.warn("Normalization adjustment applied", normalized); // Optional warning
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
    // Destructure data from structuredData, provide defaults for safety
    const {
        baseActivity = {}, baseDemandTechMix = {}, unitEnergyConsumption = {}, placeholderUsefulEfficiency = {'_default': 0.65},
        basePowerProdMix = {}, baseHydrogenProdMix = {}, powerTechUnitEnergyCons = {}, hydrogenTechUnitEnergyCons = {},
        otherTechUnitEnergyCons = {}, baseOtherProdMix = {},
        sectors = [], subsectors = {}, technologies = {}, endUseFuels = [], primaryFuels = [],
        hydrogenTechs = [], powerTechs = [], otherConvTechs = {}, dataTypeLookup = {},
        startYear, endYear, years
    } = structuredData || {};

     // Validate essential time data
     if (!years || !Array.isArray(years) || years.length === 0) { throw new Error("Model Calculation Error: 'years' array is missing or invalid."); }
     if (!startYear || !endYear) { throw new Error("Model Calculation Error: 'startYear' or 'endYear' is missing."); }

    // Destructure user inputs, provide defaults
    const { activityGrowthFactors = {}, techBehaviorsAndParams = {} } = userInputParameters || {};
    const baseYear = startYear; // Use startYear from data as baseYear
    console.log(`--- Running Full Model Projection (${startYear}-${endYear}) ---`);
    const yearlyResults = {}; // Object to hold results for each year

    // Get list of end-use sectors for allocation later
    const endUseSectors = sectors.filter(s => s !== 'Power' && s !== 'Energy industry');

    // --- Yearly Calculation Loop ---
    for (const year of years) {
        yearlyResults[year] = {}; // Initialize results object for the current year

        // --- Step 1: Calculate Activity Levels ---
        const currentActivity = {};
        if (year === baseYear) {
            // For the base year, use the loaded base activity levels directly
            Object.assign(currentActivity, baseActivity);
        } else {
            // For subsequent years, calculate based on previous year's activity and growth factors
            const prevResults = yearlyResults[year - 1];
            // Check if previous year's data exists
            if (!prevResults || !prevResults.activity) {
                 console.error(`Cannot calculate activity for ${year}: Previous year (${year-1}) data missing.`);
                 // Optionally, handle this more gracefully, e.g., assume no growth
                 throw new Error(`Cannot calculate activity for ${year}: Previous year (${year-1}) data missing.`);
            }
            const prevActivity = prevResults.activity;
            // Iterate through sectors and subsectors to apply growth factors
            sectors.forEach(s => {
                if(subsectors[s]){ // Check if subsectors exist for the sector
                    currentActivity[s] = {};
                    subsectors[s].forEach(b => {
                        const growthInputKey = `${s}|${b}`;
                        // Get growth factor from user inputs, default to 1.0 (0% growth) if not provided
                        const growthFactor = activityGrowthFactors[growthInputKey] !== undefined
                                              ? activityGrowthFactors[growthInputKey]
                                              : 1.0;
                        // Calculate current activity: previous year * growth factor
                        currentActivity[s][b] = getValue(prevActivity, [s, b], 0) * growthFactor;
                    });
                }
            });
        }
        yearlyResults[year].activity = currentActivity; // Store calculated activity levels

        // --- Step 2: Calculate Technology Mixes ---
        // Helper function to calculate mix based on behavior (Fixed, S-Curve, Decline)
        const calculateMixWithBehavior = (categoryType, categoryKey, techList, baseMixObject) => {
            const currentShares = {}; // Holds calculated shares before normalization
            let sCurveTotalShare = 0; // Sum of shares determined by S-curves
            let fixedBaseTotal = 0; // Sum of base shares for fixed technologies
            let declineBaseTotal = 0; // Sum of base shares for declining technologies
            const sCurveTechs = []; // List of S-curve techs
            const fixedTechs = []; // List of fixed techs
            const declineTechs = []; // List of declining techs
            const baseMix = baseMixObject || {}; // Ensure baseMix is an object
            let techTargeting100 = null; // Track if any tech targets 100% for normalization override

            // Iterate through each technology in the list for this category
            (techList || []).forEach(t => {
                const paramKey = `${categoryType}|${categoryKey}|${t}`;
                // Get behavior info from user inputs, default to 'fixed'
                const behaviorInfo = techBehaviorsAndParams[paramKey] || { behavior: 'fixed' };
                // Get the base year share for this technology
                const baseValue = getValue(baseMix, [t], 0); // Base share % (0-100)

                if (behaviorInfo.behavior === 's-curve') {
                    // Calculate share using the forced S-curve logic
                    const share = calculateForcedLogisticShare(
                        year,
                        behaviorInfo.kValue,      // User k
                        behaviorInfo.midpointYear, // User t0
                        baseYear,                 // t_start
                        baseValue,                // InitialValue (as %)
                        behaviorInfo.targetYear,  // t_target
                        behaviorInfo.targetShare  // TargetValue (as %)
                    );
                    currentShares[t] = share;
                    sCurveTotalShare += share; // Sum S-curve shares for normalization later
                    sCurveTechs.push(t);
                    // Check if this tech targets 100% and we are at/past the target year
                    if (Math.abs(behaviorInfo.targetShare - 100) < 0.01 && year >= behaviorInfo.targetYear) {
                         techTargeting100 = t;
                    }
                } else if (behaviorInfo.behavior === 'fixed') {
                    // For fixed behavior, use the base value
                    currentShares[t] = baseValue;
                    fixedBaseTotal += baseValue;
                    fixedTechs.push(t);
                } else { // decline behavior
                    // For decline, start with base value; normalization will scale it down
                    currentShares[t] = baseValue;
                    declineBaseTotal += baseValue;
                    declineTechs.push(t);
                 }
            });

            // Normalization Step: Ensure shares sum to 100%
            // Handle the special case where one tech forces 100% share
            if (techTargeting100) {
                return normalizeShares(currentShares, techTargeting100);
            }
            // Calculate share available for fixed and declining techs
            const availableForFixedAndDecline = Math.max(0, 100 - sCurveTotalShare);
            // Scale fixed shares proportionally to fit available space
            const targetFixedTotal = Math.min(fixedBaseTotal, availableForFixedAndDecline);
            const fixedScaleFactor = safeDivide(targetFixedTotal, fixedBaseTotal);
            let fixedAllocatedTotal = 0;
            fixedTechs.forEach(t => { const scaledShare = currentShares[t] * fixedScaleFactor; currentShares[t] = scaledShare; fixedAllocatedTotal += scaledShare; });
            // Scale declining shares proportionally into remaining space
            const availableForDecline = Math.max(0, availableForFixedAndDecline - fixedAllocatedTotal);
            const declineScaleFactor = safeDivide(availableForDecline, declineBaseTotal);
            declineTechs.forEach(t => { currentShares[t] *= declineScaleFactor; });
            // Final normalization to correct any minor rounding errors
            return normalizeShares(currentShares, null);
        };

        try {
            // Calculate mixes for Demand, Power, and Hydrogen
            const currentDemandTechMix = {};
            sectors.forEach(s => {
                if(subsectors[s]){ // Check if subsectors exist
                    currentDemandTechMix[s] = {};
                    subsectors[s].forEach(b => {
                        const base = getValue(baseDemandTechMix, [s, b], {});
                        const techs = technologies[s]?.[b] || [];
                        currentDemandTechMix[s][b] = calculateMixWithBehavior('Demand', `${s}|${b}`, techs, base);
                    });
                }
            });
            yearlyResults[year].demandTechMix = currentDemandTechMix;

            yearlyResults[year].powerProdMix = calculateMixWithBehavior('Power', 'Power', powerTechs, basePowerProdMix);
            yearlyResults[year].hydrogenProdMix = calculateMixWithBehavior('Hydrogen', 'Hydrogen', hydrogenTechs, baseHydrogenProdMix);

        } catch (mixError) {
            console.error(`Error calculating mix for year ${year}:`, mixError);
            throw mixError; // Stop calculation if mix fails
        }

        // --- Step 3: Calculate Demand Technology Activity ---
        const currentDemandTechMix_yr = yearlyResults[year].demandTechMix;
        const currentActivity_yr = yearlyResults[year].activity;
        const currentDemandTechActivity = {}; // { sector: { subsector: { tech: activityValue } } }
        sectors.forEach(s => {
            if(subsectors[s]){
                currentDemandTechActivity[s] = {};
                subsectors[s].forEach(b => {
                    currentDemandTechActivity[s][b] = {};
                    const techs = technologies[s]?.[b] || [];
                    techs.forEach(t => {
                        const mixPercent = getValue(currentDemandTechMix_yr, [s, b, t], 0);
                        const mixFraction = mixPercent / 100; // Convert % to fraction
                        const activityLevel = getValue(currentActivity_yr, [s, b], 0);
                        currentDemandTechActivity[s][b][t] = mixFraction * activityLevel;
                    });
                });
            }
        });
        yearlyResults[year].demandTechActivity = currentDemandTechActivity;

        // --- Step 4: Calculate Final Energy Consumption (FEC) and Useful Energy (UE) ---
        const currentFecDetailed = {}; // { sector: { subsector: { tech: { fuel: value } } } }
        const currentUeDetailed = {}; // { sector: { subsector: { tech: { fuel: value } } } }
        const currentFecByFuel = endUseFuels.reduce((acc, f) => ({ ...acc, [f]: 0 }), {}); // { fuel: totalValue }
        const currentUeByFuel = endUseFuels.reduce((acc, f) => ({ ...acc, [f]: 0 }), {}); // { fuel: totalValue }
        const currentUeBySubsector = {}; // { subsector: totalValue }
        const fecByEndUse = {}; // { sector: { subsector: { fuel: value } } } - For end-use sectors only
        const ueByEndUseSector = {}; // { sector: totalValue } - For end-use sectors only
        const ueByType = {}; // { type: totalValue } - Aggregated across all end-uses
        const uniqueTypes = new Set(); // Keep track of encountered UE types

        sectors.forEach(s => {
            if(subsectors[s]){
                currentFecDetailed[s] = {}; currentUeDetailed[s] = {};
                if (endUseSectors.includes(s)) { fecByEndUse[s] = {}; ueByEndUseSector[s] = 0; }

                subsectors[s].forEach(b => {
                    currentFecDetailed[s][b] = {}; currentUeDetailed[s][b] = {};
                    if (endUseSectors.includes(s)) fecByEndUse[s][b] = endUseFuels.reduce((acc, f) => ({ ...acc, [f]: 0 }), {});

                    currentUeBySubsector[b] = 0; // Initialize UE for this subsector
                    const techs = technologies[s]?.[b] || [];
                    techs.forEach(t => {
                        currentFecDetailed[s][b][t] = {}; currentUeDetailed[s][b][t] = {};
                        const techActivity = getValue(currentDemandTechActivity, [s, b, t], 0);
                        const unitConsMap = getValue(unitEnergyConsumption, [s, b, t], {});
                        Object.keys(unitConsMap).forEach(f => {
                            if (endUseFuels.includes(f)) { // Process only end-use fuels
                                const unitCons = unitConsMap[f];
                                const energyCons = techActivity * unitCons; // FEC for this s/b/t/f
                                currentFecDetailed[s][b][t][f] = energyCons;
                                currentFecByFuel[f] += energyCons; // Aggregate total FEC by fuel
                                if (endUseSectors.includes(s)) { fecByEndUse[s][b][f] += energyCons; } // Aggregate end-use FEC

                                // Calculate Useful Energy
                                const efficiency = getValue(placeholderUsefulEfficiency, [s, b, t, f], getValue(placeholderUsefulEfficiency, [s, b, t], getValue(placeholderUsefulEfficiency, [s, b], getValue(placeholderUsefulEfficiency, '_default', 0.65))));
                                const usefulEnergy = energyCons * efficiency; // UE for this s/b/t/f
                                currentUeDetailed[s][b][t][f] = usefulEnergy;
                                currentUeByFuel[f] += usefulEnergy; // Aggregate total UE by fuel
                                currentUeBySubsector[b] += usefulEnergy; // Aggregate total UE by subsector
                                if (endUseSectors.includes(s)) { ueByEndUseSector[s] += usefulEnergy; } // Aggregate UE by end-use sector

                                // Aggregate UE by type
                                const type = getValue(dataTypeLookup, [s, b, t, f], 'Unknown');
                                uniqueTypes.add(type);
                                ueByType[type] = (ueByType[type] || 0) + usefulEnergy;
                            }
                        });
                    });
                });
            }
        });
        // Store results for the year
        yearlyResults[year].fecDetailed = currentFecDetailed;
        yearlyResults[year].ueDetailed = currentUeDetailed;
        yearlyResults[year].fecByFuel = currentFecByFuel;
        yearlyResults[year].ueByFuel = currentUeByFuel;
        yearlyResults[year].ueBySubsector = currentUeBySubsector;
        yearlyResults[year].fecByEndUse = fecByEndUse;
        yearlyResults[year].ueByEndUseSector = ueByEndUseSector;
        yearlyResults[year].ueByType = ueByType;

        // --- Step 5: Calculate Hydrogen Transformation ---
        const currentHydrogenProdMix_yr = yearlyResults[year].hydrogenProdMix;
        const totalHydrogenDemand = currentFecByFuel['Hydrogen'] || 0; // Total H2 Output required
        let hydrogenPrimaryInputsByFuel = primaryFuels.concat(endUseFuels).reduce((acc, f) => ({ ...acc, [f]: 0 }), {}); // Inputs needed
        hydrogenTechs.forEach(ht => {
            const mixPercent = getValue(currentHydrogenProdMix_yr, [ht], 0);
            const mixFraction = mixPercent / 100;
            const unitConsMap = getValue(hydrogenTechUnitEnergyCons, [ht], {}); // GJ_input / GJ_H2_output
            Object.keys(unitConsMap).forEach(f_input => {
                 const unitCons = unitConsMap[f_input];
                 const demand = totalHydrogenDemand * mixFraction * unitCons; // Total input fuel needed for this tech's share
                 hydrogenPrimaryInputsByFuel[f_input] = (hydrogenPrimaryInputsByFuel[f_input] || 0) + demand;
            });
        });
        yearlyResults[year].hydrogenPrimaryInputsByFuel = hydrogenPrimaryInputsByFuel; // Store specific inputs
        yearlyResults[year].totalHydrogenOutput = totalHydrogenDemand; // Store H2 Output

        // Calculate Energy Consumption after accounting for H2 inputs
        const currentEcPostHydrogen = { ...currentFecByFuel }; // Start with FEC
        delete currentEcPostHydrogen['Hydrogen']; // Remove H2 as it's now an intermediate output
        // Add inputs needed for H2 production
        Object.keys(hydrogenPrimaryInputsByFuel).forEach(f => {
            if (hydrogenPrimaryInputsByFuel[f] > 0.001) {
                currentEcPostHydrogen[f] = (currentEcPostHydrogen[f] || 0) + hydrogenPrimaryInputsByFuel[f];
            }
        });
        yearlyResults[year].ecPostHydrogen = currentEcPostHydrogen;

        // --- Step 6: Calculate Power Transformation ---
        const currentPowerProdMix_yr = yearlyResults[year].powerProdMix;
        const totalElectricityDemand = currentEcPostHydrogen['Electricity'] || 0; // Total Elec Output required (includes elec for H2)
        let powerPrimaryInputsByFuel = primaryFuels.concat(endUseFuels).reduce((acc, f) => ({ ...acc, [f]: 0 }), {}); // Inputs needed
        powerTechs.forEach(pt => {
            const mixPercent = getValue(currentPowerProdMix_yr, [pt], 0);
            const mixFraction = mixPercent / 100;
            const unitConsMap = getValue(powerTechUnitEnergyCons, [pt], {}); // GJ_input / GJ_Elec_output
            Object.keys(unitConsMap).forEach(f_input => {
                const unitCons = unitConsMap[f_input];
                const demand = totalElectricityDemand * mixFraction * unitCons; // Total input fuel needed for this tech's share
                powerPrimaryInputsByFuel[f_input] = (powerPrimaryInputsByFuel[f_input] || 0) + demand;
            });
        });
        yearlyResults[year].powerPrimaryInputsByFuel = powerPrimaryInputsByFuel; // Store specific inputs
        yearlyResults[year].totalElectricityOutput = totalElectricityDemand; // Store Elec Output

        // Calculate Energy Consumption after accounting for Power inputs
        const currentEcPostPower = { ...currentEcPostHydrogen }; // Start with EC post H2
        delete currentEcPostPower['Electricity']; // Remove Elec as it's now an intermediate output
        // Add inputs needed for Power production
        Object.keys(powerPrimaryInputsByFuel).forEach(f => {
            if (powerPrimaryInputsByFuel[f] > 0.001) {
                currentEcPostPower[f] = (currentEcPostPower[f] || 0) + powerPrimaryInputsByFuel[f];
            }
        });
        yearlyResults[year].ecPostPower = currentEcPostPower;

        // --- Step 7: Calculate Other Transformations ---
        const currentOtherFuelDemand = {}; // Tracks inputs per refined fuel tech { refined: { tech: { input: val } } }
        let otherPrimaryInputsByFuel = primaryFuels.reduce((acc, p) => ({ ...acc, [p]: 0 }), {}); // Total primary inputs for 'Other'
        const otherTransformOutputs = {}; // Store total output GJ for each refined fuel
        const otherPrimaryInputsByRefinedFuel = {}; // Store total primary input GJ per refined fuel { refinedFuel: {primaryFuel: value} }
        const otherIntermediateInputsByRefinedFuel = {}; // Store intermediate inputs { refinedFuel: {intermediateFuel: value} }

        Object.keys(otherConvTechs).forEach(f_endUse => { // e.g., f_endUse = Oil, Gas, Coal, Biomass
            otherPrimaryInputsByRefinedFuel[f_endUse] = primaryFuels.reduce((acc, p) => ({ ...acc, [p]: 0 }), {}); // Init primary inputs for this refined fuel
            otherIntermediateInputsByRefinedFuel[f_endUse] = endUseFuels.reduce((acc, f) => ({ ...acc, [f]: 0}), {}); // Init intermediate inputs

            if (f_endUse in currentEcPostPower && currentEcPostPower[f_endUse] > 0.001) {
                const fuelDemandToConvert = currentEcPostPower[f_endUse]; // This is the OUTPUT needed
                otherTransformOutputs[f_endUse] = (otherTransformOutputs[f_endUse] || 0) + fuelDemandToConvert;
                currentOtherFuelDemand[f_endUse] = {};
                const techsForFuel = otherConvTechs[f_endUse] || [];

                techsForFuel.forEach(ot => { // e.g., ot = Oil refining
                    currentOtherFuelDemand[f_endUse][ot] = {};
                    const mixPercent = getValue(baseOtherProdMix, [f_endUse, ot], 0);
                    const mixFraction = mixPercent / 100;
                    const unitConsMap = getValue(otherTechUnitEnergyCons, [f_endUse, ot], {}); // GJ input / GJ output

                    Object.keys(unitConsMap).forEach(p_input => { // p_input can be primary or intermediate
                         const unitCons = unitConsMap[p_input];
                         const inputDemand = fuelDemandToConvert * mixFraction * unitCons; // Total input needed for this tech's share
                         currentOtherFuelDemand[f_endUse][ot][p_input] = inputDemand; // Store total input demand

                         if (primaryFuels.includes(p_input)) { // Track only primary inputs for PED here
                             otherPrimaryInputsByFuel[p_input] = (otherPrimaryInputsByFuel[p_input] || 0) + inputDemand;
                             otherPrimaryInputsByRefinedFuel[f_endUse][p_input] = (otherPrimaryInputsByRefinedFuel[f_endUse][p_input] || 0) + inputDemand;
                         } else if (endUseFuels.includes(p_input)) { // Track intermediate inputs separately
                             otherIntermediateInputsByRefinedFuel[f_endUse][p_input] = (otherIntermediateInputsByRefinedFuel[f_endUse][p_input] || 0) + inputDemand;
                         }
                    });
                });
            }
        });
        yearlyResults[year].otherPrimaryInputsByRefinedFuel = otherPrimaryInputsByRefinedFuel; // Store primary inputs per refined fuel
        yearlyResults[year].otherIntermediateInputsByRefinedFuel = otherIntermediateInputsByRefinedFuel; // Store intermediate inputs per refined fuel
        yearlyResults[year].otherTransformOutputs = otherTransformOutputs; // Store Refined Outputs


        // --- Step 8: Calculate PED (Total System PED) ---
        const currentPedByFuel = primaryFuels.reduce((acc, p) => ({ ...acc, [p]: 0 }), {});
        // Add primary inputs from Power, H2, Other transformations
        primaryFuels.forEach(p => {
            currentPedByFuel[p] += getValue(powerPrimaryInputsByFuel, [p], 0);
            currentPedByFuel[p] += getValue(hydrogenPrimaryInputsByFuel, [p], 0);
            currentPedByFuel[p] += getValue(otherPrimaryInputsByFuel, [p], 0); // Sum of primary inputs to refining
        });
        // Add direct use of primary fuels by end-use sectors (that weren't inputs to refining)
        endUseSectors.forEach(s => {
            (subsectors[s] || []).forEach(b => {
                primaryFuels.forEach(p => {
                    // Check if this primary fuel was used as FEC for this s/b
                    const directFec = getValue(fecByEndUse, [s, b, p], 0);
                    if (directFec > 0) {
                        // Check if this fuel 'p' is also an output of 'other transformations'
                        // If it IS an output (like refined Gas), its primary source is already counted above.
                        // If it is NOT an output (like direct use of Biomass not for refining), add it here.
                        if (!otherTransformOutputs[p]) {
                             currentPedByFuel[p] = (currentPedByFuel[p] || 0) + directFec;
                        }
                    }
                });
            });
        });
        yearlyResults[year].pedByFuel = currentPedByFuel; // Store total system PED


        // --- Step 9: Calculate Allocated PED for each End-Use Sector/Subsector ---
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
                const h2Inputs = getValue(yearlyResults[year], ['hydrogenPrimaryInputsByFuel'], {});
                // Allocate direct primary inputs for H2
                primaryFuels.forEach(p => {
                     allocatedPedForSubsector[p] += getValue(h2Inputs, [p], 0) * allocFactorH2;
                });
                // Allocate indirect electricity input for H2
                const elecForH2 = getValue(h2Inputs, ['Electricity'], 0);
                const elecForH2Filtered = elecForH2 * allocFactorH2;
                const allocFactorElecForH2 = safeDivide(elecForH2Filtered, totalElectricityDemand);
                 primaryFuels.forEach(p => {
                     allocatedPedForSubsector[p] += getValue(powerPrimaryInputsByFuel, [p], 0) * allocFactorElecForH2;
                 });
                 // TODO: Allocate other intermediate inputs to H2 (e.g., Gas for SMR) if needed

                // --- Allocate Other Transformation PED ---
                Object.keys(otherConvTechs).forEach(f_refined => { // e.g., f_refined = Oil, Gas, ...
                    const refinedDemandFiltered = filteredFec[f_refined] || 0;
                    const totalRefinedOutput = otherTransformOutputs[f_refined] || 0;
                    const allocFactorOther = safeDivide(refinedDemandFiltered, totalRefinedOutput);

                    if (allocFactorOther > 0) {
                        // Allocate direct primary inputs used to make this refined fuel
                        primaryFuels.forEach(p => {
                            allocatedPedForSubsector[p] += getValue(otherPrimaryInputsByRefinedFuel, [f_refined, p], 0) * allocFactorOther;
                        });
                        // Allocate intermediate inputs used to make this refined fuel (trace back)
                        const intermediateInputs = getValue(otherIntermediateInputsByRefinedFuel, [f_refined], {});
                        // Example: Electricity used for refining
                        const elecForRefining = getValue(intermediateInputs, ['Electricity'], 0);
                        const elecForRefiningFiltered = elecForRefining * allocFactorOther;
                        const allocFactorElecForRefining = safeDivide(elecForRefiningFiltered, totalElectricityDemand);
                        primaryFuels.forEach(p => {
                            allocatedPedForSubsector[p] += getValue(powerPrimaryInputsByFuel, [p], 0) * allocFactorElecForRefining;
                        });
                        // TODO: Add similar logic for H2 or other intermediates used in refining
                    }
                });

                // --- Allocate Direct Primary Use ---
                primaryFuels.forEach(p => {
                    // Add direct FEC of primary fuel if it's NOT an output of 'other transformations'
                    // (prevents double counting, e.g. direct biomass use vs biomass input to refining)
                     if (!otherTransformOutputs[p]) {
                         allocatedPedForSubsector[p] += filteredFec[p] || 0;
                     }
                });

                yearlyResults[year].allocatedPed[s][b] = allocatedPedForSubsector; // Store result
            });
        });

        // --- Step 10: Calculate Average PED Factors (for simplified allocation if needed later) ---
        yearlyResults[year].averagePedFactors = {};
        let totalPowerInput = Object.values(powerPrimaryInputsByFuel).reduce((s, v) => s + v, 0);
        yearlyResults[year].averagePedFactors['Electricity'] = safeDivide(totalPowerInput, totalElectricityDemand);
        let totalH2Input = Object.values(hydrogenPrimaryInputsByFuel).reduce((s, v) => s + v, 0);
        yearlyResults[year].averagePedFactors['Hydrogen'] = safeDivide(totalH2Input, totalHydrogenDemand);
        Object.keys(otherConvTechs).forEach(f_endUse => {
            let totalOtherInputForFuel = 0;
            primaryFuels.forEach(p => { totalOtherInputForFuel += getValue(otherPrimaryInputsByRefinedFuel, [f_endUse, p], 0); });
            // Add intermediate inputs as well if needed for total factor
            const totalOutput = otherTransformOutputs[f_endUse] || 0;
            yearlyResults[year].averagePedFactors[f_endUse] = safeDivide(totalOtherInputForFuel, totalOutput);
        });


    } // --- End of year loop ---

    console.log("Model calculation complete.");
    return yearlyResults;
}
