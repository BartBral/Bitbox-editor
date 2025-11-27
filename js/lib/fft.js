
// The MIT License (MIT)
// Copyright (c) 2015 Vail Systems
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


/**
 * FFT.js - Fast Fourier Transform
 * Optimized implementation for audio analysis
 * Based on Cooley-Tukey algorithm
 */

class FFT {
    constructor(size) {
        this.size = size;
        this._csize = size << 1;

        // Pre-compute tables
        this.table = new Float64Array(this.size * 2);
        for (let i = 0; i < this.table.length; i += 2) {
            const angle = Math.PI * i / this.size;
            this.table[i] = Math.cos(angle);
            this.table[i + 1] = -Math.sin(angle);
        }

        // Find size's power of two
        let power = 0;
        for (let t = 1; this.size > t; t <<= 1)
            power++;

        // Calculate initial step's width (power = power of two of size)
        this._width = power % 2 === 0 ? power - 1 : power;

        // Pre-compute bit reversal table
        this._bitrev = new Int32Array(1 << this._width);
        for (let j = 0; j < this._bitrev.length; j++) {
            this._bitrev[j] = 0;
            for (let shift = 0; shift < this._width; shift += 2) {
                const revShift = this._width - shift - 2;
                this._bitrev[j] |= ((j >>> shift) & 3) << revShift;
            }
        }

        this._out = null;
        this._data = null;
        this._inv = 0;
    }

    fromComplexArray(complex, storage) {
        const res = storage || new Float64Array(complex.length >>> 1);
        for (let i = 0; i < complex.length; i += 2)
            res[i >>> 1] = complex[i];
        return res;
    }

    createComplexArray() {
        const res = new Float64Array(this._csize);
        return res;
    }

    toComplexArray(input, storage) {
        const res = storage || this.createComplexArray();
        for (let i = 0; i < res.length; i += 2) {
            res[i] = input[i >>> 1];
            res[i + 1] = 0;
        }
        return res;
    }

    completeSpectrum(spectrum) {
        const size = this._csize;
        const half = size >>> 1;
        for (let i = 2; i < half; i += 2) {
            spectrum[size - i] = spectrum[i];
            spectrum[size - i + 1] = -spectrum[i + 1];
        }
    }

    transform(out, data) {
        if (out === data)
            throw new Error('Input and output buffers must be different');

        this._out = out;
        this._data = data;
        this._inv = 0;
        this._transform4();
        this._out = null;
        this._data = null;
    }

    realTransform(out, data) {
        this.transform(out, data);

        const size = this._csize;

        // Use symmetry to get full spectrum
        out[size] = out[0];
        out[size + 1] = out[1];

        // Apply conjugate symmetry
        for (let i = 2; i < size; i += 2) {
            out[size + i] = out[i];
            out[size + i + 1] = -out[i + 1];
        }
    }

    inverseTransform(out, data) {
        if (out === data)
            throw new Error('Input and output buffers must be different');

        this._out = out;
        this._data = data;
        this._inv = 1;
        this._transform4();
        for (let i = 0; i < out.length; i++)
            out[i] /= this.size;
        this._out = null;
        this._data = null;
    }

