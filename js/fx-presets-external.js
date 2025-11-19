/**
 * BITBOXER - FX Preset Folder Scanner
 * 
 * Scans /fx-presets/ folder structure for external JSON presets
 * Allows users to add custom presets without editing code
 * 
 * Folder Structure:
 * /fx-presets/
 *   /delay/       - Delay presets
 *   /reverb/      - Reverb presets
 *   /eq/          - EQ presets
 *   /sets/        - Complete FX sets
 */

// ============================================
// EXTERNAL PRESET STORAGE
// ============================================

const externalPresets = {
    delay: [],
    reverb: [],
    eq: [],
    sets: []
};

// ============================================
// FOLDER SCANNING (FILE SYSTEM ACCESS API)
// ============================================

/**
 * Prompts user to select fx-presets folder and scans it
 */
async function selectPresetsFolder() {
    if (!window.showDirectoryPicker) {
        window.BitboxerUtils.setStatus(
            'Folder scanning not supported in this browser. Use Chrome/Edge.',
            'error'
        );
        return false;
    }
    
    try {
        window.BitboxerUtils.setStatus('Select fx-presets folder...', 'info');
        
        const dirHandle = await window.showDirectoryPicker({
            mode: 'read',
            startIn: 'documents'
        });
        
        // Store handle for future use
        window.BitboxerData.fxPresetsFolderHandle = dirHandle;
        
        // Scan the folder
        await scanPresetsFolder(dirHandle);
        
        window.BitboxerUtils.setStatus(
            `Loaded ${getTotalExternalPresets()} external preset(s)`,
            'success'
        );
        
        return true;
    } catch (error) {
        if (error.name === 'AbortError') {
            window.BitboxerUtils.setStatus('Folder selection cancelled', 'info');
        } else {
            console.error('Folder selection error:', error);
            window.BitboxerUtils.setStatus('Failed to access folder', 'error');
        }
        return false;
    }
}

/**
 * Scans fx-presets folder structure
 */
async function scanPresetsFolder(dirHandle) {
    console.log('=== Scanning FX Presets Folder ===');
    
    // Clear existing external presets
    externalPresets.delay = [];
    externalPresets.reverb = [];
    externalPresets.eq = [];
    externalPresets.sets = [];
    
    // Scan subfolders
    for await (const entry of dirHandle.values()) {
        if (entry.kind !== 'directory') continue;
        
        const folderName = entry.name.toLowerCase();
        
        if (folderName === 'delay' || folderName === 'reverb' || 
            folderName === 'eq' || folderName === 'sets') {
            
            console.log(`Scanning /${folderName}/...`);
            await scanPresetSubfolder(entry, folderName);
        }
    }
    
    console.log('=== Scan Complete ===');
    console.log('Delay presets:', externalPresets.delay.length);
    console.log('Reverb presets:', externalPresets.reverb.length);
    console.log('EQ presets:', externalPresets.eq.length);
    console.log('FX Sets:', externalPresets.sets.length);
}

/**
 * Scans a single subfolder for JSON presets
 */
async function scanPresetSubfolder(dirHandle, category) {
    for await (const entry of dirHandle.values()) {
        if (entry.kind !== 'file') continue;
        if (!entry.name.endsWith('.json')) continue;
        
        try {
            const file = await entry.getFile();
            const text = await file.text();
            const preset = JSON.parse(text);
            
            // Validate preset structure
            if (validatePreset(preset, category)) {
                // Add source info
                preset._source = 'external';
                preset._filename = entry.name;
                
                externalPresets[category].push(preset);
                console.log(`  ✓ Loaded: ${preset.name}`);
            } else {
                console.warn(`  ✗ Invalid preset: ${entry.name}`);
            }
        } catch (error) {
            console.error(`  ✗ Failed to load ${entry.name}:`, error);
        }
    }
}

/**
 * Validates preset structure
 */
function validatePreset(preset, category) {
    if (!preset.name) return false;
    
    if (category === 'sets') {
        // FX Set must have delay, reverb, and eq
        return preset.delay && preset.reverb && preset.eq &&
               preset.delay.params && preset.reverb.params && preset.eq.params;
    } else {
        // Individual FX must have params
        return preset.params && typeof preset.params === 'object';
    }
}

/**
 * Gets total count of external presets
 */
function getTotalExternalPresets() {
    return externalPresets.delay.length + 
           externalPresets.reverb.length + 
           externalPresets.eq.length + 
           externalPresets.sets.length;
}

// ============================================
// LEGACY: FETCH-BASED SCANNING (FALLBACK)
// ============================================

/**
 * Attempts to load presets via fetch() for local hosting
 * Only works when served via http://localhost or file://
 */
