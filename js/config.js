/**
 * BITBOXER - Configuration & Constants
 * 
 * This file contains all configuration values, modulation sources/destinations,
 * and other constants used throughout the application.
 */

// ============================================
// MODULATION SOURCES
// ============================================
/**
 * Available modulation sources for pad and FX modulation
 * These can modulate various parameters in the Bitbox
 */
const MOD_SOURCES = [
    { value: 'none', label: '--- None ---' },
    { value: 'mod1', label: 'Mod 1' },
    { value: 'mod2', label: 'Mod 2' },
    { value: 'mod3', label: 'Mod 3' },
    { value: 'mod4', label: 'Mod 4' },
    { value: 'mod5', label: 'Mod 5' },
    { value: 'mod6', label: 'Mod 6' },
    { value: 'mod7', label: 'Mod 7' },
    { value: 'mod8', label: 'Mod 8' },
    { value: 'keytrig', label: 'Key Trigger' },
    { value: 'velocity', label: 'Velocity' },
    { value: 'lfo1', label: 'LFO' },
    { value: 'pitchbend', label: 'Pitch Bend' },
    { value: 'modwheel', label: 'Mod Wheel' },
    { value: 'midivol', label: 'MIDI Volume' },
    { value: 'midipan', label: 'MIDI Pan' },
    { value: 'midicc', label: 'MIDI CC' }
];

// ============================================
// MODULATION DESTINATIONS (BY CELL MODE)
// ============================================
/**
 * Available modulation destinations, organized by cell mode
 * Each mode has different available parameters
 * 
 * Cell Modes:
 * 0 = Sample
 * 1 = Clip
 * 2 = Slicer
 * 3 = Granular
 */
const MOD_DESTINATIONS = {
    // Sample Mode (0)
    '0': [
        { value: 'none', label: '--- None ---' },
        { group: 'Main', value: 'gaindb', label: 'Level' },
        { group: 'Main', value: 'pitch', label: 'Pitch' },
        { group: 'Main', value: 'dualfilcutoff', label: 'Filter' },
        { group: 'Main', value: 'res', label: 'Resonance' },
        { group: 'Main', value: 'panpos', label: 'Pan' },
        { group: 'Env', value: 'envattack', label: 'Attack' },
        { group: 'Env', value: 'envdecay', label: 'Decay' },
        { group: 'Env', value: 'envrel', label: 'Release' },
        { group: 'Pos', value: 'samstart', label: 'Start' },
        { group: 'Pos', value: 'samlen', label: 'Length' },
        { group: 'Pos', value: 'loopstart', label: 'Loop Start' },
        { group: 'Pos', value: 'loopend', label: 'Loop End' },
        { group: 'LFO', value: 'lforate', label: 'LFO Rate' },
        { group: 'LFO', value: 'lfoamount', label: 'LFO Depth' }
    ],
    
    // Clip Mode (1)
    '1': [
        { value: 'none', label: '--- None ---' },
        { group: 'Main', value: 'gaindb', label: 'Level' },
        { group: 'Main', value: 'pitch', label: 'Pitch' },
        { group: 'Main', value: 'dualfilcutoff', label: 'Filter' },
        { group: 'Main', value: 'res', label: 'Resonance' },
        { group: 'Main', value: 'panpos', label: 'Pan' },
        { group: 'Env', value: 'envattack', label: 'Attack' },
        { group: 'Env', value: 'envdecay', label: 'Decay' },
        { group: 'Env', value: 'envrel', label: 'Release' },
        { group: 'LFO', value: 'lforate', label: 'LFO Rate' },
        { group: 'LFO', value: 'lfoamount', label: 'LFO Depth' }
    ],
    
    // Slicer Mode (2)
    '2': [
        { value: 'none', label: '--- None ---' },
        { group: 'Main', value: 'gaindb', label: 'Level' },
        { group: 'Main', value: 'pitch', label: 'Pitch' },
        { group: 'Main', value: 'dualfilcutoff', label: 'Filter' },
        { group: 'Main', value: 'res', label: 'Resonance' },
        { group: 'Main', value: 'panpos', label: 'Pan' },
        { group: 'Env', value: 'envattack', label: 'Attack' },
        { group: 'Env', value: 'envdecay', label: 'Decay' },
        { group: 'Env', value: 'envrel', label: 'Release' },
        { group: 'Pos', value: 'actslice', label: 'Active Slice' },
        { group: 'Pos', value: 'slicestepmode', label: 'Slice Seq' },
        { group: 'LFO', value: 'lforate', label: 'LFO Rate' },
        { group: 'LFO', value: 'lfoamount', label: 'LFO Depth' }
    ],
    
    // Granular Mode (3)
    '3': [
        { value: 'none', label: '--- None ---' },
        { group: 'Main', value: 'gaindb', label: 'Level' },
        { group: 'Main', value: 'pitch', label: 'Pitch' },
        { group: 'Main', value: 'dualfilcutoff', label: 'Filter' },
        { group: 'Main', value: 'res', label: 'Resonance' },
        { group: 'Main', value: 'panpos', label: 'Pan' },
        { group: 'Env', value: 'envattack', label: 'Attack' },
        { group: 'Env', value: 'envdecay', label: 'Decay' },
        { group: 'Env', value: 'envrel', label: 'Release' },
        { group: 'Pos', value: 'samstart', label: 'Start' },
        { group: 'Pos', value: 'samlen', label: 'Length' },
        { group: 'Pos', value: 'loopstart', label: 'Loop Start' },
        { group: 'Pos', value: 'loopend', label: 'Loop End' },
        { group: 'LFO', value: 'lforate', label: 'LFO Rate' },
        { group: 'LFO', value: 'lfoamount', label: 'LFO Depth' },
        { group: 'Gran', value: 'grainreadspeed', label: 'Grain Speed' }
    ]
};

