/**
 * BITBOXER - Import Handler
 * 
 * Orchestrates all file import operations:
 * - Unified import routing (XML/ZIP/SFZ/WAV)
 * - SFZ to preset/pad conversion
 * - Missing sample resolution
 * - Preset merging
 * - Auto-loading referenced samples
 */

// ============================================
// UNIFIED IMPORT ROUTER
// ============================================

/**
 * Unified import handler - routes files to appropriate processors
 * Handles XML, ZIP, SFZ, WAV, JSON individually or in bulk
 * 
 * @param {File|Array} files - File(s) to import
 * @param {string} source - Import source ('button', 'drag-grid', 'drag-pad', 'folder')
 * @param {HTMLElement} targetPad - Target pad for single-file imports (optional)
 */
async function unifiedImportHandler(files, source, targetPad = null) {
    console.log('=== UNIFIED HANDLER ===');
    console.log('Files:', files);
    console.log('Source:', source);
    
    const fileArray = Array.isArray(files) ? files : [files];
    
    // File type detection
    const hasXML = fileArray.some(f => f.name.endsWith('.xml'));
    const hasZIP = fileArray.some(f => f.name.endsWith('.zip'));
    const hasSFZ = fileArray.some(f => f.name.endsWith('.sfz'));
    const hasWAV = fileArray.some(f => f.name.endsWith('.wav'));
    const hasJSON = fileArray.some(f => f.name.endsWith('.json'));
    
    // Single file handling
    if (fileArray.length === 1) {
        const file = fileArray[0];
        
        // JSON pad export
        if (hasJSON) {
            if (!targetPad) {
                window.BitboxerUtils.setStatus('JSON must target specific pad', 'error');
                return;
            }
            await loadPadFromJSON(file, targetPad);
            return;
        }
        
        // XML preset
        if (hasXML) {
            const choice = await promptLoadOrMerge();
            if (choice === 'cancel') return;
            
            if (choice === 'replace') {
                window.BitboxerData.createEmptyPreset();
                await window.BitboxerXML.loadPreset(file);
                await autoLoadReferencedSamples();
            } else {
                await mergePreset(file);
                await autoLoadReferencedSamples();
            }
            return;
        }
        
        // ZIP file - examine contents
        if (hasZIP) {
            try {
                window.BitboxerUtils.setStatus('Processing ZIP...', 'info');
                const result = await window.BitboxerFileHandler.FileImporter.import(file);
                window._lastImportedFiles = result.collection.files;
                
                const hasPresetXML = result.xmlFiles.length > 0;
                const hasPadJSON = Array.from(result.collection.files.keys())
                    .some(path => /pad_\d{2}\.json/.test(path));
                const hasSFZInside = result.sfzFiles.length > 0;
                
                if (hasPadJSON) {
                    if (!targetPad) {
                        window.BitboxerUtils.setStatus('Pad ZIP must target specific pad', 'error');
                        return;
                    }
                    await loadPadFromZIP(file, targetPad);
                    return;
                }
                
                if (hasPresetXML) {
                    const choice = await promptLoadOrMerge();
                    if (choice === 'cancel') return;
                    
                    if (choice === 'replace') {
                        window.BitboxerData.createEmptyPreset();
                        await window.BitboxerXML.loadPreset(result.xmlFiles[0].file);
                        await autoLoadReferencedSamples();
                    } else {
                        await mergePreset(result.xmlFiles[0].file);
                        await autoLoadReferencedSamples();
                    }
                    return;
                }
                
                if (hasSFZInside) {
                    if (!targetPad) {
                        window.BitboxerUtils.setStatus('SFZ must target specific pad', 'error');
                        return;
                    }
                    const importResult = await handleMissingSamples(result.sfzFiles[0], result.wavFiles);
                    if (!importResult.cancelled) {
                        await convertSFZToPad(result.sfzFiles[0], importResult.wavFiles, targetPad);
                    }
                    return;
                }
                
                window.BitboxerUtils.setStatus('ZIP contains no valid preset/pad', 'error');
            } catch (error) {
                console.error('ZIP import error:', error);
                window.BitboxerUtils.setStatus(`ZIP import failed: ${error.message}`, 'error');
            }
            return;
        }
        
        // SFZ file
        if (hasSFZ) {
            if (!targetPad) {
                window.BitboxerUtils.setStatus('SFZ must target specific pad', 'error');
                return;
            }
            try {
                window.BitboxerUtils.setStatus('Processing SFZ...', 'info');
                const result = await window.BitboxerFileHandler.FileImporter.import(file);
                if (result.sfzFiles.length > 0) {
                    const importResult = await handleMissingSamples(result.sfzFiles[0], result.wavFiles);
                    if (!importResult.cancelled) {
                        await convertSFZToPad(result.sfzFiles[0], importResult.wavFiles, targetPad);
                    }
                }
            } catch (error) {
                console.error('SFZ import error:', error);
                window.BitboxerUtils.setStatus(`SFZ import failed: ${error.message}`, 'error');
            }
            return;
        }
        
        // WAV file
        if (hasWAV) {
            if (!targetPad) {
                window.BitboxerUtils.setStatus('WAV must target specific pad', 'error');
                return;
            }
            
            try {
                window.BitboxerUtils.setStatus('Processing WAV...', 'info');
                
                // Cache file
                if (!window._lastImportedFiles) window._lastImportedFiles = new Map();
                window._lastImportedFiles.set(file.name, file);
                
                const result = await window.BitboxerFileHandler.FileImporter.import(file);
                const wavData = result.wavFiles[0];
                
                const row = parseInt(targetPad.dataset.row);
                const col = parseInt(targetPad.dataset.col);
                const pad = window.BitboxerData.presetData.pads[row][col];
                
                pad.filename = wavData.name;
                pad.type = 'sample';
                
                // Apply WAV metadata
                const duration = wavData.metadata.duration || 0;
                if (duration > 0) {
                    const sampleRate = wavData.metadata.sampleRate || 44100;
                    const totalSamples = Math.floor(sampleRate * duration);
                    pad.params.samlen = totalSamples.toString();
                    if (pad.params.loopend === '0') {
                        pad.params.loopend = totalSamples.toString();
                    }
                }
                
                if (wavData.metadata.loopPoints) {
                    pad.params.loopstart = wavData.metadata.loopPoints.start.toString();
                    pad.params.loopend = wavData.metadata.loopPoints.end.toString();
                    pad.params.loopmode = '1';
                    if (wavData.metadata.loopPoints.type === 1) {
                        pad.params.loopmodes = '2';
                    }
                }
                
                if (wavData.metadata.slices && wavData.metadata.slices.length > 1) {
                    pad.params.cellmode = '2';
                    pad.slices = wavData.metadata.slices.map(pos => ({ pos: pos.toString() }));
                }
                
                if (wavData.metadata.tempo) {
                    window.BitboxerData.presetData.tempo = Math.round(wavData.metadata.tempo).toString();
                }
                
                window.BitboxerUI.updatePadDisplay();
                window.BitboxerUtils.setStatus(`Loaded ${wavData.name}`, 'success');
            } catch (error) {
                console.error('WAV import error:', error);
                window.BitboxerUtils.setStatus(`WAV failed: ${error.message}`, 'error');
            }
            return;
        }
    }
    
    // Multiple files = bulk preset import
    if (fileArray.length > 1) {
        if (!confirm(`Import ${fileArray.length} files? All pads will be lost!`)) return;
        
        try {
            window.BitboxerUtils.setStatus('Importing files...', 'info');
            const result = await window.BitboxerFileHandler.FileImporter.import(fileArray);
            await processImportedFiles(result);
        } catch (error) {
            console.error('Import error:', error);
            window.BitboxerUtils.setStatus(`Import failed: ${error.message}`, 'error');
        }
    }
}

