/**
 * BITBOXER - FX Editor
 * 
 * This file handles FX editing functionality:
 * - Opening/closing FX modal
 * - Loading/saving FX parameters (Delay, Reverb, EQ)
 * - FX modulation slot management
 */

// ============================================
// FX MODAL MANAGEMENT
// ============================================
/**
 * Opens the FX edit modal
 */
function openFxModal() {
    const { presetData } = window.BitboxerData;
    
    // Safety check: ensure presetData exists
    if (!presetData) {
        window.BitboxerUtils.setStatus('No preset loaded. Create or load a preset first.', 'error');
        return;
    }
    
    // Initialize FX if it doesn't exist
    if (!presetData.fx) {
        presetData.fx = window.BitboxerData.createEmptyFXData();
    }

    loadFxParamsToModal();

    window.BitboxerUI.openModal('fxModal');

    // Reset tabs to default (Delay active)
    const fxModal = document.getElementById('fxModal');
    const tabBtns = fxModal.querySelectorAll('.tab-btn');
    const tabContents = fxModal.querySelectorAll('.tab-content');

    tabBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));

    tabBtns[0].classList.add('active');
    tabContents[0].classList.add('active');

    window.BitboxerUI.setupModalTabs(fxModal);

    // Apply conditional visibility
    window.BitboxerUI.updateDelayConditionalVisibility();
    window.BitboxerUI.updateEQConditionalVisibility();
}

/**
 * Loads FX parameters into modal UI elements
 */
function loadFxParamsToModal() {
    const { presetData } = window.BitboxerData;
    if (!presetData.fx) return;

    // Load Delay params
    const delayParams = presetData.fx.delay?.params || window.BitboxerData.createEmptyFXData().delay.params;
    ['delay', 'delaymustime', 'feedback', 'cutoff', 'filtquality', 'dealybeatsync', 'filtenable', 'delaypingpong'].forEach(param => {
        const element = document.getElementById('fx-' + param);
        if (element && delayParams[param] !== undefined) {
            element.value = delayParams[param];
            if (element.type === 'range') {
                window.BitboxerUtils.updateFxParamDisplay(param, delayParams[param]);
            }
        }
    });

    // Load Reverb params
    const reverbParams = presetData.fx.reverb?.params || window.BitboxerData.createEmptyFXData().reverb.params;
    ['decay', 'predelay', 'damping'].forEach(param => {
        const element = document.getElementById('fx-' + param);
        if (element && reverbParams[param] !== undefined) {
            element.value = reverbParams[param];
            window.BitboxerUtils.updateFxParamDisplay(param, reverbParams[param]);
        }
    });

    // Load EQ params
    const eqParams = presetData.fx.eq?.params || window.BitboxerData.createEmptyFXData().eq.params;
    ['eqgain', 'eqcutoff', 'eqres', 'eqenable', 'eqtype',
     'eqgain2', 'eqcutoff2', 'eqres2', 'eqenable2', 'eqtype2',
     'eqgain3', 'eqcutoff3', 'eqres3', 'eqenable3', 'eqtype3',
     'eqgain4', 'eqcutoff4', 'eqres4', 'eqenable4', 'eqtype4'].forEach(param => {
        const element = document.getElementById('fx-' + param);
        if (element && eqParams[param] !== undefined) {
            element.value = eqParams[param];
            if (element.type === 'range') {
                window.BitboxerUtils.updateFxParamDisplay(param, eqParams[param]);
            }
        }
    });

    // Render FX modulation
    renderFxModSlots('delay');
    renderFxModSlots('reverb');
}

// ============================================
// FX PARAMETER LISTENERS
// ============================================
/**
 * Sets up event listeners for all FX parameters
 */
