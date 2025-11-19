/**
 * BITBOXER - Unified Startup Modal System
 * 
 * Handles project setup, working folder, and FX presets folder
 * with persistent File System Access API handles
 */

// ============================================
// PERSISTENT FOLDER HANDLE STORAGE
// ============================================

/**
 * Stores folder handle reference using IndexedDB
 */
async function storeFolderHandle(key, dirHandle) {
    try {
        const db = await openHandleDB();
        const tx = db.transaction('handles', 'readwrite');
        const store = tx.objectStore('handles');
        
        await new Promise((resolve, reject) => {
            const request = store.put({ key: key, handle: dirHandle });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
        
        // Set flag in localStorage
        localStorage.setItem(`${key}_set`, 'true');
        localStorage.setItem(`${key}_name`, dirHandle.name);
        
        console.log(`✓ Stored handle: ${key} -> ${dirHandle.name}`);
        return true;
    } catch (error) {
        console.error('Failed to store handle:', error);
        return false;
    }
}

/**
 * Retrieves folder handle from IndexedDB
 */
async function retrieveFolderHandle(key) {
    try {
        const db = await openHandleDB();
        const tx = db.transaction('handles', 'readonly');
        const store = tx.objectStore('handles');
        
        const handle = await new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result?.handle || null);
            request.onerror = () => reject(request.error);
        });
        
        if (handle) {
            console.log(`✓ Retrieved handle: ${key} -> ${handle.name}`);
        } else {
            console.log(`✗ No handle found for: ${key}`);
        }
        
        return handle;
    } catch (error) {
        console.error('Failed to retrieve handle:', error);
        return null;
    }
}

/**
 * Opens IndexedDB for handle storage
 */
function openHandleDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('BitboxerHandles', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('handles')) {
                db.createObjectStore('handles', { keyPath: 'key' });
            }
        };
    });
}

/**
 * Verifies folder handle is still accessible
 */
async function verifyFolderAccess(dirHandle) {
    try {
        // Request permission (shows browser prompt if needed)
        const permission = await dirHandle.requestPermission({ mode: 'read' });
        return permission === 'granted';
    } catch (error) {
        console.error('Permission verification failed:', error);
        return false;
    }
}

// ============================================
// STARTUP MODAL UI
// ============================================

/**
 * Shows unified startup modal
 */