// ============================================
// PROCESSED FILES HANDLER
// ============================================

/**
 * Processes imported files after FileHandler collection
 * Routes SFZ/WAV to appropriate converters
 * 
 * @param {Object} result - Processed file collection from FileHandler
 */
async function processImportedFiles(result) {
    window._lastImportedFiles = result.collection.files;
    
    try {
        // SFZ files with samples
        if (result.sfzFiles.length > 0) {
            const sfzFile = result.sfzFiles[0];
            const importResult = await handleMissingSamples(sfzFile, result.wavFiles);
            
            if (importResult.cancelled) {
                window.BitboxerUtils.setStatus('Import cancelled', 'info');
                return;
            }
            
            await convertSFZToPreset(sfzFile, importResult.wavFiles);
            return;
        }
        
        // Just WAV files
        if (result.wavFiles.length > 0) {
            assignWAVsToPads(result.wavFiles);
            return;
        }
        
        window.BitboxerUtils.setStatus('No supported files found', 'error');
    } catch (error) {
        console.error('Processing error:', error);
        window.BitboxerUtils.setStatus(`Import failed: ${error.message}`, 'error');
    }
}

// ============================================
// SFZ CONVERSION
// ============================================

/**
 * Converts SFZ to full preset (all regions as multisample on one pad)
 * 
 * @param {Object} sfzData - Parsed SFZ data
 * @param {Array} wavFiles - Array of WAV file data
 */
async function convertSFZToPreset(sfzData, wavFiles) {
    window.BitboxerData.createEmptyPreset();
    
    if (!window.BitboxerData.projectName || window.BitboxerData.projectName === '') {
        window.BitboxerData.initializeProject();
    }
    
    const { presetData } = window.BitboxerData;
    const row = 0, col = 0;
    const pad = presetData.pads[row][col];
    
    // Setup multisample mode
    pad.type = 'sample';
    pad.params.multisammode = '1';
    
    const multisamFolder = sfzData.file.name.replace('.sfz', '');
    pad.filename = `.\\${multisamFolder}`;
    
    // Create asset cells
    const assetCells = [];
    let validRegions = 0;
    
    for (let i = 0; i < sfzData.regions.length; i++) {
        const region = sfzData.regions[i];
        if (!region.wavFile) continue;
        
        const asset = createAssetFromSFZRegion(region, row, col, i);
        assetCells.push(asset);
        validRegions++;
    }
    
    window.BitboxerData.assetCells = assetCells;
    
    if (sfzData.global) {
        applySFZOpcodesToPad(pad, sfzData.global, {});
    }
    
    window.BitboxerUI.updatePadDisplay();
    window.BitboxerUtils.setStatus(
        `Imported multisample: ${validRegions} layers from ${sfzData.file.name}`,
        'success'
    );
}

/**
 * Converts SFZ to single pad (with layer detection)
 * Handles stacked layers vs velocity layers
 * 
 * @param {Object} sfzData - Parsed SFZ data
 * @param {Array} wavFiles - Array of WAV file data
 * @param {HTMLElement} targetPad - Target pad element
 */
async function convertSFZToPad(sfzData, wavFiles, targetPad) {
    const row = parseInt(targetPad.dataset.row);
    const col = parseInt(targetPad.dataset.col);
    const { presetData, assetCells } = window.BitboxerData;
    
    const validRegions = sfzData.regions.filter(r => r.wavFile);
    
    if (validRegions.length === 0) {
        window.BitboxerUtils.setStatus('No valid samples in SFZ', 'error');
        return;
    }
    
    const layerAnalysis = analyzeSFZLayers(validRegions);
    
    // Stacked layers - prompt for pad mapping
    if (layerAnalysis.isStacked) {
        window.BitboxerUtils.setStatus('Stacked layers detected...', 'info');
        const mappings = await promptLayerToPadMapping(validRegions, targetPad);
        
        if (!mappings || mappings.length === 0) {
            window.BitboxerUtils.setStatus('Import cancelled', 'info');
            return;
        }
        
        for (const mapping of mappings) {
            const pad = presetData.pads[mapping.row][mapping.col];
            const region = mapping.region;
            
            pad.type = 'sample';
            pad.filename = region.wavFile.name;
            pad.params.multisammode = '0';
            
            applySFZOpcodesToPad(pad, region, region.wavFile.metadata || {});
        }
        
        window.BitboxerUI.updatePadDisplay();
        window.BitboxerUtils.setStatus(`Imported ${mappings.length} stacked layers`, 'success');
        return;
    }
    
    // Single region
    if (validRegions.length === 1) {
        const pad = presetData.pads[row][col];
        const region = validRegions[0];
        
        pad.type = 'sample';
        pad.filename = region.wavFile.name;
        pad.params.multisammode = '0';
        
        applySFZOpcodesToPad(pad, region, region.wavFile.metadata || {});
        
        window.BitboxerUI.updatePadDisplay();
        window.BitboxerUtils.setStatus(`Imported: ${region.wavFile.name}`, 'success');
        return;
    }
    
    // Multiple regions = multisample
    const pad = presetData.pads[row][col];
    pad.type = 'sample';
    pad.params.multisammode = '1';
    
    const multisamFolder = sfzData.file.name.replace('.sfz', '');
    pad.filename = `.\\${multisamFolder}`;
    
    for (let i = 0; i < validRegions.length; i++) {
        const region = validRegions[i];
        const asset = createAssetFromSFZRegion(region, row, col, assetCells.length);
        assetCells.push(asset);
    }
    
    if (sfzData.global) {
        applySFZOpcodesToPad(pad, sfzData.global, {});
    }
    
    window.BitboxerUI.updatePadDisplay();
    window.BitboxerUtils.setStatus(`Imported multisample: ${validRegions.length} layers`, 'success');
}

