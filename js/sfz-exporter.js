/**
 * BITBOXER - SFZ Exporter
 * 
 * Exports Bitbox pads to SFZ format with proper opcode conversion
 */

// ============================================
// PARAMETER CONVERSION (BITBOX → SFZ)
// ============================================

/**
 * Converts Bitbox parameters to SFZ opcodes
 * 
 * @param {Object} pad - Pad data
 * @returns {Object} SFZ opcodes
 */
function convertBitboxToSFZOpcodes(pad) {
    const opcodes = {};
    const p = pad.params;
    
    // Volume: millidecibels → dB
    if (p.gaindb && p.gaindb !== '0') {
        opcodes.volume = (parseInt(p.gaindb) / 1000).toFixed(2);
    }
    
    // Pitch: millisemitones → cents
    if (p.pitch && p.pitch !== '0') {
        opcodes.tune = (parseInt(p.pitch) / 10).toFixed(0);
    }
    
    // Pan: -1000/+1000 → -100/+100
    if (p.panpos && p.panpos !== '0') {
        opcodes.pan = (parseInt(p.panpos) / 10).toFixed(0);
    }
    
    // Loop points (direct sample positions)
    if (p.loopstart && p.loopstart !== '0') {
        opcodes.loop_start = p.loopstart;
    }
    if (p.loopend && p.loopend !== '0') {
        opcodes.loop_end = p.loopend;
    }
    
    // Loop mode
    if (p.loopmode === '1' && p.loopmodes) {
        if (p.loopmodes === '1') {
            opcodes.loop_mode = 'loop_continuous';
            opcodes.loop_type = 'forward';
        } else if (p.loopmodes === '2') {
            opcodes.loop_mode = 'loop_continuous';
            opcodes.loop_type = 'alternate';
        }
    // } else {
    //     opcodes.loop_mode = 'no_loop';
    }
    
    // Sample start/length
    if (p.samstart && p.samstart !== '0') {
        opcodes.offset = p.samstart;
    }
    if (p.samlen && p.samlen !== '0' && p.samstart && p.samstart !== '0') {
        opcodes.end = (parseInt(p.samstart) + parseInt(p.samlen)).toString();
    }
    
    // Envelope (convert Bitbox formula to seconds)
    if (p.envattack && p.envattack !== '0') {
        const seconds = Math.exp(parseInt(p.envattack) / 109.83) / 1000;
        opcodes.ampeg_attack = seconds.toFixed(4);
    }
    if (p.envdecay && p.envdecay !== '0') {
        const seconds = Math.exp(parseInt(p.envdecay) / 94.83) / 1000;
        opcodes.ampeg_decay = seconds.toFixed(4);
    }
    if (p.envsus && p.envsus !== '1000') {
        opcodes.ampeg_sustain = (parseInt(p.envsus) / 10).toFixed(1);
    }
    if (p.envrel && p.envrel !== '200') {
        const seconds = Math.exp(parseInt(p.envrel) / 94.83) / 1000;
        opcodes.ampeg_release = seconds.toFixed(4);
    }
    
    return opcodes;
}

/**
 * Formats SFZ opcodes as string
 * 
 * @param {Object} opcodes - SFZ opcodes object
 * @returns {string} Formatted opcode string
 */
function formatSFZOpcodes(opcodes) {
    return Object.entries(opcodes)
        .map(([key, value]) => `${key}=${value}`)
        .join(' ');
}

// ============================================
// SINGLE PAD EXPORT
// ============================================

/**
 * Exports single pad as SFZ
 * 
 * @param {Object} padData - Pad data
 * @param {number} padNum - Pad number
 * @returns {string} SFZ file content
 */
