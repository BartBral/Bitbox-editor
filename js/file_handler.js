/**
 * BITBOXER - File Handler
 * 
 * Modular file import system supporting:
 * - ZIP archives
 * - Direct file uploads (SFZ + WAV)
 * - Folder uploads 
 * 
 * Architecture:
 * 1. FileCollector - Gathers files from various sources
 * 2. FileProcessor - Processes collected files
 * 3. Parsers - Parse specific file types (WAV, SFZ)
 */

// ============================================
// FILE COLLECTION ABSTRACTION
// ============================================

/**
 * Base class for file collection strategies
 * All collection methods return the same structure
 */
class FileCollector {
    /**
     * Collects files and returns standardized structure
     * @returns {Promise<FileCollection>}
     */
    async collect() {
        throw new Error('collect() must be implemented by subclass');
    }
}

/**
 * Standardized file collection structure
 * @typedef {Object} FileCollection
 * @property {Map<string, File>} files - Map of path -> File object
 * @property {string} rootPath - Base path for the collection
 * @property {Object} metadata - Additional metadata about the collection
 */

// ============================================
// ZIP FILE COLLECTOR
// ============================================

class ZipFileCollector extends FileCollector {
    constructor(zipFile) {
        super();
        this.zipFile = zipFile;
    }

    

    async collect() {
        try {
            // Read ZIP as ArrayBuffer
            const zipData = await this.zipFile.arrayBuffer();

            // Unzip using fflate
            const unzipped = fflate.unzipSync(new Uint8Array(zipData));

            // Convert to standardized FileCollection
            const files = new Map();

            for (const [path, data] of Object.entries(unzipped)) {
                // Skip directories and hidden files
                if (path.endsWith('/') || path.includes('__MACOSX')) continue;

                // Create File object from extracted data
                const blob = new Blob([data]);
                const fileName = path.split('/').pop();
                const file = new File([blob], fileName, {
                    type: this._getMimeType(fileName)
                });

                // Store with full path as key
                files.set(path, file);
            }

            return {
                files,
                rootPath: this._findRootPath(files),
                metadata: {
                    source: 'zip',
                    originalName: this.zipFile.name,
                    fileCount: files.size
                }
            };



        } catch (error) {
            throw new Error(`ZIP extraction failed: ${error.message}`);
        }
    }

    _getMimeType(fileName) {
        const ext = fileName.split('.').pop().toLowerCase();
        const mimeTypes = {
            'wav': 'audio/wav',
            'sfz': 'text/plain',
            'xml': 'text/xml',
            'txt': 'text/plain'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }

    _findRootPath(files) {
        // Find common root path
        const paths = Array.from(files.keys());
        if (paths.length === 0) return '';

        const firstPath = paths[0];
        const parts = firstPath.split('/');

        // If all files are in subdirectories, return first directory
        if (parts.length > 1 && paths.every(p => p.startsWith(parts[0]))) {
            return parts[0] + '/';
        }

        return '';
    }
}

// ============================================
// MULTI-FILE COLLECTOR
// ============================================

class MultiFileCollector extends FileCollector {
    constructor(fileList) {
        super();
        this.fileList = Array.from(fileList);
    }

    async collect() {
        const files = new Map();

        for (const file of this.fileList) {
            // Use filename as path (no directory structure)
            files.set(file.name, file);
        }

        return {
            files,
            rootPath: '',
            metadata: {
                source: 'multi-file',
                fileCount: files.size
            }
        };
    }
}

// ============================================
// FOLDER COLLECTOR (Future Implementation)
// ============================================

class FolderCollector extends FileCollector {
    constructor(directoryHandle) {
        super();
        this.directoryHandle = directoryHandle;
    }

    async collect() {
        // Check browser support
        if (!window.showDirectoryPicker) {
            throw new Error('Folder upload not supported in this browser');
        }

        const files = new Map();
        await this._readDirectory(this.directoryHandle, '', files);

        console.log('=== Folder Import ===');
        console.log('Files found:', files.size);
        console.log('File paths:');
        files.forEach((file, path) => {
            console.log(`  ${path} (${file.type})`);
        });

        return {
            files,
            rootPath: this.directoryHandle.name + '/',
            metadata: {
                source: 'folder',
                folderName: this.directoryHandle.name,
                fileCount: files.size
            }
        };

    }

    async _readDirectory(dirHandle, path, files) {
        for await (const entry of dirHandle.values()) {
            const entryPath = path + entry.name;

            if (entry.kind === 'file') {
                const file = await entry.getFile();
                files.set(entryPath, file);
            } else if (entry.kind === 'directory') {
                await this._readDirectory(entry, entryPath + '/', files);
            }
        }
    }
}

// ============================================
// FILE PROCESSOR
// ============================================

class FileProcessor {
    constructor(fileCollection) {
        this.fileCollection = fileCollection;
    }

    /**
     * Process the file collection and extract metadata
     * @returns {Promise<ProcessedFiles>}
     */
    async process() {
        const processed = {
            sfzFiles: [],
            wavFiles: [],
            xmlFiles: [],
            other: [],
            metadata: {}
        };

        for (const [path, file] of this.fileCollection.files) {
            const ext = file.name.split('.').pop().toLowerCase();

            if (ext === 'sfz') {
                const sfzData = await this._processSFZ(file, path);
                processed.sfzFiles.push(sfzData);
            } else if (ext === 'wav') {
                const wavData = await this._processWAV(file, path);
                processed.wavFiles.push(wavData);
            } else if (ext === 'xml') {
                processed.xmlFiles.push({ file, path });
            } else {
                processed.other.push({ file, path });
            }
        }

        // Map SFZ sample references to actual WAV files
        this._linkSFZSamples(processed);

        return processed;
    }

