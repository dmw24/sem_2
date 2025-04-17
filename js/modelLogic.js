// js/modelLogic.js

// --- Constants and Definitions ---
// These are based on the reference implementation and may overlap
// with definitions derived in dataLoader.js. Using definitions
// passed via structuredData is generally preferred for consistency.
const startYear = 2023;
const endYear = 2050;
const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
const baseYear = 2023;
const GJ_PER_EJ = 1e9; // Conversion factor from GJ to EJ for results

// Default S-curve/Decline behavior mappings (from reference)
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
 */
function calculateSCurveShare(year, startYearCurve, targetYear, steepnessInput, startVal, endVal) {
    // Ensure inputs are numbers
    year = Number(year);
    startYearCurve = Number(startYearCurve || baseYear);
    targetYear = Number(targetYear || endYear);
    steepnessInput = Number(steepnessInput || 5); // Default steepness 5
    startVal = Number(startVal || 0);
    endVal = Number(endVal || 0);

    // Handle edge cases
    if (year >= targetYear) return endVal;
    if (year <= startYearCurve) return startVal;
    if (targetYear <= startYearCurve) return endVal; // Target year must be after start
    if (Math.abs(startVal - endVal) < 0.01) return startVal; // Avoid calculation if start/end are too close

    // Midpoint calculation based on steepness (1=late, 10=early)
    // Maps steepness 1-10 to a fraction 0.1-0.9 for the midpoint year
    const midpointFraction = 0.1 + (0.8 * (steepnessInput - 1) / 9);
    const midpointYear = startYearCurve + (targetYear - startYearCurve) * midpointFraction;

    // Logistic function parameter k calculation (simplified from reference)
    // Adjust k based on direction (growth or decline)
    // A higher absolute k means a steeper curve around the midpoint
    let k = 0.15; // Base steepness factor, adjust as needed
    if (Math.abs(targetYear - midpointYear) > 0.1) {
        // A simple heuristic to adjust steepness based on time difference
         k = 4 / Math.abs(targetYear - midpointYear); // Steeper if duration is short
    }

    // Ensure k has the correct sign for growth vs decline
    if (endVal < startVal && k > 0) k = -k;
    if (endVal > startVal && k < 0) k = -k;
    // Prevent k from being too close to zero
    if (Math.abs(k) < 0.01) k = (endVal > startVal) ? 0.05 : -0.05;


    // Calculate the exponent, handling potential overflow/underflow
    const exponent = -k * (year - midpointYear);
    if (exponent > 700) return startVal; // Prevents Math.exp overflow -> Infinity
    if (exponent < -700) return endVal;  // Prevents Math.exp underflow -> 0

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

    // Handle case where one technology should dominate entirely
    if (force100Tech && force100Tech in sharesObject && Math.abs(sharesObject[force100Tech] - 100) < 0.1) {
        for (const key in sharesObject) {
            normalized[key] = (key === force100Tech) ? 100 : 0;
        }
        return normalized;
    }

    // Avoid division by zero or normalizing an empty/zero object
    if (total <= 0.001) {
        // Return original object (all zeros or empty)
        return sharesObject;
    }

    const scaleFactor = 100 / total;
    for (const key in sharesObject) {
        normalized[key] = (Number(sharesObject[key] || 0)) * scaleFactor;
    }

    // Re-check force100Tech case after normalization (can happen if S-curve reaches target)
    if (force100Tech && normalized[force100Tech] && Math.abs(normalized[force100Tech] - 100) < 0.1) {
         for (const key in sharesObject) {
             normalized[key] = (key === force100Tech) ? 100 : 0;
         }
    }
    return normalized;
}


// --- CORE MODEL CALCULATION FUNCTION ---

