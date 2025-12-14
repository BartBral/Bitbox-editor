/**
 * BITBOXER - Pad Editor
 * 
 * This file handles pad editing functionality:
 * - Opening/closing pad edit modal
 * - Loading/saving pad parameters
 * - Parameter event listeners
 * - Modulation slot management
 * - Envelope visualization
 */

/**
 * BITBOXER - Unified Multisample State Manager
 * Tracks current asset, audio buffer, and loop points in one place
 */
class MultisampleEditorState {
    constructor() {
        this.reset();
    }

    reset() {
        this.currentAsset = null;
        this.audioBuffer = null;
        this.hasLoadedAudio = false;
        this.loopStart = 0;
        this.loopEnd = 0;
        this.loopEnabled = false;
    }

    setAsset(asset) {
        this.currentAsset = asset;
        this.hasLoadedAudio = false;
    }

    setAudioData(audioBuffer, loopStart, loopEnd, loopEnabled) {
        this.audioBuffer = audioBuffer;
        this.loopStart = loopStart;
        this.loopEnd = loopEnd;
        this.loopEnabled = loopEnabled;
        this.hasLoadedAudio = true;
    }

    clearAudioOnly() {
        this.audioBuffer = null;
        this.hasLoadedAudio = false;
    }

    needsReload(asset) {
        return !this.hasLoadedAudio || 
               this.currentAsset !== asset ||
               !this.audioBuffer;
    }
}

// Initialize global state
window._multiEditorState = new MultisampleEditorState();


// ============================================
// PAD EDIT MODAL
// ============================================
/**
 * Opens the pad edit modal for a specific pad
 * 
 * @param {HTMLElement} pad - Pad element to edit
 */
async function openEditModal(pad) {
    const { presetData } = window.BitboxerData;
    const row = parseInt(pad.dataset.row);
    const col = parseInt(pad.dataset.col);
    const padData = presetData.pads[row][col];

    if (!padData) return;

    window.BitboxerData.currentEditingPad = pad;

    

    // Clear editors
    if (window.BitboxerSampleEditor) {
        window.BitboxerSampleEditor.clearAudioData();
    }
    
    if (window._multiSampleEditor) {
        window._multiSampleEditor.clearAudioData();
    }
    
    // Clear multisample visualizer
    window._multiKeyboardViz = null;
    
    // Hide multisample UI
    const editPanel = document.getElementById('multiEditPanel');
    if (editPanel) editPanel.style.display = 'none';

    updateModalIcon(padData);
    document.getElementById('modalTitle').textContent =
        `Pad ${pad.dataset.padnum} - ${padData.filename || 'Empty'}`;

    loadParamsToModal(padData);
    renderModSlots(padData);
    updateSliderMaxValues(padData);
    await initSampleEditor(padData);

    window.BitboxerUI.openModal('editModal');

    window.BitboxerUI.updateTabVisibility();
    window.BitboxerUI.updateLFOParameterVisibility();
    window.BitboxerUI.updatePosConditionalVisibility();

    // Force browser reflow to ensure CSS changes take effect
    document.getElementById('tab-multi').offsetHeight;


    // Reset to Main tab
    const editModal = document.getElementById('editModal');
    const tabBtns = editModal.querySelectorAll('.tab-btn');
    const tabContents = editModal.querySelectorAll('.tab-content');

    tabBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));

    tabBtns[0].classList.add('active');
    tabContents[0].classList.add('active');

    drawEnvelope();

    // Sample editor resize
    setTimeout(() => {
        if (window.BitboxerSampleEditor.renderer) {
            window.BitboxerSampleEditor.renderer.resize();
            window.BitboxerSampleEditor.render();
        }
        if (window.BitboxerSampleEditor.scrollZoomBar) {
            window.BitboxerSampleEditor.scrollZoomBar.resize();
        }
    }, 50);
}

/**
 * Loads pad parameters into modal UI elements
 * 
 * @param {Object} padData - Pad data object
 */
function loadParamsToModal(padData) {
    const params = padData.params;

    // Load slider parameters
    const sliderParams = [
        'gaindb', 'pitch', 'panpos', 'dualfilcutoff', 'res',
        'envattack', 'envdecay', 'envsus', 'envrel',
        'lforate', 'lfoamount',
        'samstart', 'samlen', 'loopstart', 'loopend', 'loopfadeamt',
        'actslice', 'grainsizeperc', 'grainscat', 'grainpanrnd',
        'graindensity', 'grainreadspeed', 'gainssrcwin',
        'rootnote', 'fx1send', 'fx2send', 'beatcount'
    ];

    sliderParams.forEach(param => {
        const slider = document.getElementById(param);
        if (slider && params[param] !== undefined) {
            slider.value = params[param];
            window.BitboxerUtils.updateParamDisplay(param, params[param]);
        }
    });

    // Load dropdown parameters
    const dropdownParams = [
        'loopmodes', 'loopmode', 'samtrigtype', 'polymode',
        'lfowave', 'lfokeytrig', 'lfobeatsync', 'lforatebeatsync',
        'midimode', 'reverse', 'outputbus', 'chokegrp', 'slicestepmode',
        'legatomode', 'interpqual', 'quantsize', 'synctype', 'playthru',
        'slicerquantsize', 'slicersync'
    ];

    // Load cellmode dropdown - check for multisample
    const cellmodeSelect = document.getElementById('cellmode');
    if (cellmodeSelect && params.cellmode !== undefined) {
        const isMultisample = params.multisammode === '1';
        cellmodeSelect.value = isMultisample ? '0-multi' : params.cellmode;

        // Trigger visibility update immediately
        window.BitboxerUI.updateTabVisibility();
    }

    dropdownParams.forEach(param => {
        const select = document.getElementById(param);
        if (select && params[param] !== undefined) {
            select.value = params[param];
        }
    });
}

/**
 * Updates slider max values based on sample length
 * 
 * @param {Object} padData - Pad data object
 */
function updateSliderMaxValues(padData) {
    // CRITICAL FIX: Get actual audio buffer length, not samlen param
    let actualSampleLength = 4294967295; // Default fallback
    
    // Try to get actual sample length from loaded audio
    if (window.BitboxerSampleEditor && 
        window.BitboxerSampleEditor.audioEngine && 
        window.BitboxerSampleEditor.audioEngine.audioBuffer) {
        actualSampleLength = window.BitboxerSampleEditor.audioEngine.audioBuffer.length;
        console.log(`Using actual audio buffer length: ${actualSampleLength}`);
    } else {
        console.log(`No audio buffer available, using default max: ${actualSampleLength}`);
    }
    
    // Update position sliders - ALL use actual sample length as max
    ['samstart', 'samlen', 'loopstart', 'loopend'].forEach(param => {
        const slider = document.getElementById(param);
        if (slider) {
            slider.max = actualSampleLength;
            console.log(`Set ${param} max to ${actualSampleLength}`);
        }
    });
}

// ============================================
// PARAMETER EVENT LISTENERS
// ============================================
/**
 * Sets up all parameter event listeners for sliders and dropdowns
 */
