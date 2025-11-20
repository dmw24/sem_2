// js/uiController.js
// Version: Added Steepness k AND Midpoint Year t0 Inputs for S-Curve

// --- UI Helper Functions ---
function toggleGroup(el) {
    let content = el.nextElementSibling;
    if (!content || (!content.classList.contains('group-content') && !content.classList.contains('sub-group-content'))) {
        console.warn("Could not find content sibling for toggle element:", el);
        return;
    }
    // Toggle the 'expanded' class on both the title and the content
    el.classList.toggle("expanded");
    el.classList.toggle("collapsed");
    content.classList.toggle("expanded");
}
function sanitizeForId(str) { /* ... (unchanged) ... */
    if (typeof str !== 'string') str = String(str); let sanitized = str.replace(/[^a-zA-Z0-9_-]/g, '_'); sanitized = sanitized.replace(/__+/g, '_'); sanitized = sanitized.replace(/^_+|_+$/g, ''); if (/^\d/.test(sanitized)) { sanitized = 'id_' + sanitized; } return sanitized || 'invalid_id';
}
function toggleSCurveInputs(selectElement, paramKey) {
    const containerId = `sCurveInputs_${sanitizeForId(paramKey)}`;
    const container = document.getElementById(containerId);
    if (container) {
        const isVisible = selectElement.value === 's-curve';
        container.style.display = isVisible ? 'block' : 'none';
        container.classList.toggle('visible', isVisible);

        // Force resize of Visual Editor if it exists and is becoming visible
        if (isVisible && container._visualEditor) {
            // Small timeout to allow display:block to take effect and layout to settle
            setTimeout(() => {
                container._visualEditor.resize();
            }, 10);
        }
    }

    // Trigger auto-recalculation when behavior changes
    if (typeof debouncedAutoRecalc === 'function') {
        debouncedAutoRecalc();
    }
}

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

    // Hidden inputs to store values for form submission/model reading
    const createHiddenInput = (id, value) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.id = id;
        input.value = value;
        return input;
    };

    const targetInputId = `sCurveTarget_${sanitizedParamKey}`;
    const targetYearInputId = `sCurveTargetYear_${sanitizedParamKey}`;
    const kValueInputId = `sCurveKValue_${sanitizedParamKey}`;
    const midpointYearInputId = `sCurveMidpointYear_${sanitizedParamKey}`;

    // Default Values
    const defaultTargetShare = Math.min(100, Math.max(0, baseValue + 5));
    const defaultTargetYear = uiEndYear;
    const defaultK = 0.15;
    const defaultMidpoint = Math.round(uiStartYear + (defaultTargetYear - uiStartYear) / 2);

    const targetInput = createHiddenInput(targetInputId, defaultTargetShare);
    const targetYearInput = createHiddenInput(targetYearInputId, defaultTargetYear);
    const kValueInput = createHiddenInput(kValueInputId, defaultK);
    const midpointYearInput = createHiddenInput(midpointYearInputId, defaultMidpoint);

    div.appendChild(targetInput);
    div.appendChild(targetYearInput);
    div.appendChild(kValueInput);
    div.appendChild(midpointYearInput);

    // Container for Visual Editor
    const editorContainer = document.createElement('div');
    div.appendChild(editorContainer);

    // Initialize Visual Editor
    // We need to wait for the element to be in the DOM for correct sizing, 
    // but we can instantiate it. The ResizeObserver in the class handles the rest.
    const params = {
        targetShare: defaultTargetShare,
        targetYear: defaultTargetYear,
        kValue: defaultK,
        midpointYear: defaultMidpoint,
        startYear: uiStartYear,
        endYear: uiEndYear,
        baseValue: baseValue
    };

    const onChange = (newParams) => {
        targetInput.value = newParams.targetShare;
        targetYearInput.value = newParams.targetYear;
        kValueInput.value = newParams.kValue;
        midpointYearInput.value = newParams.midpointYear;

        // Trigger auto-recalculation after parameter change
        if (typeof debouncedAutoRecalc === 'function') {
            debouncedAutoRecalc();
        }
    };

    // Defer instantiation slightly to ensure container is ready if needed, 
    // though the class handles it.
    setTimeout(() => {
        try {
            const editor = new VisualSCurveEditor(editorContainer, params, onChange);
            // Store instance on the parent container so we can access it in toggleSCurveInputs
            div._visualEditor = editor;
        } catch (e) {
            console.error("Failed to initialize VisualSCurveEditor:", e);
            editorContainer.innerHTML = '<p style="color:red; font-size:0.8em;">Error loading visual editor.</p>';
        }
    }, 0);

    return div;
};