async function showStartupModal() {
    // Check if folders were previously set
    const workingFolderSet = localStorage.getItem('workingFolder_set') === 'true';
    const fxPresetsSet = localStorage.getItem('fxPresets_set') === 'true';
    
    // Attempt to restore handles
    let workingFolderHandle = null;
    let fxPresetsHandle = null;
    let workingFolderStatus = 'Not set';
    let fxPresetsStatus = 'Not set';
    
    if (workingFolderSet) {
        workingFolderHandle = await retrieveFolderHandle('workingFolder');
        if (workingFolderHandle) {
            const accessible = await verifyFolderAccess(workingFolderHandle);
            if (accessible) {
                workingFolderStatus = `✓ ${workingFolderHandle.name}`;
                window.BitboxerData.workingFolderHandle = workingFolderHandle;
            } else {
                workingFolderStatus = '⚠️ Permission denied';
                localStorage.removeItem('workingFolder_set');
            }
        } else {
            workingFolderStatus = '⚠️ Folder not found';
            localStorage.removeItem('workingFolder_set');
        }
    }
    
    
    if (fxPresetsSet) {
        fxPresetsHandle = await retrieveFolderHandle('fxPresets');
        if (fxPresetsHandle) {
            const accessible = await verifyFolderAccess(fxPresetsHandle);
            if (accessible) {
                fxPresetsStatus = `✓ ${fxPresetsHandle.name}`;
                window.BitboxerData.fxPresetsFolderHandle = fxPresetsHandle;
                // Auto-scan presets
                await window.BitboxerFXPresetsExternal.scanPresetsFolder(fxPresetsHandle);
                window.BitboxerFXPresetsExternal.refreshAllPresetDropdowns();
            } else {
                fxPresetsStatus = '⚠️ Permission denied';
                localStorage.removeItem('fxPresets_set');
            }
        } else {
            fxPresetsStatus = '⚠️ Folder not found';
            localStorage.removeItem('fxPresets_set');
        }
    }
    
    // Re-check statuses for blinking
    const shouldBlinkWorking = workingFolderStatus.includes('Not set') || 
                               workingFolderStatus.includes('⚠️');
    const shouldBlinkFX = fxPresetsStatus.includes('Not set') || 
                          fxPresetsStatus.includes('⚠️');


    // generate random project name 
    const defaultName = '';  // Empty = forces random generation

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.id = 'startupModal';
    modal.style.zIndex = '9999';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h2>🎹 BITBOXER - Project Setup</h2>
            </div>
            <div style="padding: 25px;">
                
                <!-- Step 1: Project Name -->
                <div class="startup-step">
                    <h3 style="color: var(--color-accent-blue); margin-bottom: 10px;">
                        Project Name
                    </h3>
                    <input type="text" id="startupProjectName" 
                           placeholder="Enter project name or leave blank for random..."
                           value="${defaultName}"
                           style="width: 100%; padding: 10px; font-size: 1em; background: var(--color-bg-primary); border: 1px solid var(--color-border); border-radius: var(--radius-md); color: var(--color-text-primary);">
                    <small style="color: var(--color-text-secondary); display: block; margin-top: 5px;">
                        Leave blank for random name (e.g., Project_A3F2). Can afterwards be changed by clicking on name in the top-left corner.
                    </small>
                </div>
                
                <div style="height: 20px;"></div>
                
                <!-- Step 2: Working Folder -->
                <div class="startup-step">
                    <h3 style="color: var(--color-accent-blue); margin-bottom: 10px;">
                        Working Folder <span style="color: var(--color-text-secondary); font-size: 0.85em;">(Recommended!)</span>
                    </h3>
                    <p style="color: var(--color-text-secondary); font-size: 0.9em; margin-bottom: 10px;">
                        Where your SFZ and WAV samples are stored. Used for auto-loading samples when importing presets. When this folder is not set, there is a bigger chance you need to manually search for missing assets.
                    </p>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <button class="btn btn-primary ${shouldBlinkWorking ? 'blink-warning' : ''}" id="selectWorkingFolderBtn" style="flex: 0 0 auto;">
                            📁 Select Working Folder
                        </button>
                        <span id="workingFolderStatus" style="color: var(--color-text-secondary); flex: 1;">
                            ${workingFolderStatus}
                        </span>
                    </div>
                </div>
                
                <div style="height: 20px;"></div>
                
                <!-- Step 3: FX Presets Folder -->
                <div class="startup-step">
                    <h3 style="color: var(--color-accent-blue); margin-bottom: 10px;">
                        FX Presets Folder <span style="color: var(--color-text-secondary); font-size: 0.85em;">(Optional)</span>
                    </h3>
                    <p style="color: var(--color-text-secondary); font-size: 0.9em; margin-bottom: 10px;">
                        Folder containing custom FX presets (delay/, reverb/, eq/, sets/ subfolders with JSON files).
                    </p>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <button class="btn btn-primary ${shouldBlinkFX ? 'blink-warning' : ''}" id="selectFXPresetsBtn" style="flex: 0 0 auto;">
                            📁 Select FX Presets Folder
                        </button>
                        <span id="fxPresetsStatus" style="color: var(--color-text-secondary); flex: 1;">
                            ${fxPresetsStatus}
                        </span>
                    </div>
                </div>
                
                <div style="height: 30px;"></div>
                
                <!-- Start Button -->
                <button class="btn btn-primary" id="startWorkingBtn" 
                        style="width: 100%; padding: 15px; font-size: 1.1em;">
                    ✓ Start Working
                </button>
                
                <p style="color: var(--color-text-secondary); font-size: 0.85em; margin-top: 15px; text-align: center;">
                    You can change folders later from the main menu
                </p>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Setup event listeners
    setupStartupModalListeners(modal);
}

/**
 * Sets up event listeners for startup modal
 */