    async _processSFZ(file, path) {
        const text = await file.text();
        const parsed = SFZParser.parse(text);

        return {
            file,
            path,
            parsed,
            regions: parsed.regions,
            samplePaths: parsed.regions.map(r => r.sample).filter(Boolean)
        };
    }

    async _processWAV(file, path) {
        const arrayBuffer = await file.arrayBuffer();
        const metadata = WAVParser.parseMetadata(arrayBuffer);

        return {
            file,
            path,
            metadata,
            name: file.name
        };
    }

    _linkSFZSamples(processed) {
        for (const sfzData of processed.sfzFiles) {
            for (const region of sfzData.regions) {
                if (!region.sample) continue;

                // Find matching WAV file
                const wavFile = this._findWAVFile(region.sample, processed.wavFiles);

                if (wavFile) {
                    region.wavFile = wavFile;
                } else {
                    console.warn(`WAV file not found for sample: ${region.sample}`);
                }
            }
        }
    }

    _findWAVFile(samplePath, wavFiles) {
        // Normalize path separators
        const normalizedPath = samplePath.replace(/\\/g, '/');
        const sampleName = normalizedPath.split('/').pop().toLowerCase();

        console.log(`Looking for sample: "${samplePath}"`);
        console.log(`Normalized: "${normalizedPath}"`);
        console.log(`Filename only: "${sampleName}"`);

        // Try exact path match first
        let match = wavFiles.find(w => {
            const wavPath = w.path.toLowerCase().replace(/\\/g, '/');
            return wavPath === normalizedPath.toLowerCase() ||
                wavPath.endsWith('/' + normalizedPath.toLowerCase());
        });

        // Try filename-only match
        if (!match) {
            match = wavFiles.find(w => w.name.toLowerCase() === sampleName);
        }

        // Try even more flexible matching (remove extension differences)
        if (!match) {
            const baseNameWithoutExt = sampleName.replace(/\.(wav|WAV)$/, '').toLowerCase();
            match = wavFiles.find(w => {
                const wavNameWithoutExt = w.name.replace(/\.(wav|WAV)$/, '').toLowerCase();
                return wavNameWithoutExt === baseNameWithoutExt;
            });
        }

        if (match) {
            console.log(`✓ Found match: ${match.name}`);
        } else {
            console.log(`✗ No match found`);
        }

        return match;
    }
}

// ============================================
// SFZ PARSER
// ============================================

class SFZParser {
    static parse(sfzText) {
        console.log('=== Parsing SFZ ===');
        console.log('SFZ Content:', sfzText.substring(0, 500));

        const lines = sfzText.split('\n');
        const regions = [];
        let currentRegion = null;
        let globalOpcodes = {};
        let currentGroup = {};
        let defaultPath = '';
        let groupIndex = 0; // ← TRACK GROUP INDEX

        for (let line of lines) {
            line = line.split('//')[0].trim();
            if (!line) continue;

            // Handle <region> headers
            if (line.includes('<region>')) {
                if (currentRegion) {
                    if (defaultPath && currentRegion.sample) {
                        if (!currentRegion.sample.includes('/') && !currentRegion.sample.includes('\\')) {
                            currentRegion.sample = defaultPath + currentRegion.sample;
                        }
                    }
                    console.log('Finished region:', currentRegion);
                    regions.push(currentRegion);
                }

                // Start new region with group index
                currentRegion = {
                    ...globalOpcodes,
                    ...currentGroup,
                    groupIndex: groupIndex // ← ADD GROUP INDEX
                };

                line = line.substring(line.indexOf('<region>') + 8).trim();
                if (!line) continue;
            }

            // Handle <group> headers
            if (line.includes('<group>')) {
                // CRITICAL: Finalize previous region before starting new group
                if (currentRegion) {
                    if (defaultPath && currentRegion.sample) {
                        if (!currentRegion.sample.includes('/') && !currentRegion.sample.includes('\\')) {
                            currentRegion.sample = defaultPath + currentRegion.sample;
                        }
                    }
                    console.log('Finished region (before new group):', currentRegion);
                    regions.push(currentRegion);
                }

                currentRegion = null;
                groupIndex++;
                currentGroup = { ...globalOpcodes };

                line = line.substring(line.indexOf('<group>') + 7).trim();
                if (!line) continue;
            }

            // Handle <control> headers
            if (line.includes('<control>')) {
                currentRegion = null;
                currentGroup = {};

                line = line.substring(line.indexOf('<control>') + 9).trim();
                if (!line) continue;
            }

            // Handle <global> headers
            if (line.includes('<global>')) {
                currentRegion = null;
                currentGroup = {};

                line = line.substring(line.indexOf('<global>') + 8).trim();
                if (!line) continue;
            }

            if (!line) continue;

            const opcodes = this._parseOpcodes(line);

            if (opcodes.sample || opcodes.default_path) {
                console.log('Found important opcode:', opcodes);
            }

            // Special handling for default_path (control-level only)
            if (opcodes.default_path) {
                defaultPath = opcodes.default_path;
                if (!defaultPath.endsWith('/') && !defaultPath.endsWith('\\')) {
                    defaultPath += '/';
                }
                // Don't assign default_path to regions/groups - it's control-level
                delete opcodes.default_path;
            }

            // Assign opcodes to appropriate context
            if (currentRegion) {
                Object.assign(currentRegion, opcodes);
            } else if (Object.keys(currentGroup).length > 0) {
                Object.assign(currentGroup, opcodes);
            } else {
                Object.assign(globalOpcodes, opcodes);
            }
        }

        // Add last region
        if (currentRegion) {
            if (defaultPath && currentRegion.sample) {
                if (!currentRegion.sample.includes('/') && !currentRegion.sample.includes('\\')) {
                    currentRegion.sample = defaultPath + currentRegion.sample;
                }
            }
            console.log('Finished last region:', currentRegion);
            regions.push(currentRegion);
        }

        // Convert note names to MIDI numbers
        regions.forEach(region => {
            if (region.key) region.key = NoteNameParser.toMidiNumber(region.key);
            if (region.lokey) region.lokey = NoteNameParser.toMidiNumber(region.lokey);
            if (region.hikey) region.hikey = NoteNameParser.toMidiNumber(region.hikey);
            if (region.pitch_keycenter) region.pitch_keycenter = NoteNameParser.toMidiNumber(region.pitch_keycenter);
        });

        console.log(`=== Total regions parsed: ${regions.length} ===`);
        console.log(`=== Total groups: ${groupIndex} ===`); // ← LOG GROUP COUNT
        if (regions.length > 0) {
            console.log('First region sample:', regions[0].sample);
            console.log('First region key range:', regions[0].lokey, '-', regions[0].hikey);
            console.log('First region group:', regions[0].groupIndex);
        }

        return {
            regions,
            global: globalOpcodes
        };
    }

