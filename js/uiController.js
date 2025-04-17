// js/uiController.js
// Version: Added Steepness k AND Midpoint Year t0 Inputs for S-Curve

// --- UI Helper Functions ---
function toggleGroup(el) { /* ... (unchanged) ... */
    let content = el.nextElementSibling; if (!content || (!content.classList.contains('group-content') && !content.classList.contains('sub-group-content'))) { console.warn("Could not find content sibling for toggle element:", el); return; } if (content.style.display === "none" || content.style.display === "") { content.style.display = "block"; el.classList.remove("collapsed"); el.classList.add("expanded"); } else { content.style.display = "none"; el.classList.remove("expanded"); el.classList.add("collapsed"); } }
function sanitizeForId(str) { /* ... (unchanged) ... */
    if (typeof str !== 'string') str = String(str); let sanitized = str.replace(/[^a-zA-Z0-9_-]/g, '_'); sanitized = sanitized.replace(/__+/g, '_'); sanitized = sanitized.replace(/^_+|_+$/g, ''); if (/^\d/.test(sanitized)) { sanitized = 'id_' + sanitized; } return sanitized || 'invalid_id'; }
function toggleSCurveInputs(selectElement, paramKey) { /* ... (unchanged) ... */
    const containerId = `sCurveInputs_${sanitizeForId(paramKey)}`; const container = document.getElementById(containerId); if (container) { const isVisible = selectElement.value === 's-curve'; container.style.display = isVisible ? 'block' : 'none'; container.classList.toggle('visible', isVisible); } }

// --- Dynamic Input Creation Helpers ---
// Default behavior mappings (needed for setting initial UI state)
const defaultDeclineDemandTechsUI = { /* ... (unchanged) ... */ 'Transport|Passenger cars': 'ICE', 'Transport|Trucks': 'ICE', 'Transport|Buses': 'ICE', 'Transport|2/3 wheelers': 'ICE', 'Transport|Ships': 'Conventional ship', 'Transport|Planes': 'Conventional plane', 'Transport|Trains': 'Diesel train', 'Industry|Steel': 'BF-BOF', 'Industry|Cement': 'Conventional kiln', 'Industry|Chemicals': 'Conventional', 'Industry|Low temp. heating': 'Fossil boiler', 'Industry|High temp. heating': 'Fossil furnace', 'Industry|Other industry - energy': 'Conventional', 'Buildings|Residential heating': 'Fossil boiler', 'Buildings|Residential cooking': 'Conventional fossil', 'Buildings|Residential lighting': 'Conventional', 'Buildings|Other residential': 'Conventional', 'Buildings|Building cooling': 'Low efficiency airco', 'Buildings|Commercial heating': 'Fossil boiler', 'Buildings|Commercial lighting': 'Conventional', 'Buildings|Other commercial': 'Conventional', 'Transport|Other transport': 'Conventional' };
const defaultSCurveDemandTechsUI = { /* ... (unchanged) ... */ 'Transport|Passenger cars': 'EV', 'Transport|Trucks': 'EV', 'Transport|Buses': 'EV', 'Transport|2/3 wheelers': 'EV', 'Transport|Ships': 'Ammonia ship', 'Transport|Planes': 'Electric plane', 'Transport|Trains': 'Electric train', 'Industry|Steel': 'DRI-EAF (H2)', 'Industry|Cement': 'Electric kiln', 'Industry|Chemicals': 'Electrified', 'Industry|Low temp. heating': 'Heat pump', 'Industry|High temp. heating': 'Electric furnace', 'Industry|Other industry - energy': 'Electrified', 'Buildings|Residential heating': 'Heat pump', 'Buildings|Residential cooking': 'Electrified', 'Buildings|Residential lighting': 'Full LED', 'Buildings|Other residential': 'Electrified', 'Buildings|Building cooling': 'High efficiency airco', 'Buildings|Commercial heating': 'Heat pump', 'Buildings|Commercial lighting': 'Full LED', 'Buildings|Other commercial': 'Electrified', 'Transport|Other transport': 'Electrified' };
const defaultDeclinePowerTechsUI = ['Gas power', 'Coal power', 'Oil power'];
const defaultSCurvePowerTechsUI = ['Solar PV', 'Wind'];
const defaultDeclineHydrogenTechsUI = ['Blue'];
const defaultSCurveHydrogenTechsUI = ['Green'];
const uiStartYear = 2023; const uiEndYear = 2050;

/**
 * Creates the HTML elements for S-curve parameters (Target Share, Target Year, Steepness k, Midpoint Year t0).
 * @param {string} paramKey - Unique identifier for the parameter set.
 * @param {number} baseValue - The base year share value (%) for default target.
 * @returns {HTMLDivElement} The container div with the input elements.
 */