/**
 * Creates the HTML elements for a single technology's behavior controls.
 * (Unchanged from previous version, relies on createSCurveParamInputs)
 */
const createTechInput = (categoryType, categoryKey, tech, baseMixObject) => { /* ... (unchanged) ... */
    const container = document.createElement('div'); container.className = 'tech-input-container'; const legend = document.createElement('legend'); legend.textContent = tech; container.appendChild(legend); const paramKey = `${categoryType}|${categoryKey}|${tech}`; const sanitizedParamKey = sanitizeForId(paramKey); const baseValue = (typeof getValue === 'function') ? getValue(baseMixObject, [tech], 0) : (baseMixObject?.[tech] || 0); const behaviorDiv = document.createElement('div'); behaviorDiv.className = 'tech-behavior-selector'; const behaviorLabel = document.createElement('label'); behaviorLabel.htmlFor = `behavior_${sanitizedParamKey}`; behaviorLabel.textContent = 'Behavior: '; const behaviorSelect = document.createElement('select'); behaviorSelect.id = `behavior_${sanitizedParamKey}`; behaviorSelect.onchange = () => toggleSCurveInputs(behaviorSelect, paramKey);['Fixed', 'S-Curve (Growth)', 'Decline'].forEach(opt => { const option = document.createElement('option'); option.value = opt.toLowerCase().split(' ')[0]; option.textContent = opt; behaviorSelect.appendChild(option); }); let defaultBehavior = 'fixed'; const fullCatKey = categoryKey; if ((categoryType === 'Demand' && defaultDeclineDemandTechsUI[fullCatKey] === tech) || (categoryType === 'Power' && defaultDeclinePowerTechsUI.includes(tech)) || (categoryType === 'Hydrogen' && defaultDeclineHydrogenTechsUI.includes(tech))) { defaultBehavior = 'decline'; } else if ((categoryType === 'Demand' && defaultSCurveDemandTechsUI[fullCatKey] === tech) || (categoryType === 'Power' && defaultSCurvePowerTechsUI.includes(tech)) || (categoryType === 'Hydrogen' && defaultSCurveHydrogenTechsUI.includes(tech))) { defaultBehavior = 's-curve'; } behaviorSelect.value = defaultBehavior; behaviorDiv.appendChild(behaviorLabel); behaviorDiv.appendChild(behaviorSelect); container.appendChild(behaviorDiv); const sCurveInputsDiv = createSCurveParamInputs(paramKey, baseValue); container.appendChild(sCurveInputsDiv); setTimeout(() => toggleSCurveInputs(behaviorSelect, paramKey), 0); return container;
};


