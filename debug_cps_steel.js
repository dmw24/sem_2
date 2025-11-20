
const fs = require('fs');
const path = require('path');

// Mock browser globals
global.fetch = async (url) => {
    const filePath = path.join(__dirname, url.split('?')[0]);
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return {
            ok: true,
            text: async () => content
        };
    } catch (e) {
        console.error(`Error reading file ${filePath}:`, e);
        return { ok: false };
    }
};

// Load model files
const dataLoaderContent = fs.readFileSync(path.join(__dirname, 'js/dataLoader.js'), 'utf8');
const modelLogicContent = fs.readFileSync(path.join(__dirname, 'js/modelLogic.js'), 'utf8');
const uiControllerContent = fs.readFileSync(path.join(__dirname, 'js/uiController.js'), 'utf8'); // For getScenarioParamsFromData

// Eval to load functions into scope (hacky but works for quick debug)
eval(dataLoaderContent);
eval(modelLogicContent);

// Extract getScenarioParamsFromData from uiController manually since it's not exported
// or just copy-paste it here to be safe and avoid DOM dependency issues in uiController
function getScenarioParamsFromData(scenarioName, structuredData) {
    const { scenarios, scenarioActivityGrowth, sectors, subsectors, technologies, powerTechs, hydrogenTechs, endUseFuels, startYear, endYear, allEndUseSubsectors } = structuredData;

    const params = {
        activityGrowthFactors: {},
        techBehaviorsAndParams: {}
    };

    // 1. Activity Growth
    (allEndUseSubsectors || []).forEach(({ sector, subsector }) => {
        const key = `${sector}|${subsector}`;
        params.activityGrowthFactors[key] = { p1: 1.0, p2: 1.0 };
        if (scenarioActivityGrowth && scenarioActivityGrowth[scenarioName]) {
            const growth = scenarioActivityGrowth[scenarioName][key];
            if (growth) {
                params.activityGrowthFactors[key] = {
                    p1: growth.p1 || 1.0,
                    p2: growth.p2 || 1.0
                };
            }
        }
    });

    // 2. Technology Behaviors
    const setTechParams = (categoryType, categoryKey, techList) => {
        (techList || []).forEach(t => {
            const paramKey = `${categoryType}|${categoryKey}|${t}`;
            const scenarioData = scenarios[scenarioName];
            if (scenarioData && scenarioData[paramKey]) {
                params.techBehaviorsAndParams[paramKey] = scenarioData[paramKey];
            } else {
                params.techBehaviorsAndParams[paramKey] = { behavior: 'fixed' };
            }
        });
    };

    sectors.forEach(s => {
        if (subsectors[s]) {
            subsectors[s].forEach(b => {
                setTechParams('Demand', `${s}|${b}`, technologies[s]?.[b] || []);
            });
        }
    });
    setTechParams('Power', 'Power', powerTechs);
    setTechParams('Hydrogen', 'Hydrogen', hydrogenTechs);

    return params;
}

async function runDebug() {
    console.log("Loading data...");
    const structuredData = await loadAndStructureData();

    const scenarioName = "IEA CPS (downscaled approx)";
    console.log(`Running scenario: ${scenarioName}`);

    const params = getScenarioParamsFromData(scenarioName, structuredData);

    // Check params for Steel CCS
    const steelCCSKey = "Demand|Industry|Steel|BF-BOF + CCS";
    console.log(`Params for ${steelCCSKey}:`, params.techBehaviorsAndParams[steelCCSKey]);

    const results = runModelCalculation(structuredData, params);

    const mix2050 = results[2050].demandTechMix.Industry.Steel;
    console.log("Steel Mix in 2050:", mix2050);
}

runDebug();
