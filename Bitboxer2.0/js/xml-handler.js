/**
 * BITBOXER - XML Handler
 * 
 * This file handles:
 * - Loading presets from XML files
 * - Saving presets to XML files
 * - Exporting pads to JSON/ZIP
 * - Parsing XML structures
 * 
 * Part 1: Loading & Parsing
 */

// ============================================
// XML LOADING & PARSING
// ============================================
/**
 * Loads a preset from an XML file
 * Parses the XML structure and updates the preset data
 * 
 * @param {File} file - XML file to load
 */
async function loadPreset(file) {
    try {
        const text = await file.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'text/xml');

        const { presetData, assetCells } = window.BitboxerData;
        
        // Initialize new preset structure
        window.BitboxerData.presetData = {
            version: '2',
            pads: {},
            tempo: '120'
        };
        window.BitboxerData.assetCells = [];

        // Parse layer 0 cells (pads)
        const cells = xmlDoc.querySelectorAll('cell[layer="0"]');

        cells.forEach(cell => {
            const row = parseInt(cell.getAttribute('row'));
            const col = parseInt(cell.getAttribute('column'));

            if (isNaN(row) || isNaN(col)) return;
            
            if (!window.BitboxerData.presetData.pads[row]) {
                window.BitboxerData.presetData.pads[row] = {};
            }

            // Parse pad data
            const padData = {
                filename: cell.getAttribute('filename') || '',
                type: cell.getAttribute('type'),
                params: {},
                modsources: [],
                slices: []
            };

            // Parse parameters
            const params = cell.querySelector('params');
            if (params) {
                Array.from(params.attributes).forEach(attr => {
                    padData.params[attr.name] = attr.value;
                });
            }

            // Parse modulation sources
            cell.querySelectorAll('modsource').forEach(mod => {
                const modSource = {
                    dest: mod.getAttribute('dest'),
                    src: mod.getAttribute('src'),
                    slot: mod.getAttribute('slot'),
                    amount: mod.getAttribute('amount')
                };

                // Add MIDI CC attributes if present
                const mchan = mod.getAttribute('mchan');
                const ccnum = mod.getAttribute('ccnum');
                if (mchan !== null) modSource.mchan = mchan;
                if (ccnum !== null) modSource.ccnum = ccnum;

                padData.modsources.push(modSource);
            });

            // Parse slices
            const slicesNode = cell.querySelector('slices');
            if (slicesNode) {
                slicesNode.querySelectorAll('slice').forEach(slice => {
                    padData.slices.push({
                        pos: slice.getAttribute('pos')
                    });
                });
            }

            window.BitboxerData.presetData.pads[row][col] = padData;
        });

        // Parse asset cells (multi-samples)
        const assetNodes = xmlDoc.querySelectorAll('cell[type="asset"]');
        assetNodes.forEach((asset, index) => {
            const params = asset.querySelector('params');
            if (params) {
                window.BitboxerData.assetCells.push({
                    row: index,
                    filename: asset.getAttribute('filename') || '',
                    params: {
                        rootnote: params.getAttribute('rootnote') || '60',
                        keyrangebottom: params.getAttribute('keyrangebottom') || '0',
                        keyrangetop: params.getAttribute('keyrangetop') || '127',
                        velroot: params.getAttribute('velroot') || '64',
                        velrangebottom: params.getAttribute('velrangebottom') || '0',
                        velrangetop: params.getAttribute('velrangetop') || '127',
                        asssrcrow: params.getAttribute('asssrcrow') || '0',
                        asssrccol: params.getAttribute('asssrccol') || '0'
                    }
                });
            }
        });

        // Fill missing pads
        for (let row = 0; row < 4; row++) {
            if (!window.BitboxerData.presetData.pads[row]) {
                window.BitboxerData.presetData.pads[row] = {};
            }
            for (let col = 0; col < 4; col++) {
                if (!window.BitboxerData.presetData.pads[row][col]) {
                    window.BitboxerData.presetData.pads[row][col] = window.BitboxerData.createEmptyPadData();
                }
            }
        }

        // Initialize FX structure
        if (!window.BitboxerData.presetData.fx) {
            window.BitboxerData.presetData.fx = window.BitboxerData.createEmptyFXData();
        }

        // Parse FX cells (layer 3)
        const fxCells = xmlDoc.querySelectorAll('cell[layer="3"]');

        fxCells.forEach(cell => {
            const row = parseInt(cell.getAttribute('row'));
            const type = cell.getAttribute('type');

            if (type === 'delay' || type === 'reverb' || type === 'eq') {
                if (!window.BitboxerData.presetData.fx[type]) {
                    window.BitboxerData.presetData.fx[type] = {
                        type: type,
                        params: {},
                        modsources: []
                    };
                }

                // Parse parameters
                const params = cell.querySelector('params');
                if (params) {
                    Array.from(params.attributes).forEach(attr => {
                        window.BitboxerData.presetData.fx[type].params[attr.name] = attr.value;
                    });
                }

                // Parse modulation sources
                window.BitboxerData.presetData.fx[type].modsources = [];
                cell.querySelectorAll('modsource').forEach(mod => {
                    const modSource = {
                        dest: mod.getAttribute('dest'),
                        src: mod.getAttribute('src'),
                        slot: mod.getAttribute('slot'),
                        amount: mod.getAttribute('amount')
                    };

                    const mchan = mod.getAttribute('mchan');
                    const ccnum = mod.getAttribute('ccnum');
                    if (mchan !== null) modSource.mchan = mchan;
                    if (ccnum !== null) modSource.ccnum = ccnum;

                    window.BitboxerData.presetData.fx[type].modsources.push(modSource);
                });
            }
        });

        // Parse song settings
        const songCell = xmlDoc.querySelector('cell[type="song"]');
        if (songCell) {
            const params = songCell.querySelector('params');
            if (params) {
                window.BitboxerData.presetData.tempo = params.getAttribute('globtempo') || '120';
            }
        }

        // Update UI
        window.BitboxerUI.updatePadDisplay();
        window.BitboxerData.initializeProject();
        window.BitboxerUtils.setStatus(
            `Loaded: ${file.name} (${window.BitboxerData.assetCells.length} multi-sample assets)`, 
            'success'
        );
    } catch (error) {
        window.BitboxerUtils.setStatus(`Error loading: ${error.message}`, 'error');
        console.error(error);
    }
}

