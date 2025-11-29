/**
 * BITBOXER - Sample Editor
 * 
 * Visual waveform editor with playback and draggable markers
 * Mode-aware display (Sample/Clip/Slicer/Granular)
 */

// ============================================
// CONSTANTS
// ============================================
const AUTODETECT_DEBOUNCE_MS = 500;

// ============================================
// WAVEFORM RENDERER
// ============================================
class WaveformRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.waveformData = null;
        this.zoom = 1; // 1 = full view, >1 = zoomed in
        this.scrollSample = 0;  // INTEGER sample offset (absolute position)
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

        // Reset scroll to start when loading new sample
        this.scrollSample = 0;
        this.zoom = 1;
        
        this.render();
    }

    resize() {
        const container = this.canvas.parentElement;
        const dpr = window.devicePixelRatio || 1;
        
        this.width = container.offsetWidth;
        this.height = 200;
        
        // Only resize if container has valid dimensions
        if (this.width <= 0 || this.height <= 0) {
            console.warn('Canvas container has zero size, deferring resize');
            return;
        }
        
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';
        
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);
        
        this.render();
    }

    render() {
        if (!this.waveformData || this.width <= 0 || this.height <= 0) return;

        const { ctx, width, height, waveformData, zoom, scrollSample } = this;
        const { channels, length, channelData } = waveformData;

        // Clear canvas
        ctx.fillStyle = '#1a1614';
        ctx.fillRect(0, 0, width, height);

        // Calculate visible sample range - INTEGER MATH
        const visibleSamples = Math.max(1, Math.floor(length / zoom));
        const maxScroll = Math.max(0, length - visibleSamples);
        const clampedScrollSample = Math.max(0, Math.min(maxScroll, scrollSample));
        
        const startSample = clampedScrollSample;
        const endSample = Math.min(length, startSample + visibleSamples);
        
        // CRITICAL FIX: Use the SAME math as sampleToX() and xToSample()
        // This ensures perfect alignment between waveform and markers
        // We render exactly what the coordinate functions expect
        
        const channelHeight = height / channels;

        // Draw each channel
        for (let ch = 0; ch < channels; ch++) {
            const data = channelData[ch];
            const yOffset = ch * channelHeight + channelHeight / 2;

            ctx.strokeStyle = '#ffa600';
            ctx.lineWidth = 1;
            ctx.beginPath();

            for (let x = 0; x < width; x++) {
                // Use EXACT inverse of sampleToX() calculation
                // sampleToX formula: pixelPos = (offsetFromScroll / visibleSamples) * width
                // Inverse: offsetFromScroll = (x / width) * visibleSamples
                const ratio = x / width;
                const sampleOffset = ratio * visibleSamples;
                const sampleIdxFloat = startSample + sampleOffset;

                // Get the sample index (floor for starting point)
                const sampleIdx = Math.floor(sampleIdxFloat);

                // Calculate how many samples this pixel represents
                const nextRatio = (x + 1) / width;
                const nextSampleOffset = nextRatio * visibleSamples;
                const nextSampleIdxFloat = startSample + nextSampleOffset;
                const sampleEnd = Math.min(length, Math.ceil(nextSampleIdxFloat));

                // Ensure we always sample at least one sample
                const actualEnd = Math.max(sampleIdx + 1, sampleEnd);

                // Find min/max in this pixel's sample range
                let min = 1, max = -1;
                for (let i = sampleIdx; i < actualEnd && i < length; i++) {
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
    }

    /**
     * FIXED: Converts absolute sample position to screen X coordinate
     * Returns pixel position relative to current scroll/zoom viewport
     */
    sampleToX(sample) {
        if (!this.waveformData || this.width <= 0) return 0;
        
        const { length } = this.waveformData;
        const { zoom, scrollSample, width } = this;
        
        // Calculate visible range
        const visibleSamples = Math.max(1, Math.floor(length / zoom));
        
        // Calculate offset from scroll position
        const offsetFromScroll = sample - scrollSample;
        
        // Convert to pixel position
        const pixelPos = (offsetFromScroll / visibleSamples) * width;
        
        return pixelPos;
    }

    /**
     * FIXED: Converts screen X coordinate to absolute sample position
     * Returns integer sample index in full audio buffer
     */
    xToSample(x) {
        if (!this.waveformData || this.width <= 0) return 0;
        
        const { length } = this.waveformData;
        const { zoom, scrollSample, width } = this;
        
        // Calculate visible range
        const visibleSamples = Math.max(1, Math.floor(length / zoom));
        
        // Convert pixel to sample offset
        const ratio = x / width;
        const sampleOffset = Math.floor(ratio * visibleSamples);
        
        // Add to scroll position for absolute sample
        const absoluteSample = scrollSample + sampleOffset;
        
        // Clamp to valid range
        return Math.max(0, Math.min(length - 1, absoluteSample));
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
        this.playbackStartSample = 0;
        this.playbackEndSample = 0;
        this.loopStartSample = 0;
        this.loopEndSample = 0;
        this.loopEnabled = false;
        this.isReversed = false;
        this.reversedBuffer = null;
    }

    async init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    async loadAudio(arrayBuffer) {
        await this.init();
        this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice(0));
        this.reversedBuffer = null; // Clear any cached reversed buffer
        return this.audioBuffer;
    }

    /**
     * Creates a reversed copy of the audio buffer
     */
    createReversedBuffer(buffer) {
        const reversedBuffer = this.audioContext.createBuffer(
            buffer.numberOfChannels,
            buffer.length,
            buffer.sampleRate
        );

        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const inputData = buffer.getChannelData(channel);
            const outputData = reversedBuffer.getChannelData(channel);
            
            for (let i = 0; i < buffer.length; i++) {
                outputData[i] = inputData[buffer.length - 1 - i];
            }
        }

        return reversedBuffer;
    }

    play(params = {}) {
        if (!this.audioBuffer) return;
        
        this.stop();

        const {
            startSample = 0,
            endSample = this.audioBuffer.length,
            loopStartSample = 0,
            loopEndSample = this.audioBuffer.length,
            loopEnabled = false,
            reverse = false
        } = params;

        // Validate parameters
        if (startSample >= endSample) {
            console.error('Invalid playback range: start >= end');
            return;
        }

        const sampleRate = this.audioBuffer.sampleRate;

        // Store playback state
        this.playbackStartSample = startSample;
        this.playbackEndSample = endSample;
        this.loopStartSample = loopStartSample;
        this.loopEndSample = loopEndSample;
        this.loopEnabled = loopEnabled;
        this.isReversed = reverse;

        // Handle reverse playback
        let bufferToPlay = this.audioBuffer;
        let adjustedStart = startSample;
        let adjustedEnd = endSample;
        let adjustedLoopStart = loopStartSample;
        let adjustedLoopEnd = loopEndSample;

        if (reverse) {
            // Create reversed buffer if not cached
            if (!this.reversedBuffer) {
                this.reversedBuffer = this.createReversedBuffer(this.audioBuffer);
            }
            bufferToPlay = this.reversedBuffer;
            
            // Flip the sample positions for reversed buffer
            const bufferLength = this.audioBuffer.length;
            adjustedStart = bufferLength - endSample;
            adjustedEnd = bufferLength - startSample;
            adjustedLoopStart = bufferLength - loopEndSample;
            adjustedLoopEnd = bufferLength - loopStartSample;
        }

        this.source = this.audioContext.createBufferSource();
        this.source.buffer = bufferToPlay;
        this.source.connect(this.audioContext.destination);

        const startTime = adjustedStart / sampleRate;
        const duration = (adjustedEnd - adjustedStart) / sampleRate;

        if (loopEnabled) {
            this.source.loop = true;
            this.source.loopStart = adjustedLoopStart / sampleRate;
            this.source.loopEnd = adjustedLoopEnd / sampleRate;
        }

        this.source.start(0, startTime, loopEnabled ? undefined : duration);

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

    /**
     * FIXED: Returns current playback position with loop handling
     */
    getCurrentSample() {
        if (!this.isPlaying || !this.audioBuffer) return 0;
        
        const elapsed = this.audioContext.currentTime - this.startTime;
        const elapsedSamples = elapsed * this.audioBuffer.sampleRate;
        
        if (this.loopEnabled) {
            // Calculate position within loop
            const loopLength = this.loopEndSample - this.loopStartSample;
            const preLoopLength = this.loopStartSample - this.playbackStartSample;
            
            if (elapsedSamples < preLoopLength) {
                // Before loop starts
                return this.playbackStartSample + elapsedSamples;
            } else {
                // Inside loop - wrap around
                const loopElapsed = elapsedSamples - preLoopLength;
                const loopPosition = loopElapsed % loopLength;
                return this.loopStartSample + loopPosition;
            }
        } else {
            // Non-looping - simple linear playback
            const currentSample = this.playbackStartSample + elapsedSamples;
            return Math.min(currentSample, this.playbackEndSample);
        }
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
        this.snapToZeroCrossingEnabled = true;  // Default ON
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
        
        // Conditionally snap based on toggle state
        const finalSample = this.snapToZeroCrossingEnabled
            ? this.findZeroCrossing(sample, channelData)
            : sample;
        
        // Don't add if too close to existing
        const minDistance = 100;
        const tooClose = this.sliceMarkers.some(s => Math.abs(s - finalSample) < minDistance);
        if (tooClose) {
            console.log('Slice too close to existing marker');
            return false;
        }

        this.sliceMarkers.push(finalSample);
        this.sliceMarkers.sort((a, b) => a - b);
        this.updateSlicesToPad();

        const snapStatus = this.snapToZeroCrossingEnabled ? 'snapped' : 'exact';
        console.log(`Added slice at sample ${finalSample} (${snapStatus})`);
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

                // Determine if this is a loop marker
                const isLoopMarker = (name === 'loopStart' || name === 'loopEnd');

                // Draw vertical line
                ctx.strokeStyle = marker.color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            
                // Position label and handle based on marker type
                const labelY = isLoopMarker ? height - 17 : 5;
                const handleY = isLoopMarker ? height - 20 : 0;

                // Draw label background for readability
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(x + 3, labelY, 80, 12);

                // Draw label
                ctx.fillStyle = marker.color;
                ctx.font = '10px monospace';
                ctx.fillText(marker.label, x + 5, labelY + 10);

                // Draw draggable handle
                ctx.fillStyle = marker.color;
                ctx.fillRect(x - 5, handleY, 10, 20);
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

        // NO ANIMATION - Static display only
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

        // Check standard markers (STRICT: must be within handle rectangle)
        if (cellmode === '0' || cellmode === '3') {
            const threshold = 5; // Must be within handle width (10px total, ±5px)
            console.log('Checking standard markers');

            for (const [name, marker] of Object.entries(this.markers)) {
                const markerX = this.renderer.sampleToX(marker.sample);
                const isLoopMarker = (name === 'loopStart' || name === 'loopEnd');

                // Strict Y-coordinate check: must be INSIDE handle rectangle
                const handleTop = isLoopMarker ? (this.renderer.height - 20) : 0;
                const handleBottom = isLoopMarker ? this.renderer.height : 20;
                const inHandleY = (y >= handleTop && y <= handleBottom);

                console.log(`  Marker ${name}: x=${markerX}, distance=${Math.abs(x - markerX)}, y=${y}, handleTop=${handleTop}, handleBottom=${handleBottom}, inHandleY=${inHandleY}`);

                // Must be within BOTH X threshold AND Y handle zone
                if (Math.abs(x - markerX) < threshold && inHandleY) {
                    this.dragging = { type: 'marker', name };
                    console.log(`✓ Started dragging ${name} marker`);
                    return true;
                }
            }
        }

        // In slicer mode, check for dragging slice markers (STRICT: top 15px only)
        if (cellmode === '2') {
            const threshold = 3; // Slice handles are smaller (6px wide)
            console.log(`Checking slice markers (${this.sliceMarkers.length} slices)`);

            // STRICT: Must be in top 15px (handle zone)
            if (y <= 15) {
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

            // Apply snap only if enabled
            if (this.snapToZeroCrossingEnabled && marker.snapZeroCross) {
                sample = this.snapToZeroCrossing(sample, marker);
            }

            this.setMarker(this.dragging.name, sample);
            this.updatePadParams();
        } else if (this.dragging.type === 'slice') {
            const channelData = this.renderer.waveformData.channelData[0];

            // Apply snap only if enabled
            if (this.snapToZeroCrossingEnabled) {
                sample = this.findZeroCrossing(sample, channelData);
            }

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
        if (pad.params.cellmode === '2') {
            if (pad.slices && pad.slices.length > 0) {
                this.sliceMarkers = pad.slices.map(slice => {
                    const pos = parseInt(slice.pos);
                    return isNaN(pos) ? 0 : pos;
                }).filter(pos => pos >= 0); // Keep sample 0
            } else {
                // Always start with marker at sample 0 in slicer mode
                this.sliceMarkers = [0];
            }

            // Ensure marker at sample 0 exists
            if (!this.sliceMarkers.includes(0)) {
                this.sliceMarkers.unshift(0);
            }

            // Sort and remove duplicates
            this.sliceMarkers = [...new Set(this.sliceMarkers)].sort((a, b) => a - b);
        } else {
            this.sliceMarkers = [];
        }
    }

    addSliceAtPosition(x) {
        const sample = this.renderer.xToSample(x);
        const channelData = this.renderer.waveformData.channelData[0];
        
        // Conditionally snap based on toggle state
        const finalSample = this.snapToZeroCrossingEnabled 
            ? this.findZeroCrossing(sample, channelData)
            : sample;
        
        // Don't add if too close to existing slice
        const minDistance = 1000; // samples
        const tooClose = this.sliceMarkers.some(s => Math.abs(s - finalSample) < minDistance);
        if (tooClose) {
            console.log('Slice too close to existing marker, ignoring');
            return false;
        }

        this.sliceMarkers.push(finalSample);
        this.sliceMarkers.sort((a, b) => a - b);
        this.updateSlicesToPad();

        const snapStatus = this.snapToZeroCrossingEnabled ? 'snapped' : 'exact';
        console.log(`Added slice marker at sample ${finalSample} (${snapStatus})`);
        return true;
    }

    removeSliceAtIndex(index) {
        this.sliceMarkers.splice(index, 1);
        this.updateSlicesToPad();
    }

    /**
     * Auto-detect slice points using advanced onset detection
     * @param {string} algorithm - 'hfc', 'flux', or 'complex'
     * @param {number} sensitivity - 0.0 to 1.0
     */
    autoDetectSlices(algorithm = 'flux', sensitivity = 0.5) {
        if (!this.renderer.waveformData) return;
    
        console.log(`Auto-detecting slices: ${algorithm}, sensitivity: ${sensitivity}`);
        
        // Create onset detector
        const detector = new OnsetDetector(this.renderer.waveformData, {
            algorithm: algorithm,
            sensitivity: sensitivity,
            windowSize: 1024,
            hopSize: 512,
            minSliceDistance: 1000 // Minimum 1000 samples between slices
        });
        
        // Analyze
        const onsetSamples = detector.analyze();
        
        // Optionally snap to zero crossings
        const channelData = this.renderer.waveformData.channelData[0];
        this.sliceMarkers = onsetSamples.map(sample => 
            this.snapToZeroCrossingEnabled 
                ? this.findZeroCrossing(sample, channelData)
                : sample
        );

        // ALWAYS ensure marker at sample 0 exists in slicer mode
        if (!this.sliceMarkers.includes(0)) {
            this.sliceMarkers.unshift(0);
        }

        // Remove duplicates and sort
        this.sliceMarkers = [...new Set(this.sliceMarkers)].sort((a, b) => a - b);

        this.updateSlicesToPad();
    
        const snapStatus = this.snapToZeroCrossingEnabled ? 'with zero-crossing snap' : 'exact positions';
        console.log(`Detected ${this.sliceMarkers.length} slices using ${algorithm} (${snapStatus})`);
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
        const oldScrollSample = this.renderer.scrollSample;
        const width = this.renderer.width;
        const totalSamples = this.renderer.waveformData.length;
        
        // Calculate zoom change
        const zoomFactor = deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, oldZoom * zoomFactor));
        
        // Find which sample is currently at mouseX position (INTEGER)
        const oldVisibleSamples = Math.floor(totalSamples / oldZoom);
        const sampleAtMouse = oldScrollSample + Math.floor((mouseX / width) * oldVisibleSamples);
        
        // Calculate new scroll position to keep that sample at mouseX (INTEGER)
        const newVisibleSamples = Math.floor(totalSamples / newZoom);
        const newScrollSample = sampleAtMouse - Math.floor((mouseX / width) * newVisibleSamples);
        
        // Clamp to valid range (INTEGER)
        const maxScrollSample = Math.max(0, totalSamples - newVisibleSamples);
        
        this.renderer.zoom = newZoom;
        this.renderer.scrollSample = Math.max(0, Math.min(maxScrollSample, newScrollSample));
        
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
        // this.granularAnimating = false;

        // Selection state
        this.selectionStart = null;  
        this.selectionEnd = null; 

        // Prevent duplicate event listeners   
        this._eventListenersAttached = false;  

        // Render throttling
        this._renderScheduled = false;
    }

    /**
     * Clears only audio/waveform data when switching pads
     * Does NOT reset markers, zoom, or other UI state
     */
    clearAudioData() {
        console.log('SampleEditor: Clearing audio data for pad switch');

        // Stop any playing audio
        this.stop();

        // Clear audio buffers
        if (this.audioEngine) {
            this.audioEngine.audioBuffer = null;
            this.audioEngine.reversedBuffer = null;
            this.audioEngine.isPlaying = false;
        }

        // Clear waveform data but keep canvas sized
        if (this.renderer && this.renderer.waveformData) {
            this.renderer.waveformData = null;

            // Clear canvas visually
            const ctx = this.renderer.ctx;
            if (ctx && this.renderer.width > 0 && this.renderer.height > 0) {
                ctx.fillStyle = '#1a1614';
                ctx.fillRect(0, 0, this.renderer.width, this.renderer.height);
            }
        }

        // Stop animations
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        if (this.playbackAnimationFrame) {
            cancelAnimationFrame(this.playbackAnimationFrame);
            this.playbackAnimationFrame = null;
        }
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
        // Only skip if listeners are attached to THIS SAME canvas
        if (this._eventListenersAttached && this._attachedCanvas === canvas) {
            console.log('Event listeners already attached to this canvas');
            return;
        }

        // Mark this canvas as having listeners attached
        this._eventListenersAttached = true;
        this._attachedCanvas = canvas;

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
                // Check if clicking on selection markers first (if selection exists)
                if (this.selectionStart !== null && this.selectionEnd !== null) {
                    const threshold = 10;
                    const startX = this.renderer.sampleToX(this.selectionStart);
                    const endX = this.renderer.sampleToX(this.selectionEnd);

                    if (Math.abs(x - startX) < threshold) {
                        // Clicked on selection start marker
                        isDragging = true;
                        this.draggingSelectionMarker = 'start';
                        console.log('Dragging selection start');
                        return;
                    } else if (Math.abs(x - endX) < threshold) {
                        // Clicked on selection end marker
                        isDragging = true;
                        this.draggingSelectionMarker = 'end';
                        console.log('Dragging selection end');
                        return;
                    }
                }

                // Try to grab a pad marker
                if (this.markerController.handleMouseDown(x, y, currentMode, e.shiftKey)) {
                    isDragging = true;
                    this.draggingSelectionMarker = null;
                    console.log('Started dragging marker');
                } else {
                    // No marker grabbed - start selection
                    isSelecting = true;
                    this.draggingSelectionMarker = null;
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
        
            // ALWAYS update cursor (don't skip based on movement threshold)
            // This ensures cursor updates even with tiny mouse movements

            if (isDragging) {
                // DRAGGING MODE: Handle marker/selection movement
                // Check if mouse actually moved (for performance)
                const moved = (lastMouseX === null || Math.abs(x - lastMouseX) > 1 || Math.abs(y - lastMouseY) > 1);
                lastMouseX = x;
                lastMouseY = y;

                if (!moved) return;

                if (this.draggingSelectionMarker) {
                    // Dragging selection marker
                    const sample = this.renderer.xToSample(x);
                    if (this.draggingSelectionMarker === 'start') {
                        this.selectionStart = sample;
                    } else {
                        this.selectionEnd = sample;
                    }
                    this.render();
                } else {
                    // Dragging pad marker
                    if (this.markerController.handleMouseMove(x)) {
                        this.render();
                    }
                }
            } else if (isSelecting) {
                // SELECTING MODE: Creating new selection
                const moved = (lastMouseX === null || Math.abs(x - lastMouseX) > 1 || Math.abs(y - lastMouseY) > 1);
                lastMouseX = x;
                lastMouseY = y;

                if (!moved) return;

                const endSample = this.renderer.xToSample(x);
                this.selectionEnd = endSample;
                this.render();
            }

            // ALWAYS check for hover cursor (even during drag/select for smooth transitions)
            // This runs independently of drag state
            let isOverHandle = false;
            const selectionThreshold = 10; // Selection markers: wider detection
            const standardThreshold = 5;   // Standard markers: must be in handle (±5px from center)
            const sliceThreshold = 3;      // Slice markers: smallest handles (±3px from center)

            // Get current mode
            const { currentEditingPad, presetData } = window.BitboxerData;
            let currentMode = '0';
            if (currentEditingPad) {
                const row = parseInt(currentEditingPad.dataset.row);
                const col = parseInt(currentEditingPad.dataset.col);
                currentMode = presetData.pads[row][col].params.cellmode || '0';
            }

            // 1. Check selection markers ANYWHERE on vertical line (if selection exists)
            if (this.selectionStart !== null && this.selectionEnd !== null) {
                const startX = this.renderer.sampleToX(this.selectionStart);
                const endX = this.renderer.sampleToX(this.selectionEnd);

                if (Math.abs(x - startX) < selectionThreshold || Math.abs(x - endX) < selectionThreshold) {
                    isOverHandle = true;
                }
            }

            // 2. Check standard markers in sample/granular modes (STRICT: in handle zone only)
            if (!isOverHandle && (currentMode === '0' || currentMode === '3')) {
                for (const [name, marker] of Object.entries(this.markerController.markers)) {
                    const markerX = this.renderer.sampleToX(marker.sample);

                    if (Math.abs(x - markerX) < standardThreshold) {
                        // STRICT: Check if in correct vertical zone for this marker
                        const isLoopMarker = (name === 'loopStart' || name === 'loopEnd');

                        if (isLoopMarker) {
                            // Loop markers: bottom 20px only
                            if (y >= this.renderer.height - 20) {
                                isOverHandle = true;
                                break;
                            }
                        } else {
                            // Start/End markers: top 20px only
                            if (y <= 20) {
                                isOverHandle = true;
                                break;
                            }
                        }
                    }
                }
            }

            // 3. Check slice markers in slicer mode (STRICT: top 15px only)
            if (!isOverHandle && currentMode === '2') {
                for (let i = 0; i < this.markerController.sliceMarkers.length; i++) {
                    const markerX = this.renderer.sampleToX(this.markerController.sliceMarkers[i]);
                    if (Math.abs(x - markerX) < sliceThreshold && y <= 15) {
                        isOverHandle = true;
                        break;
                    }
                }
            }

            // Update cursor - ALWAYS, regardless of drag state
            canvas.style.cursor = isOverHandle ? 'ew-resize' : 'crosshair';
        });

        // ==================== MOUSE ENTER/LEAVE ====================
        canvas.addEventListener('mouseenter', () => {
            canvas.style.cursor = 'crosshair';
        });

        canvas.addEventListener('mouseleave', () => {
            canvas.style.cursor = 'default';
            // Reset tracking
            lastMouseX = null;
            lastMouseY = null;
        });

        // ==================== MOUSEUP ====================
        canvas.addEventListener('mouseup', (e) => {
            if (isDragging) {
                if (this.draggingSelectionMarker) {
                    // Ensure selection is in correct order
                    if (this.selectionStart > this.selectionEnd) {
                        [this.selectionStart, this.selectionEnd] = [this.selectionEnd, this.selectionStart];
                    }
                    
                    // Apply snap to zero-crossing if enabled
                    if (this.markerController.snapToZeroCrossingEnabled && this.renderer.waveformData) {
                        const channelData = this.renderer.waveformData.channelData[0];
                        this.selectionStart = this.markerController.findZeroCrossing(this.selectionStart, channelData);
                        this.selectionEnd = this.markerController.findZeroCrossing(this.selectionEnd, channelData);
                    }
                    
                    console.log(`Selection marker dragged: ${this.selectionStart} to ${this.selectionEnd}`);
                    this.draggingSelectionMarker = null;
                } else {
                    this.markerController.handleMouseUp();
                }
                isDragging = false;
                this.render();
                console.log('Stopped dragging');
            } else if (isSelecting) {
                isSelecting = false;

                // Ensure selection is in correct order
                if (this.selectionStart > this.selectionEnd) {
                    [this.selectionStart, this.selectionEnd] = [this.selectionEnd, this.selectionStart];
                }

                // Apply snap to zero-crossing if enabled
                if (this.markerController.snapToZeroCrossingEnabled && this.renderer.waveformData) {
                    const channelData = this.renderer.waveformData.channelData[0];
                    this.selectionStart = this.markerController.findZeroCrossing(this.selectionStart, channelData);
                    this.selectionEnd = this.markerController.findZeroCrossing(this.selectionEnd, channelData);
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
        
            // SLICER MODE: Handle slice marker deletion/addition
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
            
                // Check if clicking within selection (add slices at boundaries)
                if (this.selectionStart !== null && this.selectionEnd !== null &&
                    clickSample >= this.selectionStart && clickSample <= this.selectionEnd) {
                    
                    this.showSliceContextMenu(e.pageX, e.pageY);
                    return;
                }
            } 
            // NORMAL MODES (Sample/Granular): Show selection context menu
            else if (currentMode === '0' || currentMode === '3') {
                const clickSample = this.renderer.xToSample(x);

                // Check if we have a valid selection
                if (this.selectionStart !== null && this.selectionEnd !== null &&
                    !isNaN(this.selectionStart) && !isNaN(this.selectionEnd)) {
                    
                    // Ensure selection is ordered
                    const selStart = Math.min(this.selectionStart, this.selectionEnd);
                    const selEnd = Math.max(this.selectionStart, this.selectionEnd);
                    
                    // Check if click is within selection
                    if (clickSample >= selStart && clickSample <= selEnd) {
                        this.showSelectionContextMenu(e.pageX, e.pageY, selStart, selEnd);
                        return;
                    }
                }
            }
        });

        // ==================== MOUSE WHEEL (ZOOM) ====================
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();

            // CRITICAL: Clear selection flag to prevent mousemove from updating selection
            isSelecting = false;

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

    /**
     * Shows context menu for setting markers from selection
     * @param {number} pageX - Mouse X position in page coordinates
     * @param {number} pageY - Mouse Y position in page coordinates
     * @param {number} selStart - Selection start sample
     * @param {number} selEnd - Selection end sample
     */
    showSelectionContextMenu(pageX, pageY, selStart, selEnd) {
        // Remove any existing context menu
        const existing = document.getElementById('selectionContextMenu');
        if (existing) existing.remove();

        // Apply snap-to-zero-crossing if enabled
        const applySnap = (sample) => {
            if (!this.markerController.snapToZeroCrossingEnabled) {
                return sample;
            }

            const channelData = this.renderer.waveformData.channelData[0];
            return this.markerController.findZeroCrossing(sample, channelData);
        };

        // Snap selection boundaries if toggle is enabled
        const snappedStart = applySnap(selStart);
        const snappedEnd = applySnap(selEnd);

        // Create context menu
        const menu = document.createElement('div');
        menu.id = 'selectionContextMenu';
        menu.className = 'context-menu show';
        menu.style.position = 'fixed';
        menu.style.left = pageX + 'px';
        menu.style.top = pageY + 'px';
        menu.style.zIndex = '2001';

        menu.innerHTML = `
            <div class="context-item" data-action="sample-start">Set sample start</div>
            <div class="context-item" data-action="sample-end">Set sample end</div>
            <div class="context-item" data-action="sample-both">Set sample start & end</div>
            <div class="context-item separator"></div>
            <div class="context-item" data-action="loop-start">Set loop start</div>
            <div class="context-item" data-action="loop-end">Set loop end</div>
            <div class="context-item" data-action="loop-both">Set loop start & end</div>
            <div class="context-item separator"></div>
            <div class="context-item" data-action="cancel">Cancel</div>
        `;

        document.body.appendChild(menu);

        // Handle menu clicks
        menu.addEventListener('click', (e) => {
            const action = e.target.dataset.action;

            if (action === 'sample-start') {
                this.markerController.setMarker('start', snappedStart);
                this.markerController.updatePadParams();
            } else if (action === 'sample-end') {
                this.markerController.setMarker('end', snappedEnd);
                this.markerController.updatePadParams();
            } else if (action === 'sample-both') {
                this.markerController.setMarker('start', snappedStart);
                this.markerController.setMarker('end', snappedEnd);
                this.markerController.updatePadParams();
            } else if (action === 'loop-start') {
                this.markerController.setMarker('loopStart', snappedStart);
                this.markerController.updatePadParams();
            } else if (action === 'loop-end') {
                this.markerController.setMarker('loopEnd', snappedEnd);
                this.markerController.updatePadParams();
            } else if (action === 'loop-both') {
                this.markerController.setMarker('loopStart', snappedStart);
                this.markerController.setMarker('loopEnd', snappedEnd);
                this.markerController.updatePadParams();
            }

            // Remove menu
            menu.remove();

            // Re-render if markers were changed
            if (action !== 'cancel') {
                this.render();
                const snapStatus = this.markerController.snapToZeroCrossingEnabled ? ' (snapped)' : '';
                window.BitboxerUtils.setStatus(`Markers updated from selection${snapStatus}`, 'success');
            }
        });

        // Close menu on any other click
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };

        // Delay to prevent immediate closure from the same click event
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

    setScroll(scrollRatio) {
        if (!this.renderer || !this.renderer.waveformData) return;
        
        const totalSamples = this.renderer.waveformData.length;
        const visibleSamples = Math.floor(totalSamples / this.renderer.zoom);
        const maxScrollSample = Math.max(0, totalSamples - visibleSamples);
        
        // Convert ratio (0-1) to integer sample position
        this.renderer.scrollSample = Math.floor(scrollRatio * maxScrollSample);
        this.render();
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
            if (!isNaN(currentSample) && currentSample >= 0) {
                const x = this.renderer.sampleToX(currentSample);
                const ctx = this.renderer.ctx;
                const height = this.renderer.height;
                const width = this.renderer.width;

                // Only draw if within visible area (simple check)
                if (x >= -10 && x <= width + 10) {
                    ctx.strokeStyle = '#5eff5e';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, height);
                    ctx.stroke();
                }
            }
        }  
    }

    /**
     * Shows context menu for adding slice markers at selection boundaries
     * @param {number} pageX - Mouse X position in page coordinates
     * @param {number} pageY - Mouse Y position in page coordinates
     */
    showSliceContextMenu(pageX, pageY) {
        // Remove any existing context menu
        const existing = document.getElementById('sliceContextMenu');
        if (existing) existing.remove();
        
        // Create context menu
        const menu = document.createElement('div');
        menu.id = 'sliceContextMenu';
        menu.className = 'context-menu show';
        menu.style.position = 'fixed';
        menu.style.left = pageX + 'px';
        menu.style.top = pageY + 'px';
        menu.style.zIndex = '2001';
        
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
            
            if (action === 'start' || action === 'both') {
                this.markerController.addSliceAtSample(this.selectionStart);
            }
            
            if (action === 'end' || action === 'both') {
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
        
        // Delay to prevent immediate closure from the same click event
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    setMode(mode) {
        this.currentMode = mode;
        
        // Single render to update display
        this.render();
    }

    play() {
        const { currentEditingPad, presetData } = window.BitboxerData;
        if (!currentEditingPad) return;

        const row = parseInt(currentEditingPad.dataset.row);
        const col = parseInt(currentEditingPad.dataset.col);
        const pad = presetData.pads[row][col];

        // Parse loop mode correctly
        const loopmodes = parseInt(pad.params.loopmodes) || 0;
        const loopEnabled = (loopmodes === 1 || loopmodes === 2);  // 1=Forward, 2=Bidirectional
        
        // Log for debugging
        console.log('Play params:', {
            loopmodes: pad.params.loopmodes,
            loopEnabled,
            loopstart: pad.params.loopstart,
            loopend: pad.params.loopend
        });

        const samstart = parseInt(pad.params.samstart) || 0;
        const samlen = parseInt(pad.params.samlen) || this.audioEngine.audioBuffer.length;

        const params = {
            startSample: samstart,
            endSample: samstart + samlen,
            loopStartSample: parseInt(pad.params.loopstart) || 0,
            loopEndSample: parseInt(pad.params.loopend) || samlen,
            loopEnabled: loopEnabled,
            reverse: false  // Disabled
        };

        this.audioEngine.play(params);
        this.startPlaybackAnimation();
    }

    stop() {
        this.audioEngine.stop();
    }

    playSelection() {
        // Validate selection exists and is valid
        if (this.selectionStart === null || isNaN(this.selectionStart) || this.selectionStart < 0) {
            console.warn('No valid selection to play');
            window.BitboxerUtils.setStatus('No selection - drag in waveform to select', 'error');
            return;
        }

        const { currentEditingPad, presetData } = window.BitboxerData;
        if (!currentEditingPad) return;

        const row = parseInt(currentEditingPad.dataset.row);
        const col = parseInt(currentEditingPad.dataset.col);
        const pad = presetData.pads[row][col];

        // Calculate valid end point
        let endSample;
        const bufferLength = this.audioEngine.audioBuffer.length;

        if (this.selectionEnd === null || isNaN(this.selectionEnd) || 
            Math.abs(this.selectionStart - this.selectionEnd) < 100) {
            // Single-point selection - play to buffer end
            endSample = bufferLength;
            console.log(`Playing from point ${this.selectionStart} to end ${endSample}`);
        } else {
            // Ensure selection is in correct order
            const start = Math.min(this.selectionStart, this.selectionEnd);
            const end = Math.max(this.selectionStart, this.selectionEnd);

            this.selectionStart = start;
            endSample = end;
            console.log(`Playing selection: ${this.selectionStart} to ${endSample}`);
        }

        // Validate range before playing
        if (this.selectionStart >= endSample || this.selectionStart >= bufferLength) {
            window.BitboxerUtils.setStatus('Invalid selection range', 'error');
            return;
        }

        // Clamp end to buffer length
        endSample = Math.min(endSample, bufferLength);

        this.audioEngine.play({
            startSample: Math.floor(this.selectionStart),
            endSample: Math.floor(endSample),
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