function setupFxParameterListeners() {
    const { presetData } = window.BitboxerData;
    
    // Delay sliders
    ['delay', 'feedback', 'cutoff', 'filtquality'].forEach(param => {
        const slider = document.getElementById('fx-' + param);
        const display = document.getElementById('fx-' + param + '-val');

        if (slider && display) {
            slider.addEventListener('input', () => {
                window.BitboxerUtils.updateFxParamDisplay(param, slider.value);
                if (presetData.fx && presetData.fx.delay) {
                    presetData.fx.delay.params[param] = slider.value;
                }
            });
        }
    });

    // Delay dropdowns (with conditional visibility updates)
    ['delaymustime'].forEach(param => {
        const select = document.getElementById('fx-' + param);
        if (select) {
            select.addEventListener('change', () => {
                if (presetData.fx && presetData.fx.delay) {
                    presetData.fx.delay.params[param] = select.value;
                }
            });
        }
    });
    
    // Special handling for visibility-affecting dropdowns
    ['dealybeatsync', 'filtenable'].forEach(param => {
        const select = document.getElementById('fx-' + param);
        if (select) {
            select.addEventListener('change', () => {
                if (presetData.fx && presetData.fx.delay) {
                    presetData.fx.delay.params[param] = select.value;
                }
                // Update visibility when these change
                window.BitboxerUI.updateDelayConditionalVisibility();
            });
        }
    });
    
    // Ping pong (no visibility impact)
    const pingpongSelect = document.getElementById('fx-delaypingpong');
    if (pingpongSelect) {
        pingpongSelect.addEventListener('change', () => {
            if (presetData.fx && presetData.fx.delay) {
                presetData.fx.delay.params['delaypingpong'] = pingpongSelect.value;
            }
        });
    }

    // Reverb sliders
    ['decay', 'predelay', 'damping'].forEach(param => {
        const slider = document.getElementById('fx-' + param);
        const display = document.getElementById('fx-' + param + '-val');

        if (slider && display) {
            slider.addEventListener('input', () => {
                window.BitboxerUtils.updateFxParamDisplay(param, slider.value);
                if (presetData.fx && presetData.fx.reverb) {
                    presetData.fx.reverb.params[param] = slider.value;
                }
            });
        }
    });

    // EQ sliders (all 4 bands)
    ['eqgain', 'eqcutoff', 'eqres', 'eqgain2', 'eqcutoff2', 'eqres2',
     'eqgain3', 'eqcutoff3', 'eqres3', 'eqgain4', 'eqcutoff4', 'eqres4'].forEach(param => {
        const slider = document.getElementById('fx-' + param);
        const display = document.getElementById('fx-' + param + '-val');

        if (slider && display) {
            slider.addEventListener('input', () => {
                window.BitboxerUtils.updateFxParamDisplay(param, slider.value);
                if (presetData.fx && presetData.fx.eq) {
                    presetData.fx.eq.params[param] = slider.value;
                }
            });
        }
    });

    // EQ dropdowns (all 4 bands)
    // type changes affect visibility
    ['eqtype', 'eqtype2', 'eqtype3', 'eqtype4'].forEach(param => {
        const select = document.getElementById('fx-' + param);
        if (select) {
            select.addEventListener('change', () => {
                if (presetData.fx && presetData.fx.eq) {
                    presetData.fx.eq.params[param] = select.value;
                }
                // Update visibility when type changes
                window.BitboxerUI.updateEQConditionalVisibility();
            });
        }
    });
    
    // EQ enable dropdowns (no visibility impact)
    ['eqenable', 'eqenable2', 'eqenable3', 'eqenable4'].forEach(param => {
        const select = document.getElementById('fx-' + param);
        if (select) {
            select.addEventListener('change', () => {
                if (presetData.fx && presetData.fx.eq) {
                    presetData.fx.eq.params[param] = select.value;
                }
            });
        }
    });
}

// ============================================
// FX MODULATION RENDERING
// ============================================
/**
 * Creates HTML for an FX modulation slot
 * 
 * @param {Object} modData - Modulation data
 * @param {number} index - Slot index
 * @param {string} fxType - FX type ('delay' or 'reverb')
 * @returns {string} HTML string
 */
