// js/modelLogic.js
// Further refactored for maximum conciseness

const GJ_PER_EJ = 1e9;
const modelSafeGet = (obj, path, fallback) => {
    let current = obj;
    for (let i = 0; i < path.length; i += 1) {
        if (current == null || !(path[i] in current)) return fallback;
        current = current[path[i]];
    }
    return current == null ? fallback : current;
};

// --- S-Curve Calculation (Concise) ---
const sigma = (t, k, t0) => {
    if (Math.abs(k) < 1e-9) return t < t0 ? 0 : t > t0 ? 1 : 0.5;
    const exp = -k * (t - t0);
    return exp > 700 ? 0 : exp < -700 ? 1 : 1 / (1 + Math.exp(exp));
};

const calculateForcedLogisticShare = (yr, k, t0, baseYr, startVal, targetYr, targetVal) => {
    if ([k, t0, startVal, targetVal].some(isNaN) || Math.abs(k) < 1e-9 || Math.abs(targetVal - startVal) < 0.01 || Math.abs(targetYr - baseYr) < 0.1) return startVal;
    const sigS = sigma(baseYr, k, t0), sigT = sigma(targetYr, k, t0);
    const sigDiff = sigT - sigS;
    let L_start, L_end;
    if (Math.abs(sigDiff) < 1e-9) { // Fallback: linear interpolation
        console.warn("Sigma values close; using linear interp.", { sigS, sigT, k, t0, baseYr, targetYr });
        return yr <= baseYr ? startVal : yr >= targetYr ? targetVal : startVal + (targetVal - startVal) * (yr - baseYr) / (targetYr - baseYr);
    } else {
        L_start = (startVal * sigT - targetVal * sigS) / sigDiff;
        L_end = (targetVal * (1 - sigS) - startVal * (1 - sigT)) / sigDiff;
    }
    const logisticVal = L_start + (L_end - L_start) * sigma(yr, k, t0);
    return yr > targetYr ? targetVal : Math.max(Math.min(startVal, targetVal), Math.min(Math.max(startVal, targetVal), logisticVal)); // Cap & Clamp
};

const normalizeShares = (shares, force100Tech = null) => {
    const norm = {};
    const total = Object.values(shares).reduce((sum, val) => sum + (Number(val) || 0), 0);
    const forceTechVal = shares[force100Tech];
    if (force100Tech && forceTechVal !== undefined && Math.abs(forceTechVal - 100) < 0.1) {
        Object.keys(shares).forEach(k => norm[k] = k === force100Tech ? 100 : 0);
        return norm;
    }
    if (total <= 1e-3) return shares;
    const scale = 100 / total;
    Object.keys(shares).forEach(k => norm[k] = (Number(shares[k]) || 0) * scale);
    // Re-check after normalization
    if (force100Tech && norm[force100Tech] && Math.abs(norm[force100Tech] - 100) < 0.1) {
       Object.keys(shares).forEach(k => norm[k] = k === force100Tech ? 100 : 0);
    }
    return norm;
};

