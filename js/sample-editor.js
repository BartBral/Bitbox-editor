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
        
        // FIX: Use this.width directly instead of destructuring to ensure we get current value
        // Also guard against width being 0 or invalid
        const width = this.width;
        if (!width || width <= 0) {
            console.warn('sampleToX called with invalid width:', width);
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
        const { length, zoom, scrollPos, width } = this;
        const totalVisible = length / zoom;
        const startSample = scrollPos * (length - totalVisible);
        return Math.floor(startSample + (x / width) * totalVisible);
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
        return Math.floor(elapsed * this.audioBuffer.sampleRate);
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
    }

    setMarker(name, sample) {
        if (this.markers[name]) {
            this.markers[name].sample = Math.max(0, Math.min(this.renderer.waveformData.length, sample));
        }
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

    // draw() {
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
        
        // FIX: Don't draw if canvas width is invalid
        if (!width || width <= 0) {
            // console.warn('Skipping marker draw - invalid canvas width:', width);
            return;
        }

        // DEBUG: Log marker drawing
        console.log('=== MARKER DRAW DEBUG ===');
        console.log('Canvas dimensions:', width, 'x', height);
        console.log('Waveform data exists:', !!this.renderer.waveformData);
        console.log('Markers:', this.markers);
        
        // Get current cell mode
        const { currentEditingPad, presetData } = window.BitboxerData;
        let cellmode = '0'; // Default to sample mode
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
        const { ctx, width, height } = this;
        if (!this.waveformData) return;
        
        const totalLength = this.waveformData.length;
        const sampleRate = this.waveformData.sampleRate;
        
        // Get grain parameters
        const samstart = parseInt(padParams.samstart) || 0;
        const samlen = parseInt(padParams.samlen) || totalLength;
        const grainSourceWindow = parseFloat(padParams.gainssrcwin) / 1000; // 0-1
        
        // FIX: Calculate grain window within the actual sample bounds
        const sampleEnd = Math.min(samstart + samlen, totalLength);
        const effectiveLength = sampleEnd - samstart;
        const sourceWindowSamples = Math.floor(effectiveLength * grainSourceWindow);
        const windowStart = samstart + Math.floor((effectiveLength - sourceWindowSamples) / 2);
        const windowEnd = windowStart + sourceWindowSamples;
        
        // Convert to screen coordinates using sampleToX
        const x1 = this.sampleToX(windowStart);
        const x2 = this.sampleToX(windowEnd);

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
        const grainWidth = (grainSizeSamples / totalLength) * width * this.renderer.zoom;

        // Animate grain position (simple ping-pong)
        const time = Date.now() / 1000;
        const animSpeed = 0.5; // seconds per cycle
        const animPos = (Math.sin(time * Math.PI * 2 / animSpeed) + 1) / 2; // 0-1
        
        const grainX = x1 + animPos * (x2 - x1 - grainWidth);
        
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

    handleMouseDown(x, y, mode) {
        // Check if clicking near a marker handle (top 20px)
        if (y <= 20) {
            const threshold = 10;
            
            for (const [name, marker] of Object.entries(this.markers)) {
                const markerX = this.renderer.sampleToX(marker.sample);
                if (Math.abs(x - markerX) < threshold) {
                    this.dragging = { type: 'marker', name };
                    return true;
                }
            }
        }

        // In slicer mode, check slice markers (can click anywhere in height)
        if (mode === '2') {
            const threshold = 10;
            for (let i = 0; i < this.sliceMarkers.length; i++) {
                const markerX = this.renderer.sampleToX(this.sliceMarkers[i]);
                if (Math.abs(x - markerX) < threshold) {
                    this.dragging = { type: 'slice', index: i };
                    return true;
                }
            }
        }
        
        return false;
    }

    handleMouseMove(x) {
        if (!this.dragging) return false;

        let sample = this.renderer.xToSample(x);

        if (this.dragging.type === 'marker') {
            const marker = this.markers[this.dragging.name];
            sample = this.snapToZeroCrossing(sample, marker);
            this.setMarker(this.dragging.name, sample);
            this.updatePadParams();
        } else if (this.dragging.type === 'slice') {
            // Snap slice to zero crossing (always enabled for slices)
            const channelData = this.renderer.waveformData.channelData[0];
            sample = this.findZeroCrossing(sample, channelData);
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

        // Update pad params
        pad.params.samstart = this.markers.start.sample.toString();
        pad.params.samlen = (this.markers.end.sample - this.markers.start.sample).toString();
        pad.params.loopstart = this.markers.loopStart.sample.toString();
        pad.params.loopend = this.markers.loopEnd.sample.toString();

        // Update sliders
        ['samstart', 'samlen', 'loopstart', 'loopend'].forEach(param => {
            const slider = document.getElementById(param);
            if (slider) {
                slider.value = pad.params[param];
                window.BitboxerUtils.updateParamDisplay(param, pad.params[param]);
            }
        });
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
        const samstart = parseInt(pad.params.samstart) || 0;
        const samlen = parseInt(pad.params.samlen) || 0;
        
        this.setMarker('start', samstart);
        this.setMarker('end', samstart + samlen);
        this.setMarker('loopStart', parseInt(pad.params.loopstart) || 0);
        this.setMarker('loopEnd', parseInt(pad.params.loopend) || samlen);

        // Load slices if in slicer mode
        if (pad.params.cellmode === '2' && pad.slices) {
            this.sliceMarkers = pad.slices.map(slice => parseInt(slice.pos));
        } else {
            this.sliceMarkers = [];
        }
    }

    addSliceAtPosition(x) {
        const sample = this.renderer.xToSample(x);
        const channelData = this.renderer.waveformData.channelData[0];
        const snappedSample = this.findZeroCrossing(sample, channelData);
        
        // Don't add if too close to existing slice
        const minDistance = 100; // samples
        const tooClose = this.sliceMarkers.some(s => Math.abs(s - snappedSample) < minDistance);
        if (tooClose) return;

        this.sliceMarkers.push(snappedSample);
        this.updateSlicesToPad();
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
        this.maxZoom = 100;
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
        const oldZoom = this.renderer.zoom;
        const zoomFactor = deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, oldZoom * zoomFactor));

        // Zoom towards mouse position
        const mouseRatio = mouseX / this.renderer.width;
        const oldScroll = this.renderer.scrollPos;
        const newScroll = oldScroll + mouseRatio * (1 / oldZoom - 1 / newZoom);

        this.renderer.zoom = newZoom;
        this.renderer.scrollPos = Math.max(0, Math.min(1 - 1 / newZoom, newScroll));
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

    setupEventListeners(canvas) {
        // Mouse events
        let isDragging = false;
        let currentMode = '0';

        canvas.addEventListener('mousedown', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Get current mode
            const { currentEditingPad, presetData } = window.BitboxerData;
            if (currentEditingPad) {
                const row = parseInt(currentEditingPad.dataset.row);
                const col = parseInt(currentEditingPad.dataset.col);
                currentMode = presetData.pads[row][col].params.cellmode || '0';
            }
            
            if (this.markerController.handleMouseDown(x, y, currentMode)) {
                isDragging = true;
            } else if (currentMode === '2' && e.shiftKey) {
                // Shift+Click in slicer mode = add slice
                this.markerController.addSliceAtPosition(x);
                this.render();
            }
        });

        canvas.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            
            if (this.markerController.handleMouseMove(x)) {
                this.render();
            }
        });

        canvas.addEventListener('mouseup', () => {
            if (isDragging) {
                this.markerController.handleMouseUp();
                isDragging = false;
            }
        });

        // Right-click to delete slice
        canvas.addEventListener('contextmenu', (e) => {
            if (currentMode !== '2') return;
            e.preventDefault();

            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const threshold = 10;

            for (let i = 0; i < this.markerController.sliceMarkers.length; i++) {
                const markerX = this.renderer.sampleToX(this.markerController.sliceMarkers[i]);
                if (Math.abs(x - markerX) < threshold) {
                    this.markerController.removeSliceAtIndex(i);
                    this.render();
                    break;
                }
            }
        });

        // Zoom with mouse wheel
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            this.zoomController.handleWheel(e.deltaY, x);

            // FIX: Update slider
            const zoomSlider = document.getElementById('zoomSlider');
            const zoomValue = document.getElementById('zoomValue');
            if (zoomSlider && zoomValue) {
                zoomSlider.value = window.BitboxerSampleEditor.renderer.zoom;
                zoomValue.textContent = window.BitboxerSampleEditor.renderer.zoom.toFixed(1) + 'x';
            }

            this.render();
        });

        // Resize
        window.addEventListener('resize', () => {
            this.renderer.resize();
            this.render();
        });
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
        this.renderer.render();
        this.markerController.draw();

        // Draw mode-specific overlays
        const { currentEditingPad, presetData } = window.BitboxerData;
        if (!currentEditingPad) return;

        const row = parseInt(currentEditingPad.dataset.row);
        const col = parseInt(currentEditingPad.dataset.col);
        const pad = presetData.pads[row][col];

        if (this.currentMode === '1') {
            // Clip mode - beat grid
            const tempo = presetData.tempo || '120';
            this.markerController.drawClipBeatGrid(pad.params, tempo);
        } else if (this.currentMode === '3') {
            // Granular mode - grain window
            this.markerController.drawGranularOverlay(pad.params);
        }
    }

    startGranularAnimation() {
        if (this.granularAnimating) return;
        this.granularAnimating = true;

        const animate = () => {
            if (!this.granularAnimating || (this.currentMode !== '3' && this.currentMode !== '1')) {
                this.granularAnimating = false;
                return;
            }
            this.render();
            requestAnimationFrame(animate);
        };

        animate();
    }

    updateGranularParams() {
        this.render();
    }

    stopGranularAnimation() {
        this.granularAnimating = false;
    }

    setMode(mode) {
        this.currentMode = mode;
        
        // Both granular and clip modes need animation (granular for grain, clip for playhead)
        if (mode === '3' || mode === '1') {
            this.startGranularAnimation();
        } else {
            this.stopGranularAnimation();
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
    }

    stop() {
        this.audioEngine.stop();
    }

    playSelection() {
        this.play(); // For now, same as play (respects markers)
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