    _transform4() {
        const out = this._out;
        const size = this._csize;

        // Initial step (permute and transform)
        const width = this._width;
        let step = 1 << width;
        let len = (size / step) << 1;

        let outOff;
        let t;
        let bitrev = this._bitrev;
        if (len === 4) {
            for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
                const off = bitrev[t];
                this._singleTransform2(outOff, off, step);
            }
        } else {
            for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
                const off = bitrev[t];
                this._singleTransform4(outOff, off, step);
            }
        }

        // Loop through steps in decreasing order
        for (step >>= 2; step >= 2; step >>= 2) {
            len = (size / step) << 1;
            const quarterLen = len >>> 2;

            // Loop through offsets in the data
            for (outOff = 0; outOff < size; outOff += len) {
                // Full case
                const limit = outOff + quarterLen;
                for (let i = outOff, k = 0; i < limit; i += 2, k += step) {
                    const A = i;
                    const B = A + quarterLen;
                    const C = B + quarterLen;
                    const D = C + quarterLen;

                    // Original values
                    const Ar = out[A];
                    const Ai = out[A + 1];
                    const Br = out[B];
                    const Bi = out[B + 1];
                    const Cr = out[C];
                    const Ci = out[C + 1];
                    const Dr = out[D];
                    const Di = out[D + 1];

                    // Middle values
                    const MAr = Ar;
                    const MAi = Ai;

                    const tableBr = this.table[k];
                    const tableBi = this._inv === 1 ? -this.table[k + 1] : this.table[k + 1];
                    const MBr = Br * tableBr - Bi * tableBi;
                    const MBi = Br * tableBi + Bi * tableBr;

                    const tableCr = this.table[2 * k];
                    const tableCi = this._inv === 1 ? -this.table[2 * k + 1] : this.table[2 * k + 1];
                    const MCr = Cr * tableCr - Ci * tableCi;
                    const MCi = Cr * tableCi + Ci * tableCr;

                    const tableDr = this.table[3 * k];
                    const tableDi = this._inv === 1 ? -this.table[3 * k + 1] : this.table[3 * k + 1];
                    const MDr = Dr * tableDr - Di * tableDi;
                    const MDi = Dr * tableDi + Di * tableDr;

                    // Pre-Final values
                    const T0r = MAr + MCr;
                    const T0i = MAi + MCi;
                    const T1r = MAr - MCr;
                    const T1i = MAi - MCi;
                    const T2r = MBr + MDr;
                    const T2i = MBi + MDi;
                    const T3r = this._inv === 1 ? MBi - MDi : MDi - MBi;
                    const T3i = this._inv === 1 ? MDr - MBr : MBr - MDr;

                    // Final values
                    out[A] = T0r + T2r;
                    out[A + 1] = T0i + T2i;
                    out[B] = T1r + T3r;
                    out[B + 1] = T1i + T3i;
                    out[C] = T0r - T2r;
                    out[C + 1] = T0i - T2i;
                    out[D] = T1r - T3r;
                    out[D + 1] = T1i - T3i;
                }
            }
        }
    }

    _singleTransform2(outOff, off, step) {
        const out = this._out;
        const data = this._data;

        const evenR = data[off];
        const evenI = data[off + 1];
        const oddR = data[off + step];
        const oddI = data[off + step + 1];

        out[outOff] = evenR + oddR;
        out[outOff + 1] = evenI + oddI;
        out[outOff + 2] = evenR - oddR;
        out[outOff + 3] = evenI - oddI;
    }

    _singleTransform4(outOff, off, step) {
        const out = this._out;
        const data = this._data;
        const inv = this._inv;
        const step2 = step * 2;
        const step3 = step * 3;

        const Ar = data[off];
        const Ai = data[off + 1];
        const Br = data[off + step];
        const Bi = data[off + step + 1];
        const Cr = data[off + step2];
        const Ci = data[off + step2 + 1];
        const Dr = data[off + step3];
        const Di = data[off + step3 + 1];

        const T0r = Ar + Cr;
        const T0i = Ai + Ci;
        const T1r = Ar - Cr;
        const T1i = Ai - Ci;
        const T2r = Br + Dr;
        const T2i = Bi + Di;
        const T3r = inv === 1 ? Bi - Di : Di - Bi;
        const T3i = inv === 1 ? Dr - Br : Br - Dr;

        out[outOff] = T0r + T2r;
        out[outOff + 1] = T0i + T2i;
        out[outOff + 2] = T1r + T3r;
        out[outOff + 3] = T1i + T3i;
        out[outOff + 4] = T0r - T2r;
        out[outOff + 5] = T0i - T2i;
        out[outOff + 6] = T1r - T3r;
        out[outOff + 7] = T1i - T3i;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FFT;
}