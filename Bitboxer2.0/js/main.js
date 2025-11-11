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

    // Show the "Set Working Folder" button
    const btn = document.getElementById('setWorkingFolderBtn');
    if (btn) {
        btn.style.display = '';

        btn.addEventListener('click', async () => {
            try {
                const dirHandle = await window.showDirectoryPicker({
                    mode: 'read',
                    startIn: 'downloads'
                });

                window.BitboxerData.workingFolderHandle = dirHandle;

                btn.textContent = `📁 ${dirHandle.name}`;
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
    if (file.name.endsWith('.xml')) {
        // XML preset file
        if (confirm(`Load preset from ${file.name}? All current pads will be lost!`)) {
            window.BitboxerXML.loadPreset(file);
        }
    } else if (file.name.endsWith('.json')) {
        // JSON pad export
        loadPadFromJSON(file, targetPad);
    } else if (file.name.endsWith('.zip')) {
        // ZIP archive - check contents first
        await handleZipDropOnPad(file, targetPad); // ← NEW FUNCTION
    } else if (file.name.endsWith('.sfz')) {
        // SFZ file - import to this pad only
        await handleSfzDropOnPad(file, targetPad); // ← NEW FUNCTION
    } else if (file.name.endsWith('.wav')) {
        // WAV file
        await handleWavDrop(file, targetPad);
    } else {
        window.BitboxerUtils.setStatus(`Unsupported file type: ${file.name}`, 'error');
    }
}

async function handleSfzDropOnPad(sfzFile, targetPad) {
    try {
        window.BitboxerUtils.setStatus('Processing SFZ...', 'info');
        const result = await window.BitboxerFileHandler.FileImporter.import(sfzFile);

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
}

async function handleZipDropOnPad(zipFile, targetPad) {
    try {
        window.BitboxerUtils.setStatus('Processing ZIP...', 'info');
        const result = await window.BitboxerFileHandler.FileImporter.import(zipFile);
        
        if (result.xmlFiles.length > 0) {
            // Found Bitbox preset - ask user if they want to load entire preset
            if (confirm(`ZIP contains full preset. Load entire preset (replaces all pads)?`)) {
                // ← ADD THIS:
                window._lastImportedFiles = result.collection.files;
                console.log('Cached files from ZIP drag-drop:', window._lastImportedFiles.size);
                
                await window.BitboxerXML.loadPreset(result.xmlFiles[0].file);
            }
        } else if (result.sfzFiles.length > 0) {
            // Found SFZ - import to this pad only
            const importResult = await handleMissingSamples(result.sfzFiles[0], result.wavFiles);
            if (!importResult.cancelled) {
                await convertSFZToPad(result.sfzFiles[0], importResult.wavFiles, targetPad);
            }
        } else {
            window.BitboxerUtils.setStatus('No preset or SFZ found in ZIP', 'error');
        }
    } catch (error) {
        console.error('ZIP import error:', error);
        window.BitboxerUtils.setStatus(`ZIP import failed: ${error.message}`, 'error');
    }
}

async function handleZipDrop(zipFile, targetPad) {
    try {
        window.BitboxerUtils.setStatus('Processing ZIP...', 'info');
        const result = await window.BitboxerFileHandler.FileImporter.import(zipFile);

        if (result.xmlFiles.length > 0) {
            // Found Bitbox preset - load it
            if (confirm(`Load preset from ZIP? All current pads will be lost!`)) {
                await window.BitboxerXML.loadPreset(result.xmlFiles[0].file);
            }
        } else if (result.sfzFiles.length > 0) {
            // Found SFZ - convert it
            if (confirm(`Import SFZ kit? All current pads will be lost!`)) {
                await convertSFZToPreset(result.sfzFiles[0], result.wavFiles);
            }
        } else {
            window.BitboxerUtils.setStatus('No preset or SFZ found in ZIP', 'error');
        }
    } catch (error) {
        console.error('ZIP import error:', error);
        window.BitboxerUtils.setStatus(`ZIP import failed: ${error.message}`, 'error');
    }
}

async function handleWavDrop(wavFile, targetPad) {
    try {
        window.BitboxerUtils.setStatus('Processing WAV...', 'info');
        const result = await window.BitboxerFileHandler.FileImporter.import(wavFile);
        const wavData = result.wavFiles[0];

        const row = parseInt(targetPad.dataset.row);
        const col = parseInt(targetPad.dataset.col);
        const pad = window.BitboxerData.presetData.pads[row][col];

        // Set filename
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

        window.BitboxerUI.updatePadDisplay();
        window.BitboxerUtils.setStatus(
            `Loaded ${wavData.name} to Pad ${targetPad.dataset.padnum}`,
            'success'
        );
    } catch (error) {
        console.error('WAV import error:', error);
        window.BitboxerUtils.setStatus(`WAV import failed: ${error.message}`, 'error');
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

    document.getElementById('fileInput').addEventListener('change', async (e) => {
        if (e.target.files.length === 0) return;

        // Check what type of files were selected
        const files = Array.from(e.target.files);
        const hasXML = files.some(f => f.name.endsWith('.xml'));
        const hasZIP = files.some(f => f.name.endsWith('.zip'));
        const hasSFZ = files.some(f => f.name.endsWith('.sfz'));
        const hasWAV = files.some(f => f.name.endsWith('.wav'));

        // Single XML file - use existing flow
        if (files.length === 1 && hasXML) {
            if (confirm(`Load preset? All current pads will be lost!`)) {
                window.BitboxerXML.loadPreset(files[0]);
            }
            e.target.value = '';
            return;
        }

        // Single ZIP file - extract and check contents
        if (files.length === 1 && hasZIP) {
            if (confirm(`Load ZIP? All current pads will be lost!`)) {
                try {
                    window.BitboxerUtils.setStatus('Processing ZIP...', 'info');
                    const result = await window.BitboxerFileHandler.FileImporter.import(files[0]);

                    // Check for preset.xml inside ZIP
                    if (result.xmlFiles.length > 0) {
                        // ← ADD THIS BLOCK:
                        // Cache all files from ZIP for later save
                        window._lastImportedFiles = result.collection.files;
                        console.log('Cached files from ZIP:', window._lastImportedFiles.size);

                        // Load the preset XML
                        await window.BitboxerXML.loadPreset(result.xmlFiles[0].file);
                    } else if (result.sfzFiles.length > 0) {
                        // SFZ found - import as multisample
                        const importResult = await handleMissingSamples(result.sfzFiles[0], result.wavFiles);
                        if (!importResult.cancelled) {
                            await convertSFZToPreset(result.sfzFiles[0], importResult.wavFiles);
                        }
                    } else {
                        window.BitboxerUtils.setStatus('No preset or SFZ found in ZIP', 'error');
                    }
                } catch (error) {
                    console.error('ZIP import error:', error);
                    window.BitboxerUtils.setStatus(`ZIP import failed: ${error.message}`, 'error');
                }
            }
            e.target.value = '';
            return;
        }

        // Multiple files or SFZ/WAV files
        if (hasZIP || hasSFZ || hasWAV || files.length > 1) {
            if (confirm(`Import files? All current pads will be lost!`)) {
                try {
                    window.BitboxerUtils.setStatus('Importing files...', 'info');
                    const result = await window.BitboxerFileHandler.FileImporter.import(files);
                    await processImportedFiles(result);
                } catch (error) {
                    console.error('Import error:', error);
                    window.BitboxerUtils.setStatus(`Import failed: ${error.message}`, 'error');
                }
            }
        }

        e.target.value = ''; // Reset file input
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
            return;
        }

        // Import files to this specific pad
        try {
            const result = await window.BitboxerFileHandler.FileImporter.import(e.target.files);

            if (result.sfzFiles.length > 0) {
                // SFZ import to this pad only
                const importResult = await handleMissingSamples(result.sfzFiles[0], result.wavFiles);
                if (!importResult.cancelled) {
                    await convertSFZToPad(result.sfzFiles[0], importResult.wavFiles, selectedPad);
                }
            } else if (result.wavFiles.length > 0) {
                // WAV import to this pad
                await handleWavDrop(result.wavFiles[0].file, selectedPad);
            }
        } catch (error) {
            window.BitboxerUtils.setStatus(`Import failed: ${error.message}`, 'error');
        }

        e.target.value = ''; // Reset
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

    // Step 4: Show what was found and ask to load
    const foundNames = newWavFiles.map(w => w.name);
    const stillMissing = missingSamples.filter(sample => {
        const sampleName = sample.split(/[/\\]/).pop().toLowerCase();
        return !foundNames.some(name => name.toLowerCase() === sampleName);
    });

    let foundMessage = `Found ${newWavFiles.length} sample file(s):\n\n`;
    newWavFiles.forEach(file => {
        foundMessage += `  ✓ ${file.name}\n`;
    });

    if (stillMissing.length > 0) {
        foundMessage += `\nStill missing:\n`;
        stillMissing.forEach(sample => {
            foundMessage += `  ✗ ${sample}\n`;
        });
    }

    foundMessage += `\nDo you want to load these samples and continue?`;

    if (!confirm(foundMessage)) {
        return { cancelled: true, wavFiles: existingWavFiles };
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
    const pad = presetData.pads[row][col];

    // Set pad to multi-sample mode
    pad.type = 'sample';
    pad.params.multisammode = '1';

    const multisamFolder = sfzData.file.name.replace('.sfz', '');
    pad.filename = `.\\${multisamFolder}`;

    // Create asset cells for each region
    let validRegions = 0;
    for (let i = 0; i < sfzData.regions.length; i++) {
        const region = sfzData.regions[i];
        if (!region.wavFile) continue;

        const asset = createAssetFromSFZRegion(region, row, col, assetCells.length);
        assetCells.push(asset);
        validRegions++;
    }

    window.BitboxerUI.updatePadDisplay();
    window.BitboxerUtils.setStatus(
        `Imported ${validRegions} layers to Pad ${targetPad.dataset.padnum}`,
        'success'
    );
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

// ============================================
// DOM READY
// ============================================
/**
 * Initialize app when DOM is ready
 */
document.addEventListener('DOMContentLoaded', initializeApp);