    static _parseOpcodes(line) {
        const opcodes = {};
        const parts = line.trim().split(/\s+/);

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!part.includes('=')) continue;

            const equalIndex = part.indexOf('=');
            const key = part.substring(0, equalIndex);
            let value = part.substring(equalIndex + 1);

            if (!value && i + 1 < parts.length) {
                value = parts[i + 1];
                i++;
            }

            if ((key === 'sample' || key === 'default_path') && i + 1 < parts.length) {
                while (i + 1 < parts.length && !parts[i + 1].includes('=')) {
                    value += ' ' + parts[i + 1];
                    i++;
                }
            }

            opcodes[key] = value.trim();
        }

        return opcodes;
    }
}

// ============================================
// NOTE NAME PARSER
// ============================================

class NoteNameParser {
    static noteNames = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];

    /**
     * Convert note name to MIDI number
     * Examples: "c3" -> 48, "f#4" -> 66, "a#2" -> 46
     */
    static toMidiNumber(noteName) {
        console.log('Converting note name:', noteName);

        if (!noteName) {
            console.log('  → null (empty)');
            return null;
        }

        if (typeof noteName !== 'string') {
            console.log('  → null (not a string)');
            return null;
        }

        // If already a number, return it
        if (!isNaN(noteName)) {
            const result = parseInt(noteName);
            console.log('  → already number:', result);
            return result;
        }

        noteName = noteName.toLowerCase().trim();

        // Parse note name (c, c#, d, etc.)
        let note = '';
        let i = 0;
        while (i < noteName.length && isNaN(noteName[i])) {
            note += noteName[i];
            i++;
        }

        // Parse octave
        const octave = parseInt(noteName.substring(i));
        if (isNaN(octave)) {
            console.log('  → null (invalid octave)');
            return null;
        }
    
        // Find note index
        const noteIndex = this.noteNames.indexOf(note);
        if (noteIndex === -1) {
            console.log('  → null (note not found), using 0');
            return 0;
        }

        // Calculate MIDI number: 
        const midiNum = (octave + 2) * 12 + noteIndex;
        console.log(`  → ${noteName} = ${midiNum}`);
        return midiNum;
    }
}



/**
 * Converts SFZ to single pad (with advanced layer detection)
 * Handles stacked layers vs velocity layers
 * 
 * @param {Object} sfzData - Parsed SFZ data
 * @param {Array} wavFiles - Array of WAV file data
 * @param {HTMLElement} targetPad - Target pad element
 */
async function convertSFZToPad(sfzData, wavFiles, targetPad) {
    const row = parseInt(targetPad.dataset.row);
    const col = parseInt(targetPad.dataset.col);
    const { presetData } = window.BitboxerData;

    const validRegions = sfzData.regions.filter(r => r.wavFile);

    if (validRegions.length === 0) {
        window.BitboxerUtils.setStatus('No valid samples in SFZ', 'error');
        return;
    }

    // Use advanced layer analysis
    const analysis = window.BitboxerFileHandler.analyzeSFZLayersAdvanced(validRegions);

    // Single layer - load directly
    if (!analysis.hasMultipleLayers) {
        const layer = analysis.layers[0];

        // FIXED: Pass totalLayers count and sfzName
        window.BitboxerFileHandler.loadLayerToPad(
            layer,
            row,
            col,
            '1',                    // Default MIDI channel
            sfzData.file.name,      // SFZ filename
            analysis.totalLayers    // Total layer count (1 in this case)
        );

        window.BitboxerUI.updatePadDisplay();
        window.BitboxerUtils.setStatus(
            layer.needsMerge
                ? `Imported ${layer.velocityZones} zones (merged to 16)`
                : `Imported ${layer.velocityZones} velocity zone(s)`,
            'success'
        );
        return;
    }

    // Multiple layers - prompt user
    window.BitboxerUtils.setStatus('Multiple layers detected...', 'info');
    const result = await window.BitboxerFileHandler.promptLayerMappingAdvanced(
        analysis.layers,
        targetPad
    );

    if (result.cancelled) {
        window.BitboxerUtils.setStatus('Import cancelled', 'info');
        return;
    }

    // Load each layer to selected pad
    result.mappings.forEach(mapping => {
        // FIXED: Pass totalLayers count and sfzName
        window.BitboxerFileHandler.loadLayerToPad(
            mapping.layer,
            mapping.row,
            mapping.col,
            result.midiChannel,       // Shared MIDI channel
            sfzData.file.name,        // SFZ filename
            result.mappings.length    // Total layers being imported
        );
    });

    window.BitboxerUI.updatePadDisplay();
    window.BitboxerUtils.setStatus(
        `Imported ${result.mappings.length} layer(s) to ${result.mappings.length} pad(s)`,
        'success'
    );
}

// ============================================
// WAV PARSER
// ============================================