const createSCurveParamInputs = (paramKey, baseValue) => {
    const div = document.createElement('div');
    div.className = 's-curve-inputs';
    const sanitizedParamKey = sanitizeForId(paramKey);
    div.id = `sCurveInputs_${sanitizedParamKey}`;

    const targetInputId = `sCurveTarget_${sanitizedParamKey}`;
    const targetYearInputId = `sCurveTargetYear_${sanitizedParamKey}`;
    const kValueInputId = `sCurveKValue_${sanitizedParamKey}`;
    const midpointYearInputId = `sCurveMidpointYear_${sanitizedParamKey}`; // t0 input ID

    // Target Share Input
    const targetLabel = document.createElement('label'); targetLabel.htmlFor = targetInputId; targetLabel.textContent = `Target Share (%):`;
    const targetInput = document.createElement('input'); targetInput.type = 'number'; targetInput.id = targetInputId; targetInput.min = '0'; targetInput.max = '100'; targetInput.step = '1'; targetInput.value = Math.min(100, Math.max(0, baseValue + 5)).toFixed(1);
    div.appendChild(targetLabel); div.appendChild(targetInput);

    // Target Year Input
    const targetYearLabel = document.createElement('label'); targetYearLabel.htmlFor = targetYearInputId; targetYearLabel.textContent = `Target Year:`;
    const targetYearInput = document.createElement('input'); targetYearInput.type = 'number'; targetYearInput.id = targetYearInputId; targetYearInput.min = String(uiStartYear + 1); targetYearInput.max = String(uiEndYear + 10); targetYearInput.step = '1'; targetYearInput.value = String(uiEndYear);
    div.appendChild(targetYearLabel); div.appendChild(targetYearInput);

    // Steepness (k) Input
    const kValueLabel = document.createElement('label'); kValueLabel.htmlFor = kValueInputId; kValueLabel.textContent = `Steepness (k):`;
    const kValueInput = document.createElement('input'); kValueInput.type = 'number'; kValueInput.id = kValueInputId; kValueInput.min = '0.01'; kValueInput.max = '1.0'; kValueInput.step = '0.01'; kValueInput.value = '0.15'; // Default k
    div.appendChild(kValueLabel); div.appendChild(kValueInput);
    const kValueHelp = document.createElement('small'); kValueHelp.textContent = "Controls growth rate (e.g., 0.1 ≈ 10%/yr initial relative growth).";
    div.appendChild(kValueHelp);

    // Midpoint Year (t0) Input
    const midpointYearLabel = document.createElement('label'); midpointYearLabel.htmlFor = midpointYearInputId; midpointYearLabel.textContent = `Midpoint Year (t0):`;
    const midpointYearInput = document.createElement('input'); midpointYearInput.type = 'number'; midpointYearInput.id = midpointYearInputId; midpointYearInput.min = String(uiStartYear - 10); // Allow midpoint before start year
    midpointYearInput.max = String(uiEndYear + 10); // Allow midpoint after target year
    midpointYearInput.step = '1';
    const defaultMidpoint = Math.round(uiStartYear + (parseInt(targetYearInput.value, 10) - uiStartYear) / 2); // Default halfway
    midpointYearInput.value = String(defaultMidpoint);
    div.appendChild(midpointYearLabel); div.appendChild(midpointYearInput);
    const midpointHelp = document.createElement('small');
    midpointHelp.textContent = "Year when growth is fastest (where curve reaches half its total change).";
    div.appendChild(midpointHelp);


    return div;
};

/**
 * Creates the HTML elements for a single technology's behavior controls.
 * (Unchanged from previous version, relies on createSCurveParamInputs)
 */
