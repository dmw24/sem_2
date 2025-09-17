// js/uiController.js
// Further refactored for maximum conciseness

// --- UI Helpers (Concise) ---
const toggleGroup = el => {
    const content = el.nextElementSibling;
    if (!content?.matches('.group-content, .sub-group-content')) return;
    const isHidden = !content.style.display || content.style.display === "none";
    content.style.display = isHidden ? "block" : "none";
    el.classList.toggle("expanded", isHidden); el.classList.toggle("collapsed", !isHidden);
};
const sanitizeForId = (str = '') => String(str).replace(/[^a-zA-Z0-9_-]/g, '_').replace(/__+/g, '_').replace(/^_+|_+$/g, '') || 'invalid_id';
const toggleSCurveInputsVisibility = sel => {
    const container = sel.closest('.tech-input-container')?.querySelector('.s-curve-inputs');
    if (container) container.style.display = sel.value === 's-curve' ? 'block' : 'none';
};

// --- Default Behaviors (Minimal) ---
const defaultBehaviors = { dD: { /* declineDemand */ }, sD: { /* sCurveDemand */ }, dP: ['Gas power', 'Coal power', 'Oil power'], sP: ['Solar PV', 'Wind'], dH: ['Blue'], sH: ['Green'] }; // Populate dD, sD if needed, or remove if unused
const getDefaultBehavior = (type, key, tech) => type === 'Demand' ? (defaultBehaviors.dD[key] === tech ? 'decline' : defaultBehaviors.sD[key] === tech ? 's-curve' : 'fixed') : type === 'Power' ? (defaultBehaviors.dP.includes(tech) ? 'decline' : defaultBehaviors.sP.includes(tech) ? 's-curve' : 'fixed') : type === 'Hydrogen' ? (defaultBehaviors.dH.includes(tech) ? 'decline' : defaultBehaviors.sH.includes(tech) ? 's-curve' : 'fixed') : 'fixed';

// --- Dynamic Input Creation (Concise) ---
const createEl = (tag, props = {}, children = []) => {
    const el = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
        if (key === 'textContent') el.textContent = value;
        else if (key === 'innerHTML') el.innerHTML = value;
        else if (key === 'style') Object.assign(el.style, value);
        else if (key === 'className') el.className = value;
        else if (key === 'htmlFor' || key === 'for') el.htmlFor = value;
        else if (key === 'value') el.value = value;
        else if (key.startsWith('on') && typeof value === 'function') el[key.toLowerCase()] = value; // Basic event handling
        else el.setAttribute(key, value);
    });
    children.forEach(child => child && el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child));
    return el;
};
const createInputGrp = (id, type, props = {}, labelTxt, helpTxt) => createEl('div', { className: `input-group ig-${type}` }, [
    createEl('label', { htmlFor: id, textContent: labelTxt }),
    createEl('input', { id, type, ...props }),
    helpTxt ? createEl('small', { textContent: helpTxt }) : null
]);
const createSCurveParams = (pKey, baseVal, startYr, endYr) => {
    const sKey = sanitizeForId(pKey);
    const tYr = endYr, midYr = Math.round(startYr + (tYr - startYr) / 2);
    return createEl('div', { id: `sCurveInputs_${sKey}`, className: 's-curve-inputs' }, [ // Hidden by CSS
        createInputGrp(`sCurveTarget_${sKey}`, 'number', { min: 0, max: 100, step: 1, value: Math.min(100, Math.max(0, baseVal + 5)).toFixed(1) }, 'Target Share (%):'),
        createInputGrp(`sCurveTargetYear_${sKey}`, 'number', { min: startYr + 1, max: endYr + 10, step: 1, value: tYr }, 'Target Year:'),
        createInputGrp(`sCurveKValue_${sKey}`, 'number', { min: 0.01, max: 1.0, step: 0.01, value: 0.15 }, 'Steepness (k):', 'Growth rate'),
        createInputGrp(`sCurveMidpointYear_${sKey}`, 'number', { min: startYr - 10, max: endYr + 10, step: 1, value: midYr }, 'Midpoint Year (t0):', 'Fastest growth year')
    ]);
};
const createTechInput = (catType, catKey, tech, baseVal, startYr, endYr) => {
    const pKey = `${catType}|${catKey}|${tech}`, sKey = sanitizeForId(pKey);
    const select = createEl('select', { id: `behavior_${sKey}`, onchange: e => toggleSCurveInputsVisibility(e.target) },
        ['Fixed', 'S-Curve', 'Decline'].map(opt => createEl('option', { value: opt.toLowerCase(), textContent: opt }))
    );
    select.value = getDefaultBehavior(catType, catKey, tech);
    const container = createEl('div', { className: 'tech-input-container' }, [
        createEl('legend', { textContent: tech }),
        createEl('div', { className: 'tech-behavior-selector' }, [ createEl('label', { htmlFor: select.id, textContent: 'Behavior: ' }), select ]),
        createSCurveParams(pKey, baseVal, startYr, endYr)
    ]);
    setTimeout(() => toggleSCurveInputsVisibility(select), 0); // Ensure initial state
    return container;
};