function setupParameterListeners() {
    // Slider parameters
    const sliderParams = [
        'gaindb', 'pitch', 'panpos', 'dualfilcutoff', 'res',
        'envattack', 'envdecay', 'envsus', 'envrel',
        'lforate', 'lfoamount',
        'samstart', 'samlen', 'loopstart', 'loopend', 'loopfadeamt',
        'actslice', 'grainsizeperc', 'grainscat', 'grainpanrnd',
        'graindensity', 'grainreadspeed', 'gainssrcwin',
        'rootnote', 'fx1send', 'fx2send', 'beatcount'
    ];

    sliderParams.forEach(param => {
        const slider = document.getElementById(param);
        const display = document.getElementById(param + '-val');
        
        if (slider && display) {
            // Slider input event
            slider.addEventListener('input', () => {
                updateParamAndSave(param, slider.value);
                if (param.startsWith('env')) drawEnvelope();
                
                // Update sample editor canvas for position/loop parameters
                // ONLY when user manually moves slider (not during marker drag)
                if (['samstart', 'samlen', 'loopstart', 'loopend'].includes(param)) {
                    if (window.BitboxerSampleEditor && 
                        window.BitboxerSampleEditor.markerController &&
                        !window.BitboxerSampleEditor.markerController.isUpdatingFromDrag) {
                        
                        const { currentEditingPad, presetData } = window.BitboxerData;
                        if (currentEditingPad) {
                            const row = parseInt(currentEditingPad.dataset.row);
                            const col = parseInt(currentEditingPad.dataset.col);
                            const pad = presetData.pads[row][col];
                            
                            // Sync markers from pad params
                            window.BitboxerSampleEditor.markerController.syncFromPadParams(pad);
                            
                            // Re-render canvas
                            window.BitboxerSampleEditor.render();
                        }
                    }
                }
            });
        
            // Make display editable
            setupEditableDisplay(display, slider, param);
        }
    });



    // Granular parameter listeners (update visualization)
    ['grainsizeperc', 'gainssrcwin'].forEach(param => {
        const slider = document.getElementById(param);
        if (slider) {
            slider.addEventListener('input', () => {
                window.BitboxerSampleEditor.updateGranularParams();
            });
        }
    });

    // Clip mode parameter listeners
    const beatcountSlider = document.getElementById('beatcount');
    if (beatcountSlider) {
        beatcountSlider.addEventListener('input', () => {
            window.BitboxerSampleEditor.updateGranularParams(); // Reuses same update mechanism
        });
    }

    // Dropdown parameters
    const dropdownParams = [
        'cellmode', 'loopmodes', 'loopmode', 'samtrigtype', 'polymode',
        'lfowave', 'lfokeytrig', 'lfobeatsync', 'lforatebeatsync',
        'midimode', 'reverse', 'outputbus', 'chokegrp', 'slicestepmode',
        'legatomode', 'interpqual', 'quantsize', 'synctype', 'playthru',
        'slicerquantsize', 'slicersync'
    ];

    dropdownParams.forEach(param => {
        const select = document.getElementById(param);
        if (select) {
            select.addEventListener('change', () => {
                const value = select.value;

                // Handle multisample special case
                if (param === 'cellmode') {
                    if (value === '0-multi') {
                        updateParamAndSave('cellmode', '0');
                        updateParamAndSave('multisammode', '1');
                    } else {
                        updateParamAndSave('cellmode', value);
                        updateParamAndSave('multisammode', '0');
                    }

                    // Update visibility based on changes
                    window.BitboxerUI.updateTabVisibility();
                    window.BitboxerUI.updatePosConditionalVisibility();

                    // Force browser to recalculate styles
                    document.getElementById('tab-pos').offsetHeight;

                    // Refresh mod destinations when cell mode changes
                    const { currentEditingPad, presetData } = window.BitboxerData;
                    if (currentEditingPad) {
                        const row = parseInt(currentEditingPad.dataset.row);
                        const col = parseInt(currentEditingPad.dataset.col);
                        renderModSlots(presetData.pads[row][col]);

                        // Update modal icon
                        updateModalIcon(presetData.pads[row][col]);

                        // Re-init sample editor with new mode
                        const padData = presetData.pads[row][col];
                        initSampleEditor(padData);
                    }

                    // Refresh sample editor canvas with new mode
                    if (window.BitboxerSampleEditor) {
                        const modeValue = value === '0-multi' ? '0' : value;
                        window.BitboxerSampleEditor.setMode(modeValue);
                        window.BitboxerSampleEditor.render();
                    }
                } else {
                    // For all other dropdowns, just save the value
                    updateParamAndSave(param, value);
                }

                // Update visibility for other specific parameters
                if (param === 'lfobeatsync') {
                    window.BitboxerUI.updateLFOParameterVisibility();
                }

                if (param === 'loopmodes') {
                    window.BitboxerUI.updatePosConditionalVisibility();
                }
            });
        }
    });
}

/**
 * Sets up an editable display for a parameter
 * Allows clicking on the value to edit it directly
 * 
 * @param {HTMLElement} display - Display element
 * @param {HTMLInputElement} slider - Associated slider
 * @param {string} param - Parameter name
 */
function setupEditableDisplay(display, slider, param) {
    display.style.cursor = 'text';
    display.contentEditable = true;
    
    // Handle blur (when user clicks away)
    display.addEventListener('blur', () => {
        const value = window.BitboxerUtils.parseDisplayValue(param, display.textContent);
        if (value !== null) {
            slider.value = value;
            window.BitboxerUtils.updateParamDisplay(param, value);
            updateParamAndSave(param, value);
            if (param.startsWith('env')) drawEnvelope();
        }
    });
    
    // Handle Enter key
    display.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            display.blur();
        }
    });
    
    // Mouse wheel support (non-passive to allow preventDefault)
    display.addEventListener('wheel', (e) => {
        e.preventDefault();
        const currentVal = parseInt(slider.value);
        const step = e.shiftKey ? 100 : 10;
        const newVal = currentVal + (e.deltaY < 0 ? step : -step);
        const clampedVal = Math.max(
            parseInt(slider.min),
            Math.min(parseInt(slider.max), newVal)
        );

        slider.value = clampedVal;
        window.BitboxerUtils.updateParamDisplay(param, clampedVal);
        updateParamAndSave(param, clampedVal);
        if (param.startsWith('env')) drawEnvelope();
    }, { passive: false });

    // Touch support for mobile
    let touchStartY = 0;
    let touchStartValue = 0;

    display.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
        touchStartValue = parseInt(slider.value);
        e.preventDefault();
    }, { passive: false });

    display.addEventListener('touchmove', (e) => {
        const touchY = e.touches[0].clientY;
        const deltaY = touchStartY - touchY;
        const sensitivity = 2;
        const step = Math.floor(deltaY / sensitivity);

        const newVal = touchStartValue + step * 10;
        const clampedVal = Math.max(
            parseInt(slider.min),
            Math.min(parseInt(slider.max), newVal)
        );

        slider.value = clampedVal;
        window.BitboxerUtils.updateParamDisplay(param, clampedVal);
        updateParamAndSave(param, clampedVal);
        if (param.startsWith('env')) drawEnvelope();

        e.preventDefault();
    }, { passive: false });
}

/**
 * Updates a parameter value and saves it to the pad data
 * 
 * @param {string} param - Parameter name
 * @param {string|number} value - New value
 */
function updateParamAndSave(param, value) {
    const { currentEditingPad, presetData } = window.BitboxerData;
    
    if (currentEditingPad && presetData) {
        const row = parseInt(currentEditingPad.dataset.row);
        const col = parseInt(currentEditingPad.dataset.col);
        presetData.pads[row][col].params[param] = value.toString();
    }
    
    window.BitboxerUtils.updateParamDisplay(param, value);
}

// ============================================
// ENVELOPE VISUALIZATION
// ============================================
/**
 * Draws the ADSR envelope visualization on canvas
 */
