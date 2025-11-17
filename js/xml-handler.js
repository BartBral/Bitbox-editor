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

        // After loading all pads, check for multisample references
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                const pad = window.BitboxerData.presetData.pads[row][col];
                if (pad && pad.params.multisammode === '1') {
                    // This pad uses multisamples - ensure it's marked as 'sample' type
                    if (!pad.filename) {
                        // Find the first asset that references this pad
                        const asset = window.BitboxerData.assetCells.find(a => 
                            parseInt(a.params.asssrcrow) === row && 
                            parseInt(a.params.asssrccol) === col
                        );
                        if (asset) {
                            pad.filename = asset.filename;
                            pad.type = 'sample';
                        }
                    }
                }
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

/**
 * Find the WAV file object for a given filename
 * Searches through the last import's WAV files
 */
async function findWAVFileForAsset(wavFileName) {
    // Check if we have a reference to the last imported files
    if (!window._lastImportedFiles) {
        console.warn('No imported files cached');
        return null;
    }
    
    console.log(`Looking for: "${wavFileName}" in cache of ${window._lastImportedFiles.size} files`);
    
    // Try exact match first
    if (window._lastImportedFiles.has(wavFileName)) {
        console.log(`✓ Exact match: ${wavFileName}`);
        return window._lastImportedFiles.get(wavFileName);
    }
    
    // Try case-insensitive match
    const lowerFileName = wavFileName.toLowerCase();
    for (const [path, file] of window._lastImportedFiles.entries()) {
        const fileName = path.split(/[/\\]/).pop().toLowerCase();
        if (fileName === lowerFileName) {
            console.log(`✓ Found: ${file.name}`);
            return file;
        }
    }
    
    console.warn(`✗ Not found: ${wavFileName}`);
    return null;
}


// ============================================
// XML SAVING
// ============================================
/**
 * Saves the current preset as a ZIP file with proper folder structure
 */