/**
 * Runs the full energy model projection calculation.
 * @param {object} structuredData - The structured data object from dataLoader.js.
 * @param {object} userInputParameters - Object containing user inputs from the UI.
 * Expected format: {
 * activityGrowthFactors: { 'Sector|Subsector': factor, ... },
 * techBehaviorsAndParams: { 'Category|Key|Tech': { behavior: 'fixed'|'s-curve'|'decline', targetShare?, targetYear?, steepness? }, ... }
 * }
 * @returns {object} - An object containing yearly results: { year: { activity, demandTechMix, ..., pedByFuel }, ... }
 */
function runModelCalculation(structuredData, userInputParameters) {
    console.log(`--- Running Full Model Projection (${startYear}-${endYear}) ---`);

    // Destructure needed data and parameters
    const {
        baseActivity, // Base year activity levels
        baseDemandTechMix, // Base year demand tech mix (%)
        unitEnergyConsumption, // GJ per activity unit
        placeholderUsefulEfficiency, // Efficiency fraction
        basePowerProdMix, // Base year power mix (%)
        baseHydrogenProdMix, // Base year hydrogen mix (%)
        powerTechUnitEnergyCons, // GJ input / GJ output for power techs
        hydrogenTechUnitEnergyCons, // GJ input / GJ output for hydrogen techs
        otherTechUnitEnergyCons, // GJ input / GJ output for other conversion
        baseOtherProdMix, // Base year mix for other conversions (%)
        // Derived structures:
        sectors,
        subsectors,
        technologies,
        endUseFuels,
        primaryFuels,
        hydrogenTechs,
        powerTechs,
        otherConvTechs
    } = structuredData;

    const { activityGrowthFactors, techBehaviorsAndParams } = userInputParameters;

    const yearlyResults = {};

    // --- Yearly Calculation Loop ---
    for (const year of years) {
        yearlyResults[year] = {};

        // 1. Calculate Activity Levels based on Growth Factors [cite: 1]
        const currentActivity = {};
        if (year === baseYear) {
             // Use structured base data directly
             Object.assign(currentActivity, baseActivity);
        } else {
            const prevActivity = yearlyResults[year - 1].activity;
            sectors.forEach(s => {
                 // Check if sector exists in subsectors definition
                if(subsectors[s]){
                    currentActivity[s] = {};
                    subsectors[s].forEach(b => {
                        const growthInputKey = `${s}|${b}`;
                        // Default growth factor to 1 (0% growth) if not specified
                        const growthFactor = activityGrowthFactors[growthInputKey] !== undefined
                                              ? activityGrowthFactors[growthInputKey]
                                              : 1.0;
                        currentActivity[s][b] = getValue(prevActivity, [s, b], 0) * growthFactor;
                    });
                }
            });
        }
        yearlyResults[year].activity = currentActivity;

        // 2. Calculate Technology Mixes (Demand, Power, Hydrogen) using Behavior Models [cite: 1]
        const calculateMixWithBehavior = (categoryType, categoryKey, techList, baseMixObject) => {
            const currentShares = {}; // Stores calculated shares for this year
            let sCurveTotalShare = 0; // Sum of shares from technologies set to 's-curve'
            let fixedBaseTotal = 0; // Sum of base year shares for techs set to 'fixed'
            let declineBaseTotal = 0; // Sum of base year shares for techs set to 'decline'
            const sCurveTechs = [];
            const fixedTechs = [];
            const declineTechs = [];
            const baseMix = baseMixObject; // Base shares for the category

            let techTargeting100 = null; // Track if any S-curve tech aims for 100%

            techList.forEach(t => {
                const paramKey = `${categoryType}|${categoryKey}|${t}`;
                // Default to 'fixed' if behavior not specified in inputs
                const behaviorInfo = techBehaviorsAndParams[paramKey] || { behavior: 'fixed' };
                const baseValue = getValue(baseMix, [t], 0); // Get base year share

                if (behaviorInfo.behavior === 's-curve') {
                    const share = calculateSCurveShare(
                        year,
                        baseYear, // Start curve from base year
                        behaviorInfo.targetYear,
                        behaviorInfo.steepness,
                        baseValue, // Start value is base year share
                        behaviorInfo.targetShare
                    );
                    currentShares[t] = share;
                    sCurveTotalShare += share;
                    sCurveTechs.push(t);
                    // Check if this S-curve reaches 100% at its target year
                    if (Math.abs(behaviorInfo.targetShare - 100) < 0.01 && year >= behaviorInfo.targetYear) {
                        techTargeting100 = t;
                    }
                } else if (behaviorInfo.behavior === 'fixed') {
                    currentShares[t] = baseValue; // Keep base year share
                    fixedBaseTotal += baseValue;
                    fixedTechs.push(t);
                } else { // 'decline'
                    currentShares[t] = baseValue; // Start decline from base value
                    declineBaseTotal += baseValue;
                    declineTechs.push(t);
                }
            });

             // If one tech explicitly targets 100%, force normalization
             if (techTargeting100) {
                 return normalizeShares(currentShares, techTargeting100);
             }

            // Calculate remaining share available for fixed and declining techs
            const availableForFixedAndDecline = Math.max(0, 100 - sCurveTotalShare);

            // Allocate share to fixed technologies proportionally to their base share
            const targetFixedTotal = Math.min(fixedBaseTotal, availableForFixedAndDecline);
            const fixedScaleFactor = (fixedBaseTotal > 0.01) ? targetFixedTotal / fixedBaseTotal : 0;
            let fixedAllocatedTotal = 0;
            fixedTechs.forEach(t => {
                const scaledShare = currentShares[t] * fixedScaleFactor;
                currentShares[t] = scaledShare;
                fixedAllocatedTotal += scaledShare;
            });

            // Allocate remaining share to declining technologies proportionally
            const availableForDecline = Math.max(0, availableForFixedAndDecline - fixedAllocatedTotal);
            const declineScaleFactor = (declineBaseTotal > 0.01) ? availableForDecline / declineBaseTotal : 0;
            declineTechs.forEach(t => {
                currentShares[t] *= declineScaleFactor; // Scale down based on available share
            });

            // Normalize the final shares to ensure they sum to 100%
            return normalizeShares(currentShares, null);
        };

        try {
            // Calculate Demand Mix
            const currentDemandTechMix = {};
            sectors.forEach(s => {
                // Ensure sector exists in subsectors definition
                if(subsectors[s]){
                    currentDemandTechMix[s] = {};
                    subsectors[s].forEach(b => {
                         // Ensure base mix exists for this subsector
                        const base = getValue(baseDemandTechMix, [s, b], {});
                        // Ensure technologies are defined for this subsector
                        const techs = technologies[s]?.[b] || [];
                        currentDemandTechMix[s][b] = calculateMixWithBehavior('Demand', `${s}|${b}`, techs, base);
                    });
                }
            });
            yearlyResults[year].demandTechMix = currentDemandTechMix;

            // Calculate Power Mix
            yearlyResults[year].powerProdMix = calculateMixWithBehavior('Power', 'Power', powerTechs, basePowerProdMix);

            // Calculate Hydrogen Mix
            yearlyResults[year].hydrogenProdMix = calculateMixWithBehavior('Hydrogen', 'Hydrogen', hydrogenTechs, baseHydrogenProdMix);

        } catch (mixError) {
            console.error(`Error calculating mix for year ${year}:`, mixError);
            throw mixError; // Stop calculation if mix fails
        }

        // 3. Calculate Demand Technology Activity [cite: 1]
        // DemandTechActivity(s,b,t,y) = DemandTechMix(s,b,t,y) * Activity(s,b,y)
        const currentDemandTechMix_yr = yearlyResults[year].demandTechMix;
        const currentActivity_yr = yearlyResults[year].activity;
        const currentDemandTechActivity = {};
        sectors.forEach(s => {
            if(subsectors[s]){ // Check sector exists
                currentDemandTechActivity[s] = {};
                subsectors[s].forEach(b => {
                    currentDemandTechActivity[s][b] = {};
                    const techs = technologies[s]?.[b] || [];
                    techs.forEach(t => {
                        const mixPercent = getValue(currentDemandTechMix_yr, [s, b, t], 0);
                        const mixFraction = mixPercent / 100;
                        const activityLevel = getValue(currentActivity_yr, [s, b], 0);
                        currentDemandTechActivity[s][b][t] = mixFraction * activityLevel;
                    });
                });
            }
        });
        yearlyResults[year].demandTechActivity = currentDemandTechActivity;

        // 4. Calculate Final Energy Consumption (FEC) and Useful Energy (UE) [cite: 1]
        // FEC(s,b,t,f,y) = DemandTechActivity(s,b,t,y) * UnitEnergyConsumption(s,b,t,f)
        // UE(s,b,t,f,y) = FEC(s,b,t,f,y) * UsefulEfficiency(s,b,t,f)
        const currentFecDetailed = {}; // { Sector: { Subsector: { Tech: { Fuel: Value_GJ } } } }
        const currentUeDetailed = {};  // { Sector: { Subsector: { Tech: { Fuel: Value_GJ } } } }
        const currentFecByFuel = endUseFuels.reduce((acc, f) => ({ ...acc, [f]: 0 }), {}); // Aggregated
        const currentUeByFuel = endUseFuels.reduce((acc, f) => ({ ...acc, [f]: 0 }), {}); // Aggregated
        const currentUeBySubsector = {}; // Aggregated by subsector

        sectors.forEach(s => {
            if(subsectors[s]){
                currentFecDetailed[s] = {};
                currentUeDetailed[s] = {};
                subsectors[s].forEach(b => {
                    currentFecDetailed[s][b] = {};
                    currentUeDetailed[s][b] = {};
                    currentUeBySubsector[b] = 0; // Initialize UE for this subsector
                    const techs = technologies[s]?.[b] || [];
                    techs.forEach(t => {
                        currentFecDetailed[s][b][t] = {};
                        currentUeDetailed[s][b][t] = {};
                        const techActivity = getValue(currentDemandTechActivity, [s, b, t], 0);
                        // Get the unit consumption map for this tech { Fuel: Value_GJ }
                        const unitConsMap = getValue(unitEnergyConsumption, [s, b, t], {});

                        Object.keys(unitConsMap).forEach(f => {
                            if (endUseFuels.includes(f)) {
                                const unitCons = unitConsMap[f]; // GJ / activity unit
                                const energyCons = techActivity * unitCons; // GJ
                                currentFecDetailed[s][b][t][f] = energyCons;
                                currentFecByFuel[f] += energyCons; // Aggregate FEC by fuel

                                // Calculate Useful Energy (UE)
                                // Lookup efficiency: Specific > Tech > Subsector > Sector > Default
                                const efficiency = getValue(placeholderUsefulEfficiency, [s, b, t, f],
                                                 getValue(placeholderUsefulEfficiency, [s, b, t],
                                                 getValue(placeholderUsefulEfficiency, [s, b],
                                                 getValue(placeholderUsefulEfficiency, '_default', 0.65)))); // Use 0.65 if no specific efficiency found

                                const usefulEnergy = energyCons * efficiency; // GJ
                                currentUeDetailed[s][b][t][f] = usefulEnergy;
                                currentUeByFuel[f] += usefulEnergy; // Aggregate UE by fuel
                                currentUeBySubsector[b] += usefulEnergy; // Aggregate UE by subsector
                            }
                        });
                    });
                });
            }
        });
        yearlyResults[year].fecDetailed = currentFecDetailed;
        yearlyResults[year].ueDetailed = currentUeDetailed;
        yearlyResults[year].fecByFuel = currentFecByFuel;
        yearlyResults[year].ueByFuel = currentUeByFuel;
        yearlyResults[year].ueBySubsector = currentUeBySubsector;


        // 5. Calculate Hydrogen Transformation [cite: 1]
        // InputEnergy(f_input) = FEC(Hydrogen) * HydrogenProdMix(ht) * HydrogenTechUnitEnergyCons(ht, f_input)
        const currentHydrogenProdMix_yr = yearlyResults[year].hydrogenProdMix;
        const fecHydrogen = currentFecByFuel['Hydrogen'] || 0; // Total final demand for Hydrogen
        let currentHydrogenInputEnergyByFuel = primaryFuels.concat(endUseFuels).reduce((acc, f) => ({ ...acc, [f]: 0 }), {}); // Inputs needed

        hydrogenTechs.forEach(ht => {
            const mixPercent = getValue(currentHydrogenProdMix_yr, [ht], 0);
            const mixFraction = mixPercent / 100;
            // Get { Fuel: InputGJ_per_OutputGJ } for this hydrogen tech
            const unitConsMap = getValue(hydrogenTechUnitEnergyCons, [ht], {});

            Object.keys(unitConsMap).forEach(f_input => {
                const unitCons = unitConsMap[f_input]; // GJ input / GJ H2 output
                const demand = fecHydrogen * mixFraction * unitCons; // GJ input fuel demand
                currentHydrogenInputEnergyByFuel[f_input] = (currentHydrogenInputEnergyByFuel[f_input] || 0) + demand;
            });
        });

        // Calculate Energy Consumption Post-Hydrogen (ECPostHydrogen)
        // Sum of non-H2 FEC + H2 production inputs
        const currentEcPostHydrogen = { ...currentFecByFuel };
        delete currentEcPostHydrogen['Hydrogen']; // Remove the final H2 demand itself
        Object.keys(currentHydrogenInputEnergyByFuel).forEach(f => {
             if (currentHydrogenInputEnergyByFuel[f] > 0.001) { // Only add if significant
                 currentEcPostHydrogen[f] = (currentEcPostHydrogen[f] || 0) + currentHydrogenInputEnergyByFuel[f];
             }
        });
        yearlyResults[year].ecPostHydrogen = currentEcPostHydrogen;


        // 6. Calculate Power Transformation [cite: 1]
        // InputEnergy(f_input) = ECPostHydrogen(Electricity) * PowerProdMix(pt) * PowerTechUnitEnergyCons(pt, f_input)
        const currentPowerProdMix_yr = yearlyResults[year].powerProdMix;
        const ecElectricity = currentEcPostHydrogen['Electricity'] || 0; // Total demand for electricity (incl. for H2)
        let currentPowerInputEnergyByFuel = primaryFuels.concat(endUseFuels).reduce((acc, f) => ({ ...acc, [f]: 0 }), {});

        powerTechs.forEach(pt => {
            const mixPercent = getValue(currentPowerProdMix_yr, [pt], 0);
            const mixFraction = mixPercent / 100;
             // Get { Fuel: InputGJ_per_OutputGJ } for this power tech
            const unitConsMap = getValue(powerTechUnitEnergyCons, [pt], {});

            Object.keys(unitConsMap).forEach(f_input => {
                const unitCons = unitConsMap[f_input]; // GJ input / GJ Elec output
                const demand = ecElectricity * mixFraction * unitCons; // GJ input fuel demand
                currentPowerInputEnergyByFuel[f_input] = (currentPowerInputEnergyByFuel[f_input] || 0) + demand;
            });
        });

        // Calculate Energy Consumption Post-Power (ECPostPower)
        // Sum of non-Elec ECPostHydrogen + Power production inputs
        const currentEcPostPower = { ...currentEcPostHydrogen };
        delete currentEcPostPower['Electricity']; // Remove the electricity demand itself
        Object.keys(currentPowerInputEnergyByFuel).forEach(f => {
            if (currentPowerInputEnergyByFuel[f] > 0.001) { // Only add if significant
                currentEcPostPower[f] = (currentEcPostPower[f] || 0) + currentPowerInputEnergyByFuel[f];
            }
        });
        yearlyResults[year].ecPostPower = currentEcPostPower;


        // 7. Calculate Other Transformations (Refining etc.) [cite: 1]
        // PrimaryDemand(p) = FECOther(f_endUse) * OtherProdMix(f_endUse, ot) * OtherTechUnitEnergyCons(f_endUse, ot, p)
        const currentOtherFuelDemand = {}; // Detailed breakdown: { EndUseFuel: { Tech: { PrimaryFuel: Value_GJ } } }
        let currentOtherInputEnergyByFuel = primaryFuels.reduce((acc, p) => ({ ...acc, [p]: 0 }), {}); // Aggregate primary fuel inputs

        // Iterate over fuels that might need 'other' conversion (subset of end-use fuels)
        Object.keys(otherConvTechs).forEach(f_endUse => {
             // Check if there's still demand for this fuel after H2 and Power steps
            if (f_endUse in currentEcPostPower && currentEcPostPower[f_endUse] > 0.001) {
                const fuelDemandToConvert = currentEcPostPower[f_endUse]; // GJ
                currentOtherFuelDemand[f_endUse] = {};
                const techsForFuel = otherConvTechs[f_endUse] || []; // Get relevant techs (e.g., 'Oil refining')

                techsForFuel.forEach(ot => {
                    currentOtherFuelDemand[f_endUse][ot] = {};
                    // Use base mix for other conversions (assumed constant for now)
                    const mixPercent = getValue(baseOtherProdMix, [f_endUse, ot], 0);
                    const mixFraction = mixPercent / 100;
                    // Get { PrimaryFuel: InputGJ_per_OutputGJ } for this conversion tech
                    const unitConsMap = getValue(otherTechUnitEnergyCons, [f_endUse, ot], {});

                    Object.keys(unitConsMap).forEach(p_primary => {
                        if (primaryFuels.includes(p_primary)) {
                            const unitCons = unitConsMap[p_primary]; // GJ input / GJ output
                            const primaryDemand = fuelDemandToConvert * mixFraction * unitCons; // GJ primary fuel
                            currentOtherFuelDemand[f_endUse][ot][p_primary] = primaryDemand;
                            currentOtherInputEnergyByFuel[p_primary] = (currentOtherInputEnergyByFuel[p_primary] || 0) + primaryDemand;
                        }
                    });
                });
            }
        });

        // 8. Calculate Primary Energy Demand (PED) [cite: 1]
        // PED(p) = Sum_over_other_conversions(PrimaryDemand(p)) + ECPostPower(f=p, if f is primary and not converted elsewhere)
        const currentPedByFuel = primaryFuels.reduce((acc, p) => ({ ...acc, [p]: 0 }), {});

        // Add primary fuels consumed in 'other' conversions
        Object.keys(currentOtherInputEnergyByFuel).forEach(p => {
            if (p in currentPedByFuel) {
                currentPedByFuel[p] += currentOtherInputEnergyByFuel[p];
            }
        });

        // Add remaining primary fuels from ECPostPower that weren't inputs to 'other' conversions
        Object.keys(currentEcPostPower).forEach(f => {
             // Check if f is a primary fuel
            if (primaryFuels.includes(f)) {
                 // Check if this fuel 'f' was fully converted in the 'other' step
                 // (i.e., if f_endUse === f for any key in currentOtherFuelDemand)
                let isInputToOther = (f in currentOtherFuelDemand);

                if (!isInputToOther && currentEcPostPower[f] > 0.001) {
                    // If it's primary and *not* converted, add its demand directly to PED
                    currentPedByFuel[f] = (currentPedByFuel[f] || 0) + currentEcPostPower[f];
                }
            }
        });
        yearlyResults[year].pedByFuel = currentPedByFuel;

    } // --- End of year loop ---

    console.log("Model calculation complete.");
    return yearlyResults;
}