// --- UI Initialization (Concise) ---
function initializeSidebarInputs(structuredData) {
    const cont = document.getElementById('inputGroupsContainer');
    if (!cont) return console.error("Sidebar container not found!");
    cont.innerHTML = '';
    const { sectors = [], subsectors = {}, technologies = {}, baseDemandTechMix = {}, basePowerProdMix = {}, baseHydrogenProdMix = {}, powerTechs = [], hydrogenTechs = [], startYear, endYear } = structuredData ?? {};
    const frag = document.createDocumentFragment();
    const createGroup = (title, contentCb) => {
        const contentEl = createEl('div', { className: 'group-content' }); contentCb(contentEl); // Hidden by CSS
        return createEl('div', { className: 'group' }, [
            createEl('h3', { className: 'group-title collapsed', textContent: title, onclick: e => toggleGroup(e.target) }), contentEl
        ]);
    };
    sectors.filter(s => !['Power', 'Energy industry'].includes(s)).forEach(s => frag.appendChild(createGroup(s, sCont => {
        (subsectors[s] || []).forEach(b => {
            const subContent = createEl('div', { className: 'sub-group-content' }); // Hidden by CSS
            subContent.appendChild(createInputGrp(`growth_${sanitizeForId(s)}_${sanitizeForId(b)}`, 'number', { value: 0.5, step: 0.1 }, `Activity Growth (%/yr):`));
            const baseMix = baseDemandTechMix?.[s]?.[b] ?? {};
            (technologies?.[s]?.[b] ?? []).forEach(t => subContent.appendChild(createTechInput('Demand', `${s}|${b}`, t, baseMix[t] ?? 0, startYear, endYear)));
            sCont.appendChild(createEl('div', { className: 'sub-group' }, [
                createEl('h4', { className: 'sub-group-title collapsed', textContent: b, onclick: e => toggleGroup(e.target) }), subContent
            ]));
        });
    })));
    frag.appendChild(createGroup('Power Generation', pCont => powerTechs.forEach(t => pCont.appendChild(createTechInput('Power', 'Power', t, basePowerProdMix[t] ?? 0, startYear, endYear)))));
    frag.appendChild(createGroup('Hydrogen Production', hCont => hydrogenTechs.forEach(t => hCont.appendChild(createTechInput('Hydrogen', 'Hydrogen', t, baseHydrogenProdMix[t] ?? 0, startYear, endYear)))));
    cont.appendChild(frag);
    console.log("Sidebar inputs initialized.");
}
function populateSubsectorDropdown(structuredData) {
    const sel = document.getElementById('selectSubsector'); if (!sel) return;
    sel.innerHTML = ''; // Clear
    const subsectors = structuredData?.allEndUseSubsectors ?? [];
    if (!subsectors.length) { sel.add(new Option("No subsectors", "")); return; }
    subsectors.forEach(({ sector, subsector }) => sel.add(new Option(`${sector} - ${subsector}`, `${sector}|${subsector}`)));
    if (sel.options.length > 0) {
        sel.value = sel.options[0].value;
        const nameSpan = document.getElementById('selectedSubsectorName');
        if (nameSpan) nameSpan.textContent = sel.options[0].text;
    }
    console.log("Subsector dropdown populated.");
}