// ============================================
// FX MODULATION DESTINATIONS
// ============================================
/**
 * Available modulation destinations for FX parameters
 */
const FX_MOD_DESTINATIONS = {
    delay: [
        { value: 'none', label: '--- None ---' },
        { value: 'delaymustime', label: 'Delay Time' },
        { value: 'feedback', label: 'Feedback' },
        { value: 'cutoff', label: 'Cutoff' }
    ],
    reverb: [
        { value: 'none', label: '--- None ---' },
        { value: 'decay', label: 'Decay' },
        { value: 'predelay', label: 'Pre-delay' },
        { value: 'damping', label: 'Damping' }
    ]
};

// ============================================
// CELL MODE NAMES
// ============================================
/**
 * Human-readable names for cell modes
 */
const CELL_MODE_NAMES = {
    '0': 'Sample',
    '1': 'Clip',
    '2': 'Slice',
    '3': 'Granular'
};

// ============================================
// UI CONFIGURATION
// ============================================
/**
 * Opacity value for greyed-out/disabled UI elements
 */
const GREY_VALUE = '0.5';

/**
 * Maximum number of modulation slots per pad
 */
const MAX_MOD_SLOTS_PAD = 12;

/**
 * Maximum number of modulation slots per FX
 */
const MAX_MOD_SLOTS_FX = 9;

/**
 * Maximum modulations per destination
 */
const MAX_MOD_PER_DESTINATION = 3;

/**
 * Status message auto-clear timeout (milliseconds)
 */
const STATUS_AUTO_CLEAR_MS = 20000;

// ============================================
// EXPORT CONFIGURATION
// ============================================
// Make all config available globally or as exports
window.BITBOXER_CONFIG = {
    MOD_SOURCES,
    MOD_DESTINATIONS,
    FX_MOD_DESTINATIONS,
    CELL_MODE_NAMES,
    GREY_VALUE,
    MAX_MOD_SLOTS_PAD,
    MAX_MOD_SLOTS_FX,
    MAX_MOD_PER_DESTINATION,
    STATUS_AUTO_CLEAR_MS
};
