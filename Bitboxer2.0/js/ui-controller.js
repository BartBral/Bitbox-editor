/**
 * BITBOXER - UI Controller
 * 
 * This file manages UI state, modal windows, tabs, and visual updates.
 * It handles:
 * - Modal window management
 * - Tab navigation
 * - Button state updates
 * - Conditional visibility based on modes
 * - Context menu
 */

// ============================================
// MODAL WINDOW MANAGEMENT
// ============================================
/**
 * Opens a modal window by ID
 * 
 * @param {string} modalId - ID of modal element
 */
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
    }
}

/**
 * Closes a modal window by ID
 * 
 * @param {string} modalId - ID of modal element
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
    }
}

/**
 * Closes the pad edit modal and cleans up state
 */
function closeEditModal() {
    closeModal('editModal');
    window.BitboxerData.currentEditingPad = null;
    updatePadDisplay();
}

/**
 * Closes the FX modal
 */
function closeFxModal() {
    closeModal('fxModal');
}

// ============================================
// TAB NAVIGATION
// ============================================
/**
 * Sets up tab navigation for a modal
 * Handles tab button clicks and content switching
 * 
 * @param {HTMLElement} modalElement - Modal containing tabs
 */
function setupModalTabs(modalElement) {
    const tabBtns = modalElement.querySelectorAll('.tab-btn');
    const tabContents = modalElement.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active from all
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Add active to clicked
            btn.classList.add('active');
            const tabId = 'tab-' + btn.dataset.tab;
            const targetTab = modalElement.querySelector('#' + tabId);
            if (targetTab) {
                targetTab.classList.add('active');
            }

            // Special handling for envelope tab
            if (btn.dataset.tab === 'env') {
                drawEnvelope();
            }
        });
    });
}

/**
 * Switches to a specific tab in the edit modal
 * 
 * @param {string} tabName - Name of tab to switch to
 */
function switchToTab(tabName) {
    const editModal = document.getElementById('editModal');
    const tabBtn = editModal.querySelector(`[data-tab="${tabName}"]`);
    if (tabBtn) {
        tabBtn.click();
    }
}

// ============================================
// CONDITIONAL VISIBILITY
// ============================================
/**
 * Updates tab visibility based on cell mode
 * Different cell modes have different available parameters
 */
function updateTabVisibility() {
    const cellmodeSelect = document.getElementById('cellmode');
    if (!cellmodeSelect) return;
    
    const cellmode = cellmodeSelect.value;
    const isMultisample = cellmode === '0-multi';
    const granTab = document.querySelector('[data-tab="gran"]');
    const posTab = document.querySelector('[data-tab="pos"]');
    const lfoTab = document.querySelector('[data-tab="lfo"]');

    const granContent = document.getElementById('tab-gran');
    const posContent = document.getElementById('tab-pos');

    // Reset all tabs to visible/enabled
    [granTab, posTab, lfoTab].forEach(tab => {
        if (tab) {
            tab.style.display = '';
            tab.style.opacity = '1';
        }
    });
    
    [granContent, posContent].forEach(content => {
        if (content) {
            content.style.opacity = '1';
            content.style.pointerEvents = '';
        }
    });

    const { GREY_VALUE } = window.BITBOXER_CONFIG;

    // Handle multisample mode - grey out POS and GRAN
    if (isMultisample) {
        if (posTab) posTab.style.opacity = GREY_VALUE;
        if (posContent) posContent.style.opacity = GREY_VALUE;
        if (granTab) granTab.style.opacity = GREY_VALUE; // ← ADD
        if (granContent) granContent.style.opacity = GREY_VALUE; // ← ADD
        return; // Exit early, don't process other modes
    }

    // Apply greying based on cellmode (existing code continues...)
    switch (cellmode) {
        case '0': // Sample mode - grey out Gran
            if (granTab) granTab.style.opacity = GREY_VALUE;
            if (granContent) granContent.style.opacity = GREY_VALUE;
            break;
            
        case '1': // Clip mode - grey out Gran and Pos
            if (granTab) granTab.style.opacity = GREY_VALUE;
            if (granContent) granContent.style.opacity = GREY_VALUE;
            break;
            
        case '2': // Slice mode - grey out Gran
            if (granTab) granTab.style.opacity = GREY_VALUE;
            if (granContent) granContent.style.opacity = GREY_VALUE;
            break;
            
        case '3': // Granular mode - all available
            break;
    }
}