function drawEnvelope() {
    const canvas = document.getElementById('envelopeCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = canvas.offsetHeight;

    ctx.clearRect(0, 0, width, height);

    // Get envelope values
    const attack = parseFloat(document.getElementById('envattack').value) / 1000;
    const decay = parseFloat(document.getElementById('envdecay').value) / 1000;
    const sustain = parseFloat(document.getElementById('envsus').value) / 1000;
    const release = parseFloat(document.getElementById('envrel').value) / 1000;

    // Draw envelope shape
    ctx.strokeStyle = '#a35a2d';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const pad = 15;
    const w = width - pad * 2;
    const h = height - pad * 2;

    // Calculate segment widths
    const total = attack + decay + 0.4 + release; // 0.4 = sustain time
    const ax = (attack / total) * w;
    const dx = (decay / total) * w;
    const sx = (0.4 / total) * w;
    const rx = (release / total) * w;

    // Draw ADSR shape
    ctx.moveTo(pad, pad + h);                                    // Start
    ctx.lineTo(pad + ax, pad);                                   // Attack
    ctx.lineTo(pad + ax + dx, pad + h * (1 - sustain));        // Decay
    ctx.lineTo(pad + ax + dx + sx, pad + h * (1 - sustain));   // Sustain
    ctx.lineTo(pad + ax + dx + sx + rx, pad + h);               // Release

    ctx.stroke();
}

// ============================================
// MULTISAMPLE 
// ============================================
/**
 * Renders multisample keyboard + editor
 * Uses existing WAVParser, proper canvas timing, clearAudioData
 */
function renderMultisampleList() {
    const { currentEditingPad, presetData, assetCells } = window.BitboxerData;
    if (!currentEditingPad) return;

    const row = parseInt(currentEditingPad.dataset.row);
    const col = parseInt(currentEditingPad.dataset.col);
    const padData = presetData.pads[row][col];

    const multiTab = document.getElementById('tab-multi');
    if (!multiTab) return;
    
    const paramSections = multiTab.querySelectorAll('.param-section');
    const editPanel = document.getElementById('multiEditPanel');

    console.log('=== renderMultisampleList DEBUG ===');
    console.log('Pad:', row, col);
    console.log('padData.params.multisammode:', padData.params.multisammode);

    // CHECK MODE FIRST, THEN DECIDE WHAT TO SHOW/HIDE
    if (padData.params.multisammode !== '1') {
        console.log('>>> NOT multisample, hiding sections');
        paramSections.forEach(section => {
            section.style.display = 'none';
        });
        if (editPanel) editPanel.style.display = 'none';
        
        // Clear keyboard visualizer selection (but keep asset data)
        if (window._multiKeyboardViz) {
            window._multiKeyboardViz.selectedAsset = null;
        }
        return;
    }

    // IS multisample - show everything
    console.log('>>> IS multisample, showing sections');
    paramSections.forEach(section => {
        section.style.display = 'block';
    });

    const assets = assetCells.filter(asset =>
        parseInt(asset.params.asssrcrow) === row &&
        parseInt(asset.params.asssrccol) === col
    );

    console.log('>>> Found', assets.length, 'assets for this pad');

    parseAssetsWAVMetadata(assets).then(() => {
        console.log('>>> After parseAssetsWAVMetadata, creating/updating visualizer');
        
        if (!window._multiKeyboardViz) {
            console.log('>>> Creating new KeyboardVisualizer');
            window._multiKeyboardViz = new KeyboardVisualizer('keyboardCanvas', 'keyboardScrollCanvas');
            window._multiKeyboardViz.onAssetSelected = (asset) => {
                loadMultisampleAssetToEditor(asset);
            };
        } else {
            console.log('>>> Reusing existing KeyboardVisualizer');
        }
        
        console.log('>>> Calling setAssets on visualizer');
        window._multiKeyboardViz.setAssets(assets);
    });
}

// ============================================
// MODULATION SLOT RENDERING
// ============================================
/**
 * Renders all modulation slots for a pad
 * 
 * @param {Object} padData - Pad data containing modsources
 */
function renderModSlots(padData) {
    const container = document.getElementById('modSlotContainer');
    if (!container) return;

    container.innerHTML = '';

    const cellmode = padData.params.cellmode || '0';
    const modsources = padData.modsources || [];

    // Render existing mod slots
    modsources.forEach((mod, index) => {
        container.innerHTML += createModSlotHTML(mod, index, cellmode);
    });

    // Setup event listeners for all slots
    setupModSlotListeners();

    // Apply initial appearance to all slots
    document.querySelectorAll('.mod-slot').forEach(slotElement => {
        updateModSlotAppearance(slotElement);
    });
}

/**
 * Creates HTML for a single modulation slot
 * 
 * @param {Object} modData - Modulation data
 * @param {number} index - Slot index
 * @param {string} cellmode - Current cell mode
 * @returns {string} HTML string
 */
function createModSlotHTML(modData, index, cellmode) {
    const { MOD_SOURCES, MOD_DESTINATIONS } = window.BITBOXER_CONFIG;
    const destinations = MOD_DESTINATIONS[cellmode] || MOD_DESTINATIONS['0'];

    // Build source dropdown options
    const sourceOptions = MOD_SOURCES.map(src =>
        `<option value="${src.value}" ${modData.src === src.value ? 'selected' : ''}>${src.label}</option>`
    ).join('');

    // Build destination dropdown options
    const destOptions = destinations.map(dest =>
        `<option value="${dest.value}" ${modData.dest === dest.value ? 'selected' : ''}>${dest.label}</option>`
    ).join('');

    // Format amount display
    const amount = parseInt(modData.amount) || 0;
    const amountText = (amount >= 0 ? '+' : '') + (amount / 10).toFixed(1) + '%';

    const slotLabel = `${index + 1}`;

    // Check if this slot uses MIDI CC
    const isMidiCC = modData.src === 'midicc';
    const midiChannel = modData.mchan !== undefined ? parseInt(modData.mchan) : 0;
    const midiCCNum = modData.ccnum !== undefined ? parseInt(modData.ccnum) : 0;

    // Generate MIDI channel options (1-16)
    let channelOptions = '';
    for (let i = 0; i < 16; i++) {
        channelOptions += `<option value="${i}" ${midiChannel === i ? 'selected' : ''}>Ch ${i + 1}</option>`;
    }

    // Generate CC number options (0-127)
    let ccOptions = '';
    for (let i = 0; i <= 127; i++) {
        ccOptions += `<option value="${i}" ${midiCCNum === i ? 'selected' : ''}>CC ${i}</option>`;
    }

    return `
        <div class="mod-slot" data-slot="${index}">
            <div class="mod-slot-number" title="Slot ${index + 1}">${slotLabel}</div>
            <select class="select mod-source" data-slot="${index}">
                ${sourceOptions}
            </select>
            <div class="mod-amount">
                <input type="range" class="slider mod-amount-slider" data-slot="${index}" 
                       min="-1000" max="1000" value="${amount}">
                <span class="mod-amount-val" data-slot="${index}">${amountText}</span>
            </div>
            <select class="select mod-dest" data-slot="${index}">
                ${destOptions}
            </select>
            <div></div>
            <button class="mod-remove-btn" data-slot="${index}">×</button>
        </div>
        <div class="mod-midicc-config" data-slot="${index}" style="display: ${isMidiCC ? 'grid' : 'none'};">
            <div></div>
            <select class="select mod-midicc-channel" data-slot="${index}">
                ${channelOptions}
            </select>
            <span class="mod-midicc-label">+</span>
            <select class="select mod-midicc-ccnum" data-slot="${index}">
                ${ccOptions}
            </select>
            <div></div>
            <div></div>
        </div>
    `;
}

/**
 * Sets up event listeners for all modulation slots
 */
function setupModSlotListeners() {
    // Source dropdowns
    document.querySelectorAll('.mod-source').forEach(select => {
        select.addEventListener('change', (e) => {
            const slot = parseInt(e.target.dataset.slot);
            const newSource = e.target.value;

            const { currentEditingPad, presetData } = window.BitboxerData;
            if (!currentEditingPad || !presetData) return;

            const row = parseInt(currentEditingPad.dataset.row);
            const col = parseInt(currentEditingPad.dataset.col);
            const padData = presetData.pads[row][col];

            if (!padData.modsources[slot]) {
                padData.modsources[slot] = { dest: 'none', src: 'none', slot: '0', amount: '0' };
            }

            // Update source
            padData.modsources[slot].src = newSource;

            // Update appearance
            const slotElement = e.target.closest('.mod-slot');
            if (slotElement) updateModSlotAppearance(slotElement);

            // Show/hide MIDI CC config
            const midiccConfig = slotElement?.nextElementSibling;
            if (midiccConfig && midiccConfig.classList.contains('mod-midicc-config')) {
                if (newSource === 'midicc') {
                    midiccConfig.style.display = 'grid';
                    if (!padData.modsources[slot].mchan) padData.modsources[slot].mchan = '0';
                    if (!padData.modsources[slot].ccnum) padData.modsources[slot].ccnum = '0';
                } else {
                    midiccConfig.style.display = 'none';
                    delete padData.modsources[slot].mchan;
                    delete padData.modsources[slot].ccnum;
                }
            }
        });
    });

    // MIDI CC Channel dropdowns
    document.querySelectorAll('.mod-midicc-channel').forEach(select => {
        select.addEventListener('change', (e) => {
            const slot = parseInt(e.target.dataset.slot);
            updateModSlot(slot, 'mchan', e.target.value);
        });
    });

    // MIDI CC Number dropdowns
    document.querySelectorAll('.mod-midicc-ccnum').forEach(select => {
        select.addEventListener('change', (e) => {
            const slot = parseInt(e.target.dataset.slot);
            updateModSlot(slot, 'ccnum', e.target.value);
        });
    });

    // Destination dropdowns
    document.querySelectorAll('.mod-dest').forEach(select => {
        select.addEventListener('change', (e) => {
            const slot = parseInt(e.target.dataset.slot);
            const newDest = e.target.value;

            // Validate destination limit (skip validation for 'none')
            if (newDest !== 'none') {
                const validation = window.BitboxerUtils.validateModDestination(newDest, slot);

                if (!validation.valid) {
                    window.BitboxerUtils.setStatus(
                        `Maximum 3 modulations per destination! ${newDest} already has 3 slots.`, 
                        'error'
                    );
                    // Revert to previous value
                    const { currentEditingPad, presetData } = window.BitboxerData;
                    const row = parseInt(currentEditingPad.dataset.row);
                    const col = parseInt(currentEditingPad.dataset.col);
                    const previousDest = presetData.pads[row][col].modsources[slot]?.dest || 'none';
                    e.target.value = previousDest;
                    return;
                }
            }

            updateModSlot(slot, 'dest', newDest);

            // Update appearance immediately
            const slotElement = e.target.closest('.mod-slot');
            if (slotElement) updateModSlotAppearance(slotElement);

            // Update slot number to match destination's slot count
            if (newDest !== 'none') {
                const { currentEditingPad, presetData } = window.BitboxerData;
                const row = parseInt(currentEditingPad.dataset.row);
                const col = parseInt(currentEditingPad.dataset.col);
                const destSlotNum = presetData.pads[row][col].modsources.filter((mod, idx) =>
                    mod.dest === newDest && idx <= slot
                ).length - 1;
                updateModSlot(slot, 'slot', destSlotNum.toString());
            }
        });
    });

    // Amount sliders
    document.querySelectorAll('.mod-amount-slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const slot = parseInt(e.target.dataset.slot);
            const amount = e.target.value;
            updateModSlot(slot, 'amount', amount);

            // Update display
            const display = document.querySelector(`.mod-amount-val[data-slot="${slot}"]`);
            if (display) {
                const amountText = (amount >= 0 ? '+' : '') + (amount / 10).toFixed(1) + '%';
                display.textContent = amountText;
            }
        });
    });

    // Remove buttons
    document.querySelectorAll('.mod-remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const slot = parseInt(e.target.dataset.slot);
            removeModSlot(slot);
        });
    });
}

/**
 * Updates a field in a modulation slot
 * 
 * @param {number} slot - Slot index
 * @param {string} field - Field name
 * @param {string} value - New value
 */