class WAVParser {
    static parseMetadata(arrayBuffer) {
        const view = new DataView(arrayBuffer);
        const metadata = {
            sampleRate: 0,
            bitDepth: 0,
            channels: 0,
            duration: 0,
            loopPoints: null,
            tempo: null,
            slices: [],
            acid: null
        };

        try {
            // Verify RIFF header
            const riff = this._readString(view, 0, 4);
            if (riff !== 'RIFF') return metadata;

            const wave = this._readString(view, 8, 4);
            if (wave !== 'WAVE') return metadata;

            // Parse chunks
            let offset = 12;
            while (offset < view.byteLength - 8) {
                const chunkId = this._readString(view, offset, 4);
                const chunkSize = view.getUint32(offset + 4, true);
                offset += 8;

                if (chunkId === 'fmt ') {
                    this._parseFmtChunk(view, offset, metadata);
                } else if (chunkId === 'smpl') {
                    this._parseSmplChunk(view, offset, chunkSize, metadata);
                } else if (chunkId === 'cue ') {
                    this._parseCueChunk(view, offset, chunkSize, metadata);
                } else if (chunkId === 'acid') {
                    this._parseAcidChunk(view, offset, metadata);
                } else if (chunkId === 'data') {
                    // Calculate duration
                    if (metadata.sampleRate > 0) {
                        const sampleCount = chunkSize / (metadata.bitDepth / 8) / metadata.channels;
                        metadata.duration = sampleCount / metadata.sampleRate;
                    }
                }

                offset += chunkSize;
                // Align to even byte boundary
                if (chunkSize % 2 !== 0) offset++;
            }
        } catch (error) {
            console.error('WAV parsing error:', error);
        }

        return metadata;
    }

    static _parseFmtChunk(view, offset, metadata) {
        metadata.channels = view.getUint16(offset + 2, true);
        metadata.sampleRate = view.getUint32(offset + 4, true);
        metadata.bitDepth = view.getUint16(offset + 14, true);
    }

    static _parseSmplChunk(view, offset, chunkSize, metadata) {
        // Read sample loops
        const numLoops = view.getUint32(offset + 28, true);

        if (numLoops > 0) {
            const loopOffset = offset + 36;
            metadata.loopPoints = {
                start: view.getUint32(loopOffset + 8, true),
                end: view.getUint32(loopOffset + 12, true),
                type: view.getUint32(loopOffset + 4, true) // 0=forward, 1=pingpong
            };
        }
    }

    static _parseCueChunk(view, offset, chunkSize, metadata) {
        const numCuePoints = view.getUint32(offset, true);
        const slices = [];

        for (let i = 0; i < numCuePoints; i++) {
            const cueOffset = offset + 4 + (i * 24);
            const position = view.getUint32(cueOffset + 20, true);
            slices.push(position);
        }

        metadata.slices = slices.sort((a, b) => a - b);
    }

    static _parseAcidChunk(view, offset, metadata) {
        // ACID chunk contains tempo and key information
        metadata.acid = {
            tempo: view.getFloat32(offset + 12, true),
            key: view.getUint16(offset + 10, true),
            meterNumerator: view.getUint16(offset + 4, true),
            meterDenominator: view.getUint16(offset + 6, true)
        };

        metadata.tempo = metadata.acid.tempo;
    }

    static _readString(view, offset, length) {
        let str = '';
        for (let i = 0; i < length; i++) {
            str += String.fromCharCode(view.getUint8(offset + i));
        }
        return str;
    }
}

// ============================================
// MAIN FILE IMPORT API
// ============================================

class FileImporter {
    /**
     * Import files from various sources
     * @param {File|File[]|FileSystemDirectoryHandle} input
     * @returns {Promise<ProcessedFiles>}
     */
    static async import(input) {
        let collector;

        // Determine input type and create appropriate collector
        if (input instanceof File) {
            // Single file - check if ZIP
            if (input.name.endsWith('.zip')) {
                collector = new ZipFileCollector(input);
            } else {
                collector = new MultiFileCollector([input]);
            }
        } else if (Array.isArray(input) || input instanceof FileList) {
            // Multiple files
            collector = new MultiFileCollector(input);
        } else if (input?.kind === 'directory') {
            // Directory handle (File System Access API)
            collector = new FolderCollector(input);
        } else {
            throw new Error('Unsupported input type');
        }

        // Collect files
        window.BitboxerUtils.setStatus('Collecting files...', 'info');
        const fileCollection = await collector.collect();

        // Process files
        window.BitboxerUtils.setStatus('Processing files...', 'info');
        const processor = new FileProcessor(fileCollection);
        const processed = await processor.process();

        // *** ADD THIS: Cache WAV files globally ***
        if (!window._lastImportedFiles) {
            window._lastImportedFiles = new Map();
        }

        // // Cache all files by their filename (not full path)
        // fileCollection.files.forEach((file, path) => {
        //     const fileName = file.name;
        //     window._lastImportedFiles.set(fileName, file);
        //     console.log(`Cached file: ${fileName}`);
        // });

        // Cache all files by their SIMPLE FILENAME ONLY (no paths)
        fileCollection.files.forEach((file, path) => {
            // Extract filename from path (works for both simple names and full paths)
            const fileName = path.split(/[/\\]/).pop();
            window._lastImportedFiles.set(fileName, file);
            console.log(`Cached file: ${fileName}`);
        });

        console.log(`Total files cached: ${window._lastImportedFiles.size}`);
        // *** END OF ADDITION ***

        return {
            ...processed,
            collection: fileCollection
        };
    }

    /**
     * Prompt user to select a folder (modern browsers only)
     * @returns {Promise<ProcessedFiles>}
     */
    static async importFolder() {
        if (!window.showDirectoryPicker) {
            throw new Error('Folder selection not supported in this browser');
        }

        const dirHandle = await window.showDirectoryPicker();
        return await this.import(dirHandle);
    }
}

// ============================================
// ADVANCED SFZ LAYER DETECTION
// ============================================

