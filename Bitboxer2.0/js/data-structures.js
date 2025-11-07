/**
 * BITBOXER - Data Structures & Models
 * 
 * This file contains all data structure definitions and factory functions
 * for creating empty/default presets, pads, and FX.
 */

// ============================================
// GLOBAL STATE VARIABLES
// ============================================
/**
 * Current device mode: 'micro' or 'mk2'
 * Bitbox Micro only has 8 pads (2 rows), mk2 has 16 pads (4 rows)
 */
let currentMode = 'micro';

/**
 * Main preset data structure
 * Contains all pads, FX settings, and project metadata
 */
let presetData = null;

/**
 * Currently selected pad elements (Set of pad numbers)
 */
let selectedPads = new Set();

/**
 * Clipboard for copy/paste operations
 */
let clipboard = null;

/**
 * Currently dragged pad element (for drag & drop)
 */
let draggedPad = null;

/**
 * Currently editing pad element (in modal)
 */
let currentEditingPad = null;

/**
 * Asset cells array (for multi-sample references)
 * These are additional sample references that can be triggered
 */
let assetCells = [];

/**
 * Current project name
 */
let projectName = '';

// ============================================
// PAD DATA STRUCTURE
// ============================================
/**
 * Creates an empty pad data structure with default values
 * 
 * @returns {Object} Empty pad data object
 */
function createEmptyPadData() {
    return {
        filename: '',
        type: 'samtempl',
        params: {
            // Main Parameters
            gaindb: '0',              // Level: -96dB to +12dB (stored as millidecibels)
            pitch: '0',               // Pitch: -24 to +24 semitones (stored as millisemitones)
            panpos: '0',              // Pan: -100% (left) to +100% (right)
            samtrigtype: '0',         // Launch Mode: 0=Gate, 1=Trigger, 2=Toggle
            loopmode: '0',            // Loop Mode: 0=Off, 1=On
            loopmodes: '1',           // Loop Modes: 0=Off, 1=Forward, 2=Bidirectional
            midimode: '0',            // MIDI Channel: 0=None, 1-16=Ch 1-16
            reverse: '0',             // Reverse: 0=Off, 1=On
            cellmode: '0',            // Cell Mode: 0=Sample, 1=Clip, 2=Slicer, 3=Granular
            
            // Envelope Parameters
            envattack: '0',           // Attack: 0-100%
            envdecay: '0',            // Decay: 0-100%
            envsus: '1000',           // Sustain: 0-100%
            envrel: '200',            // Release: 0-100%
            
            // Position Parameters
            samstart: '0',            // Sample Start: 0 to max samples
            samlen: '0',              // Sample Length: 0 to max samples
            loopstart: '0',           // Loop Start: 0 to max samples
            loopend: '0',             // Loop End: 0 to max samples
            loopfadeamt: '0',         // Loop Fade Amount: 0-100%
            
            // Clip Mode Parameters
            quantsize: '3',           // Quant Size: 0-10 (8 bars to None)
            synctype: '5',            // Sync Type: 0-6 (Slice to None)
            beatcount: '0',           // Beat Count: 0=Auto, 1-512=specific count
            
            // Slicer Mode Parameters
            actslice: '1',            // Active Slice: 1-512
            slicemode: '0',           // Slice Mode: 0=Off, 1=On
            slicestepmode: '0',       // Slice Seq: 0=None, 1=Forward, 2=Backwards, 3=Random, 4=Stagger
            playthru: '0',            // Play Thru: 0=Off, 1=On
            slicerquantsize: '13',    // Slicer Quantize: 0-13
            slicersync: '0',          // Slicer Sync: 0=Off, 1=On
            
            // Output & Routing
            outputbus: '0',           // Output Bus: 0-11
            polymode: '0',            // Poly Mode: 0=Mono, 1-5=Poly 2-X
            polymodeslice: '0',       // Poly Mode Slice (internal)
            chokegrp: '0',            // Exclusive Group: 0=Off, 1-4=A-D
            
            // Filter Parameters
            dualfilcutoff: '0',       // Filter Cutoff: -100% to +100%
            res: '500',               // Resonance: 0-100%
            
            // MIDI & Advanced
            rootnote: '0',            // Root Note: 0=Off, 1-128=MIDI notes
            padnote: '0',             // Pad Note (internal)
            
            // FX Sends
            fx1send: '0',             // FX1 Send: 0-100%
            fx2send: '0',             // FX2 Send: 0-100%
            
            // Multi-sample
            multisammode: '0',        // Multi-sample Mode: 0=Off, 1=On
            
            // Quality & Performance
            interpqual: '0',          // Interpolation Quality: 0=Normal, 1=High Quality
            legatomode: '0',          // Legato Mode: 0=Off, 1=On
            
            // LFO Parameters
            lfowave: '0',             // LFO Wave: 0-8 (Saw Up to Random)
            lforate: '100',           // LFO Rate: 0.1-12 Hz
            lfoamount: '1000',        // LFO Depth: 0-100%
            lfokeytrig: '0',          // LFO Key Trigger: 0=Off, 1=On
            lfobeatsync: '0',         // LFO Beat Sync: 0=Off, 1=On
            lforatebeatsync: '0',     // LFO Rate Beat Sync: 0-14 (8 bars to 1/64)
            
            // Granular Parameters
            graindensity: '600',      // Grain Density: 0-100%
            grainsizeperc: '300',     // Grain Size: 0-100%
            gainssrcwin: '0',         // Grain Source Window: 0-100%
            grainscat: '0',           // Grain Scatter: 0-100%
            grainpanrnd: '0',         // Grain Pan Random: 0-100%
            grainreadspeed: '1000',   // Grain Read Speed: 0-200%
            
            // Recording Parameters
            recinput: '0',            // Rec Input: 0-3
            recpresetlen: '0',        // Rec Preset Length
            recquant: '3',            // Rec Quantize
            recmonoutbus: '0',        // Mon Output: 0-11
            recusethres: '0',         // Rec Threshold Enable: 0=Off, 1=On
            recthresh: '-20000',      // Threshold: -96dB to 0dB
            
            // Template Flag
            deftemplate: '1'          // Default Template: 1=Yes
        },
        modsources: [],               // Modulation sources array
        slices: []                    // Slices array (for Slicer mode)
    };
}

