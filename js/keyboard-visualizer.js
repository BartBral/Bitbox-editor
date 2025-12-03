/**
 * BITBOXER - Keyboard Visualizer
 * 
 * Piano roll canvas showing multisample key/velocity mappings
 * - 88 keys (MIDI 21-108, A0 to C8)
 * - Horizontal scroll for navigation
 * - Color-coded velocity layers
 * - Click to select asset
 */

// ============================================
// KEYBOARD VISUALIZER CLASS
// ============================================

class KeyboardVisualizer {
    constructor(canvasId, scrollCanvasId) {
        this.canvas = document.getElementById(canvasId);
        this.scrollCanvas = document.getElementById(scrollCanvasId);
        
        // Add zoom capability
        this.zoom = 1; // 1 = show all keys, >1 = zoomed in
        this.minZoom = 1;
        this.maxZoom = 8; // Can zoom in 8x

        if (!this.canvas || !this.scrollCanvas) {
            console.error('KeyboardVisualizer: Canvas elements not found');
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.scrollCtx = this.scrollCanvas.getContext('2d');
        
        // Configuration
        this.keyWidth = 16; // Width per key in pixels (narrower for 128 keys)
        this.keyHeight = 100; // Height of keyboard
        this.velLayerHeight = 25; // Height per velocity layer (dynamic)
        this.minKey = 0; // C-1 (MIDI 0)
        this.maxKey = 127; // G9 (MIDI 127)
        this.totalKeys = this.maxKey - this.minKey + 1; // 128 keys
        
        // FIXED: Start zoomed out to show more keys at once
        this.zoom = 0.5;      // Start at 50% zoom (32px per key becomes 8px)
        this.minZoom = 0.25;  // Allow zooming out to 25% (4px per key)
        this.maxZoom = 4;     // Allow zooming in to 400% (64px per key)
        
        // State
        this.assetCells = [];
        this.selectedAsset = null;
        this.scrollPos = 0; // Horizontal scroll position
        this.maxScroll = 0;
        this.hoveredKey = null;
        
        // Colors - FIXED: Normal piano keys, grey for unassigned
        this.colors = {
            whiteKeyAssigned: '#f0f0f0',
            blackKeyAssigned: '#2a2a2a',
            whiteKeyUnassigned: '#888',
            blackKeyUnassigned: '#555',
            whiteKeyBorder: '#999',
            blackKeyBorder: '#000',
            selected: '#ffa600', // Bright orange
            selectedHover: '#ffb347',
            velLayerBase: 'rgba(74, 158, 255, 0.6)',
            velLayerSelected: 'rgba(255, 166, 0, 0.8)'
        };
        
        this.resize();
        this.setupEventListeners();
    }
    
    // Add this method to KeyboardVisualizer class
    tryRenderWhenVisible() {
        // Check if canvas has valid dimensions
        if (this.canvas && this.canvas.offsetWidth > 0) {
            console.log('Canvas visible, rendering now');
            const resizeSuccess = this.resize();
            if (resizeSuccess) {
                this.render();
                if (this.assetCells.length > 0 && this.onAssetSelected) {
                    this.onAssetSelected(this.assetCells[0]);
                }
            }
            return true;
        }
        return false;
    }

    setAssets(assetCells) {
        this.assetCells = assetCells;

        // Try to render immediately
        const rendered = this.tryRenderWhenVisible();

        if (!rendered) {
            console.log('Canvas not visible yet, will render when tab is clicked');
        }
    }

    /**
     * Resize canvas to fit container
     */
    resize() {
        if (!this.canvas || !this.canvas.parentElement) {
            console.warn('KeyboardVisualizer: Canvas not in DOM');
            return false;
        }

        const container = this.canvas.parentElement;
        const dpr = window.devicePixelRatio || 1;

        this.width = container.offsetWidth;

        // Calculate dynamic height based on velocity layers
        const numLayers = this.calculateVelocityLayers();
        this.height = this.keyHeight + (numLayers * this.velLayerHeight);

        // CRITICAL: Don't resize if dimensions invalid
        if (this.width <= 0 || this.height <= 0) {
            console.warn(`KeyboardVisualizer: Invalid dimensions (${this.width}x${this.height}), deferring`);
            return false;
        }
        
        // Main canvas
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';
        this.ctx.scale(dpr, dpr);
        
        // Scroll canvas
        if (this.scrollCanvas) {
            this.scrollCanvas.width = this.width * dpr;
            this.scrollCanvas.height = 30 * dpr;
            this.scrollCanvas.style.width = this.width + 'px';
            this.scrollCanvas.style.height = '30px';
            this.scrollCtx.scale(dpr, dpr);
        }
        
        // Calculate max scroll
        const totalWidth = this.totalKeys * this.keyWidth;
        this.maxScroll = Math.max(0, totalWidth - this.width);
        
        this.render();
        return true;
    }
    
    // In KeyboardVisualizer class, add this method:
    reset() {
        // Clear all state
        this.assetCells = [];
        this.selectedAsset = null;
        this.scrollPos = 0;
        this.zoom = 1;
        this.hoveredKey = null;

        // Clear canvas
        if (this.ctx && this.width > 0 && this.height > 0) {
            this.ctx.fillStyle = '#1a1614';
            this.ctx.fillRect(0, 0, this.width, this.height);
        }

        // Clear scroll canvas
        if (this.scrollCtx) {
            this.scrollCtx.fillStyle = '#2a2420';
            this.scrollCtx.fillRect(0, 0, this.width, 30);
        }
    }

    /**
     * Calculate number of velocity layers needed (max 16)
     */
    calculateVelocityLayers() {
        if (!this.assetCells || this.assetCells.length === 0) return 1;
        
        // Group assets by key range to find max layers per key
        const keyLayerCount = {};
        
        for (let midi = this.minKey; midi <= this.maxKey; midi++) {
            const assetsForKey = this.getAssetsForKey(midi);
            keyLayerCount[midi] = assetsForKey.length;
        }
        
        // Find maximum layers used on any single key
        const maxLayers = Math.max(1, ...Object.values(keyLayerCount));
        return Math.min(16, maxLayers); // Cap at 16
    }
    
    /**
     * Set asset cells data
     */
    setAssets(assetCells) {
        this.assetCells = assetCells;
        
        // Resize canvas to accommodate dynamic velocity layers
        const resizeSuccess = this.resize();
        
        if (resizeSuccess) {
            this.render();

            // Auto-select first asset if available
            if (assetCells.length > 0 && this.onAssetSelected) {
                this.onAssetSelected(assetCells[0]);
            }
        } else {
            console.warn('KeyboardVisualizer: Resize failed, canvas not ready');
        }
    }
    
    /**
     * Main render function
     */
    render() {
        if (!this.ctx || this.width <= 0) return;
        
        const { ctx, width, height } = this;
        
        // Clear
        ctx.fillStyle = '#1a1614';
        ctx.fillRect(0, 0, width, height);
        
        // Recalculate maxScroll based on zoom
        const effectiveKeyWidth = this.keyWidth * this.zoom;
        const totalWidth = this.totalKeys * effectiveKeyWidth;
        this.maxScroll = Math.max(0, totalWidth - this.width);
    

        // Draw keyboard
        this.drawKeyboard();
        
        // Draw velocity layers
        this.drawVelocityLayers();
        
        // Draw labels
        this.drawLabels();
        
        // Render scrollbar
        if (this.scrollCanvas) {
            this.renderScrollbar();
        }
    }
    
    /**
     * Draw piano keyboard - FIXED: Black keys on TOP, correct rendering
     */
    drawKeyboard() {
        const { ctx, keyWidth, keyHeight, scrollPos } = this;
        const effectiveKeyWidth = this.keyWidth * this.zoom;
        const blackKeyHeight = keyHeight * 0.6;
        
        // WHITE KEYS FIRST (background layer)
        for (let midi = this.minKey; midi <= this.maxKey; midi++) {
            if (this.isBlackKey(midi)) continue;
            
            const x = this.midiToX(midi);
            if (x + effectiveKeyWidth < 0 || x > this.width) continue; // Use effective width
            
            const isHovered = (this.hoveredKey === midi);
            const hasAssignment = this.getAssetsForKey(midi).length > 0;
            
            // FIXED: Grey for unassigned, normal for assigned
            if (hasAssignment) {
                ctx.fillStyle = isHovered ? '#ffffff' : this.colors.whiteKeyAssigned;
            } else {
                ctx.fillStyle = isHovered ? '#aaa' : this.colors.whiteKeyUnassigned;
            }
            ctx.fillRect(x, 0, effectiveKeyWidth - 1, keyHeight);
            
            // Border
            ctx.strokeStyle = this.colors.whiteKeyBorder;
            ctx.lineWidth = 1;
            ctx.strokeRect(x, 0, effectiveKeyWidth - 1, keyHeight);
        }
        
        // BLACK KEYS ON TOP (foreground layer)
        for (let midi = this.minKey; midi <= this.maxKey; midi++) {
            if (!this.isBlackKey(midi)) continue;
            
            const x = this.midiToX(midi);
            if (x + effectiveKeyWidth < 0 || x > this.width) continue;
            
            const isHovered = (this.hoveredKey === midi);
            const hasAssignment = this.getAssetsForKey(midi).length > 0;
            
            // FIXED: Grey for unassigned, black for assigned
            if (hasAssignment) {
                ctx.fillStyle = isHovered ? '#444' : this.colors.blackKeyAssigned;
            } else {
                ctx.fillStyle = isHovered ? '#777' : this.colors.blackKeyUnassigned;
            }
            ctx.fillRect(x, 0, effectiveKeyWidth - 1, blackKeyHeight);
            
            // Border
            ctx.strokeStyle = this.colors.blackKeyBorder;
            ctx.lineWidth = 1;
            ctx.strokeRect(x, 0, effectiveKeyWidth - 1, blackKeyHeight);
        }
    }
    
    /**
     * Draw velocity layers - DYNAMIC: Shows actual layers, not fixed 3
     */
    drawVelocityLayers() {
        const { ctx, keyHeight, velLayerHeight } = this;
        const effectiveKeyWidth = this.keyWidth * this.zoom;  // ADD THIS
        
        // Build velocity layer map
        const layerMap = {};
        for (let midi = this.minKey; midi <= this.maxKey; midi++) {
            layerMap[midi] = this.getAssetsForKey(midi);
        }

        // Draw rectangles spanning key ranges for each asset
        this.assetCells.forEach((asset, assetIndex) => {
            const loKey = parseInt(asset.params.keyrangebottom);
            const hiKey = parseInt(asset.params.keyrangetop);

            let layerIndex = 0;
            for (let i = 0; i < assetIndex; i++) {
                const otherAsset = this.assetCells[i];
                const otherLo = parseInt(otherAsset.params.keyrangebottom);
                const otherHi = parseInt(otherAsset.params.keyrangetop);

                if (!(hiKey < otherLo || loKey > otherHi)) {
                    layerIndex++;
                }
            }

            if (layerIndex >= 16) return;

            const y = keyHeight + (layerIndex * velLayerHeight);
            const startX = this.midiToX(loKey);
            const endX = this.midiToX(hiKey + 1);  // +1 to include hiKey fully
            const width = endX - startX;

            const isSelected = (this.selectedAsset === asset);

            ctx.fillStyle = isSelected ? this.colors.velLayerSelected : this.colors.velLayerBase;
            ctx.fillRect(startX, y, width, velLayerHeight - 2);

            ctx.strokeStyle = isSelected ? '#ffa600' : 'rgba(74, 158, 255, 0.8)';
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.strokeRect(startX, y, width, velLayerHeight - 2);

            // Label with sample name (if space allows)
            if (width > 50) {
                const sampleName = asset.filename.split(/[/\\]/).pop().replace('.wav', '');
                ctx.fillStyle = isSelected ? '#000' : '#fff';
                ctx.font = '10px monospace';
                ctx.textAlign = 'left';
                ctx.fillText(sampleName.substring(0, 20), startX + 4, y + 16);
            }
        });
    }
    
    /**
     * Draw octave labels - FIXED: Only label C keys
     */
    drawLabels() {
        const { ctx, keyWidth, keyHeight } = this;
        
        ctx.fillStyle = '#d0c2b9';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        
        // Draw octave markers ONLY at C notes (MIDI % 12 === 0)
        for (let midi = this.minKey; midi <= this.maxKey; midi++) {
            // FIXED: Only C notes, not C#
            if (midi % 12 === 0) {
                const x = this.midiToX(midi);
                if (x >= 0 && x < this.width) {
                    const octave = Math.floor((midi - 12) / 12);
                    ctx.fillText(`C${octave}`, x + keyWidth / 2, this.keyHeight - 5);
                }
            }
        }
    }
    
    /**
     * Render scroll-zoom bar (allows both scrolling AND zooming)
     */
    renderScrollbar() {
        if (!this.scrollCtx) return;

        const { scrollCtx, width, maxScroll, scrollPos } = this;
        const height = 30;

        // Clear
        scrollCtx.fillStyle = '#2a2420';
        scrollCtx.fillRect(0, 0, width, height);

        // FIXED: Calculate visible portion correctly when zoom affects key SIZE
        // When zoom = 0.5, keys are smaller, so MORE keys are visible
        // When zoom = 2.0, keys are bigger, so FEWER keys are visible
        const effectiveKeyWidth = this.keyWidth * this.zoom;
        const totalWidth = this.totalKeys * effectiveKeyWidth;
        
        // Visible keys = how many keys fit in viewport width
        const visibleKeys = width / effectiveKeyWidth;
        
        // Thumb represents what fraction of total keys are visible
        const visibleRatio = Math.min(1, visibleKeys / this.totalKeys);
        const thumbWidth = Math.max(40, visibleRatio * width);
        
        const maxThumbScroll = width - thumbWidth;

        // Calculate thumb position
        const scrollRatio = maxScroll > 0 ? (scrollPos / maxScroll) : 0;
        const thumbX = scrollRatio * maxThumbScroll;

        // Draw thumb
        scrollCtx.fillStyle = '#a35a2d';
        scrollCtx.fillRect(thumbX, 4, thumbWidth, height - 8);

        scrollCtx.strokeStyle = '#4a4038';
        scrollCtx.lineWidth = 1;
        scrollCtx.strokeRect(thumbX + 0.5, 4.5, thumbWidth - 1, height - 9);

        // Draw edge handles
        scrollCtx.fillStyle = '#fff';
        const handleWidth = 2;
        const handleHeight = 12;
        const handleY = (height - handleHeight) / 2;

        // Left handle
        scrollCtx.fillRect(thumbX + 4, handleY, handleWidth, handleHeight);

        // Right handle
        scrollCtx.fillRect(thumbX + thumbWidth - 4 - handleWidth, handleY, handleWidth, handleHeight);

        // Center grip
        const centerX = thumbX + thumbWidth / 2;
        for (let i = -1; i <= 1; i++) {
            scrollCtx.fillRect(centerX + i * 4 - 1, handleY, handleWidth, handleHeight);
        }
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Mouse click on keyboard
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        
        // Mouse move for hover
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        
        // Scroll handling
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        
        // Scroll-zoom bar drag
        if (this.scrollCanvas) {
            let draggingMode = null;
            let startX = 0;
            let startScroll = 0;
            let startZoom = 1;

            this.scrollCanvas.addEventListener('mousedown', (e) => {
                const rect = this.scrollCanvas.getBoundingClientRect();
                const x = e.clientX - rect.left;

                const effectiveKeyWidth = this.keyWidth * this.zoom;
                const visibleKeys = this.width / effectiveKeyWidth;
                const visibleRatio = Math.min(1, visibleKeys / this.totalKeys);
                const thumbWidth = Math.max(40, visibleRatio * this.width);
                const maxThumbScroll = this.width - thumbWidth;
                const scrollRatio = this.maxScroll > 0 ? (this.scrollPos / this.maxScroll) : 0;
                const thumbX = scrollRatio * maxThumbScroll;

                const edgeThreshold = 8;

                if (x >= thumbX && x <= thumbX + edgeThreshold) {
                    draggingMode = 'left-edge';
                    this.scrollCanvas.style.cursor = 'ew-resize';
                } else if (x >= thumbX + thumbWidth - edgeThreshold && x <= thumbX + thumbWidth) {
                    draggingMode = 'right-edge';
                    this.scrollCanvas.style.cursor = 'ew-resize';
                } else if (x > thumbX + edgeThreshold && x < thumbX + thumbWidth - edgeThreshold) {
                    draggingMode = 'body';
                    this.scrollCanvas.style.cursor = 'grabbing';
                }

                startX = x;
                startScroll = this.scrollPos;
                startZoom = this.zoom;
            });

            this.scrollCanvas.addEventListener('mousemove', (e) => {
                if (!draggingMode) {
                    // Cursor update logic
                    const rect = this.scrollCanvas.getBoundingClientRect();
                    const x = e.clientX - rect.left;

                    const effectiveKeyWidth = this.keyWidth * this.zoom;
                    const visibleKeys = this.width / effectiveKeyWidth;
                    const visibleRatio = Math.min(1, visibleKeys / this.totalKeys);
                    const thumbWidth = Math.max(40, visibleRatio * this.width);
                    const maxThumbScroll = this.width - thumbWidth;
                    const scrollRatio = this.maxScroll > 0 ? (this.scrollPos / this.maxScroll) : 0;
                    const thumbX = scrollRatio * maxThumbScroll;

                    const edgeThreshold = 8;

                    if ((x >= thumbX && x <= thumbX + edgeThreshold) ||
                        (x >= thumbX + thumbWidth - edgeThreshold && x <= thumbX + thumbWidth)) {
                        this.scrollCanvas.style.cursor = 'ew-resize';
                    } else if (x > thumbX + edgeThreshold && x < thumbX + thumbWidth - edgeThreshold) {
                        this.scrollCanvas.style.cursor = 'grab';
                    } else {
                        this.scrollCanvas.style.cursor = 'default';
                    }
                    return;
                }

                const rect = this.scrollCanvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const deltaX = x - startX;

                if (draggingMode === 'body') {
                    // Pan
                    const effectiveKeyWidth = this.keyWidth * this.zoom;
                    const scrollDelta = (deltaX / this.width) * this.totalKeys * effectiveKeyWidth;
                    this.scrollPos = Math.max(0, Math.min(this.maxScroll, startScroll + scrollDelta));
                } else if (draggingMode === 'left-edge') {
                    // Zoom by dragging left edge
                    const zoomSensitivity = 0.01;
                    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, startZoom * (1 + deltaX * zoomSensitivity)));
                    this.zoom = newZoom;

                    // FIXED: Recalculate maxScroll with zoom factor
                    this.maxScroll = Math.max(0, (this.totalKeys * this.keyWidth * this.zoom) - this.width);
                } else if (draggingMode === 'right-edge') {
                    // Zoom by dragging right edge
                    const zoomSensitivity = 0.01;
                    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, startZoom * (1 - deltaX * zoomSensitivity)));
                    this.zoom = newZoom;

                    // FIXED: Recalculate maxScroll with zoom factor
                    this.maxScroll = Math.max(0, (this.totalKeys * this.keyWidth * this.zoom) - this.width);
                }

                this.render();
            });

            this.scrollCanvas.addEventListener('mouseup', () => {
                if (draggingMode) {
                    draggingMode = null;
                    this.scrollCanvas.style.cursor = 'default';
                }
            });

            this.scrollCanvas.addEventListener('mouseleave', () => {
                if (draggingMode) {
                    draggingMode = null;
                    this.scrollCanvas.style.cursor = 'default';
                }
            });
        }

        // Window resize
        window.addEventListener('resize', () => this.resize());
    }
    
    /**
     * Handle mouse click - FIXED: Click on velocity layer rectangles
     */
    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Check keyboard area
        if (y < this.keyHeight) {
            const midi = this.xToMidi(x);
            if (midi >= this.minKey && midi <= this.maxKey) {
                const assets = this.getAssetsForKey(midi);
                if (assets.length > 0) {
                    this.selectAsset(assets[0]);
                }
            }
        }
        // Check velocity layer area - find which asset was clicked
        else {
            const layerY = y - this.keyHeight;
            const midi = this.xToMidi(x);
            
            // Find asset at this position
            for (const asset of this.assetCells) {
                const loKey = parseInt(asset.params.keyrangebottom);
                const hiKey = parseInt(asset.params.keyrangetop);
                
                if (midi >= loKey && midi <= hiKey) {
                    this.selectAsset(asset);
                    break;
                }
            }
        }
    }
    
    /**
     * Handle mouse move (hover)
     */
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (y < this.keyHeight) {
            const midi = this.xToMidi(x);
            if (midi !== this.hoveredKey) {
                this.hoveredKey = midi;
                this.render();
            }
        } else {
            if (this.hoveredKey !== null) {
                this.hoveredKey = null;
                this.render();
            }
        }
    }
    
    /**
     * Handle mouse wheel (scroll)
     */
    handleWheel(e) {
        e.preventDefault();
        const delta = e.deltaY;
        this.scrollPos = Math.max(0, Math.min(this.maxScroll, this.scrollPos + delta));
        this.render();
    }
    
    /**
     * Select an asset
     */
    selectAsset(asset) {
        this.selectedAsset = asset;
        this.render();
        
        // Trigger callback if set
        if (this.onAssetSelected) {
            this.onAssetSelected(asset);
        }
    }
    
    /**
     * Convert MIDI note to X position
     */
    midiToX(midi) {
        // Apply zoom to key width
        const effectiveKeyWidth = this.keyWidth * this.zoom;
        return ((midi - this.minKey) * effectiveKeyWidth) - this.scrollPos;
    }
    
    /**
     * Convert X position to MIDI note
     */
    xToMidi(x) {
        const effectiveKeyWidth = this.keyWidth * this.zoom;
        return Math.floor((x + this.scrollPos) / effectiveKeyWidth) + this.minKey;
    }
    
    /**
     * Check if MIDI note is a black key
     */
    isBlackKey(midi) {
        const note = midi % 12;
        return [1, 3, 6, 8, 10].includes(note); // C#, D#, F#, G#, A#
    }
    
    /**
     * Convert MIDI note to name (e.g., "C4")
     */
    midiToNoteName(midi) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor((midi - 12) / 12);
        const note = notes[midi % 12];
        return `${note}${octave}`;
    }
    
    /**
     * Get assets assigned to a specific key
     */
    getAssetsForKey(midi) {
        return this.assetCells.filter(asset => {
            const loKey = parseInt(asset.params.keyrangebottom);
            const hiKey = parseInt(asset.params.keyrangetop);
            return midi >= loKey && midi <= hiKey;
        });
    }
    
    /**
     * Get assets for key and velocity layer (0=low, 1=mid, 2=hi)
     */
    getAssetsForKeyAndVelLayer(midi, layer) {
        const velRanges = [
            [0, 42],    // Low velocity
            [43, 84],   // Mid velocity
            [85, 127]   // High velocity
        ];
        
        return this.assetCells.filter(asset => {
            const loKey = parseInt(asset.params.keyrangebottom);
            const hiKey = parseInt(asset.params.keyrangetop);
            const loVel = parseInt(asset.params.velrangebottom);
            const hiVel = parseInt(asset.params.velrangetop);
            
            const [layerLoVel, layerHiVel] = velRanges[layer];
            
            // Check if key is in range AND velocity overlaps with layer
            return (midi >= loKey && midi <= hiKey) &&
                   (loVel <= layerHiVel && hiVel >= layerLoVel);
        });
    }
    
    /**
     * Get color for velocity layer
     */
    getVelLayerColor(layer) {
        return [this.colors.velLayer1, this.colors.velLayer2, this.colors.velLayer3][layer];
    }
}

// ============================================
// EXPORT
// ============================================
window.KeyboardVisualizer = KeyboardVisualizer;