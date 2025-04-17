// js/uiController.js

// --- UI Helper Functions --- (Copied/adapted from reference)

/**
 * Toggles the display of collapsible group content.
 * @param {HTMLElement} el - The title element (h3 or h4) that was clicked.
 */
function toggleGroup(el) {
    let content = el.nextElementSibling;
    // Ensure the sibling is the content div we expect
    if (!content || (!content.classList.contains('group-content') && !content.classList.contains('sub-group-content'))) {
        console.warn("Could not find content sibling for toggle element:", el);
        return;
    }
    // Toggle display and arrow class
    if (content.style.display === "none" || content.style.display === "") {
        content.style.display = "block";
        el.classList.remove("collapsed");
        el.classList.add("expanded");
    } else {
        content.style.display = "none";
        el.classList.remove("expanded");
        el.classList.add("collapsed");
    }
}

/**
 * Sanitizes a string to be used as part of an HTML ID.
 * Replaces invalid characters with underscores.
 */
function sanitizeForId(str) {
    if (typeof str !== 'string') str = String(str);
    // Remove or replace characters invalid in IDs
    let sanitized = str.replace(/[^a-zA-Z0-9_-]/g, '_');
    // Collapse multiple consecutive underscores
    sanitized = sanitized.replace(/__+/g, '_');
    // Remove leading/trailing underscores
    sanitized = sanitized.replace(/^_+|_+$/g, '');
     // Prevent IDs starting with a digit
     if (/^\d/.test(sanitized)) {
         sanitized = 'id_' + sanitized;
     }
    // Fallback for empty or invalid strings
    return sanitized || 'invalid_id';
}

/**
 * Shows or hides the S-curve parameter inputs based on the behavior selection.
 * @param {HTMLSelectElement} selectElement - The behavior select dropdown.
 * @param {string} paramKey - The unique key for this parameter set.
 */
function toggleSCurveInputs(selectElement, paramKey) {
    const containerId = `sCurveInputs_${sanitizeForId(paramKey)}`;
    const container = document.getElementById(containerId);
    if (container) {
        const isVisible = selectElement.value === 's-curve';
        container.style.display = isVisible ? 'block' : 'none';
        container.classList.toggle('visible', isVisible);
    } else {
        // This might happen briefly during initialization, usually not an issue
        // console.warn("S-Curve input container not found for key:", paramKey, "ID:", containerId);
    }
}


// --- Dynamic Input Creation Helpers --- (Adapted from reference)

// Default behavior mappings (needed for setting initial UI state)
// Duplicated from modelLogic.js for encapsulation - consider passing from main.js if needed elsewhere
const defaultDeclineDemandTechsUI = { 'Transport|Passenger cars': 'ICE', 'Transport|Trucks': 'ICE', 'Transport|Buses': 'ICE', 'Transport|2/3 wheelers': 'ICE', 'Transport|Ships': 'Conventional ship', 'Transport|Planes': 'Conventional plane', 'Transport|Trains': 'Diesel train', 'Industry|Steel': 'BF-BOF', 'Industry|Cement': 'Conventional kiln', 'Industry|Chemicals': 'Conventional', 'Industry|Low temp. heating': 'Fossil boiler', 'Industry|High temp. heating': 'Fossil furnace', 'Industry|Other industry - energy': 'Conventional', 'Buildings|Residential heating': 'Fossil boiler', 'Buildings|Residential cooking': 'Conventional fossil', 'Buildings|Residential lighting': 'Conventional', 'Buildings|Other residential': 'Conventional', 'Buildings|Building cooling': 'Low efficiency airco', 'Buildings|Commercial heating': 'Fossil boiler', 'Buildings|Commercial lighting': 'Conventional', 'Buildings|Other commercial': 'Conventional', 'Transport|Other transport': 'Conventional' };
const defaultSCurveDemandTechsUI = { 'Transport|Passenger cars': 'EV', 'Transport|Trucks': 'EV', 'Transport|Buses': 'EV', 'Transport|2/3 wheelers': 'EV', 'Transport|Ships': 'Ammonia ship', 'Transport|Planes': 'Electric plane', 'Transport|Trains': 'Electric train', 'Industry|Steel': 'DRI-EAF (H2)', 'Industry|Cement': 'Electric kiln', 'Industry|Chemicals': 'Electrified', 'Industry|Low temp. heating': 'Heat pump', 'Industry|High temp. heating': 'Electric furnace', 'Industry|Other industry - energy': 'Electrified', 'Buildings|Residential heating': 'Heat pump', 'Buildings|Residential cooking': 'Electrified', 'Buildings|Residential lighting': 'Full LED', 'Buildings|Other residential': 'Electrified', 'Buildings|Building cooling': 'High efficiency airco', 'Buildings|Commercial heating': 'Heat pump', 'Buildings|Commercial lighting': 'Full LED', 'Buildings|Other commercial': 'Electrified', 'Transport|Other transport': 'Electrified' };
const defaultDeclinePowerTechsUI = ['Gas power', 'Coal power', 'Oil power'];
const defaultSCurvePowerTechsUI = ['Solar PV', 'Wind'];
const defaultDeclineHydrogenTechsUI = ['Blue'];
const defaultSCurveHydrogenTechsUI = ['Green'];