async function savePreset() {
    const { presetData, projectName, assetCells } = window.BitboxerData;
    console.log('=== SAVING PRESET ===');
    console.log('Project name:', projectName);

    if (!presetData) {
        window.BitboxerUtils.setStatus('No preset to save', 'error');
        return;
    }

    try {
        // Generate XML
        const xml = generatePresetXML(presetData);
        
        // Create ZIP file structure
        const files = {};
        
        // Add preset.xml at root level
        files[`${projectName}/preset.xml`] = new TextEncoder().encode(xml);

        console.log('ZIP Structure:');
        console.log(`  Root: ${projectName}/`);

        // Collect all unique multisample folders
        const multisamFolders = new Set();
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                const pad = presetData.pads[row][col];
                if (pad.params.multisammode === '1' && pad.filename) {
                    // Extract folder name from filename like ".\Trumpet"
                    const folderName = pad.filename.replace('.\\', '').replace('./', '');
                    if (folderName) {
                        multisamFolders.add(folderName);
                    }
                }
            }
        }
        

        // Add regular (non-multisample) WAV files at root level
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                const pad = presetData.pads[row][col];
                
                // Skip if empty or multisample
                if (!pad.filename || pad.params.multisammode === '1') continue;
                
                const wavName = pad.filename.split(/[/\\]/).pop();
                if (wavName.endsWith('.wav') || wavName.endsWith('.WAV')) {
                    const wavFile = await findWAVFileForAsset(wavName);
                    if (wavFile) {
                        const wavData = await wavFile.arrayBuffer();
                        files[`${projectName}/${wavName}`] = new Uint8Array(wavData);
                        console.log(`  ✓ Added regular sample: ${wavName}`);
                    } else {
                        console.warn(`  ✗ Missing regular sample: ${wavName}`);
                    }
                }
            }
        }

        // Add actual WAV files to multisample folders
        for (const folder of multisamFolders) {
            console.log(`  Adding WAV files to: ${projectName}/${folder}/`);

            // Find all asset cells for this folder
            const folderAssets = assetCells.filter(asset => {
                const assetFolder = asset.filename.split('\\')[1];
                return assetFolder === folder;
            });

            // Track which files were expected and which were found
            const expectedFiles = [];
            const missingFiles = [];

            for (const asset of folderAssets) {
                const wavFileName = asset.filename.split('\\').pop();
                expectedFiles.push(wavFileName);

                // Find the corresponding WAV file from the import
                const wavFile = await findWAVFileForAsset(wavFileName);

                if (wavFile) {
                    // Read the WAV file as ArrayBuffer
                    const wavData = await wavFile.arrayBuffer();
                    const wavBytes = new Uint8Array(wavData);

                    // Add to ZIP with correct path
                    files[`${projectName}/${folder}/${wavFileName}`] = wavBytes;
                    console.log(`    ✓ Added: ${wavFileName}`);
                } else {
                    console.warn(`    ✗ Missing: ${wavFileName}`);
                    missingFiles.push(wavFileName);

                    // Add placeholder so structure is correct
                    const warning = `WARNING: ${wavFileName} was not found.\nPlease add this file manually.`;
                    files[`${projectName}/${folder}/${wavFileName}.missing.txt`] = new TextEncoder().encode(warning);
                }
            }

            // After processing all samples, create a README.txt file listing expected files
            const readmeContent = [
                `This folder should contain the following WAV files:\n`,
                ...expectedFiles.map(name => `- ${name}`),
                '',
                missingFiles.length > 0
                    ? `Missing files:\n${missingFiles.map(name => `- ${name}`).join('\n')}\n`
                    : 'All files are present.\n',
                'Be sure all files are here before loading into Bitbox.'
            ].join('\n');

            // Add README.txt to the folder
            files[`${projectName}/${folder}/README.txt`] = new TextEncoder().encode(readmeContent);
            console.log(`    ✓ Created README.txt for ${folder}`);
        }


        // Create ZIP
        const zipped = fflate.zipSync(files);
        const blob = new Blob([zipped], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectName}.zip`;
        a.click();
        URL.revokeObjectURL(url);

        window.BitboxerUtils.setStatus(
            `Preset saved as ZIP with ${multisamFolders.size} multisample folder(s)`, 
            'success'
        );
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
    // ← ONLY SAVE PADS WITH CONTENT
    for (let col = 0; col < 4; col++) {
        for (let row = 0; row < 4; row++) {
            const pad = data.pads[row]?.[col];
            if (!pad) continue;

            // ← ADD THIS CHECK: Skip empty pads
            if (!pad.filename || pad.filename === '' || pad.type === 'samtempl') {
                // Empty pad - write minimal samtempl cell
                xml += `        <cell row="${row}" column="${col}" layer="0" filename="" type="samtempl">\n`;
                xml += '            <params';
                for (let [key, value] of Object.entries(pad.params)) {
                    xml += ` ${key}="${value}"`;
                }
                xml += '/>\n';
                xml += '            <slices/>\n';
                xml += '        </cell>\n';
            } else {
                // Active pad - full cell
                xml += generatePadCellXML(row, col, pad);
            }
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
    // Determine correct type: 'sample' if loaded, 'samtempl' if empty
    const isLoaded = pad.filename && pad.filename !== '';
    const cellType = isLoaded ? 'sample' : 'samtempl';
    
    let xml = `        <cell row="${row}" column="${col}" layer="0" filename="${pad.filename}" type="${cellType}">\n`;
    
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

    if (!presetData || !presetData.pads) {
        window.BitboxerUtils.setStatus('No preset loaded', 'error');
        return;
    }

    // Export each pad as individual ZIP
    for (const padNum of selectedPads) {
        await exportSinglePadAsZip(padNum);
    }

    window.BitboxerUtils.setStatus(
        `Exported ${selectedPads.size} pad(s) as individual ZIP files`, 
        'success'
    );
}

/**
 * Exports a single pad as a self-contained ZIP with JSON + WAV files
 */
async function exportSinglePadAsZip(padNum) {
    const { presetData, projectName, assetCells } = window.BitboxerData;
    const { CELL_MODE_NAMES } = window.BITBOXER_CONFIG;
    
    const pad = document.querySelector(`[data-padnum="${padNum}"]`);
    const row = parseInt(pad.dataset.row);
    const col = parseInt(pad.dataset.col);
    const padData = presetData.pads[row][col];

    if (!padData) return;

    // Get sample name
    let sampleName = 'Empty';
    if (padData.filename) {
        sampleName = padData.filename.split(/[/\\]/).pop().replace(/\.(wav|WAV)$/, '');
    }

    // Get playmode
    const cellmode = padData.params.cellmode || '0';
    const playmode = CELL_MODE_NAMES[cellmode] || 'Sample';
    const isMultisample = padData.params.multisammode === '1';
    const finalPlaymode = isMultisample ? 'Multisample' : playmode;

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

    // Track WAV files needed
    const wavFilesNeeded = new Set();

    // Add asset references if multisample
    if (isMultisample) {
        const assets = assetCells.filter(asset =>
            parseInt(asset.params.asssrcrow) === row &&
            parseInt(asset.params.asssrccol) === col
        );
        exportData.assetReferences = assets;
        
        // Track WAV files
        assets.forEach(asset => {
            const wavName = asset.filename.split(/[/\\]/).pop();
            wavFilesNeeded.add(wavName);
        });
    } else if (padData.filename) {
        // Single sample
        const wavName = padData.filename.split(/[/\\]/).pop();
        if (wavName.endsWith('.wav') || wavName.endsWith('.WAV')) {
            wavFilesNeeded.add(wavName);
        }
    }

    // Create ZIP
    try {
        const filesForZip = {};
        
        // Add JSON file
        const jsonFilename = `pad_${padNum.toString().padStart(2, '0')}.json`;
        filesForZip[jsonFilename] = new TextEncoder().encode(JSON.stringify(exportData, null, 2));

        // Add WAV files
        let foundWavs = 0;
        let missingWavs = 0;
        
        for (const wavName of wavFilesNeeded) {
            const wavFile = await findWAVFileForAsset(wavName);
            if (wavFile) {
                const wavData = await wavFile.arrayBuffer();
                filesForZip[wavName] = new Uint8Array(wavData);
                foundWavs++;
                console.log(`✓ Added WAV: ${wavName}`);
            } else {
                missingWavs++;
                console.warn(`✗ Missing WAV: ${wavName}`);
                filesForZip[`${wavName}.missing.txt`] = new TextEncoder().encode(
                    `WARNING: ${wavName} was not found.\nPlease add this file manually.`
                );
            }
        }

        // Generate ZIP filename
        const zipFilename = `${projectName}_${sampleName}_${finalPlaymode}_Pad${padNum.toString().padStart(2, '0')}.zip`;

        const zipped = fflate.zipSync(filesForZip);
        const blob = new Blob([zipped], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = zipFilename;
        a.click();
        URL.revokeObjectURL(url);

        console.log(`Exported: ${zipFilename} (${foundWavs} samples)`);
    } catch (error) {
        console.error(`Error exporting pad ${padNum}:`, error);
        window.BitboxerUtils.setStatus(`Error exporting pad ${padNum}`, 'error');
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
