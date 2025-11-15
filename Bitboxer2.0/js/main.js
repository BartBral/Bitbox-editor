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
 * Setup working folder functionality
 */
function setupWorkingFolder() {
    if (!window.showDirectoryPicker) {
        console.log('File System Access API not supported');
        return;
    }

    // Show the "Set Working Folder" button with blinking warning
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

                window.BitboxerUtils.setStatus(
                    `Working folder set: ${dirHandle.name}`,
                    'success'
                );

                console.log('Working folder set:', dirHandle.name);

            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Error setting working folder:', error);
                    window.BitboxerUtils.setStatus(
                        'Failed to set working folder',
                        'error'
                    );
                }
            }
        });
    }
}

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

        // NEW: Setup working folder if browser supports it
        setupWorkingFolder();

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
        // Check if multiple files
        if (e.dataTransfer.files.length > 1) {
            // Multiple files - import them all
            if (confirm(`Import ${e.dataTransfer.files.length} files? All current pads will be lost!`)) {
                window.BitboxerUtils.setStatus('Importing files...', 'info');
                window.BitboxerFileHandler.FileImporter.import(e.dataTransfer.files)
                    .then(result => processImportedFiles(result))
                    .catch(error => {
                        console.error('Import error:', error);
                        window.BitboxerUtils.setStatus(`Import failed: ${error.message}`, 'error');
                    });
            }
        } else {
            // Single file - load to this specific pad
            handleFileDropOnPad(e.dataTransfer.files[0], pad);
        }
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
async function handleFileDropOnPad(file, targetPad) {
    // Route everything through unified handler
    await unifiedImportHandler(file, 'drag-pad', targetPad);
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

/**
 * Loads a pad from a self-contained ZIP export
 * 
 * @param {File} zipFile - ZIP file
 * @param {HTMLElement} targetPad - Target pad
 */
async function loadPadFromZIP(zipFile, targetPad) {
    try {
        window.BitboxerUtils.setStatus('Loading pad ZIP...', 'info');
        const result = await window.BitboxerFileHandler.FileImporter.import(zipFile);

        // Find the JSON file
        const jsonFiles = Array.from(result.collection.files.entries())
            .filter(([path, file]) => path.endsWith('.json'));

        if (jsonFiles.length === 0) {
            window.BitboxerUtils.setStatus('No pad JSON found in ZIP', 'error');
            return;
        }

        // Read the JSON
        const [jsonPath, jsonFile] = jsonFiles[0];
        const text = await jsonFile.text();
        const padData = JSON.parse(text);

        const row = parseInt(targetPad.dataset.row);
        const col = parseInt(targetPad.dataset.col);

        if (padData.data) {
            // Cache the WAV files from ZIP
            window._lastImportedFiles = result.collection.files;
            console.log('Cached WAV files from pad ZIP:', window._lastImportedFiles.size);

            // Load the pad data
            window.BitboxerData.presetData.pads[row][col] = JSON.parse(JSON.stringify(padData.data));

            // If multisample, update asset cells
            if (padData.assetReferences) {
                // Remove old assets for this pad
                window.BitboxerData.assetCells = window.BitboxerData.assetCells.filter(asset =>
                    !(parseInt(asset.params.asssrcrow) === row &&
                        parseInt(asset.params.asssrccol) === col)
                );

                // Add new assets
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
            window.BitboxerUtils.setStatus(
                `Loaded pad from ${zipFile.name} to Pad ${targetPad.dataset.padnum}`,
                'success'
            );
        } else {
            window.BitboxerUtils.setStatus('Invalid pad ZIP format', 'error');
        }
    } catch (error) {
        console.error('Pad ZIP load error:', error);
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
        console.log('=== LOAD BUTTON CLICKED ===');
        document.getElementById('fileInput').click();
    });

    document.getElementById('fileInput').addEventListener('change', async (e) => {
        if (e.target.files.length === 0) return;
        
        const files = e.target.files.length === 1 ? e.target.files[0] : Array.from(e.target.files);
        
        await unifiedImportHandler(files, 'button');
        
        e.target.value = '';
    });

    // Project rename
    document.getElementById('projectTitle').addEventListener('click', () => {
        window.BitboxerData.renameProject();
    });

    // NEW: Folder upload button (if browser supports it)
    const loadFolderBtn = document.getElementById('loadFolderBtn');
    if (window.showDirectoryPicker) {
        // Browser supports folder selection - show the button
        loadFolderBtn.style.display = '';

        loadFolderBtn.addEventListener('click', async () => {
            if (!confirm('Import folder? All current pads will be lost!')) return;

            try {
                window.BitboxerUtils.setStatus('Select folder...', 'info');
                const result = await window.BitboxerFileHandler.FileImporter.importFolder();
                await processImportedFiles(result);
            } catch (error) {
                if (error.name === 'AbortError') {
                    window.BitboxerUtils.setStatus('Folder selection cancelled', 'info');
                } else {
                    console.error('Folder import error:', error);
                    window.BitboxerUtils.setStatus(`Folder import failed: ${error.message}`, 'error');
                }
            }
        });
    }

    // Import to Pad button
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

        // Route through unified handler
        const files = e.target.files.length === 1 ? e.target.files[0] : Array.from(e.target.files);
        await unifiedImportHandler(files, 'button', selectedPad);
        
        e.target.value = '';
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
    document.getElementById('contextRename').onclick = () => {
        const pad = document.querySelector('.pad.selected');
        if (pad) renamePad(pad);
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

        // ← IMPORTANT: Create truly empty pad
        presetData.pads[row][col] = window.BitboxerData.createEmptyPadData();
        presetData.pads[row][col].type = 'samtempl'; // ← Ensure type is samtempl
        presetData.pads[row][col].filename = ''; // ← Ensure filename is empty

        // Also remove any asset cells for this pad
        window.BitboxerData.assetCells = window.BitboxerData.assetCells.filter(asset =>
            !(parseInt(asset.params.asssrcrow) === row &&
                parseInt(asset.params.asssrccol) === col)
        );
    });

    window.BitboxerUI.updatePadDisplay();
    window.BitboxerUI.clearPadSelection();
    window.BitboxerUI.updateButtonStates();
    window.BitboxerUtils.setStatus(`Deleted ${count} pad(s)`, 'success');
}

/**
 * Renames a pad's sample
 */