// --- CORE MODEL CALCULATION (Concise) ---
function runModelCalculation(structuredData, userParams) {
    if (!structuredData || !userParams) throw new Error("Missing data or params for model.");
    const { baseActivity = {}, baseDemandTechMix = {}, unitEnergyConsumption = {}, placeholderUsefulEfficiency = {'_default': 0.65}, basePowerProdMix = {}, baseHydrogenProdMix = {}, powerTechUnitEnergyCons = {}, hydrogenTechUnitEnergyCons = {}, otherTechUnitEnergyCons = {}, baseOtherProdMix = {}, sectors = [], subsectors = {}, technologies = {}, endUseFuels = [], primaryFuels = [], hydrogenTechs = [], powerTechs = [], otherConvTechs = {}, startYear, endYear, years = [] } = structuredData;
    if (!years || !years.length || !startYear || !endYear) throw new Error("Invalid years config.");
    const { activityGrowthFactors = {}, techBehaviorsAndParams = {} } = userParams;
    const baseYr = startYear;
    console.log(`--- Running Model (${startYear}-${endYear}) ---`);
    const results = {};
    results[baseYr] = { activity: Object.assign({}, baseActivity) }; // Init base year

    for (const yr of years) {
        const resYr = results[yr] = results[yr] || {}; // Ensure year object exists

        // --- 1. Activity ---
        const prevActivity = modelSafeGet(results, [yr - 1, 'activity'], null);
        resYr.activity = (yr === baseYr) ? results[baseYr].activity : sectors.reduce((act, s) => {
            if (subsectors[s]) act[s] = subsectors[s].reduce((subAct, b) => {
                const prevVal = modelSafeGet(prevActivity, [s, b], 0);
                const growthKey = `${s}|${b}`;
                const growth = Object.prototype.hasOwnProperty.call(activityGrowthFactors, growthKey) ? activityGrowthFactors[growthKey] : undefined;
                const growthFactor = (growth !== undefined && growth !== null) ? growth : 1.0;
                subAct[b] = prevVal * growthFactor;
                return subAct;
            }, {});
            return act;
        }, {});
        const currentActivity = resYr.activity;

        // --- 2. Tech Mixes ---
        const calculateMix = (catType, catKey, techList, baseMix) => {
            const currentShares = {}; let sCurveTotal = 0, fixedBase = 0, declineBase = 0;
            const sCurveTechs = [], fixedTechs = [], declineTechs = [];
            let techTarget100 = null;
            (techList || []).forEach(t => {
                const pKey = `${catType}|${catKey}|${t}`;
                const behaviorInfo = techBehaviorsAndParams[pKey] || { behavior: 'fixed' };
                const baseVal = baseMix && Object.prototype.hasOwnProperty.call(baseMix, t) ? baseMix[t] : 0;
                if (behaviorInfo.behavior === 's-curve' && yr > baseYr) {
                    const share = calculateForcedLogisticShare(yr, behaviorInfo.kValue, behaviorInfo.midpointYear, baseYr, baseVal, behaviorInfo.targetYear, behaviorInfo.targetShare);
                    currentShares[t] = share; sCurveTotal += share; sCurveTechs.push(t);
                    if (Math.abs(behaviorInfo.targetShare - 100) < 0.01 && yr >= behaviorInfo.targetYear) techTarget100 = t;
                } else if (behaviorInfo.behavior === 'fixed' || yr === baseYr) {
                    currentShares[t] = baseVal; if (yr > baseYr) fixedBase += baseVal; fixedTechs.push(t);
                } else { // decline
                    currentShares[t] = baseVal; declineBase += baseVal; declineTechs.push(t);
                }
            });
            if (yr === baseYr) return currentShares; // Base year mix
            if (techTarget100) return normalizeShares(currentShares, techTarget100);
            const available = Math.max(0, 100 - sCurveTotal);
            const targetFixed = Math.min(fixedBase, available);
            const fixedScale = fixedBase > 1e-3 ? targetFixed / fixedBase : 0;
            let fixedAllocated = 0;
            fixedTechs.forEach(t => { const scaled = currentShares[t] * fixedScale; currentShares[t] = scaled; fixedAllocated += scaled; });
            const availableDecline = Math.max(0, available - fixedAllocated);
            const declineScale = declineBase > 1e-3 ? availableDecline / declineBase : 0;
            declineTechs.forEach(t => { currentShares[t] *= declineScale; });
            return normalizeShares(currentShares);
        };
        resYr.demandTechMix = sectors.reduce((mix, s) => {
            if (subsectors[s]) mix[s] = subsectors[s].reduce((subMix, b) => {
                const techList = modelSafeGet(technologies, [s, b], []);
                const baseMix = modelSafeGet(baseDemandTechMix, [s, b], {});
                subMix[b] = calculateMix('Demand', `${s}|${b}`, techList, baseMix);
                return subMix;
            }, {});
            return mix;
        }, {});
        resYr.powerProdMix = calculateMix('Power', 'Power', powerTechs, basePowerProdMix);
        resYr.hydrogenProdMix = calculateMix('Hydrogen', 'Hydrogen', hydrogenTechs, baseHydrogenProdMix);
        const currentDemandMix = resYr.demandTechMix;
        const currentPowerMix = resYr.powerProdMix;
        const currentHydroMix = resYr.hydrogenProdMix;

        // --- 3. Demand Tech Activity ---
        resYr.demandTechActivity = sectors.reduce((act, s) => {
            if (subsectors[s]) act[s] = subsectors[s].reduce((subAct, b) => {
                const techList = modelSafeGet(technologies, [s, b], []);
                subAct[b] = techList.reduce((techAct, t) => {
                    const mixVal = modelSafeGet(currentDemandMix, [s, b, t], 0);
                    const activityVal = modelSafeGet(currentActivity, [s, b], 0);
                    techAct[t] = (mixVal / 100) * activityVal;
                    return techAct;
                }, {});
                return subAct;
            }, {});
            return act;
        }, {});
        const currentDemandActivity = resYr.demandTechActivity;

        // --- 4. FEC & UE ---
        resYr.fecDetailed = {}; resYr.ueDetailed = {}; resYr.fecByFuel = {}; resYr.ueByFuel = {}; resYr.ueBySubsector = {};
        sectors.forEach(s => {
            if (subsectors[s]) {
                resYr.fecDetailed[s] = {}; resYr.ueDetailed[s] = {};
                subsectors[s].forEach(b => {
                    resYr.fecDetailed[s][b] = {}; resYr.ueDetailed[s][b] = {};
                    if (resYr.ueBySubsector[b] == null) resYr.ueBySubsector[b] = 0;
                    const techList = modelSafeGet(technologies, [s, b], []);
                    techList.forEach(t => {
                        resYr.fecDetailed[s][b][t] = {}; resYr.ueDetailed[s][b][t] = {};
                        const techAct = modelSafeGet(currentDemandActivity, [s, b, t], 0);
                        const unitConsData = modelSafeGet(unitEnergyConsumption, [s, b, t], {});
                        Object.entries(unitConsData).forEach(([f, unitCons]) => {
                            if (endUseFuels.includes(f)) {
                                const eCons = techAct * (unitCons || 0);
                                resYr.fecDetailed[s][b][t][f] = eCons;
                                resYr.fecByFuel[f] = (resYr.fecByFuel[f] || 0) + eCons;
                                let eff = modelSafeGet(placeholderUsefulEfficiency, [s, b, t, f], null);
                                if (eff == null) eff = modelSafeGet(placeholderUsefulEfficiency, [s, b, t], null);
                                if (eff == null) eff = modelSafeGet(placeholderUsefulEfficiency, [s, b], null);
                                if (eff == null && placeholderUsefulEfficiency) eff = placeholderUsefulEfficiency._default;
                                if (eff == null) eff = 0.65;
                                const uEnergy = eCons * eff;
                                resYr.ueDetailed[s][b][t][f] = uEnergy;
                                resYr.ueByFuel[f] = (resYr.ueByFuel[f] || 0) + uEnergy;
                                resYr.ueBySubsector[b] += uEnergy;
                            }
                        });
                    });
                });
            }
        });

        // --- 5. Hydrogen Transform ---
        const fecH2 = resYr.fecByFuel['Hydrogen'] || 0;
        const h2Inputs = {};
        hydrogenTechs.forEach(ht => {
            const mixFrac = modelSafeGet(currentHydroMix, [ht], 0) / 100;
            const h2Cons = modelSafeGet(hydrogenTechUnitEnergyCons, [ht], {});
            Object.entries(h2Cons).forEach(([f_in, uCons]) => {
                h2Inputs[f_in] = (h2Inputs[f_in] || 0) + fecH2 * mixFrac * (uCons || 0);
            });
        });
        resYr.ecPostHydrogen = Object.assign({}, resYr.fecByFuel);
        delete resYr.ecPostHydrogen['Hydrogen'];
        Object.entries(h2Inputs).forEach(([f, dem]) => { if (dem > 1e-3) resYr.ecPostHydrogen[f] = (resYr.ecPostHydrogen[f] || 0) + dem; });

        // --- 6. Power Transform ---
        const ecElec = resYr.ecPostHydrogen['Electricity'] || 0;
        const powerInputs = {};
        powerTechs.forEach(pt => {
            const mixFrac = modelSafeGet(currentPowerMix, [pt], 0) / 100;
            const powerCons = modelSafeGet(powerTechUnitEnergyCons, [pt], {});
            Object.entries(powerCons).forEach(([f_in, uCons]) => {
                powerInputs[f_in] = (powerInputs[f_in] || 0) + ecElec * mixFrac * (uCons || 0);
            });
        });
        resYr.ecPostPower = Object.assign({}, resYr.ecPostHydrogen);
        delete resYr.ecPostPower['Electricity'];
        Object.entries(powerInputs).forEach(([f, dem]) => { if (dem > 1e-3) resYr.ecPostPower[f] = (resYr.ecPostPower[f] || 0) + dem; });

        // --- 7. Other Transforms ---
        const otherInputs = {};
        Object.entries(otherConvTechs).forEach(([f_endUse, techs]) => {
             const demandConvert = resYr.ecPostPower[f_endUse] || 0;
             if (demandConvert > 1e-3) {
                 const baseMix = modelSafeGet(baseOtherProdMix, [f_endUse], {});
                 techs.forEach(ot => {
                     const mixFrac = (baseMix && Object.prototype.hasOwnProperty.call(baseMix, ot) ? baseMix[ot] : 0) / 100;
                     const otherCons = modelSafeGet(otherTechUnitEnergyCons, [f_endUse, ot], {});
                     Object.entries(otherCons).forEach(([p_primary, uCons]) => {
                         if (primaryFuels.includes(p_primary)) {
                             otherInputs[p_primary] = (otherInputs[p_primary] || 0) + demandConvert * mixFrac * (uCons || 0);
                         }
                     });
                 });
             }
        });

        // --- 8. PED ---
        resYr.pedByFuel = Object.assign({}, otherInputs);
        Object.entries(resYr.ecPostPower).forEach(([f, dem]) => {
             if (primaryFuels.includes(f) && !(f in otherConvTechs) && dem > 1e-3) {
                resYr.pedByFuel[f] = (resYr.pedByFuel[f] || 0) + dem;
             }
        });

    } // End year loop

    console.log("Model calculation complete.");
    return results;
}