/**
 * Analyzes SFZ regions for layer structure
 * Detects stacked vs velocity layers
 * 
 * @param {Array} regions - SFZ regions to analyze
 * @returns {Object} Analysis result with isStacked flag
 */
function analyzeSFZLayers(regions) {
    const keyGroups = {};
    regions.forEach(r => {
        const keyRange = `${r.lokey || 0}-${r.hikey || 127}`;
        if (!keyGroups[keyRange]) keyGroups[keyRange] = [];
        keyGroups[keyRange].push(r);
    });
    
    let hasStackedLayers = false;
    
    for (const [keyRange, group] of Object.entries(keyGroups)) {
        if (group.length > 1) {
            const hasOverlap = group.some((r1, i) => 
                group.slice(i + 1).some(r2 => {
                    const v1lo = r1.lovel || 0;
                    const v1hi = r1.hivel || 127;
                    const v2lo = r2.lovel || 0;
                    const v2hi = r2.hivel || 127;
                    return !(v1hi < v2lo || v2hi < v1lo);
                })
            );
            
            if (hasOverlap) {
                hasStackedLayers = true;
                break;
            }
        }
    }
    
    return {
        isStacked: hasStackedLayers,
        keyGroups: keyGroups,
        totalLayers: Object.values(keyGroups).reduce((sum, g) => sum + g.length, 0)
    };
}

/**
 * Prompts user to map SFZ layers to pads
 * Used for stacked layer imports
 * 
 * @param {Array} regions - SFZ regions to map
 * @param {HTMLElement} targetPad - Initial target pad
 * @returns {Promise<Array>} Array of {region, row, col} mappings
 */
async function promptLayerToPadMapping(regions, targetPad) {
    const { presetData } = window.BitboxerData;
    
    const availablePads = [];
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
            const pad = presetData.pads[row][col];
            const padNum = row * 4 + col + 1;
            const isEmpty = !pad.filename || pad.type === 'samtempl';
            availablePads.push({ row, col, padNum, isEmpty, currentName: pad.filename });
        }
    }
    
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.style.zIndex = '3000';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h2>Map SFZ Layers to Pads</h2>
                </div>
                <div style="padding: 20px;">
                    <p style="margin-bottom: 15px;">
                        This SFZ has <strong>${regions.length} layers</strong> that play simultaneously.
                        Choose which pad to load each layer to:
                    </p>
                    <div id="layerMappingContainer" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;"></div>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-primary" id="importLayersBtn" style="flex: 1;">Import Layers</button>
                        <button class="btn" id="cancelLayersBtn" style="flex: 1;">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const container = document.getElementById('layerMappingContainer');
        const selectedDestinations = new Set();
        
        regions.forEach((region, idx) => {
            const sampleName = region.sample ? region.sample.split(/[/\\]/).pop() : `Layer ${idx + 1}`;
            container.innerHTML += `
                <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center; padding: 10px; background: var(--color-bg-tertiary); border-radius: var(--radius-md);">
                    <div style="color: var(--color-accent-blue); font-weight: 600;">${sampleName}</div>
                    <div style="color: var(--color-text-secondary);">→</div>
                    <select class="select layer-target" data-layer-idx="${idx}" style="width: 100%;"></select>
                </div>
            `;
        });
        
        const targetSelects = container.querySelectorAll('.layer-target');
        
        function updateAllOptions() {
            targetSelects.forEach(select => {
                const currentValue = select.value;
                let options = '<option value="">-- Skip --</option>';
                
                availablePads.forEach(p => {
                    const slotKey = `${p.row},${p.col}`;
                    const isSelected = selectedDestinations.has(slotKey) && currentValue !== slotKey;
                    
                    if (!isSelected) {
                        const label = p.isEmpty 
                            ? `Pad ${p.padNum} (Empty)` 
                            : `Pad ${p.padNum} (${p.currentName}) ⚠️`;
                        options += `<option value="${slotKey}" ${currentValue === slotKey ? 'selected' : ''}>${label}</option>`;
                    }
                });
                
                select.innerHTML = options;
            });
        }
        
        updateAllOptions();
        
        const emptyPads = availablePads.filter(p => p.isEmpty);
        targetSelects.forEach((select, idx) => {
            if (idx < emptyPads.length) {
                const p = emptyPads[idx];
                const slotKey = `${p.row},${p.col}`;
                select.value = slotKey;
                selectedDestinations.add(slotKey);
            }
        });
        
        updateAllOptions();
        
        targetSelects.forEach(select => {
            select.addEventListener('change', () => {
                selectedDestinations.clear();
                targetSelects.forEach(s => {
                    if (s.value) selectedDestinations.add(s.value);
                });
                updateAllOptions();
            });
        });
        
        document.getElementById('importLayersBtn').onclick = () => {
            const mappings = [];
            targetSelects.forEach(select => {
                if (select.value) {
                    const [row, col] = select.value.split(',').map(Number);
                    const layerIdx = parseInt(select.dataset.layerIdx);
                    mappings.push({ region: regions[layerIdx], row, col });
                }
            });
            
            document.body.removeChild(modal);
            resolve(mappings);
        };
        
        document.getElementById('cancelLayersBtn').onclick = () => {
            document.body.removeChild(modal);
            resolve(null);
        };
    });
}

/**
 * Creates Bitbox asset cell from SFZ region
 * Extracts key/velocity mapping and root note
 * 
 * @param {Object} region - SFZ region data
 * @param {number} padRow - Parent pad row
 * @param {number} padCol - Parent pad column
 * @param {number} assetIndex - Asset index
 * @returns {Object} Asset cell data
 */
