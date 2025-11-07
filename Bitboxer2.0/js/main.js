/**
 * BITBOXER - Main Application File
 * 
 * This file initializes the application and sets up all event listeners.
 * It coordinates between all other modules to create the complete application.
 */

// ============================================
// APPLICATION INITIALIZATION
// ============================================
/**
 * Main initialization function
 * Called when DOM is fully loaded
 */
function initializeApp() {
    console.log('BITBOXER: Initializing...');
    
    try {
        // Create empty preset - this MUST happen first
        console.log('Creating empty preset...');
        window.BitboxerData.createEmptyPreset();
        
        // Verify it was created
        if (!window.BitboxerData.presetData) {
            throw new Error('Failed to create preset data');
        }
        console.log('Preset data created:', window.BitboxerData.presetData);
        
        // Create pad grid UI
        createPadGrid();
        
        // Setup all event listeners
        setupEventListeners();
        
        // Initialize project
        window.BitboxerData.initializeProject();
        
        // Setup modal tabs
        setupModalTabs();
        
        // Setup global drag & drop prevention
        setupGlobalDragDrop();
        
        // Set initial status
        window.BitboxerUtils.setStatus('Ready');
        
        console.log('BITBOXER: Ready!');
    } catch (error) {
        console.error('BITBOXER ERROR:', error);
        window.BitboxerUtils.setStatus('Initialization error - check console', 'error');
    }
}

// ============================================
// PAD GRID CREATION
// ============================================
/**
 * Creates the 4x4 pad grid in the UI
 * Pads are created bottom-to-top (row 3 to 0) for visual layout
 */
function createPadGrid() {
    const grid = document.getElementById('padGrid');
    grid.innerHTML = '';

    console.log('Creating pad grid...');

    // Create pads bottom-to-top (row 3 to 0)
    for (let row = 3; row >= 0; row--) {
        for (let col = 0; col < 4; col++) {
            const padNum = (row * 4) + col + 1;
            const pad = document.createElement('div');
            pad.className = 'pad empty';
            pad.dataset.row = row;
            pad.dataset.col = col;
            pad.dataset.padnum = padNum;
            pad.setAttribute('draggable', 'true');

            // Disable pads 9-16 in Micro mode
            if (window.BitboxerData.currentMode === 'micro' && row > 1) {
                pad.classList.add('disabled');
            }

            pad.innerHTML = `
                <span class="pad-number">${padNum}</span>
                <span class="pad-label">Empty</span>
                <span class="pad-status"></span>
            `;

            setupPadEvents(pad);
            grid.appendChild(pad);
        }
    }

    console.log('Pad grid created');
}

/**
 * Sets up all event listeners for a pad element
 * 
 * @param {HTMLElement} pad - Pad element
 */
function setupPadEvents(pad) {
    // Click to select
    pad.addEventListener('click', (e) => handlePadClick(e, pad));
    
    // Double-click to edit
    pad.addEventListener('dblclick', () => window.BitboxerPadEditor.openEditModal(pad));
    
    // Right-click for context menu
    pad.addEventListener('contextmenu', (e) => window.BitboxerUI.showContextMenu(e, pad));
    
    // Drag and drop
    pad.addEventListener('dragstart', (e) => handleDragStart(e, pad));
    pad.addEventListener('dragover', (e) => handleDragOver(e, pad));
    pad.addEventListener('drop', (e) => handleDrop(e, pad));
    pad.addEventListener('dragend', () => handleDragEnd(pad));
    pad.addEventListener('dragleave', () => pad.classList.remove('drag-over'));
}

// ============================================
// PAD INTERACTION HANDLERS
// ============================================
/**
 * Handles pad click events (selection)
 * 
 * @param {MouseEvent} e - Click event
 * @param {HTMLElement} pad - Clicked pad
 */
function handlePadClick(e, pad) {
    if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd+Click: Multi-select
        window.BitboxerUI.togglePadSelection(pad);
    } else {
        // Regular click: Select single pad
        window.BitboxerUI.clearPadSelection();
        window.BitboxerUI.selectPad(pad);
    }
    window.BitboxerUI.updateButtonStates();
}

/**
 * Handles drag start event
 * 
 * @param {DragEvent} e - Drag event
 * @param {HTMLElement} pad - Dragged pad
 */