const createTechInput = (categoryType, categoryKey, tech, baseMixObject) => { /* ... (unchanged) ... */
    const container = document.createElement('div'); container.className = 'tech-input-container'; const legend = document.createElement('legend'); legend.textContent = tech; container.appendChild(legend); const paramKey = `${categoryType}|${categoryKey}|${tech}`; const sanitizedParamKey = sanitizeForId(paramKey); const baseValue = (typeof getValue === 'function') ? getValue(baseMixObject, [tech], 0) : (baseMixObject?.[tech] || 0); const behaviorDiv = document.createElement('div'); behaviorDiv.className = 'tech-behavior-selector'; const behaviorLabel = document.createElement('label'); behaviorLabel.htmlFor = `behavior_${sanitizedParamKey}`; behaviorLabel.textContent = 'Behavior: '; const behaviorSelect = document.createElement('select'); behaviorSelect.id = `behavior_${sanitizedParamKey}`; behaviorSelect.onchange = () => toggleSCurveInputs(behaviorSelect, paramKey); ['Fixed', 'S-Curve (Growth)', 'Decline'].forEach(opt => { const option = document.createElement('option'); option.value = opt.toLowerCase().split(' ')[0]; option.textContent = opt; behaviorSelect.appendChild(option); }); let defaultBehavior = 'fixed'; const fullCatKey = categoryKey; if ((categoryType === 'Demand' && defaultDeclineDemandTechsUI[fullCatKey] === tech) || (categoryType === 'Power' && defaultDeclinePowerTechsUI.includes(tech)) || (categoryType === 'Hydrogen' && defaultDeclineHydrogenTechsUI.includes(tech))) { defaultBehavior = 'decline'; } else if ((categoryType === 'Demand' && defaultSCurveDemandTechsUI[fullCatKey] === tech) || (categoryType === 'Power' && defaultSCurvePowerTechsUI.includes(tech)) || (categoryType === 'Hydrogen' && defaultSCurveHydrogenTechsUI.includes(tech))) { defaultBehavior = 's-curve'; } behaviorSelect.value = defaultBehavior; behaviorDiv.appendChild(behaviorLabel); behaviorDiv.appendChild(behaviorSelect); container.appendChild(behaviorDiv); const sCurveInputsDiv = createSCurveParamInputs(paramKey, baseValue); container.appendChild(sCurveInputsDiv); setTimeout(() => toggleSCurveInputs(behaviorSelect, paramKey), 0); return container; };


// --- UI Initialization ---
function initializeSidebarInputs(structuredData) { /* ... (unchanged, uses updated createTechInput) ... */
    console.log("Initializing sidebar inputs..."); const sidebarInputContainer = document.getElementById('inputGroupsContainer'); if (!sidebarInputContainer) { console.error("Sidebar input container (#inputGroupsContainer) not found!"); return; } sidebarInputContainer.innerHTML = ''; const { sectors, subsectors, technologies, baseDemandTechMix, basePowerProdMix, baseHydrogenProdMix, powerTechs, hydrogenTechs } = structuredData; const safeGetValue = (typeof getValue === 'function') ? getValue : (obj, keys, def) => (obj?.[keys[0]]?.[keys[1]] ?? def); sectors.forEach(s => { if (s === 'Power' || s === 'Energy industry') return; const sectorGroup = document.createElement('div'); sectorGroup.className = 'group'; const sectorTitle = document.createElement('h3'); sectorTitle.className = 'group-title collapsed'; sectorTitle.textContent = s; sectorTitle.onclick = function() { toggleGroup(this); }; const sectorContent = document.createElement('div'); sectorContent.className = 'group-content'; sectorContent.style.display = 'none'; (subsectors[s] || []).forEach(b => { const subGroup = document.createElement('div'); subGroup.className = 'sub-group'; const subTitle = document.createElement('h4'); subTitle.className = 'sub-group-title collapsed'; subTitle.textContent = b; subTitle.onclick = function() { toggleGroup(this); }; const subContent = document.createElement('div'); subContent.className = 'sub-group-content'; subContent.style.display = 'none'; const activityDiv = document.createElement('div'); activityDiv.className = 'activity-growth-input'; const activityLabel = document.createElement('label'); const activityInputId = `growth_${sanitizeForId(s)}_${sanitizeForId(b)}`; activityLabel.htmlFor = activityInputId; activityLabel.textContent = `Activity Growth (%/yr):`; const activityInput = document.createElement('input'); activityInput.type = 'number'; activityInput.id = activityInputId; activityInput.value = '0.5'; activityInput.step = '0.1'; activityDiv.appendChild(activityLabel); activityDiv.appendChild(activityInput); subContent.appendChild(activityDiv); const techs = technologies[s]?.[b] || []; const baseMix = safeGetValue(baseDemandTechMix, [s, b], {}); techs.forEach(t => { subContent.appendChild(createTechInput('Demand', `${s}|${b}`, t, baseMix)); }); subGroup.appendChild(subTitle); subGroup.appendChild(subContent); sectorContent.appendChild(subGroup); }); sectorGroup.appendChild(sectorTitle); sectorGroup.appendChild(sectorContent); sidebarInputContainer.appendChild(sectorGroup); }); const powerGroup = document.createElement('div'); powerGroup.className = 'group'; const powerTitle = document.createElement('h3'); powerTitle.className = 'group-title collapsed'; powerTitle.textContent = 'Power Generation'; powerTitle.onclick = function() { toggleGroup(this); }; const powerContent = document.createElement('div'); powerContent.className = 'group-content'; powerContent.style.display = 'none'; (powerTechs || []).forEach(t => { powerContent.appendChild(createTechInput('Power', 'Power', t, basePowerProdMix)); }); powerGroup.appendChild(powerTitle); powerGroup.appendChild(powerContent); sidebarInputContainer.appendChild(powerGroup); const hydrogenGroup = document.createElement('div'); hydrogenGroup.className = 'group'; const hydrogenTitle = document.createElement('h3'); hydrogenTitle.className = 'group-title collapsed'; hydrogenTitle.textContent = 'Hydrogen Production'; hydrogenTitle.onclick = function() { toggleGroup(this); }; const hydrogenContent = document.createElement('div'); hydrogenContent.className = 'group-content'; hydrogenContent.style.display = 'none'; (hydrogenTechs || []).forEach(t => { hydrogenContent.appendChild(createTechInput('Hydrogen', 'Hydrogen', t, baseHydrogenProdMix)); }); hydrogenGroup.appendChild(hydrogenTitle); hydrogenGroup.appendChild(hydrogenContent); sidebarInputContainer.appendChild(hydrogenGroup); console.log("Sidebar inputs initialized."); }