/**
 * Analyzes SFZ regions for advanced layer structure
 * Detects key-based overlaps and velocity layer distribution
 * 
 * LOGIC:
 * 1. Group by <group> tags (if present)
 * 2. Within each group:
 *    - Different vel ranges + key overlap = Velocity layers (1 pad)
 *    - Same vel ranges + key overlap = Stacked layers (N pads)
 *    - No key overlap = Key-mapped (1 pad)
 * 
 * @param {Array} regions - SFZ regions to analyze
 * @returns {Object} Analysis result with layer structure
 */
function analyzeSFZLayersAdvanced(regions) {
    console.log('=== ADVANCED SFZ LAYER ANALYSIS ===');
    console.log('Total regions:', regions.length);

    // Step 1: Group regions by their groupIndex
    const sfzGroups = new Map();

    regions.forEach((region, idx) => {
        const lokey = region.lokey !== undefined ? parseInt(region.lokey) : 0;
        const hikey = region.hikey !== undefined ? parseInt(region.hikey) : 127;
        const lovel = region.lovel !== undefined ? parseInt(region.lovel) : 0;
        const hivel = region.hivel !== undefined ? parseInt(region.hivel) : 127;
        const groupKey = region.groupIndex !== undefined ? region.groupIndex : 0;

        console.log(`Region ${idx}: Group ${groupKey}, Keys ${lokey}-${hikey}, Vel ${lovel}-${hivel}, Sample: ${region.sample}`);

        if (!sfzGroups.has(groupKey)) {
            sfzGroups.set(groupKey, []);
        }

        sfzGroups.get(groupKey).push({
            ...region,
            lokey: lokey,
            hikey: hikey,
            lovel: lovel,
            hivel: hivel
        });
    });

    console.log(`Found ${sfzGroups.size} SFZ <group> section(s)`);

    // Step 2: Analyze each group
    const allLayers = [];

    for (const [groupIdx, groupRegions] of sfzGroups.entries()) {
        console.log(`\n--- Analyzing Group ${groupIdx} (${groupRegions.length} regions) ---`);

        const groupLayers = analyzeGroup(groupRegions, groupIdx);

        console.log(`Group ${groupIdx} produced ${groupLayers.length} layer(s)`);
        groupLayers.forEach(layer => {
            console.log(`  Layer: ${layer.regions.length} region(s), keys ${layer.lokey}-${layer.hikey}`);
        });

        allLayers.push(...groupLayers);
    }

    // Step 3: Return results
    console.log('\n=== ANALYSIS RESULT ===');
    console.log('Has multiple layers:', allLayers.length > 1);
    console.log('Total layers detected:', allLayers.length);

    return {
        hasMultipleLayers: allLayers.length > 1,
        layers: allLayers,
        totalLayers: allLayers.length
    };
}

/**
 * Check if any regions have overlapping key ranges
 * 
 * @param {Array} regions - Regions to check
 * @returns {boolean} True if any overlap exists
 */
function checkKeyOverlap(regions) {
    for (let i = 0; i < regions.length; i++) {
        for (let j = i + 1; j < regions.length; j++) {
            const r1 = regions[i];
            const r2 = regions[j];

            // Check if key ranges overlap
            if (!(r1.hikey < r2.lokey || r1.lokey > r2.hikey)) {
                return true; // Overlap found
            }
        }
    }
    return false; // No overlap
}

/**
 * Check if regions have FULL key overlap (not just partial)
 * Full overlap = most keys are covered by multiple regions
 */
function checkFullKeyOverlap(regions) {
    if (regions.length < 2) return false;

    // Count how many keys are covered by multiple regions
    const keyCoverage = new Map();

    regions.forEach(region => {
        for (let key = region.lokey; key <= region.hikey; key++) {
            keyCoverage.set(key, (keyCoverage.get(key) || 0) + 1);
        }
    });

    // If >50% of keys are covered by 2+ regions, it's full overlap
    const multiCoverKeys = Array.from(keyCoverage.values()).filter(count => count > 1).length;
    const totalKeys = keyCoverage.size;

    const overlapPercentage = multiCoverKeys / totalKeys;

    console.log(`  Full overlap check: ${(overlapPercentage * 100).toFixed(1)}% keys covered by multiple regions`);

    return overlapPercentage > 0.5;  // >50% = stacked layers
}

/**
 * Group regions by velocity range
 * Regions with EXACT same velocity range = same group
 * 
 * @param {Array} regions - Regions to group
 * @returns {Array} Array of velocity groups
 */
function groupByVelocity(regions) {
    const velGroups = new Map();

    regions.forEach(region => {
        const lovel = region.lovel !== undefined ? parseInt(region.lovel) : 0;
        const hivel = region.hivel !== undefined ? parseInt(region.hivel) : 127;
        const velKey = `${lovel}-${hivel}`; // Exact match required

        if (!velGroups.has(velKey)) {
            velGroups.set(velKey, []);
        }

        velGroups.get(velKey).push(region);
    });

    console.log(`  Velocity groups found: ${velGroups.size}`);
    velGroups.forEach((group, key) => {
        console.log(`    ${key}: ${group.length} region(s)`);
    });

    return Array.from(velGroups.values());
}


/**
 * Auto-assigns regions to layers based on key overlap detection
 * Then shows adjustment modal for user to refine
 */

/**
 * Analyzes a single group for layer structure with auto-assignment
 * 
 * @param {Array} groupRegions - Regions within one group
 * @param {number} groupIdx - Group index
 * @returns {Array} Array of detected layers
 */