function createFxModSlotHTML(modData, index, fxType) {
    const { MOD_SOURCES, FX_MOD_DESTINATIONS } = window.BITBOXER_CONFIG;
    const destinations = FX_MOD_DESTINATIONS[fxType] || [];

    const sourceOptions = MOD_SOURCES.map(src =>
        `<option value="${src.value}" ${modData.src === src.value ? 'selected' : ''}>${src.label}</option>`
    ).join('');

    const destOptions = destinations.map(dest =>
        `<option value="${dest.value}" ${modData.dest === dest.value ? 'selected' : ''}>${dest.label}</option>`
    ).join('');

    const amount = parseInt(modData.amount) || 0;
    const amountText = (amount >= 0 ? '+' : '') + (amount / 10).toFixed(1) + '%';

    const slotLabel = `${index + 1}`;

    const isMidiCC = modData.src === 'midicc';
    const midiChannel = modData.mchan !== undefined ? parseInt(modData.mchan) : 0;
    const midiCCNum = modData.ccnum !== undefined ? parseInt(modData.ccnum) : 0;

    let channelOptions = '';
    for (let i = 0; i < 16; i++) {
        channelOptions += `<option value="${i}" ${midiChannel === i ? 'selected' : ''}>Ch ${i + 1}</option>`;
    }

    let ccOptions = '';
    for (let i = 0; i <= 127; i++) {
        ccOptions += `<option value="${i}" ${midiCCNum === i ? 'selected' : ''}>CC ${i}</option>`;
    }

    return `
        <div class="mod-slot" data-slot="${index}" data-fx-type="${fxType}">

            <div class="mod-slot-number" title="Slot ${index + 1}">${slotLabel}</div>
            <select class="select fx-mod-source" data-slot="${index}" data-fx-type="${fxType}">
                ${sourceOptions}
            </select>

            <div class="mod-amount">
                <input type="range" class="slider fx-mod-amount-slider" data-slot="${index}" data-fx-type="${fxType}"
                       min="-1000" max="1000" value="${amount}">
                <span class="mod-amount-val" data-slot="${index}">${amountText}</span>
            </div>

            <select class="select fx-mod-dest" data-slot="${index}" data-fx-type="${fxType}">
                ${destOptions}
            </select>

            <div></div>
            
            <button class="mod-remove-btn fx-mod-remove" data-slot="${index}" data-fx-type="${fxType}">×</button>
        
        </div>
        



        <div class="mod-midicc-config" data-slot="${index}" style="display: ${isMidiCC ? 'grid' : 'none'};">

            <div></div>
        
            <select class="select fx-mod-midicc-channel" data-slot="${index}" data-fx-type="${fxType}">
                ${channelOptions}
            </select>
        
            <span class="mod-midicc-label">+</span>
        
            <select class="select fx-mod-midicc-ccnum" data-slot="${index}" data-fx-type="${fxType}">
                ${ccOptions}
            </select>
        
            <div></div>
        
            <div></div>
        
        </div>



    `;
}

/**
 * Renders FX modulation slots
 * 
 * @param {string} fxType - FX type ('delay' or 'reverb')
 */
function renderFxModSlots(fxType) {
    const containerId = fxType === 'delay' ? 'fxDelayModContainer' : 'fxReverbModContainer';
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    const { presetData } = window.BitboxerData;
    if (!presetData.fx || !presetData.fx[fxType]) return;

    const modsources = presetData.fx[fxType].modsources || [];

    modsources.forEach((mod, index) => {
        container.innerHTML += createFxModSlotHTML(mod, index, fxType);
    });

    setupFxModSlotListeners();

    // Apply initial appearance
    document.querySelectorAll('.fx-mod-source').forEach(sourceSelect => {
        const slotElement = sourceSelect.closest('.mod-slot');
        if (slotElement) updateFxModSlotAppearance(slotElement);
    });
}

/**
 * Sets up event listeners for FX modulation slots
 */