// --- UI Initialization ---
function initializeSidebarInputs(structuredData) { /* ... (unchanged, uses updated createTechInput) ... */
    console.log("Initializing sidebar inputs..."); const sidebarInputContainer = document.getElementById('inputGroupsContainer'); if (!sidebarInputContainer) { console.error("Sidebar input container (#inputGroupsContainer) not found!"); return; } sidebarInputContainer.innerHTML = ''; const { sectors, subsectors, technologies, baseDemandTechMix, basePowerProdMix, baseHydrogenProdMix, powerTechs, hydrogenTechs } = structuredData; const safeGetValue = (typeof getValue === 'function') ? getValue : (obj, keys, def) => (obj?.[keys[0]]?.[keys[1]] ?? def);

    sectors.forEach(s => {
        if (s === 'Power' || s === 'Energy industry') return;
        const sectorGroup = document.createElement('div'); sectorGroup.className = 'group';
        const sectorTitle = document.createElement('h3'); sectorTitle.className = 'group-title collapsed'; sectorTitle.textContent = s;
        sectorTitle.onclick = function () { toggleGroup(this); };

        const sectorContent = document.createElement('div'); sectorContent.className = 'group-content';
        const sectorContentInner = document.createElement('div'); sectorContentInner.className = 'group-content-inner'; // Wrapper for animation

        (subsectors[s] || []).forEach(b => {
            const subGroup = document.createElement('div'); subGroup.className = 'sub-group';
            const subTitle = document.createElement('h4'); subTitle.className = 'sub-group-title collapsed'; subTitle.textContent = b;
            subTitle.onclick = function () { toggleGroup(this); };

            const subContent = document.createElement('div'); subContent.className = 'sub-group-content';
            const subContentInner = document.createElement('div'); subContentInner.className = 'sub-group-content-inner'; // Wrapper for animation

            const activityDiv = document.createElement('div'); activityDiv.className = 'activity-growth-input';
            activityDiv.style.display = 'flex';
            activityDiv.style.flexDirection = 'column';
            activityDiv.style.gap = '5px';
            activityDiv.style.marginBottom = '10px';

            // Period 1: Today - 2035
            const p1Container = document.createElement('div');
            p1Container.style.display = 'flex';
            p1Container.style.justifyContent = 'space-between';
            p1Container.style.alignItems = 'center';
            const p1Label = document.createElement('label');
            const p1InputId = `growth_p1_${sanitizeForId(s)}_${sanitizeForId(b)}`;
            p1Label.htmlFor = p1InputId;
            p1Label.textContent = `Activity CAGR to 2035, %/yr:`;
            p1Label.style.fontSize = '0.9em';
            p1Label.style.flex = '1';
            p1Label.style.minWidth = '200px';
            const p1Input = document.createElement('input');
            p1Input.type = 'number';
            p1Input.id = p1InputId;
            p1Input.value = '0.5';
            p1Input.step = '0.1';
            p1Input.style.width = '80px';
            p1Input.style.flexShrink = '0';
            // Add auto-recalc on input change
            p1Input.addEventListener('change', () => {
                if (typeof debouncedAutoRecalc === 'function') {
                    debouncedAutoRecalc();
                }
            });
            p1Container.appendChild(p1Label);
            p1Container.appendChild(p1Input);

            // Period 2: 2035 - 2050
            const p2Container = document.createElement('div');
            p2Container.style.display = 'flex';
            p2Container.style.justifyContent = 'space-between';
            p2Container.style.alignItems = 'center';
            const p2Label = document.createElement('label');
            const p2InputId = `growth_p2_${sanitizeForId(s)}_${sanitizeForId(b)}`;
            p2Label.htmlFor = p2InputId;
            p2Label.textContent = `Activity CAGR 2035 onwards, %/yr:`;
            p2Label.style.fontSize = '0.9em';
            p2Label.style.flex = '1';
            p2Label.style.minWidth = '200px';
            const p2Input = document.createElement('input');
            p2Input.type = 'number';
            p2Input.id = p2InputId;
            p2Input.value = '0.5';
            p2Input.step = '0.1';
            p2Input.style.width = '80px';
            p2Input.style.flexShrink = '0';
            // Add auto-recalc on input change
            p2Input.addEventListener('change', () => {
                if (typeof debouncedAutoRecalc === 'function') {
                    debouncedAutoRecalc();
                }
            });
            p2Container.appendChild(p2Label);
            p2Container.appendChild(p2Input);

            activityDiv.appendChild(p1Container);
            activityDiv.appendChild(p2Container);
            subContentInner.appendChild(activityDiv);

            const techs = technologies[s]?.[b] || [];
            const baseMix = safeGetValue(baseDemandTechMix, [s, b], {});
            techs.forEach(t => { subContentInner.appendChild(createTechInput('Demand', `${s}|${b}`, t, baseMix)); });

            subContent.appendChild(subContentInner);
            subGroup.appendChild(subTitle); subGroup.appendChild(subContent);
            sectorContentInner.appendChild(subGroup);
        });

        sectorContent.appendChild(sectorContentInner);
        sectorGroup.appendChild(sectorTitle); sectorGroup.appendChild(sectorContent);
        sidebarInputContainer.appendChild(sectorGroup);
    });

    const powerGroup = document.createElement('div'); powerGroup.className = 'group';
    const powerTitle = document.createElement('h3'); powerTitle.className = 'group-title collapsed'; powerTitle.textContent = 'Power Generation';
    powerTitle.onclick = function () { toggleGroup(this); };
    const powerContent = document.createElement('div'); powerContent.className = 'group-content';
    const powerContentInner = document.createElement('div'); powerContentInner.className = 'group-content-inner';
    (powerTechs || []).forEach(t => { powerContentInner.appendChild(createTechInput('Power', 'Power', t, basePowerProdMix)); });
    powerContent.appendChild(powerContentInner);
    powerGroup.appendChild(powerTitle); powerGroup.appendChild(powerContent);
    sidebarInputContainer.appendChild(powerGroup);

    const hydrogenGroup = document.createElement('div'); hydrogenGroup.className = 'group';
    const hydrogenTitle = document.createElement('h3'); hydrogenTitle.className = 'group-title collapsed'; hydrogenTitle.textContent = 'Hydrogen Production';
    hydrogenTitle.onclick = function () { toggleGroup(this); };
    const hydrogenContent = document.createElement('div'); hydrogenContent.className = 'group-content';
    const hydrogenContentInner = document.createElement('div'); hydrogenContentInner.className = 'group-content-inner';
    (hydrogenTechs || []).forEach(t => { hydrogenContentInner.appendChild(createTechInput('Hydrogen', 'Hydrogen', t, baseHydrogenProdMix)); });
    hydrogenContent.appendChild(hydrogenContentInner);
    hydrogenGroup.appendChild(hydrogenTitle); hydrogenGroup.appendChild(hydrogenContent);
    sidebarInputContainer.appendChild(hydrogenGroup);

    console.log("Sidebar inputs initialized.");
}
function populateSubsectorDropdown(structuredData) { /* ... (unchanged) ... */
    const subsectorSelect = document.getElementById('selectSubsector'); if (!subsectorSelect) { console.error("Subsector select dropdown not found!"); return; } subsectorSelect.innerHTML = ''; const { allEndUseSubsectors } = structuredData; let firstSubsectorKey = null; if (!allEndUseSubsectors || allEndUseSubsectors.length === 0) { console.warn("No end-use subsectors found in data to populate dropdown."); const option = document.createElement('option'); option.value = ""; option.textContent = "No subsectors available"; subsectorSelect.appendChild(option); return; } allEndUseSubsectors.forEach(({ sector, subsector }) => { const option = document.createElement('option'); const key = `${sector}|${subsector}`; option.value = key; option.textContent = `${sector} - ${subsector}`; subsectorSelect.appendChild(option); if (!firstSubsectorKey) firstSubsectorKey = key; }); if (firstSubsectorKey) { subsectorSelect.value = firstSubsectorKey; const subsectorNameSpan = document.getElementById('selectedSubsectorName'); if (subsectorNameSpan) { const [selSector, selSubsector] = firstSubsectorKey.split('|'); subsectorNameSpan.textContent = `${selSector} - ${selSubsector}`; } } console.log("Subsector dropdown populated.");
}