function handleDragStart(e, pad) {
    console.log('DRAGSTART on pad:', pad.dataset.padnum);
    window.BitboxerData.draggedPad = pad;
    pad.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', pad.dataset.padnum);
}

/**
 * Handles drag over event (hovering over drop target)
 * 
 * @param {DragEvent} e - Drag event
 * @param {HTMLElement} pad - Target pad
 */
function handleDragOver(e, pad) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    
    if (window.BitboxerData.draggedPad && window.BitboxerData.draggedPad !== pad) {
        pad.classList.add('drag-over');
    }
}

/**
 * Handles drop event (completing drag operation)
 * 
 * @param {DragEvent} e - Drop event
 * @param {HTMLElement} pad - Target pad
 */
function handleDrop(e, pad) {
    e.preventDefault();
    e.stopPropagation();
    pad.classList.remove('drag-over');

    // Check if dropping a file or dragging a pad
    if (e.dataTransfer.files.length > 0) {
        // File dropped - load it
        handleFileDropOnPad(e.dataTransfer.files[0], pad);
    } else if (window.BitboxerData.draggedPad && window.BitboxerData.draggedPad !== pad) {
        // Pad dragged - swap pads
        console.log('Swapping pads:', window.BitboxerData.draggedPad.dataset.padnum, 'with', pad.dataset.padnum);
        swapPads(window.BitboxerData.draggedPad, pad);
    }

    if (window.BitboxerData.draggedPad) {
        window.BitboxerData.draggedPad.classList.remove('dragging');
        window.BitboxerData.draggedPad = null;
    }
}

/**
 * Handles drag end event
 * 
 * @param {HTMLElement} pad - Dragged pad
 */
function handleDragEnd(pad) {
    console.log('DRAGEND');
    pad.classList.remove('dragging');
    document.querySelectorAll('.pad.drag-over').forEach(p => p.classList.remove('drag-over'));
}

/**
 * Swaps two pads' data
 * 
 * @param {HTMLElement} pad1 - First pad
 * @param {HTMLElement} pad2 - Second pad
 */
function swapPads(pad1, pad2) {
    const { presetData, assetCells } = window.BitboxerData;
    
    const row1 = parseInt(pad1.dataset.row);
    const col1 = parseInt(pad1.dataset.col);
    const row2 = parseInt(pad2.dataset.row);
    const col2 = parseInt(pad2.dataset.col);

    // Swap the data
    const temp = presetData.pads[row1][col1];
    presetData.pads[row1][col1] = presetData.pads[row2][col2];
    presetData.pads[row2][col2] = temp;

    // Update asset references
    assetCells.forEach(asset => {
        const assetRow = parseInt(asset.params.asssrcrow);
        const assetCol = parseInt(asset.params.asssrccol);

        if (assetRow === row1 && assetCol === col1) {
            asset.params.asssrcrow = String(row2);
            asset.params.asssrccol = String(col2);
        } else if (assetRow === row2 && assetCol === col2) {
            asset.params.asssrcrow = String(row1);
            asset.params.asssrccol = String(col1);
        }
    });

    // Update display
    window.BitboxerUI.updatePadDisplay();

    window.BitboxerUtils.setStatus(
        `Swapped Pad ${pad1.dataset.padnum} with Pad ${pad2.dataset.padnum}`, 
        'success'
    );
}

/**
 * Handles file drop on a pad
 * 
 * @param {File} file - Dropped file
 * @param {HTMLElement} targetPad - Target pad
 */
function handleFileDropOnPad(file, targetPad) {
    if (file.name.endsWith('.xml')) {
        // XML preset file
        if (confirm(`Load preset from ${file.name}? All current pads will be lost!`)) {
            window.BitboxerXML.loadPreset(file);
        }
    } else if (file.name.endsWith('.json')) {
        // JSON pad export
        loadPadFromJSON(file, targetPad);
    } else {
        window.BitboxerUtils.setStatus(`Unsupported file type: ${file.name}`, 'error');
    }
}

