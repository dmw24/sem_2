// js/sankeyRenderer.js - D3-Sankey Implementation

function renderSankey(results, year, structuredData) {
    console.log("--- renderSankey (D3) CALLED ---", { year });

    const containerId = 'sankeyChart';
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!results || !results[year]) {
        container.innerHTML = '<p>No results available.</p>';
        return;
    }

    // Ensure D3 is loaded
    if (typeof d3 === 'undefined' || typeof d3.sankey === 'undefined') {
        container.innerHTML = '<p>Loading D3 Sankey library...</p>';
        return;
    }

    try {
        // Read Toggle State
        const toggleSubsectors = document.getElementById('toggleSubsectors');
        const showSubsectors = toggleSubsectors ? toggleSubsectors.checked : true;

        // Build rows (same format as before)
        const rows = buildSankeyRows(results, year, structuredData, () => { }, showSubsectors);

        if (rows.length === 0) {
            container.innerHTML = '<p>No flow data for this year.</p>';
            return;
        }

        // Clear previous
        container.innerHTML = '';

        // Transform rows to D3 format
        const nodeMap = new Map();
        const nodes = [];
        const links = [];

        // Extract unique nodes
        rows.forEach(([source, target, value]) => {
            if (!nodeMap.has(source)) {
                nodeMap.set(source, nodes.length);
                nodes.push({ name: source });
            }
            if (!nodeMap.has(target)) {
                nodeMap.set(target, nodes.length);
                nodes.push({ name: target });
            }
        });

        // Create links
        rows.forEach(([source, target, value]) => {
            links.push({
                source: nodeMap.get(source),
                target: nodeMap.get(target),
                value: value
            });
        });

        // Define node categories with fixed ordering
        const columnDefs = {
            primary: ['Biomass', 'Coal', 'Gas', 'Geothermal', 'Hydro', 'Nuclear', 'Oil', 'Solar', 'Uranium', 'Wind'],
            transformation: ['Hydrogen Plants', 'Power'],
            sectors: ['Buildings', 'Industry', 'Transport'],
            usefulTypes: ['Cooling', 'Feedstock', 'High T heating', 'Lighting', 'Low T heating', 'Stationary power', 'Transport service']
        };

        // Assign fixed positions to nodes - ONLY set x (columns), let D3 calculate y
        nodes.forEach((node, idx) => {
            let x = 0.5;

            if (columnDefs.sectors.includes(node.name)) {
                x = 0.50;
            } else if (node.name === 'Hydrogen Plants') {
                x = 0.37; // Between Power (0.25) and Sectors (0.50)
            } else if (columnDefs.transformation.includes(node.name)) {
                x = 0.25;
            } else if (node.name === 'Losses') {
                x = 0.85; // Same column as useful energy types
            } else if (columnDefs.usefulTypes.includes(node.name)) {
                x = 0.85;
            } else if (columnDefs.primary.includes(node.name)) {
                x = 0.01;
            } else {
                x = 0.65;
            }

            node.x = x;
            // DO NOT set node.y - let D3 calculate it to avoid overlaps
        });

        // Set up dimensions
        const width = container.offsetWidth || 1000;
        const height = 800; // Increased from 800 to accommodate all nodes
        const margin = { top: 10, right: 10, bottom: 10, left: 10 };

        // Create SVG with viewBox for responsiveness
        const svg = d3.select(container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');

        // Create sankey layout with increased padding to avoid overlaps
        const sankeyLayout = d3.sankey()
            .nodeWidth(15)
            .nodePadding(20) // Increased from 15 to prevent node overlaps
            .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])
            .nodeSort(null) // Don't auto-sort - respect our manual ordering
            .linkSort(null);

        // Apply sankey layout to calculate links and initial positions
        const graph = sankeyLayout({ nodes, links });

        // Override x positions with our fixed columns, keep D3's y and heights
        graph.nodes.forEach(node => {
            const nodeWidth = 15;
            node.x0 = node.x * width;
            node.x1 = node.x0 + nodeWidth;
            // Keep y0, y1 from D3 - they're based on flow values
        });

        // Group nodes by column to check for overlaps
        const nodesByColumn = {};
        graph.nodes.forEach(node => {
            const colKey = node.x.toFixed(2);
            if (!nodesByColumn[colKey]) nodesByColumn[colKey] = [];
            nodesByColumn[colKey].push(node);
        });

        // For columns with overlaps, redistribute nodes
        Object.values(nodesByColumn).forEach(nodesInCol => {
            if (nodesInCol.length <= 1) return;

            // Sort by current y position
            nodesInCol.sort((a, b) => a.y0 - b.y0);

            // Check if redistribution is needed
            let needsRedistribution = false;
            for (let i = 0; i < nodesInCol.length - 1; i++) {
                if (nodesInCol[i].y1 + 5 > nodesInCol[i + 1].y0) {
                    needsRedistribution = true;
                    break;
                }
            }

            if (needsRedistribution) {
                // Calculate total height needed
                const totalNodeHeight = nodesInCol.reduce((sum, n) => sum + (n.y1 - n.y0), 0);
                const minPadding = 10;
                const totalPadding = minPadding * (nodesInCol.length - 1);
                const availableHeight = height - margin.top - margin.bottom;

                // Redistribute nodes
                let currentY = margin.top;
                nodesInCol.forEach(node => {
                    const nodeHeight = node.y1 - node.y0;
                    node.y0 = currentY;
                    node.y1 = currentY + nodeHeight;
                    currentY = node.y1 + minPadding;
                });
            }
        });

        // Recompute link positions based on new node positions
        // This recalculates link.y0 and link.y1 without changing node positions
        graph.nodes.forEach(node => {
            // Calculate link positions for source links (outgoing)
            node.sourceLinks.sort((a, b) => a.target.y0 - b.target.y0);
            let y0 = node.y0;
            node.sourceLinks.forEach(link => {
                link.y0 = y0 + link.width / 2;
                y0 += link.width;
            });

            // Calculate link positions for target links (incoming)
            node.targetLinks.sort((a, b) => a.source.y0 - b.source.y0);
            let y1 = node.y0;
            node.targetLinks.forEach(link => {
                link.y1 = y1 + link.width / 2;
                y1 += link.width;
            });
        });

        // Create gradient definitions
        const defs = svg.append('defs');
        graph.links.forEach((link, i) => {
            const gradient = defs.append('linearGradient')
                .attr('id', `gradient-${i}`)
                .attr('gradientUnits', 'userSpaceOnUse')
                .attr('x1', link.source.x1)
                .attr('x2', link.target.x0);

            const sourceColor = window.getTechColor(link.source.name) || '#999';
            const targetColor = window.getTechColor(link.target.name) || '#999';

            gradient.append('stop')
                .attr('offset', '0%')
                .attr('stop-color', sourceColor)
                .attr('stop-opacity', 0.4);

            gradient.append('stop')
                .attr('offset', '100%')
                .attr('stop-color', targetColor)
                .attr('stop-opacity', 0.4);
        });

        // Create tooltip div (reusable HTML tooltip)
        let tooltip = d3.select('body').select('.sankey-tooltip');
        if (tooltip.empty()) {
            tooltip = d3.select('body')
                .append('div')
                .attr('class', 'sankey-tooltip')
                .style('position', 'absolute')
                .style('background', 'rgba(0, 0, 0, 0.85)')
                .style('color', '#fff')
                .style('padding', '10px 14px')
                .style('border-radius', '8px')
                .style('font-family', 'Poppins, sans-serif')
                .style('font-size', '13px')
                .style('pointer-events', 'none')
                .style('opacity', 0)
                .style('z-index', 10000)
                .style('box-shadow', '0 4px 12px rgba(0,0,0,0.3)');
        }

        // Draw links
        const linkGroup = svg.append('g')
            .selectAll('path')
            .data(graph.links)
            .join('path')
            .attr('class', 'sankey-link')
            .attr('d', d3.sankeyLinkHorizontal())
            .attr('stroke', (d, i) => `url(#gradient-${i})`)
            .attr('stroke-width', d => Math.max(1, d.width))
            .attr('fill', 'none')
            .attr('opacity', 0.5)
            .on('mouseover', function (event, d) {
                d3.select(this).attr('opacity', 0.8);

                tooltip
                    .style('opacity', 1)
                    .html(`
                        <div style="font-weight: 600; margin-bottom: 4px;">${d.source.name} → ${d.target.name}</div>
                        <div style="font-size: 14px; color: #a5f3fc;">${(d.value / 1e9).toFixed(2)} EJ</div>
                    `)
                    .style('left', (event.pageX + 15) + 'px')
                    .style('top', (event.pageY - 15) + 'px');
            })
            .on('mousemove', function (event) {
                tooltip
                    .style('left', (event.pageX + 15) + 'px')
                    .style('top', (event.pageY - 15) + 'px');
            })
            .on('mouseout', function () {
                d3.select(this).attr('opacity', 0.5);
                tooltip.style('opacity', 0);
            });

        // Draw nodes
        const nodeGroup = svg.append('g')
            .selectAll('g')
            .data(graph.nodes)
            .join('g');

        nodeGroup.append('rect')
            .attr('class', 'sankey-node')
            .attr('x', d => d.x0)
            .attr('y', d => d.y0)
            .attr('height', d => d.y1 - d.y0)
            .attr('width', d => d.x1 - d.x0)
            .attr('fill', d => window.getTechColor(d.name) || '#999')
            .attr('stroke', '#000')
            .attr('stroke-width', 0.5)
            .attr('opacity', 0.9)
            .on('mouseover', function (event, d) {
                // Highlight this node
                d3.select(this).attr('opacity', 1).attr('stroke-width', 2);

                // Highlight all connected links
                svg.selectAll('.sankey-link')
                    .attr('opacity', link => {
                        if (link.source === d || link.target === d) {
                            return 0.9;
                        }
                        return 0.15;
                    })
                    .attr('stroke-width', link => {
                        if (link.source === d || link.target === d) {
                            return Math.max(1, link.width * 1.2);
                        }
                        return Math.max(1, link.width);
                    });

                // Build tooltip content
                let tooltipContent = `<div style="font-weight: 700; margin-bottom: 8px; font-size: 14px;">${d.name}</div>`;
                tooltipContent += `<div style="margin-bottom: 8px; color: #a5f3fc; font-size: 15px; font-weight: 600;">${(d.value / 1e9).toFixed(2)} EJ</div>`;

                // Add incoming links
                if (d.targetLinks && d.targetLinks.length > 0) {
                    tooltipContent += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2);">`;
                    tooltipContent += `<div style="font-weight: 600; font-size: 11px; color: #94a3b8; margin-bottom: 4px;">INCOMING</div>`;
                    d.targetLinks.forEach(link => {
                        tooltipContent += `<div style="font-size: 12px; margin-bottom: 2px;">← ${link.source.name}: <span style="color: #6ee7b7;">${(link.value / 1e9).toFixed(2)} EJ</span></div>`;
                    });
                    tooltipContent += `</div>`;
                }

                // Add outgoing links
                if (d.sourceLinks && d.sourceLinks.length > 0) {
                    tooltipContent += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2);">`;
                    tooltipContent += `<div style="font-weight: 600; font-size: 11px; color: #94a3b8; margin-bottom: 4px;">OUTGOING</div>`;
                    d.sourceLinks.forEach(link => {
                        tooltipContent += `<div style="font-size: 12px; margin-bottom: 2px;">→ ${link.target.name}: <span style="color: #fbbf24;">${(link.value / 1e9).toFixed(2)} EJ</span></div>`;
                    });
                    tooltipContent += `</div>`;
                }

                tooltip
                    .style('opacity', 1)
                    .html(tooltipContent)
                    .style('left', (event.pageX + 15) + 'px')
                    .style('top', (event.pageY - 15) + 'px');
            })
            .on('mousemove', function (event) {
                tooltip
                    .style('left', (event.pageX + 15) + 'px')
                    .style('top', (event.pageY - 15) + 'px');
            })
            .on('mouseout', function () {
                // Reset node
                d3.select(this).attr('opacity', 0.9).attr('stroke-width', 0.5);

                // Reset all links
                svg.selectAll('.sankey-link')
                    .attr('opacity', 0.5)
                    .attr('stroke-width', d => Math.max(1, d.width));

                tooltip.style('opacity', 0);
            });

        // Add labels
        nodeGroup.append('text')
            .attr('x', d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
            .attr('y', d => (d.y1 + d.y0) / 2)
            .attr('dy', '0.35em')
            .attr('text-anchor', d => d.x0 < width / 2 ? 'start' : 'end')
            .attr('font-family', 'Poppins, sans-serif')
            .attr('font-size', '10px')
            .attr('fill', '#333')
            .text(d => d.name);

    } catch (e) {
        console.error("Error rendering D3 Sankey:", e);
        container.innerHTML = `<p style="color:red">Error: ${e.message}</p>`;
    }
}