/**
 * Creates the HTML elements for S-curve parameters (Target Share, Target Year, Steepness).
 * @param {string} paramKey - Unique identifier for the parameter set.
 * @param {number} baseValue - The base year share value (%) for default target.
 * @returns {HTMLDivElement} The container div with the input elements.
 */
const createSCurveParamInputs = (paramKey, baseValue) => {
    const div = document.createElement('div');
    div.className = 's-curve-inputs'; // Initially hidden by CSS
    const sanitizedParamKey = sanitizeForId(paramKey);
    div.id = `sCurveInputs_${sanitizedParamKey}`;

    const targetInputId = `sCurveTarget_${sanitizedParamKey}`;
    const targetYearInputId = `sCurveTargetYear_${sanitizedParamKey}`;
    const steepnessInputId = `sCurveSteepness_${sanitizedParamKey}`;

    // Target Share Input
    const targetLabel = document.createElement('label');
    targetLabel.htmlFor = targetInputId;
    targetLabel.textContent = `Target Share (%):`;
    const targetInput = document.createElement('input');
    targetInput.type = 'number';
    targetInput.id = targetInputId;
    targetInput.min = '0';
    targetInput.max = '100';
    targetInput.step = '1';
    // Default target slightly higher than base, capped at 100
    targetInput.value = Math.min(100, Math.max(0, baseValue + 5)).toFixed(1);
    div.appendChild(targetLabel);
    div.appendChild(targetInput);

    // Target Year Input
    const targetYearLabel = document.createElement('label');
    targetYearLabel.htmlFor = targetYearInputId;
    targetYearLabel.textContent = `Target Year:`;
    const targetYearInput = document.createElement('input');
    targetYearInput.type = 'number';
    targetYearInput.id = targetYearInputId;
    targetYearInput.min = String(startYear + 1); // Use global startYear
    targetYearInput.max = String(endYear + 10); // Allow target beyond model endYear
    targetYearInput.step = '1';
    targetYearInput.value = String(endYear); // Default target is endYear
    div.appendChild(targetYearLabel);
    div.appendChild(targetYearInput);

    // Steepness Input
    const steepnessLabel = document.createElement('label');
    steepnessLabel.htmlFor = steepnessInputId;
    steepnessLabel.textContent = `Steepness (1-10):`;
    const steepnessInput = document.createElement('input');
    steepnessInput.type = 'number';
    steepnessInput.id = steepnessInputId;
    steepnessInput.min = '1';
    steepnessInput.max = '10';
    steepnessInput.step = '1';
    steepnessInput.value = '5'; // Default steepness
    div.appendChild(steepnessLabel);
    div.appendChild(steepnessInput);

    return div;
};