function updateModSlot(slot, field, value) {
    const { currentEditingPad, presetData } = window.BitboxerData;
    if (!currentEditingPad || !presetData) return;

    const row = parseInt(currentEditingPad.dataset.row);
    const col = parseInt(currentEditingPad.dataset.col);
    const padData = presetData.pads[row][col];

    if (!padData.modsources[slot]) {
        padData.modsources[slot] = { dest: 'none', src: 'none', slot: '0', amount: '0' };
    }

    padData.modsources[slot][field] = value.toString();

    // Auto-update the destination slot number when dest changes
    if (field === 'dest' && value !== 'none') {
        const destSlotNum = padData.modsources.filter((mod, idx) =>
            mod.dest === value && idx <= slot
        ).length - 1;
        padData.modsources[slot].slot = destSlotNum.toString();
    }
}

/**
 * Removes a modulation slot
 * 
 * @param {number} slot - Slot index to remove
 */
function removeModSlot(slot) {
    const { currentEditingPad, presetData } = window.BitboxerData;
    if (!currentEditingPad || !presetData) return;

    const row = parseInt(currentEditingPad.dataset.row);
    const col = parseInt(currentEditingPad.dataset.col);
    const padData = presetData.pads[row][col];

    padData.modsources.splice(slot, 1);

    // Re-render
    renderModSlots(padData);
}

/**
 * Adds a new modulation slot
 */
function addModSlot() {
    const { currentEditingPad, presetData, MAX_MOD_SLOTS_PAD } = window.BitboxerData;
    if (!currentEditingPad || !presetData) return;

    const row = parseInt(currentEditingPad.dataset.row);
    const col = parseInt(currentEditingPad.dataset.col);
    const padData = presetData.pads[row][col];

    if (!padData.modsources) padData.modsources = [];

    if (padData.modsources.length >= 12) {
        window.BitboxerUtils.setStatus('Maximum 12 modulation slots per pad', 'error');
        return;
    }

    const newSlot = {
        dest: 'gaindb',
        src: 'velocity',
        slot: '0',
        amount: '0'
    };

    // Check if gaindb already has 3 slots
    const validation = window.BitboxerUtils.validateModDestination('gaindb', -1);
    if (!validation.valid) {
        // Default to 'none' if gaindb is full
        newSlot.dest = 'none';
        newSlot.src = 'none';
        window.BitboxerUtils.setStatus('Added slot with no destination (default gaindb is full)', 'success');
    }

    padData.modsources.push(newSlot);
    renderModSlots(padData);
}

/**
 * Updates visual appearance of a modulation slot based on its state
 * Active slots (both source and dest set) are fully visible
 * Inactive slots are dimmed
 * 
 * @param {HTMLElement} slotElement - Slot element to update
 */
function updateModSlotAppearance(slotElement) {
    const sourceSelect = slotElement.querySelector('.mod-source');
    const destSelect = slotElement.querySelector('.mod-dest');

    if (!sourceSelect || !destSelect) return;

    const isActive = sourceSelect.value !== 'none' && destSelect.value !== 'none';

    // Update opacity
    slotElement.style.opacity = isActive ? '1' : '0.5';

    // Add/remove inactive class
    if (isActive) {
        slotElement.classList.remove('inactive');
    } else {
        slotElement.classList.add('inactive');
    }
}

/**
 * Updates the modal icon based on current pad mode
 */
function updateModalIcon(padData) {
    const modalIcon = document.getElementById('modalIcon');
    if (!modalIcon) return;
    
    const isMulti = padData.params.multisammode === '1';
    const mode = isMulti ? '0-multi' : (padData.params.cellmode || '0');
    
    const icons = {
        '0': '<rect class="cls-1" width="32" height="32" rx="5.96" ry="5.96"/><polygon class="cls-2" points="25.78 16 25.78 15.11 24.89 15.11 24.89 13.33 24 13.33 24 15.11 23.12 15.11 23.12 16 22.23 16 22.23 17.78 21.34 17.78 21.34 16 20.45 16 20.45 13.33 19.56 13.33 19.56 9.77 18.67 9.77 18.67 13.33 17.78 13.33 17.78 16 16.89 16 16.89 21.34 16 21.34 16 20.45 16 19.56 16 18.67 16 17.78 16 16.89 15.11 16.89 15.11 16 15.11 15.11 14.22 15.11 14.22 9.77 13.33 9.77 13.33 6.22 12.44 6.22 12.44 9.77 11.55 9.77 11.55 16 10.66 16 9.77 16 9.77 15.11 8.88 15.11 8.88 13.33 8 13.33 8 15.11 7.11 15.11 7.11 16 5.33 16 5.33 15.11 4.44 15.11 4.44 16 3.55 16 3.55 16.89 6.22 16.89 6.22 17.78 7.11 17.78 7.11 16.89 8 16.89 8 16 8.88 16 8.88 16.89 9.77 16.89 9.77 19.56 10.66 19.56 10.66 17.78 11.55 17.78 11.55 16.89 12.44 16.89 12.44 11.55 13.33 11.55 13.33 16.89 14.22 16.89 14.22 17.78 15.11 17.78 15.11 23.12 16 23.12 16 25.78 16.89 25.78 16.89 23.12 17.78 23.12 17.78 16.89 18.67 16.89 18.67 15.11 19.56 15.11 19.56 16.89 20.45 16.89 20.45 18.67 21.34 18.67 21.34 19.56 22.23 19.56 22.23 18.67 23.12 18.67 23.12 16.89 24 16.89 24 16 24.89 16 24.89 16.89 25.78 16.89 25.78 17.78 26.67 17.78 26.67 16.89 28.45 16.89 28.45 16 25.78 16"/>',
        '1': '<rect class="cls-1" width="32" height="32" rx="5.96" ry="5.96"/><path class="cls-2" d="M28.9,25.34V6.66H3.1v18.68h25.79ZM28.01,15.56h-2.67v-1.78h-.89v-1.78h-.89v1.78h-.89v1.78h-2.67v-1.78h-.89v-1.78h-.89v1.78h-.89v1.78h-2.67v-1.78h-.89v-1.78h-.89v1.78h-.89v1.78h-2.67v-1.78h-.89v-1.78h-.89v1.78h-.89v1.78h-2.67v-6.23h24.01v6.23ZM3.99,16.44h2.67v1.78h.89v1.78h.89v-1.78h.89v-1.78h2.67v1.78h.89v1.78h.89v-1.78h.89v-1.78h2.67v1.78h.89v1.78h.89v-1.78h.89v-1.78h2.67v1.78h.89v1.78h.89v-1.78h.89v-1.78h2.67v6.23H3.99v-6.23Z"/>',
        '2': '<rect class="cls-1" width="32" height="32" rx="5.96" ry="5.96"/><polygon class="cls-2" points="12.44 4.44 11.55 4.44 11.55 27.56 20.45 27.56 20.45 20.45 12.44 20.45 12.44 4.44"/>',
        '3': '<rect class="cls-1" width="32" height="32" rx="5.96" ry="5.96"/><path class="cls-2" d="M3.1,5.77v20.46h25.79V5.77H3.1ZM28.01,24.45h-.89v.89H5.77v-.89h-1.78V6.66h11.56v.89h1.78v-.89h10.67v17.79Z"/><rect class="cls-2" x="5.77" y="23.56" width=".89" height=".89"/><rect class="cls-2" x="6.66" y="22.67" width=".89" height=".89"/><rect class="cls-2" x="7.55" y="20.89" width=".89" height=".89"/><rect class="cls-2" x="8.44" y="19.11" width=".89" height=".89"/><rect class="cls-2" x="9.33" y="17.33" width=".89" height=".89"/><rect class="cls-2" x="10.22" y="14.67" width=".89" height=".89"/><rect class="cls-2" x="11.11" y="12.89" width=".89" height=".89"/><rect class="cls-2" x="12" y="11.11" width=".89" height=".89"/><rect class="cls-2" x="12.89" y="9.33" width=".89" height=".89"/><rect class="cls-2" x="13.78" y="8.44" width=".89" height=".89"/><rect class="cls-2" x="14.67" y="7.55" width=".89" height=".89"/><rect class="cls-2" x="17.33" y="7.55" width=".89" height=".89"/><rect class="cls-2" x="18.22" y="8.44" width=".89" height=".89"/><rect class="cls-2" x="19.11" y="9.33" width=".89" height=".89"/><rect class="cls-2" x="20" y="11.11" width=".89" height=".89"/><rect class="cls-2" x="20.89" y="12.89" width=".89" height=".89"/><rect class="cls-2" x="21.78" y="14.67" width=".89" height=".89"/><rect class="cls-2" x="22.67" y="17.33" width=".89" height=".89"/><rect class="cls-2" x="23.56" y="19.11" width=".89" height=".89"/><rect class="cls-2" x="24.45" y="20.89" width=".89" height=".89"/><rect class="cls-2" x="25.34" y="22.67" width=".89" height=".89"/><rect class="cls-2" x="26.23" y="23.56" width=".89" height=".89"/>',
        '0-multi': '<rect class="cls-1" width="32" height="32" rx="5.96" ry="5.96"/><polygon class="cls-2" points="19.11 8 17.33 8 17.33 8.88 16.44 8.88 16.44 9.77 15.56 9.77 15.56 10.66 14.67 10.66 14.67 11.55 13.78 11.55 13.78 12.44 12.89 12.44 12.89 13.33 12 13.33 12 14.22 10.22 14.22 10.22 13.33 9.33 13.33 9.33 12.44 8.44 12.44 8.44 11.55 7.55 11.55 7.55 10.66 6.66 10.66 6.66 9.77 5.77 9.77 5.77 8.88 4.88 8.88 4.88 8 3.1 8 3.1 24 5.77 24 5.77 13.33 6.66 13.33 6.66 14.22 7.55 14.22 7.55 15.11 8.44 15.11 8.44 16 9.33 16 9.33 16.89 10.22 16.89 10.22 17.78 12 17.78 12 16.89 12.89 16.89 12.89 16 13.78 16 13.78 15.11 14.67 15.11 14.67 14.22 15.56 14.22 15.56 13.33 16.44 13.33 16.44 24 19.11 24 19.11 8"/><polygon class="cls-2" points="27.12 15.11 27.12 16 26.23 16 26.23 16.89 25.34 16.89 25.34 17.78 23.56 17.78 23.56 16.89 22.67 16.89 22.67 16 21.78 16 21.78 15.11 20 15.11 20 16.89 20.89 16.89 20.89 17.78 21.78 17.78 21.78 18.67 22.67 18.67 22.67 20.45 21.78 20.45 21.78 21.34 20.89 21.34 20.89 22.23 20 22.23 20 24 21.78 24 21.78 23.12 22.67 23.12 22.67 22.23 23.56 22.23 23.56 21.34 25.34 21.34 25.34 22.23 26.23 22.23 26.23 23.12 27.12 23.12 27.12 24 28.9 24 28.9 22.23 28.01 22.23 28.01 21.34 27.12 21.34 27.12 20.45 26.23 20.45 26.23 18.67 27.12 18.67 27.12 17.78 28.01 17.78 28.01 16.89 28.9 16.89 28.9 15.11 27.12 15.11"/>'
    };
    
    modalIcon.innerHTML = icons[mode] || icons['0'];
}