/**
 * Updates parameter visibility in Pos tab based on cell mode
 */
function updatePosConditionalVisibility() {
    const cellmodeSelect = document.getElementById('cellmode');
    const loopmodesSelect = document.getElementById('loopmodes');
    if (!cellmodeSelect || !loopmodesSelect) return;
    
    const cellmode = cellmodeSelect.value;
    const loopmodes = loopmodesSelect.value;
    const { GREY_VALUE } = window.BITBOXER_CONFIG;

    // Get all parameter elements
    const paramIds = [
        'samstart', 'samlen', 'loopstart', 'loopend', 'loopfadeamt',
        'loopmodes', 'loopmode', 'actslice', 'slicestepmode', 'reverse',
        'quantsize', 'synctype', 'beatcount', 'playthru',
        'slicerquantsize', 'slicersync'
    ];

    const params = {};
    paramIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            params[id] = element.closest('.param');
        }
    });

    // Reset all to visible
    Object.values(params).forEach(param => {
        if (param) param.style.opacity = '1';
    });

    // Apply greying based on cellmode
    switch (cellmode) {
        case '0': // Sample mode - grey out slice and clip specific
            ['actslice', 'slicestepmode', 'loopmode', 'quantsize', 
             'synctype', 'beatcount', 'playthru', 'slicerquantsize', 
             'slicersync'].forEach(id => {
                if (params[id]) params[id].style.opacity = GREY_VALUE;
            });
            break;

        case '1': // Clip mode - grey out sample/loop and slice specific
            ['samstart', 'samlen', 'loopstart', 'loopend', 'loopfadeamt',
             'loopmodes', 'actslice', 'slicestepmode', 'reverse', 'loopmode',
             'playthru', 'slicerquantsize', 'slicersync'].forEach(id => {
                if (params[id]) params[id].style.opacity = GREY_VALUE;
            });
            break;

        case '2': // Slice mode - grey out sample-specific and clip-specific
            ['samstart', 'samlen', 'loopstart', 'loopend', 'loopfadeamt',
             'loopmodes', 'reverse', 'quantsize', 'synctype'].forEach(id => {
                if (params[id]) params[id].style.opacity = GREY_VALUE;
            });
            break;

        case '3': // Granular mode - grey out slice-specific and clip-specific
            ['actslice', 'slicestepmode', 'loopmode', 'quantsize', 'synctype',
             'beatcount', 'playthru', 'slicerquantsize', 'slicersync'].forEach(id => {
                if (params[id]) params[id].style.opacity = GREY_VALUE;
            });
            break;
    }

    // Grey out loop params when Loop Modes = None (for Sample/Granular)
    if ((cellmode === '0' || cellmode === '3') && loopmodes === '0') {
        ['loopstart', 'loopend', 'loopfadeamt'].forEach(id => {
            if (params[id]) params[id].style.opacity = GREY_VALUE;
        });
    }
}

/**
 * Updates LFO parameter visibility based on beat sync setting
 */
function updateLFOParameterVisibility() {
    const lfobeatsyncSelect = document.getElementById('lfobeatsync');
    if (!lfobeatsyncSelect) return;
    
    const lfobeatsync = lfobeatsyncSelect.value;
    const lforateParam = document.getElementById('lforate')?.closest('.param');
    const lforatebeatsyncParam = document.getElementById('lforatebeatsync')?.closest('.param');
    const { GREY_VALUE } = window.BITBOXER_CONFIG;

    if (!lforateParam || !lforatebeatsyncParam) return;

    if (lfobeatsync === '1') {
        // Beat Sync ON - grey out Hz rate, show beat sync
        lforateParam.style.opacity = GREY_VALUE;
        lforatebeatsyncParam.style.opacity = '1';
    } else {
        // Beat Sync OFF - show Hz rate, grey out beat sync
        lforateParam.style.opacity = '1';
        lforatebeatsyncParam.style.opacity = GREY_VALUE;
    }
}

/**
 * Updates Delay FX parameter visibility based on settings
 */