function createAssetFromSFZRegion(region, padRow, padCol, assetIndex) {
    let keyRangeBottom = 0, keyRangeTop = 127, rootNote = 60;
    
    if (region.lokey !== undefined && !isNaN(parseInt(region.lokey))) {
        keyRangeBottom = parseInt(region.lokey);
    }
    if (region.hikey !== undefined && !isNaN(parseInt(region.hikey))) {
        keyRangeTop = parseInt(region.hikey);
    }
    if (region.pitch_keycenter !== undefined && !isNaN(parseInt(region.pitch_keycenter))) {
        rootNote = parseInt(region.pitch_keycenter);
    } else if (region.key !== undefined && !isNaN(parseInt(region.key))) {
        rootNote = parseInt(region.key);
        if (region.lokey === undefined && region.hikey === undefined) {
            keyRangeBottom = rootNote;
            keyRangeTop = rootNote;
        }
    } else {
        rootNote = Math.floor((keyRangeBottom + keyRangeTop) / 2);
    }
    
    let velRangeBottom = 0, velRangeTop = 127;
    if (region.lovel !== undefined && !isNaN(parseInt(region.lovel))) {
        velRangeBottom = parseInt(region.lovel);
    }
    if (region.hivel !== undefined && !isNaN(parseInt(region.hivel))) {
        velRangeTop = parseInt(region.hivel);
    }
    const velRoot = Math.floor((velRangeBottom + velRangeTop) / 2);
    
    const { presetData } = window.BitboxerData;
    const padFilename = presetData.pads[padRow][padCol].filename;
    const folderName = padFilename.replace('.\\', '');
    const sampleFileName = region.sample.split(/[/\\]/).pop();
    
    return {
        row: assetIndex,
        filename: `.\\${folderName}\\${sampleFileName}`,
        params: {
            rootnote: rootNote.toString(),
            keyrangebottom: keyRangeBottom.toString(),
            keyrangetop: keyRangeTop.toString(),
            velroot: velRoot.toString(),
            velrangebottom: velRangeBottom.toString(),
            velrangetop: velRangeTop.toString(),
            asssrcrow: padRow.toString(),
            asssrccol: padCol.toString()
        }
    };
}

/**
 * Applies SFZ opcodes to Bitbox pad parameters
 * Maps SFZ parameters to Bitbox equivalents
 * 
 * @param {Object} pad - Pad data object
 * @param {Object} region - SFZ region data
 * @param {Object} wavMetadata - WAV file metadata
 */
function applySFZOpcodesToPad(pad, region, wavMetadata) {
    // Volume
    if (region.volume !== undefined) {
        pad.params.gaindb = Math.round(parseFloat(region.volume) * 1000).toString();
    }
    if (region.amplitude !== undefined) {
        const db = 20 * Math.log10(parseFloat(region.amplitude) / 100);
        pad.params.gaindb = Math.round(db * 1000).toString();
    }
    
    // Pan
    if (region.pan !== undefined) {
        pad.params.panpos = Math.round(parseFloat(region.pan) * 10).toString();
    }
    
    // Pitch
    if (region.tune !== undefined) {
        const semitones = parseFloat(region.tune) / 100;
        pad.params.pitch = Math.round(semitones * 1000).toString();
    }
    
    // Root note
    if (region.pitch_keycenter !== undefined) {
        pad.params.rootnote = region.pitch_keycenter.toString();
    } else if (region.key !== undefined) {
        pad.params.rootnote = region.key.toString();
    }
    
    // Sample position
    if (region.offset !== undefined) {
        pad.params.samstart = region.offset.toString();
    }
    if (region.end !== undefined && region.offset !== undefined) {
        const length = parseInt(region.end) - parseInt(region.offset);
        pad.params.samlen = length.toString();
    }
    
    // Loop mode
    if (region.loop_mode !== undefined) {
        const loopMode = region.loop_mode.toLowerCase();
        pad.params.loopmode = (loopMode === 'loop_continuous' || loopMode === 'loop_sustain') ? '1' : '0';
    }
    
    // Loop type
    if (region.loop_type !== undefined) {
        const loopType = region.loop_type.toLowerCase();
        if (loopType === 'forward') pad.params.loopmodes = '1';
        else if (loopType === 'alternate' || loopType === 'bidirectional') pad.params.loopmodes = '2';
    }
    
    // Loop points
    if (region.loop_start !== undefined && region.loop_end !== undefined) {
        pad.params.loopstart = region.loop_start.toString();
        pad.params.loopend = region.loop_end.toString();
        pad.params.loopmode = '1';
    } else if (wavMetadata.loopPoints) {
        pad.params.loopstart = wavMetadata.loopPoints.start.toString();
        pad.params.loopend = wavMetadata.loopPoints.end.toString();
        pad.params.loopmode = '1';
        if (wavMetadata.loopPoints.type === 1) pad.params.loopmodes = '2';
    }
    
    // Slices from WAV
    if (wavMetadata.slices && wavMetadata.slices.length > 1) {
        pad.params.cellmode = '2';
        pad.slices = wavMetadata.slices.map(pos => ({ pos: pos.toString() }));
    }
    
    // Tempo from WAV
    if (wavMetadata.tempo) {
        window.BitboxerData.presetData.tempo = Math.round(wavMetadata.tempo).toString();
    }
    
    // Envelope
    if (region.ampeg_attack !== undefined) {
        const seconds = parseFloat(region.ampeg_attack);
        if (seconds > 0) pad.params.envattack = Math.round(109.83 * Math.log(seconds * 1000)).toString();
    }
    if (region.ampeg_decay !== undefined) {
        const seconds = parseFloat(region.ampeg_decay);
        if (seconds > 0) pad.params.envdecay = Math.round(94.83 * Math.log(seconds * 1000)).toString();
    }
    if (region.ampeg_sustain !== undefined) {
        pad.params.envsus = Math.round((parseFloat(region.ampeg_sustain) / 100) * 1000).toString();
    }
    if (region.ampeg_release !== undefined) {
        const seconds = parseFloat(region.ampeg_release);
        if (seconds > 0) pad.params.envrel = Math.round(94.83 * Math.log(seconds * 1000)).toString();
    }
}

/**
 * Assigns WAV files to empty pads sequentially
 * 
 * @param {Array} wavFiles - Array of WAV file data
 */
function assignWAVsToPads(wavFiles) {
    const { presetData } = window.BitboxerData;
    let assignedCount = 0;
    
    for (let i = 0; i < Math.min(wavFiles.length, 16); i++) {
        const wavData = wavFiles[i];
        const row = Math.floor(i / 4);
        const col = i % 4;
        const pad = presetData.pads[row][col];
        
        pad.filename = wavData.name;
        pad.type = 'sample';
        
        if (wavData.metadata.loopPoints) {
            pad.params.loopstart = wavData.metadata.loopPoints.start.toString();
            pad.params.loopend = wavData.metadata.loopPoints.end.toString();
            pad.params.loopmode = '1';
            if (wavData.metadata.loopPoints.type === 1) pad.params.loopmodes = '2';
        }
        
        if (wavData.metadata.slices.length > 1) {
            pad.params.cellmode = '2';
            pad.slices = wavData.metadata.slices.map(pos => ({ pos: pos.toString() }));
        }
        
        if (wavData.metadata.tempo) {
            window.BitboxerData.presetData.tempo = Math.round(wavData.metadata.tempo).toString();
        }
        
        assignedCount++;
    }
    
    window.BitboxerUI.updatePadDisplay();
    window.BitboxerUtils.setStatus(`Loaded ${assignedCount} WAV file(s)`, 'success');
}

