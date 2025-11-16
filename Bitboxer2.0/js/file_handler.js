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
        console.log('SFZ Content:', sfzText.substring(0, 500)); // First 500 chars

        const lines = sfzText.split('\n');
        const regions = [];
        let currentRegion = null;
        let globalOpcodes = {};
        let currentGroup = {};
        let defaultPath = '';

        for (let line of lines) {
            // Remove comments
            line = line.split('//')[0].trim();
            if (!line) continue;

            // Handle <region> headers
            if (line.includes('<region>')) {
                if (currentRegion) {
                    // Finish previous region
                    if (defaultPath && currentRegion.sample) {
                        if (!currentRegion.sample.includes('/') && !currentRegion.sample.includes('\\')) {
                            currentRegion.sample = defaultPath + currentRegion.sample;
                        }
                    }
                    console.log('Finished region:', currentRegion);
                    regions.push(currentRegion);
                }
                // Start new region
                currentRegion = { ...globalOpcodes, ...currentGroup };

                // Extract everything after <region>
                line = line.substring(line.indexOf('<region>') + 8).trim();
                // If line is now empty, continue to next line
                // If line has content, fall through to parse it as opcodes
                if (!line) continue;
            }

            // Handle <group> headers
            if (line.includes('<group>')) {
                currentRegion = null;
                currentGroup = { ...globalOpcodes };

                line = line.substring(line.indexOf('<group>') + 7).trim();
                if (!line) continue;
            }

            // Handle <global> headers
            if (line.includes('<global>')) {
                currentRegion = null;
                currentGroup = {};

                line = line.substring(line.indexOf('<global>') + 8).trim();
                if (!line) continue;
            }

            // Parse opcodes (if we're inside a region/group/global AND line has content)
            if (!line) continue;

            const opcodes = this._parseOpcodes(line);

            // DEBUG: Log important opcodes
            if (opcodes.sample || opcodes.default_path) {
                console.log('Found important opcode:', opcodes);
            }

            // Special handling for default_path
            if (opcodes.default_path) {
                defaultPath = opcodes.default_path;
                if (!defaultPath.endsWith('/') && !defaultPath.endsWith('\\')) {
                    defaultPath += '/';
                }
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
            // Apply default_path to sample if needed
            if (defaultPath && currentRegion.sample) {
                if (!currentRegion.sample.includes('/') && !currentRegion.sample.includes('\\')) {
                    currentRegion.sample = defaultPath + currentRegion.sample;
                }
            }
            console.log('Finished last region:', currentRegion);
            regions.push(currentRegion);
        }

        // Convert note names to MIDI numbers for ALL regions
        regions.forEach(region => {
            if (region.key) region.key = NoteNameParser.toMidiNumber(region.key);
            if (region.lokey) region.lokey = NoteNameParser.toMidiNumber(region.lokey);
            if (region.hikey) region.hikey = NoteNameParser.toMidiNumber(region.hikey);
            if (region.pitch_keycenter) region.pitch_keycenter = NoteNameParser.toMidiNumber(region.pitch_keycenter);
        });

        console.log(`=== Total regions parsed: ${regions.length} ===`);
        if (regions.length > 0) {
            console.log('First region sample:', regions[0].sample);
            console.log('First region key range:', regions[0].lokey, '-', regions[0].hikey);
        }

        return {
            regions,
            global: globalOpcodes
        };
    }

    static _parseOpcodes(line) {
        const opcodes = {};
        
        // More robust regex that handles paths with spaces and special characters
        // Split on spaces but respect equals signs
        const parts = line.trim().split(/\s+/);
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];

            // Skip if not an opcode (no = sign)
            if (!part.includes('=')) continue;

            const equalIndex = part.indexOf('=');
            const key = part.substring(0, equalIndex);
            let value = part.substring(equalIndex + 1);

            // If value is empty, might be space-separated (like "sample= file.wav")
            if (!value && i + 1 < parts.length) {
                value = parts[i + 1];
                i++; // Skip next part since we consumed it
            }

            // Handle paths that might have been split by spaces
            // If this looks like start of a path and next parts don't have =, join them
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
        if (isNaN(octave)) return null;
        
        // Find note index
        const noteIndex = this.noteNames.indexOf(note);
        if (noteIndex === -1) return null;
        
        // Calculate MIDI number: 
        const midiNum = (octave + 2) * 12 + noteIndex;
        console.log(`  → ${noteName} = ${midiNum}`);
        return midiNum;
    }
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

    // If single layer with multiple velocity zones, load to target pad
    if (!layerAnalysis.isStacked && layerAnalysis.totalLayers === 1) {
        window.BitboxerUtils.setStatus('Loading single layer with velocity zones...', 'info');
        await loadLayerToPad(layerAnalysis.layers[0], row, col, '0'); // No MIDI channel
        window.BitboxerUI.updatePadDisplay();
        window.BitboxerUtils.setStatus(
            `Imported layer with ${layerAnalysis.layers[0].regions.length} velocity zone(s)`,
            'success'
        );
        return;
    }

    // If multiple layers detected, prompt for mapping
    if (layerAnalysis.isStacked && layerAnalysis.totalLayers > 1) {
        window.BitboxerUtils.setStatus('Loading single layer with velocity zones...', 'info');
        await window.BitboxerFileHandler.loadLayerToPad(layerAnalysis.layers[0], row, col, '0');
        window.BitboxerUI.updatePadDisplay();
        window.BitboxerUtils.setStatus(
            `Imported layer with ${layerAnalysis.layers[0].regions.length} velocity zone(s)`,
            'success'
        );
        return;
    }

    // If multiple layers detected, prompt for mapping
    if (layerAnalysis.isStacked && layerAnalysis.totalLayers > 1) {
        window.BitboxerUtils.setStatus('Multiple layers detected - choose pads & MIDI channel...', 'info');

        const mappings = await window.BitboxerFileHandler.promptLayerMapping(layerAnalysis.layers, targetPad);
        
        if (!mappings || mappings.length === 0) {
            window.BitboxerUtils.setStatus('SFZ import cancelled', 'info');
            return;
        }
        
        // Load each layer to its assigned pad
        for (const mapping of mappings) {
            await window.BitboxerFileHandler.loadLayerToPad(mapping.layer, mapping.row, mapping.col, mapping.midiChannel);
        }
        
        window.BitboxerUI.updatePadDisplay();
        
        const channelText = mappings[0].midiChannel === '0' ? 'None' : mappings[0].midiChannel;
        const totalVelZones = mappings.reduce((sum, m) => sum + m.layer.regions.length, 0);
        
        window.BitboxerUtils.setStatus(
            `✓ Imported ${mappings.length} layer(s), ${totalVelZones} velocity zone(s) total | MIDI Ch ${channelText}`,
            'success'
        );
        return;
    }
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

    analyzeSFZLayers,      
    promptLayerMapping,    
    loadLayerToPad,        
    mergeVelocityZones     
};