// Keep the existing buildSankeyRows function unchanged
// (It's already in the file from lines ~240 onwards)
function buildSankeyRows(results, year, structuredData, registerNode, showSubsectors) {
    console.log('buildSankeyRows called with:', { year, showSubsectors, hasResults: !!results, hasStructuredData: !!structuredData });

    const mainRows = [];
    const lossRows = [];

    // Helper to add row to specific list
    function addRow(list, source, target, value) {
        if (!source || !target || typeof value !== 'number' || isNaN(value) || value < 0.001) return;
        list.push([String(source), String(target), value]);
    }

    const getValue = (obj, keys, defaultValue = 0) => {
        let current = obj;
        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return defaultValue;
            }
        }
        return (current === null || current === undefined) ? defaultValue : current;
    };

    const yearData = results[year];
    console.log('yearData for', year, ':', yearData ? 'exists' : 'MISSING');
    console.log('yearData keys:', yearData ? Object.keys(yearData) : 'N/A');

    if (!yearData) {
        console.warn(`No data for year ${year}`);
        return [];
    }

    // Use correct property names
    const fecDetailed = yearData.fecDetailed;
    const ueDetailed = yearData.ueDetailed;
    const pedByFuel = yearData.pedByFuel || {};
    const powerProdMix = yearData.powerProdMix || {};
    const hydrogenProdMix = yearData.hydrogenProdMix || {};

    const primaryFuels = structuredData.primaryFuels || [];
    const subsectors = structuredData.subsectors || {};
    const technologies = structuredData.technologies || {};
    const usefulEnergyTypeMap = structuredData.usefulEnergyTypeMap || {};

    console.log('===== FULL YEAR DATA DUMP =====');
    console.log('pedByFuel:', JSON.stringify(pedByFuel, null, 2));
    console.log('ecPostPower:', JSON.stringify(yearData.ecPostPower, null, 2));
    console.log('ecPostHydrogen:', JSON.stringify(yearData.ecPostHydrogen, null, 2));
    console.log('powerProdMix:', JSON.stringify(powerProdMix, null, 2));
    console.log('hydrogenProdMix:', JSON.stringify(hydrogenProdMix, null, 2));
    console.log('f ecByFuel:', JSON.stringify(yearData.fecByFuel, null, 2));
    console.log('================================');

    // A. Primary to Power - Recalculate using same logic as modelLogic.js
    // Power inputs = electricity demand * power mix * unit energy consumption per tech
    const fecElectricity = yearData.ecPostHydrogen?.['Electricity'] || 0;
    const powerTechs = structuredData.powerTechs || [];
    const powerTechUnitEnergyCons = structuredData.powerTechUnitEnergyCons || {};

    const powerInputEnergyByFuel = {};
    powerTechs.forEach(pt => {
        const mixPercent = getValue(powerProdMix, [pt], 0);
        const mixFraction = mixPercent / 100;
        const unitConsMap = getValue(powerTechUnitEnergyCons, [pt], {});
        Object.keys(unitConsMap).forEach(f_input => {
            const unitCons = unitConsMap[f_input];
            const demand = fecElectricity * mixFraction * unitCons;
            powerInputEnergyByFuel[f_input] = (powerInputEnergyByFuel[f_input] || 0) + demand;
        });
    });

    console.log('Power inputs (recalculated):', powerInputEnergyByFuel);
    Object.entries(powerInputEnergyByFuel).forEach(([fuel, value]) => {
        if (value > 0.001) {
            addRow(mainRows, fuel, 'Power', value);
        }
    });
    console.log('After power inputs, mainRows:', mainRows.length);

    // B. Primary to Hydrogen Plants - Recalculate using same logic as modelLogic.js
    const fecHydrogen = yearData.fecByFuel?.['Hydrogen'] || 0;
    const hydrogenTechs = structuredData.hydrogenTechs || [];
    const hydrogenTechUnitEnergyCons = structuredData.hydrogenTechUnitEnergyCons || {};

    const hydrogenInputEnergyByFuel = {};
    hydrogenTechs.forEach(ht => {
        const mixPercent = getValue(hydrogenProdMix, [ht], 0);
        const mixFraction = mixPercent / 100;
        const unitConsMap = getValue(hydrogenTechUnitEnergyCons, [ht], {});
        Object.keys(unitConsMap).forEach(f_input => {
            const unitCons = unitConsMap[f_input];
            const demand = fecHydrogen * mixFraction * unitCons;
            hydrogenInputEnergyByFuel[f_input] = (hydrogenInputEnergyByFuel[f_input] || 0) + demand;
        });
    });

    console.log('Hydrogen inputs (recalculated):', hydrogenInputEnergyByFuel);
    Object.entries(hydrogenInputEnergyByFuel).forEach(([fuel, value]) => {
        if (value > 0.001) {
            // Map 'Electricity' to 'Power'
            const source = fuel === 'Electricity' ? 'Power' : fuel;
            addRow(mainRows, source, 'Hydrogen Plants', value);
        }
    });

    // C. Inputs to Sectors
    const orderedSectors = ['Buildings', 'Industry', 'Transport'];
    const sectorFlows = {}; // Aggregate flows by source-sector

    if (fecDetailed) {
        orderedSectors.forEach(sector => {
            if (!subsectors[sector]) return;
            subsectors[sector].forEach(sub => {
                const techs = technologies[sector]?.[sub] || [];
                techs.forEach(tech => {
                    const fuelsConsumed = fecDetailed[sector]?.[sub]?.[tech] || {};
                    Object.entries(fuelsConsumed).forEach(([fuel, value]) => {
                        if (value <= 0.001) return;
                        let source = fuel;
                        if (fuel === 'Electricity') source = 'Power';
                        if (fuel === 'Hydrogen') source = 'Hydrogen Plants';

                        if (!sectorFlows[source]) sectorFlows[source] = {};
                        sectorFlows[source][sector] = (sectorFlows[source][sector] || 0) + value;
                    });
                });
            });
        });

        Object.entries(sectorFlows).forEach(([source, targets]) => {
            Object.entries(targets).forEach(([sector, value]) => {
                addRow(mainRows, source, sector, value);
            });
        });
    }

    // D. Sectors -> Subsectors -> Useful Types / Losses
    if (fecDetailed && ueDetailed) {
        orderedSectors.forEach(sector => {
            if (!subsectors[sector]) return;

            let sectorUsefulByType = {};
            let sectorLosses = 0;

            subsectors[sector].forEach(sub => {
                let subsectorFec = 0;
                let subsectorUe = 0;
                const usefulEnergyByType = {};

                const techs = technologies[sector]?.[sub] || [];
                techs.forEach(tech => {
                    const fVals = fecDetailed[sector]?.[sub]?.[tech] || {};
                    const uVals = ueDetailed[sector]?.[sub]?.[tech] || {};

                    Object.entries(uVals).forEach(([fuel, ueValue]) => {
                        if (ueValue <= 0.001) return;
                        subsectorUe += ueValue;

                        const type = getValue(usefulEnergyTypeMap, [sector, sub, tech, fuel], 'Other');
                        usefulEnergyByType[type] = (usefulEnergyByType[type] || 0) + ueValue;
                        sectorUsefulByType[type] = (sectorUsefulByType[type] || 0) + ueValue;
                    });

                    Object.values(fVals).forEach(v => subsectorFec += v);
                });

                const losses = subsectorFec - subsectorUe;
                sectorLosses += losses;

                if (showSubsectors) {
                    if (subsectorFec > 0.001) {
                        addRow(mainRows, sector, sub, subsectorFec);
                    }

                    Object.entries(usefulEnergyByType).forEach(([type, value]) => {
                        addRow(mainRows, sub, type, value);
                    });

                    if (losses > 0.001) {
                        addRow(lossRows, sub, 'Losses', losses);
                    }
                }
            });

            if (!showSubsectors) {
                Object.entries(sectorUsefulByType).forEach(([type, value]) => {
                    addRow(mainRows, sector, type, value);
                });

                if (sectorLosses > 0.001) {
                    addRow(lossRows, sector, 'Losses', sectorLosses);
                }
            }
        });
    }

    // E. Transformation losses (Input - Output = Loss)
    // Power losses = total fuel inputs - electricity output
    const totalPowerInput = Object.values(powerInputEnergyByFuel).reduce((sum, val) => sum + val, 0);
    const electricityOutput = fecElectricity;
    const powerLosses = totalPowerInput - electricityOutput;

    // Hydrogen losses = total fuel inputs - hydrogen output
    const totalHydrogenInput = Object.values(hydrogenInputEnergyByFuel).reduce((sum, val) => sum + val, 0);
    const hydrogenOutput = fecHydrogen;
    const h2Losses = totalHydrogenInput - hydrogenOutput;

    if (powerLosses > 0.001) {
        addRow(lossRows, 'Power', 'Losses', powerLosses);
    }
    if (h2Losses > 0.001) {
        addRow(lossRows, 'Hydrogen Plants', 'Losses', h2Losses);
    }

    const allRows = [...mainRows, ...lossRows];

    console.log('=== SANKEY ROWS (D3, showSubsectors=' + showSubsectors + ') ===');
    console.log(`Total rows: ${allRows.length}`);

    return allRows;
}

// Expose for global access
window.renderSankey = renderSankey;
