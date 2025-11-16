/**
 * BITBOXER - Utility Functions
 * 
 * This file contains helper functions for:
 * - Value formatting and parsing
 * - Validation
 * - Status messages
 * - Data manipulation
 */

// ============================================
// PARAMETER DISPLAY FORMATTING
// ============================================
/**
 * Formats a parameter value for display in the UI
 * Converts internal values (0-1000, -96000, etc.) to human-readable strings
 * 
 * @param {string} param - Parameter name (e.g., 'gaindb', 'pitch', 'panpos')
 * @param {string|number} value - Internal parameter value
 * @returns {string} Formatted display string (e.g., "+3.5 dB", "Center", "50.0%")
 */
function updateParamDisplay(param, value) {
    const display = document.getElementById(param + '-val');
    if (!display) return;

    const val = parseFloat(value);
    let text = '';

    switch (param) {
        case 'gaindb':
            // Gain in dB: -96dB to +12dB (stored as millidecibels)
            text = (val >= 0 ? '+' : '') + (val / 1000).toFixed(1) + ' dB';
            break;
            
        case 'pitch':
            // Pitch in semitones: -24 to +24 (stored as millisemitones)
            text = (val >= 0 ? '+' : '') + (val / 1000).toFixed(2) + ' st';
            break;
            
        case 'panpos':
            // Pan position: -100% (left) to +100% (right)
            if (val === 0) {
                text = 'Center';
            } else if (val < 0) {
                text = 'L ' + Math.abs(val / 10).toFixed(1) + '%';
            } else {
                text = 'R ' + (val / 10).toFixed(1) + '%';
            }
            break;
            
        case 'lforate':
            // LFO Rate: Map 0-1000 to 0.1-12 Hz
            const minHz = 0.1;
            const maxHz = 12;
            const normalizedVal = val / 1000;
            const hz = minHz + (normalizedVal * (maxHz - minHz));
            text = hz.toFixed(2) + ' Hz';
            break;
            
        case 'beatcount':
            // Beat Count: 0=Auto, 1-512=specific count
            text = (val === 0) ? 'Auto' : val.toString();
            break;

        case 'actslice':
            // Active Slice: 1-512 (integer)
            text = val.toString();
            break;

        case 'samstart':
        case 'samlen':
        case 'loopstart':
        case 'loopend':
            // Sample positions: display as sample count with comma separators
            text = parseInt(val).toLocaleString() + ' samples';
            break;
            
        default:
            // Default: percentage (0-100%)
            text = (val / 10).toFixed(1) + '%';
    }
    
    display.textContent = text;
}

/**
 * Parses a user-entered display value back to internal format
 * Handles various formats: dB, semitones, percentages, sample counts
 * 
 * @param {string} param - Parameter name
 * @param {string} text - User-entered text
 * @returns {number|null} Internal value or null if invalid
 */
function parseDisplayValue(param, text) {
    // Clean the input: remove everything except digits, minus, and decimal point
    text = text.trim().replace(/[^\d.-]/g, '');
    const val = parseFloat(text);
    
    if (isNaN(val)) return null;

    switch (param) {
        case 'gaindb':
        case 'pitch':
            // dB and semitones are stored as 1000x the displayed value
            return Math.round(val * 1000);
            
        case 'panpos':
        case 'dualfilcutoff':
        case 'res':
        case 'envattack':
        case 'envdecay':
        case 'envsus':
        case 'envrel':
            // Percentages are stored as 10x the displayed value
            return Math.round(val * 10);
            
        case 'lforate':
            // LFO Rate: User types Hz, convert back to 0-1000
            const hz = parseFloat(text);
            if (isNaN(hz) || hz < 0.1 || hz > 12) return null;
            return Math.round(((hz - 0.1) / 11.9) * 1000);
            
        case 'samstart':
        case 'samlen':
        case 'loopstart':
        case 'loopend':
            // Sample positions: parse integer, remove commas and "samples" text
            const cleaned = text.replace(/[,\s]/g, '').replace(/samples?/i, '');
            const num = parseInt(cleaned, 10);
            if (isNaN(num) || num < 0 || num > 4294967295) return null;
            return num;
            
        case 'beatcount':
            // Beat Count: "Auto" = 0, otherwise 1-512
            const trimmed = text.trim();
            if (trimmed.toLowerCase() === 'auto') return 0;
            const num2 = parseInt(trimmed, 10);
            if (isNaN(num2) || num2 < 0 || num2 > 512) return null;
            return num2;
        
        case 'actslice':
            // Active Slice: 1-512 (integer)
            const sliceNum = parseInt(text, 10);
            if (isNaN(sliceNum) || sliceNum < 1 || sliceNum > 512) return null;
            return sliceNum;    

        default:
            return Math.round(val);
    }
}

/**
 * Formats FX parameter values for display
 * 
 * @param {string} param - FX parameter name
 * @param {string|number} value - Internal parameter value
 */
function updateFxParamDisplay(param, value) {
    const display = document.getElementById('fx-' + param + '-val');
    if (!display) return;

    const val = parseFloat(value);
    let text = '';

    // Handle EQ gain (dB)
    if (param.startsWith('eqgain')) {
        text = (val >= 0 ? '+' : '') + (val / 1000).toFixed(1) + ' dB';
    } else {
        // Handle percentages
        text = (val / 10).toFixed(1) + '%';
    }

    display.textContent = text;
}

// ============================================
// VALIDATION FUNCTIONS
// ============================================
/**
 * Validates modulation destination to prevent exceeding 3 mods per destination
 * 
 * @param {string} destValue - Destination parameter name
 * @param {number} currentSlotIndex - Index of current slot being edited
 * @returns {Object} Validation result with valid flag and count info
 */