// ============================================
// MISSING SAMPLE RESOLUTION
// ============================================

/**
 * Handles missing samples in SFZ import
 * Prompts user to locate missing files
 * 
 * @param {Object} sfzFile - SFZ file data
 * @param {Array} existingWavFiles - Already found WAV files
 * @returns {Promise<Object>} {cancelled, wavFiles}
 */
async function handleMissingSamples(sfzFile, existingWavFiles) {
    const missingSamples = [];
    const foundSamples = [];
    
    for (const region of sfzFile.regions) {
        if (region.sample) {
            if (region.wavFile) foundSamples.push(region.sample);
            else missingSamples.push(region.sample);
        }
    }
    
    if (missingSamples.length === 0) {
        return { cancelled: false, wavFiles: existingWavFiles };
    }
    
    let newWavFiles = [];
    
    try {
        const totalSamples = foundSamples.length + missingSamples.length;
        window.BitboxerUtils.setStatus(
            `SFZ references ${totalSamples} samples, ${missingSamples.length} missing...`,
            'info'
        );
        
        if (window.showDirectoryPicker) {
            newWavFiles = await searchFolderForSamples(missingSamples);
        } else {
            newWavFiles = await searchFilesForSamples(missingSamples);
        }
        
        if (newWavFiles.length === 0) {
            const continueMessage = `No samples selected.\n\nMissing ${missingSamples.length} files:\n` +
                missingSamples.map(s => `  • ${s}`).join('\n') +
                `\n\nContinue without them?`;
            
            if (!confirm(continueMessage)) {
                return { cancelled: true, wavFiles: existingWavFiles };
            }
            return { cancelled: false, wavFiles: existingWavFiles };
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            return { cancelled: true, wavFiles: existingWavFiles };
        }
        console.error('Sample search error:', error);
        return { cancelled: true, wavFiles: existingWavFiles };
    }
    
    try {
        window.BitboxerUtils.setStatus('Processing found samples...', 'info');
        const newResult = await window.BitboxerFileHandler.FileImporter.import(newWavFiles);
        const allWavFiles = [...existingWavFiles, ...newResult.wavFiles];
        
        if (!window._lastImportedFiles) window._lastImportedFiles = new Map();
        newResult.wavFiles.forEach(wav => {
            window._lastImportedFiles.set(wav.name, wav.file);
        });
        
        sfzFile.regions.forEach(region => {
            if (!region.wavFile && region.sample) {
                const sampleName = region.sample.split(/[/\\]/).pop().toLowerCase();
                const match = allWavFiles.find(w => w.name.toLowerCase() === sampleName);
                if (match) region.wavFile = match;
            }
        });
        
        const finalMissing = sfzFile.regions.filter(r => r.sample && !r.wavFile);
        
        if (finalMissing.length > 0) {
            const finalMessage = `${finalMissing.length} sample(s) still missing.\n\nContinue anyway?`;
            if (!confirm(finalMessage)) {
                return { cancelled: true, wavFiles: existingWavFiles };
            }
        }
        
        return { cancelled: false, wavFiles: allWavFiles };
    } catch (error) {
        console.error('Processing error:', error);
        return { cancelled: true, wavFiles: existingWavFiles };
    }
}

/**
 * Searches folder for missing samples (modern browsers)
 * 
 * @param {Array} missingSamplePaths - Array of missing sample paths
 * @returns {Promise<Array>} Array of found File objects
 */
async function searchFolderForSamples(missingSamplePaths) {
    try {
        let dirHandle = window.BitboxerData.workingFolderHandle;
        
        if (!dirHandle) {
            window.BitboxerUtils.setStatus('Select folder with samples...', 'info');
            dirHandle = await window.showDirectoryPicker({ mode: 'read' });
            window.BitboxerData.workingFolderHandle = dirHandle;
            
            const btn = document.getElementById('setWorkingFolderBtn');
            if (btn) {
                btn.textContent = `📁 ${dirHandle.name}`;
                btn.classList.add('active');
            }
        }
        
        const foundFiles = [];
        const targetLookup = {};
        missingSamplePaths.forEach(path => {
            const fileName = path.split(/[/\\]/).pop().toLowerCase();
            targetLookup[fileName] = path;
        });
        
        async function searchDir(handle, depth = 0) {
            if (depth > 5) return;
            
            for await (const entry of handle.values()) {
                if (entry.kind === 'file') {
                    const fileName = entry.name.toLowerCase();
                    if (fileName.endsWith('.wav') && targetLookup[fileName]) {
                        const file = await entry.getFile();
                        foundFiles.push(file);
                    }
                } else if (entry.kind === 'directory') {
                    await searchDir(entry, depth + 1);
                }
            }
        }
        
        await searchDir(dirHandle);
        return foundFiles;
    } catch (error) {
        if (error.name === 'AbortError') throw error;
        console.error('Folder search error:', error);
        return [];
    }
}

/**
 * Searches manually selected files for missing samples
 * 
 * @param {Array} missingSamplePaths - Array of missing sample paths
 * @returns {Promise<Array>} Array of found File objects
 */
async function searchFilesForSamples(missingSamplePaths) {
    try {
        window.BitboxerUtils.setStatus('Select missing samples...', 'info');
        
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = '.wav';
        
        const files = await new Promise((resolve, reject) => {
            input.onchange = () => resolve(Array.from(input.files));
            input.oncancel = () => reject(new Error('AbortError'));
            input.click();
        });
        
        const targetNames = missingSamplePaths.map(path =>
            path.split(/[/\\]/).pop().toLowerCase()
        );
        
        return files.filter(file =>
            targetNames.includes(file.name.toLowerCase())
        );
    } catch (error) {
        if (error.message === 'AbortError') {
            const abortError = new Error('User cancelled');
            abortError.name = 'AbortError';
            throw abortError;
        }
        console.error('File search error:', error);
        return [];
    }
}

// ============================================
// AUTO-LOAD REFERENCED SAMPLES
// ============================================

/**
 * Automatically loads WAV files referenced in loaded preset
 * Searches working folder or prompts user
 */