// ============================================
// FX DATA STRUCTURE
// ============================================
/**
 * Creates an empty FX data structure with default values
 * 
 * @returns {Object} Empty FX data object with Delay, Reverb, and EQ
 */
function createEmptyFXData() {
    return {
        delay: {
            type: 'delay',
            params: {
                delay: '400',               // Delay Time (ms): 0-100%
                delaymustime: '6',          // Delay Time (sync): 0-11 (1/64 to 1 bar)
                feedback: '400',            // Feedback: 0-100%
                cutoff: '120',              // Cutoff: 0-100%
                filtquality: '1000',        // Filter Quality: 0-100%
                dealybeatsync: '1',         // Beat Sync: 0=Off, 1=On
                filtenable: '1',            // Filter Enable: 0=Off, 1=On
                delaypingpong: '1'          // Ping Pong: 0=Off, 1=On
            },
            modsources: []
        },
        reverb: {
            type: 'reverb',
            params: {
                decay: '600',               // Decay: 0-100%
                predelay: '40',             // Pre-delay: 0-100%
                damping: '500'              // Damping: 0-100%
            },
            modsources: []
        },
        eq: {
            type: 'eq',
            params: {
                // EQ Band 1
                eqactband: '0',             // Active Band (internal)
                eqgain: '0',                // Gain: -24dB to +24dB
                eqcutoff: '200',            // Frequency: 0-100%
                eqres: '400',               // Q/Width: 0-100%
                eqenable: '1',              // Enable: 0=Off, 1=On
                eqtype: '0',                // Type: 0=None, 1=Low Cut, 2=Low Shelf, 3=Parametric, 4=High Shelf, 5=High Cut
                
                // EQ Band 2
                eqgain2: '0',
                eqcutoff2: '400',
                eqres2: '400',
                eqenable2: '1',
                eqtype2: '0',
                
                // EQ Band 3
                eqgain3: '0',
                eqcutoff3: '600',
                eqres3: '400',
                eqenable3: '1',
                eqtype3: '0',
                
                // EQ Band 4
                eqgain4: '0',
                eqcutoff4: '800',
                eqres4: '400',
                eqenable4: '1',
                eqtype4: '0'
            },
            modsources: []
        }
    };
}

// ============================================
// PRESET DATA STRUCTURE
// ============================================
/**
 * Creates an empty preset structure with all pads and FX
 * Initializes a 4x4 grid of empty pads
 */
function createEmptyPreset() {
    window.BitboxerData.presetData = {
        version: '2',
        pads: {},
        tempo: '120',
        fx: createEmptyFXData()
    };

    window.BitboxerData.assetCells = [];

    // Create 4x4 grid of empty pads
    for (let row = 0; row < 4; row++) {
        window.BitboxerData.presetData.pads[row] = {};
        for (let col = 0; col < 4; col++) {
            // IMPORTANT: Call function fresh each time, don't reuse reference
            window.BitboxerData.presetData.pads[row][col] = createEmptyPadData();
        }
    }
    
    // Also update the quick reference
    presetData = window.BitboxerData.presetData;
    assetCells = window.BitboxerData.assetCells;
}

// ============================================
// PROJECT MANAGEMENT
// ============================================
/**
 * Generates a random 4-digit hexadecimal string
 * Used for random project names
 * 
 * @returns {string} Random hex string (e.g., "A3F2")
 */
function generateRandomHex() {
    return Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0').toUpperCase();
}

/**
 * Initializes or prompts for project name
 * If no name provided, generates random name
 */
function initializeProject() {
    const name = prompt('Enter project name (leave blank for random):', '');
    projectName = name.trim() || `Project_${generateRandomHex()}`;
    updateProjectTitle();
}

/**
 * Updates the page title with current project name
 */
function updateProjectTitle() {
    document.querySelector('h1').textContent = `BITBOXER - ${projectName}`;
}

// ============================================
// EXPORT DATA STRUCTURES
// ============================================
// Make structures available globally
window.BitboxerData = {
    // State
    currentMode,
    presetData,
    selectedPads,
    clipboard,
    draggedPad,
    currentEditingPad,
    assetCells,
    projectName,
    
    // Factory Functions
    createEmptyPadData,
    createEmptyFXData,
    createEmptyPreset,
    
    // Project Management
    generateRandomHex,
    initializeProject,
    updateProjectTitle
};