function populateSubsectorDropdown(structuredData) { /* ... (unchanged) ... */
    const subsectorSelect = document.getElementById('selectSubsector'); if (!subsectorSelect) { console.error("Subsector select dropdown not found!"); return; } subsectorSelect.innerHTML = ''; const { allEndUseSubsectors } = structuredData; let firstSubsectorKey = null; if (!allEndUseSubsectors || allEndUseSubsectors.length === 0) { console.warn("No end-use subsectors found in data to populate dropdown."); const option = document.createElement('option'); option.value = ""; option.textContent = "No subsectors available"; subsectorSelect.appendChild(option); return; } allEndUseSubsectors.forEach(({ sector, subsector }) => { const option = document.createElement('option'); const key = `${sector}|${subsector}`; option.value = key; option.textContent = `${sector} - ${subsector}`; subsectorSelect.appendChild(option); if (!firstSubsectorKey) firstSubsectorKey = key; }); if (firstSubsectorKey) { subsectorSelect.value = firstSubsectorKey; const subsectorNameSpan = document.getElementById('selectedSubsectorName'); if (subsectorNameSpan) { const [selSector, selSubsector] = firstSubsectorKey.split('|'); subsectorNameSpan.textContent = `${selSector} - ${selSubsector}`; } } console.log("Subsector dropdown populated."); }

// --- Input Gathering ---
/**
 * Reads the current values from all sidebar inputs.
 * @param {object} structuredData - The data object from dataLoader.js.
 * @returns {object} userInputParameters object for modelLogic.runModelCalculation.
 */
function getUserInputsAndParams(structuredData) {
    const {
        sectors, subsectors, technologies,
        powerTechs, hydrogenTechs, allEndUseSubsectors,
        startYear, endYear // Get years from structuredData
    } = structuredData;

    const userInputParameters = {
        activityGrowthFactors: {},
        techBehaviorsAndParams: {}
    };

    // Read Activity Growth Rates
    (allEndUseSubsectors || []).forEach(({ sector, subsector }) => { /* ... (unchanged) ... */
        const inputId = `growth_${sanitizeForId(sector)}_${sanitizeForId(subsector)}`; const inputElement = document.getElementById(inputId); const growthPercent = inputElement ? parseFloat(inputElement.value) : 0; const growthFactor = isNaN(growthPercent) ? 1.0 : 1 + (growthPercent / 100); userInputParameters.activityGrowthFactors[`${sector}|${subsector}`] = growthFactor; });

    // Read Technology Behaviors and S-Curve Parameters
    const readTechInputs = (categoryType, categoryKey, techList) => {
        (techList || []).forEach(t => {
            const paramKey = `${categoryType}|${categoryKey}|${t}`;
            const sanitizedParamKey = sanitizeForId(paramKey);
            const behaviorEl = document.getElementById(`behavior_${sanitizedParamKey}`);
            const behavior = behaviorEl ? behaviorEl.value : 'fixed';
            const techParams = { behavior: behavior };

            if (behavior === 's-curve') {
                const targetEl = document.getElementById(`sCurveTarget_${sanitizedParamKey}`);
                const targetYearEl = document.getElementById(`sCurveTargetYear_${sanitizedParamKey}`);
                // *** Read BOTH k and t0 ***
                const kValueEl = document.getElementById(`sCurveKValue_${sanitizedParamKey}`);
                const midpointYearEl = document.getElementById(`sCurveMidpointYear_${sanitizedParamKey}`);

                techParams.targetShare = targetEl ? parseFloat(targetEl.value) : 0;
                techParams.targetYear = targetYearEl ? parseInt(targetYearEl.value, 10) : endYear;
                techParams.kValue = kValueEl ? parseFloat(kValueEl.value) : 0.15; // Read k
                techParams.midpointYear = midpointYearEl ? parseInt(midpointYearEl.value, 10) : Math.round(startYear + (endYear - startYear) / 2); // Read t0

                // Basic validation/defaults
                if (isNaN(techParams.targetShare)) techParams.targetShare = 0;
                if (isNaN(techParams.targetYear)) techParams.targetYear = endYear;
                if (isNaN(techParams.kValue) || techParams.kValue <= 0) techParams.kValue = 0.15; // Ensure k is positive and non-zero
                if (isNaN(techParams.midpointYear)) {
                    techParams.midpointYear = Math.round(startYear + (techParams.targetYear - startYear) / 2); // Default halfway
                }
            }
            userInputParameters.techBehaviorsAndParams[paramKey] = techParams;
        });
    };

    // Read Demand, Power, Hydrogen Techs
    sectors.forEach(s => { if (subsectors[s]){ subsectors[s].forEach(b => { readTechInputs('Demand', `${s}|${b}`, technologies[s]?.[b] || []); }); } });
    readTechInputs('Power', 'Power', powerTechs);
    readTechInputs('Hydrogen', 'Hydrogen', hydrogenTechs);

    return userInputParameters;
}