async function autoLoadReferencedSamples() {
    const { presetData, assetCells, workingFolderHandle } = window.BitboxerData;
    
    if (window._lastImportedFiles && window._lastImportedFiles.size > 0) {
        return;
    }
    
    const referencedSamples = new Set();
    
    // Collect from pads
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
            const pad = presetData.pads[row][col];
            if (pad.filename && pad.params.multisammode !== '1') {
                const wavName = pad.filename.split(/[/\\]/).pop();
                if (wavName.endsWith('.wav') || wavName.endsWith('.WAV')) {
                    referencedSamples.add(wavName);
                }
            }
        }
    }
    
    // Collect from assets
    assetCells.forEach(asset => {
        const wavName = asset.filename.split(/[/\\]/).pop();
        if (wavName.endsWith('.wav') || wavName.endsWith('.WAV')) {
            referencedSamples.add(wavName);
        }
    });
    
    if (referencedSamples.size === 0) return;
    
    // No working folder - prompt
    if (!workingFolderHandle) {
        const shouldLocate = await promptNoWorkingFolder(referencedSamples.size);
        if (shouldLocate) {
            try {
                const foundFiles = await promptForSampleFolder(Array.from(referencedSamples));
                window._lastImportedFiles = new Map();
                foundFiles.forEach(file => {
                    window._lastImportedFiles.set(file.name, file);
                });
                window.BitboxerUtils.setStatus(
                    `Loaded ${foundFiles.length}/${referencedSamples.size} sample(s)`,
                    foundFiles.length < referencedSamples.size ? 'error' : 'success'
                );
            } catch (error) {
                window.BitboxerUtils.setStatus('Sample loading cancelled', 'info');
            }
        } else {
            window.BitboxerUtils.setStatus('Preset loaded without samples', 'error');
        }
        return;
    }
    
    // Search working folder
    window.BitboxerUtils.setStatus('Searching for samples...', 'info');
    
    try {
        const foundFiles = await searchFolderForSamplesRecursive(
            workingFolderHandle,
            Array.from(referencedSamples)
        );
        
        window._lastImportedFiles = new Map();
        foundFiles.forEach(file => {
            window._lastImportedFiles.set(file.name, file);
        });
        
        if (foundFiles.length >= referencedSamples.size) {
            window.BitboxerUtils.setStatus(
                `Loaded preset with ${referencedSamples.size} sample(s)`,
                'success'
            );
            return;
        }
        
        const foundNames = new Set(foundFiles.map(f => f.name.toLowerCase()));
        const missing = Array.from(referencedSamples).filter(
            name => !foundNames.has(name.toLowerCase())
        );
        
        const shouldLocate = await promptSomeMissing(missing, foundFiles.length, referencedSamples.size);
        
        if (shouldLocate) {
            try {
                const additionalFiles = await searchFilesForSamples(missing);
                additionalFiles.forEach(file => {
                    window._lastImportedFiles.set(file.name, file);
                });
                window.BitboxerUtils.setStatus(
                    `Loaded ${window._lastImportedFiles.size}/${referencedSamples.size} sample(s)`,
                    window._lastImportedFiles.size < referencedSamples.size ? 'error' : 'success'
                );
            } catch (error) {
                window.BitboxerUtils.setStatus(
                    `Loaded ${foundFiles.length}/${referencedSamples.size} sample(s) - some missing`,
                    'error'
                );
            }
        } else {
            window.BitboxerUtils.setStatus(
                `Loaded ${foundFiles.length}/${referencedSamples.size} sample(s) - some missing`,
                'error'
            );
        }
    } catch (error) {
        console.error('Sample search error:', error);
        window.BitboxerUtils.setStatus('Could not search for samples', 'error');
    }
}

/**
 * Recursively searches folder for samples
 * 
 * @param {FileSystemDirectoryHandle} dirHandle - Directory handle
 * @param {Array} targetNames - Array of filenames to find
 * @returns {Promise<Array>} Array of found File objects
 */
async function searchFolderForSamplesRecursive(dirHandle, targetNames) {
    const foundFiles = [];
    const targetLookup = {};
    targetNames.forEach(name => {
        targetLookup[name.toLowerCase()] = name;
    });
    
    async function searchDir(handle, depth = 0) {
        if (depth > 5) return;
        
        for await (const entry of handle.values()) {
            if (entry.kind === 'file') {
                const fileName = entry.name.toLowerCase();
                if (fileName.endsWith('.wav') && targetLookup[fileName]) {
                    const file = await entry.getFile();
                    foundFiles.push(file);
                }
            } else if (entry.kind === 'directory') {
                await searchDir(entry, depth + 1);
            }
        }
    }
    
    await searchDir(dirHandle);
    return foundFiles;
}

/**
 * Prompts user to select folder containing samples
 * 
 * @param {Array} sampleNames - Array of sample names to find
 * @returns {Promise<Array>} Array of found File objects
 */
async function promptForSampleFolder(sampleNames) {
    if (window.showDirectoryPicker) {
        window.BitboxerUtils.setStatus('Select folder with samples...', 'info');
        const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
        
        window.BitboxerData.workingFolderHandle = dirHandle;
        const btn = document.getElementById('setWorkingFolderBtn');
        if (btn) {
            btn.textContent = `📁 ${dirHandle.name}`;
            btn.classList.add('active');
        }
        
        return await searchFolderForSamplesRecursive(dirHandle, sampleNames);
    } else {
        return await searchFilesForSamples(sampleNames);
    }
}

// ============================================
// USER PROMPTS
// ============================================

/**
 * Prompts when no working folder is set
 * 
 * @param {number} sampleCount - Number of samples needed
 * @returns {Promise<boolean>} True if user wants to locate samples
 */
async function promptNoWorkingFolder(sampleCount) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.style.zIndex = '3000';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h2>📁 Locate Sample Files</h2>
                </div>
                <div style="padding: 20px;">
                    <p style="margin-bottom: 15px;">
                        This preset references <strong>${sampleCount} sample(s)</strong>.
                    </p>
                    <p style="margin-bottom: 20px; color: var(--color-text-secondary);">
                        No working folder set. Locate samples?
                    </p>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-primary" id="locateBtn2" style="flex: 1;">📁 Locate</button>
                        <button class="btn" id="skipBtn2" style="flex: 1;">Skip</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('locateBtn2').onclick = () => {
            document.body.removeChild(modal);
            resolve(true);
        };
        
        document.getElementById('skipBtn2').onclick = () => {
            document.body.removeChild(modal);
            resolve(false);
        };
    });
}

/**
 * Prompts when some samples are missing
 * 
 * @param {Array} missingSamples - Array of missing sample names
 * @param {number} foundCount - Number of samples found
 * @param {number} totalCount - Total number of samples needed
 * @returns {Promise<boolean>} True if user wants to locate missing samples
 */