function exportPadAsSFZ(padData, padNum) {
    let sfz = `// Exported from BITBOXER\n`;
    sfz += `// Pad ${padNum}: ${padData.filename || 'Untitled'}\n`;
    sfz += `// Date: ${new Date().toISOString()}\n\n`;
    
    // Warnings for unsupported features
    const warnings = [];
    if (padData.params.cellmode === '2') warnings.push('Slicer mode not supported in SFZ');
    if (padData.params.cellmode === '3') warnings.push('Granular mode not supported in SFZ');
    if (padData.modsources && padData.modsources.length > 0) warnings.push('Modulation matrix not exported');
    
    if (warnings.length > 0) {
        sfz += `// ⚠️ WARNINGS:\n`;
        warnings.forEach(w => sfz += `// - ${w}\n`);
        sfz += `\n`;
    }
    
    // Get common opcodes
    const commonOpcodes = convertBitboxToSFZOpcodes(padData);
    
    // Check if multisample
    const isMultisample = padData.params.multisammode === '1';
    
    if (isMultisample) {
        // Export as multisample with asset cells
        return exportMultisampleAsSFZ(padData, padNum, commonOpcodes, sfz);
    } else {
        // Export as single sample
        sfz += `<group>\n`;
        if (Object.keys(commonOpcodes).length > 0) {
            sfz += `${formatSFZOpcodes(commonOpcodes)}\n`;
        }
        sfz += `\n`;
        
        sfz += `<region> sample=${padData.filename}`;
        
        // Add root note if set
        if (padData.params.rootnote && padData.params.rootnote !== '0') {
            const midiNote = parseInt(padData.params.rootnote);
            const noteName = midiNumberToSFZNote(midiNote);
            sfz += ` pitch_keycenter=${noteName}`;
        }
        
        sfz += `\n`;
    }
    
    return sfz;
}

/**
 * Exports multisample pad as SFZ with asset cells
 * 
 * @param {Object} padData - Pad data
 * @param {number} padNum - Pad number
 * @param {Object} commonOpcodes - Common opcodes for group
 * @param {string} sfzHeader - SFZ header
 * @returns {string} SFZ file content
 */
function exportMultisampleAsSFZ(padData, padNum, commonOpcodes, sfzHeader) {
    let sfz = sfzHeader;
    
    // Get asset cells for this pad
    const { assetCells } = window.BitboxerData;
    const assets = assetCells.filter(asset => {
        const padElement = document.querySelector(`[data-padnum="${padNum}"]`);
        const row = parseInt(padElement.dataset.row);
        const col = parseInt(padElement.dataset.col);
        return parseInt(asset.params.asssrcrow) === row && 
               parseInt(asset.params.asssrccol) === col;
    });
    
    if (assets.length === 0) {
        return sfz + `// ERROR: No asset cells found for multisample\n`;
    }
    
    // Extract folder path from pad filename
    const folderMatch = padData.filename.match(/\\(.+?)$/);
    const folderName = folderMatch ? folderMatch[1] : 'samples';
    
    sfz += `<control>\n`;
    if (Object.keys(commonOpcodes).length > 0) {
        sfz += `${formatSFZOpcodes(commonOpcodes)}\n`;
    }
    sfz += `default_path=${folderName}/\n\n`;
    
    // Export each asset as region
    assets.forEach(asset => {
        const sampleName = asset.filename.split(/[/\\]/).pop();
        
        sfz += `<region> sample=${sampleName}`;
        
        // Root note
        const rootNote = parseInt(asset.params.rootnote);
        sfz += ` pitch_keycenter=${midiNumberToSFZNote(rootNote)}`;
        
        // Key range
        const lokey = parseInt(asset.params.keyrangebottom);
        const hikey = parseInt(asset.params.keyrangetop);
        if (lokey !== rootNote) sfz += ` lokey=${midiNumberToSFZNote(lokey)}`;
        if (hikey !== rootNote) sfz += ` hikey=${midiNumberToSFZNote(hikey)}`;
        
        // Velocity range (only if not full range)
        const lovel = parseInt(asset.params.velrangebottom);
        const hivel = parseInt(asset.params.velrangetop);
        if (lovel !== 0 || hivel !== 127) {
            sfz += ` lovel=${lovel} hivel=${hivel}`;
        }
        
        sfz += `\n`;
    });
    
    return sfz;
}