// ============================================
// XML GENERATION HELPERS
// ============================================
/**
 * Generates XML for a single cell (pad or FX)
 * 
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @param {number} layer - Layer index (0=pads, 3=FX)
 * @param {Object} cellData - Cell data object
 * @returns {string} XML string for the cell
 */
function generateCellXML(row, col, layer, cellData) {
    let xml = `        <cell row="${row}"`;
    if (layer === 0) {
        xml += ` column="${col}"`;
    }
    xml += ` layer="${layer}" filename="${cellData.filename || ''}" type="${cellData.type}">\n`;
    
    // Add parameters
    xml += '            <params';
    for (let [key, value] of Object.entries(cellData.params)) {
        xml += ` ${key}="${value}"`;
    }
    xml += '/>\n';
    
    // Add modulation sources (filter out 'none' slots)
    if (cellData.modsources?.length > 0) {
        const activeModSlots = cellData.modsources.filter(mod =>
            mod.src !== 'none' && mod.dest !== 'none' && mod.src && mod.dest
        );

        activeModSlots.forEach(mod => {
            xml += `            <modsource dest="${mod.dest}" src="${mod.src}"`;
            
            // Add MIDI CC attributes if present
            if (mod.mchan !== undefined) {
                xml += ` mchan="${mod.mchan}"`;
            }
            if (mod.ccnum !== undefined) {
                xml += ` ccnum="${mod.ccnum}"`;
            }
            
            xml += ` slot="${mod.slot}" amount="${mod.amount}"/>\n`;
        });
    }
    
    // Add slices (for pads)
    if (layer === 0) {
        if (cellData.slices && cellData.slices.length > 0) {
            xml += '            <slices>\n';
            cellData.slices.forEach(slice => {
                xml += `                <slice pos="${slice.pos}"/>\n`;
            });
            xml += '            </slices>\n';
        } else {
            xml += '            <slices/>\n';
        }
    }
    
    xml += '        </cell>\n';
    return xml;
}

// ============================================
// XML SAVING
// ============================================
/**
 * Saves the current preset as an XML file
 */
