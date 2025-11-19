/**
 * BITBOXER - FX Preset System
 * 
 * Handles saving/loading FX presets (Delay, Reverb, EQ, Sets)
 * Supports JSON file export/import and built-in presets
 */

// ============================================
// BUILT-IN PRESETS
// ============================================

const FX_PRESETS = {
    delay: [
        {
            name: "Short Slap",
            description: "Quick rhythmic delay for percussive elements",
            params: {
                delay: "200",
                delaymustime: "8",
                feedback: "150",
                cutoff: "800",
                filtquality: "500",
                dealybeatsync: "1",
                filtenable: "0",
                delaypingpong: "0"
            },
            modsources: []
        },
        {
            name: "Long Echo",
            description: "Spacious delay with filtered feedback",
            params: {
                delay: "600",
                delaymustime: "7",
                feedback: "600",
                cutoff: "300",
                filtquality: "700",
                dealybeatsync: "1",
                filtenable: "1",
                delaypingpong: "1"
            },
            modsources: []
        },
        {
            name: "Dotted Eighth",
            description: "Classic dotted eighth note delay",
            params: {
                delay: "400",
                delaymustime: "7",
                feedback: "400",
                cutoff: "500",
                filtquality: "500",
                dealybeatsync: "1",
                filtenable: "1",
                delaypingpong: "1"
            },
            modsources: []
        },
        {
            name: "Ping Pong Dance",
            description: "Wide stereo ping-pong delay",
            params: {
                delay: "300",
                delaymustime: "6",
                feedback: "500",
                cutoff: "700",
                filtquality: "400",
                dealybeatsync: "1",
                filtenable: "1",
                delaypingpong: "1"
            },
            modsources: []
        },
        {
            name: "Tape Echo",
            description: "Warm filtered delay simulation",
            params: {
                delay: "450",
                delaymustime: "8",
                feedback: "550",
                cutoff: "200",
                filtquality: "800",
                dealybeatsync: "1",
                filtenable: "1",
                delaypingpong: "0"
            },
            modsources: []
        }
    ],
    
    reverb: [
        {
            name: "Small Room",
            description: "Tight, natural room ambience",
            params: {
                decay: "300",
                predelay: "10",
                damping: "600"
            },
            modsources: []
        },
        {
            name: "Large Hall",
            description: "Spacious concert hall reverb",
            params: {
                decay: "800",
                predelay: "40",
                damping: "400"
            },
            modsources: []
        },
        {
            name: "Bright Plate",
            description: "Classic bright plate reverb",
            params: {
                decay: "600",
                predelay: "20",
                damping: "200"
            },
            modsources: []
        },
        {
            name: "Dark Space",
            description: "Deep, dark ambient reverb",
            params: {
                decay: "900",
                predelay: "60",
                damping: "800"
            },
            modsources: []
        },
        {
            name: "Gated Verb",
            description: "Short gated reverb for drums",
            params: {
                decay: "200",
                predelay: "5",
                damping: "500"
            },
            modsources: []
        }
    ],
    
    eq: [
        {
            name: "Bass Boost",
            description: "Enhanced low end warmth",
            params: {
                eqgain: "6000", eqcutoff: "150", eqres: "400", eqenable: "1", eqtype: "2",
                eqgain2: "0", eqcutoff2: "400", eqres2: "400", eqenable2: "1", eqtype2: "3",
                eqgain3: "0", eqcutoff3: "600", eqres3: "400", eqenable3: "1", eqtype3: "3",
                eqgain4: "0", eqcutoff4: "800", eqres4: "400", eqenable4: "1", eqtype4: "4"
            },
            modsources: []
        },
        {
            name: "Presence",
            description: "Vocal clarity and presence boost",
            params: {
                eqgain: "0", eqcutoff: "200", eqres: "400", eqenable: "1", eqtype: "1",
                eqgain2: "4000", eqcutoff2: "500", eqres2: "300", eqenable2: "1", eqtype2: "3",
                eqgain3: "0", eqcutoff3: "600", eqres3: "400", eqenable3: "1", eqtype3: "3",
                eqgain4: "-2000", eqcutoff4: "850", eqres4: "400", eqenable4: "1", eqtype4: "4"
            },
            modsources: []
        },
        {
            name: "Telephone",
            description: "Lo-fi telephone effect",
            params: {
                eqgain: "0", eqcutoff: "300", eqres: "400", eqenable: "1", eqtype: "1",
                eqgain2: "6000", eqcutoff2: "600", eqres2: "200", eqenable2: "1", eqtype2: "3",
                eqgain3: "0", eqcutoff3: "600", eqres3: "400", eqenable3: "1", eqtype3: "3",
                eqgain4: "0", eqcutoff4: "700", eqres4: "400", eqenable4: "1", eqtype4: "5"
            },
            modsources: []
        },
        {
            name: "Smiley Face",
            description: "V-shaped curve for energy",
            params: {
                eqgain: "5000", eqcutoff: "150", eqres: "400", eqenable: "1", eqtype: "2",
                eqgain2: "-3000", eqcutoff2: "500", eqres2: "300", eqenable2: "1", eqtype2: "3",
                eqgain3: "0", eqcutoff3: "600", eqres3: "400", eqenable3: "1", eqtype3: "3",
                eqgain4: "4000", eqcutoff4: "850", eqres4: "400", eqenable4: "1", eqtype4: "4"
            },
            modsources: []
        },
        {
            name: "Flat",
            description: "Neutral EQ starting point",
            params: {
                eqgain: "0", eqcutoff: "200", eqres: "400", eqenable: "1", eqtype: "1",
                eqgain2: "0", eqcutoff2: "400", eqres2: "400", eqenable2: "1", eqtype2: "3",
                eqgain3: "0", eqcutoff3: "600", eqres3: "400", eqenable3: "1", eqtype3: "3",
                eqgain4: "0", eqcutoff4: "800", eqres4: "400", eqenable4: "1", eqtype4: "4"
            },
            modsources: []
        }
    ],
    
    sets: [
        {
            name: "Default",
            description: "Clean starting point",
            delay: {
                params: {
                    delay: "400", delaymustime: "6", feedback: "400", cutoff: "120",
                    filtquality: "1000", dealybeatsync: "1", filtenable: "1", delaypingpong: "1"
                },
                modsources: []
            },
            reverb: {
                params: { decay: "600", predelay: "40", damping: "500" },
                modsources: []
            },
            eq: {
                params: {
                    eqgain: "0", eqcutoff: "200", eqres: "400", eqenable: "1", eqtype: "1",
                    eqgain2: "0", eqcutoff2: "400", eqres2: "400", eqenable2: "1", eqtype2: "3",
                    eqgain3: "0", eqcutoff3: "600", eqres3: "400", eqenable3: "1", eqtype3: "3",
                    eqgain4: "0", eqcutoff4: "800", eqres4: "400", eqenable4: "1", eqtype4: "4"
                },
                modsources: []
            }
        },
        {
            name: "Bright Hall",
            description: "Spacious reverb with clarity",
            delay: {
                params: {
                    delay: "300", delaymustime: "8", feedback: "300", cutoff: "700",
                    filtquality: "500", dealybeatsync: "1", filtenable: "1", delaypingpong: "1"
                },
                modsources: []
            },
            reverb: {
                params: { decay: "800", predelay: "40", damping: "200" },
                modsources: []
            },
            eq: {
                params: {
                    eqgain: "-2000", eqcutoff: "100", eqres: "400", eqenable: "1", eqtype: "1",
                    eqgain2: "3000", eqcutoff2: "500", eqres2: "300", eqenable2: "1", eqtype2: "3",
                    eqgain3: "0", eqcutoff3: "600", eqres3: "400", eqenable3: "1", eqtype3: "3",
                    eqgain4: "2000", eqcutoff4: "850", eqres4: "400", eqenable4: "1", eqtype4: "4"
                },
                modsources: []
            }
        },
        {
            name: "Dark Space",
            description: "Deep ambient atmosphere",
            delay: {
                params: {
                    delay: "600", delaymustime: "7", feedback: "700", cutoff: "200",
                    filtquality: "900", dealybeatsync: "1", filtenable: "1", delaypingpong: "0"
                },
                modsources: []
            },
            reverb: {
                params: { decay: "900", predelay: "60", damping: "800" },
                modsources: []
            },
            eq: {
                params: {
                    eqgain: "4000", eqcutoff: "120", eqres: "400", eqenable: "1", eqtype: "2",
                    eqgain2: "-4000", eqcutoff2: "700", eqres2: "200", eqenable2: "1", eqtype2: "3",
                    eqgain3: "0", eqcutoff3: "600", eqres3: "400", eqenable3: "1", eqtype3: "3",
                    eqgain4: "-3000", eqcutoff4: "800", eqres4: "400", eqenable4: "1", eqtype4: "5"
                },
                modsources: []
            }
        },
        {
            name: "Rhythmic Delay",
            description: "Synced delay with short reverb",
            delay: {
                params: {
                    delay: "400", delaymustime: "7", feedback: "600", cutoff: "500",
                    filtquality: "600", dealybeatsync: "1", filtenable: "1", delaypingpong: "1"
                },
                modsources: []
            },
            reverb: {
                params: { decay: "300", predelay: "10", damping: "500" },
                modsources: []
            },
            eq: {
                params: {
                    eqgain: "0", eqcutoff: "200", eqres: "400", eqenable: "1", eqtype: "1",
                    eqgain2: "2000", eqcutoff2: "500", eqres2: "400", eqenable2: "1", eqtype2: "3",
                    eqgain3: "0", eqcutoff3: "600", eqres3: "400", eqenable3: "1", eqtype3: "3",
                    eqgain4: "0", eqcutoff4: "800", eqres4: "400", eqenable4: "1", eqtype4: "4"
                },
                modsources: []
            }
        },
        {
            name: "Warm Analog",
            description: "Vintage tape-style processing",
            delay: {
                params: {
                    delay: "450", delaymustime: "8", feedback: "550", cutoff: "250",
                    filtquality: "800", dealybeatsync: "1", filtenable: "1", delaypingpong: "0"
                },
                modsources: []
            },
            reverb: {
                params: { decay: "500", predelay: "25", damping: "700" },
                modsources: []
            },
            eq: {
                params: {
                    eqgain: "3000", eqcutoff: "150", eqres: "500", eqenable: "1", eqtype: "2",
                    eqgain2: "0", eqcutoff2: "400", eqres2: "400", eqenable2: "1", eqtype2: "3",
                    eqgain3: "0", eqcutoff3: "600", eqres3: "400", eqenable3: "1", eqtype3: "3",
                    eqgain4: "-2000", eqcutoff4: "850", eqres4: "300", eqenable4: "1", eqtype4: "4"
                },
                modsources: []
            }
        }
    ]
};

