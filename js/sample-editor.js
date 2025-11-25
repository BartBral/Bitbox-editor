/**
 * BITBOXER - Sample Editor
 * 
 * Visual waveform editor with playback and draggable markers
 * Mode-aware display (Sample/Clip/Slicer/Granular)
 */

// ============================================
// WAVEFORM RENDERER
// ============================================
class WaveformRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.waveformData = null;
        this.zoom = 1; // 1 = full view, >1 = zoomed in
        this.scrollPos = 0; // 0-1, position in waveform
        this.width = 0;
        this.height = 0;
    }

    setWaveformData(audioBuffer) {
        const channels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length;
        const sampleRate = audioBuffer.sampleRate;
        
        this.waveformData = {
            channels: channels,
            length: length,
            sampleRate: sampleRate,
            channelData: []
        };

        // Store channel data
        for (let i = 0; i < channels; i++) {
            this.waveformData.channelData.push(audioBuffer.getChannelData(i));
        }

        this.render();
    }

    resize() {
        const container = this.canvas.parentElement;
        const dpr = window.devicePixelRatio || 1;
        
        // FIX: Use offsetWidth/Height instead of clientWidth/Height
        this.width = container.offsetWidth;
        this.height = 200; // FIX: Fixed height instead of growing
        
        // FIX: Set canvas size properly
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        
        // FIX: Set CSS size explicitly
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';
        
        // Scale context for DPR
        this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
        this.ctx.scale(dpr, dpr);
        
        this.render();
    }

    render() {
        if (!this.waveformData) return;

        const { ctx, width, height, waveformData, zoom, scrollPos } = this;
        const { channels, length, channelData } = waveformData;

        // Clear canvas
        ctx.fillStyle = '#1a1614';
        ctx.fillRect(0, 0, width, height);

        // Calculate visible sample range
        const totalSamplesVisible = Math.floor(length / zoom);
        const startSample = Math.floor(scrollPos * (length - totalSamplesVisible));
        const endSample = Math.min(length, startSample + totalSamplesVisible);
        const samplesPerPixel = Math.max(1, Math.floor((endSample - startSample) / width));

        const channelHeight = height / channels;

        // Draw each channel
        for (let ch = 0; ch < channels; ch++) {
            const data = channelData[ch];
            const yOffset = ch * channelHeight + channelHeight / 2;

            ctx.strokeStyle = '#ffa600';
            ctx.lineWidth = 1;
            ctx.beginPath();

            for (let x = 0; x < width; x++) {
                const sampleIdx = Math.floor(startSample + x * samplesPerPixel);
                const sampleEnd = Math.min(length, sampleIdx + samplesPerPixel);

                let min = 1, max = -1;
                for (let i = sampleIdx; i < sampleEnd; i++) {
                    const val = data[i];
                    if (val < min) min = val;
                    if (val > max) max = val;
                }

                const y1 = yOffset + min * (channelHeight / 2) * 0.9;
                const y2 = yOffset + max * (channelHeight / 2) * 0.9;

                if (x === 0) {
                    ctx.moveTo(x, y1);
                } else {
                    ctx.lineTo(x, y1);
                }
                ctx.lineTo(x, y2);
            }

            ctx.stroke();

            // Draw center line
            ctx.strokeStyle = '#4a4038';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, yOffset);
            ctx.lineTo(width, yOffset);
            ctx.stroke();

            // Draw channel label
            ctx.fillStyle = '#d0c2b9';
            ctx.font = '10px monospace';
            ctx.fillText(channels === 1 ? 'MONO' : `CH ${ch + 1}`, 5, yOffset - channelHeight / 2 + 15);
        }

        // FIX: Canvas is now ready for marker drawing in screen coordinates
        // Context is already at correct DPR scale from resize()
    }

    sampleToX(sample) {
        if (!this.waveformData) return 0;
        
        const width = this.width;
        if (!width || width <= 0) {
            // Don't log warning - just return 0 silently (happens during resize)
            return 0;
        }
        
        const { length } = this.waveformData;
        const { zoom, scrollPos } = this;
        const totalVisible = length / zoom;
        const startSample = scrollPos * (length - totalVisible);
        return ((sample - startSample) / totalVisible) * width;
    }

    xToSample(x) {
        if (!this.waveformData) return 0;
        
        const { length } = this.waveformData;
        const { zoom, scrollPos, width } = this;
        
        // Guard against invalid width
        if (!width || width <= 0) {
            console.warn('xToSample: invalid width', width);
            return 0;
        }

        const totalVisible = length / zoom;
        const startSample = scrollPos * (length - totalVisible);

        // Convert screen x-coordinate to sample position
        const sample = Math.floor(startSample + (x / width) * totalVisible);

        return Math.max(0, Math.min(length, sample));
    }
}

// ============================================
// AUDIO ENGINE
// ============================================
class AudioEngine {
    constructor() {
        this.audioContext = null;
        this.audioBuffer = null;
        this.source = null;
        this.isPlaying = false;
        this.startTime = 0;
        this.pauseTime = 0;
        this.playbackStartSample = 0;
    }

