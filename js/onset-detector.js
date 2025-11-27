/**
 * BITBOXER - Onset Detector
 * 
 * Advanced onset detection using spectral analysis
 * Implements HFC, Spectral Flux, and Complex Domain algorithms
 */

class OnsetDetector {
    constructor(waveformData, options = {}) {
        this.audioBuffer = waveformData;
        this.sampleRate = waveformData.sampleRate;
        this.channelData = waveformData.channelData[0]; // Use first channel
        
        // Configuration
        this.config = {
            algorithm: options.algorithm || 'flux',
            sensitivity: options.sensitivity || 0.5,
            windowSize: options.windowSize || 1024,
            hopSize: options.hopSize || 512,
            minSliceDistance: options.minSliceDistance || 1000,
            ...options
        };
        
        // FFT setup
        this.fft = new FFT(this.config.windowSize);
        this.window = this.createWindow(this.config.windowSize);
        
        // Analysis results
        this.onsetFunction = null;
        this.peaks = null;
    }

    /**
     * Main analysis method - returns onset sample positions
     */
    analyze() {
        console.log(`Onset detection: ${this.config.algorithm}, sensitivity: ${this.config.sensitivity}`);
        
        // Step 1: Calculate STFT
        const frames = this.calculateSTFT();
        
        // Step 2: Calculate onset detection function
        this.onsetFunction = this.calculateOnsetFunction(frames);
        
        // Step 3: Peak picking
        this.peaks = this.peakPicking(this.onsetFunction);
        
        // Step 4: Convert frames to samples
        const onsetSamples = this.framesToSamples(this.peaks);
        
        console.log(`Detected ${onsetSamples.length} onsets`);
        return onsetSamples;
    }