/**
 * Initializes the sample editor canvas and UI
 * This function handles both one-time setup and per-call UI updates
 */
async function initSampleEditor(padData) {
    const container = document.getElementById('sampleEditorContainer');
    if (!container) return;

    const cellmode = padData.params.cellmode;
    const isMulti = padData.params.multisammode === '1';
    
    // Hide container for multisample or empty pads
    if (isMulti || !padData.filename) {
        container.style.display = 'none';
        return;
    }

    // Show container
    container.style.display = 'block';
    container.style.minHeight = '200px';
    container.offsetHeight;

    // Clear previous pad's audio data BEFORE loading new pad
    if (window.BitboxerSampleEditor) {
        window.BitboxerSampleEditor.clearAudioData();
    }

    // Check if we need full initialization
    const { currentEditingPad } = window.BitboxerData;
    const row = parseInt(currentEditingPad.dataset.row);
    const col = parseInt(currentEditingPad.dataset.col);
    const currentPadId = `${row}-${col}`;
    const needsInitialization = (window._lastInitializedPad !== currentPadId);

    if (needsInitialization) {
        console.log('Initializing sample editor for pad:', currentPadId);
        window._lastInitializedPad = currentPadId;
        
        // Initialize editor
        await window.BitboxerSampleEditor.init('waveformCanvas');
        
        // Load sample
        const wavName = padData.filename.split(/[/\\]/).pop();
        let sampleLoaded = false;
        
        if (window._lastImportedFiles && window._lastImportedFiles.has(wavName)) {
            const wavFile = window._lastImportedFiles.get(wavName);
            sampleLoaded = await window.BitboxerSampleEditor.loadSample(wavFile);
        }
        
        if (!sampleLoaded) {
            const canvas = document.getElementById('waveformCanvas');
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#d0c2b9';
            ctx.font = '14px monospace';
            ctx.fillText('Sample not loaded. Import the sample first.', 10, 100);
            return;
        }
        
        // Update slider max values now that audio is loaded
        window.BitboxerPadEditor.updateSliderMaxValues(padData);
        
        // Setup playback controls (ONE-TIME)
        document.getElementById('playBtn').onclick = () => 
            window.BitboxerSampleEditor.play();
        document.getElementById('stopBtn').onclick = () => 
            window.BitboxerSampleEditor.stop();
        document.getElementById('playSelectionBtn').onclick = () => {
            if (window.BitboxerSampleEditor.selectionStart !== null) {
                window.BitboxerSampleEditor.playSelection();
            } else {
                window.BitboxerUtils.setStatus('No selection - drag in waveform', 'error');
            }
        };
        
        // Setup unified scroll-zoom bar (ONE-TIME)
        if (!window.BitboxerSampleEditor.scrollZoomBar) {
            window.BitboxerSampleEditor.scrollZoomBar = new ScrollZoomBar(
                window.BitboxerSampleEditor.renderer,
                () => {
                    // Callback when zoom/scroll changes
                    const zoomValue = document.getElementById('zoomValue');
                    if (zoomValue) {
                        const zoom = window.BitboxerSampleEditor.renderer.zoom;
                        zoomValue.textContent = zoom.toFixed(1) + 'x zoom';
                    }
                    window.BitboxerSampleEditor.render();
                }
            );

            window.BitboxerSampleEditor.scrollZoomBar.init('scrollZoomCanvas');

            // Handle window resize
            window.addEventListener('resize', () => {
                if (window.BitboxerSampleEditor.scrollZoomBar) {
                    window.BitboxerSampleEditor.scrollZoomBar.resize();
                }
            });
        }
                
        // Setup snap toggle (ONE-TIME)
        const snapCheckbox = document.getElementById('snapToZeroCheckbox');
        if (snapCheckbox) {
            snapCheckbox.checked = true;
            snapCheckbox.addEventListener('change', () => {
                if (window.BitboxerSampleEditor && window.BitboxerSampleEditor.markerController) {
                    window.BitboxerSampleEditor.markerController.snapToZeroCrossingEnabled = snapCheckbox.checked;
                }
            });
        }
    } else {
        // NOT first time - just reload the sample for this pad
        console.log('Reloading sample for existing pad:', currentPadId);
        
        const wavName = padData.filename.split(/[/\\]/).pop();
        let sampleLoaded = false;
        
        if (window._lastImportedFiles && window._lastImportedFiles.has(wavName)) {
            const wavFile = window._lastImportedFiles.get(wavName);
            sampleLoaded = await window.BitboxerSampleEditor.loadSample(wavFile);
        }
        
        if (!sampleLoaded) {
            const canvas = document.getElementById('waveformCanvas');
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#d0c2b9';
            ctx.font = '14px monospace';
            ctx.fillText('Sample not loaded. Import the sample first.', 10, 100);
            return;
        }
        
        // Update slider max values
        window.BitboxerPadEditor.updateSliderMaxValues(padData);
    }

    // ALWAYS: Update mode-specific UI
    window.BitboxerSampleEditor.setMode(cellmode);
    
    // Setup mode-specific controls
    const slicerControls = document.getElementById('slicerControls');
    const granularControls = document.getElementById('granularControls');
    const clipControls = document.getElementById('clipControls');
    const editorHints = document.getElementById('editorHints');
    
    // Hide all
    if (slicerControls) slicerControls.style.display = 'none';
    if (granularControls) granularControls.style.display = 'none';
    if (clipControls) clipControls.style.display = 'none';
    
    // Show appropriate controls
    if (cellmode === '2') {
        // SLICER MODE - ADVANCED
        if (slicerControls) slicerControls.style.display = 'flex';
        if (editorHints) {
            editorHints.textContent = 'Shift+Click: add slice | Right-click: delete | Auto-detects on sensitivity change';
        }

        const updateSliceCount = () => {
            const count = window.BitboxerSampleEditor.markerController.sliceMarkers.length;
            const sliceCount = document.getElementById('sliceCount');
            if (sliceCount) {
                sliceCount.textContent = `${count} slice${count !== 1 ? 's' : ''}`;
            }
        };
        updateSliceCount();

        // Algorithm selection
        const algorithmSelect = document.getElementById('onsetAlgorithmSelect');
        const sensitivitySlider = document.getElementById('onsetSensitivitySlider');
        const sensitivityValue = document.getElementById('onsetSensitivityValue');
        const minDistanceSlider = document.getElementById('minSliceDistanceSlider');
        const minDistanceValue = document.getElementById('minSliceDistanceValue');

        // Store current settings
        let currentAlgorithm = 'flux';
        let currentSensitivity = 0.5;
        let currentMinDistance = 1000;
        let autoDetectTimer = null;

        // Debounced auto-detect function
        const triggerAutoDetect = () => {
            if (autoDetectTimer) clearTimeout(autoDetectTimer);

            autoDetectTimer = setTimeout(() => {
                window.BitboxerUtils.setStatus('Auto-analyzing...', 'info');

                // Run in next tick to allow UI update
                setTimeout(() => {
                    try {
                        window.BitboxerSampleEditor.markerController.autoDetectSlices(
                            currentAlgorithm,
                            currentSensitivity
                        );
                        updateSliceCount();
                        window.BitboxerSampleEditor.render();
                        window.BitboxerUtils.setStatus(
                            `Detected ${window.BitboxerSampleEditor.markerController.sliceMarkers.length} slices`,
                            'success'
                        );
                    } catch (error) {
                        console.error('Onset detection error:', error);
                        window.BitboxerUtils.setStatus(`Detection failed: ${error.message}`, 'error');
                    }
                }, 10);
            }, AUTODETECT_DEBOUNCE_MS);
        };

        if (algorithmSelect) {
            algorithmSelect.value = currentAlgorithm;
            algorithmSelect.onchange = () => {
                currentAlgorithm = algorithmSelect.value;
                triggerAutoDetect();
            };
        }

        if (sensitivitySlider && sensitivityValue) {
            sensitivitySlider.value = 50;
            sensitivityValue.textContent = '50%';

            // Update display on input
            sensitivitySlider.oninput = () => {
                currentSensitivity = parseInt(sensitivitySlider.value) / 100;
                sensitivityValue.textContent = sensitivitySlider.value + '%';
            };

            // Trigger auto-detect on release
            sensitivitySlider.onchange = () => {
                triggerAutoDetect();
            };
        }

        if (minDistanceSlider && minDistanceValue) {
            minDistanceSlider.value = 1000;
            const sampleRate = window.BitboxerSampleEditor.audioEngine.audioBuffer?.sampleRate || 44100;
            minDistanceValue.textContent = (1000 / sampleRate * 1000).toFixed(0) + ' ms';

            minDistanceSlider.oninput = () => {
                currentMinDistance = parseInt(minDistanceSlider.value);
                const ms = (currentMinDistance / sampleRate * 1000).toFixed(0);
                minDistanceValue.textContent = ms + ' ms';
            };
        }

        // Clear button
        const clearSlicesBtn = document.getElementById('clearSlicesBtn');
        if (clearSlicesBtn) {
            clearSlicesBtn.onclick = () => {
                if (confirm('Clear all slices?')) {
                    window.BitboxerSampleEditor.markerController.sliceMarkers = [];
                    window.BitboxerSampleEditor.markerController.updateSlicesToPad();
                    window.BitboxerSampleEditor.render();
                    updateSliceCount();
                }
            };
        }
    } 
    else if (cellmode === '3') {
        // GRANULAR MODE
        if (granularControls) granularControls.style.display = 'flex';
        if (editorHints) {
            editorHints.textContent = 'Yellow box = grain window | Drag markers to adjust';
        }
        
    } else if (cellmode === '1') {
        // CLIP MODE
        if (clipControls) clipControls.style.display = 'flex';
        if (editorHints) {
            editorHints.textContent = 'Blue lines = beats | Adjust Beat Count slider';
        }
        
        const { currentEditingPad, presetData } = window.BitboxerData;
        const row = parseInt(currentEditingPad.dataset.row);
        const col = parseInt(currentEditingPad.dataset.col);
        const pad = presetData.pads[row][col];
        
        const updateBeatInfo = () => {
            const beatCount = parseInt(pad.params.beatcount) || 0;
            const tempo = presetData.tempo || '120';
            const beatInfo = document.getElementById('beatInfo');
            
            if (beatInfo) {
                beatInfo.innerHTML = `${beatCount === 0 ? 'Auto' : beatCount + ' beats'} @ <input type="number" id="tempoInput" min="20" max="300" value="${tempo}" style="width: 50px; background: var(--color-bg-secondary); color: var(--color-text-primary); border: 1px solid var(--color-border); border-radius: 3px; padding: 2px;"> BPM`;
                
                const tempoInput = document.getElementById('tempoInput');
                if (tempoInput) {
                    tempoInput.addEventListener('change', (e) => {
                        const newTempo = parseInt(e.target.value);
                        if (newTempo >= 20 && newTempo <= 300) {
                            presetData.tempo = newTempo.toString();
                            window.BitboxerSampleEditor.render();
                        }
                    });
                }
            }
        };
        updateBeatInfo();
        
        let tapTimes = [];
        const tapTempoBtn = document.getElementById('tapTempoBtn');
        if (tapTempoBtn) {
            tapTempoBtn.onclick = () => {
                const now = Date.now();
                tapTimes.push(now);
                
                if (tapTimes.length > 5) tapTimes.shift();
                
                tapTempoBtn.textContent = `🎵 Tap ${tapTimes.length}/5`;
                
                if (tapTimes.length >= 5) {
                    let totalInterval = 0;
                    for (let i = 1; i < tapTimes.length; i++) {
                        totalInterval += tapTimes[i] - tapTimes[i-1];
                    }
                    const avgInterval = totalInterval / 4;
                    const bpm = Math.round(60000 / avgInterval);
                    
                    presetData.tempo = bpm.toString();
                    updateBeatInfo();
                    
                    tapTempoBtn.textContent = `✓ ${bpm} BPM`;
                    setTimeout(() => {
                        tapTimes = [];
                        tapTempoBtn.textContent = '🎵 Tap Tempo';
                    }, 1000);
                }
            };
        }
        
        const detectBeatsBtn = document.getElementById('detectBeatsBtn');
        if (detectBeatsBtn) {
            detectBeatsBtn.onclick = () => {
                const audioBuffer = window.BitboxerSampleEditor.audioEngine.audioBuffer;
                if (!audioBuffer) return;
                
                const durationSec = audioBuffer.length / audioBuffer.sampleRate;
                const tempo = parseFloat(presetData.tempo) || 120;
                const beatsPerSec = tempo / 60;
                const estimatedBeats = Math.round(durationSec * beatsPerSec);
                
                pad.params.beatcount = estimatedBeats.toString();
                
                const beatcountSlider = document.getElementById('beatcount');
                if (beatcountSlider) {
                    beatcountSlider.value = estimatedBeats;
                    window.BitboxerUtils.updateParamDisplay('beatcount', estimatedBeats);
                }
                
                window.BitboxerSampleEditor.render();
                updateBeatInfo();
            };
        }
        
    } else {
        // SAMPLE MODE
        if (editorHints) {
            editorHints.textContent = 'Drag markers to adjust positions. Mouse wheel to zoom.';
        }
    }
    
    // Final render
    window.BitboxerSampleEditor.render();
}