    async init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    async loadAudio(arrayBuffer) {
        await this.init();
        console.log('Loading audio, input size:', arrayBuffer.byteLength); // DEBUG
        this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice(0)); // Force copy
        console.log('Decoded audio:', this.audioBuffer.length, 'samples at', this.audioBuffer.sampleRate, 'Hz'); // DEBUG
        return this.audioBuffer;
    }

    play(params = {}) {
        if (!this.audioBuffer) return;
        
        this.stop(); // Stop any existing playback

        const {
            startSample = 0,
            endSample = this.audioBuffer.length,
            loopStartSample = 0,
            loopEndSample = this.audioBuffer.length,
            loopEnabled = false,
            reverse = false
        } = params;

        const sampleRate = this.audioBuffer.sampleRate;

        // Store start sample for getCurrentSample()
        this.playbackStartSample = startSample;

        this.source = this.audioContext.createBufferSource();
        this.source.buffer = this.audioBuffer;
        this.source.connect(this.audioContext.destination);

        const startTime = startSample / sampleRate;
        const duration = (endSample - startSample) / sampleRate;

        if (loopEnabled) {
            this.source.loop = true;
            this.source.loopStart = loopStartSample / sampleRate;
            this.source.loopEnd = loopEndSample / sampleRate;
        }

        if (reverse) {
            this.source.playbackRate.value = -1;
            this.source.start(0, startTime + duration, duration);
        } else {
            this.source.start(0, startTime, loopEnabled ? undefined : duration);
        }

        this.isPlaying = true;
        this.startTime = this.audioContext.currentTime;

        this.source.onended = () => {
            this.isPlaying = false;
        };
    }

    stop() {
        if (this.source) {
            try {
                this.source.stop();
            } catch (e) {
                // Already stopped
            }
            this.source = null;
        }
        this.isPlaying = false;
    }

    getCurrentSample() {
        if (!this.isPlaying || !this.audioBuffer) return 0;
        
        const elapsed = this.audioContext.currentTime - this.startTime;
        const elapsedSamples = Math.floor(elapsed * this.audioBuffer.sampleRate);
        
        // Return absolute position in file
        return this.playbackStartSample + elapsedSamples;
    }
}

// ============================================
// MARKER CONTROLLER
// ============================================
class MarkerController {
    constructor(renderer, audioEngine) {
        this.renderer = renderer;
        this.audioEngine = audioEngine;
        this.markers = {
            start: { sample: 0, color: '#ff0000', label: 'START', snapZeroCross: true },
            end: { sample: 0, color: '#ff0000', label: 'END', snapZeroCross: true },
            loopStart: { sample: 0, color: '#4a9eff', label: 'LOOP START', snapZeroCross: true },
            loopEnd: { sample: 0, color: '#4a9eff', label: 'LOOP END', snapZeroCross: true }
        };
        this.dragging = null;
        this.sliceMarkers = []; // For slicer mode
        this.isUpdatingFromDrag = false;
    }

    setMarker(name, sample) {
        if (!this.markers[name]) return;
        if (!this.renderer.waveformData) return;
        
        // Guard against NaN
        if (isNaN(sample) || sample === null || sample === undefined) {
            console.error(`Invalid sample value for marker ${name}: ${sample}`);
            return;
        }
        
        // Clamp to valid range
        const validSample = Math.max(0, Math.min(this.renderer.waveformData.length, sample));
        this.markers[name].sample = validSample;
    }

    addSliceAtSample(sample) {
        const channelData = this.renderer.waveformData.channelData[0];
        const snappedSample = this.findZeroCrossing(sample, channelData);
        
        // Don't add if too close to existing
        const minDistance = 100;
        const tooClose = this.sliceMarkers.some(s => Math.abs(s - snappedSample) < minDistance);
        if (tooClose) {
            console.log('Slice too close to existing marker');
            return false;
        }
        
        this.sliceMarkers.push(snappedSample);
        this.sliceMarkers.sort((a, b) => a - b);
        this.updateSlicesToPad();
        
        console.log(`Added slice at sample ${snappedSample}`);
        return true;
    }

    findZeroCrossing(targetSample, channelData) {
        const searchRadius = 50;
        const start = Math.max(0, targetSample - searchRadius);
        const end = Math.min(channelData.length - 1, targetSample + searchRadius);

        let bestSample = targetSample;
        let minCrossing = Math.abs(channelData[targetSample]);

        for (let i = start; i < end - 1; i++) {
            const curr = channelData[i];
            const next = channelData[i + 1];
            
            // Check for zero crossing (sign change)
            if ((curr <= 0 && next >= 0) || (curr >= 0 && next <= 0)) {
                const crossing = Math.abs(curr);
                if (crossing < minCrossing) {
                    minCrossing = crossing;
                    bestSample = i;
                }
            }
        }

        return bestSample;
    }

    snapToZeroCrossing(sample, marker) {
        if (!marker.snapZeroCross || !this.renderer.waveformData) return sample;
        
        const channelData = this.renderer.waveformData.channelData[0];
        return this.findZeroCrossing(sample, channelData);
    }

    //     const { ctx, width, height } = this.renderer;

    //     // FIX: Don't draw if canvas width is invalid
    //     if (!width || width <= 0) {
    //         console.warn('Skipping marker draw - invalid canvas width:', width);
    //         return;
    //     }

    //     // Markers draw in SCREEN coordinates (already DPR-scaled by resize())
    //     Object.entries(this.markers).forEach(([name, marker]) => {
    //         const x = this.renderer.sampleToX(marker.sample);

    //         if (x < 0 || x > width) return;

    //         // Draw vertical line
    //         ctx.strokeStyle = marker.color;
    //         ctx.lineWidth = 2;
    //         ctx.beginPath();
    //         ctx.moveTo(x, 0);
    //         ctx.lineTo(x, height);
    //         ctx.stroke();

    //         // Draw label background for readability
    //         ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    //         ctx.fillRect(x + 3, 5, 80, 12);

    //         // Draw label
    //         ctx.fillStyle = marker.color;
    //         ctx.font = '10px monospace';
    //         ctx.fillText(marker.label, x + 5, 15);

    //         // Draw draggable handle
    //         ctx.fillStyle = marker.color;
    //         ctx.fillRect(x - 5, 0, 10, 20);
    //     });

    //     // Draw slice markers
    //     this.sliceMarkers.forEach(sample => {
    //         const x = this.renderer.sampleToX(sample);
    //         if (x < 0 || x > width) return;