// ============================================
// SAVE FX PRESET
// ============================================

/**
 * Saves FX preset to JSON file
 * @param {string} fxType - 'delay', 'reverb', 'eq', or 'set'
 */
function saveFXPreset(fxType) {
    // FIXED: Renamed local variable to avoid conflict with parameter name
    const currentFX = window.BitboxerData.presetData;
    
    if (!currentFX.fx) {
        window.BitboxerUtils.setStatus('No FX data to save', 'error');
        return;
    }
    
    const name = prompt('Enter preset name:', `My ${fxType} preset`);
    if (!name) return;
    
    const description = prompt('Enter description (optional):', '');
    
    let presetData;  // ← This is the parameter variable (different scope)
    
    if (fxType === 'set') {
        // Save complete FX set
        presetData = {
            name: name,
            description: description || 'Custom FX set',
            delay: {
                params: { ...currentFX.fx.delay.params },
                modsources: JSON.parse(JSON.stringify(currentFX.fx.delay.modsources))
            },
            reverb: {
                params: { ...currentFX.fx.reverb.params },
                modsources: JSON.parse(JSON.stringify(currentFX.fx.reverb.modsources))
            },
            eq: {
                params: { ...currentFX.fx.eq.params },
                modsources: JSON.parse(JSON.stringify(currentFX.fx.eq.modsources))
            }
        };
    } else {
        // Save individual FX
        presetData = {
            name: name,
            description: description || `Custom ${fxType} preset`,
            params: { ...currentFX.fx[fxType].params },
            modsources: JSON.parse(JSON.stringify(currentFX.fx[fxType].modsources))
        };
    }
    
    // Export as JSON
    const json = JSON.stringify(presetData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    a.download = `${name.replace(/\s+/g, '_')}_${fxType}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    // Also show JSON for copy/paste
    showJSONCopyDialog(json, name);
    
    window.BitboxerUtils.setStatus(`Saved ${name}`, 'success');
}

/**
 * Shows dialog with JSON for copy/paste
 */
function showJSONCopyDialog(json, name) {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.style.zIndex = '4000';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h2>Load ${fxType.charAt(0).toUpperCase() + fxType.slice(1)} Preset</h2>
            </div>
            <div style="padding: 20px;">
                <div style="display: flex; flex-direction: column; gap: 15px;">
                    <button class="btn btn-primary" id="loadFileBtn">Load from File</button>
                    <input type="file" id="fxPresetFileInput" accept=".json" style="display: none;">

                    <div style="text-align: center; color: var(--color-text-secondary);">— or —</div>

                    <textarea id="fxPresetJSON" placeholder="Paste JSON here..." style="width: 100%; height: 200px; font-family: monospace; font-size: 0.85em; padding: 10px; background: var(--color-bg-primary); border: 1px solid var(--color-border); border-radius: var(--radius-md);"></textarea>

                    <!-- NEW: Error console -->
                    <div id="loadModalConsole" style="display: none; padding: 10px; background: var(--color-bg-primary); border: 1px solid var(--color-accent-red); border-radius: var(--radius-md); color: var(--color-accent-red); font-size: 0.9em; max-height: 100px; overflow-y: auto;"></div>

                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-primary" id="loadJSONBtn" style="flex: 1;">Load from Text</button>
                        <button class="btn" id="cancelLoadBtn" style="flex: 1;">Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('copyJSONBtn').onclick = () => {
        const textarea = modal.querySelector('textarea');
        textarea.select();
        document.execCommand('copy');
        window.BitboxerUtils.setStatus('Copied to clipboard', 'success');
    };
    
    document.getElementById('closeJSONDialog').onclick = () => {
        document.body.removeChild(modal);
    };
}

// ============================================
// LOAD FX PRESET
// ============================================

/**
 * Loads FX preset from JSON file or text
 * @param {string} fxType - 'delay', 'reverb', 'eq', or 'set'
 */
function loadFXPreset(fxType) {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.style.zIndex = '4000';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h2>Load ${fxType.charAt(0).toUpperCase() + fxType.slice(1)} Preset</h2>
            </div>
            <div style="padding: 20px;">
                <div style="display: flex; flex-direction: column; gap: 15px;">
                    <button class="btn btn-primary" id="loadFileBtn">Load from File</button>
                    <input type="file" id="fxPresetFileInput" accept=".json" style="display: none;">
                    
                    <div style="text-align: center; color: var(--color-text-secondary);">— or —</div>
                    
                    <textarea id="fxPresetJSON" placeholder="Paste JSON here..." style="width: 100%; height: 200px; font-family: monospace; font-size: 0.85em; padding: 10px; background: var(--color-bg-primary); border: 1px solid var(--color-border); border-radius: var(--radius-md);"></textarea>
                    
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-primary" id="loadJSONBtn" style="flex: 1;">Load from Text</button>
                        <button class="btn" id="cancelLoadBtn" style="flex: 1;">Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const fileInput = document.getElementById('fxPresetFileInput');
    
    document.getElementById('loadFileBtn').onclick = () => {
        fileInput.click();
    };
    
    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const console = document.getElementById('loadModalConsole');
        
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            
            const validation = validateFXJSON(parsed, fxType, file.name);
            if (!validation.valid) {
                // Show in modal console
                console.style.display = 'block';
                console.textContent = `❌ ${validation.error}`;
                return;
            }
            
            applyFXPreset(parsed, fxType);
            document.body.removeChild(modal);
        } catch (error) {
            console.style.display = 'block';
            console.textContent = `❌ Invalid JSON: ${error.message}`;
        }
    };
    
    document.getElementById('loadJSONBtn').onclick = () => {
        const text = document.getElementById('fxPresetJSON').value.trim();
        if (!text) {
            window.BitboxerUtils.setStatus('No JSON provided', 'error');
            return;
        }
        
        try {
            applyFXPreset(JSON.parse(text), fxType);
            document.body.removeChild(modal);
        } catch (error) {
            window.BitboxerUtils.setStatus(`Invalid JSON: ${error.message}`, 'error');
        }
    };
    
    document.getElementById('cancelLoadBtn').onclick = () => {
        document.body.removeChild(modal);
    };
}

/**
 * Validates JSON structure matches expected FX type
 */
function validateFXJSON(preset, expectedType, filename = '') {
    if (!preset || typeof preset !== 'object') {
        return { valid: false, error: 'Invalid JSON format' };
    }
    
    if (!preset.name) {
        return { valid: false, error: 'Missing preset name in JSON' };
    }
    
    // Check filename hint if provided
    const fileHint = filename.toLowerCase();
    if (fileHint) {
        if (expectedType === 'delay' && !fileHint.includes('.delay.json')) {
            return { valid: false, error: `File should be named "*.delay.json" for Delay presets. You selected: ${filename}` };
        }
        if (expectedType === 'reverb' && !fileHint.includes('.reverb.json')) {
            return { valid: false, error: `File should be named "*.reverb.json" for Reverb presets. You selected: ${filename}` };
        }
        if (expectedType === 'eq' && !fileHint.includes('.eq.json')) {
            return { valid: false, error: `File should be named "*.eq.json" for EQ presets. You selected: ${filename}` };
        }
        if ((expectedType === 'set' || expectedType === 'sets') && !fileHint.includes('.set.json')) {
            return { valid: false, error: `File should be named "*.set.json" for FX Set presets. You selected: ${filename}` };
        }
    }
    
    if (expectedType === 'set' || expectedType === 'sets') {
        // FX Set must have all three
        if (!preset.delay || !preset.reverb || !preset.eq) {
            return { valid: false, error: 'This is not an FX Set. Sets must contain delay, reverb, and eq.' };
        }
        if (!preset.delay.params || !preset.reverb.params || !preset.eq.params) {
            return { valid: false, error: 'Invalid FX Set structure (missing params)' };
        }
    } else {
        // Individual FX must have params
        if (!preset.params) {
            return { valid: false, error: `This is not a ${expectedType} preset. Missing params field.` };
        }
        
        // Check if it looks like a pad export (has wrong structure)
        if (preset.data || preset.padNumber) {
            return { valid: false, error: 'This appears to be a Pad export, not an FX preset.' };
        }
        
        // Basic param validation for each type
        if (expectedType === 'delay' && !preset.params.delay && !preset.params.delaymustime) {
            return { valid: false, error: 'This does not appear to be a Delay preset (missing delay parameters).' };
        }
        if (expectedType === 'reverb' && !preset.params.decay) {
            return { valid: false, error: 'This does not appear to be a Reverb preset (missing decay parameter).' };
        }
        if (expectedType === 'eq' && !preset.params.eqgain) {
            return { valid: false, error: 'This does not appear to be an EQ preset (missing EQ parameters).' };
        }
    }
    
    return { valid: true };
}

/**
 * Applies loaded preset to current FX
 */
function applyFXPreset(preset, fxType) {
    // Validate BEFORE applying
    const validation = validateFXJSON(preset, fxType);
    if (!validation.valid) {
        window.BitboxerUtils.setStatus(`❌ ${validation.error}`, 'error');
        return;
    }

    const currentFX = window.BitboxerData.presetData;
    
    if (fxType === 'sets') {  // ← Changed from 'set' to 'sets'
        // Apply complete set
        if (preset.delay) {
            Object.assign(currentFX.fx.delay.params, preset.delay.params);
            currentFX.fx.delay.modsources = JSON.parse(JSON.stringify(preset.delay.modsources || []));
        }
        if (preset.reverb) {
            Object.assign(currentFX.fx.reverb.params, preset.reverb.params);
            currentFX.fx.reverb.modsources = JSON.parse(JSON.stringify(preset.reverb.modsources || []));
        }
        if (preset.eq) {
            Object.assign(currentFX.fx.eq.params, preset.eq.params);
            currentFX.fx.eq.modsources = JSON.parse(JSON.stringify(preset.eq.modsources || []));
        }
        
        // Reload FX modal if open
        if (document.getElementById('fxModal').classList.contains('show')) {
            window.BitboxerFXEditor.loadFxParamsToModal();
        }
        
        window.BitboxerUtils.setStatus(`Loaded set: ${preset.name}`, 'success');
    } else {
        // Apply individual FX
        Object.assign(currentFX.fx[fxType].params, preset.params);
        currentFX.fx[fxType].modsources = JSON.parse(JSON.stringify(preset.modsources || []));
        
        // Reload FX modal if open
        if (document.getElementById('fxModal').classList.contains('show')) {
            window.BitboxerFXEditor.loadFxParamsToModal();
        }
        
        window.BitboxerUtils.setStatus(`Loaded ${fxType}: ${preset.name}`, 'success');
    }
}

// ============================================
// APPLY BUILT-IN PRESET
// ============================================

/**
 * Applies a built-in preset from dropdown
 */
function applyBuiltInPreset(fxType, presetName) {
    const presets = FX_PRESETS[fxType];
    
    // Check if preset category exists
    if (!presets) {
        window.BitboxerUtils.setStatus(`Invalid FX type: ${fxType}`, 'error');
        return;
    }
    
    const preset = presets.find(p => p.name === presetName);
    
    if (!preset) {
        window.BitboxerUtils.setStatus('Preset not found', 'error');
        return;
    }
    
    applyFXPreset(preset, fxType);
}

// ============================================
// EXPORT
// ============================================
window.BitboxerFXPresets = {
    FX_PRESETS,
    saveFXPreset,
    loadFXPreset,
    applyBuiltInPreset,
    applyFXPreset
};