function analyzeGroup(groupRegions, groupIdx) {
    // Check for key overlaps
    const hasKeyOverlap = checkKeyOverlap(groupRegions);

    if (!hasKeyOverlap) {
        // No overlap = Key-mapped multisample
        console.log('→ No key overlap: Key-mapped multisample');

        const lokey = Math.min(...groupRegions.map(r => r.lokey));
        const hikey = Math.max(...groupRegions.map(r => r.hikey));

        return [{
            index: groupIdx,
            lokey: lokey,
            hikey: hikey,
            regions: groupRegions,
            velocityZones: groupRegions.length,
            needsMerge: groupRegions.length > 16
        }];
    }

    // Has overlap - check velocity ranges
    const velocityGroups = groupByVelocity(groupRegions);

    if (velocityGroups.length === 1) {
        // All same velocity range - auto-assign to layers
        const sameVelGroup = velocityGroups[0];

        console.log(`→ Auto-assigning ${sameVelGroup.length} regions to layers...`);
        const autoLayers = autoAssignToLayers(sameVelGroup);

        console.log(`  Auto-assigned to ${autoLayers.length} layer(s)`);

        // Convert to layer format
        return autoLayers.map((layerRegions, idx) => {
            const lokey = Math.min(...layerRegions.map(r => r.lokey));
            const hikey = Math.max(...layerRegions.map(r => r.hikey));

            return {
                index: groupIdx * 1000 + idx,
                lokey: lokey,
                hikey: hikey,
                regions: layerRegions,
                velocityZones: layerRegions.length,
                needsMerge: layerRegions.length > 16
            };
        });
    }

    // Different velocity ranges = Velocity layers
    console.log(`→ Key overlap + different velocities: 1 layer with ${groupRegions.length} velocity zones`);

    const lokey = Math.min(...groupRegions.map(r => r.lokey));
    const hikey = Math.max(...groupRegions.map(r => r.hikey));

    return [{
        index: groupIdx,
        lokey: lokey,
        hikey: hikey,
        regions: groupRegions,
        velocityZones: groupRegions.length,
        needsMerge: groupRegions.length > 16
    }];
}

/**
 * Auto-assigns regions to layers based on key overlap
 * Algorithm: Try to fit each region in first available layer without overlap
 * 
 * @param {Array} regions - Regions to assign
 * @returns {Array} Array of layer arrays
 */
function autoAssignToLayers(regions) {
    const layers = [];

    regions.forEach((region, idx) => {
        let assigned = false;

        // Try to add to existing layers
        for (let i = 0; i < layers.length; i++) {
            if (!hasOverlapWithLayer(region, layers[i])) {
                // No overlap - add to this layer
                layers[i].push(region);
                assigned = true;
                console.log(`    Region ${idx} (${region.lokey}-${region.hikey}) → Layer ${i + 1}`);
                break;
            }
        }

        // If overlaps with all existing layers, create new layer
        if (!assigned) {
            layers.push([region]);
            console.log(`    Region ${idx} (${region.lokey}-${region.hikey}) → NEW Layer ${layers.length}`);
        }
    });

    return layers;
}

/**
 * Checks if a region overlaps with any region in a layer
 */
function hasOverlapWithLayer(region, layer) {
    return layer.some(r => {
        // Overlap exists if NOT (r1 ends before r2 starts OR r2 ends before r1 starts)
        return !(region.hikey < r.lokey || r.hikey < region.lokey);
    });
}

/**
 * Shows layer adjustment modal for user to refine auto-assignment
 * 
 * @param {Array} layers - Auto-assigned layers
 * @param {HTMLElement} targetPad - Target pad element
 * @returns {Promise<Object>} User-adjusted layers or cancelled
 */
async function showLayerAdjustmentModal(layers, targetPad) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.style.zIndex = '3000';

        let currentLayers = JSON.parse(JSON.stringify(layers)); // Deep clone

        function renderModal() {
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
                    <div class="modal-header">
                        <h2>Detected ${currentLayers.length} Layer(s) - Adjust if Needed</h2>
                    </div>
                    <div style="padding: 20px;">
                        <p style="color: var(--color-text-secondary); margin-bottom: 15px;">
                            Regions were auto-assigned to layers based on key overlap. 
                            You can move regions between layers before importing.
                        </p>
                        
                        <div id="layerAdjustContainer" style="display: flex; flex-direction: column; gap: 15px;">
                            ${currentLayers.map((layer, layerIdx) => `
                                <div class="layer-adjust-group" style="background: var(--color-bg-tertiary); padding: 15px; border-radius: var(--radius-md);">
                                    <h3 style="color: var(--color-accent-blue); margin-bottom: 10px;">
                                        Layer ${layerIdx + 1} (${layer.regions.length} region${layer.regions.length > 1 ? 's' : ''})
                                    </h3>
                                    <div style="display: flex; flex-direction: column; gap: 8px;">
                                        ${layer.regions.map((region, regionIdx) => {
                const sampleName = region.sample.split(/[/\\]/).pop();
                const keyRange = `${midiNoteToName(region.lokey)}-${midiNoteToName(region.hikey)}`;

                return `
                                                <div style="display: flex; align-items: center; gap: 10px; padding: 8px; background: var(--color-bg-secondary); border-radius: var(--radius-sm);">
                                                    <div style="flex: 1; font-size: 0.9em;">
                                                        <strong>${sampleName}</strong><br>
                                                        <span style="color: var(--color-text-secondary);">Keys: ${keyRange}</span>
                                                    </div>
                                                    <select class="select-dark region-move-select" 
                                                            data-layer="${layerIdx}" 
                                                            data-region="${regionIdx}"
                                                            style="width: 150px;">
                                                        <option value="">-- Move to --</option>
                                                        ${currentLayers.map((_, targetLayerIdx) =>
                    targetLayerIdx !== layerIdx
                        ? `<option value="${targetLayerIdx}">Layer ${targetLayerIdx + 1}</option>`
                        : ''
                ).join('')}
                                                        <option value="new">New Layer</option>
                                                    </select>
                                                </div>
                                            `;
            }).join('')}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button class="btn btn-primary" id="confirmLayersBtn" style="flex: 1;">
                                ✓ Continue with These Layers
                            </button>
                            <button class="btn" id="cancelLayersBtn" style="flex: 1;">
                                Cancel Import
                            </button>
                        </div>
                    </div>
                </div>
            `;

            if (modal.parentElement) {
                // Re-render in place
                return;
            }

            document.body.appendChild(modal);

            // Setup move listeners
            modal.querySelectorAll('.region-move-select').forEach(select => {
                select.addEventListener('change', (e) => {
                    const fromLayer = parseInt(e.target.dataset.layer);
                    const regionIdx = parseInt(e.target.dataset.region);
                    const toLayerValue = e.target.value;

                    if (!toLayerValue) return;

                    // Move region
                    const region = currentLayers[fromLayer].regions[regionIdx];
                    currentLayers[fromLayer].regions.splice(regionIdx, 1);

                    if (toLayerValue === 'new') {
                        // Create new layer
                        currentLayers.push({
                            index: currentLayers.length,
                            lokey: region.lokey,
                            hikey: region.hikey,
                            regions: [region],
                            velocityZones: 1,
                            needsMerge: false
                        });
                    } else {
                        // Move to existing layer
                        const toLayer = parseInt(toLayerValue);
                        currentLayers[toLayer].regions.push(region);

                        // Update layer bounds
                        currentLayers[toLayer].lokey = Math.min(...currentLayers[toLayer].regions.map(r => r.lokey));
                        currentLayers[toLayer].hikey = Math.max(...currentLayers[toLayer].regions.map(r => r.hikey));
                        currentLayers[toLayer].velocityZones = currentLayers[toLayer].regions.length;
                    }

                    // Remove empty layers
                    currentLayers = currentLayers.filter(layer => layer.regions.length > 0);

                    // Re-render
                    renderModal();
                });
            });

            // Confirm button
            document.getElementById('confirmLayersBtn').onclick = () => {
                document.body.removeChild(modal);
                resolve({ cancelled: false, layers: currentLayers });
            };

            // Cancel button
            document.getElementById('cancelLayersBtn').onclick = () => {
                document.body.removeChild(modal);
                resolve({ cancelled: true });
            };
        }

        renderModal();
    });
}