/**
 * Loads a pad from a JSON export file
 * 
 * @param {File} file - JSON file
 * @param {HTMLElement} targetPad - Target pad
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
            window.BitboxerUtils.setStatus(`Loaded pad from ${file.name}`, 'success');
        } else {
            window.BitboxerUtils.setStatus('Invalid pad JSON format', 'error');
        }
    } catch (error) {
        window.BitboxerUtils.setStatus(`Error loading pad: ${error.message}`, 'error');
    }
}

// ============================================
// GLOBAL DRAG & DROP PREVENTION
// ============================================
/**
 * Sets up global drag & drop to prevent accidental page navigation
 */
function setupGlobalDragDrop() {
    // Prevent default drag behaviors on the entire page
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Visual feedback for dragging over page
    document.body.addEventListener('dragover', () => {
        document.body.style.backgroundColor = '#252525';
    });

    document.body.addEventListener('dragleave', () => {
        document.body.style.backgroundColor = '#1a1a1a';
    });

    document.body.addEventListener('drop', () => {
        document.body.style.backgroundColor = '#1a1a1a';
    });

    // Handle drops on body (outside pads)
    document.body.addEventListener('drop', (e) => {
        e.preventDefault();

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];

            if (file.name.endsWith('.xml')) {
                if (confirm(`Load preset from ${file.name}? This will replace the current preset.`)) {
                    window.BitboxerXML.loadPreset(file);
                }
            } else {
                window.BitboxerUtils.setStatus(
                    `Unsupported file type: ${file.name}. Please drop .xml preset files.`, 
                    'error'
                );
            }
        }
    });
}

// ============================================
// EVENT LISTENERS SETUP
// ============================================
/**
 * Sets up all global event listeners
 */
function setupEventListeners() {
    // Mode toggle buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            window.BitboxerData.currentMode = btn.dataset.mode;
            createPadGrid();
            window.BitboxerUI.updatePadDisplay();

            // Update EQ visibility if FX modal is open
            if (document.getElementById('fxModal').classList.contains('show')) {
                window.BitboxerUI.updateEQConditionalVisibility();
            }
        });
    });

    // File operations
    document.getElementById('loadBtn').addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });
    
    document.getElementById('fileInput').addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            if (confirm(`Load preset? All current pads will be lost!`)) {
                window.BitboxerXML.loadPreset(e.target.files[0]);
            }
        }
        e.target.value = ''; // Reset file input
    });

    document.getElementById('saveBtn').addEventListener('click', window.BitboxerXML.savePreset);
    
    document.getElementById('newPresetBtn').addEventListener('click', () => {
        if (confirm('Create new preset? All current pads will be lost!')) {
            // Clear selections first
            window.BitboxerUI.clearPadSelection();
            window.BitboxerUI.updateButtonStates();
            
            // Create new preset
            window.BitboxerData.createEmptyPreset();
            window.BitboxerData.initializeProject();
            window.BitboxerUI.updatePadDisplay();
            
            window.BitboxerUtils.setStatus('New preset created', 'success');
        }
    });

    // Pad operations
    document.getElementById('exportPadBtn').addEventListener('click', window.BitboxerXML.exportSelectedPads);
    document.getElementById('copyPadBtn').addEventListener('click', copySelectedPads);
    document.getElementById('pastePadBtn').addEventListener('click', pasteToSelected);
    document.getElementById('deletePadBtn').addEventListener('click', deleteSelectedPads);

    // Edit modal
    document.getElementById('closeModal').addEventListener('click', window.BitboxerUI.closeEditModal);
    document.getElementById('editModal').addEventListener('click', (e) => {
        if (e.target.id === 'editModal') window.BitboxerUI.closeEditModal();
    });

    // FX modal
    document.getElementById('fxBtn').addEventListener('click', window.BitboxerFXEditor.openFxModal);
    document.getElementById('closeFxModal').addEventListener('click', window.BitboxerUI.closeFxModal);
    document.getElementById('fxModal').addEventListener('click', (e) => {
        if (e.target.id === 'fxModal') window.BitboxerUI.closeFxModal();
    });

    // FX modulation add buttons
    document.getElementById('addDelayModSlotBtn').addEventListener('click', () => {
        window.BitboxerFXEditor.addFxModSlot('delay');
    });
    document.getElementById('addReverbModSlotBtn').addEventListener('click', () => {
        window.BitboxerFXEditor.addFxModSlot('reverb');
    });

    // Context menu
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.context-menu')) {
            window.BitboxerUI.hideContextMenu();
        }
    });

    // Setup context menu actions
    document.getElementById('contextEdit').onclick = () => {
        const pad = document.querySelector('.pad.selected');
        if (pad) window.BitboxerPadEditor.openEditModal(pad);
        window.BitboxerUI.hideContextMenu();
    };
    document.getElementById('contextExport').onclick = () => {
        window.BitboxerXML.exportSelectedPads();
        window.BitboxerUI.hideContextMenu();
    };
    document.getElementById('contextCopy').onclick = () => {
        copySelectedPads();
        window.BitboxerUI.hideContextMenu();
    };
    document.getElementById('contextPaste').onclick = () => {
        pasteToSelected();
        window.BitboxerUI.hideContextMenu();
    };
    document.getElementById('contextDelete').onclick = () => {
        deleteSelectedPads();
        window.BitboxerUI.hideContextMenu();
    };

    // Pad editor modulation
    document.getElementById('addModSlotBtn').addEventListener('click', window.BitboxerPadEditor.addModSlot);

    // Setup parameter listeners
    window.BitboxerPadEditor.setupParameterListeners();
    window.BitboxerFXEditor.setupFxParameterListeners();
}

