/**
 * BITBOXER - Keyboard Visualizer with Draggable Zones
 * 
 * FEATURES:
 * - Draggable zone edges (resize)
 * - Draggable zone body (move)
 * - Collision detection & prevention
 * - Real-time visual feedback
 * - Snap guides
 * - Zoom & scroll functionality
 */

class KeyboardVisualizer {
    constructor(canvasId, scrollCanvasId) {
        this.canvas = document.getElementById(canvasId);
        this.scrollCanvas = document.getElementById(scrollCanvasId);

        // Zoom capability
        this.zoom = 0.5;
        this.minZoom = 0.25;
        this.maxZoom = 4;

        if (!this.canvas || !this.scrollCanvas) {
            console.error('KeyboardVisualizer: Canvas elements not found');
            return;
        }

        this.ctx = this.canvas.getContext('2d');
        this.scrollCtx = this.scrollCanvas.getContext('2d');

        // Configuration
        this.keyWidth = 16;
        this.keyHeight = 100;
        this.velLayerHeight = 25;
        this.minKey = 0;
        this.maxKey = 127;
        this.totalKeys = this.maxKey - this.minKey + 1;

        // State
        this.assetCells = [];
        this.selectedAsset = null;
        this.scrollPos = 0;
        this.maxScroll = 0;
        this.hoveredKey = null;

        // Drag state
        this.dragState = {
            active: false,
            type: null,
            asset: null,
            startX: 0,
            startKeyLo: 0,
            startKeyHi: 0,
            currentKeyLo: 0,
            currentKeyHi: 0,
            previewKeyLo: 0,
            previewKeyHi: 0,
            neighborLeft: null,
            neighborRight: null,
            snapGuideKey: null
        };

        // Colors
        this.colors = {
            whiteKeyAssigned: '#f0f0f0',
            blackKeyAssigned: '#2a2a2a',
            whiteKeyUnassigned: '#888',
            blackKeyUnassigned: '#555',
            whiteKeyBorder: '#999',
            blackKeyBorder: '#000',
            selected: '#ffa600',
            selectedHover: '#ffb347',
            velLayerBase: 'rgba(74, 158, 255, 0.6)',
            velLayerSelected: 'rgba(255, 166, 0, 0.8)',
            dragPreview: 'rgba(255, 166, 0, 0.4)',
            snapGuide: 'rgba(255, 234, 94, 0.8)'
        };

        this.resize();
        this.setupEventListeners();
    }

    resize() {
        if (!this.canvas || !this.canvas.parentElement) {
            console.warn('KeyboardVisualizer: Canvas not in DOM');
            return false;
        }

        const container = this.canvas.parentElement;
        const dpr = window.devicePixelRatio || 1;

        this.width = container.offsetWidth;
        const numLayers = this.calculateVelocityLayers();
        this.height = this.keyHeight + (numLayers * this.velLayerHeight);

        if (this.width <= 0 || this.height <= 0) {
            console.warn(`KeyboardVisualizer: Invalid dimensions (${this.width}x${this.height})`);
            return false;
        }

        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';
        this.ctx.scale(dpr, dpr);

        if (this.scrollCanvas) {
            this.scrollCanvas.width = this.width * dpr;
            this.scrollCanvas.height = 30 * dpr;
            this.scrollCanvas.style.width = this.width + 'px';
            this.scrollCanvas.style.height = '30px';
            this.scrollCtx.scale(dpr, dpr);
        }

        const totalWidth = this.totalKeys * this.keyWidth;
        this.maxScroll = Math.max(0, totalWidth - this.width);

        this.render();
        return true;
    }

    calculateVelocityLayers() {
        if (!this.assetCells || this.assetCells.length === 0) return 1;

        const keyLayerCount = {};
        for (let midi = this.minKey; midi <= this.maxKey; midi++) {
            const assetsForKey = this.getAssetsForKey(midi);
            keyLayerCount[midi] = assetsForKey.length;
        }

        const maxLayers = Math.max(1, ...Object.values(keyLayerCount));
        return Math.min(16, maxLayers);
    }