    //         ctx.strokeStyle = '#5eff5e';
    //         ctx.lineWidth = 1;
    //         ctx.setLineDash([5, 5]);
    //         ctx.beginPath();
    //         ctx.moveTo(x, 0);
    //         ctx.lineTo(x, height);
    //         ctx.stroke();
    //         ctx.setLineDash([]);
    //     });
    // }

    // Temporary Debug Code
    draw() {
        const { ctx, width, height } = this.renderer;
        
        // Don't draw if canvas width is invalid
        if (!width || width <= 0) {
            return;
        }

        // Get current cell mode to determine marker visibility
        const { currentEditingPad, presetData } = window.BitboxerData;
        let cellmode = '0';
        if (currentEditingPad) {
            const row = parseInt(currentEditingPad.dataset.row);
            const col = parseInt(currentEditingPad.dataset.col);
            cellmode = presetData.pads[row][col]?.params?.cellmode || '0';
        }
        
        // Decide which markers to show based on mode
        const showStandardMarkers = (cellmode === '0' || cellmode === '3'); // Sample or Granular
        const showSliceMarkers = (cellmode === '2'); // Slicer

        // Draw standard markers (start, end, loopStart, loopEnd) only in appropriate modes
        if (showStandardMarkers) {
            Object.entries(this.markers).forEach(([name, marker]) => {
                const x = this.renderer.sampleToX(marker.sample);

                if (x < 0 || x > width) return;
            
                // Draw vertical line
                ctx.strokeStyle = marker.color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();

                // Draw label background for readability
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(x + 3, 5, 80, 12);
            
                // Draw label
                ctx.fillStyle = marker.color;
                ctx.font = '10px monospace';
                ctx.fillText(marker.label, x + 5, 15);
            
                // Draw draggable handle
                ctx.fillStyle = marker.color;
                ctx.fillRect(x - 5, 0, 10, 20);
            });
        }

        // Draw slice markers only in slicer mode
        if (showSliceMarkers) {
            this.sliceMarkers.forEach(sample => {
                const x = this.renderer.sampleToX(sample);
                if (x < 0 || x > width) return;
            
                ctx.strokeStyle = '#5eff5e';
                ctx.lineWidth = 1;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
                ctx.setLineDash([]);

                // Draw handle for slice markers too
                ctx.fillStyle = '#5eff5e';
                ctx.fillRect(x - 3, 0, 6, 15);
            });
        }
    }


