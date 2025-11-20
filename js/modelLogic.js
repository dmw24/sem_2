// js/modelLogic.js
// Version: S-Curve uses user's 4-step logic (input k, t0 -> calc asymptotes) + capping

const GJ_PER_EJ = 1e9;

// Default behavior mappings (from reference) - Used if behavior is 'fixed' or 'decline'
const defaultDeclineDemandTechs = { /* ... (unchanged) ... */ 'Transport|Passenger cars': 'ICE', 'Transport|Trucks': 'ICE', 'Transport|Buses': 'ICE', 'Transport|2/3 wheelers': 'ICE', 'Transport|Ships': 'Conventional ship', 'Transport|Planes': 'Conventional plane', 'Transport|Trains': 'Diesel train', 'Industry|Steel': 'BF-BOF', 'Industry|Cement': 'Conventional kiln', 'Industry|Chemicals': 'Conventional', 'Industry|Low temp. heating': 'Fossil boiler', 'Industry|High temp. heating': 'Fossil furnace', 'Industry|Other industry - energy': 'Conventional', 'Buildings|Residential heating': 'Fossil boiler', 'Buildings|Residential cooking': 'Conventional fossil', 'Buildings|Residential lighting': 'Conventional', 'Buildings|Other residential': 'Conventional', 'Buildings|Building cooling': 'Low efficiency airco', 'Buildings|Commercial heating': 'Fossil boiler', 'Buildings|Commercial lighting': 'Conventional', 'Buildings|Other commercial': 'Conventional', 'Transport|Other transport': 'Conventional' };
const defaultSCurveDemandTechs = { /* ... (unchanged) ... */ 'Transport|Passenger cars': 'EV', 'Transport|Trucks': 'EV', 'Transport|Buses': 'EV', 'Transport|2/3 wheelers': 'EV', 'Transport|Ships': 'Ammonia ship', 'Transport|Planes': 'Electric plane', 'Transport|Trains': 'Electric train', 'Industry|Steel': 'DRI-EAF (H2)', 'Industry|Cement': 'Electric kiln', 'Industry|Chemicals': 'Electrified', 'Industry|Low temp. heating': 'Heat pump', 'Industry|High temp. heating': 'Electric furnace', 'Industry|Other industry - energy': 'Electrified', 'Buildings|Residential heating': 'Heat pump', 'Buildings|Residential cooking': 'Electrified', 'Buildings|Residential lighting': 'Full LED', 'Buildings|Other residential': 'Electrified', 'Buildings|Building cooling': 'High efficiency airco', 'Buildings|Commercial heating': 'Heat pump', 'Buildings|Commercial lighting': 'Full LED', 'Buildings|Other commercial': 'Electrified', 'Transport|Other transport': 'Electrified' };
const defaultDeclinePowerTechs = ['Gas power', 'Coal power', 'Oil power'];
const defaultSCurvePowerTechs = ['Solar PV', 'Wind'];
const defaultDeclineHydrogenTechs = ['Blue'];
const defaultSCurveHydrogenTechs = ['Green'];


// --- Helper Functions ---
function getValue(obj, keys, defaultValue = 0) { /* ... (unchanged) ... */
    let current = obj; for (const key of keys) { if (current && typeof current === 'object' && key in current) { current = current[key]; } else { return defaultValue; } } return (current === null || current === undefined) ? defaultValue : current;
}

// Basic sigmoid function (Step 1)
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
 * @param {number} startVal - Share at baseYear (InitialValue)
 * @param {number} targetYear - Target year (t_target)
 * @param {number} targetVal - Share at targetYear (TargetValue)
 * @returns {number} Calculated share for the given year.
 */