// ============================================
// MULTI-PAD EXPORT
// ============================================

/**
 * Exports multiple selected pads as single SFZ with groups
 * 
 * @param {Array} padNumbers - Array of pad numbers to export
 * @returns {string} Combined SFZ content
 */
function exportMultiplePadsAsSFZ(padNumbers) {
    const { presetData, projectName } = window.BitboxerData;
    
    let sfz = `// Exported from BITBOXER\n`;
    sfz += `// Project: ${projectName}\n`;
    sfz += `// Pads: ${padNumbers.join(', ')}\n`;
    sfz += `// Date: ${new Date().toISOString()}\n\n`;
    
    padNumbers.forEach((padNum, idx) => {
        const padElement = document.querySelector(`[data-padnum="${padNum}"]`);
        const row = parseInt(padElement.dataset.row);
        const col = parseInt(padElement.dataset.col);
        const padData = presetData.pads[row][col];
        
        if (!padData.filename) return; // Skip empty pads
        
        sfz += `// ============================================\n`;
        sfz += `// Pad ${padNum}: ${padData.filename}\n`;
        sfz += `// ============================================\n\n`;
        
        const padSFZ = exportPadAsSFZ(padData, padNum);
        // Remove header from individual pad export
        const lines = padSFZ.split('\n');
        const contentStart = lines.findIndex(l => l.startsWith('<group>'));
        sfz += lines.slice(contentStart).join('\n');
        sfz += `\n\n`;
    });
    
    return sfz;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Converts MIDI number to SFZ note name
 * 
 * @param {number} midi - MIDI note number (0-127)
 * @returns {string} SFZ note name (e.g., "c3", "f#4")
 */
function midiNumberToSFZNote(midi) {
    if (midi < 0 || midi > 127) return 'c3';
    const notes = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
    const octave = Math.floor(midi / 12) - 1;
    const note = notes[midi % 12];
    return `${note}${octave}`;
}

/**
 * Collects all WAV files needed for export
 * 
 * @param {Array} padNumbers - Pad numbers to export
 * @returns {Promise<Map>} Map of filename → File object
 */
async function collectWAVsForExport(padNumbers) {
    const { presetData, assetCells } = window.BitboxerData;
    const wavFiles = new Map();
    
    for (const padNum of padNumbers) {
        const padElement = document.querySelector(`[data-padnum="${padNum}"]`);
        const row = parseInt(padElement.dataset.row);
        const col = parseInt(padElement.dataset.col);
        const padData = presetData.pads[row][col];
        
        if (!padData.filename) continue;
        
        // Check if multisample
        if (padData.params.multisammode === '1') {
            // Get asset WAVs
            const assets = assetCells.filter(asset =>
                parseInt(asset.params.asssrcrow) === row &&
                parseInt(asset.params.asssrccol) === col
            );
            
            for (const asset of assets) {
                const wavName = asset.filename.split(/[/\\]/).pop();
                if (window._lastImportedFiles && window._lastImportedFiles.has(wavName)) {
                    wavFiles.set(wavName, window._lastImportedFiles.get(wavName));
                }
            }
        } else {
            // Single sample
            const wavName = padData.filename;
            if (window._lastImportedFiles && window._lastImportedFiles.has(wavName)) {
                wavFiles.set(wavName, window._lastImportedFiles.get(wavName));
            }
        }
    }
    
    return wavFiles;
}

// ============================================
// MAIN EXPORT FUNCTION
// ============================================

/**
 * Exports selected pads as SFZ ZIP
 */
async function exportSelectedAsSFZ() {
    const { selectedPads, projectName } = window.BitboxerData;
    
    if (selectedPads.size === 0) {
        window.BitboxerUtils.setStatus('No pads selected', 'error');
        return;
    }
    
    const padNumbers = Array.from(selectedPads).map(n => parseInt(n)).sort((a, b) => a - b);
    
    try {
        window.BitboxerUtils.setStatus('Generating SFZ...', 'info');
        
        // Generate SFZ content
        let sfzContent;
        let sfzFilename;
        
        if (padNumbers.length === 1) {
            const padNum = padNumbers[0];
            const padElement = document.querySelector(`[data-padnum="${padNum}"]`);
            const row = parseInt(padElement.dataset.row);
            const col = parseInt(padElement.dataset.col);
            const padData = window.BitboxerData.presetData.pads[row][col];
            
            sfzContent = exportPadAsSFZ(padData, padNum);
            
            const sampleName = padData.filename ? 
                padData.filename.split(/[/\\]/).pop().replace(/\.(wav|WAV)$/, '') : 
                `Pad${padNum}`;
            sfzFilename = `${projectName}_${sampleName}.sfz`;
        } else {
            sfzContent = exportMultiplePadsAsSFZ(padNumbers);
            sfzFilename = `${projectName}_Pads_${padNumbers.join('_')}.sfz`;
        }
        
        // Collect WAV files
        window.BitboxerUtils.setStatus('Collecting samples...', 'info');
        const wavFiles = await collectWAVsForExport(padNumbers);
        
        // Create ZIP
        const files = {};
        files[sfzFilename] = new TextEncoder().encode(sfzContent);
        
        // Add WAV files with folder structure
        for (const [wavName, wavFile] of wavFiles) {
            const wavData = await wavFile.arrayBuffer();
            
            // Check if part of multisample folder
            let targetPath = wavName;
            
            // If multisample, preserve folder structure
            padNumbers.forEach(padNum => {
                const padElement = document.querySelector(`[data-padnum="${padNum}"]`);
                const row = parseInt(padElement.dataset.row);
                const col = parseInt(padElement.dataset.col);
                const padData = window.BitboxerData.presetData.pads[row][col];
                
                if (padData.params.multisammode === '1' && padData.filename) {
                    const folderMatch = padData.filename.match(/\\(.+?)$/);
                    if (folderMatch) {
                        const folderName = folderMatch[1];
                        // Check if this WAV belongs to this folder
                        const assets = window.BitboxerData.assetCells.filter(asset =>
                            parseInt(asset.params.asssrcrow) === row &&
                            parseInt(asset.params.asssrccol) === col &&
                            asset.filename.includes(wavName)
                        );
                        if (assets.length > 0) {
                            targetPath = `${folderName}/${wavName}`;
                        }
                    }
                }
            });
            
            files[targetPath] = new Uint8Array(wavData);
        }
        
        // Generate ZIP
        window.BitboxerUtils.setStatus('Creating ZIP...', 'info');
        const zipped = fflate.zipSync(files);
        const blob = new Blob([zipped], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = sfzFilename.replace('.sfz', '.zip');
        a.click();
        URL.revokeObjectURL(url);
        
        const missingCount = padNumbers.length - wavFiles.size;
        window.BitboxerUtils.setStatus(
            missingCount > 0 
                ? `Exported SFZ (${missingCount} samples missing)` 
                : `Exported SFZ with ${wavFiles.size} sample(s)`,
            missingCount > 0 ? 'error' : 'success'
        );
        
    } catch (error) {
        console.error('SFZ export error:', error);
        window.BitboxerUtils.setStatus(`SFZ export failed: ${error.message}`, 'error');
    }
}

// ============================================
// EXPORT SFZ EXPORTER
// ============================================
window.BitboxerSFZExport = {
    exportSelectedAsSFZ,
    exportPadAsSFZ,
    exportMultiplePadsAsSFZ,
    convertBitboxToSFZOpcodes
};