    setAssets(assetCells) {
        this.assetCells = assetCells;

        const attemptRender = (retries = 0) => {
            const rendered = this.tryRenderWhenVisible();

            if (!rendered && retries < 5) {
                requestAnimationFrame(() => attemptRender(retries + 1));
            } else if (!rendered) {
                console.warn('Canvas failed to render after 5 attempts');
            }
        };

        attemptRender();
    }

    tryRenderWhenVisible() {
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

    reset() {
        this.assetCells = [];
        this.selectedAsset = null;
        this.scrollPos = 0;
        this.zoom = 0.5;
        this.hoveredKey = null;

        if (this.ctx && this.width > 0 && this.height > 0) {
            this.ctx.fillStyle = '#1a1614';
            this.ctx.fillRect(0, 0, this.width, this.height);
        }

        if (this.scrollCtx) {
            this.scrollCtx.fillStyle = '#2a2420';
            this.scrollCtx.fillRect(0, 0, this.width, 30);
        }
    }

    render() {
        if (!this.ctx || this.width <= 0) return;

        const { ctx, width, height } = this;

        ctx.fillStyle = '#1a1614';
        ctx.fillRect(0, 0, width, height);

        const effectiveKeyWidth = this.keyWidth * this.zoom;
        const totalWidth = this.totalKeys * effectiveKeyWidth;
        this.maxScroll = Math.max(0, totalWidth - this.width);

        this.drawKeyboard();
        this.drawVelocityLayers();
        this.drawLabels();

        if (this.scrollCanvas) {
            this.renderScrollbar();
        }
    }

    drawKeyboard() {
        const { ctx, keyHeight } = this;
        const effectiveKeyWidth = this.keyWidth * this.zoom;
        const blackKeyHeight = keyHeight * 0.6;

        // WHITE KEYS
        for (let midi = this.minKey; midi <= this.maxKey; midi++) {
            if (this.isBlackKey(midi)) continue;

            const x = this.midiToX(midi);
            if (x + effectiveKeyWidth < 0 || x > this.width) continue;

            const isHovered = (this.hoveredKey === midi);
            const hasAssignment = this.getAssetsForKey(midi).length > 0;

            if (hasAssignment) {
                ctx.fillStyle = isHovered ? '#ffffff' : this.colors.whiteKeyAssigned;
            } else {
                ctx.fillStyle = isHovered ? '#aaa' : this.colors.whiteKeyUnassigned;
            }
            ctx.fillRect(x, 0, effectiveKeyWidth - 1, keyHeight);

            ctx.strokeStyle = this.colors.whiteKeyBorder;
            ctx.lineWidth = 1;
            ctx.strokeRect(x, 0, effectiveKeyWidth - 1, keyHeight);
        }

        // BLACK KEYS
        for (let midi = this.minKey; midi <= this.maxKey; midi++) {
            if (!this.isBlackKey(midi)) continue;

            const x = this.midiToX(midi);
            if (x + effectiveKeyWidth < 0 || x > this.width) continue;

            const isHovered = (this.hoveredKey === midi);
            const hasAssignment = this.getAssetsForKey(midi).length > 0;

            if (hasAssignment) {
                ctx.fillStyle = isHovered ? '#444' : this.colors.blackKeyAssigned;
            } else {
                ctx.fillStyle = isHovered ? '#777' : this.colors.blackKeyUnassigned;
            }
            ctx.fillRect(x, 0, effectiveKeyWidth - 1, blackKeyHeight);

            ctx.strokeStyle = this.colors.blackKeyBorder;
            ctx.lineWidth = 1;
            ctx.strokeRect(x, 0, effectiveKeyWidth - 1, blackKeyHeight);
        }
    }

    drawVelocityLayers() {
        const { ctx, keyHeight, velLayerHeight } = this;

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
            const endX = this.midiToX(hiKey + 1);
            const width = endX - startX;

            const isSelected = (this.selectedAsset === asset);
            const isDragging = (this.dragState.active && this.dragState.asset === asset);

            ctx.fillStyle = isSelected ? this.colors.velLayerSelected : this.colors.velLayerBase;
            if (isDragging) {
                ctx.globalAlpha = 0.3;
            }
            ctx.fillRect(startX, y, width, velLayerHeight - 2);
            ctx.globalAlpha = 1.0;

            ctx.strokeStyle = isSelected ? '#ffa600' : 'rgba(74, 158, 255, 0.8)';
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.strokeRect(startX, y, width, velLayerHeight - 2);

            if (width > 50) {
                const sampleName = asset.filename.split(/[/\\]/).pop().replace('.wav', '');
                ctx.fillStyle = isSelected ? '#000' : '#fff';
                ctx.font = '10px monospace';
                ctx.textAlign = 'left';
                ctx.fillText(sampleName.substring(0, 20), startX + 4, y + 16);
            }
        });

