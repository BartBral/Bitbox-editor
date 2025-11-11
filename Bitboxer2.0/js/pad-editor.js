/**
 * BITBOXER - Pad Editor
 * 
 * This file handles pad editing functionality:
 * - Opening/closing pad edit modal
 * - Loading/saving pad parameters
 * - Parameter event listeners
 * - Modulation slot management
 * - Envelope visualization
 * 
 * Part 1: Modal & Parameters
 */

// ============================================
// PAD EDIT MODAL
// ============================================
/**
 * Opens the pad edit modal for a specific pad
 * 
 * @param {HTMLElement} pad - Pad element to edit
 */
function openEditModal(pad) {
    const { presetData } = window.BitboxerData;
    const row = parseInt(pad.dataset.row);
    const col = parseInt(pad.dataset.col);
    const padData = presetData.pads[row][col];

    if (!padData) return;

    // Set current editing pad
    window.BitboxerData.currentEditingPad = pad;

    // Update modal title
    document.getElementById('modalTitle').textContent =
        `Pad ${pad.dataset.padnum} - ${padData.filename || 'Empty'}`;

    // Load parameters to UI
    loadParamsToModal(padData);
    
    // Force cellmode dropdown update for multisamples
    const cellmodeSelect = document.getElementById('cellmode');
    if (cellmodeSelect && padData.params.multisammode === '1') {
        cellmodeSelect.value = '0-multi';
    }

    // Render modulation slots
    renderModSlots(padData);
    
    // Render multisample list
    renderMultisampleList();

    // Show modal
    window.BitboxerUI.openModal('editModal');

    // Reset tabs to default (Main active)
    const editModal = document.getElementById('editModal');
    const tabBtns = editModal.querySelectorAll('.tab-btn');
    const tabContents = editModal.querySelectorAll('.tab-content');

    tabBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));

    tabBtns[0].classList.add('active');
    tabContents[0].classList.add('active');

    // Update visibility based on mode
    drawEnvelope();
    window.BitboxerUI.updateTabVisibility();
    window.BitboxerUI.updateLFOParameterVisibility();
    window.BitboxerUI.updatePosConditionalVisibility();
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
        'cellmode', 'loopmodes', 'loopmode', 'samtrigtype', 'polymode',
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
            });

            // Make display editable
            setupEditableDisplay(display, slider, param);
        }
    });

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
                if (value === '0-multi') {
                    updateParamAndSave('cellmode', '0');
                    updateParamAndSave('multisammode', '1');
                } else {
                    updateParamAndSave('cellmode', value);
                    updateParamAndSave('multisammode', '0');
                }

                // Update visibility based on changes
                if (param === 'cellmode') {
                    window.BitboxerUI.updateTabVisibility();
                    // Refresh mod destinations when cell mode changes
                    const { currentEditingPad, presetData } = window.BitboxerData;
                    if (currentEditingPad) {
                        const row = parseInt(currentEditingPad.dataset.row);
                        const col = parseInt(currentEditingPad.dataset.col);
                        renderModSlots(presetData.pads[row][col]);
                    }
                }
                
                if (param === 'lfobeatsync') {
                    window.BitboxerUI.updateLFOParameterVisibility();
                }
                if (param === 'cellmode' || param === 'loopmodes') {
                    window.BitboxerUI.updateTabVisibility();
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
    ctx.strokeStyle = '#4a9eff';
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

/**
 * Renders multisample layer list
 */
function renderMultisampleList() {
    const container = document.getElementById('multisampleList');
    if (!container) return;

    const { currentEditingPad, presetData, assetCells } = window.BitboxerData;
    if (!currentEditingPad) return;

    const row = parseInt(currentEditingPad.dataset.row);
    const col = parseInt(currentEditingPad.dataset.col);
    const padData = presetData.pads[row][col];

    // Check if this is a multisample pad
    if (padData.params.multisammode !== '1') {
        container.innerHTML = '<p style="color: var(--color-text-secondary);">This pad is not in multisample mode.</p>';
        return;
    }

    // Find assets for this pad
    const assets = assetCells.filter(asset =>
        parseInt(asset.params.asssrcrow) === row &&
        parseInt(asset.params.asssrccol) === col
    );

    if (assets.length === 0) {
        container.innerHTML = '<p style="color: var(--color-text-secondary);">No multisample layers found.</p>';
        return;
    }

    // Build list
    let html = '';
    assets.forEach((asset, idx) => {
        const sampleName = asset.filename.split(/[/\\]/).pop();
        const rootNote = midiToNoteName(parseInt(asset.params.rootnote));
        const keyBottom = midiToNoteName(parseInt(asset.params.keyrangebottom));
        const keyTop = midiToNoteName(parseInt(asset.params.keyrangetop));
        const velBottom = asset.params.velrangebottom;
        const velTop = asset.params.velrangetop;

        html += `
            <div class="multisample-layer" data-asset-index="${asset.row}">
                <div class="multisample-layer-name">${idx + 1}. ${sampleName}</div>
                <div class="multisample-layer-info">
                    Root: <span>${rootNote}</span> | 
                    Keys: <span>${keyBottom} - ${keyTop}</span> | 
                    Vel: <span>${velBottom} - ${velTop}</span>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

/**
 * Convert MIDI number to note name
 */
function midiToNoteName(midi) {
    if (midi < 0 || midi > 127) return '---';
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    const note = notes[midi % 12];
    return `${note}${octave}`;
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

// ============================================
// EXPORT PAD EDITOR
// ============================================
window.BitboxerPadEditor = {
    openEditModal,
    loadParamsToModal,
    setupParameterListeners,
    drawEnvelope,
    renderModSlots,
    addModSlot,
    removeModSlot,
    updateModSlotAppearance,
    renderMultisampleList 
};