function renamePad(pad) {
    const { presetData, assetCells } = window.BitboxerData;
    const row = parseInt(pad.dataset.row);
    const col = parseInt(pad.dataset.col);
    const padData = presetData.pads[row][col];
    
    if (!padData.filename) {
        window.BitboxerUtils.setStatus('Cannot rename empty pad', 'error');
        return;
    }
    
    const isMultisample = padData.params.multisammode === '1';
    
    if (isMultisample) {
        // Multisample: extract folder name
        const oldFolder = padData.filename.replace(/^\.[\\/]/, '');
        const newFolder = prompt('Enter new multisample name:', oldFolder);
        
        if (newFolder && newFolder.trim() && newFolder !== oldFolder) {
            const trimmedFolder = newFolder.trim();
            
            // Update pad filename
            padData.filename = `.\\${trimmedFolder}`;
            
            // Update all asset cell paths for this pad
            assetCells.forEach(asset => {
                const assetRow = parseInt(asset.params.asssrcrow);
                const assetCol = parseInt(asset.params.asssrccol);
                
                if (assetRow === row && assetCol === col) {
                    // Extract sample filename from old path
                    const sampleName = asset.filename.split(/[\\/]/).pop();
                    // Build new path
                    asset.filename = `.\\${trimmedFolder}\\${sampleName}`;
                    console.log(`✓ Updated asset: ${asset.filename}`);
                }
            });
            
            window.BitboxerUI.updatePadDisplay();
            window.BitboxerUtils.setStatus(`Multisample renamed to: ${trimmedFolder}`, 'success');
        }
    } else {
        // Regular sample: just rename file
        const oldFullName = padData.filename.split(/[/\\]/).pop();
        const currentName = oldFullName.replace(/\.(wav|WAV)$/, '');
        const newName = prompt('Enter new sample name:', currentName);
        
        if (newName && newName.trim() && newName !== currentName) {
            const extension = padData.filename.match(/\.(wav|WAV)$/)?.[0] || '.wav';
            const newFullName = newName.trim() + extension;
            
            // Update cache with new key
            if (window._lastImportedFiles && window._lastImportedFiles.has(oldFullName)) {
                const file = window._lastImportedFiles.get(oldFullName);
                window._lastImportedFiles.delete(oldFullName);
                window._lastImportedFiles.set(newFullName, file);
                console.log(`✓ Renamed cache: ${oldFullName} → ${newFullName}`);
            }
            
            padData.filename = newFullName;
            window.BitboxerUI.updatePadDisplay();
            window.BitboxerUtils.setStatus(`Renamed to: ${newName.trim()}`, 'success');
        }
    }
}

/**
 * Unified preset import handler - ensures consistency
 * @param {File|Array} files - File(s) to import
 * @param {string} source - 'button', 'drag-grid', 'drag-pad', 'folder'
 * @param {HTMLElement} targetPad - Target pad (only for drag-pad/button with selection)
 */
