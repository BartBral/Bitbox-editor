/**
 * BITBOXER - Pad Operations
 * 
 * Handles all pad manipulation operations:
 * - Copy/paste pads
 * - Delete pads
 * - Swap pads (drag & drop)
 * - Rename pads
 */

// ============================================
// PAD COPY/PASTE OPERATIONS
// ============================================

/**
 * Copies selected pads to clipboard
 * Stores deep clones of pad data to prevent reference issues
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
 * Pastes clipboard contents to selected pads
 * Handles multiple targets and clipboard overflow
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

// ============================================
// PAD DELETION
// ============================================

/**
 * Deletes selected pads and their associated assets
 * Clears pad data and removes multisample references
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

        // Create truly empty pad
        presetData.pads[row][col] = window.BitboxerData.createEmptyPadData();
        presetData.pads[row][col].type = 'samtempl';
        presetData.pads[row][col].filename = '';

        // Remove associated asset cells
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

// ============================================
// PAD SWAPPING (DRAG & DROP)
// ============================================

/**
 * Swaps data between two pads
 * Updates asset cell references to maintain multisample integrity
 * 
 * @param {HTMLElement} pad1 - First pad element
 * @param {HTMLElement} pad2 - Second pad element
 */
function swapPads(pad1, pad2) {
    const { presetData, assetCells } = window.BitboxerData;

    const row1 = parseInt(pad1.dataset.row);
    const col1 = parseInt(pad1.dataset.col);
    const row2 = parseInt(pad2.dataset.row);
    const col2 = parseInt(pad2.dataset.col);

    // Swap pad data
    const temp = presetData.pads[row1][col1];
    presetData.pads[row1][col1] = presetData.pads[row2][col2];
    presetData.pads[row2][col2] = temp;

    // Update asset cell references
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

    window.BitboxerUI.updatePadDisplay();
    window.BitboxerUtils.setStatus(
        `Swapped Pad ${pad1.dataset.padnum} with Pad ${pad2.dataset.padnum}`,
        'success'
    );
}

// ============================================
// PAD RENAMING
// ============================================

/**
 * Renames a pad's sample or multisample folder
 * Handles both regular samples and multisample folders
 * Updates cache keys to maintain save functionality
 * 
 * @param {HTMLElement} pad - Pad element to rename
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
        // Multisample: rename folder
        const oldFolder = padData.filename.replace(/^\.[\\/]/, '');
        const newFolder = prompt('Enter new multisample name:', oldFolder);
        
        if (newFolder && newFolder.trim() && newFolder !== oldFolder) {
            const trimmedFolder = newFolder.trim();
            
            // Update pad filename
            padData.filename = `.\\${trimmedFolder}`;
            
            // Update all asset cell paths
            assetCells.forEach(asset => {
                const assetRow = parseInt(asset.params.asssrcrow);
                const assetCol = parseInt(asset.params.asssrccol);
                
                if (assetRow === row && assetCol === col) {
                    const sampleName = asset.filename.split(/[\\/]/).pop();
                    asset.filename = `.\\${trimmedFolder}\\${sampleName}`;
                }
            });
            
            window.BitboxerUI.updatePadDisplay();
            window.BitboxerUtils.setStatus(`Multisample renamed to: ${trimmedFolder}`, 'success');
        }
    } else {
        // Regular sample: rename file
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
            }
            
            padData.filename = newFullName;
            window.BitboxerUI.updatePadDisplay();
            window.BitboxerUtils.setStatus(`Renamed to: ${newName.trim()}`, 'success');
        }
    }
}

// ============================================
// EXPORT PAD OPERATIONS
// ============================================
window.BitboxerPadOps = {
    copySelectedPads,
    pasteToSelected,
    deleteSelectedPads,
    swapPads,
    renamePad
};