async function promptSomeMissing(missingSamples, foundCount, totalCount) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.style.zIndex = '3000';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2>⚠️ Some Samples Missing</h2>
                </div>
                <div style="padding: 20px;">
                    <p style="margin-bottom: 15px;">
                        Found: <strong>${foundCount}/${totalCount}</strong> | 
                        Missing: <strong>${missingSamples.length}</strong>
                    </p>
                    ${missingSamples.length <= 10 ? `
                        <div style="max-height: 200px; overflow-y: auto; background: var(--color-bg-primary); padding: 10px; border-radius: var(--radius-md); margin-bottom: 15px; font-family: monospace; font-size: 0.85em;">
                            ${missingSamples.map(name => `<div>• ${name}</div>`).join('')}
                        </div>
                    ` : ''}
                    <p style="margin-bottom: 20px; color: var(--color-text-secondary);">
                        Locate missing samples?
                    </p>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-primary" id="locateBtn3" style="flex: 1;">📁 Locate Missing</button>
                        <button class="btn" id="skipBtn3" style="flex: 1;">Continue Without</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('locateBtn3').onclick = () => {
            document.body.removeChild(modal);
            resolve(true);
        };
        
        document.getElementById('skipBtn3').onclick = () => {
            document.body.removeChild(modal);
            resolve(false);
        };
    });
}

/**
 * Prompts user to choose replace or merge for preset import
 * 
 * @returns {Promise<string>} 'replace', 'merge', or 'cancel'
 */
async function promptLoadOrMerge() {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.style.zIndex = '3000';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h2>Load Preset</h2>
                </div>
                <div style="padding: 20px;">
                    <p style="margin-bottom: 20px;">How to load?</p>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <button class="btn btn-primary" id="replaceBtn" style="padding: 15px;">
                            <strong>Replace All Pads</strong><br>
                            <small style="opacity: 0.8;">Clear current project</small>
                        </button>
                        <button class="btn btn-primary" id="mergeBtn" style="padding: 15px;">
                            <strong>Merge Into Project</strong><br>
                            <small style="opacity: 0.8;">Import to empty slots</small>
                        </button>
                        <button class="btn" id="cancelBtn">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('replaceBtn').onclick = () => {
            document.body.removeChild(modal);
            resolve('replace');
        };
        
        document.getElementById('mergeBtn').onclick = () => {
            document.body.removeChild(modal);
            resolve('merge');
        };
        
        document.getElementById('cancelBtn').onclick = () => {
            document.body.removeChild(modal);
            resolve('cancel');
        };
        
        modal.onclick = (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
                resolve('cancel');
            }
        };
    });
}

// ============================================
// PRESET MERGING
// ============================================

/**
 * Merges preset into current project
 * Prompts user to map imported pads to slots
 * 
 * @param {File} file - XML preset file
 */