function updateDelayConditionalVisibility() {
    const beatSyncSelect = document.getElementById('fx-dealybeatsync');
    const filterEnableSelect = document.getElementById('fx-filtenable');
    if (!beatSyncSelect || !filterEnableSelect) return;
    
    const beatSync = beatSyncSelect.value;
    const filterEnable = filterEnableSelect.value;
    const { GREY_VALUE } = window.BITBOXER_CONFIG;

    // Delay time parameters
    const delayMsParam = document.getElementById('fx-delay')?.closest('.param');
    const delaySyncParam = document.getElementById('fx-delaymustime')?.closest('.param');

    // Filter parameters
    const cutoffParam = document.getElementById('fx-cutoff')?.closest('.param');
    const filtQualityParam = document.getElementById('fx-filtquality')?.closest('.param');

    // Reset all to visible
    [delayMsParam, delaySyncParam, cutoffParam, filtQualityParam].forEach(param => {
        if (param) param.style.opacity = '1';
    });

    // Apply greying based on Beat Sync
    if (beatSync === '1') {
        // Beat Sync ON - grey out ms time
        if (delayMsParam) delayMsParam.style.opacity = GREY_VALUE;
    } else {
        // Beat Sync OFF - grey out sync time
        if (delaySyncParam) delaySyncParam.style.opacity = GREY_VALUE;
    }

    // Apply greying based on Filter Enable
    if (filterEnable === '0') {
        // Filter OFF - grey out filter params
        if (cutoffParam) cutoffParam.style.opacity = GREY_VALUE;
        if (filtQualityParam) filtQualityParam.style.opacity = GREY_VALUE;
    }
}

/**
 * Updates EQ parameter visibility based on settings and mode
 */
function updateEQConditionalVisibility() {
    const { currentMode } = window.BitboxerData;
    const { GREY_VALUE } = window.BITBOXER_CONFIG;
    const isMicroMode = currentMode === 'micro';
    
    const fxModal = document.getElementById('fxModal');
    const eqTabBtn = fxModal?.querySelector('[data-tab="eq"]');
    const eqHeaders = fxModal?.querySelectorAll('#tab-eq .param-section h3');
    
    // Get all EQ parameters
    const eqParams = [];
    for (let i = 1; i <= 4; i++) {
        const suffix = i === 1 ? '' : i.toString();
        ['eqtype', 'eqenable', 'eqgain', 'eqcutoff', 'eqres'].forEach(param => {
            const element = document.getElementById(`fx-${param}${suffix}`);
            if (element) {
                eqParams.push(element.closest('.param'));
            }
        });
    }
    
    // Reset everything to normal
    if (eqTabBtn) eqTabBtn.classList.remove('greyed');
    if (eqHeaders) {
        eqHeaders.forEach(h => h.style.opacity = '1');
    }
    eqParams.forEach(param => {
        if (param) param.style.opacity = '1';
    });
    
    // If Micro mode, grey out entire EQ tab
    if (isMicroMode) {
        if (eqTabBtn) eqTabBtn.classList.add('greyed');
        if (eqHeaders) {
            eqHeaders.forEach(h => h.style.opacity = GREY_VALUE);
        }
        eqParams.forEach(param => {
            if (param) param.style.opacity = GREY_VALUE;
        });
        return; // Don't process individual bands
    }
    
    // Process each band individually (only if not Micro mode)
    for (let i = 1; i <= 4; i++) {
        const suffix = i === 1 ? '' : i.toString();
        const typeSelect = document.getElementById(`fx-eqtype${suffix}`);
        const enableParam = document.getElementById(`fx-eqenable${suffix}`)?.closest('.param');
        const gainParam = document.getElementById(`fx-eqgain${suffix}`)?.closest('.param');
        const cutoffParam = document.getElementById(`fx-eqcutoff${suffix}`)?.closest('.param');
        const resParam = document.getElementById(`fx-eqres${suffix}`)?.closest('.param');
        
        // Always grey out Enable
        if (enableParam) enableParam.style.opacity = GREY_VALUE;
        
        // If Type is "None", grey out Gain, Frequency, Q
        if (typeSelect?.value === '0') {
            if (gainParam) gainParam.style.opacity = GREY_VALUE;
            if (cutoffParam) cutoffParam.style.opacity = GREY_VALUE;
            if (resParam) resParam.style.opacity = GREY_VALUE;
        }
    }
}

// ============================================
// BUTTON STATE MANAGEMENT
// ============================================
/**
 * Updates pad operation button states based on current selection
 */
