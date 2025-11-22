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
    // Grey out Multi tab when NOT multisample
    const multiTab = document.querySelector('[data-tab="multi"]');
    const multiContent = document.getElementById('tab-multi');
    
    if (multiTab && multiContent) {
        if (isMultisample) {
            multiTab.style.opacity = '1';
            multiContent.style.opacity = '1';
        } else {
            multiTab.style.opacity = GREY_VALUE;
            multiContent.style.opacity = GREY_VALUE;
        }
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
    document.getElementById('exportSFZBtn').disabled = !hasSelection;
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
                
                // Set mode indicator with dynamic SVG
                const isMulti = padData.params.multisammode === '1';
                const mode = isMulti ? '0-multi' : padData.params.cellmode || '0';
                pad.setAttribute('data-mode', mode);

                // Update SVG icon based on mode
                const svgIcon = pad.querySelector('.pad-mode-icon');
                if (svgIcon) {
                    svgIcon.innerHTML = getModeIcon(mode);
                }

                // Extract filename without path and extension
                const displayName = padData.filename.split(/[/\\]/).pop().replace('.wav', '');
                label.textContent = displayName;
                
                // Show multisample indicator if applicable
                if (padData.params.multisammode === '1') {
                    // status.textContent = '🎹'; // Musical keyboard emoji
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
                pad.removeAttribute('data-mode');

                // Reset SVG icon to default empty state
                const svgIcon = pad.querySelector('.pad-mode-icon');
                if (svgIcon) {
                    svgIcon.innerHTML = getModeIcon('empty');
                }
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

/**
 * Returns SVG icon markup for each mode
 */
function getModeIcon(mode) {
    // const icons = {
    //     'empty': '<circle cx="8" cy="8" r="6" fill="#888888a7" />', // Empty - Grey circle
    //     '0': '<circle cx="8" cy="8" r="6" fill="#ffea5e" />', // Sample - Blue circle
    //     '1': '<rect x="2" y="2" width="12" height="12" fill="#ffea5e" />', // Clip - Square
    //     '2': '<polygon points="8,2 14,14 2,14" fill="#ffea5e" />', // Slicer - Triangle
    //     '3': '<path d="M8,2 L14,8 L8,14 L2,8 Z" fill="#ffea5e" />', // Granular - Diamond
    //     '0-multi': '<circle cx="5" cy="8" r="3" fill="#ffea5e" /><circle cx="11" cy="8" r="3" fill="#ffea5e" />' // Multisample - Double circles
    // };

    const icons = {
        'empty': '<rect class="cls-1" width="16" height="16" rx="2.98" ry="2.98" fill="#888888a7" />', // Empty - Grey circle
        '0':     '<rect class="cls-1" width="16" height="16" rx="2.98" ry="2.98" fill="#ffa600"/><polygon class="cls-2" points="12.89 8 12.89 7.56 12.45 7.56 12.45 6.67 12 6.67 12 7.56 11.56 7.56 11.56 8 11.11 8 11.11 8.89 10.67 8.89 10.67 8 10.22 8 10.22 6.67 9.78 6.67 9.78 4.89 9.33 4.89 9.33 6.67 8.89 6.67 8.89 8 8.44 8 8.44 10.67 8 10.67 8 10.22 8 9.78 8 9.33 8 8.89 8 8.44 7.56 8.44 7.56 8 7.56 7.56 7.11 7.56 7.11 4.89 6.67 4.89 6.67 3.11 6.22 3.11 6.22 4.89 5.78 4.89 5.78 8 5.33 8 4.89 8 4.89 7.56 4.44 7.56 4.44 6.67 4 6.67 4 7.56 3.55 7.56 3.55 8 2.66 8 2.66 7.56 2.22 7.56 2.22 8 1.77 8 1.77 8.44 3.11 8.44 3.11 8.89 3.55 8.89 3.55 8.44 4 8.44 4 8 4.44 8 4.44 8.44 4.89 8.44 4.89 9.78 5.33 9.78 5.33 8.89 5.78 8.89 5.78 8.44 6.22 8.44 6.22 5.78 6.67 5.78 6.67 8.44 7.11 8.44 7.11 8.89 7.56 8.89 7.56 11.56 8 11.56 8 12.89 8.44 12.89 8.44 11.56 8.89 11.56 8.89 8.44 9.33 8.44 9.33 7.56 9.78 7.56 9.78 8.44 10.22 8.44 10.22 9.33 10.67 9.33 10.67 9.78 11.11 9.78 11.11 9.33 11.56 9.33 11.56 8.44 12 8.44 12 8 12.45 8 12.45 8.44 12.89 8.44 12.89 8.89 13.34 8.89 13.34 8.44 14.23 8.44 14.23 8 12.89 8"/>',
        '1':     '<rect class="cls-1" width="16" height="16" rx="2.98" ry="2.98" fill="#ffa600"/><path class="cls-2" d="M14.45,12.67V3.33H1.55v9.34h12.9ZM14,7.78h-1.33v-.89h-.44v-.89h-.44v.89h-.44v.89h-1.33v-.89h-.44v-.89h-.44v.89h-.44v.89h-1.33v-.89h-.44v-.89h-.44v.89h-.44v.89h-1.33v-.89h-.44v-.89h-.44v.89h-.44v.89h-1.33v-3.11h12.01v3.11ZM2,8.22h1.33v.89h.44v.89h.44v-.89h.44v-.89h1.33v.89h.44v.89h.44v-.89h.44v-.89h1.33v.89h.44v.89h.44v-.89h.44v-.89h1.33v.89h.44v.89h.44v-.89h.44v-.89h1.33v3.11H2v-3.11Z"/>',
        '2':     '<rect class="cls-1" width="16" height="16" rx="2.98" ry="2.98" fill="#ffa600"/><polygon class="cls-2" points="6.22 2.22 5.78 2.22 5.78 13.78 10.22 13.78 10.22 10.22 6.22 10.22 6.22 2.22"/>',
        '3':     '<g><rect class="cls-1" width="16" height="16" rx="2.98" ry="2.98" fill="#ffa600"/><path class="cls-2" d="M1.55,2.89v10.23h12.9V2.89H1.55ZM14,12.22h-.44v.44H2.89v-.44h-.89V3.33h5.78v.44h.89v-.44h5.34v8.89Z"/><rect class="cls-2" x="2.89" y="11.78" width=".44" height=".44"/><rect class="cls-2" x="3.33" y="11.34" width=".44" height=".44"/><rect class="cls-2" x="3.78" y="10.45" width=".44" height=".44"/><rect class="cls-2" x="4.22" y="9.56" width=".44" height=".44"/><rect class="cls-2" x="4.66" y="8.67" width=".44" height=".44"/><rect class="cls-2" x="5.11" y="7.33" width=".44" height=".44"/><rect class="cls-2" x="5.55" y="6.44" width=".44" height=".44"/><rect class="cls-2" x="6" y="5.55" width=".44" height=".44"/><rect class="cls-2" x="6.44" y="4.66" width=".44" height=".44"/><rect class="cls-2" x="6.89" y="4.22" width=".44" height=".44"/><rect class="cls-2" x="7.33" y="3.78" width=".44" height=".44"/><rect class="cls-2" x="8.67" y="3.78" width=".44" height=".44"/><rect class="cls-2" x="9.11" y="4.22" width=".44" height=".44"/><rect class="cls-2" x="9.56" y="4.66" width=".44" height=".44"/><rect class="cls-2" x="10" y="5.55" width=".44" height=".44"/><rect class="cls-2" x="10.45" y="6.44" width=".44" height=".44"/><rect class="cls-2" x="10.89" y="7.33" width=".44" height=".44"/><rect class="cls-2" x="11.34" y="8.67" width=".44" height=".44"/><rect class="cls-2" x="11.78" y="9.56" width=".44" height=".44"/><rect class="cls-2" x="12.22" y="10.45" width=".44" height=".44"/><rect class="cls-2" x="12.67" y="11.34" width=".44" height=".44"/><rect class="cls-2" x="13.11" y="11.78" width=".44" height=".44"/></g>',             
        '0-multi': '<rect class="cls-1" width="16" height="16" rx="2.98" ry="2.98" fill="#ffa600"/><g><polygon class="cls-2" points="9.56 4 8.67 4 8.67 4.44 8.22 4.44 8.22 4.89 7.78 4.89 7.78 5.33 7.33 5.33 7.33 5.78 6.89 5.78 6.89 6.22 6.44 6.22 6.44 6.67 6 6.67 6 7.11 5.11 7.11 5.11 6.67 4.66 6.67 4.66 6.22 4.22 6.22 4.22 5.78 3.78 5.78 3.78 5.33 3.33 5.33 3.33 4.89 2.89 4.89 2.89 4.44 2.44 4.44 2.44 4 1.55 4 1.55 12 2.89 12 2.89 6.67 3.33 6.67 3.33 7.11 3.78 7.11 3.78 7.56 4.22 7.56 4.22 8 4.66 8 4.66 8.44 5.11 8.44 5.11 8.89 6 8.89 6 8.44 6.44 8.44 6.44 8 6.89 8 6.89 7.56 7.33 7.56 7.33 7.11 7.78 7.11 7.78 6.67 8.22 6.67 8.22 12 9.56 12 9.56 4"/><polygon class="cls-2" points="13.56 7.56 13.56 8 13.11 8 13.11 8.44 12.67 8.44 12.67 8.89 11.78 8.89 11.78 8.44 11.34 8.44 11.34 8 10.89 8 10.89 7.56 10 7.56 10 8.44 10.45 8.44 10.45 8.89 10.89 8.89 10.89 9.33 11.34 9.33 11.34 10.22 10.89 10.22 10.89 10.67 10.45 10.67 10.45 11.11 10 11.11 10 12 10.89 12 10.89 11.56 11.34 11.56 11.34 11.11 11.78 11.11 11.78 10.67 12.67 10.67 12.67 11.11 13.11 11.11 13.11 11.56 13.56 11.56 13.56 12 14.45 12 14.45 11.11 14 11.11 14 10.67 13.56 10.67 13.56 10.22 13.11 10.22 13.11 9.33 13.56 9.33 13.56 8.89 14 8.89 14 8.44 14.45 8.44 14.45 7.56 13.56 7.56"/></g>'
    

    };
    
    return icons[mode] || icons['0'];
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