// ============================================
// NEW: Parse WAV Metadata Using Existing Parser
// ============================================

/**
 * Parses WAV metadata for all assets using EXISTING WAVParser
 * FIXED: Only parses if metadata doesn't exist - preserves user edits
 */
async function parseAssetsWAVMetadata(assets) {
    for (const asset of assets) {
        // CRITICAL FIX: Skip if metadata already exists (preserves user edits)
        if (asset.wavMetadata) {
            console.log(`âœ" Skipping parse: ${asset.filename.split(/[/\\]/).pop()} (metadata exists)`);
            continue;
        }
        
        const wavName = asset.filename.split(/[/\\]/).pop();
        
        // *** ADD THIS DEBUG ***
        console.log('SECOND parseAssetsWAVMetadata() at line 1402');
        console.log('=== DEBUG: Looking for WAV ===');
        console.log('wavName:', wavName);
        console.log('window._lastImportedFiles exists?', !!window._lastImportedFiles);
        console.log('Cache size:', window._lastImportedFiles?.size);
        console.log('Cache has this file?', window._lastImportedFiles?.has(wavName));
        console.log('Cache keys:', Array.from(window._lastImportedFiles?.keys() || []));
        // *** END DEBUG ***


        // Find WAV file in cache
        if (window._lastImportedFiles && window._lastImportedFiles.has(wavName)) {
            const wavFile = window._lastImportedFiles.get(wavName);
            
            try {
                const arrayBuffer = await wavFile.arrayBuffer();
                const metadata = window.BitboxerFileHandler.WAVParser.parseMetadata(arrayBuffer);
                
                console.log(`Parsing ${wavName}:`, metadata);
                
                // Calculate sample length
                let samlen = 0;
                if (metadata.duration && metadata.sampleRate) {
                    samlen = Math.floor(metadata.sampleRate * metadata.duration);
                }
                
                // Extract loop points
                let loopStart = 0;
                let loopEnd = samlen;
                let hasLoop = false;
                
                if (metadata.loopPoints) {
                    loopStart = metadata.loopPoints.start || 0;
                    loopEnd = metadata.loopPoints.end || samlen;
                    hasLoop = true;
                    console.log(`  Loop found: ${loopStart} - ${loopEnd}`);
                }
                
                // Store metadata in asset (only on first parse)
                asset.wavMetadata = {
                    sampleRate: metadata.sampleRate || 44100,
                    numChannels: metadata.numChannels || 1,
                    bitsPerSample: metadata.bitsPerSample || 16,
                    duration: metadata.duration || 0,
                    samlen: samlen,
                    loopStart: loopStart,
                    loopEnd: loopEnd,
                    hasLoop: hasLoop,
                    rootKey: parseInt(asset.params.rootnote) || 60
                };
                
                // Update rootnote from WAV if available
                if (metadata.rootNote !== undefined && metadata.rootNote >= 0 && metadata.rootNote <= 127) {
                    asset.params.rootnote = metadata.rootNote.toString();
                    asset.wavMetadata.rootKey = metadata.rootNote;
                    console.log(`  Root note from WAV: ${metadata.rootNote}`);
                }
                
                console.log(`âœ" Parsed: ${wavName} (${samlen} samples, Loop: ${hasLoop})`);
            } catch (error) {
                console.error(`âœ— Failed to parse WAV: ${wavName}`, error);
                // Initialize with defaults only if parsing failed
                asset.wavMetadata = {
                    sampleRate: 44100,
                    numChannels: 1,
                    bitsPerSample: 16,
                    duration: 0,
                    samlen: 0,
                    loopStart: 0,
                    loopEnd: 0,
                    hasLoop: false,
                    rootKey: parseInt(asset.params.rootnote) || 60
                };
            }
        } else {
            console.warn(`âœ— WAV not in cache: ${wavName}`);
            // Initialize with defaults only if not found
            asset.wavMetadata = {
                sampleRate: 44100,
                numChannels: 1,
                bitsPerSample: 16,
                duration: 0,
                samlen: 0,
                loopStart: 0,
                loopEnd: 0,
                hasLoop: false,
                rootKey: parseInt(asset.params.rootnote) || 60
            };
        }
    }
}