    drawGranularOverlay(padParams) {
        const { ctx, width, height } = this.renderer;
        if (!this.renderer.waveformData) return;

        const totalLength = this.renderer.waveformData.length;
        const sampleRate = this.renderer.waveformData.sampleRate;

        // Get grain parameters
        const samstart = parseInt(padParams.samstart) || 0;
        const samlen = parseInt(padParams.samlen) || totalLength;
        const grainSourceWindow = parseFloat(padParams.gainssrcwin) / 1000; // 0-1
        
        // Calculate grain window within the actual sample bounds
        const sampleEnd = Math.min(samstart + samlen, totalLength);
        const effectiveLength = sampleEnd - samstart;
        const sourceWindowSamples = Math.floor(effectiveLength * grainSourceWindow);
        const windowStart = samstart + Math.floor((effectiveLength - sourceWindowSamples) / 2);
        const windowEnd = windowStart + sourceWindowSamples;

        // Convert to screen coordinates
        const x1 = this.renderer.sampleToX(windowStart);
        const x2 = this.renderer.sampleToX(windowEnd);

        // Draw semi-transparent overlay outside grain window
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        if (x1 > 0) {
            ctx.fillRect(0, 0, x1, height);
        }
        if (x2 < width) {
            ctx.fillRect(x2, 0, width - x2, height);
        }

        // Draw grain window border
        ctx.strokeStyle = '#ffea5e';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 5]);
        ctx.strokeRect(x1, 0, x2 - x1, height);
        ctx.setLineDash([]);

        // Draw grain window label
        ctx.fillStyle = '#ffea5e';
        ctx.font = '12px monospace';
        const grainPercent = (grainSourceWindow * 100).toFixed(0);
        ctx.fillText(`GRAIN WINDOW (${grainPercent}%)`, Math.max(5, x1 + 5), height - 10);

        // Draw grain size indicator (animated grain)
        const grainSizePerc = parseFloat(padParams.grainsizeperc) / 1000; // 0-1
        const grainSizeSamples = Math.floor(sampleRate * 0.1 * grainSizePerc); // Up to 100ms
        const grainWidth = this.renderer.sampleToX(samstart + grainSizeSamples) - this.renderer.sampleToX(samstart);

        // Animate grain position (simple ping-pong)
        const time = Date.now() / 1000;
        const animSpeed = 0.5; // seconds per cycle
        const animPos = (Math.sin(time * Math.PI * 2 / animSpeed) + 1) / 2; // 0-1

        const grainX = x1 + animPos * Math.max(0, (x2 - x1 - grainWidth));

        ctx.fillStyle = 'rgba(255, 234, 94, 0.3)';
        ctx.fillRect(grainX, 0, grainWidth, height);

        ctx.strokeStyle = '#ffea5e';
        ctx.lineWidth = 1;
        ctx.strokeRect(grainX, 0, grainWidth, height);
    }

    drawClipBeatGrid(padParams, tempo) {
        const { ctx, width, height } = this.renderer;
        if (!this.renderer.waveformData) return;

        const totalLength = this.renderer.waveformData.length;
        const sampleRate = this.renderer.waveformData.sampleRate;
        const bpm = parseFloat(tempo) || 120;

        // Get beat count (0 = auto, >0 = specific count)
        let beatCount = parseInt(padParams.beatcount) || 0;
        
        if (beatCount === 0) {
            // Auto-detect: assume sample duration in seconds
            const durationSeconds = totalLength / sampleRate;
            const beatsPerSecond = bpm / 60;
            beatCount = Math.round(durationSeconds * beatsPerSecond);
        }

        if (beatCount <= 0) return;

        // Calculate samples per beat
        const samplesPerBeat = totalLength / beatCount;

        // Draw beat grid lines
        ctx.strokeStyle = 'rgba(74, 158, 255, 0.5)'; // Blue
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);

        for (let i = 0; i <= beatCount; i++) {
            const sample = Math.floor(i * samplesPerBeat);
            const x = this.renderer.sampleToX(sample);

            if (x < 0 || x > width) continue;

            // Draw beat line
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();

            // Draw beat number
            if (i % 4 === 0 || beatCount <= 16) {
                ctx.fillStyle = '#4a9eff';
                ctx.font = '10px monospace';
                ctx.fillText(`${i + 1}`, x + 3, height - 25);
            }
        }

        ctx.setLineDash([]);

        // Draw synctype subdivision lines (lighter)
        const synctype = parseInt(padParams.synctype) || 6;
        const subdivisions = this.getSynctypeSubdivisions(synctype);

        if (subdivisions > 1) {
            ctx.strokeStyle = 'rgba(74, 158, 255, 0.2)';
            ctx.lineWidth = 1;

            for (let beat = 0; beat < beatCount; beat++) {
                for (let sub = 1; sub < subdivisions; sub++) {
                    const sample = Math.floor((beat + sub / subdivisions) * samplesPerBeat);
                    const x = this.renderer.sampleToX(sample);

                    if (x < 0 || x > width) continue;

                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, height);
                    ctx.stroke();
                }
            }
        }

        // Draw beat count label
        ctx.fillStyle = '#4a9eff';
        ctx.font = '12px monospace';
        const label = beatCount === parseInt(padParams.beatcount) 
            ? `${beatCount} BEATS` 
            : `${beatCount} BEATS (AUTO)`;
        ctx.fillText(label, 5, height - 10);

        // Draw BPM indicator
        ctx.fillText(`${bpm} BPM`, width - 80, height - 10);
    }

    getSynctypeSubdivisions(synctype) {
        // synctype values: 0=Slice, 1=1bar, 2=1/2, 3=1/4, 4=1/8, 5=1/16, 6=none
        const subdivisionMap = {
            0: 1,  // Slice - no subdivision
            1: 1,  // 1 bar - no subdivision
            2: 2,  // 1/2 - 2 subdivisions per beat
            3: 4,  // 1/4 - 4 subdivisions per beat
            4: 8,  // 1/8 - 8 subdivisions per beat
            5: 16, // 1/16 - 16 subdivisions per beat
            6: 1   // None - no subdivision
        };
        
        return subdivisionMap[synctype] || 1;
    }

    handleMouseDown(x, y, mode, shiftKey = false) {
        console.log(`handleMouseDown: x=${x}, y=${y}, mode=${mode}, shift=${shiftKey}`);
        
        // Get current cell mode
        const { currentEditingPad, presetData } = window.BitboxerData;
        let cellmode = '0';
        if (currentEditingPad) {
            const row = parseInt(currentEditingPad.dataset.row);
            const col = parseInt(currentEditingPad.dataset.col);
            cellmode = presetData.pads[row][col]?.params?.cellmode || '0';
        }

        console.log(`Cellmode: ${cellmode}`);

        // Shift+Click in slicer mode = add slice marker
        if (shiftKey && cellmode === '2') {
            console.log('Shift+Click detected, adding slice');
            const result = this.addSliceAtPosition(x);
            console.log(`addSliceAtPosition returned: ${result}`);
            return true;
        }

        // Check if clicking near a standard marker handle (top 20px)
        if (y <= 20 && (cellmode === '0' || cellmode === '3')) {
            const threshold = 10;
            console.log('Checking standard markers (top 20px zone)');

            for (const [name, marker] of Object.entries(this.markers)) {
                const markerX = this.renderer.sampleToX(marker.sample);
                console.log(`  Marker ${name}: x=${markerX}, distance=${Math.abs(x - markerX)}`);

                if (Math.abs(x - markerX) < threshold) {
                    this.dragging = { type: 'marker', name };
                    console.log(`✓ Started dragging ${name} marker`);
                    return true;
                }
            }
        }

        // In slicer mode, check for dragging slice markers
        if (cellmode === '2') {
            const threshold = 10;
            console.log(`Checking slice markers (${this.sliceMarkers.length} slices)`);

            for (let i = 0; i < this.sliceMarkers.length; i++) {
                const markerX = this.renderer.sampleToX(this.sliceMarkers[i]);
                console.log(`  Slice ${i}: x=${markerX}, distance=${Math.abs(x - markerX)}`);

                if (Math.abs(x - markerX) < threshold) {
                    this.dragging = { type: 'slice', index: i };
                    console.log(`✓ Started dragging slice marker ${i}`);
                    return true;
                }
            }
        }

        console.log('✗ No marker grabbed, returning false');
        return false;
    }

    handleRightClick(x, y) {
        // Only for deleting slice markers in slicer mode
        const { currentEditingPad, presetData } = window.BitboxerData;
        let cellmode = '0';
        if (currentEditingPad) {
            const row = parseInt(currentEditingPad.dataset.row);
            const col = parseInt(currentEditingPad.dataset.col);
            cellmode = presetData.pads[row][col]?.params?.cellmode || '0';
        }

        // Only allow deletion in slicer mode
        if (cellmode !== '2') {
            console.log('Right-click ignored - not in slicer mode');
            return false;
        }

        const threshold = 10;

        for (let i = 0; i < this.sliceMarkers.length; i++) {
            const markerX = this.renderer.sampleToX(this.sliceMarkers[i]);
            if (Math.abs(x - markerX) < threshold) {
                console.log(`Right-click: Deleting slice marker ${i}`);
                this.removeSliceAtIndex(i);
                return true;
            }
        }

        console.log('Right-click: No slice marker found at position');
        return false;
    }

    handleMouseMove(x) {
        if (!this.dragging) return false;
        
        let sample = this.renderer.xToSample(x);
        
        if (this.dragging.type === 'marker') {
            const marker = this.markers[this.dragging.name];
            sample = this.snapToZeroCrossing(sample, marker);
            
            // Just set the marker - don't worry about other markers
            this.setMarker(this.dragging.name, sample);
            this.updatePadParams();
        } else if (this.dragging.type === 'slice') {
            const channelData = this.renderer.waveformData.channelData[0];
            sample = this.findZeroCrossing(sample, channelData);
            
            // Just update this slice - don't sort or check others
            this.sliceMarkers[this.dragging.index] = sample;
            this.updateSlicesToPad();
        }
        
        return true;
    }

    handleMouseUp() {
        if (this.dragging) {
            this.dragging = null;
            return true;
        }
        return false;
    }

    updatePadParams() {
        const { currentEditingPad, presetData } = window.BitboxerData;
        if (!currentEditingPad) return;

        const row = parseInt(currentEditingPad.dataset.row);
        const col = parseInt(currentEditingPad.dataset.col);
        const pad = presetData.pads[row][col];

        // Set flag to prevent circular updates - MUST be set BEFORE any slider updates
        this.isUpdatingFromDrag = true;

        // Validate marker samples before using them
        const startSample = this.markers.start.sample;
        const endSample = this.markers.end.sample;
        const loopStartSample = this.markers.loopStart.sample;
        const loopEndSample = this.markers.loopEnd.sample;
        
        // Guard against NaN/invalid values
        if (isNaN(startSample) || isNaN(endSample) || isNaN(loopStartSample) || isNaN(loopEndSample)) {
            console.error('Invalid marker samples detected, skipping update');
            this.isUpdatingFromDrag = false;
            return;
        }

        // Update pad params
        pad.params.samstart = startSample.toString();
        pad.params.samlen = Math.max(0, endSample - startSample).toString();
        pad.params.loopstart = loopStartSample.toString();
        pad.params.loopend = loopEndSample.toString();

        // Update sliders (this will trigger input events, but flag prevents sync)
        ['samstart', 'samlen', 'loopstart', 'loopend'].forEach(param => {
            const slider = document.getElementById(param);
            if (slider) {
                slider.value = pad.params[param];
                window.BitboxerUtils.updateParamDisplay(param, pad.params[param]);
            }
        });

        // Clear flag immediately after slider updates (synchronous)
        this.isUpdatingFromDrag = false;
    }

    updateSlicesToPad() {
        const { currentEditingPad, presetData } = window.BitboxerData;
        if (!currentEditingPad) return;

        const row = parseInt(currentEditingPad.dataset.row);
        const col = parseInt(currentEditingPad.dataset.col);
        const pad = presetData.pads[row][col];

        // Sort slices by position
        this.sliceMarkers.sort((a, b) => a - b);

        // Update pad slices array
        pad.slices = this.sliceMarkers.map(sample => ({ pos: sample.toString() }));
    }

    syncFromPadParams(pad) {
        // Parse and validate all values
        const samstart = parseInt(pad.params.samstart);
        const samlen = parseInt(pad.params.samlen);
        const loopstart = parseInt(pad.params.loopstart);
        const loopend = parseInt(pad.params.loopend);
        
        // Guard against NaN - use 0 as fallback
        const validStart = isNaN(samstart) ? 0 : samstart;
        const validLen = isNaN(samlen) ? 0 : samlen;
        const validLoopStart = isNaN(loopstart) ? 0 : loopstart;
        const validLoopEnd = isNaN(loopend) ? validLen : loopend;
        
        console.log(`syncFromPadParams: start=${validStart}, len=${validLen}, loopStart=${validLoopStart}, loopEnd=${validLoopEnd}`);
        
        this.setMarker('start', validStart);
        this.setMarker('end', validStart + validLen);
        this.setMarker('loopStart', validLoopStart);
        this.setMarker('loopEnd', validLoopEnd);
        
        // Load slices if in slicer mode
        if (pad.params.cellmode === '2' && pad.slices) {
            this.sliceMarkers = pad.slices.map(slice => {
                const pos = parseInt(slice.pos);
                return isNaN(pos) ? 0 : pos;
            }).filter(pos => pos > 0); // Remove invalid slices
        } else {
            this.sliceMarkers = [];
        }
    }

    addSliceAtPosition(x) {
        const sample = this.renderer.xToSample(x);
        const channelData = this.renderer.waveformData.channelData[0];
        const snappedSample = this.findZeroCrossing(sample, channelData);
        
        // Don't add if too close to existing slice
        const minDistance = 1000; // samples
        const tooClose = this.sliceMarkers.some(s => Math.abs(s - snappedSample) < minDistance);
        if (tooClose) {
            console.log('Slice too close to existing marker, ignoring');
            return false;
        }

        this.sliceMarkers.push(snappedSample);
        this.sliceMarkers.sort((a, b) => a - b); // Keep sorted
        this.updateSlicesToPad();

        console.log(`Added slice marker at sample ${snappedSample}`);
        return true;
    }

    removeSliceAtIndex(index) {
        this.sliceMarkers.splice(index, 1);
        this.updateSlicesToPad();
    }

    autoDetectSlices(threshold = 0.1) {
        if (!this.renderer.waveformData) return;

        const channelData = this.renderer.waveformData.channelData[0];
        const length = channelData.length;
        const slices = []; // Don't include 0, let it be implicit

        let inSilence = false;
        let silenceStart = 0;

        for (let i = 0; i < length; i++) {
            const amplitude = Math.abs(channelData[i]);

            if (!inSilence && amplitude < threshold) {
                inSilence = true;
                silenceStart = i;
            } else if (inSilence && amplitude >= threshold) {
                inSilence = false;
                const slicePoint = this.findZeroCrossing(i, channelData);

                // Only add if not too close to previous slice
                const lastSlice = slices.length > 0 ? slices[slices.length - 1] : 0;
                if (slicePoint - lastSlice > 1000) {
                    slices.push(slicePoint);
                }
            }
        }

        this.sliceMarkers = slices;
        this.updateSlicesToPad();

        console.log(`Auto-detected ${slices.length} slice markers`);
    }
}