async function unifiedImportHandler(files, source, targetPad = null) {
    console.log('=== UNIFIED HANDLER CALLED ===');
    console.log('Files:', files);
    console.log('Source:', source);
    console.log('TargetPad:', targetPad);
    
    // Convert single file to array
    const fileArray = Array.isArray(files) ? files : [files];

    // Determine what we're importing
    const hasXML = fileArray.some(f => f.name.endsWith('.xml'));
    const hasZIP = fileArray.some(f => f.name.endsWith('.zip'));
    const hasSFZ = fileArray.some(f => f.name.endsWith('.sfz'));
    const hasWAV = fileArray.some(f => f.name.endsWith('.wav'));
    const hasJSON = fileArray.some(f => f.name.endsWith('.json'));

    // Single file cases
    if (fileArray.length === 1) {
        const file = fileArray[0];

        // JSON pad export (legacy)
        if (hasJSON) {
            if (!targetPad) {
                window.BitboxerUtils.setStatus('JSON pad export must target a specific pad', 'error');
                return;
            }
            await loadPadFromJSON(file, targetPad);
            return;
        }

        // XML file
        if (hasXML) {
            // Always offer merge/replace for presets (button or drag)
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

        // ZIP file - need to examine contents
        if (hasZIP) {
            try {
                window.BitboxerUtils.setStatus('Processing ZIP...', 'info');
                const result = await window.BitboxerFileHandler.FileImporter.import(file);
                window._lastImportedFiles = result.collection.files;

                // Check what's inside
                const hasPresetXML = result.xmlFiles.length > 0;
                const hasPadJSON = Array.from(result.collection.files.keys())
                    .some(path => /pad_\d{2}\.json/.test(path));
                const hasSFZInside = result.sfzFiles.length > 0;

                if (hasPadJSON) {
                    // Single pad ZIP
                    if (!targetPad) {
                        window.BitboxerUtils.setStatus('Pad ZIP must be dropped on a specific pad', 'error');
                        return;
                    }
                    await loadPadFromZIP(file, targetPad);
                    return;
                }

                if (hasPresetXML) {
                    // Full preset ZIP - always offer merge/replace
                    const choice = await promptLoadOrMerge();
                    if (choice === 'cancel') return;

                    if (choice === 'replace') {
                        window.BitboxerData.createEmptyPreset();
                        await window.BitboxerXML.loadPreset(result.xmlFiles[0].file);
                        await autoLoadReferencedSamples();
                    } else {
                        // Preset to button/grid = offer merge/replace
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
                    }
                    return;
                }


                if (hasSFZInside) {
                    // SFZ ZIP
                    if (!targetPad) {
                        window.BitboxerUtils.setStatus('SFZ must be imported to a specific pad', 'error');
                        return;
                    }
                    const importResult = await handleMissingSamples(result.sfzFiles[0], result.wavFiles);
                    if (!importResult.cancelled) {
                        await convertSFZToPad(result.sfzFiles[0], importResult.wavFiles, targetPad);
                    }
                    return;
                }

                window.BitboxerUtils.setStatus('ZIP does not contain a valid preset or pad', 'error');
            } catch (error) {
                console.error('ZIP import error:', error);
                window.BitboxerUtils.setStatus(`ZIP import failed: ${error.message}`, 'error');
            }
            return;
        }

        // SFZ file
        if (hasSFZ) {
            if (!targetPad) {
                window.BitboxerUtils.setStatus('SFZ must be imported to a specific pad', 'error');
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
                window.BitboxerUtils.setStatus('WAV must be dropped on a specific pad', 'error');
                return;
            }

            try {
                window.BitboxerUtils.setStatus('Processing WAV...', 'info');

                // Cache the original File object FIRST
                if (!window._lastImportedFiles) window._lastImportedFiles = new Map();
                window._lastImportedFiles.set(file.name, file);
                console.log('✓ Cached WAV:', file.name);

                // Now process it
                const result = await window.BitboxerFileHandler.FileImporter.import(file);
                const wavData = result.wavFiles[0];

                const row = parseInt(targetPad.dataset.row);
                const col = parseInt(targetPad.dataset.col);
                const pad = window.BitboxerData.presetData.pads[row][col];

                pad.filename = wavData.name;
                pad.type = 'sample';

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
                window.BitboxerUtils.setStatus(`Loaded ${wavData.name} to Pad ${targetPad.dataset.padnum}`, 'success');
            } catch (error) {
                console.error('WAV import error:', error);
                window.BitboxerUtils.setStatus(`WAV failed: ${error.message}`, 'error');
            }
            return;
        }
    }

    // Multiple files = always replace (preset import)
    if (fileArray.length > 1) {
        if (!confirm(`Import ${fileArray.length} files? All current pads will be lost!`)) return;

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
// FILE IMPORT HELPERS
// ============================================
/**
 * Analyze SFZ sample paths to determine folder structure
 */
function analyzeSamplePaths(samplePaths) {
    const hasSubfolders = samplePaths.some(path =>
        path.includes('/') || path.includes('\\')
    );

    if (!hasSubfolders) {
        return {
            hasSubfolders: false,
            commonFolder: null,
            expectedStructure: 'flat'
        };
    }

    // Extract folder names from paths
    const folders = samplePaths.map(path => {
        const parts = path.split(/[/\\]/);
        return parts.length > 1 ? parts[0] : null;
    }).filter(Boolean);

    // Find most common folder
    const folderCounts = {};
    folders.forEach(folder => {
        folderCounts[folder] = (folderCounts[folder] || 0) + 1;
    });

    const commonFolder = Object.keys(folderCounts).sort((a, b) =>
        folderCounts[b] - folderCounts[a]
    )[0];

    return {
        hasSubfolders: true,
        commonFolder: commonFolder,
        expectedStructure: 'subfolder'
    };
}

/**
 * Handle missing samples in SFZ import
 * Prompts user to find missing samples, then shows summary
 */
async function handleMissingSamples(sfzFile, existingWavFiles) {
    // Check which samples are missing
    const missingSamples = [];
    const foundSamples = [];

    for (const region of sfzFile.regions) {
        if (region.sample) {
            if (region.wavFile) {
                foundSamples.push(region.sample);
            } else {
                missingSamples.push(region.sample);
            }
        }
    }

    // If nothing is missing, proceed
    if (missingSamples.length === 0) {
        return { cancelled: false, wavFiles: existingWavFiles };
    }

    // Analyze the SFZ sample paths to determine expected folder structure
    const pathAnalysis = analyzeSamplePaths(missingSamples);

    // Step 1: Prompt user with intelligent information
    const totalSamples = foundSamples.length + missingSamples.length;
    let message = `📁 SFZ Import: Missing Samples\n\n`;
    message += `The SFZ file "${sfzFile.file.name}" references ${totalSamples} sample(s).\n`;
    message += `${missingSamples.length} sample file(s) were not loaded:\n\n`;

    missingSamples.forEach(sample => {
        message += `  • ${sample}\n`;
    });

    // Step 1 & 2: Prompt and immediately open picker (to maintain user gesture)
    let newWavFiles = [];

    try {
        // Show info in status bar instead of blocking confirm
        const totalSamples = foundSamples.length + missingSamples.length;
        window.BitboxerUtils.setStatus(
            `SFZ references ${totalSamples} samples, but ${missingSamples.length} are missing. Opening file picker...`,
            'info'
        );

        // Immediately open picker (while still in user gesture context)
        if (window.showDirectoryPicker) {
            // Browser supports folder selection
            newWavFiles = await searchFolderForSamples(missingSamples);
        } else {
            // Fallback: Ask user to select files manually
            newWavFiles = await searchFilesForSamples(missingSamples);
        }

        // If user cancelled the picker, treat as cancellation
        if (newWavFiles.length === 0) {
            const continueMessage = `No samples were selected.\n\nMissing ${missingSamples.length} files:\n` +
                missingSamples.map(s => `  • ${s}`).join('\n') +
                `\n\nDo you want to continue without them?\n(The preset will be incomplete)`;

            if (!confirm(continueMessage)) {
                return { cancelled: true, wavFiles: existingWavFiles };
            }
            return { cancelled: false, wavFiles: existingWavFiles };
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            // User cancelled folder/file selection
            return { cancelled: true, wavFiles: existingWavFiles };
        }
        console.error('Error searching for samples:', error);
        window.BitboxerUtils.setStatus('Error searching for samples', 'error');
        return { cancelled: true, wavFiles: existingWavFiles };
    }

    // Step 3: Check what we found
    if (newWavFiles.length === 0) {
        // Nothing found, ask if user wants to continue anyway
        const continueMessage = `No missing samples were found.\n\nDo you want to continue without them?\n(The preset will be incomplete)`;
        if (!confirm(continueMessage)) {
            return { cancelled: true, wavFiles: existingWavFiles };
        }
        return { cancelled: false, wavFiles: existingWavFiles };
    }

    // Step 4: Silently use found samples
    const foundNames = newWavFiles.map(w => w.name);
    const stillMissing = missingSamples.filter(sample => {
        const sampleName = sample.split(/[/\\]/).pop().toLowerCase();
        return !foundNames.some(name => name.toLowerCase() === sampleName);
    });

    console.log(`✓ Found ${newWavFiles.length} samples`);
    newWavFiles.forEach(file => console.log(`  ✓ ${file.name}`));

    if (stillMissing.length > 0) {
        console.warn(`Still missing ${stillMissing.length} samples:`);
        stillMissing.forEach(sample => console.warn(`  ✗ ${sample}`));
    }

    // Step 5: Process the new WAV files and merge with existing
    try {
        window.BitboxerUtils.setStatus('Processing found samples...', 'info');
        const newResult = await window.BitboxerFileHandler.FileImporter.import(newWavFiles);

        // Merge new WAV files with existing ones
        const allWavFiles = [...existingWavFiles, ...newResult.wavFiles];

        // Update the cached files for save operation
        if (!window._lastImportedFiles) {
            window._lastImportedFiles = new Map();
        }
        newResult.wavFiles.forEach(wav => {
            window._lastImportedFiles.set(wav.name, wav.file);
        });

        // Re-link regions to newly found samples
        sfzFile.regions.forEach(region => {
            if (!region.wavFile && region.sample) {
                const sampleName = region.sample.split(/[/\\]/).pop().toLowerCase();
                const match = allWavFiles.find(w => w.name.toLowerCase() === sampleName);
                if (match) {
                    region.wavFile = match;
                }
            }
        });

        // Final check for still-missing samples
        const finalMissing = sfzFile.regions.filter(r => r.sample && !r.wavFile);

        if (finalMissing.length > 0 && stillMissing.length > 0) {
            const finalMessage = `${finalMissing.length} sample(s) are still missing.\n\nDo you want to continue anyway?\n(The preset will be incomplete)`;
            if (!confirm(finalMessage)) {
                return { cancelled: true, wavFiles: existingWavFiles };
            }
        }

        return { cancelled: false, wavFiles: allWavFiles };

    } catch (error) {
        console.error('Error processing found samples:', error);
        window.BitboxerUtils.setStatus('Error processing samples', 'error');
        return { cancelled: true, wavFiles: existingWavFiles };
    }
}

/**
 * Search a folder for missing samples (modern browsers)
 */
async function searchFolderForSamples(missingSamplePaths) {
    try {
        let dirHandle = window.BitboxerData.workingFolderHandle;

        // If no working folder set, ask user to select one
        if (!dirHandle) {
            window.BitboxerUtils.setStatus('Select folder containing samples...', 'info');
            dirHandle = await window.showDirectoryPicker({
                mode: 'read',
                startIn: 'downloads'
            });

            // Save for future use
            window.BitboxerData.workingFolderHandle = dirHandle;

            // Update button if it exists
            const btn = document.getElementById('setWorkingFolderBtn');
            if (btn) {
                btn.textContent = `📁 ${dirHandle.name}`;
                btn.classList.add('active');
            }
        }

        const foundFiles = [];

        // BUILD LOOKUP (replace existing code)
        const targetLookup = {};
        missingSamplePaths.forEach(path => {
            // Extract just filename, normalize case
            const fileName = path.split(/[/\\]/).pop().toLowerCase();
            targetLookup[fileName] = path; // Store original path too
        });

        console.log('Looking for:', Object.keys(targetLookup));

        console.log('=== SEARCHING FOR SAMPLES ===');
        console.log('Looking for:', Object.keys(targetLookup));
        console.log('In folder:', dirHandle.name);

        // Recursively search the directory
        async function searchDir(dirHandle, currentPath = '', depth = 0) {
            if (depth > 5) return;

            for await (const entry of dirHandle.values()) {
                const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

                if (entry.kind === 'file') {
                    const fileName = entry.name.toLowerCase();
                    console.log(`  Checking: ${entryPath}`);

                    if (fileName.endsWith('.wav') && targetLookup[fileName]) {
                        const file = await entry.getFile();
                        foundFiles.push(file);
                        console.log(`  ✓ FOUND: ${fileName}`);
                    }
                } else if (entry.kind === 'directory') {
                    await searchDir(entry, entryPath, depth + 1);
                }
            }
        }

        await searchDir(dirHandle);

        console.log(`Found ${foundFiles.length} files`);
        return foundFiles;

    } catch (error) {
        if (error.name === 'AbortError') {
            throw error;
        }
        console.error('Folder search error:', error);
        return [];
    }
}

/**
 * Search manually selected files for missing samples (fallback)
 */
async function searchFilesForSamples(missingSamplePaths) {
    try {
        window.BitboxerUtils.setStatus('Select missing sample files...', 'info');

        // Create temporary file input
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = '.wav';

        // Wait for user selection
        const files = await new Promise((resolve, reject) => {
            input.onchange = () => resolve(Array.from(input.files));
            input.oncancel = () => reject(new Error('AbortError'));
            input.click();
        });

        // Filter to only the files we need
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

/**
 * Process imported files from FileHandler
 */
async function processImportedFiles(result) {
    // Cache the imported files for later use when saving
    window._lastImportedFiles = result.collection.files;
    console.log('Cached imported files:', window._lastImportedFiles.size);

    try {
        // Priority 2: SFZ files with samples
        if (result.sfzFiles.length > 0) {
            const sfzFile = result.sfzFiles[0];

            // Check for missing samples and handle them
            const importResult = await handleMissingSamples(sfzFile, result.wavFiles);

            if (importResult.cancelled) {
                window.BitboxerUtils.setStatus('SFZ import cancelled', 'info');
                return;
            }

            // Continue with import using found + newly loaded samples
            await convertSFZToPreset(sfzFile, importResult.wavFiles);
            return;
        }

        // Priority 3: Just WAV files (assign to empty pads)
        if (result.wavFiles.length > 0) {
            assignWAVsToPads(result.wavFiles);
            return;
        }

        // Nothing useful found
        window.BitboxerUtils.setStatus('No supported files found in import', 'error');
    } catch (error) {
        console.error('Import processing error:', error);
        window.BitboxerUtils.setStatus(`Import failed: ${error.message}`, 'error');
    }
}

/**
 * Convert SFZ data to Bitbox preset with multi-sample support
 */
async function convertSFZToPreset(sfzData, wavFiles) {
    // Create fresh preset
    window.BitboxerData.createEmptyPreset();

    // IMPORTANT: Initialize project if it doesn't exist
    if (!window.BitboxerData.projectName || window.BitboxerData.projectName === '') {
        window.BitboxerData.initializeProject();
    }
    const { presetData } = window.BitboxerData;

    // All SFZ regions go to ONE pad as multi-sample
    const row = 0;
    const col = 0;
    const pad = presetData.pads[row][col];

    // Set pad to multi-sample mode
    pad.type = 'sample';
    pad.params.multisammode = '1';

    // Use SFZ filename (without extension) as the multisample folder name
    const multisamFolder = sfzData.file.name.replace('.sfz', '');
    pad.filename = `.\\${multisamFolder}`;

    console.log('Multisample folder:', pad.filename);

    // Create asset cells for each region
    const assetCells = [];
    let validRegions = 0;

    for (let i = 0; i < sfzData.regions.length; i++) {
        const region = sfzData.regions[i];

        if (!region.wavFile) {
            console.warn(`Skipping region ${i}: No WAV file found for ${region.sample}`);
            continue;
        }

        // Create asset cell
        const asset = createAssetFromSFZRegion(region, row, col, i);
        assetCells.push(asset);
        validRegions++;
    }

    // Store asset cells
    window.BitboxerData.assetCells = assetCells;

    // Apply global SFZ settings to pad (if any)
    if (sfzData.global) {
        applySFZOpcodesToPad(pad, sfzData.global, {});
    }

    console.log(`Project name: ${window.BitboxerData.projectName}`);
    console.log(`Multisample folder: ${multisamFolder}`);

    // Update UI
    window.BitboxerUI.updatePadDisplay();
    window.BitboxerUtils.setStatus(
        `Imported multi-sample: ${validRegions} layers from ${sfzData.file.name}`,
        'success'
    );
}

async function convertSFZToPad(sfzData, wavFiles, targetPad) {
    const row = parseInt(targetPad.dataset.row);
    const col = parseInt(targetPad.dataset.col);
    const { presetData, assetCells } = window.BitboxerData;
    
    const validRegions = sfzData.regions.filter(r => r.wavFile);
    
    if (validRegions.length === 0) {
        window.BitboxerUtils.setStatus('No valid samples found in SFZ', 'error');
        return;
    }
    
    // Analyze layer structure
    const layerAnalysis = analyzeSFZLayers(validRegions);
    
    // If stacked layers detected, prompt user for pad mapping
    if (layerAnalysis.isStacked) {
        window.BitboxerUtils.setStatus('Stacked layers detected - choose pads...', 'info');
        
        const mappings = await promptLayerToPadMapping(validRegions, targetPad);
        
        if (!mappings || mappings.length === 0) {
            window.BitboxerUtils.setStatus('SFZ import cancelled', 'info');
            return;
        }
        
        // Load each layer to its assigned pad
        for (const mapping of mappings) {
            const pad = presetData.pads[mapping.row][mapping.col];
            const region = mapping.region;
            
            pad.type = 'sample';
            pad.filename = region.wavFile.name;
            pad.params.multisammode = '0';
            
            applySFZOpcodesToPad(pad, region, region.wavFile.metadata || {});
        }
        
        window.BitboxerUI.updatePadDisplay();
        window.BitboxerUtils.setStatus(
            `Imported ${mappings.length} stacked layers across pads`,
            'success'
        );
        return;
    }
    
    // Single region = normal sample
    if (validRegions.length === 1) {
        const pad = presetData.pads[row][col];
        const region = validRegions[0];
        
        pad.type = 'sample';
        pad.filename = region.wavFile.name;
        pad.params.multisammode = '0';
        
        applySFZOpcodesToPad(pad, region, region.wavFile.metadata || {});
        
        window.BitboxerUI.updatePadDisplay();
        window.BitboxerUtils.setStatus(
            `Imported single sample: ${region.wavFile.name}`,
            'success'
        );
        return;
    }
    
    // Multiple regions with velocity layers = multisample
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
    window.BitboxerUtils.setStatus(
        `Imported multisample: ${validRegions.length} velocity layers`,
        'success'
    );
}

/**
 * Analyzes SFZ regions to detect layer structure
 */
function analyzeSFZLayers(regions) {
    // Group by key range
    const keyGroups = {};
    regions.forEach(r => {
        const keyRange = `${r.lokey || 0}-${r.hikey || 127}`;
        if (!keyGroups[keyRange]) keyGroups[keyRange] = [];
        keyGroups[keyRange].push(r);
    });
    
    // Check for stacked layers (same key range, overlapping velocity)
    let hasStackedLayers = false;
    
    for (const [keyRange, group] of Object.entries(keyGroups)) {
        if (group.length > 1) {
            // Check if velocities overlap (= stacked, not velocity layers)
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
 * Shows modal for user to map SFZ layers to pads
 */
async function promptLayerToPadMapping(regions, targetPad) {
    const { presetData } = window.BitboxerData;
    
    // Find available pads
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
                    <p style="margin-bottom: 15px; color: var(--color-text-primary);">
                        This SFZ has <strong>${regions.length} layers</strong> that play simultaneously.
                        Choose which pad to load each layer to:
                    </p>
                    <div id="layerMappingContainer" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
                        <!-- Populated by JS -->
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-primary" id="importLayersBtn" style="flex: 1;">
                            Import Layers
                        </button>
                        <button class="btn" id="cancelLayersBtn" style="flex: 1;">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const container = document.getElementById('layerMappingContainer');
        const selectedDestinations = new Set();
        
        // Build mapping UI
        regions.forEach((region, idx) => {
            const sampleName = region.sample ? region.sample.split(/[/\\]/).pop() : `Layer ${idx + 1}`;
            
            const rowHtml = `
                <div class="pad-mapping-row" style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center; padding: 10px; background: var(--color-bg-tertiary); border-radius: var(--radius-md);">
                    <div style="color: var(--color-accent-blue); font-weight: 600;">
                        ${sampleName}
                    </div>
                    <div style="color: var(--color-text-secondary);">→</div>
                    <select class="select layer-target" data-layer-idx="${idx}" style="width: 100%;">
                        <!-- Populated by updateOptions -->
                    </select>
                </div>
            `;
            container.innerHTML += rowHtml;
        });
        
        const targetSelects = container.querySelectorAll('.layer-target');
        
        // Function to update all dropdowns
        function updateAllOptions() {
            targetSelects.forEach(select => {
                const currentValue = select.value;
                let options = '<option value="">-- Skip This Layer --</option>';
                
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

        // Auto-fill empty pads
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
        
        // Listen for changes
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
            document.querySelectorAll('.layer-target').forEach(select => {
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
 * Create Bitbox asset cell from SFZ region
 */
function createAssetFromSFZRegion(region, padRow, padCol, assetIndex) {
    // Determine key range - with safer parsing
    let keyRangeBottom = 0;
    let keyRangeTop = 127;
    let rootNote = 60;

    // Parse lokey
    if (region.lokey !== undefined && region.lokey !== null && region.lokey !== 'NaN') {
        const parsed = parseInt(region.lokey);
        if (!isNaN(parsed)) {
            keyRangeBottom = parsed;
        }
    }

    // Parse hikey
    if (region.hikey !== undefined && region.hikey !== null && region.hikey !== 'NaN') {
        const parsed = parseInt(region.hikey);
        if (!isNaN(parsed)) {
            keyRangeTop = parsed;
        }
    }

    // Parse root note (pitch_keycenter or key)
    if (region.pitch_keycenter !== undefined && region.pitch_keycenter !== null && region.pitch_keycenter !== 'NaN') {
        const parsed = parseInt(region.pitch_keycenter);
        if (!isNaN(parsed)) {
            rootNote = parsed;
        }
    } else if (region.key !== undefined && region.key !== null && region.key !== 'NaN') {
        const parsed = parseInt(region.key);
        if (!isNaN(parsed)) {
            rootNote = parsed;
            // If only 'key' is specified and no lokey/hikey, set range to single key
            if (region.lokey === undefined && region.hikey === undefined) {
                keyRangeBottom = rootNote;
                keyRangeTop = rootNote;
            }
        }
    } else {
        // Use middle of key range as root note
        rootNote = Math.floor((keyRangeBottom + keyRangeTop) / 2);
    }

    // Determine velocity range
    let velRangeBottom = 0;
    let velRangeTop = 127;
    let velRoot = 64;

    // Parse lovel
    if (region.lovel !== undefined && region.lovel !== null) {
        const parsed = parseInt(region.lovel);
        if (!isNaN(parsed)) {
            velRangeBottom = parsed;
        }
    }

    // Parse hivel
    if (region.hivel !== undefined && region.hivel !== null) {
        const parsed = parseInt(region.hivel);
        if (!isNaN(parsed)) {
            velRangeTop = parsed;
        }
    }

    // velRoot is middle of velocity range
    velRoot = Math.floor((velRangeBottom + velRangeTop) / 2);

    console.log(`Asset ${assetIndex}: ${region.sample}`);
    console.log(`  Keys: ${keyRangeBottom}-${keyRangeTop} (root: ${rootNote})`);
    console.log(`  Vel: ${velRangeBottom}-${velRangeTop} (root: ${velRoot})`);
    console.log(`  Raw region data:`, region);

    // Get the multisample folder name from the pad
    const { presetData } = window.BitboxerData;
    const padFilename = presetData.pads[padRow][padCol].filename;
    const folderName = padFilename.replace('.\\', '');

    console.log(`Creating asset with folder structure:`);
    console.log(`  Pad filename: ${padFilename}`);
    console.log(`  Folder name: ${folderName}`);
    console.log(`  Sample: ${region.sample}`);
    console.log(`  Final path: .\\${folderName}\\${region.sample}`);

    const sampleFileName = region.sample.split(/[/\\]/).pop(); // Get just the filename

    return {
        row: assetIndex,
        filename: `.\\${folderName}\\${sampleFileName}`, // ← Use clean filename only
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
 * Apply SFZ opcodes to a Bitbox pad
 */
function applySFZOpcodesToPad(pad, region, wavMetadata) {
    // VOLUME: Direct conversion (dB to millidecibels)
    if (region.volume !== undefined) {
        const db = parseFloat(region.volume);
        pad.params.gaindb = Math.round(db * 1000).toString();
    }
    if (region.amplitude !== undefined) {
        // amplitude is percentage (0-100)
        const db = 20 * Math.log10(parseFloat(region.amplitude) / 100);
        pad.params.gaindb = Math.round(db * 1000).toString();
    }

    // PAN: Convert -100/+100 to -1000/+1000
    if (region.pan !== undefined) {
        const pan = parseFloat(region.pan);
        pad.params.panpos = Math.round(pan * 10).toString();
    }

    // PITCH: Direct conversion (cents to millicents)
    if (region.tune !== undefined) {
        const cents = parseFloat(region.tune);
        const semitones = cents / 100;
        pad.params.pitch = Math.round(semitones * 1000).toString();
    }

    // KEY MAPPING: Set root note
    if (region.pitch_keycenter !== undefined) {
        pad.params.rootnote = region.pitch_keycenter.toString();
    } else if (region.key !== undefined) {
        pad.params.rootnote = region.key.toString();
    }

    // SAMPLE START: offset opcode
    if (region.offset !== undefined) {
        pad.params.samstart = region.offset.toString();
    }

    // SAMPLE LENGTH: end - offset
    if (region.end !== undefined && region.offset !== undefined) {
        const length = parseInt(region.end) - parseInt(region.offset);
        pad.params.samlen = length.toString();
    }

    // LOOP MODE
    if (region.loop_mode !== undefined) {
        const loopMode = region.loop_mode.toLowerCase();
        if (loopMode === 'loop_continuous' || loopMode === 'loop_sustain') {
            pad.params.loopmode = '1'; // On
        } else {
            pad.params.loopmode = '0'; // Off
        }
    }

    // LOOP TYPE (from loop_type opcode or inferred)
    if (region.loop_type !== undefined) {
        const loopType = region.loop_type.toLowerCase();
        if (loopType === 'forward') {
            pad.params.loopmodes = '1';
        } else if (loopType === 'backward') {
            pad.params.loopmodes = '1'; // Bitbox doesn't have pure backward
        } else if (loopType === 'alternate' || loopType === 'bidirectional') {
            pad.params.loopmodes = '2';
        }
    }

    // LOOP POINTS: From SFZ or WAV metadata
    if (region.loop_start !== undefined && region.loop_end !== undefined) {
        pad.params.loopstart = region.loop_start.toString();
        pad.params.loopend = region.loop_end.toString();
        pad.params.loopmode = '1'; // Enable looping
    } else if (wavMetadata.loopPoints) {
        // Use WAV embedded loop points if SFZ doesn't specify
        pad.params.loopstart = wavMetadata.loopPoints.start.toString();
        pad.params.loopend = wavMetadata.loopPoints.end.toString();
        pad.params.loopmode = '1';

        // Set loop type from WAV
        if (wavMetadata.loopPoints.type === 1) {
            pad.params.loopmodes = '2'; // Bidirectional
        }
    }

    // SLICES: From WAV cue points
    if (wavMetadata.slices && wavMetadata.slices.length > 1) {
        pad.params.cellmode = '2'; // Slicer mode
        pad.slices = wavMetadata.slices.map(pos => ({ pos: pos.toString() }));
    }

    // TEMPO: From ACID chunk in WAV
    if (wavMetadata.tempo) {
        // Set global tempo (you might want to make this pad-specific later)
        window.BitboxerData.presetData.tempo = Math.round(wavMetadata.tempo).toString();
    }

    // ENVELOPE: SFZ to Bitbox conversion
    if (region.ampeg_attack !== undefined) {
        const seconds = parseFloat(region.ampeg_attack);
        if (seconds > 0) {
            // Conversion formula from format doc
            pad.params.envattack = Math.round(109.83 * Math.log(seconds * 1000)).toString();
        }
    }
    if (region.ampeg_decay !== undefined) {
        const seconds = parseFloat(region.ampeg_decay);
        if (seconds > 0) {
            pad.params.envdecay = Math.round(94.83 * Math.log(seconds * 1000)).toString();
        }
    }
    if (region.ampeg_sustain !== undefined) {
        const percent = parseFloat(region.ampeg_sustain);
        pad.params.envsus = Math.round((percent / 100) * 1000).toString();
    }
    if (region.ampeg_release !== undefined) {
        const seconds = parseFloat(region.ampeg_release);
        if (seconds > 0) {
            pad.params.envrel = Math.round(94.83 * Math.log(seconds * 1000)).toString();
        }
    }
}

/**
 * Assign WAV files to empty pads
 */
function assignWAVsToPads(wavFiles) {
    const { presetData } = window.BitboxerData;
    let assignedCount = 0;

    // Find empty pads and assign WAVs
    for (let i = 0; i < Math.min(wavFiles.length, 16); i++) {
        const wavData = wavFiles[i];
        const row = Math.floor(i / 4);
        const col = i % 4;
        const pad = presetData.pads[row][col];

        // Set basic properties
        pad.filename = wavData.name;
        pad.type = 'samtempl';

        // IMPORTANT: Change type to 'sample' when filename is set
        if (pad.filename) {
            pad.type = 'sample';
        }

        // Apply WAV metadata
        if (wavData.metadata.loopPoints) {
            pad.params.loopstart = wavData.metadata.loopPoints.start.toString();
            pad.params.loopend = wavData.metadata.loopPoints.end.toString();
            pad.params.loopmode = '1';

            if (wavData.metadata.loopPoints.type === 1) {
                pad.params.loopmodes = '2'; // Bidirectional
            }
        }

        if (wavData.metadata.slices.length > 1) {
            pad.params.cellmode = '2'; // Slicer mode
            pad.slices = wavData.metadata.slices.map(pos => ({ pos: pos.toString() }));
        }

        if (wavData.metadata.tempo) {
            window.BitboxerData.presetData.tempo = Math.round(wavData.metadata.tempo).toString();
        }

        assignedCount++;
    }

    window.BitboxerUI.updatePadDisplay();
    window.BitboxerUtils.setStatus(
        `Loaded ${assignedCount} WAV file${assignedCount !== 1 ? 's' : ''}`,
        'success'
    );
}

/**
 * Prompts user to choose between replace or merge
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
                    <p style="margin-bottom: 20px; color: var(--color-text-primary);">
                        How would you like to load this preset?
                    </p>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <button class="btn btn-primary" id="replaceBtn" style="padding: 15px;">
                            <strong>Replace All Pads</strong><br>
                            <small style="opacity: 0.8;">Clear current project and load preset</small>
                        </button>
                        <button class="btn btn-primary" id="mergeBtn" style="padding: 15px;">
                            <strong>Merge Into Project</strong><br>
                            <small style="opacity: 0.8;">Import pads to empty slots</small>
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

/**
 * Merges a preset into the current project
 * @param {File} file - XML preset file
 */
async function mergePreset(file) {
    try {
        // Parse the preset to be merged
        const text = await file.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'text/xml');

        // Extract pads from XML
        const cells = xmlDoc.querySelectorAll('cell[layer="0"]');
        const importedPads = [];

        cells.forEach(cell => {
            const row = parseInt(cell.getAttribute('row'));
            const col = parseInt(cell.getAttribute('column'));
            const filename = cell.getAttribute('filename') || '';

            // Only include pads with content
            if (!isNaN(row) && !isNaN(col) && filename) {
                const padData = {
                    row,
                    col,
                    filename,
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
            window.BitboxerUtils.setStatus('No pads found in preset', 'error');
            return;
        }

        // Find empty and occupied slots
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

        // Show mapping UI
        const mappings = await promptPadMapping(importedPads, emptySlots, occupiedSlots);

        if (!mappings || mappings.length === 0) {
            window.BitboxerUtils.setStatus('Merge cancelled', 'info');
            return;
        }

        // Apply mappings
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

        // Parse assets (multisamples)
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
        window.BitboxerUtils.setStatus(
            `Merged ${mappings.length} pad(s) into project`,
            'success'
        );

    } catch (error) {
        console.error('Merge error:', error);
        window.BitboxerUtils.setStatus(`Merge failed: ${error.message}`, 'error');
    }
}

/**
 * Automatically loads WAV files referenced in the loaded preset
 */
async function autoLoadReferencedSamples() {
    console.log('=== AUTO-LOADING SAMPLES ===');

    const { presetData, assetCells, workingFolderHandle } = window.BitboxerData;

    // If we already have cached files (from ZIP), we're done
    if (window._lastImportedFiles && window._lastImportedFiles.size > 0) {
        console.log('✓ Samples already in cache:', window._lastImportedFiles.size);
        return;
    }

    // Collect all referenced sample filenames
    const referencedSamples = new Set();

    // From pads
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
            const pad = presetData.pads[row][col];
            if (pad.filename && pad.params.multisammode !== '1') {
                // Single sample
                const wavName = pad.filename.split(/[/\\]/).pop();
                if (wavName.endsWith('.wav') || wavName.endsWith('.WAV')) {
                    referencedSamples.add(wavName);
                }
            }
        }
    }

    // From asset cells (multisamples)
    assetCells.forEach(asset => {
        const wavName = asset.filename.split(/[/\\]/).pop();
        if (wavName.endsWith('.wav') || wavName.endsWith('.WAV')) {
            referencedSamples.add(wavName);
        }
    });

    if (referencedSamples.size === 0) {
        console.log('No samples referenced in preset');
        return;
    }

    console.log('Preset references', referencedSamples.size, 'samples:', Array.from(referencedSamples));

    // Try to load samples from working folder
    if (!workingFolderHandle) {
        // No working folder - ask user
        const shouldLocate = await promptNoWorkingFolder(referencedSamples.size);
        if (shouldLocate) {
            try {
                const foundFiles = await promptForSampleFolder(Array.from(referencedSamples));
                window._lastImportedFiles = new Map();
                foundFiles.forEach(file => {
                    window._lastImportedFiles.set(file.name, file);
                });
                console.log('✓ Loaded', foundFiles.length, 'samples into cache');
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

    // Working folder is set - search automatically
    window.BitboxerUtils.setStatus('Searching for samples...', 'info');

    try {
        const foundFiles = await searchFolderForSamplesRecursive(
            workingFolderHandle,
            Array.from(referencedSamples)
        );

        // Cache found files
        window._lastImportedFiles = new Map();
        foundFiles.forEach(file => {
            window._lastImportedFiles.set(file.name, file);
        });

        if (foundFiles.length >= referencedSamples.size) {
            // Found everything (or more)!
            console.log('✓ Found all', referencedSamples.size, 'samples');
            window.BitboxerUtils.setStatus(
                `Loaded preset with ${referencedSamples.size} sample(s)`,
                'success'
            );
            return; // ← EXIT HERE, no prompt
        }

        // Only prompt if actually missing samples
        const foundNames = new Set(foundFiles.map(f => f.name.toLowerCase()));
        const missing = Array.from(referencedSamples).filter(
            name => !foundNames.has(name.toLowerCase())
        );

        // Should never reach here if foundFiles.length >= referencedSamples.size
        const shouldLocate = await promptSomeMissing(missing, foundFiles.length, referencedSamples.size);

        if (shouldLocate) {
            try {
                const additionalFiles = await searchFilesForSamples(missing);
                additionalFiles.forEach(file => {
                    window._lastImportedFiles.set(file.name, file);
                });
                console.log('✓ Total cached:', window._lastImportedFiles.size);
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
 * Prompts when no working folder is set
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
                    <p style="margin-bottom: 15px; color: var(--color-text-primary);">
                        This preset references <strong>${sampleCount} sample file(s)</strong>.
                    </p>
                    <p style="margin-bottom: 20px; color: var(--color-text-secondary);">
                        No working folder is set. Would you like to locate the samples?
                    </p>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-primary" id="locateBtn2" style="flex: 1;">
                            📁 Locate Samples
                        </button>
                        <button class="btn" id="skipBtn2" style="flex: 1;">
                            Skip
                        </button>
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
                    <p style="margin-bottom: 15px; color: var(--color-text-primary);">
                        Found: <strong>${foundCount}/${totalCount}</strong> samples<br>
                        Missing: <strong>${missingSamples.length}</strong>
                    </p>
                    ${missingSamples.length <= 10 ? `
                        <div style="max-height: 200px; overflow-y: auto; background: var(--color-bg-primary); padding: 10px; border-radius: var(--radius-md); margin-bottom: 15px; font-family: monospace; font-size: 0.85em;">
                            ${missingSamples.map(name => `<div>• ${name}</div>`).join('')}
                        </div>
                    ` : ''}
                    <p style="margin-bottom: 20px; color: var(--color-text-secondary);">
                        Would you like to locate the missing samples?
                    </p>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-primary" id="locateBtn3" style="flex: 1;">
                            📁 Locate Missing Samples
                        </button>
                        <button class="btn" id="skipBtn3" style="flex: 1;">
                            Continue Without Them
                        </button>
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
 * Prompts user to select folder containing samples
 */
async function promptForSampleFolder(sampleNames) {
    if (window.showDirectoryPicker) {
        // Modern API
        window.BitboxerUtils.setStatus('Select folder containing samples...', 'info');
        const dirHandle = await window.showDirectoryPicker({ mode: 'read' });

        // Save as working folder
        window.BitboxerData.workingFolderHandle = dirHandle;
        const btn = document.getElementById('setWorkingFolderBtn');
        if (btn) {
            btn.textContent = `📁 ${dirHandle.name}`;
            btn.classList.add('active');
        }

        return await searchFolderForSamplesRecursive(dirHandle, sampleNames);
    } else {
        // Fallback: file picker
        return await searchFilesForSamples(sampleNames);
    }
}

/**
 * Recursively searches folder for samples
 */
async function searchFolderForSamplesRecursive(dirHandle, targetNames) {
    const foundFiles = [];
    const targetLookup = {};
    targetNames.forEach(name => {
        targetLookup[name.toLowerCase()] = name; // Store original name too
    });

    async function searchDir(handle, depth = 0) {
        if (depth > 5) return; // Max 5 levels deep

        for await (const entry of handle.values()) {
            if (entry.kind === 'file') {
                const fileName = entry.name.toLowerCase();
                if (fileName.endsWith('.wav') && targetLookup[fileName]) {
                    const file = await entry.getFile();
                    foundFiles.push(file);
                    console.log(`✓ Found: ${entry.name}`);
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
 * Prompts user to map imported pads to target slots
 * @param {Array} importedPads - Pads to import
 * @param {Array} emptySlots - Available empty slots
 * @param {Array} occupiedSlots - Occupied slots
 * @returns {Promise<Array|null>} Array of mappings [{source, target}] or null if cancelled
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
                    <p style="margin-bottom: 15px; color: var(--color-text-primary);">
                        Select which pads to import and where to place them:
                    </p>
                    <div id="padMappingContainer" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
                        <!-- Populated by JS -->
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-primary" id="importMappedBtn" style="flex: 1;">
                            Import Selected Pads
                        </button>
                        <button class="btn" id="cancelMappingBtn" style="flex: 1;">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const container = document.getElementById('padMappingContainer');
        const { presetData } = window.BitboxerData;
        
        // Track selected destinations
        const selectedDestinations = new Set();
        
        // Build mapping UI
        importedPads.forEach((pad, idx) => {
            const sourcePadNum = (pad.row * 4) + pad.col + 1;
            const sourceName = pad.filename ? 
                pad.filename.split(/[/\\]/).pop().replace(/\.(wav|WAV)$/, '') : 
                'Empty';
            
            const rowHtml = `
                <div class="pad-mapping-row" style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center; padding: 10px; background: var(--color-bg-tertiary); border-radius: var(--radius-md);">
                    <div style="color: var(--color-accent-blue); font-weight: 600;">
                        Pad ${sourcePadNum}: ${sourceName}
                    </div>
                    <div style="color: var(--color-text-secondary);">→</div>
                    <select class="select mapping-target" data-source-idx="${idx}" style="width: 100%;">
                        <!-- Populated by updateOptions -->
                    </select>
                </div>
            `;
            container.innerHTML += rowHtml;
        });
        
        const targetSelects = container.querySelectorAll('.mapping-target');
        
        // Function to update all dropdowns
        function updateAllOptions() {
            targetSelects.forEach((select, idx) => {
                const currentValue = select.value;
                let options = '<option value="">-- Don\'t Import --</option>';
                
                // Empty slots first
                emptySlots.forEach(slot => {
                    const slotKey = `${slot.row},${slot.col}`;
                    const targetPadNum = (slot.row * 4) + slot.col + 1;
                    const isSelected = selectedDestinations.has(slotKey) && currentValue !== slotKey;
                    if (!isSelected) {
                        options += `<option value="${slotKey}" ${currentValue === slotKey ? 'selected' : ''}>Pad ${targetPadNum} (Empty)</option>`;
                    }
                });
                
                // Occupied slots
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

        
        // Auto-select empty slots
        targetSelects.forEach((select, idx) => {
            if (idx < emptySlots.length) {
                const slotKey = `${emptySlots[idx].row},${emptySlots[idx].col}`;
                select.value = slotKey;
                selectedDestinations.add(slotKey);
            }
        });
        
        updateAllOptions();
        
        // Listen for changes
        targetSelects.forEach(select => {
            select.addEventListener('change', () => {
                // Rebuild selected set
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
                window.BitboxerUtils.setStatus('No pads selected for import', 'error');
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
// DOM READY
// ============================================
/**
 * Initialize app when DOM is ready
 */
document.addEventListener('DOMContentLoaded', initializeApp);