function populateScenarioDropdown(structuredData) {
    const scenarioSelect = document.getElementById('selectScenario');
    if (!scenarioSelect) {
        console.error("Scenario select dropdown not found!");
        return;
    }

    const { scenarios } = structuredData;
    console.log('Inside populateScenarioDropdown, scenarios:', scenarios);
    if (!scenarios) {
        console.warn("No scenarios found in data.");
        return;
    }

    // Add Frozen Technology scenario (handled programmatically)
    const frozenOption = document.createElement('option');
    frozenOption.value = 'Frozen Technology';
    frozenOption.textContent = 'Frozen Technology';
    scenarioSelect.appendChild(frozenOption);
    console.log('Added Frozen Technology option');

    // Add scenarios from CSV
    Object.keys(scenarios).forEach(scenarioName => {
        const option = document.createElement('option');
        option.value = scenarioName;
        option.textContent = scenarioName;
        scenarioSelect.appendChild(option);
        console.log('Added scenario option:', scenarioName);
    });

    console.log("Scenario dropdown populated.");

    // Set default to Frozen Technology
    scenarioSelect.value = 'Frozen Technology';
    applyScenario('Frozen Technology', structuredData);
}

function applyScenario(scenarioName, structuredData) {
    console.log(`Applying scenario: ${scenarioName}`);

    const { scenarios, scenarioActivityGrowth, sectors, subsectors, technologies, powerTechs, hydrogenTechs } = structuredData;

    // Handle Frozen Technology (all fixed)
    if (scenarioName === 'Frozen Technology') {
        // Set all technologies to fixed behavior
        const setAllFixed = (categoryType, categoryKey, techList) => {
            (techList || []).forEach(t => {
                const paramKey = `${categoryType}|${categoryKey}|${t}`;
                const sanitizedParamKey = sanitizeForId(paramKey);
                const behaviorEl = document.getElementById(`behavior_${sanitizedParamKey}`);
                if (behaviorEl) {
                    behaviorEl.value = 'fixed';
                    toggleSCurveInputs(behaviorEl, paramKey);
                }
            });
        };

        sectors.forEach(s => {
            if (subsectors[s]) {
                subsectors[s].forEach(b => {
                    setAllFixed('Demand', `${s}|${b}`, technologies[s]?.[b] || []);
                });
            }
        });
        setAllFixed('Power', 'Power', powerTechs);
        setAllFixed('Hydrogen', 'Hydrogen', hydrogenTechs);

        console.log("Frozen Technology scenario applied (technologies fixed).");

        // Apply activity growth from CSV (same as other scenarios)
        if (scenarioActivityGrowth && scenarioActivityGrowth['Frozen Technology']) {
            const activityGrowthData = scenarioActivityGrowth['Frozen Technology'];

            sectors.forEach(s => {
                if (subsectors[s]) {
                    subsectors[s].forEach(b => {
                        const key = `${s}|${b}`;
                        const growth = activityGrowthData[key];

                        if (growth) {
                            const sId = sanitizeForId(s);
                            const bId = sanitizeForId(b);

                            const p1Input = document.getElementById(`growth_p1_${sId}_${bId}`);
                            const p2Input = document.getElementById(`growth_p2_${sId}_${bId}`);

                            // Convert growth factor to percentage
                            const p1Percent = ((growth.p1 - 1) * 100).toFixed(1);
                            const p2Percent = ((growth.p2 - 1) * 100).toFixed(1);

                            if (p1Input) p1Input.value = p1Percent;
                            if (p2Input) p2Input.value = p2Percent;

                            console.log(`Applied Frozen Technology activity growth for ${key}: p1=${p1Percent}%, p2=${p2Percent}%`);
                        }
                    });
                }
            });
        }
        return;
    }

    // Apply scenario from CSV
    const scenarioParams = scenarios[scenarioName];
    if (!scenarioParams) {
        console.error(`Scenario '${scenarioName}' not found in data.`);
        return;
    }

    // Apply technology parameters
    Object.entries(scenarioParams).forEach(([paramKey, params]) => {
        const sanitizedParamKey = sanitizeForId(paramKey);
        const behaviorEl = document.getElementById(`behavior_${sanitizedParamKey}`);

        if (behaviorEl) {
            behaviorEl.value = params.behavior;
            toggleSCurveInputs(behaviorEl, paramKey);

            if (params.behavior === 's-curve' || params.behavior === 'decline') {
                // Update hidden inputs
                const targetEl = document.getElementById(`sCurveTarget_${sanitizedParamKey}`);
                const targetYearEl = document.getElementById(`sCurveTargetYear_${sanitizedParamKey}`);
                const kValueEl = document.getElementById(`sCurveKValue_${sanitizedParamKey}`);
                const midpointYearEl = document.getElementById(`sCurveMidpointYear_${sanitizedParamKey}`);

                if (targetEl) targetEl.value = params.targetShare;
                if (targetYearEl) targetYearEl.value = params.targetYear;
                if (kValueEl) kValueEl.value = params.kValue;
                if (midpointYearEl) midpointYearEl.value = params.midpointYear;

                // Update visual editor
                const sCurveInputsDiv = document.getElementById(`sCurveInputs_${sanitizedParamKey}`);
                if (sCurveInputsDiv && sCurveInputsDiv._visualEditor) {
                    const editor = sCurveInputsDiv._visualEditor;
                    editor.params.targetShare = params.targetShare;
                    editor.params.targetYear = params.targetYear;
                    editor.params.kValue = params.kValue;
                    editor.params.midpointYear = params.midpointYear;
                    editor.kSlider.value = params.kValue;
                    editor.draw();
                }
            }
        }
    });

    // Apply activity growth factors
    if (scenarioActivityGrowth && scenarioActivityGrowth[scenarioName]) {
        const activityGrowthData = scenarioActivityGrowth[scenarioName];

        sectors.forEach(s => {
            if (subsectors[s]) {
                subsectors[s].forEach(b => {
                    const key = `${s}|${b}`;
                    const growth = activityGrowthData[key];

                    if (growth) {
                        const sId = sanitizeForId(s);
                        const bId = sanitizeForId(b);

                        const p1Input = document.getElementById(`growth_p1_${sId}_${bId}`);
                        const p2Input = document.getElementById(`growth_p2_${sId}_${bId}`);

                        // Convert growth factor to percentage
                        // e.g., 1.010 -> 1.0%, 1.026 -> 2.6%
                        const p1Percent = ((growth.p1 - 1) * 100).toFixed(1);
                        const p2Percent = ((growth.p2 - 1) * 100).toFixed(1);

                        if (p1Input) p1Input.value = p1Percent;
                        if (p2Input) p2Input.value = p2Percent;

                        console.log(`Applied activity growth for ${key}: p1=${p1Percent}%, p2=${p2Percent}%`);
                    }
                });
            }
        });
    } else {
        console.warn(`No activity growth data found for scenario '${scenarioName}'. Using current input values.`);
    }

    console.log(`Scenario '${scenarioName}' applied.`);
}

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
    (allEndUseSubsectors || []).forEach(({ sector, subsector }) => {
        const sId = sanitizeForId(sector);
        const bId = sanitizeForId(subsector);

        const p1InputId = `growth_p1_${sId}_${bId}`;
        const p2InputId = `growth_p2_${sId}_${bId}`;

        const p1Element = document.getElementById(p1InputId);
        const p2Element = document.getElementById(p2InputId);

        const p1Percent = p1Element ? parseFloat(p1Element.value) : 0;
        const p2Percent = p2Element ? parseFloat(p2Element.value) : 0;

        const p1Factor = isNaN(p1Percent) ? 1.0 : 1 + (p1Percent / 100);
        const p2Factor = isNaN(p2Percent) ? 1.0 : 1 + (p2Percent / 100);

        userInputParameters.activityGrowthFactors[`${sector}|${subsector}`] = {
            p1: p1Factor,
            p2: p2Factor
        };
    });

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
    sectors.forEach(s => { if (subsectors[s]) { subsectors[s].forEach(b => { readTechInputs('Demand', `${s}|${b}`, technologies[s]?.[b] || []); }); } });
    readTechInputs('Power', 'Power', powerTechs);
    readTechInputs('Hydrogen', 'Hydrogen', hydrogenTechs);

    return userInputParameters;
}