// --- Input Gathering (Concise) ---
function getUserInputsAndParams(structuredData) {
    const { sectors = [], subsectors = {}, technologies = {}, powerTechs = [], hydrogenTechs = [], allEndUseSubsectors = [], startYear, endYear } = structuredData ?? {};
    const params = { activityGrowthFactors: {}, techBehaviorsAndParams: {} };
    allEndUseSubsectors.forEach(({ sector, subsector }) => {
        const input = document.getElementById(`growth_${sanitizeForId(sector)}_${sanitizeForId(subsector)}`);
        const growthPc = parseFloat(input?.value ?? '0');
        params.activityGrowthFactors[`${sector}|${subsector}`] = isNaN(growthPc) ? 1.0 : 1 + growthPc / 100;
    });
    const readTechs = (catType, catKey, techList) => (techList || []).forEach(t => {
        const pKey = `${catType}|${catKey}|${t}`, sKey = sanitizeForId(pKey);
        const behavior = document.getElementById(`behavior_${sKey}`)?.value ?? 'fixed';
        const techP = { behavior };
        if (behavior === 's-curve') {
            const getVal = (elId, parseFn, defaultVal) => { const v = parseFn(document.getElementById(elId)?.value); return isNaN(v) ? defaultVal : v; };
            const targetYr = getVal(`sCurveTargetYear_${sKey}`, parseInt, endYear);
            const kVal = getVal(`sCurveKValue_${sKey}`, parseFloat, 0.15);
            const midYr = getVal(`sCurveMidpointYear_${sKey}`, parseInt, Math.round(startYear + (targetYr - startYear) / 2));
            techP.targetShare = getVal(`sCurveTarget_${sKey}`, parseFloat, 0);
            techP.targetYear = targetYr; techP.kValue = kVal <= 0 ? 0.15 : kVal; techP.midpointYear = midYr;
        }
        params.techBehaviorsAndParams[pKey] = techP;
    });
    sectors.forEach(s => (subsectors[s] || []).forEach(b => readTechs('Demand', `${s}|${b}`, technologies?.[s]?.[b])));
    readTechs('Power', 'Power', powerTechs); readTechs('Hydrogen', 'Hydrogen', hydrogenTechs);
    return params;
}

// --- Event Listeners (Concise) ---
function handleChartViewChange() {
    const view = document.getElementById('selectChartView')?.value ?? 'subsector';
    document.getElementById('subsectorSelector')?.classList.toggle('hidden', view !== 'subsector');
    ['subsectorChartsSection', 'balanceChartsSection', 'supplyChartsSection'].forEach(id => {
        document.getElementById(id)?.classList.toggle('hidden', !id.toLowerCase().includes(view));
    });
}
function setupEventListeners(appState) {
    const btn = document.getElementById('runModelBtn'), subSel = document.getElementById('selectSubsector'), viewSel = document.getElementById('selectChartView');
    if (!btn || !subSel || !viewSel || !appState.structuredData) return console.error("Missing elements/data for listeners.");
    btn.onclick = async () => {
        btn.disabled = true; btn.textContent = 'Calculating...';
        try {
            if (typeof runModelCalculation !== 'function' || typeof updateCharts !== 'function' || typeof getUserInputsAndParams !== 'function') throw new Error("Core function missing.");
            const inputs = getUserInputsAndParams(appState.structuredData);
            appState.latestResults = await runModelCalculation(appState.structuredData, inputs);
            updateCharts(appState.latestResults, appState.structuredData);
        } catch (err) { console.error("Run error:", err); alert(`Error: ${err.message}.`); }
        finally { btn.disabled = false; btn.textContent = 'Run Model & Update Charts'; }
    };
    subSel.onchange = () => {
        if (typeof updateCharts === 'function' && appState.latestResults) {
            const nameSpan = document.getElementById('selectedSubsectorName');
            if (nameSpan && subSel.selectedIndex >= 0) nameSpan.textContent = subSel.options[subSel.selectedIndex].text;
            updateCharts(appState.latestResults, appState.structuredData);
        }
    };
    viewSel.onchange = handleChartViewChange;
    handleChartViewChange(); // Initial call
    console.log("UI Listeners set up.");
}