/**
 * Creates the HTML elements for a single technology's behavior controls.
 * @param {string} categoryType - 'Demand', 'Power', or 'Hydrogen'.
 * @param {string} categoryKey - Unique key for the category (e.g., 'Sector|Subsector', 'Power', 'Hydrogen').
 * @param {string} tech - The name of the technology.
 * @param {object} baseMixObject - The base mix object for this category (e.g., baseDemandTechMix[s][b]).
 * @returns {HTMLDivElement} The container div for the technology's controls.
 */
const createTechInput = (categoryType, categoryKey, tech, baseMixObject) => {
    const container = document.createElement('div');
    container.className = 'tech-input-container';

    const legend = document.createElement('legend');
    legend.textContent = tech;
    container.appendChild(legend);

    const paramKey = `${categoryType}|${categoryKey}|${tech}`;
    const sanitizedParamKey = sanitizeForId(paramKey);
    const baseValue = getValue(baseMixObject, [tech], 0); // Get base mix share %

    // Behavior Selector (Fixed, S-Curve, Decline)
    const behaviorDiv = document.createElement('div');
    behaviorDiv.className = 'tech-behavior-selector';

    const behaviorLabel = document.createElement('label');
    behaviorLabel.htmlFor = `behavior_${sanitizedParamKey}`;
    behaviorLabel.textContent = 'Behavior: ';

    const behaviorSelect = document.createElement('select');
    behaviorSelect.id = `behavior_${sanitizedParamKey}`;
    // Add onchange handler to toggle S-curve inputs visibility
    behaviorSelect.onchange = () => toggleSCurveInputs(behaviorSelect, paramKey);

    // Behavior options
    ['Fixed', 'S-Curve (Growth)', 'Decline'].forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.toLowerCase().split(' ')[0]; // 'fixed', 's-curve', 'decline'
        option.textContent = opt;
        behaviorSelect.appendChild(option);
    });

    // Determine default behavior based on mappings
    let defaultBehavior = 'fixed';
    const fullCatKey = categoryKey; // Use the combined key directly for demand
    if ((categoryType === 'Demand' && defaultDeclineDemandTechsUI[fullCatKey] === tech) ||
        (categoryType === 'Power' && defaultDeclinePowerTechsUI.includes(tech)) ||
        (categoryType === 'Hydrogen' && defaultDeclineHydrogenTechsUI.includes(tech))) {
        defaultBehavior = 'decline';
    } else if ((categoryType === 'Demand' && defaultSCurveDemandTechsUI[fullCatKey] === tech) ||
               (categoryType === 'Power' && defaultSCurvePowerTechsUI.includes(tech)) ||
               (categoryType === 'Hydrogen' && defaultSCurveHydrogenTechsUI.includes(tech))) {
        defaultBehavior = 's-curve';
    }
    behaviorSelect.value = defaultBehavior;

    behaviorDiv.appendChild(behaviorLabel);
    behaviorDiv.appendChild(behaviorSelect);
    container.appendChild(behaviorDiv);

    // S-Curve Parameter Inputs (created but initially hidden unless default is s-curve)
    const sCurveInputsDiv = createSCurveParamInputs(paramKey, baseValue);
    container.appendChild(sCurveInputsDiv);

    // Call toggle initially AFTER element is potentially added to DOM (using timeout)
    // to ensure correct visibility based on default value.
    setTimeout(() => toggleSCurveInputs(behaviorSelect, paramKey), 0);

    return container;
};


// --- UI Initialization ---

/**
 * Dynamically creates the input groups in the sidebar based on loaded data.
 * @param {object} structuredData - The data object from dataLoader.js.
 */