function setupStartupModalListeners(modal) {
    const projectNameInput = document.getElementById('startupProjectName');
    const workingFolderBtn = document.getElementById('selectWorkingFolderBtn');
    const fxPresetsBtn = document.getElementById('selectFXPresetsBtn');
    const startBtn = document.getElementById('startWorkingBtn');
    
    const workingFolderStatus = document.getElementById('workingFolderStatus');
    const fxPresetsStatus = document.getElementById('fxPresetsStatus');
    
    // Working folder selection
    workingFolderBtn.addEventListener('click', async () => {
        if (!window.showDirectoryPicker) {
            alert('Folder access not supported in this browser. Use Chrome or Edge.');
            return;
        }
        
        try {
            const dirHandle = await window.showDirectoryPicker({
                mode: 'read',
                startIn: 'documents'
            });
            
            // Store handle
            await storeFolderHandle('workingFolder', dirHandle);
            window.BitboxerData.workingFolderHandle = dirHandle;
            
            workingFolderStatus.textContent = `✓ ${dirHandle.name}`;
            workingFolderStatus.style.color = 'var(--color-accent-green)';
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Working folder error:', error);
                workingFolderStatus.textContent = '⚠️ Selection failed';
            }
        }
    });
    
    // FX presets folder selection
    fxPresetsBtn.addEventListener('click', async () => {
        if (!window.showDirectoryPicker) {
            alert('Folder access not supported in this browser. Use Chrome or Edge.');
            return;
        }
        
        try {
            const dirHandle = await window.showDirectoryPicker({
                mode: 'read',
                startIn: 'documents'
            });
            
            // Store handle
            await storeFolderHandle('fxPresets', dirHandle);
            window.BitboxerData.fxPresetsFolderHandle = dirHandle;
            
            // Scan presets
            await window.BitboxerFXPresetsExternal.scanPresetsFolder(dirHandle);
            window.BitboxerFXPresetsExternal.refreshAllPresetDropdowns();
            
            const totalPresets = window.BitboxerFXPresetsExternal.externalPresets.delay.length +
                                window.BitboxerFXPresetsExternal.externalPresets.reverb.length +
                                window.BitboxerFXPresetsExternal.externalPresets.eq.length +
                                window.BitboxerFXPresetsExternal.externalPresets.sets.length;
            
            fxPresetsStatus.textContent = `✓ ${dirHandle.name} (${totalPresets} presets)`;
            fxPresetsStatus.style.color = 'var(--color-accent-green)';
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('FX presets folder error:', error);
                fxPresetsStatus.textContent = '⚠️ Selection failed';
            }
        }
    });
    
    // Start working button
    startBtn.addEventListener('click', () => {
        const projectName = projectNameInput.value.trim();
        
        if (projectName) {
            window.BitboxerData.projectName = projectName;
            // Don't save to localStorage anymore - we want fresh random each time
        } else {
            // Always generate fresh random name
            window.BitboxerData.projectName = `Project_${window.BitboxerData.generateRandomHex()}`;
        }
        
        window.BitboxerData.updateProjectTitle();
        
        // Update working folder button if set
        const workingFolderBtn = document.getElementById('setWorkingFolderBtn');
            // workingFolderBtn.classList.add('blink-warning');
        if (workingFolderBtn && window.BitboxerData.workingFolderHandle) {
            workingFolderBtn.textContent = `📁 ${window.BitboxerData.workingFolderHandle.name}`;
            workingFolderBtn.classList.remove('blink-warning');
            workingFolderBtn.classList.add('active');
        }
        
        

        // Close modal
        document.body.removeChild(modal);
        
        // Show success message
        const statusParts = [];
        if (window.BitboxerData.workingFolderHandle) {
            statusParts.push('working folder set');
        }
        if (window.BitboxerData.fxPresetsFolderHandle) {
            const total = window.BitboxerFXPresetsExternal.externalPresets.delay.length +
                         window.BitboxerFXPresetsExternal.externalPresets.reverb.length +
                         window.BitboxerFXPresetsExternal.externalPresets.eq.length +
                         window.BitboxerFXPresetsExternal.externalPresets.sets.length;
            statusParts.push(`${total} FX presets loaded`);
        }
        
        const statusMsg = statusParts.length > 0 
            ? `Project ready: ${statusParts.join(', ')}` 
            : 'Project ready';
        
        window.BitboxerUtils.setStatus(statusMsg, 'success');
    });
}

/**
 * Shows option to reopen startup modal from menu
 */
function showStartupModalButton() {
    const btn = document.getElementById('setWorkingFolderBtn');
    if (btn) {
        // Rename to "Project Setup"
        btn.textContent = '⚙️ Project Setup';
        btn.onclick = showStartupModal;
    }
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize startup modal system
 * Call this in initializeApp() BEFORE creating preset
 */
async function initStartupModal() {
    // Always show modal on startup (user can skip folders)
    await showStartupModal();
}

// ============================================
// EXPORT
// ============================================
window.BitboxerStartup = {
    initStartupModal,
    showStartupModal,
    storeFolderHandle,
    retrieveFolderHandle,
    verifyFolderAccess
};