function validateModDestination(destValue, currentSlotIndex) {
    const { currentEditingPad, presetData } = window.BitboxerData;
    
    if (!currentEditingPad || !presetData) {
        return { valid: true, count: 0 };
    }

    const row = parseInt(currentEditingPad.dataset.row);
    const col = parseInt(currentEditingPad.dataset.col);
    const padData = presetData.pads[row][col];

    if (!padData.modsources) {
        return { valid: true, count: 0 };
    }

    // Count how many slots already target this destination (excluding current slot)
    const count = padData.modsources.filter((mod, index) =>
        mod.dest === destValue && index !== currentSlotIndex
    ).length;

    return {
        valid: count < 3,
        count: count,
        remaining: 3 - count
    };
}

/**
 * Validates FX modulation destination
 * 
 * @param {string} fxType - FX type ('delay', 'reverb')
 * @param {string} destValue - Destination parameter name
 * @param {number} currentSlotIndex - Index of current slot being edited
 * @returns {Object} Validation result
 */
function validateFxModDestination(fxType, destValue, currentSlotIndex) {
    const { presetData } = window.BitboxerData;
    
    if (!presetData.fx || !presetData.fx[fxType]) {
        return { valid: true, count: 0 };
    }

    const modsources = presetData.fx[fxType].modsources || [];

    // Count how many slots already target this destination (excluding current slot)
    const count = modsources.filter((mod, index) =>
        mod.dest === destValue && index !== currentSlotIndex
    ).length;

    return {
        valid: count < 3,
        count: count,
        remaining: 3 - count
    };
}

// ============================================
// STATUS BAR MANAGEMENT
// ============================================
/**
 * Sets a status message in the appropriate status bar
 * Automatically detects which modal is open and targets the correct status bar
 * Auto-clears success/error messages after 5 seconds
 * 
 * @param {string} message - Message to display
 * @param {string} type - Message type: '' (default), 'success', or 'error'
 */
function setStatus(message, type = '') {
    let statusBar;

    // Check if edit modal is open
    const editModal = document.getElementById('editModal');
    if (editModal && editModal.classList.contains('show')) {
        statusBar = document.getElementById('editModalStatusBar');
    }

    // Check if FX modal is open
    const fxModal = document.getElementById('fxModal');
    if (fxModal && fxModal.classList.contains('show')) {
        statusBar = document.getElementById('fxModalStatusBar');
    }

    // Fallback to main status bar
    if (!statusBar) {
        statusBar = document.getElementById('statusBar');
    }

    if (statusBar) {
        statusBar.textContent = message;
        statusBar.className = 'status-bar ' + type;

        // Auto-clear after 5 seconds for success/error messages
        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                if (statusBar.textContent === message) {
                    statusBar.textContent = '';
                    statusBar.className = 'status-bar';
                }
            }, window.BITBOXER_CONFIG.STATUS_AUTO_CLEAR_MS);
        }
    }
}

// ============================================
// DATA MANIPULATION
// ============================================
/**
 * Deep clones an object to prevent reference issues
 * 
 * @param {Object} obj - Object to clone
 * @returns {Object} Deep clone of the object
 */
function cloneObject(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Merges two objects, with second object properties taking precedence
 * 
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
function mergeObjects(target, source) {
    const result = {};
    
    // Copy all properties from target
    for (const key in target) {
        result[key] = target[key];
    }
    
    // Override with source properties
    for (const key in source) {
        result[key] = source[key];
    }
    
    return result;
}

/**
 * Safely gets a nested property from an object
 * 
 * @param {Object} obj - Object to query
 * @param {string} path - Dot-separated path (e.g., 'pads.0.1.params.gaindb')
 * @param {*} defaultValue - Default value if path doesn't exist
 * @returns {*} Value at path or default value
 */
function getNestedProperty(obj, path, defaultValue = null) {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
            current = current[key];
        } else {
            return defaultValue;
        }
    }
    
    return current;
}

// ============================================
// ARRAY UTILITIES
// ============================================
/**
 * Removes an item from an array by index
 * 
 * @param {Array} array - Array to modify
 * @param {number} index - Index to remove
 * @returns {Array} Modified array
 */
function removeArrayItem(array, index) {
    return array.filter((_, i) => i !== index);
}

/**
 * Moves an item in an array from one index to another
 * 
 * @param {Array} array - Array to modify
 * @param {number} fromIndex - Source index
 * @param {number} toIndex - Destination index
 * @returns {Array} Modified array
 */
function moveArrayItem(array, fromIndex, toIndex) {
    const item = array[fromIndex];
    const newArray = [...array];
    newArray.splice(fromIndex, 1);
    newArray.splice(toIndex, 0, item);
    return newArray;
}

// ============================================
// STRING UTILITIES
// ============================================
/**
 * Truncates a string to a maximum length with ellipsis
 * 
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated string
 */
function truncateString(str, maxLength) {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
}

/**
 * Capitalizes first letter of a string
 * 
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================
// EXPORT UTILITIES
// ============================================
window.BitboxerUtils = {
    // Parameter formatting
    updateParamDisplay,
    parseDisplayValue,
    updateFxParamDisplay,
    
    // Validation
    validateModDestination,
    validateFxModDestination,
    
    // Status messages
    setStatus,
    
    // Data manipulation
    cloneObject,
    mergeObjects,
    getNestedProperty,
    
    // Array utilities
    removeArrayItem,
    moveArrayItem,
    
    // String utilities
    truncateString,
    capitalize
};