// ============================================
// FIXED: loadMultisampleAssetToEditor
// ============================================

/**
 * Loads asset into multisample editor
 * FIXED: Clears previous data, sets correct samlen, green markers
 */
async function loadMultisampleAssetToEditor(asset) {
        console.log('==========================================');
        console.log('=== loadMultisampleAssetToEditor CALLED ===');
        console.log('Asset filename:', asset.filename);
        console.log('Asset rootnote:', asset.params.rootnote);
        console.log('Asset keyrangebottom:', asset.params.keyrangebottom);
        console.log('Asset keyrangetop:', asset.params.keyrangetop);
        console.log('Current state.currentAsset:', window._multiEditorState.currentAsset?.filename);
        console.log('Current state.hasLoadedAudio:', window._multiEditorState.hasLoadedAudio);
        console.log('Current state.audioBuffer exists:', !!window._multiEditorState.audioBuffer);
        console.log('==========================================');

    const editPanel = document.getElementById('multiEditPanel');
    const sampleNameSpan = document.getElementById('multiSampleName');
    
    if (!asset || !editPanel) {
        console.log('❌ EXIT: No asset or editPanel');
        return;
    }
    
    const isDifferentAsset = (window._multiEditorState.currentAsset !== asset);

    // If clicking same asset that's already loaded, do nothing
    if (!isDifferentAsset && window._multiEditorState.hasLoadedAudio) {
        console.log('✅ Same asset already loaded, skipping');
        return;
    }

    // If different asset, always do full reload (load new WAV)
    if (isDifferentAsset) {
        console.log('🔄 Different asset detected, doing full reload');
        window._multiEditorState.setAsset(asset);
        // Continue to full reload below...
    }

    // If same asset but audio lost, also do full reload
    if (!isDifferentAsset && !window._multiEditorState.hasLoadedAudio) {
        console.log('🔄 Same asset but audio lost, reloading');
        // Continue to full reload below...
    }
    
    console.log('🔄 Loading asset (audio buffer missing or stale)');

    // Update state
    window._multiEditorState.setAsset(asset);
    
    // Show edit panel
    editPanel.style.display = 'block';
    
    // Update sample name
    const wavName = asset.filename.split(/[/\\]/).pop();
    sampleNameSpan.textContent = wavName;
    
    // Initialize multi-sample editor if needed
    if (!window._multiSampleEditor) {
        window._multiSampleEditor = new SampleEditor();
        await window._multiSampleEditor.init('multiWaveformCanvas');

        window._multiSampleEditor.scrollZoomBar = new ScrollZoomBar(
            window._multiSampleEditor.renderer,
            () => {
                window._multiSampleEditor.render();
            }
        );
        window._multiSampleEditor.scrollZoomBar.init('multiScrollZoomCanvas');

        // Setup playback controls
        document.getElementById('multiPlayBtn').onclick = () => {
            const loopEnabled = (document.getElementById('multiLoopEnabled').value === '1');
            window._multiSampleEditor.audioEngine.play({
                startSample: 0,
                endSample: window._multiSampleEditor.audioEngine.audioBuffer.length,
                loopStartSample: parseInt(document.getElementById('multiLoopStart').value) || 0,
                loopEndSample: parseInt(document.getElementById('multiLoopEnd').value) || 0,
                loopEnabled: loopEnabled,
                reverse: false
            });
        };
        
        document.getElementById('multiStopBtn').onclick = () => 
            window._multiSampleEditor.stop();
    } else {
        // Clear previous audio data when switching assets
        window._multiSampleEditor.clearAudioData();
    }
    
    // Load WAV file
    if (window._lastImportedFiles && window._lastImportedFiles.has(wavName)) {
        const wavFile = window._lastImportedFiles.get(wavName);
        const audioBuffer = await window._multiSampleEditor.loadSample(wavFile);
        
        if (!audioBuffer) {
            console.error('❌ Failed to load audio buffer');
            return;
        }
        
        // Set mode to sample mode
        window._multiSampleEditor.setMode('0');
        
        // Configure loop markers from WAV metadata
        if (asset.wavMetadata) {
            const { loopStart, loopEnd, hasLoop, samlen } = asset.wavMetadata;

            console.log(`Configuring loop markers: start=${loopStart}, end=${loopEnd}, samlen=${samlen}`);

            // Change marker colors and labels to green
            const markers = window._multiSampleEditor.markerController.markers;
            markers.loopStart.color = '#5eff5e';
            markers.loopStart.label = ' LOOP START';
            markers.loopEnd.color = '#5eff5e';
            markers.loopEnd.label = ' LOOP END';

            // Hide sample start/end markers (not relevant for multisamples)
            markers.start.color = 'transparent';
            markers.start.label = '';
            markers.end.color = 'transparent';
            markers.end.label = '';

            // Set loop points from WAV
            const finalLoopEnd = loopEnd || samlen || audioBuffer.length;
            window._multiSampleEditor.markerController.setMarker('loopStart', loopStart);
            window._multiSampleEditor.markerController.setMarker('loopEnd', finalLoopEnd);

            // Store in unified state
            window._multiEditorState.setAudioData(
                audioBuffer,
                loopStart,
                finalLoopEnd,
                hasLoop
            );
        }
        
        window._multiSampleEditor.render();
    }
    
    // Populate edit panel with current values
    populateMultisampleEditPanel(asset);
}

// ============================================
// FIXED: populateMultisampleEditPanel
// ============================================

/**
 * Populates edit panel with asset data
 * FIXED: Correct samlen from audioBuffer, two-way binding
 */
function populateMultisampleEditPanel(asset) {
    console.log('>>> populateMultisampleEditPanel CALLED');
    console.log('>>> Asset:', asset.filename);
    console.log('>>> Asset.params.rootnote:', asset.params.rootnote);
    console.log('>>> Asset.params.keyrangebottom:', asset.params.keyrangebottom);
    console.log('>>> Asset.params.keyrangetop:', asset.params.keyrangetop);
    
    // Populate note dropdowns (0-127)
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    
    ['multiRootNote', 'multiKeyLo', 'multiKeyHi'].forEach(id => {
        const select = document.getElementById(id);
        if (select && select.options.length === 0) {
            console.log(`Populating dropdown: ${id}`);
            for (let i = 0; i <= 127; i++) {
                const octave = Math.floor((i - 12) / 12);
                const note = noteNames[i % 12];
                const option = document.createElement('option');
                option.value = i;
                option.textContent = `${note}${octave} (${i})`;
                select.appendChild(option);
            }
        }
    });
    
    // Set values WITH LOGGING
    const rootSelect = document.getElementById('multiRootNote');
    const loSelect = document.getElementById('multiKeyLo');
    const hiSelect = document.getElementById('multiKeyHi');

    console.log('Setting dropdown values...');
    if (rootSelect) {
        console.log(`  Setting multiRootNote to: "${asset.params.rootnote}"`);
        rootSelect.value = asset.params.rootnote;
        console.log(`  After set, multiRootNote.value is: "${rootSelect.value}"`);
    }

    if (loSelect) {
        console.log(`  Setting multiKeyLo to: "${asset.params.keyrangebottom}"`);
        loSelect.value = asset.params.keyrangebottom;
        console.log(`  After set, multiKeyLo.value is: "${loSelect.value}"`);
    }

    if (hiSelect) {
        console.log(`  Setting multiKeyHi to: "${asset.params.keyrangetop}"`);
        hiSelect.value = asset.params.keyrangetop;
        console.log(`  After set, multiKeyHi.value is: "${hiSelect.value}"`);
    }

    document.getElementById('multiVelLo').value = asset.params.velrangebottom;
    document.getElementById('multiVelHi').value = asset.params.velrangetop;
    
    console.log('=== populateMultisampleEditPanel END ===');

    // Set loop points and slider max from audioBuffer
    if (window._multiSampleEditor && window._multiSampleEditor.audioEngine && window._multiSampleEditor.audioEngine.audioBuffer) {
        const audioBuffer = window._multiSampleEditor.audioEngine.audioBuffer;
        const maxSamples = audioBuffer.length;

        console.log(`Setting slider max to audioBuffer.length: ${maxSamples}`);

        // Set slider max
        const startSlider = document.getElementById('multiLoopStart');
        const endSlider = document.getElementById('multiLoopEnd');

        if (startSlider) startSlider.max = maxSamples;
        if (endSlider) endSlider.max = maxSamples;

        // Set current values from WAV metadata
        if (asset.wavMetadata) {
            const loopStart = asset.wavMetadata.loopStart || 0;
            const loopEnd = asset.wavMetadata.loopEnd || maxSamples;
            const hasLoop = asset.wavMetadata.hasLoop || false;

            console.log(`Setting loop values: start=${loopStart}, end=${loopEnd}, enabled=${hasLoop}`);

            if (startSlider) {
                startSlider.value = loopStart;
                const startVal = document.getElementById('multiLoopStart-val');
                if (startVal) startVal.textContent = loopStart;
            }

            if (endSlider) {
                endSlider.value = loopEnd;
                const endVal = document.getElementById('multiLoopEnd-val');
                if (endVal) endVal.textContent = loopEnd;
            }

            const enabledSelect = document.getElementById('multiLoopEnabled');
            if (enabledSelect) enabledSelect.value = hasLoop ? '1' : '0';
        }
    } else {
        console.warn('Audio buffer not available, using defaults');
    }
    
    // Setup event listeners for changes
    setupMultisampleEditListeners(asset);
}