async function loadPresetsViaFetch() {
    console.log('=== Attempting fetch-based preset loading ===');
    
    const categories = ['delay', 'reverb', 'eq', 'sets'];
    let totalLoaded = 0;
    
    for (const category of categories) {
        try {
            // Try to fetch manifest file (user must create this)
            const response = await fetch(`fx-presets/${category}/manifest.json`);
            if (!response.ok) continue;
            
            const manifest = await response.json();
            
            // Load each preset file listed in manifest
            for (const filename of manifest.files) {
                try {
                    const presetResponse = await fetch(`fx-presets/${category}/${filename}`);
                    const preset = await presetResponse.json();
                    
                    if (validatePreset(preset, category)) {
                        preset._source = 'external';
                        preset._filename = filename;
                        externalPresets[category].push(preset);
                        totalLoaded++;
                    }
                } catch (error) {
                    console.warn(`Failed to load ${category}/${filename}`);
                }
            }
        } catch (error) {
            // Manifest not found - skip this category
        }
    }
    
    if (totalLoaded > 0) {
        console.log(`Loaded ${totalLoaded} preset(s) via fetch`);
        return true;
    }
    
    return false;
}

// ============================================
// COMBINED PRESET LISTS
// ============================================

/**
 * Gets combined list of built-in + external presets
 */
function getCombinedPresets(category) {
    const builtIn = window.BitboxerFXPresets.FX_PRESETS[category] || [];
    const external = externalPresets[category] || [];
    
    return [...builtIn, ...external];
}

/**
 * Populates dropdown with combined presets
 */
function populateDropdownWithExternal(dropdownId, category) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;
    
    // Clear existing options (except first)
    while (dropdown.options.length > 1) {
        dropdown.remove(1);
    }
    
    const presets = getCombinedPresets(category);
    
    // Add separator if we have both built-in and external
    const builtInCount = window.BitboxerFXPresets.FX_PRESETS[category]?.length || 0;
    const externalCount = externalPresets[category]?.length || 0;
    
    // Add built-in presets
    presets.slice(0, builtInCount).forEach(preset => {
        const option = document.createElement('option');
        option.value = preset.name;
        option.textContent = preset.name;
        option.title = preset.description;
        dropdown.appendChild(option);
    });
    
    // Add separator
    if (builtInCount > 0 && externalCount > 0) {
        const separator = document.createElement('option');
        separator.disabled = true;
        separator.textContent = '──────────';
        dropdown.appendChild(separator);
    }
    
    // Add external presets
    presets.slice(builtInCount).forEach(preset => {
        const option = document.createElement('option');
        option.value = preset.name;
        option.textContent = `📁 ${preset.name}`;  // Folder icon to indicate external
        option.title = `${preset.description}\n(External: ${preset._filename})`;
        dropdown.appendChild(option);
    });
}

/**
 * Repopulates all FX preset dropdowns with external presets
 */
function refreshAllPresetDropdowns() {
    populateDropdownWithExternal('delayPresetDropdown', 'delay');
    populateDropdownWithExternal('reverbPresetDropdown', 'reverb');
    populateDropdownWithExternal('eqPresetDropdown', 'eq');
    populateDropdownWithExternal('fxSetPresetDropdown', 'sets');
}

/**
 * Modified applyBuiltInPreset to work with external presets
 */
function applyPreset(fxType, presetName) {
    const allPresets = getCombinedPresets(fxType);
    const preset = allPresets.find(p => p.name === presetName);
    
    if (!preset) {
        window.BitboxerUtils.setStatus('Preset not found', 'error');
        return;
    }
    
    // Use existing applyFXPreset function
    window.BitboxerFXPresets.applyFXPreset(preset, fxType);
}

// ============================================
// AUTO-LOAD ON STARTUP
// ============================================

/**
 * Attempts to auto-load presets on app start
 */
async function autoLoadPresets() {
    // Try fetch-based loading first (for localhost)
    const fetchSuccess = await loadPresetsViaFetch();
    
    if (fetchSuccess) {
        refreshAllPresetDropdowns();
        return;
    }
    
    // If user previously selected a folder, try to use it
    if (window.BitboxerData.fxPresetsFolderHandle) {
        try {
            await scanPresetsFolder(window.BitboxerData.fxPresetsFolderHandle);
            refreshAllPresetDropdowns();
        } catch (error) {
            console.log('Could not access previous presets folder');
        }
    }
}

// ============================================
// EXPORT
// ============================================
window.BitboxerFXPresetsExternal = {
    selectPresetsFolder,
    scanPresetsFolder,
    loadPresetsViaFetch,
    autoLoadPresets,
    refreshAllPresetDropdowns,
    getCombinedPresets,
    applyPreset,
    externalPresets
};