// --- Debounce Helper for Auto-Recalculation ---
let recalcDebounceTimer = null;

function debounceRecalc(callback, delay = 1000) {
    return function () {
        clearTimeout(recalcDebounceTimer);
        recalcDebounceTimer = setTimeout(callback, delay);
    };
}

function triggerAutoRecalc() {
    const runButton = document.getElementById('runModelBtn');
    if (runButton && !runButton.disabled) {
        console.log("Auto-triggering recalculation...");
        runButton.click();
    }
}

// Debounced version - will wait 1 second after last input change before recalculating
const debouncedAutoRecalc = debounceRecalc(triggerAutoRecalc, 1000);

// --- Event Listener Setup ---
function handleChartViewChange() {
    const chartViewSelect = document.getElementById('selectChartView');
    const subsectorSelectorDiv = document.getElementById('subsectorSelector');
    const subsectorChartsSection = document.getElementById('subsectorChartsSection');
    const balanceChartsSection = document.getElementById('balanceChartsSection');
    const supplyChartsSection = document.getElementById('supplyChartsSection');
    const emissionsChartsSection = document.getElementById('emissionsChartsSection');
    const deltaChartsSection = document.getElementById('deltaChartsSection');
    const sankeySection = document.getElementById('sankeySection');
    const sankeyControls = document.getElementById('sankeyControls');

    if (!chartViewSelect || !subsectorSelectorDiv || !subsectorChartsSection || !balanceChartsSection || !supplyChartsSection || !emissionsChartsSection) {
        console.error("One or more chart view elements not found!");
        return;
    }

    const selectedView = chartViewSelect.value;

    // Toggle Visibility
    if (selectedView === 'subsector') {
        subsectorSelectorDiv.classList.remove('hidden');
    } else {
        subsectorSelectorDiv.classList.add('hidden');
    }

    subsectorChartsSection.classList.toggle('hidden', selectedView !== 'subsector');
    balanceChartsSection.classList.toggle('hidden', selectedView !== 'balance');
    supplyChartsSection.classList.toggle('hidden', selectedView !== 'supply');
    emissionsChartsSection.classList.toggle('hidden', selectedView !== 'emissions');
    if (deltaChartsSection) deltaChartsSection.classList.toggle('hidden', selectedView !== 'deltas');
    if (sankeySection) sankeySection.classList.toggle('hidden', selectedView !== 'sankey');
    if (sankeyControls) sankeyControls.classList.toggle('hidden', selectedView !== 'sankey');

    console.log(`Chart view changed to: ${selectedView}`);

    // Trigger update if needed (e.g. if switching to Sankey, render it)
    // We need access to appState here, but this function is standalone.
    // We'll rely on the main update loop or a global trigger if needed, 
    // OR we can trigger a custom event.
    // For now, let's assume the user will click Run or the main loop handles it.
    // BETTER: Dispatch an event that main.js can listen to.
    document.dispatchEvent(new CustomEvent('chartViewChanged', { detail: { view: selectedView } }));
}