/**
 * Prompts user to map SFZ layers to pads with shared MIDI channel
 * 
 * @param {Array} layers - Analyzed layer data
 * @param {HTMLElement} targetPad - Initial target pad
 * @returns {Promise<Object>} {cancelled, mappings, midiChannel}
 */
async function promptLayerMappingAdvanced(layers, targetPad) {
    const { presetData } = window.BitboxerData;

    // Build available pads list
    const availablePads = [];
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
            const pad = presetData.pads[row][col];
            const padNum = row * 4 + col + 1;
            const isEmpty = !pad.filename || pad.type === 'samtempl';
            availablePads.push({
                row, col, padNum, isEmpty,
                currentName: pad.filename || 'Empty'
            });
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
                        This SFZ has <strong>${layers.length} layer(s)</strong> with overlapping key ranges.
                        Choose destination pads:
                    </p>
                    
                    <!-- MIDI Channel Selection -->
                    <div style="background: var(--color-bg-primary); padding: 12px; border-radius: var(--radius-md); margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; color: var(--color-accent-blue); font-weight: 600;">
                            🎹 Shared MIDI Channel (all layers):
                        </label>
                        <select id="sharedMidiChannel" class="select" style="width: 100%;">
                            <option value="0">None</option>
                            <option value="1" selected>Ch 1 (omni)</option>
                            <option value="2">Ch 2</option>
                            <option value="3">Ch 3</option>
                            <option value="4">Ch 4</option>
                            <option value="5">Ch 5</option>
                            <option value="6">Ch 6</option>
                            <option value="7">Ch 7</option>
                            <option value="8">Ch 8</option>
                            <option value="9">Ch 9</option>
                            <option value="10">Ch 10</option>
                            <option value="11">Ch 11</option>
                            <option value="12">Ch 12</option>
                            <option value="13">Ch 13</option>
                            <option value="14">Ch 14</option>
                            <option value="15">Ch 15</option>
                            <option value="16">Ch 16</option>
                        </select>
                        <small style="display: block; margin-top: 6px; color: var(--color-text-secondary); font-size: 0.85em;">
                            All layers will respond to this MIDI channel
                        </small>
                    </div>
                    
                    <!-- Layer Mappings -->
                    <div id="layerMappingContainer" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
                        <!-- Populated by JS -->
                    </div>
                    
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-primary" id="importLayersBtn" style="flex: 1;">Import Layers</button>
                        <button class="btn" id="cancelLayersBtn" style="flex: 1;">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const container = document.getElementById('layerMappingContainer');
        const selectedDestinations = new Set();

        // Build layer rows
        layers.forEach((layer, idx) => {
            const keyRangeName = midiNoteToName(layer.lokey) + '-' + midiNoteToName(layer.hikey);
            const warningBadge = layer.needsMerge
                ? `<span style="color: var(--color-accent-yellow); margin-left: 8px;">⚠️ ${layer.velocityZones} zones → 16</span>`
                : `<span style="color: var(--color-text-secondary); margin-left: 8px;">(${layer.velocityZones} zones)</span>`;

            const rowHtml = `
                <div style="display: grid; grid-template-columns: 2fr auto 2fr; gap: 10px; align-items: center; padding: 12px; background: var(--color-bg-tertiary); border-radius: var(--radius-md);">
                    <div>
                        <div style="color: var(--color-accent-blue); font-weight: 600;">Layer ${idx + 1}</div>
                        <div style="color: var(--color-text-secondary); font-size: 0.85em;">Keys: ${keyRangeName}${warningBadge}</div>
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

        // Update dropdown options
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
                            : `Pad ${p.padNum} (${p.currentName.split(/[/\\]/).pop().replace(/\.(wav|WAV)$/, '')}) ⚠️`;
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

        // Import button
        document.getElementById('importLayersBtn').onclick = () => {
            const mappings = [];
            targetSelects.forEach(select => {
                if (select.value) {
                    const [row, col] = select.value.split(',').map(Number);
                    const layerIdx = parseInt(select.dataset.layerIdx);
                    mappings.push({
                        layer: layers[layerIdx],
                        row,
                        col
                    });
                }
            });

            if (mappings.length === 0) {
                window.BitboxerUtils.setStatus('No layers selected', 'error');
                return;
            }

            const midiChannel = document.getElementById('sharedMidiChannel').value;

            document.body.removeChild(modal);
            resolve({
                cancelled: false,
                mappings: mappings,
                midiChannel: midiChannel
            });
        };

        // Cancel button
        document.getElementById('cancelLayersBtn').onclick = () => {
            document.body.removeChild(modal);
            resolve({ cancelled: true });
        };
    });
}

/**
 * Merges velocity zones to maximum of 16
 * Distributes regions evenly across velocity range
 * 
 * @param {Array} regions - Regions to merge
 * @returns {Array} Merged regions (max 16)
 */
function mergeVelocityZones(regions) {
    if (regions.length <= 16) return regions;

    console.log(`Merging ${regions.length} zones → 16`);

    // Sort by velocity
    const sorted = regions.slice().sort((a, b) => {
        const aVel = a.lovel !== undefined ? parseInt(a.lovel) : 0;
        const bVel = b.lovel !== undefined ? parseInt(b.lovel) : 0;
        return aVel - bVel;
    });

    const merged = [];

    // FIX: Distribute samples evenly across 16 bins
    for (let i = 0; i < 16; i++) {
        const binStart = Math.floor((i / 16) * sorted.length);
        const binEnd = Math.floor(((i + 1) / 16) * sorted.length);

        if (binStart >= sorted.length) break;

        // Use first sample in bin as representative
        const representative = sorted[binStart];

        // Calculate velocity range for this bin
        const newLoVel = Math.floor((i / 16) * 127);
        const newHiVel = i === 15 ? 127 : Math.floor(((i + 1) / 16) * 127) - 1;

        merged.push({
            ...representative,
            lovel: newLoVel,
            hivel: newHiVel
        });

        const samplesInBin = binEnd - binStart;
        console.log(`  Bin ${i + 1}: Vel ${newLoVel}-${newHiVel} (from ${samplesInBin} sample${samplesInBin > 1 ? 's' : ''})`);
    }

    return merged;
}

/**
 * Loads a single layer to a specific pad
 * Handles multisample creation with velocity zones
 * 
 * @param {Object} layer - Layer data with regions
 * @param {number} row - Target pad row
 * @param {number} col - Target pad column
 * @param {string} midiChannel - MIDI channel (0-16)
 * @param {string} sfzName - SFZ filename (for folder naming)
 * @param {number} totalLayers - Total number of layers being imported
 */
function loadLayerToPad(layer, row, col, midiChannel, sfzName, totalLayers, wavMetadata = {}) {
    const { presetData, assetCells } = window.BitboxerData;
    const pad = presetData.pads[row][col];

    let regions = layer.regions;

    // Merge if >16 zones
    if (layer.needsMerge) {
        regions = mergeVelocityZones(regions);
        console.log(`Layer merged: ${layer.velocityZones} → ${regions.length} zones`);
    }

    // Single velocity zone = simple sample
    if (regions.length === 1) {
        const region = regions[0];
        pad.type = 'sample';
        pad.filename = region.wavFile.name;
        pad.params.multisammode = '0';
        pad.params.midimode = midiChannel;

        // Apply WAV metadata FIRST
        applyWAVMetadataToPad(pad, wavMetadata);

        // Then SFZ opcodes override
        applySFZOpcodesToPad(pad, region, wavMetadata);

        console.log(`✓ Loaded single sample: ${region.wavFile.name} to Pad ${row * 4 + col + 1}`);
        return;
    }

    // Multiple velocity zones = multisample
    pad.type = 'sample';
    pad.params.multisammode = '1';
    pad.params.midimode = midiChannel;

    // FIXED: Only add "_Layer#" suffix if multiple layers
    const baseName = sfzName.replace('.sfz', '');
    const multisamFolder = totalLayers > 1
        ? `${baseName}_Layer${layer.index + 1}`
        : baseName;

    pad.filename = `.\\${multisamFolder}`;

    // Create asset cells
    regions.forEach((region, idx) => {
        const asset = createAssetFromSFZRegion(region, row, col, assetCells.length);

        // Override folder path
        const sampleFileName = region.sample.split(/[/\\]/).pop();
        asset.filename = `.\\${multisamFolder}\\${sampleFileName}`;

        assetCells.push(asset);
    });

    console.log(`✓ Loaded multisample: ${regions.length} zones to Pad ${row * 4 + col + 1}`);
}

/**
 * Helper: Convert MIDI note number to name
 */
function midiNoteToName(midi) {
    if (midi < 0 || midi > 127) return '---';
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    const note = notes[midi % 12];
    return `${note}${octave}`;
}

// ============================================
// EXPORT FILE HANDLER
// ============================================
window.BitboxerFileHandler = {
    FileImporter,
    FileCollector,
    ZipFileCollector,
    MultiFileCollector,
    FolderCollector,
    FileProcessor,
    SFZParser,
    WAVParser,
    NoteNameParser,
    // Advanced SFZ
    analyzeSFZLayersAdvanced,
    promptLayerMappingAdvanced,
    mergeVelocityZones,
    loadLayerToPad,
    // NEW: Auto-assignment functions
    autoAssignToLayers,
    showLayerAdjustmentModal

};