    /**
     * Creates Hann window for STFT
     */
    createWindow(size) {
        const window = new Float32Array(size);
        for (let i = 0; i < size; i++) {
            window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (size - 1)));
        }
        return window;
    }

    /**
     * Calculate Short-Time Fourier Transform
     * Returns array of frames, each containing magnitudes and phases
     */
    calculateSTFT() {
        const { windowSize, hopSize } = this.config;
        const numFrames = Math.floor((this.channelData.length - windowSize) / hopSize) + 1;
        const frames = [];
        
        const complexInput = this.fft.createComplexArray();
        const complexOutput = this.fft.createComplexArray();
        
        for (let frame = 0; frame < numFrames; frame++) {
            const startSample = frame * hopSize;
            
            // Apply window and prepare FFT input
            for (let i = 0; i < windowSize; i++) {
                const sample = this.channelData[startSample + i] || 0;
                complexInput[i * 2] = sample * this.window[i];
                complexInput[i * 2 + 1] = 0;
            }
            
            // Perform FFT
            this.fft.transform(complexOutput, complexInput);
            
            // Extract magnitudes and phases
            const magnitudes = new Float32Array(windowSize / 2);
            const phases = new Float32Array(windowSize / 2);
            
            for (let k = 0; k < windowSize / 2; k++) {
                const real = complexOutput[k * 2];
                const imag = complexOutput[k * 2 + 1];
                magnitudes[k] = Math.sqrt(real * real + imag * imag);
                phases[k] = Math.atan2(imag, real);
            }
            
            frames.push({ magnitudes, phases });
        }
        
        return frames;
    }

    /**
     * Calculate onset detection function based on selected algorithm
     */
    calculateOnsetFunction(frames) {
        const { algorithm } = this.config;
        
        switch (algorithm) {
            case 'hfc':
                return this.calculateHFC(frames);
            case 'flux':
                return this.calculateSpectralFlux(frames);
            case 'complex':
                return this.calculateComplexDomain(frames);
            default:
                return this.calculateSpectralFlux(frames);
        }
    }

    /**
     * High Frequency Content (HFC)
     * Weights spectral bins by their frequency index
     */
    calculateHFC(frames) {
        const onsetFunction = new Float32Array(frames.length);
        
        for (let i = 0; i < frames.length; i++) {
            const magnitudes = frames[i].magnitudes;
            let hfc = 0;
            
            for (let k = 0; k < magnitudes.length; k++) {
                hfc += magnitudes[k] * k; // Weight by bin index
            }
            
            onsetFunction[i] = hfc;
        }
        
        return onsetFunction;
    }

    /**
     * Spectral Flux
     * Measures increase in spectral energy between frames
     */
    calculateSpectralFlux(frames) {
        const onsetFunction = new Float32Array(frames.length);
        
        onsetFunction[0] = 0; // No previous frame
        
        for (let i = 1; i < frames.length; i++) {
            const currMag = frames[i].magnitudes;
            const prevMag = frames[i - 1].magnitudes;
            let flux = 0;
            
            for (let k = 0; k < currMag.length; k++) {
                const diff = currMag[k] - prevMag[k];
                flux += Math.max(0, diff); // Half-wave rectification
            }
            
            onsetFunction[i] = flux;
        }
        
        return onsetFunction;
    }

    /**
     * Complex Domain
     * Uses both magnitude and phase information
     */
    calculateComplexDomain(frames) {
        const onsetFunction = new Float32Array(frames.length);
        
        onsetFunction[0] = 0;
        
        for (let i = 1; i < frames.length; i++) {
            const currMag = frames[i].magnitudes;
            const prevMag = frames[i - 1].magnitudes;
            const currPhase = frames[i].phases;
            const prevPhase = frames[i - 1].phases;
            
            let cd = 0;
            
            for (let k = 1; k < currMag.length; k++) { // Skip DC
                // Expected phase based on frequency
                const expectedPhase = prevPhase[k] + (prevPhase[k] - prevPhase[k - 1]);
                
                // Phase deviation
                let phaseDiff = currPhase[k] - expectedPhase;
                
                // Wrap phase to [-π, π]
                while (phaseDiff > Math.PI) phaseDiff -= 2 * Math.PI;
                while (phaseDiff < -Math.PI) phaseDiff += 2 * Math.PI;
                
                // Magnitude of complex difference
                const magDiff = currMag[k] - prevMag[k];
                cd += Math.sqrt(magDiff * magDiff + (currMag[k] * phaseDiff) * (currMag[k] * phaseDiff));
            }
            
            onsetFunction[i] = cd;
        }
        
        return onsetFunction;
    }

    /**
     * Peak picking with adaptive thresholding
     */
    peakPicking(onsetFunction) {
        const { sensitivity, minSliceDistance } = this.config;
        const { hopSize } = this.config;
        
        // Convert minSliceDistance from samples to frames
        const minFrameDistance = Math.ceil(minSliceDistance / hopSize);
        
        // Smooth the onset function
        const smoothed = this.movingAverageFilter(onsetFunction, 3);
        
        // Calculate adaptive threshold
        const threshold = this.calculateAdaptiveThreshold(smoothed, sensitivity);
        
        // Find peaks
        const peaks = [];
        
        for (let i = 1; i < smoothed.length - 1; i++) {
            // Check if it's a local maximum
            if (smoothed[i] > smoothed[i - 1] && smoothed[i] > smoothed[i + 1]) {
                // Check if above threshold
                if (smoothed[i] > threshold[i]) {
                    // Check distance from previous peak
                    if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minFrameDistance) {
                        peaks.push(i);
                    }
                }
            }
        }
        
        return peaks;
    }

    /**
     * Moving average filter for smoothing
     */
    movingAverageFilter(signal, windowSize) {
        const smoothed = new Float32Array(signal.length);
        const halfWindow = Math.floor(windowSize / 2);
        
        for (let i = 0; i < signal.length; i++) {
            let sum = 0;
            let count = 0;
            
            for (let j = -halfWindow; j <= halfWindow; j++) {
                const idx = i + j;
                if (idx >= 0 && idx < signal.length) {
                    sum += signal[idx];
                    count++;
                }
            }
            
            smoothed[i] = sum / count;
        }
        
        return smoothed;
    }

    /**
     * Calculate adaptive threshold using moving median
     */
    calculateAdaptiveThreshold(signal, sensitivity) {
        const windowSize = 20;
        const threshold = new Float32Array(signal.length);
        
        for (let i = 0; i < signal.length; i++) {
            const start = Math.max(0, i - windowSize);
            const end = Math.min(signal.length, i + windowSize + 1);
            const window = Array.from(signal.slice(start, end)).sort((a, b) => a - b);
            const median = window[Math.floor(window.length / 2)];
            
            // sensitivity: 0.0 = very strict, 1.0 = very loose
            const delta = median * (1 - sensitivity) * 2;
            threshold[i] = median + delta;
        }
        
        return threshold;
    }

    /**
     * Convert frame indices to sample positions
     */
    framesToSamples(frames) {
        const { hopSize } = this.config;
        return frames.map(frame => frame * hopSize);
    }

    /**
     * Get onset function for visualization
     */
    getOnsetFunction() {
        return this.onsetFunction;
    }

    /**
     * Get frame-to-sample conversion function
     */
    getFrameToSampleConverter() {
        const { hopSize } = this.config;
        return (frame) => frame * hopSize;
    }
}

// Export
window.OnsetDetector = OnsetDetector;