// ============================================
// ZOOM CONTROLLER
// ============================================
class ZoomController {
    constructor(renderer) {
        this.renderer = renderer;
        this.minZoom = 1;
        this.maxZoom = 10000;
    }

    setZoom(zoom) {
        this.renderer.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
        
        // FIX: Clamp scroll position when zoom changes
        const maxScroll = Math.max(0, 1 - (1 / this.renderer.zoom));
        this.renderer.scrollPos = Math.min(this.renderer.scrollPos, maxScroll);
        
        this.renderer.render();
    }

    setScroll(scrollPos) {
        this.renderer.scrollPos = Math.max(0, Math.min(1 - 1 / this.renderer.zoom, scrollPos));
        this.renderer.render();
    }

    handleWheel(deltaY, mouseX) {
        if (!this.renderer.waveformData) return;
        
        const oldZoom = this.renderer.zoom;
        const oldScroll = this.renderer.scrollPos;
        const width = this.renderer.width;
        const totalSamples = this.renderer.waveformData.length;
        
        // Calculate zoom change
        const zoomFactor = deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, oldZoom * zoomFactor));
        
        // Find which sample is currently at mouseX position
        const oldVisibleSamples = totalSamples / oldZoom;
        const oldStartSample = oldScroll * (totalSamples - oldVisibleSamples);
        const sampleAtMouse = oldStartSample + (mouseX / width) * oldVisibleSamples;
        
        // Calculate new scroll position to keep that sample at mouseX
        const newVisibleSamples = totalSamples / newZoom;
        const newStartSample = sampleAtMouse - (mouseX / width) * newVisibleSamples;
        
        // Convert to scroll position (0 to 1 - 1/zoom)
        const maxStartSample = totalSamples - newVisibleSamples;
        const newScroll = maxStartSample > 0 ? newStartSample / maxStartSample : 0;
        
        // Clamp scroll position
        const maxScroll = Math.max(0, 1 - 1 / newZoom);
        this.renderer.zoom = newZoom;
        this.renderer.scrollPos = Math.max(0, Math.min(maxScroll, newScroll));
        
        this.renderer.render();
    }
}

