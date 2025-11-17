/**
 * BITBOXER - Main Application
 * 
 * Initializes app and wires up event listeners
 * Delegates heavy lifting to specialized modules
 */

// ============================================
// APP INITIALIZATION
// ============================================

/**
 * Sets up working folder functionality (modern browsers)
 */
function setupWorkingFolder() {
    if (!window.showDirectoryPicker) return;
    
    const btn = document.getElementById('setWorkingFolderBtn');
    if (btn) {
        btn.style.display = '';
        btn.classList.add('blink-warning');
        
        btn.addEventListener('click', async () => {
            try {
                const dirHandle = await window.showDirectoryPicker({
                    mode: 'read',
                    startIn: 'downloads'
                });
                
                window.BitboxerData.workingFolderHandle = dirHandle;
                btn.textContent = `📁 ${dirHandle.name}`;
                btn.classList.remove('blink-warning');
                btn.classList.add('active');
                
                window.BitboxerUtils.setStatus(`Working folder: ${dirHandle.name}`, 'success');
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Folder error:', error);
                    window.BitboxerUtils.setStatus('Failed to set folder', 'error');
                }
            }
        });
    }
}

/**
 * Main initialization - called on DOMContentLoaded
 */
function initializeApp() {
    console.log('BITBOXER: Initializing...');
    
    try {
        window.BitboxerData.createEmptyPreset();
        
        if (!window.BitboxerData.presetData) {
            throw new Error('Failed to create preset data');
        }
        
        setupWorkingFolder();
        createPadGrid();
        setupEventListeners();
        window.BitboxerData.initializeProject();
        setupModalTabs();
        setupGlobalDragDrop();
        window.BitboxerUtils.setStatus('Ready');
        console.log('BITBOXER: Ready!');
    } catch (error) {
        console.error('BITBOXER ERROR:', error);
        window.BitboxerUtils.setStatus('Init error - check console', 'error');
    }
}

// ============================================
// PAD GRID CREATION
// ============================================

/**
 * Creates 4x4 pad grid (bottom-to-top for visual layout)
 */
function createPadGrid() {
    const grid = document.getElementById('padGrid');
    grid.innerHTML = '';
    
    for (let row = 3; row >= 0; row--) {
        for (let col = 0; col < 4; col++) {
            const padNum = (row * 4) + col + 1;
            const pad = document.createElement('div');
            pad.className = 'pad empty';
            pad.dataset.row = row;
            pad.dataset.col = col;
            pad.dataset.padnum = padNum;
            pad.setAttribute('draggable', 'true');
            
            if (window.BitboxerData.currentMode === 'micro' && row > 1) {
                pad.classList.add('disabled');
            }
            
            pad.innerHTML = `
                <svg class="pad-mode-icon" width="16" height="16" viewBox="0 0 16 16">
                    <circle cx="8" cy="8" r="6" fill="#888" />
                </svg>
                <span class="pad-number">${padNum}</span>
                <span class="pad-label">Empty</span>
                <span class="pad-status"></span>
            `;
            
            setupPadEvents(pad);
            grid.appendChild(pad);
        }
    }
}

/**
 * Sets up all event listeners for a pad
 * 
 * @param {HTMLElement} pad - Pad element
 */