function setupEventListeners(appState) {
    const runButton = document.getElementById('runModelBtn');
    const subsectorSelect = document.getElementById('selectSubsector');
    const chartViewSelect = document.getElementById('selectChartView');
    const sankeyYearSlider = document.getElementById('sankeyYearSlider');
    const sankeyYearDisplay = document.getElementById('sankeyYearDisplay');
    const scenarioSelect = document.getElementById('selectScenario');

    const { structuredData } = appState;

    if (!structuredData) {
        console.error("Cannot setup event listeners: structuredData is missing.");
        return;
    }
    if (!runButton) {
        console.error("Run Model button not found!");
        return;
    }

    runButton.onclick = async () => {
        runButton.disabled = true;
        runButton.textContent = 'Calculating...';
        console.log("Run button clicked...");
        try {
            const userInputs = getUserInputsAndParams(structuredData);
            if (typeof runModelCalculation !== 'function') {
                throw new Error("runModelCalculation function is not defined.");
            }
            const modelResults = await runModelCalculation(structuredData, userInputs);
            appState.latestResults = modelResults;

            // Update all charts
            if (typeof updateCharts === 'function') {
                updateCharts(appState.latestResults, structuredData);
            }
            if (typeof updateEmissionsCharts === 'function') {
                updateEmissionsCharts(appState.latestResults, structuredData);
            }

            // Update delta charts
            if (typeof updateDeltaCharts === 'function') {
                updateDeltaCharts(appState.latestResults, structuredData);
            }

            // Update Sankey if visible
            if (chartViewSelect.value === 'sankey' && typeof renderSankey === 'function') {
                const year = parseInt(sankeyYearSlider.value, 10);
                renderSankey(appState.latestResults, year, structuredData);
            }

        } catch (error) {
            console.error("Error during model execution or chart update:", error);
            alert(`An error occurred: ${error.message}.`);
        } finally {
            runButton.disabled = false;
            runButton.textContent = 'Run Model & Update Charts';
        }
    };

    subsectorSelect.onchange = () => {
        console.log("Subsector selection changed.");
        if (typeof updateCharts !== 'function') {
            console.error("updateCharts function is not defined.");
            return;
        }
        if (appState.latestResults) {
            updateCharts(appState.latestResults, structuredData);
        } else {
            console.warn("No model results available for subsector change.");
        }
    };

    chartViewSelect.onchange = () => {
        handleChartViewChange();

        // Timeout to allow div to become visible before resizing
        // Increased to 100ms to ensure layout is stable
        setTimeout(() => {
            // Re-render Sankey if switched to it and data exists
            if (chartViewSelect.value === 'sankey' && appState.latestResults && typeof renderSankey === 'function') {
                const year = parseInt(sankeyYearSlider.value, 10);
                renderSankey(appState.latestResults, year, structuredData);
            }
            // Update delta charts if switched to deltas view
            else if (chartViewSelect.value === 'deltas' && appState.latestResults && typeof updateDeltaCharts === 'function') {
                updateDeltaCharts(appState.latestResults, structuredData);
                // Resize delta charts
                const deltaChartIds = ['pedDeltaChart', 'elecGenDeltaChart', 'fecDeltaChart', 'ueDeltaChart'];
                deltaChartIds.forEach(id => {
                    const element = document.getElementById(id);
                    if (element && element.data) {
                        Plotly.Plots.resize(element);
                    }
                });
            }
            // Resize balance charts
            else if (chartViewSelect.value === 'balance' && appState.latestResults) {
                const balanceChartIds = ['fecFuelChart', 'pedFuelChart', 'ueFuelChart'];
                balanceChartIds.forEach(id => {
                    const element = document.getElementById(id);
                    if (element && element.data) {
                        Plotly.Plots.resize(element);
                    }
                });
            }
            // Resize supply charts
            else if (chartViewSelect.value === 'supply' && appState.latestResults) {
                const supplyChartIds = ['powerMixChart', 'hydrogenMixChart'];
                supplyChartIds.forEach(id => {
                    const element = document.getElementById(id);
                    if (element && element.data) {
                        Plotly.Plots.resize(element);
                    }
                });
            }
            // Resize emissions charts
            else if (chartViewSelect.value === 'emissions' && appState.latestResults) {
                const emissionChartIds = ['globalEmissionsChart', 'ccsBySubsectorChart'];
                emissionChartIds.forEach(id => {
                    const element = document.getElementById(id);
                    if (element && element.data) {
                        Plotly.Plots.resize(element);
                    }
                });
            }
            // Resize subsector charts
            else if (chartViewSelect.value === 'subsector' && appState.latestResults) {
                const subsectorChartIds = ['subsectorActivityChart', 'subsectorFecChart', 'subsectorUeChart'];
                subsectorChartIds.forEach(id => {
                    const element = document.getElementById(id);
                    if (element && element.data) {
                        Plotly.Plots.resize(element);
                    }
                });
            }
        }, 100);
    };

    if (sankeyYearSlider) {
        sankeyYearSlider.oninput = (e) => {
            const year = e.target.value;
            if (sankeyYearDisplay) sankeyYearDisplay.textContent = year;
            if (appState.latestResults && typeof renderSankey === 'function') {
                renderSankey(appState.latestResults, parseInt(year, 10), structuredData);
            }
        };
    }

    const toggleSubsectors = document.getElementById('toggleSubsectors');
    if (toggleSubsectors) {
        toggleSubsectors.onchange = () => {
            if (appState.latestResults && typeof renderSankey === 'function') {
                const year = parseInt(sankeyYearSlider.value, 10);
                renderSankey(appState.latestResults, year, structuredData);
            }
        };
    }

    if (scenarioSelect) {
        scenarioSelect.onchange = (e) => {
            const scenarioName = e.target.value;
            if (scenarioName) {
                applyScenario(scenarioName, structuredData);
                // Trigger auto-recalc after scenario applied
                if (typeof debouncedAutoRecalc === 'function') {
                    debouncedAutoRecalc();
                }
            }
        };
    }

    handleChartViewChange();
    console.log("UI Event listeners set up.");
}