        // Draw drag preview
        if (this.dragState.active && this.dragState.asset) {
            this.drawDragPreview();
        }
    }

    drawDragPreview() {
        // GUARD: Only draw if drag is active
        if (!this.dragState.active || !this.dragState.asset) {
            return;
        }

        const { ctx, keyHeight, velLayerHeight } = this;
        const { asset, previewKeyLo, previewKeyHi, snapGuideKey } = this.dragState;

        const layerIndex = this.getAssetLayerIndex(asset);
        const y = keyHeight + (layerIndex * velLayerHeight);

        const startX = this.midiToX(previewKeyLo);
        const endX = this.midiToX(previewKeyHi + 1);
        const width = endX - startX;

        ctx.fillStyle = this.colors.dragPreview;
        ctx.fillRect(startX, y, width, velLayerHeight - 2);

        ctx.strokeStyle = '#ffa600';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(startX, y, width, velLayerHeight - 2);
        ctx.setLineDash([]);

        ctx.fillStyle = '#ffa600';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        const rangeText = `${this.midiToNoteName(previewKeyLo)} - ${this.midiToNoteName(previewKeyHi)}`;
        ctx.fillText(rangeText, startX + width / 2, y + 16);

        if (snapGuideKey !== null) {
            const guideX = this.midiToX(snapGuideKey);

            ctx.strokeStyle = this.colors.snapGuide;
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(guideX, 0);
            ctx.lineTo(guideX, this.height);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = this.colors.snapGuide;
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`${this.midiToNoteName(snapGuideKey)}`, guideX, this.keyHeight - 5);
        }
    }

    drawLabels() {
        const { ctx, keyWidth, keyHeight } = this;

        ctx.fillStyle = '#d0c2b9';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';

        for (let midi = this.minKey; midi <= this.maxKey; midi++) {
            if (midi % 12 === 0) {
                const x = this.midiToX(midi);
                if (x >= 0 && x < this.width) {
                    const octave = Math.floor(midi / 12) - 1;
                    ctx.fillText(`C${octave}`, x + keyWidth / 2, this.keyHeight - 5);
                }
            }
        }
    }

    renderScrollbar() {
        if (!this.scrollCtx) return;

        const { scrollCtx, width, maxScroll, scrollPos } = this;
        const height = 30;

        scrollCtx.fillStyle = '#2a2420';
        scrollCtx.fillRect(0, 0, width, height);

        const effectiveKeyWidth = this.keyWidth * this.zoom;
        const totalWidth = this.totalKeys * effectiveKeyWidth;

        const visibleKeys = width / effectiveKeyWidth;
        const visibleRatio = Math.min(1, visibleKeys / this.totalKeys);
        const thumbWidth = Math.max(40, visibleRatio * width);

        const maxThumbScroll = width - thumbWidth;
        const scrollRatio = maxScroll > 0 ? (scrollPos / maxScroll) : 0;
        const thumbX = scrollRatio * maxThumbScroll;

        scrollCtx.fillStyle = '#a35a2d';
        scrollCtx.fillRect(thumbX, 4, thumbWidth, height - 8);

        scrollCtx.strokeStyle = '#4a4038';
        scrollCtx.lineWidth = 1;
        scrollCtx.strokeRect(thumbX + 0.5, 4.5, thumbWidth - 1, height - 9);

        scrollCtx.fillStyle = '#fff';
        const handleWidth = 2;
        const handleHeight = 12;
        const handleY = (height - handleHeight) / 2;

        scrollCtx.fillRect(thumbX + 4, handleY, handleWidth, handleHeight);
        scrollCtx.fillRect(thumbX + thumbWidth - 4 - handleWidth, handleY, handleWidth, handleHeight);

        const centerX = thumbX + thumbWidth / 2;
        for (let i = -1; i <= 1; i++) {
            scrollCtx.fillRect(centerX + i * 4 - 1, handleY, handleWidth, handleHeight);
        }
    }

    // DRAG DETECTION
    detectHoverTarget(mouseX, mouseY) {
        if (mouseY < this.keyHeight) return null;

        const layerY = mouseY - this.keyHeight;
        const midi = this.xToMidi(mouseX);

        const threshold = 15;

        for (const asset of this.assetCells) {
            const loKey = parseInt(asset.params.keyrangebottom);
            const hiKey = parseInt(asset.params.keyrangetop);

            if (midi >= loKey && midi <= hiKey) {
                const layerIndex = this.getAssetLayerIndex(asset);
                const layerTop = layerIndex * this.velLayerHeight;
                const layerBottom = layerTop + this.velLayerHeight;

                if (layerY >= layerTop && layerY < layerBottom) {
                    const leftEdgeX = this.midiToX(loKey);
                    const rightEdgeX = this.midiToX(hiKey + 1);

                    if (Math.abs(mouseX - leftEdgeX) < threshold) {
                        return { type: 'edge-left', asset, edge: 'left' };
                    } else if (Math.abs(mouseX - rightEdgeX) < threshold) {
                        return { type: 'edge-right', asset, edge: 'right' };
                    } else {
                        return { type: 'body', asset };
                    }
                }
            }
        }

        return null;
    }

    getAssetLayerIndex(targetAsset) {
        let layerIndex = 0;

        for (let i = 0; i < this.assetCells.length; i++) {
            const asset = this.assetCells[i];
            if (asset === targetAsset) break;

            const otherLo = parseInt(asset.params.keyrangebottom);
            const otherHi = parseInt(asset.params.keyrangetop);
            const targetLo = parseInt(targetAsset.params.keyrangebottom);
            const targetHi = parseInt(targetAsset.params.keyrangetop);

            if (!(targetHi < otherLo || targetLo > otherHi)) {
                layerIndex++;
            }
        }

        return Math.min(layerIndex, 15);
    }

    findNeighbors(asset) {
        const loVel = parseInt(asset.params.velrangebottom);
        const hiVel = parseInt(asset.params.velrangetop);
        const loKey = parseInt(asset.params.keyrangebottom);
        const hiKey = parseInt(asset.params.keyrangetop);

        let leftNeighbor = null;
        let rightNeighbor = null;

        for (const other of this.assetCells) {
            if (other === asset) continue;

            const otherLoVel = parseInt(other.params.velrangebottom);
            const otherHiVel = parseInt(other.params.velrangetop);
            const otherLoKey = parseInt(other.params.keyrangebottom);
            const otherHiKey = parseInt(other.params.keyrangetop);

            const velOverlap = !(hiVel < otherLoVel || loVel > otherHiVel);
            if (!velOverlap) continue;

            if (otherHiKey < loKey) {
                if (!leftNeighbor || otherHiKey > parseInt(leftNeighbor.params.keyrangetop)) {
                    leftNeighbor = other;
                }
            }

            if (otherLoKey > hiKey) {
                if (!rightNeighbor || otherLoKey < parseInt(rightNeighbor.params.keyrangebottom)) {
                    rightNeighbor = other;
                }
            }
        }

        return { left: leftNeighbor, right: rightNeighbor };
    }

    startDrag(mouseX, mouseY, target) {
        if (!target) return;

        // SELECT THE ASSET FIRST (this was missing!)
        this.selectedAsset = target.asset;

        this.dragState.active = true;
        this.dragState.type = target.type;
        this.dragState.asset = target.asset;
        this.dragState.startX = mouseX;

        const loKey = parseInt(target.asset.params.keyrangebottom);
        const hiKey = parseInt(target.asset.params.keyrangetop);

        this.dragState.startKeyLo = loKey;
        this.dragState.startKeyHi = hiKey;
        this.dragState.currentKeyLo = loKey;
        this.dragState.currentKeyHi = hiKey;
        this.dragState.previewKeyLo = loKey;
        this.dragState.previewKeyHi = hiKey;

        const neighbors = this.findNeighbors(target.asset);
        this.dragState.neighborLeft = neighbors.left;
        this.dragState.neighborRight = neighbors.right;

        console.log(`Started drag: ${this.dragState.type}`, {
            keys: `${loKey}-${hiKey}`,
            leftNeighbor: neighbors.left ? parseInt(neighbors.left.params.keyrangetop) : 'none',
            rightNeighbor: neighbors.right ? parseInt(neighbors.right.params.keyrangebottom) : 'none'
        });
    }

    updateDrag(mouseX) {
        if (!this.dragState.active) return;

        const { type, asset, startX, startKeyLo, startKeyHi, neighborLeft, neighborRight } = this.dragState;
        const currentMidi = this.xToMidi(mouseX);
        const deltaMidi = currentMidi - this.xToMidi(startX);

        let newKeyLo = startKeyLo;
        let newKeyHi = startKeyHi;
        let snapGuideKey = null;

        if (type === 'edge-left') {
            newKeyLo = Math.max(0, Math.min(127, startKeyLo + deltaMidi));

            if (newKeyLo >= startKeyHi) {
                newKeyLo = startKeyHi;
            }

            if (neighborLeft) {
                const neighborRootNote = parseInt(neighborLeft.params.rootnote);
                const neighborHi = parseInt(neighborLeft.params.keyrangetop);
                const minAllowed = neighborHi + 1;

                if (newKeyLo <= minAllowed) {
                    newKeyLo = minAllowed;
                    snapGuideKey = neighborRootNote;
                }
            }

            newKeyHi = startKeyHi;

        } else if (type === 'edge-right') {
            newKeyHi = Math.max(0, Math.min(127, startKeyHi + deltaMidi));

            if (newKeyHi <= startKeyLo) {
                newKeyHi = startKeyLo;
            }

            if (neighborRight) {
                const neighborRootNote = parseInt(neighborRight.params.rootnote);
                const neighborLo = parseInt(neighborRight.params.keyrangebottom);
                const maxAllowed = neighborLo - 1;

                if (newKeyHi >= maxAllowed) {
                    newKeyHi = maxAllowed;
                    snapGuideKey = neighborRootNote;
                }
            }

            newKeyLo = startKeyLo;

        } else if (type === 'body') {
            const zoneWidth = startKeyHi - startKeyLo;
            newKeyLo = Math.max(0, Math.min(127 - zoneWidth, startKeyLo + deltaMidi));
            newKeyHi = newKeyLo + zoneWidth;

            if (neighborLeft) {
                const neighborRootNote = parseInt(neighborLeft.params.rootnote);
                const neighborHi = parseInt(neighborLeft.params.keyrangetop);
                const minAllowed = neighborHi + 1;

                if (newKeyLo <= minAllowed) {
                    newKeyLo = minAllowed;
                    newKeyHi = newKeyLo + zoneWidth;
                    snapGuideKey = neighborRootNote;
                }
            }

            if (neighborRight) {
                const neighborRootNote = parseInt(neighborRight.params.rootnote);
                const neighborLo = parseInt(neighborRight.params.keyrangebottom);
                const maxAllowed = neighborLo - 1;

                if (newKeyHi >= maxAllowed) {
                    newKeyHi = maxAllowed;
                    newKeyLo = newKeyHi - zoneWidth;
                    snapGuideKey = neighborRootNote;
                }
            }
        }

        this.dragState.currentKeyLo = newKeyLo;
        this.dragState.currentKeyHi = newKeyHi;
        this.dragState.previewKeyLo = newKeyLo;
        this.dragState.previewKeyHi = newKeyHi;
        this.dragState.snapGuideKey = snapGuideKey;

        asset.params.keyrangebottom = newKeyLo.toString();
        asset.params.keyrangetop = newKeyHi.toString();

        this.syncDropdownsFromAsset(asset);

        this.render();
    }

    endDrag() {
        if (!this.dragState.active) return;

        // Set flag to prevent click handler from firing
        this._justFinishedDrag = true;

        // SAVE REFERENCES BEFORE CLEARING STATE
        const draggedAsset = this.dragState.asset;
        const finalKeyLo = this.dragState.currentKeyLo;
        const finalKeyHi = this.dragState.currentKeyHi;

        console.log(`Ended drag: ${this.dragState.type}`, {
            finalKeys: `${finalKeyLo}-${finalKeyHi}`
        });

        // Final update to ensure consistency
        if (draggedAsset) {
            draggedAsset.params.keyrangebottom = finalKeyLo.toString();
            draggedAsset.params.keyrangetop = finalKeyHi.toString();
        }

        // Reset drag state
        this.dragState = {
            active: false,
            type: null,
            asset: null,
            startX: 0,
            startKeyLo: 0,
            startKeyHi: 0,
            currentKeyLo: 0,
            currentKeyHi: 0,
            previewKeyLo: 0,
            previewKeyHi: 0,
            neighborLeft: null,
            neighborRight: null,
            snapGuideKey: null
        };

        // Sync dropdowns AFTER clearing state (with saved reference)
        if (draggedAsset) {
            this.syncDropdownsFromAsset(draggedAsset);
        }

       this.render();
    }

    // syncDropdownsFromAsset(asset) {
    //     if (window._multiKeyboardViz && window._multiKeyboardViz.selectedAsset === asset) {
    //         const loKey = parseInt(asset.params.keyrangebottom);
    //         const hiKey = parseInt(asset.params.keyrangetop);

    //         const keyLoDropdown = document.getElementById('multiKeyLo');
    //         const keyHiDropdown = document.getElementById('multiKeyHi');

    //         if (keyLoDropdown) keyLoDropdown.value = loKey.toString();
    //         if (keyHiDropdown) keyHiDropdown.value = hiKey.toString();
    //     }
    // }

    syncDropdownsFromAsset(asset) {
        if (window._multiKeyboardViz && window._multiKeyboardViz.selectedAsset === asset) {
        const rootNote = parseInt(asset.params.rootnote);
        const loKey = parseInt(asset.params.keyrangebottom);
        const hiKey = parseInt(asset.params.keyrangetop);
        
        const rootNoteDropdown = document.getElementById('multiRootNote');
        const keyLoDropdown = document.getElementById('multiKeyLo');
        const keyHiDropdown = document.getElementById('multiKeyHi');
        
        if (rootNoteDropdown) rootNoteDropdown.value = rootNote.toString();
        if (keyLoDropdown) keyLoDropdown.value = loKey.toString();
        if (keyHiDropdown) keyHiDropdown.value = hiKey.toString();
    } else {
            console.log('❌ Condition failed - dropdowns NOT updated');
        }
    }


    setupEventListeners() {
        // Mouse down - start drag
        this.canvas.addEventListener('mousedown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const target = this.detectHoverTarget(x, y);
            if (target) {
                this.startDrag(x, y, target);
                e.preventDefault();
            }
        });

        // Mouse move - update drag or cursor
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            if (this.dragState.active) {
                this.updateDrag(x);
            } else {
                const target = this.detectHoverTarget(x, y);
                if (target) {
                    if (target.type === 'edge-left' || target.type === 'edge-right') {
                        this.canvas.style.cursor = 'ew-resize';
                    } else if (target.type === 'body') {
                        this.canvas.style.cursor = 'move';
                    }
                } else {
                    this.canvas.style.cursor = 'default';
                }

                // Hover effect
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
        });

        // Mouse up - end drag
        this.canvas.addEventListener('mouseup', () => {
            if (this.dragState.active) {
                this.endDrag();
            }
        });

        // Mouse leave - cancel drag
        this.canvas.addEventListener('mouseleave', () => {
            if (this.dragState.active) {
                this.endDrag();
            }
            this.canvas.style.cursor = 'default';
        });

        // Mouse click - select asset
        this.canvas.addEventListener('click', (e) => {
            if (this.dragState.active) return;

            // ADD THIS FLAG CHECK:
            if (this._justFinishedDrag) {
                this._justFinishedDrag = false;
                return;  // Don't process click after drag
            }

            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            if (y < this.keyHeight) {
                const midi = this.xToMidi(x);
                if (midi >= this.minKey && midi <= this.maxKey) {
                    const assets = this.getAssetsForKey(midi);
                    if (assets.length > 0) {
                        this.selectAsset(assets[0]);
                    }
                }
            } else {
                const target = this.detectHoverTarget(x, y);
                if (target && target.asset) {
                    this.selectAsset(target.asset);
                }
            }
        });

        // Scroll handling
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY;
            this.scrollPos = Math.max(0, Math.min(this.maxScroll, this.scrollPos + delta));
            this.render();
        });

        // SCROLL-ZOOM BAR INTERACTION
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
                    const effectiveKeyWidth = this.keyWidth * this.zoom;
                    const scrollDelta = (deltaX / this.width) * this.totalKeys * effectiveKeyWidth;
                    this.scrollPos = Math.max(0, Math.min(this.maxScroll, startScroll + scrollDelta));
                } else if (draggingMode === 'left-edge') {
                    const zoomSensitivity = 0.01;
                    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, startZoom * (1 + deltaX * zoomSensitivity)));
                    this.zoom = newZoom;
                    this.maxScroll = Math.max(0, (this.totalKeys * this.keyWidth * this.zoom) - this.width);
                } else if (draggingMode === 'right-edge') {
                    const zoomSensitivity = 0.01;
                    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, startZoom * (1 - deltaX * zoomSensitivity)));
                    this.zoom = newZoom;
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

    selectAsset(asset) {
        this.selectedAsset = asset;
        this.render();

        if (this.onAssetSelected) {
            this.onAssetSelected(asset);
        }
    }

    midiToX(midi) {
        const effectiveKeyWidth = this.keyWidth * this.zoom;
        return ((midi - this.minKey) * effectiveKeyWidth) - this.scrollPos;
    }

    xToMidi(x) {
        const effectiveKeyWidth = this.keyWidth * this.zoom;
        return Math.floor((x + this.scrollPos) / effectiveKeyWidth) + this.minKey;
    }

    isBlackKey(midi) {
        const note = midi % 12;
        return [1, 3, 6, 8, 10].includes(note);
    }

    midiToNoteName(midi) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midi / 12) - 1;
        const note = notes[midi % 12];
        return `${note}${octave}`;
    }

    getAssetsForKey(midi) {
        return this.assetCells.filter(asset => {
            const loKey = parseInt(asset.params.keyrangebottom);
            const hiKey = parseInt(asset.params.keyrangetop);
            return midi >= loKey && midi <= hiKey;
        });
    }

    getAssetsForKeyAndVelLayer(midi, layer) {
        const velRanges = [
            [0, 42],
            [43, 84],
            [85, 127]
        ];

        return this.assetCells.filter(asset => {
            const loKey = parseInt(asset.params.keyrangebottom);
            const hiKey = parseInt(asset.params.keyrangetop);
            const loVel = parseInt(asset.params.velrangebottom);
            const hiVel = parseInt(asset.params.velrangetop);

            const [layerLoVel, layerHiVel] = velRanges[layer];

            return (midi >= loKey && midi <= hiKey) &&
                (loVel <= layerHiVel && hiVel >= layerLoVel);
        });
    }

    getVelLayerColor(layer) {
        return [this.colors.velLayer1, this.colors.velLayer2, this.colors.velLayer3][layer];
    }
}
window.KeyboardVisualizer = KeyboardVisualizer;