function savePreset() {
    const { presetData } = window.BitboxerData;
    
    if (!presetData) {
        window.BitboxerUtils.setStatus('No preset to save', 'error');
        return;
    }

    try {
        const xml = generatePresetXML(presetData);
        const blob = new Blob([xml], { type: 'text/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'preset.xml';
        a.click();
        URL.revokeObjectURL(url);

        window.BitboxerUtils.setStatus('Preset saved successfully', 'success');
    } catch (error) {
        window.BitboxerUtils.setStatus(`Error saving: ${error.message}`, 'error');
        console.error(error);
    }
}

/**
 * Generates complete preset XML from data structure
 * 
 * @param {Object} data - Preset data object
 * @returns {string} Complete XML string
 */
function generatePresetXML(data) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<document>\n    <session version="2">\n';

    // Layer 0 - Pads (iterate column first, then row)
    for (let col = 0; col < 4; col++) {
        for (let row = 0; row < 4; row++) {
            const pad = data.pads[row]?.[col];
            if (!pad) continue;

            xml += generatePadCellXML(row, col, pad);
        }
    }

    // Layer 3 - FX
    const fxTypes = ['delay', 'reverb', 'eq'];
    const fxDefaults = window.BitboxerData.createEmptyFXData();

    for (let i = 0; i < 5; i++) {
        let fxType = null;
        let fxData = null;

        if (i === 0) {
            fxType = 'delay';
            fxData = data.fx?.delay || fxDefaults.delay;
        } else if (i === 1) {
            fxType = 'reverb';
            fxData = data.fx?.reverb || fxDefaults.reverb;
        } else if (i === 2) {
            fxType = 'eq';
            fxData = data.fx?.eq || fxDefaults.eq;
        } else {
            // Null FX for slots 3 and 4
            xml += `        <cell row="${i}" layer="3" type="null">\n`;
            xml += '            <params/>\n';
            xml += '        </cell>\n';
            continue;
        }

        xml += generateFXCellXML(i, fxType, fxData);
    }

    // Asset cells - preserve multi-sample references
    const { assetCells } = window.BitboxerData;
    assetCells.forEach((asset, index) => {
        xml += `        <cell row="${index}" filename="${asset.filename}" type="asset">\n`;
        xml += `            <params rootnote="${asset.params.rootnote}" keyrangebottom="${asset.params.keyrangebottom}" keyrangetop="${asset.params.keyrangetop}" velroot="${asset.params.velroot}" velrangebottom="${asset.params.velrangebottom}" velrangetop="${asset.params.velrangetop}" asssrcrow="${asset.params.asssrcrow}" asssrccol="${asset.params.asssrccol}"/>\n`;
        xml += '        </cell>\n';
    });

    // Layer 8 - Inputs
    for (let i = 0; i < 8; i++) {
        xml += `        <cell row="${i}" layer="8" type="ioconnectin">\n`;
        xml += '            <params inputiocon="gatein"/>\n';
        xml += '        </cell>\n';
    }

    // Layer 9 - Outputs
    const outputs = [
        'chanout1', 'chanout2', 'chanout3', 'chanout4',
        'chanout5', 'chanout6', 'masterout1', 'masterout2'
    ];
    for (let i = 0; i < 8; i++) {
        xml += `        <cell row="${i}" layer="9" type="ioconnectout">\n`;
        xml += `            <params outputiocon="${outputs[i]}"/>\n`;
        xml += '        </cell>\n';
    }

    // Song settings
    xml += `        <cell type="song">\n`;
    xml += `            <params globtempo="${data.tempo}" songmode="0" sectcount="1" sectloop="1" swing="50" keymode="1" keyroot="3"/>\n`;
    xml += '        </cell>\n';
    
    xml += '    </session>\n</document>\n';

    return xml;
}

/**
 * Generates XML for a pad cell
 * 
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @param {Object} pad - Pad data
 * @returns {string} XML string
 */
function generatePadCellXML(row, col, pad) {
    let xml = `        <cell row="${row}" column="${col}" layer="0" filename="${pad.filename}" type="${pad.type}">\n`;
    
    // Parameters
    xml += '            <params';
    for (let [key, value] of Object.entries(pad.params)) {
        xml += ` ${key}="${value}"`;
    }
    xml += '/>\n';

    // Modulation sources (filter out 'none' slots)
    if (pad.modsources?.length > 0) {
        const activeModSlots = pad.modsources.filter(mod =>
            mod.src !== 'none' && mod.dest !== 'none' && mod.src && mod.dest
        );

        activeModSlots.forEach(mod => {
            xml += `            <modsource dest="${mod.dest}" src="${mod.src}"`;
            if (mod.mchan !== undefined) xml += ` mchan="${mod.mchan}"`;
            if (mod.ccnum !== undefined) xml += ` ccnum="${mod.ccnum}"`;
            xml += ` slot="${mod.slot}" amount="${mod.amount}"/>\n`;
        });
    }

    // Slices
    if (pad.slices && pad.slices.length > 0) {
        xml += '            <slices>\n';
        pad.slices.forEach(slice => {
            xml += `                <slice pos="${slice.pos}"/>\n`;
        });
        xml += '            </slices>\n';
    } else {
        xml += '            <slices/>\n';
    }

    xml += '        </cell>\n';
    return xml;
}

/**
 * Generates XML for an FX cell
 * 
 * @param {number} row - Row index
 * @param {string} fxType - FX type ('delay', 'reverb', 'eq')
 * @param {Object} fxData - FX data
 * @returns {string} XML string
 */
function generateFXCellXML(row, fxType, fxData) {
    let xml = `        <cell row="${row}" layer="3" type="${fxType}">\n`;
    
    // Parameters
    xml += '            <params';
    for (let [key, value] of Object.entries(fxData.params)) {
        xml += ` ${key}="${value}"`;
    }
    xml += '/>\n';

    // Modulation sources (filter out 'none')
    if (fxData.modsources?.length > 0) {
        const activeModSlots = fxData.modsources.filter(mod =>
            mod.src !== 'none' && mod.dest !== 'none' && mod.src && mod.dest
        );

        // Group by destination and assign slot numbers 0-2 per destination
        const destGroups = {};
        activeModSlots.forEach(mod => {
            if (!destGroups[mod.dest]) {
                destGroups[mod.dest] = [];
            }
            destGroups[mod.dest].push(mod);
        });

        // Write with corrected slot numbers
        Object.values(destGroups).forEach(group => {
            group.forEach((mod, index) => {
                xml += `            <modsource dest="${mod.dest}" src="${mod.src}"`;
                if (mod.mchan !== undefined) xml += ` mchan="${mod.mchan}"`;
                if (mod.ccnum !== undefined) xml += ` ccnum="${mod.ccnum}"`;
                xml += ` slot="${index}" amount="${mod.amount}"/>\n`;
            });
        });
    }

    xml += '        </cell>\n';
    return xml;
}

// ============================================
// PAD EXPORT (JSON/ZIP)
// ============================================
/**
 * Exports selected pads to JSON (single) or ZIP (multiple)
 */
async function exportSelectedPads() {
    const { selectedPads, presetData, projectName, assetCells } = window.BitboxerData;
    const { CELL_MODE_NAMES } = window.BITBOXER_CONFIG;

    if (selectedPads.size === 0) {
        window.BitboxerUtils.setStatus('No pads selected', 'error');
        return;
    }
    // Safety check: ensure presetData exists
    if (!presetData || !presetData.pads) {
        window.BitboxerUtils.setStatus('No preset loaded. Create or load a preset first.', 'error');
        return;
    }

    const files = {};

    for (const padNum of selectedPads) {
        const pad = document.querySelector(`[data-padnum="${padNum}"]`);
        const row = parseInt(pad.dataset.row);
        const col = parseInt(pad.dataset.col);
        const padData = presetData.pads[row][col];

        if (!padData) continue;

        // Get sample name
        let sampleName = 'Empty';
        if (padData.filename) {
            sampleName = padData.filename.split(/[/\\]/).pop().replace(/\.(wav|WAV)$/, '');
        }

        // Get playmode
        const cellmode = padData.params.cellmode || '0';
        const playmode = CELL_MODE_NAMES[cellmode] || 'Sample';

        // Check for multisample mode
        const isMultisample = padData.params.multisammode === '1';
        const finalPlaymode = isMultisample ? 'Multisample' : playmode;

        // Build filename
        const filename = `${projectName}_${sampleName}_${finalPlaymode}_Pad${padNum.toString().padStart(2, '0')}.json`;

        // Build export data
        const exportData = {
            padNumber: padNum,
            row: row,
            col: col,
            projectName: projectName,
            sampleName: sampleName,
            playmode: finalPlaymode,
            data: {
                filename: padData.filename,
                type: padData.type,
                params: padData.params,
                modsources: padData.modsources || [],
                slices: padData.slices || []
            }
        };

        // Add asset references if multisample
        if (isMultisample) {
            exportData.assetReferences = assetCells.filter(asset =>
                parseInt(asset.params.asssrcrow) === row &&
                parseInt(asset.params.asssrccol) === col
            );
        }

        files[filename] = JSON.stringify(exportData, null, 2);
    }

    // Single pad - download directly as JSON
    if (selectedPads.size === 1) {
        const filename = Object.keys(files)[0];
        const content = files[filename];
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        window.BitboxerUtils.setStatus(`Exported 1 pad as JSON`, 'success');
        return;
    }

    // Multiple pads - create ZIP using fflate
    try {
        const filesForZip = {};
        for (const [name, content] of Object.entries(files)) {
            filesForZip[name] = new TextEncoder().encode(content);
        }

        const zipped = fflate.zipSync(filesForZip);
        const blob = new Blob([zipped], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectName}_pads_export.zip`;
        a.click();
        URL.revokeObjectURL(url);

        window.BitboxerUtils.setStatus(`Exported ${selectedPads.size} pads to ZIP`, 'success');
    } catch (error) {
        window.BitboxerUtils.setStatus(`Error creating ZIP: ${error.message}`, 'error');
        console.error(error);
    }
}

// ============================================
// EXPORT XML HANDLER
// ============================================
window.BitboxerXML = {
    loadPreset,
    savePreset,
    generatePresetXML,
    exportSelectedPads
};