async function mergePreset(file) {
    try {
        const text = await file.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'text/xml');
        
        const cells = xmlDoc.querySelectorAll('cell[layer="0"]');
        const importedPads = [];
        
        cells.forEach(cell => {
            const row = parseInt(cell.getAttribute('row'));
            const col = parseInt(cell.getAttribute('column'));
            const filename = cell.getAttribute('filename') || '';
            
            if (!isNaN(row) && !isNaN(col) && filename) {
                const padData = {
                    row, col, filename,
                    type: cell.getAttribute('type'),
                    params: {},
                    modsources: [],
                    slices: []
                };
                
                const params = cell.querySelector('params');
                if (params) {
                    Array.from(params.attributes).forEach(attr => {
                        padData.params[attr.name] = attr.value;
                    });
                }
                
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
                    padData.modsources.push(modSource);
                });
                
                const slicesNode = cell.querySelector('slices');
                if (slicesNode) {
                    slicesNode.querySelectorAll('slice').forEach(slice => {
                        padData.slices.push({ pos: slice.getAttribute('pos') });
                    });
                }
                
                importedPads.push(padData);
            }
        });
        
        if (importedPads.length === 0) {
            window.BitboxerUtils.setStatus('No pads in preset', 'error');
            return;
        }
        
        const { presetData } = window.BitboxerData;
        const emptySlots = [];
        const occupiedSlots = [];
        
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                const pad = presetData.pads[row][col];
                if (!pad.filename || pad.filename === '') {
                    emptySlots.push({ row, col });
                } else {
                    occupiedSlots.push({ row, col });
                }
            }
        }
        
        const mappings = await promptPadMapping(importedPads, emptySlots, occupiedSlots);
        
        if (!mappings || mappings.length === 0) {
            window.BitboxerUtils.setStatus('Merge cancelled', 'info');
            return;
        }
        
        mappings.forEach(mapping => {
            const { source, target } = mapping;
            presetData.pads[target.row][target.col] = {
                filename: source.filename,
                type: source.type,
                params: { ...source.params },
                modsources: JSON.parse(JSON.stringify(source.modsources)),
                slices: JSON.parse(JSON.stringify(source.slices))
            };
        });
        
        const assetNodes = xmlDoc.querySelectorAll('cell[type="asset"]');
        assetNodes.forEach((asset) => {
            const params = asset.querySelector('params');
            if (params) {
                window.BitboxerData.assetCells.push({
                    row: window.BitboxerData.assetCells.length,
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
        
        window.BitboxerUI.updatePadDisplay();
        window.BitboxerUtils.setStatus(`Merged ${mappings.length} pad(s)`, 'success');
    } catch (error) {
        console.error('Merge error:', error);
        window.BitboxerUtils.setStatus(`Merge failed: ${error.message}`, 'error');
    }
}

/**
 * Prompts user to map imported pads to target slots
 * 
 * @param {Array} importedPads - Pads to import
 * @param {Array} emptySlots - Available empty slots
 * @param {Array} occupiedSlots - Occupied slots
 * @returns {Promise<Array|null>} Mappings or null if cancelled
 */
async function promptPadMapping(importedPads, emptySlots, occupiedSlots) {
    return new Promise((resolve) => {
        const allSlots = [...emptySlots, ...occupiedSlots].sort((a, b) => {
            if (a.row !== b.row) return a.row - b.row;
            return a.col - b.col;
        });
        
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.style.zIndex = '3000';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h2>Map Imported Pads</h2>
                </div>
                <div style="padding: 20px;">
                    <p style="margin-bottom: 15px;">Select pads to import and where to place:</p>
                    <div id="padMappingContainer" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;"></div>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-primary" id="importMappedBtn" style="flex: 1;">Import Selected</button>
                        <button class="btn" id="cancelMappingBtn" style="flex: 1;">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const container = document.getElementById('padMappingContainer');
        const { presetData } = window.BitboxerData;
        const selectedDestinations = new Set();
        
        importedPads.forEach((pad, idx) => {
            const sourcePadNum = (pad.row * 4) + pad.col + 1;
            const sourceName = pad.filename ? 
                pad.filename.split(/[/\\]/).pop().replace(/\.(wav|WAV)$/, '') : 
                'Empty';
            
            container.innerHTML += `
                <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center; padding: 10px; background: var(--color-bg-tertiary); border-radius: var(--radius-md);">
                    <div style="color: var(--color-accent-blue); font-weight: 600;">Pad ${sourcePadNum}: ${sourceName}</div>
                    <div style="color: var(--color-text-secondary);">→</div>
                    <select class="select mapping-target" data-source-idx="${idx}" style="width: 100%;"></select>
                </div>
            `;
        });
        
        const targetSelects = container.querySelectorAll('.mapping-target');
        
        function updateAllOptions() {
            targetSelects.forEach((select, idx) => {
                const currentValue = select.value;
                let options = '<option value="">-- Don\'t Import --</option>';
                
                emptySlots.forEach(slot => {
                    const slotKey = `${slot.row},${slot.col}`;
                    const targetPadNum = (slot.row * 4) + slot.col + 1;
                    const isSelected = selectedDestinations.has(slotKey) && currentValue !== slotKey;
                    if (!isSelected) {
                        options += `<option value="${slotKey}" ${currentValue === slotKey ? 'selected' : ''}>Pad ${targetPadNum} (Empty)</option>`;
                    }
                });
                
                occupiedSlots.forEach(slot => {
                    const slotKey = `${slot.row},${slot.col}`;
                    const targetPadNum = (slot.row * 4) + slot.col + 1;
                    const targetPad = presetData.pads[slot.row][slot.col];
                    const targetName = targetPad.filename ? 
                        targetPad.filename.split(/[/\\]/).pop().replace(/\.(wav|WAV)$/, '') : 
                        'Sample';
                    const isSelected = selectedDestinations.has(slotKey) && currentValue !== slotKey;
                    if (!isSelected) {
                        options += `<option value="${slotKey}" ${currentValue === slotKey ? 'selected' : ''}>Pad ${targetPadNum} (${targetName}) ⚠️</option>`;
                    }
                });
                
                select.innerHTML = options;
            });
        }
        
        updateAllOptions();
        
        targetSelects.forEach((select, idx) => {
            if (idx < emptySlots.length) {
                const slotKey = `${emptySlots[idx].row},${emptySlots[idx].col}`;
                select.value = slotKey;
                selectedDestinations.add(slotKey);
            }
        });
        
        updateAllOptions();
        
        targetSelects.forEach(select => {
            select.addEventListener('change', () => {
                selectedDestinations.clear();
                targetSelects.forEach(s => {
                    if (s.value) selectedDestinations.add(s.value);
                });
                updateAllOptions();
            });
        });
        
        document.getElementById('importMappedBtn').onclick = () => {
            const mappings = [];
            targetSelects.forEach((select, idx) => {
                if (select.value) {
                    const [row, col] = select.value.split(',').map(Number);
                    mappings.push({
                        source: importedPads[idx],
                        target: { row, col }
                    });
                }
            });
            
            if (mappings.length === 0) {
                window.BitboxerUtils.setStatus('No pads selected', 'error');
                return;
            }
            
            document.body.removeChild(modal);
            resolve(mappings);
        };
        
        document.getElementById('cancelMappingBtn').onclick = () => {
            document.body.removeChild(modal);
            resolve(null);
        };
        
        modal.onclick = (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
                resolve(null);
            }
        };
    });
}

// ============================================
// PAD LOADING HELPERS
// ============================================

/**
 * Loads pad from JSON export file
 * 
 * @param {File} file - JSON file
 * @param {HTMLElement} targetPad - Target pad element
 */
async function loadPadFromJSON(file, targetPad) {
    try {
        const text = await file.text();
        const padData = JSON.parse(text);
        
        const row = parseInt(targetPad.dataset.row);
        const col = parseInt(targetPad.dataset.col);
        
        if (padData.data) {
            window.BitboxerData.presetData.pads[row][col] = JSON.parse(JSON.stringify(padData.data));
            window.BitboxerUI.updatePadDisplay();
            window.BitboxerUtils.setStatus(`Loaded from ${file.name}`, 'success');
        } else {
            window.BitboxerUtils.setStatus('Invalid pad JSON', 'error');
        }
    } catch (error) {
        window.BitboxerUtils.setStatus(`Error loading: ${error.message}`, 'error');
    }
}

/**
 * Loads pad from self-contained ZIP export
 * 
 * @param {File} zipFile - ZIP file
 * @param {HTMLElement} targetPad - Target pad element
 */
async function loadPadFromZIP(zipFile, targetPad) {
    try {
        window.BitboxerUtils.setStatus('Loading pad ZIP...', 'info');
        const result = await window.BitboxerFileHandler.FileImporter.import(zipFile);
        
        const jsonFiles = Array.from(result.collection.files.entries())
            .filter(([path, file]) => path.endsWith('.json'));
        
        if (jsonFiles.length === 0) {
            window.BitboxerUtils.setStatus('No pad JSON in ZIP', 'error');
            return;
        }
        
        const [jsonPath, jsonFile] = jsonFiles[0];
        const text = await jsonFile.text();
        const padData = JSON.parse(text);
        
        const row = parseInt(targetPad.dataset.row);
        const col = parseInt(targetPad.dataset.col);
        
        if (padData.data) {
            window._lastImportedFiles = result.collection.files;
            
            window.BitboxerData.presetData.pads[row][col] = JSON.parse(JSON.stringify(padData.data));
            
            if (padData.assetReferences) {
                window.BitboxerData.assetCells = window.BitboxerData.assetCells.filter(asset =>
                    !(parseInt(asset.params.asssrcrow) === row &&
                        parseInt(asset.params.asssrccol) === col)
                );
                
                padData.assetReferences.forEach(asset => {
                    window.BitboxerData.assetCells.push({
                        ...asset,
                        params: {
                            ...asset.params,
                            asssrcrow: row.toString(),
                            asssrccol: col.toString()
                        }
                    });
                });
            }
            
            window.BitboxerUI.updatePadDisplay();
            window.BitboxerUtils.setStatus(`Loaded from ${zipFile.name}`, 'success');
        } else {
            window.BitboxerUtils.setStatus('Invalid pad ZIP', 'error');
        }
    } catch (error) {
        console.error('Pad ZIP error:', error);
        window.BitboxerUtils.setStatus(`Error: ${error.message}`, 'error');
    }
}

// ============================================
// EXPORT IMPORT HANDLER
// ============================================
window.BitboxerImport = {
    unifiedImportHandler,
    processImportedFiles,
    loadPadFromJSON,
    loadPadFromZIP,
    autoLoadReferencedSamples
};