// --- Event Listener Setup ---
function handleChartViewChange() { /* ... (unchanged) ... */
    const chartViewSelect = document.getElementById('selectChartView'); const subsectorSelectorDiv = document.getElementById('subsectorSelector'); const subsectorChartsSection = document.getElementById('subsectorChartsSection'); const balanceChartsSection = document.getElementById('balanceChartsSection'); const supplyChartsSection = document.getElementById('supplyChartsSection'); if (!chartViewSelect || !subsectorSelectorDiv || !subsectorChartsSection || !balanceChartsSection || !supplyChartsSection) { console.error("One or more chart view elements not found!"); return; } const selectedView = chartViewSelect.value; if (selectedView === 'subsector') { subsectorSelectorDiv.classList.remove('hidden'); } else { subsectorSelectorDiv.classList.add('hidden'); } subsectorChartsSection.classList.toggle('hidden', selectedView !== 'subsector'); balanceChartsSection.classList.toggle('hidden', selectedView !== 'balance'); supplyChartsSection.classList.toggle('hidden', selectedView !== 'supply'); console.log(`Chart view changed to: ${selectedView}`); }
function setupEventListeners(appState) { /* ... (unchanged, uses updated getUserInputsAndParams) ... */
    const runButton = document.getElementById('runModelBtn'); const subsectorSelect = document.getElementById('selectSubsector'); const chartViewSelect = document.getElementById('selectChartView'); const { structuredData } = appState; if (!structuredData) { console.error("Cannot setup event listeners: structuredData is missing."); return; } if (!runButton) { console.error("Run Model button not found!"); return; } if (!subsectorSelect) { console.error("Subsector select dropdown not found!"); return; } if (!chartViewSelect) { console.error("Chart view select dropdown not found!"); return; }
    runButton.onclick = async () => { runButton.disabled = true; runButton.textContent = 'Calculating...'; console.log("Run button clicked..."); try { const userInputs = getUserInputsAndParams(structuredData); if (typeof runModelCalculation !== 'function') { throw new Error("runModelCalculation function is not defined."); } const modelResults = await runModelCalculation(structuredData, userInputs); appState.latestResults = modelResults; if (typeof updateCharts !== 'function') { throw new Error("updateCharts function is not defined."); } updateCharts(appState.latestResults, structuredData); } catch (error) { console.error("Error during model execution or chart update:", error); alert(`An error occurred: ${error.message}.`); } finally { runButton.disabled = false; runButton.textContent = 'Run Model & Update Charts'; } };
    subsectorSelect.onchange = () => { console.log("Subsector selection changed."); if (typeof updateCharts !== 'function') { console.error("updateCharts function is not defined."); return; } if (appState.latestResults) { updateCharts(appState.latestResults, structuredData); } else { console.warn("No model results available for subsector change."); } };
    chartViewSelect.onchange = handleChartViewChange; handleChartViewChange(); console.log("UI Event listeners set up."); }