function initializeSidebarInputs(structuredData) {
    console.log("Initializing sidebar inputs...");
    const sidebarInputContainer = document.getElementById('inputGroupsContainer');
    if (!sidebarInputContainer) {
        console.error("Sidebar input container (#inputGroupsContainer) not found!");
        return;
    }
    sidebarInputContainer.innerHTML = ''; // Clear previous inputs

    const {
        sectors, subsectors, technologies, // Derived structures
        baseDemandTechMix, basePowerProdMix, baseHydrogenProdMix, // Base mixes
        powerTechs, hydrogenTechs // Tech lists
    } = structuredData;

    // Create End-Use Sector Groups
    sectors.forEach(s => {
        // Skip supply sectors for these input groups
        if (s === 'Power' || s === 'Energy industry') return;

        const sectorGroup = document.createElement('div');
        sectorGroup.className = 'group';

        const sectorTitle = document.createElement('h3');
        sectorTitle.className = 'group-title collapsed'; // Start collapsed
        sectorTitle.textContent = s;
        sectorTitle.onclick = function() { toggleGroup(this); }; // Add click handler

        const sectorContent = document.createElement('div');
        sectorContent.className = 'group-content'; // Initially hidden by CSS / toggle logic
        sectorContent.style.display = 'none'; // Explicitly hide initially

        (subsectors[s] || []).forEach(b => {
            const subGroup = document.createElement('div');
            subGroup.className = 'sub-group';

            const subTitle = document.createElement('h4');
            subTitle.className = 'sub-group-title collapsed'; // Start collapsed
            subTitle.textContent = b;
            subTitle.onclick = function() { toggleGroup(this); }; // Add click handler

            const subContent = document.createElement('div');
            subContent.className = 'sub-group-content';
            subContent.style.display = 'none'; // Explicitly hide initially

            // Activity Growth Input
            const activityDiv = document.createElement('div');
            activityDiv.className = 'activity-growth-input';
            const activityLabel = document.createElement('label');
            const activityInputId = `growth_${sanitizeForId(s)}_${sanitizeForId(b)}`;
            activityLabel.htmlFor = activityInputId;
            activityLabel.textContent = `Activity Growth (%/yr):`;
            const activityInput = document.createElement('input');
            activityInput.type = 'number';
            activityInput.id = activityInputId;
            activityInput.value = '0.5'; // Default growth rate
            activityInput.step = '0.1';
            activityDiv.appendChild(activityLabel);
            activityDiv.appendChild(activityInput);
            subContent.appendChild(activityDiv);

            // Technology Behavior Inputs
            const techs = technologies[s]?.[b] || [];
            const baseMix = getValue(baseDemandTechMix, [s, b], {});
            techs.forEach(t => {
                subContent.appendChild(createTechInput('Demand', `${s}|${b}`, t, baseMix));
            });

            subGroup.appendChild(subTitle);
            subGroup.appendChild(subContent);
            sectorContent.appendChild(subGroup);
        });

        sectorGroup.appendChild(sectorTitle);
        sectorGroup.appendChild(sectorContent);
        sidebarInputContainer.appendChild(sectorGroup);
    });

    // Create Power Generation Group
    const powerGroup = document.createElement('div');
    powerGroup.className = 'group';
    const powerTitle = document.createElement('h3');
    powerTitle.className = 'group-title collapsed';
    powerTitle.textContent = 'Power Generation';
    powerTitle.onclick = function() { toggleGroup(this); };
    const powerContent = document.createElement('div');
    powerContent.className = 'group-content';
    powerContent.style.display = 'none';
    (powerTechs || []).forEach(t => {
        powerContent.appendChild(createTechInput('Power', 'Power', t, basePowerProdMix));
    });
    powerGroup.appendChild(powerTitle);
    powerGroup.appendChild(powerContent);
    sidebarInputContainer.appendChild(powerGroup);

    // Create Hydrogen Production Group
    const hydrogenGroup = document.createElement('div');
    hydrogenGroup.className = 'group';
    const hydrogenTitle = document.createElement('h3');
    hydrogenTitle.className = 'group-title collapsed';
    hydrogenTitle.textContent = 'Hydrogen Production';
    hydrogenTitle.onclick = function() { toggleGroup(this); };
    const hydrogenContent = document.createElement('div');
    hydrogenContent.className = 'group-content';
    hydrogenContent.style.display = 'none';
    (hydrogenTechs || []).forEach(t => {
        hydrogenContent.appendChild(createTechInput('Hydrogen', 'Hydrogen', t, baseHydrogenProdMix));
    });
    hydrogenGroup.appendChild(hydrogenTitle);
    hydrogenGroup.appendChild(hydrogenContent);
    sidebarInputContainer.appendChild(hydrogenGroup);

     console.log("Sidebar inputs initialized.");
}