function setupPadEvents(pad) {
    pad.addEventListener('click', (e) => handlePadClick(e, pad));
    pad.addEventListener('dblclick', () => window.BitboxerPadEditor.openEditModal(pad));
    pad.addEventListener('contextmenu', (e) => window.BitboxerUI.showContextMenu(e, pad));
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
 * Handles pad click (selection)
 * 
 * @param {MouseEvent} e - Click event
 * @param {HTMLElement} pad - Clicked pad
 */
function handlePadClick(e, pad) {
    if (e.ctrlKey || e.metaKey) {
        window.BitboxerUI.togglePadSelection(pad);
    } else {
        window.BitboxerUI.clearPadSelection();
        window.BitboxerUI.selectPad(pad);
    }
    window.BitboxerUI.updateButtonStates();
}

/**
 * Handles drag start
 * 
 * @param {DragEvent} e - Drag event
 * @param {HTMLElement} pad - Dragged pad
 */
function handleDragStart(e, pad) {
    window.BitboxerData.draggedPad = pad;
    pad.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', pad.dataset.padnum);
}

/**
 * Handles drag over
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
 * Handles drop (file or pad)
 * 
 * @param {DragEvent} e - Drop event
 * @param {HTMLElement} pad - Target pad
 */
function handleDrop(e, pad) {
    e.preventDefault();
    e.stopPropagation();
    pad.classList.remove('drag-over');
    
    if (e.dataTransfer.files.length > 0) {
        if (e.dataTransfer.files.length > 1) {
            if (confirm(`Import ${e.dataTransfer.files.length} files? All pads will be lost!`)) {
                window.BitboxerUtils.setStatus('Importing...', 'info');
                window.BitboxerFileHandler.FileImporter.import(e.dataTransfer.files)
                    .then(result => window.BitboxerImport.processImportedFiles(result))
                    .catch(error => {
                        console.error('Import error:', error);
                        window.BitboxerUtils.setStatus(`Import failed: ${error.message}`, 'error');
                    });
            }
        } else {
            handleFileDropOnPad(e.dataTransfer.files[0], pad);
        }
    } else if (window.BitboxerData.draggedPad && window.BitboxerData.draggedPad !== pad) {
        window.BitboxerPadOps.swapPads(window.BitboxerData.draggedPad, pad);
    }
    
    if (window.BitboxerData.draggedPad) {
        window.BitboxerData.draggedPad.classList.remove('dragging');
        window.BitboxerData.draggedPad = null;
    }
}

/**
 * Handles drag end
 * 
 * @param {HTMLElement} pad - Dragged pad
 */
function handleDragEnd(pad) {
    pad.classList.remove('dragging');
    document.querySelectorAll('.pad.drag-over').forEach(p => p.classList.remove('drag-over'));
}

/**
 * Handles file drop on pad
 * 
 * @param {File} file - Dropped file
 * @param {HTMLElement} targetPad - Target pad
 */
async function handleFileDropOnPad(file, targetPad) {
    await window.BitboxerImport.unifiedImportHandler(file, 'drag-pad', targetPad);
}

// ============================================
// GLOBAL DRAG & DROP PREVENTION
// ============================================

/**
 * Prevents accidental page navigation from drag & drop
 */
function setupGlobalDragDrop() {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    document.body.addEventListener('dragover', () => {
        document.body.style.backgroundColor = '#252525';
    });
    
    document.body.addEventListener('dragleave', () => {
        document.body.style.backgroundColor = '#1a1a1a';
    });
    
    document.body.addEventListener('drop', (e) => {
        e.preventDefault();
        document.body.style.backgroundColor = '#1a1a1a';
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.name.endsWith('.xml')) {
                if (confirm(`Load ${file.name}? This will replace current preset.`)) {
                    window.BitboxerXML.loadPreset(file);
                }
            } else {
                window.BitboxerUtils.setStatus(
                    `Unsupported: ${file.name}. Drop XML presets here.`,
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
    // Mode toggle
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            window.BitboxerData.currentMode = btn.dataset.mode;
            createPadGrid();
            window.BitboxerUI.updatePadDisplay();
            
            if (document.getElementById('fxModal').classList.contains('show')) {
                window.BitboxerUI.updateEQConditionalVisibility();
            }
        });
    });
    
    // File operations
    document.getElementById('loadBtn').addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });
    
    document.getElementById('fileInput').addEventListener('change', async (e) => {
        if (e.target.files.length === 0) return;
        
        const files = e.target.files.length === 1 ? e.target.files[0] : Array.from(e.target.files);
        await window.BitboxerImport.unifiedImportHandler(files, 'button');
        e.target.value = '';
    });
    
    // Project rename
    document.getElementById('projectTitle').addEventListener('click', () => {
        window.BitboxerData.renameProject();
    });
    
    // Folder upload
    const loadFolderBtn = document.getElementById('loadFolderBtn');
    if (window.showDirectoryPicker) {
        loadFolderBtn.style.display = '';
        loadFolderBtn.addEventListener('click', async () => {
            if (!confirm('Import folder? All pads will be lost!')) return;
            
            try {
                window.BitboxerUtils.setStatus('Select folder...', 'info');
                const result = await window.BitboxerFileHandler.FileImporter.importFolder();
                await window.BitboxerImport.processImportedFiles(result);
            } catch (error) {
                if (error.name === 'AbortError') {
                    window.BitboxerUtils.setStatus('Cancelled', 'info');
                } else {
                    console.error('Folder error:', error);
                    window.BitboxerUtils.setStatus(`Failed: ${error.message}`, 'error');
                }
            }
        });
    }
    
    // Import to pad
    document.getElementById('importToPadBtn').addEventListener('click', () => {
        document.getElementById('padImportInput').click();
    });
    
    document.getElementById('padImportInput').addEventListener('change', async (e) => {
        if (e.target.files.length === 0) return;
        
        const selectedPad = document.querySelector('.pad.selected');
        if (!selectedPad) {
            window.BitboxerUtils.setStatus('No pad selected', 'error');
            e.target.value = '';
            return;
        }
        
        const files = e.target.files.length === 1 ? e.target.files[0] : Array.from(e.target.files);
        await window.BitboxerImport.unifiedImportHandler(files, 'button', selectedPad);
        e.target.value = '';
    });
    
    document.getElementById('saveBtn').addEventListener('click', window.BitboxerXML.savePreset);
    
    document.getElementById('newPresetBtn').addEventListener('click', () => {
        if (confirm('Create new preset? All pads will be lost!')) {
            window.BitboxerUI.clearPadSelection();
            window.BitboxerUI.updateButtonStates();
            window.BitboxerData.createEmptyPreset();
            window.BitboxerData.initializeProject();
            window.BitboxerUI.updatePadDisplay();
            window.BitboxerUtils.setStatus('New preset created', 'success');
        }
    });
    
    // Pad operations
    document.getElementById('exportPadBtn').addEventListener('click', window.BitboxerXML.exportSelectedPads);
    document.getElementById('exportSFZBtn').addEventListener('click', window.BitboxerSFZExport.exportSelectedAsSFZ);
    document.getElementById('copyPadBtn').addEventListener('click', window.BitboxerPadOps.copySelectedPads);
    document.getElementById('pastePadBtn').addEventListener('click', window.BitboxerPadOps.pasteToSelected);
    document.getElementById('deletePadBtn').addEventListener('click', window.BitboxerPadOps.deleteSelectedPads);
    
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
    
    // FX mod add buttons
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
    
    document.getElementById('contextEdit').onclick = () => {
        const pad = document.querySelector('.pad.selected');
        if (pad) window.BitboxerPadEditor.openEditModal(pad);
        window.BitboxerUI.hideContextMenu();
    };
    
    document.getElementById('contextRename').onclick = () => {
        const pad = document.querySelector('.pad.selected');
        if (pad) window.BitboxerPadOps.renamePad(pad);
        window.BitboxerUI.hideContextMenu();
    };
    
    document.getElementById('contextExport').onclick = () => {
        window.BitboxerXML.exportSelectedPads();
        window.BitboxerUI.hideContextMenu();
    };
    
    document.getElementById('contextCopy').onclick = () => {
        window.BitboxerPadOps.copySelectedPads();
        window.BitboxerUI.hideContextMenu();
    };
    
    document.getElementById('contextPaste').onclick = () => {
        window.BitboxerPadOps.pasteToSelected();
        window.BitboxerUI.hideContextMenu();
    };
    
    document.getElementById('contextDelete').onclick = () => {
        window.BitboxerPadOps.deleteSelectedPads();
        window.BitboxerUI.hideContextMenu();
    };
    
    document.getElementById('contextImport').onclick = () => {
        document.getElementById('padImportInput').click();
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
// DOM READY
// ============================================
document.addEventListener('DOMContentLoaded', initializeApp);