// ============================================
// FIXED: setupMultisampleEditListeners
// ============================================

/**
 * Setup event listeners with TWO-WAY binding
 * FIXED: Markers update sliders, sliders update markers
 */
function setupMultisampleEditListeners(asset) {
    // Remove old listeners to prevent duplicates
    const loopStartSlider = document.getElementById('multiLoopStart');
    const loopEndSlider = document.getElementById('multiLoopEnd');
    const loopEnabledSelect = document.getElementById('multiLoopEnabled');
    
    // Clone and replace to remove old listeners
    if (loopStartSlider) {
        const newStart = loopStartSlider.cloneNode(true);
        loopStartSlider.parentNode.replaceChild(newStart, loopStartSlider);
    }
    if (loopEndSlider) {
        const newEnd = loopEndSlider.cloneNode(true);
        loopEndSlider.parentNode.replaceChild(newEnd, loopEndSlider);
    }
    
    // Get fresh references
    const startSlider = document.getElementById('multiLoopStart');
    const endSlider = document.getElementById('multiLoopEnd');
    const enabledSelect = document.getElementById('multiLoopEnabled');
    
    // Key/velocity changes
    ['multiRootNote', 'multiKeyLo', 'multiKeyHi', 'multiVelLo', 'multiVelHi'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.onchange = () => {
                updateAssetFromEditPanel(asset);
            };
        }
    });
    
    // FIXED: Loop point sliders with two-way binding
    if (startSlider) {
        startSlider.oninput = () => {
            const value = parseInt(startSlider.value);
            asset.wavMetadata.loopStart = value;
            document.getElementById('multiLoopStart-val').textContent = value;
            
            // Update marker
            if (window._multiSampleEditor) {
                window._multiSampleEditor.markerController.setMarker('loopStart', value);
                window._multiSampleEditor.render();
            }
        };
    }
    
    if (endSlider) {
        endSlider.oninput = () => {
            const value = parseInt(endSlider.value);
            asset.wavMetadata.loopEnd = value;
            document.getElementById('multiLoopEnd-val').textContent = value;
            
            // Update marker
            if (window._multiSampleEditor) {
                window._multiSampleEditor.markerController.setMarker('loopEnd', value);
                window._multiSampleEditor.render();
            }
        };
    }
    
    // Loop enabled toggle - updates both metadata and playback
    if (enabledSelect) {
        enabledSelect.onchange = () => {
            const enabled = (enabledSelect.value === '1');
            asset.wavMetadata.hasLoop = enabled;
            console.log(`Loop enabled changed to: ${enabled}`);

            // If playing, restart with new loop setting
            if (window._multiSampleEditor && window._multiSampleEditor.audioEngine.isPlaying) {
                window._multiSampleEditor.stop();
                setTimeout(() => {
                    window._multiSampleEditor.audioEngine.play({
                        startSample: 0,
                        endSample: window._multiSampleEditor.audioEngine.audioBuffer.length,
                        loopStartSample: parseInt(document.getElementById('multiLoopStart').value) || 0,
                        loopEndSample: parseInt(document.getElementById('multiLoopEnd').value) || 0,
                        loopEnabled: enabled,
                        reverse: false
                    });
                }, 100);
            }
        };
    }
    
    // NEW: Two-way binding - marker drag updates sliders
    setupMarkerToSliderSync(asset);

    // NEW: Key/velocity range dropdowns → Update keyboard zones
    ['multiRootNote', 'multiKeyLo', 'multiKeyHi', 'multiVelLo', 'multiVelHi'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            // SAVE THE CURRENT VALUE
            const currentValue = element.value;

            // Remove old listener
            const newElement = element.cloneNode(true);

            // RESTORE THE VALUE
            newElement.value = currentValue;

            element.parentNode.replaceChild(newElement, element);

            // Add new listener
            document.getElementById(id).addEventListener('change', () => {
                updateAssetFromEditPanel(asset);

                // Force keyboard re-render with updated asset data
                if (window._multiKeyboardViz) {
                    // Get fresh asset list from BitboxerData
                    const { currentEditingPad, presetData, assetCells } = window.BitboxerData;
                    if (currentEditingPad) {
                        const row = parseInt(currentEditingPad.dataset.row);
                        const col = parseInt(currentEditingPad.dataset.col);

                        // Filter assets for this pad
                        const assets = assetCells.filter(a =>
                            parseInt(a.params.asssrcrow) === row &&
                            parseInt(a.params.asssrccol) === col
                        );

                        // Update visualizer with fresh data
                        window._multiKeyboardViz.assetCells = assets;
                        window._multiKeyboardViz.resize();
                        window._multiKeyboardViz.render();
                    }
                }
            });
        }
    });
}

// ============================================
// NEW: Marker to Slider Sync
// ============================================

/**
 * Syncs marker dragging to slider values (two-way binding)
 */
function setupMarkerToSliderSync(asset) {
    if (!window._multiSampleEditor || !window._multiSampleEditor.markerController) {
        console.warn('Cannot setup marker sync: editor not initialized');
        return;
    }
    
    const markerController = window._multiSampleEditor.markerController;
    
    // Clear any previous override
    if (markerController._originalUpdatePadParams) {
        markerController.updatePadParams = markerController._originalUpdatePadParams;
    }
    
    // Store original function
    if (!markerController._originalUpdatePadParams) {
        markerController._originalUpdatePadParams = markerController.updatePadParams;
    }
    
    // Override to sync to sliders
    markerController.updatePadParams = function() {
        // Get marker positions
        const loopStart = this.markers.loopStart.sample;
        const loopEnd = this.markers.loopEnd.sample;
        
        // Validate
        if (isNaN(loopStart) || isNaN(loopEnd)) {
            console.warn('Invalid marker positions:', loopStart, loopEnd);
            return;
        }
        
        console.log(`Marker moved: loopStart=${loopStart}, loopEnd=${loopEnd}`);
        
        // Update sliders
        const startSlider = document.getElementById('multiLoopStart');
        const endSlider = document.getElementById('multiLoopEnd');
        
        if (startSlider) {
            startSlider.value = loopStart;
            const startVal = document.getElementById('multiLoopStart-val');
            if (startVal) startVal.textContent = loopStart;
            if (asset.wavMetadata) asset.wavMetadata.loopStart = loopStart;
        }
        
        if (endSlider) {
            endSlider.value = loopEnd;
            const endVal = document.getElementById('multiLoopEnd-val');
            if (endVal) endVal.textContent = loopEnd;
            if (asset.wavMetadata) asset.wavMetadata.loopEnd = loopEnd;
        }
    };
}

/**
 * Enhanced updateAssetFromEditPanel to include keyboard refresh
 */
function updateAssetFromEditPanel(asset) {
    asset.params.rootnote = document.getElementById('multiRootNote').value;
    asset.params.keyrangebottom = document.getElementById('multiKeyLo').value;
    asset.params.keyrangetop = document.getElementById('multiKeyHi').value;
    asset.params.velrangebottom = document.getElementById('multiVelLo').value;
    asset.params.velrangetop = document.getElementById('multiVelHi').value;
    
    // Refresh keyboard visualizer
    if (window._multiKeyboardViz) {
        window._multiKeyboardViz.render();
    }
}

/**
 * Forces keyboard refresh after any asset modification
 */
function refreshKeyboardVisualization() {
    if (window._multiKeyboardViz) {
        // Re-render with current asset data
        window._multiKeyboardViz.render();
    }
}

// ============================================
// EXPORT PAD EDITOR
// ============================================
window.BitboxerPadEditor = {
    openEditModal,
    loadParamsToModal,
    updateSliderMaxValues, 
    setupParameterListeners,
    drawEnvelope,
    renderModSlots,
    addModSlot,
    removeModSlot,
    updateModSlotAppearance,
    renderMultisampleList,
    updateModalIcon,
    initSampleEditor,
    loadMultisampleAssetToEditor,
    populateMultisampleEditPanel,
    parseAssetsWAVMetadata,
    setupMarkerToSliderSync,
    refreshKeyboardVisualization
};