function updateButtonStates() {
    const { selectedPads, clipboard } = window.BitboxerData;
    const hasSelection = selectedPads.size > 0;
    
    document.getElementById('exportPadBtn').disabled = !hasSelection;
    document.getElementById('copyPadBtn').disabled = !hasSelection;
    document.getElementById('deletePadBtn').disabled = !hasSelection;
    document.getElementById('pastePadBtn').disabled = !clipboard;

    // Enable "Import to Pad" button only when ONE pad is selected
    const importToPadBtn = document.getElementById('importToPadBtn');
    if (importToPadBtn) {
        importToPadBtn.disabled = selectedPads.size !== 1;
    }
}

// ============================================
// PAD VISUAL UPDATES
// ============================================
/**
 * Updates all pad displays to reflect current preset data
 */
function updatePadDisplay() {
    const { presetData } = window.BitboxerData;
    if (!presetData) return;

    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
            const pad = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (!pad) continue;

            const padData = presetData.pads[row]?.[col];
            const label = pad.querySelector('.pad-label');
            const status = pad.querySelector('.pad-status');

            if (padData && padData.filename && padData.type === 'sample') {
                pad.classList.remove('empty');
                pad.classList.add('active');
                
                // Extract filename without path and extension
                const displayName = padData.filename.split(/[/\\]/).pop().replace('.wav', '');
                label.textContent = displayName;
                
                // Show multisample indicator if applicable
                if (padData.params.multisammode === '1') {
                    status.textContent = '🎹'; // Musical keyboard emoji
                    status.style.display = 'inline';
                } else {
                    status.textContent = '';
                    status.style.display = 'none';
                }
            } else {
                pad.classList.add('empty');
                pad.classList.remove('active');
                label.textContent = 'Empty';
                status.textContent = '';
                status.style.display = 'none';
            }
        }
    }
}

// ============================================
// CONTEXT MENU
// ============================================
/**
 * Shows context menu at mouse position
 * 
 * @param {MouseEvent} e - Mouse event
 * @param {HTMLElement} pad - Pad element
 */
function showContextMenu(e, pad) {
    e.preventDefault();

    const { selectedPads } = window.BitboxerData;

    // Don't deselect if right-clicking on already selected pad
    if (!pad.classList.contains('selected')) {
        clearPadSelection();
        selectPad(pad);
    }

    const menu = document.getElementById('contextMenu');
    menu.style.left = e.pageX + 'px';
    menu.style.top = e.pageY + 'px';
    menu.classList.add('show');

    updateButtonStates();
}

/**
 * Hides the context menu
 */
function hideContextMenu() {
    document.getElementById('contextMenu').classList.remove('show');
}

// ============================================
// PAD SELECTION
// ============================================
/**
 * Selects a pad
 * 
 * @param {HTMLElement} pad - Pad element to select
 */
function selectPad(pad) {
    const { selectedPads } = window.BitboxerData;
    pad.classList.add('selected');
    selectedPads.add(pad.dataset.padnum);
}

/**
 * Clears all pad selections
 */
function clearPadSelection() {
    const { selectedPads } = window.BitboxerData;
    document.querySelectorAll('.pad.selected').forEach(p => p.classList.remove('selected'));
    selectedPads.clear();
}

/**
 * Toggles pad selection
 * 
 * @param {HTMLElement} pad - Pad element to toggle
 */
function togglePadSelection(pad) {
    const { selectedPads } = window.BitboxerData;
    if (pad.classList.contains('selected')) {
        pad.classList.remove('selected');
        selectedPads.delete(pad.dataset.padnum);
    } else {
        selectPad(pad);
    }
}

// ============================================
// EXPORT UI CONTROLLER
// ============================================
window.BitboxerUI = {
    // Modals
    openModal,
    closeModal,
    closeEditModal,
    closeFxModal,
    
    // Tabs
    setupModalTabs,
    switchToTab,
    
    // Visibility
    updateTabVisibility,
    updatePosConditionalVisibility,
    updateLFOParameterVisibility,
    updateDelayConditionalVisibility,
    updateEQConditionalVisibility,
    
    // Buttons
    updateButtonStates,
    
    // Pads
    updatePadDisplay,
    selectPad,
    clearPadSelection,
    togglePadSelection,
    
    // Context Menu
    showContextMenu,
    hideContextMenu
};