/**
 * Populates the subsector selection dropdown.
 * @param {object} structuredData - The data object from dataLoader.js.
 */
function populateSubsectorDropdown(structuredData) {
     const subsectorSelect = document.getElementById('selectSubsector');
     if (!subsectorSelect) {
         console.error("Subsector select dropdown not found!");
         return;
     }
     subsectorSelect.innerHTML = ''; // Clear existing options

     const { allEndUseSubsectors } = structuredData; // Get the derived list
     let firstSubsectorKey = null;

     if (!allEndUseSubsectors || allEndUseSubsectors.length === 0) {
         console.warn("No end-use subsectors found in data to populate dropdown.");
         const option = document.createElement('option');
         option.value = "";
         option.textContent = "No subsectors available";
         subsectorSelect.appendChild(option);
         return;
     }


     allEndUseSubsectors.forEach(({ sector, subsector }) => {
         const option = document.createElement('option');
         const key = `${sector}|${subsector}`;
         option.value = key;
         option.textContent = `${sector} - ${subsector}`;
         subsectorSelect.appendChild(option);
         if (!firstSubsectorKey) firstSubsectorKey = key; // Select the first one by default
     });

     // Set default selection
     if (firstSubsectorKey) {
         subsectorSelect.value = firstSubsectorKey;
         // Update the name display initially
         const subsectorNameSpan = document.getElementById('selectedSubsectorName');
         if (subsectorNameSpan) {
              const [selSector, selSubsector] = firstSubsectorKey.split('|');
              subsectorNameSpan.textContent = `${selSector} - ${selSubsector}`;
         }
     }
      console.log("Subsector dropdown populated.");
}


// --- Input Gathering ---

/**
 * Reads the current values from all sidebar inputs.
 * @param {object} structuredData - The data object from dataLoader.js (needed to know which inputs exist).
 * @returns {object} userInputParameters object for modelLogic.runModelCalculation.
 */
function getUserInputsAndParams(structuredData) {
    const {
        sectors, subsectors, technologies,
        powerTechs, hydrogenTechs, allEndUseSubsectors
    } = structuredData;

    const userInputParameters = {
        activityGrowthFactors: {},
        techBehaviorsAndParams: {}
    };

    // Read Activity Growth Rates
    allEndUseSubsectors.forEach(({ sector, subsector }) => {
        const inputId = `growth_${sanitizeForId(sector)}_${sanitizeForId(subsector)}`;
        const inputElement = document.getElementById(inputId);
        const growthPercent = inputElement ? parseFloat(inputElement.value) : 0;
        const growthFactor = isNaN(growthPercent) ? 1.0 : 1 + (growthPercent / 100);
        userInputParameters.activityGrowthFactors[`${sector}|${subsector}`] = growthFactor;
    });

    // Read Technology Behaviors and S-Curve Parameters
    const readTechInputs = (categoryType, categoryKey, techList) => {
        (techList || []).forEach(t => {
            const paramKey = `${categoryType}|${categoryKey}|${t}`;
            const sanitizedParamKey = sanitizeForId(paramKey);

            const behaviorEl = document.getElementById(`behavior_${sanitizedParamKey}`);
            const behavior = behaviorEl ? behaviorEl.value : 'fixed'; // Default to fixed if element not found

            const techParams = { behavior: behavior };

            if (behavior === 's-curve') {
                const targetEl = document.getElementById(`sCurveTarget_${sanitizedParamKey}`);
                const targetYearEl = document.getElementById(`sCurveTargetYear_${sanitizedParamKey}`);
                const steepnessEl = document.getElementById(`sCurveSteepness_${sanitizedParamKey}`);

                techParams.targetShare = targetEl ? parseFloat(targetEl.value) : 0;
                techParams.targetYear = targetYearEl ? parseInt(targetYearEl.value) : endYear;
                techParams.steepness = steepnessEl ? parseInt(steepnessEl.value) : 5;

                // Basic validation/defaults for S-curve params
                if (isNaN(techParams.targetShare)) techParams.targetShare = 0;
                if (isNaN(techParams.targetYear)) techParams.targetYear = endYear;
                if (isNaN(techParams.steepness) || techParams.steepness < 1 || techParams.steepness > 10) techParams.steepness = 5;
            }
            userInputParameters.techBehaviorsAndParams[paramKey] = techParams;
        });
    };

    // Read Demand Techs
    sectors.forEach(s => {
         if (subsectors[s]){
             subsectors[s].forEach(b => {
                 readTechInputs('Demand', `${s}|${b}`, technologies[s]?.[b] || []);
             });
         }
    });
    // Read Power Techs
    readTechInputs('Power', 'Power', powerTechs);
    // Read Hydrogen Techs
    readTechInputs('Hydrogen', 'Hydrogen', hydrogenTechs);

    // console.log("User Inputs & Params:", userInputParameters); // DEBUG
    return userInputParameters;
}


