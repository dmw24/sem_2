// js/main.js
// Further refactored for maximum conciseness

const appState = { structuredData: null, latestResults: null };

async function initializeApp() {
    console.log("App init...");
    const btn = document.getElementById('runModelBtn');
    const setBtn = (text, disabled) => { if(btn) { btn.textContent = text; btn.disabled = disabled; } };
    const showError = (msg) => {
        console.error("Init Error:", msg);
        document.getElementById('content')?.insertAdjacentHTML('afterbegin', `<p style='color:red;'>Error: ${msg}</p>`);
        setBtn('Init Failed', true); alert(`Init Error: ${msg}`);
    };

    try {
        setBtn('Loading...', true);
        // Basic check for function existence (assumes they are global)
        if (![loadAndStructureData, initializeSidebarInputs, populateSubsectorDropdown, populateYearDropdown, setupEventListeners, getUserInputsAndParams, runModelCalculation, updateCharts].every(f => typeof f === 'function')) {
            throw new Error("Core function missing.");
        }
        appState.structuredData = await loadAndStructureData();
        if (!appState.structuredData?.sectors?.length) throw new Error("Data load failed.");
        console.log("Data loaded.");

        initializeSidebarInputs(appState.structuredData);
        populateSubsectorDropdown(appState.structuredData);
        populateYearDropdown(appState.structuredData);
        console.log("UI init.");

        setupEventListeners(appState); // Passes state object
        console.log("Listeners set.");

        setBtn('Calculating...', true);
        const initialInputs = getUserInputsAndParams(appState.structuredData);
        appState.latestResults = await runModelCalculation(appState.structuredData, initialInputs);
        console.log("Initial calc done.");

        updateCharts(appState.latestResults, appState.structuredData);
        console.log("Initial charts done.");

        setBtn('Run Model & Update Charts', false);
        console.log("App ready.");

    } catch (err) { showError(err.message || String(err)); }
}

document.addEventListener('DOMContentLoaded', initializeApp);