function calculateForcedLogisticShare(year, kUserInput, t0UserInput, baseYear, startVal, targetYear, targetVal) {

    const t = year;
    const k = Number(kUserInput); // Use user k directly
    const t0 = Number(t0UserInput);
    const t_start = baseYear;
    const InitialValue = Number(startVal); // Share % (0-100)
    const t_target = targetYear;
    const TargetValue = Number(targetVal); // Share % (0-100)

    // --- Input Validation and Edge Cases ---
    if (isNaN(k) || isNaN(t0) || isNaN(InitialValue) || isNaN(TargetValue)) {
        console.warn("Invalid input to calculateForcedLogisticShare (NaN). Returning startVal.", { year, kUserInput, t0UserInput, baseYear, startVal, targetYear, targetVal });
        return startVal;
    }
    // If k is effectively zero, return start value (no change)
    if (Math.abs(k) < 1e-9) {
        return InitialValue;
    }
    // If start and target values are the same, return that value
    if (Math.abs(TargetValue - InitialValue) < 0.01) {
        return InitialValue;
    }
    // If start and target times are the same, invalid input
    if (Math.abs(t_target - t_start) < 0.1) {
        console.warn("Start year and target year are the same. Returning startVal.", { t_start, t_target });
        return InitialValue;
    }

    // --- Step 2: Compute σ at start and target points ---
    // Adjust sign of k based on growth/decline for internal sigma calculation consistency if needed
    // Although sigma function handles signed k. Let's use the user's k directly.
    const sigma_s = sigma(t_start, k, t0);
    const sigma_t = sigma(t_target, k, t0);

    // --- Step 3: Solve for implied asymptotes L_start (A) and L_end (B) ---
    let L_start_asymptote, L_end_asymptote;
    const sigma_diff = sigma_t - sigma_s;

    if (Math.abs(sigma_diff) < 1e-9) {
        // This happens if k=0 (handled above) or if t_start/t_target are placed
        // symmetrically around t0 with the same k, or if t_start=t_target (handled above).
        // Indicates parameters might be inconsistent or curve is flat between points.
        console.warn("Sigma values at start and target are too close; cannot determine asymptotes reliably. Returning linear interpolation or startVal.", { sigma_s, sigma_t, k, t0, t_start, t_target });
        // Fallback: linear interpolation or just return start/end value
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
    const sigma_current = sigma(t, k, t0);
    const logisticValue = L_start_asymptote + (L_end_asymptote - L_start_asymptote) * sigma_current;

    // --- Apply Capping Logic ---
    if (year > targetYear) {
        // If past the target year, hold the target value
        return TargetValue;
    } else {
        // Otherwise, return the calculated logistic value
        // This inherently ensures S(t_start) = InitialValue and S(t_target) = TargetValue
        // Clamp results to avoid potential over/undershoot due to calculated asymptotes
        // especially if inputs were inconsistent. Clamp between the initial and target values.
        const minVal = Math.min(InitialValue, TargetValue);
        const maxVal = Math.max(InitialValue, TargetValue);
        return Math.max(minVal, Math.min(maxVal, logisticValue));
        // Alternatively, could clamp between calculated asymptotes if they are trusted:
        // return Math.max(L_start_asymptote, Math.min(L_end_asymptote, logisticValue));
        // Let's clamp between Initial/Target values for robustness against weird asymptotes.
    }
}


function normalizeShares(sharesObject, force100Tech = null) { /* ... (unchanged) ... */
    let total = Object.values(sharesObject).reduce((sum, val) => sum + Number(val || 0), 0); const normalized = {}; if (force100Tech && force100Tech in sharesObject && Math.abs(sharesObject[force100Tech] - 100) < 0.1) { for (const key in sharesObject) { normalized[key] = (key === force100Tech) ? 100 : 0; } return normalized; } if (total <= 0.001) { return sharesObject; } const scaleFactor = 100 / total; for (const key in sharesObject) { normalized[key] = (Number(sharesObject[key] || 0)) * scaleFactor; } if (force100Tech && normalized[force100Tech] && Math.abs(normalized[force100Tech] - 100) < 0.1) { for (const key in sharesObject) { normalized[key] = (key === force100Tech) ? 100 : 0; } } return normalized;
}


// --- CORE MODEL CALCULATION FUNCTION ---
function runModelCalculation(structuredData, userInputParameters) {
    const {
        baseActivity = {}, baseDemandTechMix = {}, unitEnergyConsumption = {}, placeholderUsefulEfficiency = { '_default': 0.65 },
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
        if (year === baseYear) {
            Object.assign(currentActivity, baseActivity);
        } else {
            const prevResults = yearlyResults[year - 1];
            if (!prevResults || !prevResults.activity) {
                throw new Error(`Cannot calculate activity for ${year}: Previous year (${year - 1}) data missing.`);
            }
            const prevActivity = prevResults.activity;
            sectors.forEach(s => {
                if (subsectors[s]) {
                    currentActivity[s] = {};
                    subsectors[s].forEach(b => {
                        const growthInputKey = `${s}|${b}`;
                        const growthData = activityGrowthFactors[growthInputKey];

                        let growthFactor = 1.0;
                        if (growthData) {
                            if (typeof growthData === 'object') {
                                // Split growth logic
                                if (year <= 2035) {
                                    growthFactor = growthData.p1 || 1.0;
                                } else {
                                    growthFactor = growthData.p2 || 1.0;
                                }
                            } else {
                                // Fallback for single value (backward compatibility)
                                growthFactor = growthData;
                            }
                        }

                        currentActivity[s][b] = getValue(prevActivity, [s, b], 0) * growthFactor;
                    });
                }
            });
        }
        yearlyResults[year].activity = currentActivity;

        // 2. Technology Mixes
        const calculateMixWithBehavior = (categoryType, categoryKey, techList, baseMixObject) => {
            const currentShares = {}; let sCurveTotalShare = 0; let fixedBaseTotal = 0; let declineBaseTotal = 0; const sCurveTechs = []; const fixedTechs = []; const declineTechs = []; const baseMix = baseMixObject || {}; let techTargeting100 = null;

            (techList || []).forEach(t => {
                const paramKey = `${categoryType}|${categoryKey}|${t}`;
                const behaviorInfo = techBehaviorsAndParams[paramKey] || { behavior: 'fixed' };

                // DEBUG: Trace Steel Mix
                if (categoryKey === 'Industry|Steel' && t === 'DRI-EAF (H2)' && year === 2050) {
                    console.log(`DEBUG (modelLogic): Steel DRI-EAF (H2) ParamKey: '${paramKey}', Behavior:`, behaviorInfo);
                }

                const baseValue = getValue(baseMix, [t], 0); // Base share % (0-100)

                if (behaviorInfo.behavior === 's-curve') {
                    // *** UPDATED CALL to use new S-curve function ***
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
                    sCurveTotalShare += share; // Note: this sum might exceed 100 initially before normalization if asymptotes are weird
                    sCurveTechs.push(t);
                    // Check if target is 100 - needed for normalization override
                    if (Math.abs(behaviorInfo.targetShare - 100) < 0.01 && year >= behaviorInfo.targetYear) {
                        techTargeting100 = t;
                    }

                } else if (behaviorInfo.behavior === 'fixed') {
                    currentShares[t] = baseValue; fixedBaseTotal += baseValue; fixedTechs.push(t);
                } else { // decline
                    // Simple decline logic: Treat as S-curve aiming for 0?
                    // Or keep previous logic? Let's keep previous logic for now:
                    // It gets scaled down proportionally by normalizeShares if S-curves grow.
                    currentShares[t] = baseValue; declineBaseTotal += baseValue; declineTechs.push(t);
                }
            });
            // Normalize logic remains the same...
            if (techTargeting100) { return normalizeShares(currentShares, techTargeting100); } const availableForFixedAndDecline = Math.max(0, 100 - sCurveTotalShare); const targetFixedTotal = Math.min(fixedBaseTotal, availableForFixedAndDecline); const fixedScaleFactor = (fixedBaseTotal > 0.01) ? targetFixedTotal / fixedBaseTotal : 0; let fixedAllocatedTotal = 0; fixedTechs.forEach(t => { const scaledShare = currentShares[t] * fixedScaleFactor; currentShares[t] = scaledShare; fixedAllocatedTotal += scaledShare; }); const availableForDecline = Math.max(0, availableForFixedAndDecline - fixedAllocatedTotal); const declineScaleFactor = (declineBaseTotal > 0.01) ? availableForDecline / declineBaseTotal : 0; declineTechs.forEach(t => { currentShares[t] *= declineScaleFactor; }); return normalizeShares(currentShares, null);
        };

        try {
            // *** DEBUG LOGS from previous step (can be removed if stable) ***
            if (year === baseYear) { console.log(`DEBUG (modelLogic - Base Year ${year}): Received baseDemandTechMix for Steel:`, JSON.stringify(getValue(baseDemandTechMix, ['Industry', 'Steel'], {}))); }

            const currentDemandTechMix = {}; sectors.forEach(s => { if (subsectors[s]) { currentDemandTechMix[s] = {}; subsectors[s].forEach(b => { const base = getValue(baseDemandTechMix, [s, b], {}); const techs = technologies[s]?.[b] || []; currentDemandTechMix[s][b] = calculateMixWithBehavior('Demand', `${s}|${b}`, techs, base); }); } }); yearlyResults[year].demandTechMix = currentDemandTechMix;
            yearlyResults[year].powerProdMix = calculateMixWithBehavior('Power', 'Power', powerTechs, basePowerProdMix);
            yearlyResults[year].hydrogenProdMix = calculateMixWithBehavior('Hydrogen', 'Hydrogen', hydrogenTechs, baseHydrogenProdMix);

            if (year === baseYear) { console.log(`DEBUG (modelLogic - Base Year ${year}): Calculated demandTechMix for Steel:`, JSON.stringify(yearlyResults[year].demandTechMix?.Industry?.Steel)); }

        } catch (mixError) { console.error(`Error calculating mix for year ${year}:`, mixError); throw mixError; }

        // 3. Demand Technology Activity (Unchanged)
        const currentDemandTechMix_yr = yearlyResults[year].demandTechMix; const currentActivity_yr = yearlyResults[year].activity; const currentDemandTechActivity = {}; sectors.forEach(s => { if (subsectors[s]) { currentDemandTechActivity[s] = {}; subsectors[s].forEach(b => { currentDemandTechActivity[s][b] = {}; const techs = technologies[s]?.[b] || []; techs.forEach(t => { const mixPercent = getValue(currentDemandTechMix_yr, [s, b, t], 0); const mixFraction = mixPercent / 100; const activityLevel = getValue(currentActivity_yr, [s, b], 0); currentDemandTechActivity[s][b][t] = mixFraction * activityLevel; }); }); } }); yearlyResults[year].demandTechActivity = currentDemandTechActivity;

        // 4. FEC and UE (Unchanged)
        const currentFecDetailed = {}; const currentUeDetailed = {}; const currentFecByFuel = endUseFuels.reduce((acc, f) => ({ ...acc, [f]: 0 }), {}); const currentUeByFuel = endUseFuels.reduce((acc, f) => ({ ...acc, [f]: 0 }), {}); const currentUeBySubsector = {}; sectors.forEach(s => {
            if (subsectors[s]) {
                currentFecDetailed[s] = {}; currentUeDetailed[s] = {}; subsectors[s].forEach(b => {
                    currentFecDetailed[s][b] = {}; currentUeDetailed[s][b] = {}; currentUeBySubsector[b] = 0; const techs = technologies[s]?.[b] || []; techs.forEach(t => {
                        currentFecDetailed[s][b][t] = {}; currentUeDetailed[s][b][t] = {}; const techActivity = getValue(currentDemandTechActivity, [s, b, t], 0); const unitConsMap = getValue(unitEnergyConsumption, [s, b, t], {}); Object.keys(unitConsMap).forEach(f => {
                            if (endUseFuels.includes(f)) {
                                const unitCons = unitConsMap[f]; const energyCons = techActivity * unitCons; currentFecDetailed[s][b][t][f] = energyCons; currentFecByFuel[f] += energyCons;

                                // DEBUG: Trace Hydrogen for Steel
                                if (s === 'Industry' && b === 'Steel' && t === 'DRI-EAF (H2)' && f === 'Hydrogen' && year === 2050) {
                                    console.log(`DEBUG (modelLogic): Steel DRI-EAF (H2) Hydrogen: Activity=${techActivity}, UnitCons=${unitCons}, EnergyCons=${energyCons}`);
                                }

                                const efficiency = getValue(placeholderUsefulEfficiency, [s, b, t, f], getValue(placeholderUsefulEfficiency, [s, b, t], getValue(placeholderUsefulEfficiency, [s, b], getValue(placeholderUsefulEfficiency, '_default', 0.65)))); const usefulEnergy = energyCons * efficiency; currentUeDetailed[s][b][t][f] = usefulEnergy; currentUeByFuel[f] += usefulEnergy; currentUeBySubsector[b] += usefulEnergy;
                            }
                        });
                    });
                });
            }
        }); yearlyResults[year].fecDetailed = currentFecDetailed; yearlyResults[year].ueDetailed = currentUeDetailed; yearlyResults[year].fecByFuel = currentFecByFuel; yearlyResults[year].ueByFuel = currentUeByFuel; yearlyResults[year].ueBySubsector = currentUeBySubsector;

        if (year === 2050) {
            console.log('DEBUG (modelLogic): Final FEC by Fuel 2050:', JSON.stringify(currentFecByFuel));
        }

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