// --- Event Listener Setup ---
// Keep track of the latest results for dropdown updates
let latestModelResults = null;

/**
 * Sets up event listeners for the Run button and Subsector dropdown.
 * @param {object} structuredData - The data object from dataLoader.js.
 */
function setupEventListeners(structuredData) {
    const runButton = document.getElementById('runModelBtn');
    const subsectorSelect = document.getElementById('selectSubsector');

    if (!runButton) {
        console.error("Run Model button (#runModelBtn) not found!");
        return;
    }
     if (!subsectorSelect) {
         console.error("Subsector select dropdown (#selectSubsector) not found!");
         return;
     }

    // Run Model Button Click Handler
    runButton.onclick = async () => { // Use async for await
        runButton.disabled = true;
        runButton.textContent = 'Calculating...';
        console.log("Run button clicked. Gathering inputs and running model...");

        try {
            // 1. Get current user inputs from UI
            const userInputs = getUserInputsAndParams(structuredData);

            // 2. Run the model calculation (function from modelLogic.js)
            // Ensure modelLogic.runModelCalculation is accessible (e.g., global or imported)
            if (typeof runModelCalculation !== 'function') {
                 throw new Error("runModelCalculation function is not defined or accessible.");
            }
            latestModelResults = await runModelCalculation(structuredData, userInputs); // Store results

            // 3. Update the charts (function from charting.js)
            // Ensure charting.updateCharts is accessible
            if (typeof updateCharts !== 'function') {
                throw new Error("updateCharts function is not defined or accessible.");
            }
            updateCharts(latestModelResults, structuredData); // Pass results and config

        } catch (error) {
            console.error("Error during model execution or chart update:", error);
            alert(`An error occurred: ${error.message}. Check console for details.`);
        } finally {
            // 4. Re-enable button
            runButton.disabled = false;
            runButton.textContent = 'Run Model & Update Charts';
        }
    };

     // Subsector Dropdown Change Handler
     subsectorSelect.onchange = () => {
         console.log("Subsector selection changed.");
          // Ensure charting.updateCharts is accessible
          if (typeof updateCharts !== 'function') {
              console.error("updateCharts function is not defined or accessible.");
              return;
          }
          // Update charts using the *latest* stored results and the config data
         if (latestModelResults) {
              updateCharts(latestModelResults, structuredData);
         } else {
              console.warn("No model results available to update charts for subsector change.");
               // Optionally clear charts or show a message if no results exist yet
         }
     };

      console.log("UI Event listeners set up.");
}