/**
 * Sets up modal tab navigation
 */
function setupModalTabs() {
    const editModal = document.getElementById('editModal');
    window.BitboxerUI.setupModalTabs(editModal);
}

// ============================================
// PAD OPERATIONS
// ============================================
/**
 * Copies selected pads to clipboard
 */
function copySelectedPads() {
    const { selectedPads, presetData } = window.BitboxerData;
    
    if (selectedPads.size === 0) {
        window.BitboxerUtils.setStatus('No pads selected', 'error');
        return;
    }

    window.BitboxerData.clipboard = [];
    selectedPads.forEach(padNum => {
        const pad = document.querySelector(`[data-padnum="${padNum}"]`);
        const row = parseInt(pad.dataset.row);
        const col = parseInt(pad.dataset.col);
        window.BitboxerData.clipboard.push(
            JSON.parse(JSON.stringify(presetData.pads[row][col]))
        );
    });

    window.BitboxerUI.updateButtonStates();
    window.BitboxerUtils.setStatus(`Copied ${window.BitboxerData.clipboard.length} pad(s)`, 'success');
}

/**
 * Pastes clipboard to selected pads
 */
function pasteToSelected() {
    const { clipboard, selectedPads, presetData } = window.BitboxerData;
    
    if (!clipboard || clipboard.length === 0) {
        window.BitboxerUtils.setStatus('Nothing to paste', 'error');
        return;
    }

    if (selectedPads.size === 0) {
        window.BitboxerUtils.setStatus('No destination pad selected', 'error');
        return;
    }

    const targets = Array.from(selectedPads);
    clipboard.forEach((data, i) => {
        if (i >= targets.length) return;
        const pad = document.querySelector(`[data-padnum="${targets[i]}"]`);
        const row = parseInt(pad.dataset.row);
        const col = parseInt(pad.dataset.col);
        presetData.pads[row][col] = JSON.parse(JSON.stringify(data));
    });

    window.BitboxerUI.updatePadDisplay();
    window.BitboxerUtils.setStatus(
        `Pasted ${Math.min(clipboard.length, targets.length)} pad(s)`, 
        'success'
    );
}

/**
 * Deletes selected pads
 */
function deleteSelectedPads() {
    const { selectedPads, presetData } = window.BitboxerData;
    
    if (selectedPads.size === 0) {
        window.BitboxerUtils.setStatus('No pads selected', 'error');
        return;
    }

    const count = selectedPads.size;
    selectedPads.forEach(padNum => {
        const pad = document.querySelector(`[data-padnum="${padNum}"]`);
        const row = parseInt(pad.dataset.row);
        const col = parseInt(pad.dataset.col);
        presetData.pads[row][col] = window.BitboxerData.createEmptyPadData();
    });

    window.BitboxerUI.updatePadDisplay();
    window.BitboxerUI.clearPadSelection();
    window.BitboxerUI.updateButtonStates();
    window.BitboxerUtils.setStatus(`Deleted ${count} pad(s)`, 'success');
}

// ============================================
// DOM READY
// ============================================
/**
 * Initialize app when DOM is ready
 */
document.addEventListener('DOMContentLoaded', initializeApp);