// ============================================
// MAIN SAMPLE EDITOR
// ============================================
class SampleEditor {
    constructor() {
        this.renderer = null;
        this.audioEngine = new AudioEngine();
        this.markerController = null;
        this.zoomController = null;
        this.animationFrame = null;
        this.currentMode = '0';
        this.granularAnimating = false;

        // Selection state
        this.selectionStart = null;  
        this.selectionEnd = null; 

        // Prevent duplicate event listeners   
        this._eventListenersAttached = false;  

        // Render throttling
        this._renderScheduled = false;
    }

    async init(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        this.renderer = new WaveformRenderer(canvas);
        this.markerController = new MarkerController(this.renderer, this.audioEngine);
        this.zoomController = new ZoomController(this.renderer);

        this.setupEventListeners(canvas);
        this.renderer.resize();
    }

    scheduleRender() {
        if (this._renderScheduled) return;
        
        this._renderScheduled = true;
        requestAnimationFrame(() => {
            this._renderScheduled = false;
            this.render();
        });
    }

    setupEventListeners(canvas) {
        // CRITICAL: Remove any existing listeners to prevent duplicates
        if (this._eventListenersAttached) {
            console.warn('Event listeners already attached, skipping duplicate setup');
            return;
        }
        this._eventListenersAttached = true;

        // Mouse state variables
        let isDragging = false;
        let isSelecting = false;
        let lastMouseX = null;
        let lastMouseY = null;

        // ==================== MOUSEDOWN ====================
        canvas.addEventListener('mousedown', (e) => {
            e.preventDefault();

            // Reset mouse tracking
            lastMouseX = null;
            lastMouseY = null;

            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Get current mode
            const { currentEditingPad, presetData } = window.BitboxerData;
            let currentMode = '0';
            if (currentEditingPad) {
                const row = parseInt(currentEditingPad.dataset.row);
                const col = parseInt(currentEditingPad.dataset.col);
                currentMode = presetData.pads[row][col].params.cellmode || '0';
            }

            // LEFT CLICK (button 0)
            if (e.button === 0) {
                // Try to grab a marker first
                if (this.markerController.handleMouseDown(x, y, currentMode, e.shiftKey)) {
                    isDragging = true;
                    console.log('Started dragging marker');
                } else {
                    // No marker grabbed - start selection
                    isSelecting = true;
                    const startSample = this.renderer.xToSample(x);
                    this.selectionStart = startSample;
                    this.selectionEnd = startSample;
                    console.log(`Selection started at sample ${startSample}`);
                }
            }
        });

        // ==================== MOUSEMOVE ====================
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Check if mouse actually moved
            const moved = (lastMouseX === null || Math.abs(x - lastMouseX) > 1 || Math.abs(y - lastMouseY) > 1);
            lastMouseX = x;
            lastMouseY = y;

            if (!moved) return;

            if (isDragging) {
                if (this.markerController.handleMouseMove(x)) {
                    this.scheduleRender();  // ← Changed from this.render()
                }
            } else if (isSelecting) {
                const endSample = this.renderer.xToSample(x);
                this.selectionEnd = endSample;
                this.scheduleRender();  // ← Changed from this.render()
            }
        });

        // ==================== MOUSEUP ====================
        canvas.addEventListener('mouseup', (e) => {
            if (isDragging) {
                this.markerController.handleMouseUp();
                isDragging = false;
                this.render();
                console.log('Stopped dragging marker');
            } else if (isSelecting) {
                isSelecting = false;
                // Ensure selection is in correct order
                if (this.selectionStart > this.selectionEnd) {
                    [this.selectionStart, this.selectionEnd] = [this.selectionEnd, this.selectionStart];
                }
                console.log(`Selection finalized: ${this.selectionStart} to ${this.selectionEnd}`);
                this.render();
            }
        });

        // ==================== RIGHT-CLICK (CONTEXTMENU) ====================
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
        
            // Get current mode
            const { currentEditingPad, presetData } = window.BitboxerData;
            let currentMode = '0';
            if (currentEditingPad) {
                const row = parseInt(currentEditingPad.dataset.row);
                const col = parseInt(currentEditingPad.dataset.col);
                currentMode = presetData.pads[row][col].params.cellmode || '0';
            }
        
            // Only handle in slicer mode
            if (currentMode === '2') {
                const clickSample = this.renderer.xToSample(x);

                // Check if clicking on existing marker (delete it)
                const threshold = 10;
                for (let i = 0; i < this.markerController.sliceMarkers.length; i++) {
                    const markerX = this.renderer.sampleToX(this.markerController.sliceMarkers[i]);
                    if (Math.abs(x - markerX) < threshold) {
                        // Delete marker
                        this.markerController.removeSliceAtIndex(i);
                        this.render();
                        return;
                    }
                }

                // Check if clicking within selection
                if (this.selectionStart !== null && this.selectionEnd !== null &&
                    clickSample >= this.selectionStart && clickSample <= this.selectionEnd) {
                    
                    // Show context menu for adding slices
                    this.showSliceContextMenu(e.pageX, e.pageY);
                    return;
                }
            }
        });

        // ==================== MOUSE WHEEL (ZOOM) ====================
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;

            // If there's a selection, zoom toward selection center
            let zoomPoint = x;
            if (this.selectionStart !== null && this.selectionEnd !== null && 
                !isNaN(this.selectionStart) && !isNaN(this.selectionEnd)) {
                const selectionCenter = (this.selectionStart + this.selectionEnd) / 2;
                zoomPoint = this.renderer.sampleToX(selectionCenter);
            }

            this.zoomController.handleWheel(e.deltaY, zoomPoint);
        
            // Update slider
            const zoomSlider = document.getElementById('zoomSlider');
            const zoomValue = document.getElementById('zoomValue');
            if (zoomSlider && zoomValue) {
                zoomSlider.value = this.renderer.zoom;
                zoomValue.textContent = this.renderer.zoom.toFixed(1) + 'x';
            }
        
            this.render();
        });

        // ==================== WINDOW RESIZE ====================
        window.addEventListener('resize', () => {
            this.renderer.resize();
            this.render();
        });
    }

    showSliceContextMenu(pageX, pageY) {
        // Remove any existing context menu
        const existing = document.getElementById('sliceContextMenu');
        if (existing) existing.remove();
        
        // Create context menu
        const menu = document.createElement('div');
        menu.id = 'sliceContextMenu';
        menu.className = 'context-menu show';
        menu.style.left = pageX + 'px';
        menu.style.top = pageY + 'px';
        
        menu.innerHTML = `
            <div class="context-item" data-action="start">Add slice at selection start</div>
            <div class="context-item" data-action="end">Add slice at selection end</div>
            <div class="context-item" data-action="both">Add slices at both</div>
            <div class="context-item separator"></div>
            <div class="context-item" data-action="cancel">Cancel</div>
        `;
        
        document.body.appendChild(menu);
        
        // Handle menu clicks
        menu.addEventListener('click', (e) => {
            const action = e.target.dataset.action;

            if (action === 'start') {
                this.markerController.addSliceAtSample(this.selectionStart);
            } else if (action === 'end') {
                this.markerController.addSliceAtSample(this.selectionEnd);
            } else if (action === 'both') {
                this.markerController.addSliceAtSample(this.selectionStart);
                this.markerController.addSliceAtSample(this.selectionEnd);
            }

            // Remove menu
            menu.remove();

            // Re-render if slices were added
            if (action !== 'cancel') {
                this.render();
            }
        });

        // Close menu on any other click
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    async loadSample(wavFile) {
        try {
            const arrayBuffer = await wavFile.arrayBuffer();
            const audioBuffer = await this.audioEngine.loadAudio(arrayBuffer);
            this.renderer.setWaveformData(audioBuffer);
            
            // Sync markers from pad params
            const { currentEditingPad, presetData } = window.BitboxerData;
            if (currentEditingPad) {
                const row = parseInt(currentEditingPad.dataset.row);
                const col = parseInt(currentEditingPad.dataset.col);
                const pad = presetData.pads[row][col];
                this.markerController.syncFromPadParams(pad);
            }

            this.render();

            // Update slider max values now that we have actual audio buffer
            // const { currentEditingPad, presetData } = window.BitboxerData;
            if (currentEditingPad) {
                const row = parseInt(currentEditingPad.dataset.row);
                const col = parseInt(currentEditingPad.dataset.col);
                const pad = presetData.pads[row][col];
                window.BitboxerPadEditor.updateSliderMaxValues(pad);
            }

            return true;
        } catch (error) {
            console.error('Failed to load sample:', error);
            return false;
        }
    }

    render() {
        // CRITICAL: Don't render if canvas width is invalid
        if (!this.renderer || !this.renderer.width || this.renderer.width <= 0) {
            return; // Canvas not ready, skip render
        }

        this.renderer.render();
        this.markerController.draw();

        // Draw mode-specific overlays
        const { currentEditingPad, presetData } = window.BitboxerData;
        if (!currentEditingPad) return;

        const row = parseInt(currentEditingPad.dataset.row);
        const col = parseInt(currentEditingPad.dataset.col);
        const pad = presetData.pads[row][col];

        if (this.currentMode === '1') {
            const tempo = presetData.tempo || '120';
            this.markerController.drawClipBeatGrid(pad.params, tempo);
        } else if (this.currentMode === '3') {
            this.markerController.drawGranularOverlay(pad.params);
        }

        // Draw selection overlay if exists
        if (this.selectionStart !== null && this.selectionEnd !== null &&
            !isNaN(this.selectionStart) && !isNaN(this.selectionEnd)) {
            const ctx = this.renderer.ctx;
            const x1 = this.renderer.sampleToX(this.selectionStart);
            const x2 = this.renderer.sampleToX(this.selectionEnd);
            const width = this.renderer.width;
            const height = this.renderer.height;

            // Draw selection highlight
            ctx.fillStyle = 'rgba(74, 158, 255, 0.2)';
            ctx.fillRect(x1, 0, x2 - x1, height);

            // Draw selection borders
            ctx.strokeStyle = '#4a9eff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x1, 0);
            ctx.lineTo(x1, height);
            ctx.moveTo(x2, 0);
            ctx.lineTo(x2, height);
            ctx.stroke();
        }

        // Draw playback position if playing
        if (this.audioEngine.isPlaying) {
            const currentSample = this.audioEngine.getCurrentSample();
            if (!isNaN(currentSample)) {
                const x = this.renderer.sampleToX(currentSample);
                const ctx = this.renderer.ctx;
                const height = this.renderer.height;
                
                ctx.strokeStyle = '#5eff5e';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
        }    
    }

    startGranularAnimation() {
        if (this.granularAnimating) return;
        this.granularAnimating = true;

        let lastFrameTime = 0;
        const targetFPS = 24;
        const frameInterval = 1000 / targetFPS;  // ~41.67ms

        const animate = (currentTime) => {
            // Stop if animation disabled or mode is not granular
            if (!this.granularAnimating || this.currentMode !== '3') {
                this.granularAnimating = false;
                if (this.animationFrame) {
                    cancelAnimationFrame(this.animationFrame);
                    this.animationFrame = null;
                }
                return;
            }

            // Throttle to 24fps
            if (currentTime - lastFrameTime >= frameInterval) {
                lastFrameTime = currentTime;

                // Only render if canvas is ready and visible
                if (this.renderer && this.renderer.width > 0) {
                    this.render();
                }
            }

            this.animationFrame = requestAnimationFrame(animate);
        };

        this.animationFrame = requestAnimationFrame(animate);
    }

    updateGranularParams() {
        this.render();
    }

    stopGranularAnimation() {
        this.granularAnimating = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    setMode(mode) {
        this.currentMode = mode;
        
        // Only granular mode needs continuous animation
        if (mode === '3') {
            this.startGranularAnimation();
        } else {
            this.stopGranularAnimation();
            // Single render to update display
            this.render();
        }
    }

    play() {
        const { currentEditingPad, presetData } = window.BitboxerData;
        if (!currentEditingPad) return;

        const row = parseInt(currentEditingPad.dataset.row);
        const col = parseInt(currentEditingPad.dataset.col);
        const pad = presetData.pads[row][col];

        const params = {
            startSample: parseInt(pad.params.samstart) || 0,
            endSample: (parseInt(pad.params.samstart) || 0) + (parseInt(pad.params.samlen) || this.audioEngine.audioBuffer.length),
            loopStartSample: parseInt(pad.params.loopstart) || 0,
            loopEndSample: parseInt(pad.params.loopend) || this.audioEngine.audioBuffer.length,
            loopEnabled: pad.params.loopmode === '1',
            reverse: pad.params.reverse === '1'
        };

        this.audioEngine.play(params);
        this.startPlaybackAnimation();  // ← This animates playhead during playback

    }

    stop() {
        this.audioEngine.stop();
    }

    playSelection() {
        // Validate selection
        if (this.selectionStart === null || this.selectionEnd === null ||
            isNaN(this.selectionStart) || isNaN(this.selectionEnd) ||
            this.selectionStart === this.selectionEnd) {
            console.warn('No valid selection to play');
            window.BitboxerUtils.setStatus('No selection made - drag in waveform to select', 'error');
            return;
        }

        console.log(`Playing selection: ${this.selectionStart} to ${this.selectionEnd}`);

        this.audioEngine.play({
            startSample: Math.floor(this.selectionStart),
            endSample: Math.floor(this.selectionEnd),
            loopEnabled: false,
            reverse: false
        });

        this.startPlaybackAnimation();
    }

    startPlaybackAnimation() {
        if (this.playbackAnimationFrame) {
            cancelAnimationFrame(this.playbackAnimationFrame);
        }

        const animate = () => {
            if (!this.audioEngine.isPlaying) {
                this.playbackAnimationFrame = null;
                if (this.renderer && this.renderer.width > 0) {
                    this.render();
                }
                return;
            }

            // Only render if canvas is ready
            if (this.renderer && this.renderer.width > 0) {
                this.render();
            }

            this.playbackAnimationFrame = requestAnimationFrame(animate);
        };

        this.playbackAnimationFrame = requestAnimationFrame(animate);
    }

    playSlice(sliceIndex) {
        if (!this.markerController.sliceMarkers.length) return;

        const slices = this.markerController.sliceMarkers;
        const startSample = slices[sliceIndex];
        const endSample = slices[sliceIndex + 1] || this.audioEngine.audioBuffer.length;

        this.audioEngine.play({
            startSample,
            endSample,
            loopEnabled: false,
            reverse: false
        });
    }

    autoDetectSlices(threshold = 0.1) {
        this.markerController.autoDetectSlices(threshold);
        this.render();
    }

    setZoom(zoom) {
        this.zoomController.setZoom(zoom);
        this.render();
    }

    setScroll(scroll) {
        this.zoomController.setScroll(scroll);
        this.render();
    }
}

// ============================================
// EXPORT
// ============================================
window.BitboxerSampleEditor = new SampleEditor();