function setupFxModSlotListeners() {
    const { presetData } = window.BitboxerData;
    
    // Source dropdowns
    document.querySelectorAll('.fx-mod-source').forEach(select => {
        select.addEventListener('change', (e) => {
            const slot = parseInt(e.target.dataset.slot);
            const fxType = e.target.dataset.fxType;
            const newSource = e.target.value;

            if (!presetData.fx || !presetData.fx[fxType]) return;

            if (!presetData.fx[fxType].modsources[slot]) {
                presetData.fx[fxType].modsources[slot] = { dest: 'none', src: 'none', slot: '0', amount: '0' };
            }

            presetData.fx[fxType].modsources[slot].src = newSource;

            const slotElement = e.target.closest('.mod-slot');
            if (slotElement) updateFxModSlotAppearance(slotElement);

            // Show/hide MIDI CC config
            const midiccConfig = slotElement?.nextElementSibling;
            if (midiccConfig && midiccConfig.classList.contains('mod-midicc-config')) {
                if (newSource === 'midicc') {
                    midiccConfig.style.display = 'grid';
                    if (!presetData.fx[fxType].modsources[slot].mchan) {
                        presetData.fx[fxType].modsources[slot].mchan = '0';
                    }
                    if (!presetData.fx[fxType].modsources[slot].ccnum) {
                        presetData.fx[fxType].modsources[slot].ccnum = '0';
                    }
                } else {
                    midiccConfig.style.display = 'none';
                    delete presetData.fx[fxType].modsources[slot].mchan;
                    delete presetData.fx[fxType].modsources[slot].ccnum;
                }
            }
        });
    });

    // MIDI CC Channel
    document.querySelectorAll('.fx-mod-midicc-channel').forEach(select => {
        select.addEventListener('change', (e) => {
            const slot = parseInt(e.target.dataset.slot);
            const fxType = e.target.dataset.fxType;
            if (presetData.fx && presetData.fx[fxType] && presetData.fx[fxType].modsources[slot]) {
                presetData.fx[fxType].modsources[slot].mchan = e.target.value;
            }
        });
    });

    // MIDI CC Number
    document.querySelectorAll('.fx-mod-midicc-ccnum').forEach(select => {
        select.addEventListener('change', (e) => {
            const slot = parseInt(e.target.dataset.slot);
            const fxType = e.target.dataset.fxType;
            if (presetData.fx && presetData.fx[fxType] && presetData.fx[fxType].modsources[slot]) {
                presetData.fx[fxType].modsources[slot].ccnum = e.target.value;
            }
        });
    });

    // Destination dropdowns
    document.querySelectorAll('.fx-mod-dest').forEach(select => {
        select.addEventListener('change', (e) => {
            const slot = parseInt(e.target.dataset.slot);
            const fxType = e.target.dataset.fxType;
            const newDest = e.target.value;

            if (newDest !== 'none') {
                const validation = window.BitboxerUtils.validateFxModDestination(fxType, newDest, slot);

                if (!validation.valid) {
                    window.BitboxerUtils.setStatus(
                        `Maximum 3 modulations per destination! ${newDest} already has 3 slots.`, 
                        'error'
                    );
                    const previousDest = presetData.fx[fxType].modsources[slot]?.dest || 'none';
                    e.target.value = previousDest;
                    return;
                }
            }

            if (presetData.fx && presetData.fx[fxType] && presetData.fx[fxType].modsources[slot]) {
                presetData.fx[fxType].modsources[slot].dest = newDest;
            }

            const slotElement = e.target.closest('.mod-slot');
            if (slotElement) updateFxModSlotAppearance(slotElement);
        });
    });

    // Amount sliders
    document.querySelectorAll('.fx-mod-amount-slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const slot = parseInt(e.target.dataset.slot);
            const fxType = e.target.dataset.fxType;
            const amount = e.target.value;

            if (presetData.fx && presetData.fx[fxType] && presetData.fx[fxType].modsources[slot]) {
                presetData.fx[fxType].modsources[slot].amount = amount;
            }

            const slotElement = e.target.closest('.mod-slot');
            const display = slotElement?.querySelector('.mod-amount-val');
            if (display) {
                const amountText = (amount >= 0 ? '+' : '') + (amount / 10).toFixed(1) + '%';
                display.textContent = amountText;
            }
        });
    });

    // Remove buttons
    document.querySelectorAll('.fx-mod-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const slot = parseInt(e.target.dataset.slot);
            const fxType = e.target.dataset.fxType;

            if (presetData.fx && presetData.fx[fxType] && presetData.fx[fxType].modsources) {
                presetData.fx[fxType].modsources.splice(slot, 1);
                renderFxModSlots(fxType);
            }
        });
    });
}

/**
 * Adds a new FX modulation slot
 * 
 * @param {string} fxType - FX type ('delay' or 'reverb')
 */
function addFxModSlot(fxType) {
    const { presetData } = window.BitboxerData;
    
    if (!presetData.fx || !presetData.fx[fxType]) return;

    if (!presetData.fx[fxType].modsources) presetData.fx[fxType].modsources = [];

    if (presetData.fx[fxType].modsources.length >= 9) {
        window.BitboxerUtils.setStatus(`Maximum 9 modulation slots for ${fxType}`, 'error');
        return;
    }

    const newSlot = {
        dest: 'none',
        src: 'none',
        slot: presetData.fx[fxType].modsources.length.toString(),
        amount: '0'
    };

    presetData.fx[fxType].modsources.push(newSlot);
    renderFxModSlots(fxType);
}

/**
 * Updates visual appearance of FX mod slot
 * 
 * @param {HTMLElement} slotElement - Slot element
 */
function updateFxModSlotAppearance(slotElement) {
    const sourceSelect = slotElement.querySelector('.fx-mod-source');
    const destSelect = slotElement.querySelector('.fx-mod-dest');

    if (!sourceSelect || !destSelect) return;

    const isActive = sourceSelect.value !== 'none' && destSelect.value !== 'none';

    slotElement.style.opacity = isActive ? '1' : '0.5';

    if (isActive) {
        slotElement.classList.remove('inactive');
    } else {
        slotElement.classList.add('inactive');
    }
}

// ============================================
// EXPORT FX EDITOR
// ============================================
window.BitboxerFXEditor = {
    openFxModal,
    loadFxParamsToModal,
    setupFxParameterListeners,
    renderFxModSlots,
    addFxModSlot
};
