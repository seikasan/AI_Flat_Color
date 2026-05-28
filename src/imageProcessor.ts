/**
 * AI Flat Color Fixer - Image Processor
 * 画像処理エンジン：色量子化、スムージング、ポスタライズ
 */

interface ProcessParams {
    colorCount: number;
    smoothing: number;
    posterizeLevel: number;
    edgeProtect: number;
}

class ImageProcessor {
    private originalImageData: ImageData | null = null;
    private width = 0;
    private height = 0;

    public setImage(imageData: ImageData): void {
        this.originalImageData = this.cloneImageData(imageData);
        this.width = imageData.width;
        this.height = imageData.height;
    }

    private cloneImageData(imageData: ImageData): ImageData {
        return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
    }

    public process(params: ProcessParams): ImageData {
        if (!this.originalImageData) {
            throw new Error('画像データが設定されていません。');
        }

        const { colorCount, smoothing, posterizeLevel, edgeProtect } = params;
        let imageData = this.cloneImageData(this.originalImageData);
        const edgeMap = this.detectEdges(imageData);

        if (smoothing > 0) {
            imageData = this.applyMedianFilter(imageData, smoothing, edgeMap, edgeProtect / 100);
        }

        if (colorCount < 64) {
            imageData = this.quantizeColors(imageData, colorCount, edgeMap, edgeProtect / 100);
        }

        if (posterizeLevel < 16) {
            imageData = this.posterize(imageData, posterizeLevel);
        }

        return imageData;
    }

    private detectEdges(imageData: ImageData): Float32Array {
        const { width, height, data } = imageData;
        const edgeMap = new Float32Array(width * height);
        const gray = new Float32Array(width * height);

        for (let i = 0; i < data.length; i += 4) {
            const idx = i / 4;
            gray[idx] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
        }

        const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
        const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let gx = 0;
                let gy = 0;

                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const idx = (y + ky) * width + (x + kx);
                        const ki = (ky + 1) * 3 + (kx + 1);
                        gx += gray[idx] * sobelX[ki];
                        gy += gray[idx] * sobelY[ki];
                    }
                }

                const magnitude = Math.sqrt(gx * gx + gy * gy);
                edgeMap[y * width + x] = Math.min(1, magnitude * 2);
            }
        }

        return edgeMap;
    }

    private applyMedianFilter(imageData: ImageData, strength: number, edgeMap: Float32Array, edgeProtect: number): ImageData {
        const { width, height, data } = imageData;
        const result = new Uint8ClampedArray(data.length);
        const radius = Math.ceil(strength / 2);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const edgeStrength = edgeMap[y * width + x];

                if (edgeStrength > 0.3 && edgeProtect > 0.5) {
                    result[idx] = data[idx];
                    result[idx + 1] = data[idx + 1];
                    result[idx + 2] = data[idx + 2];
                    result[idx + 3] = data[idx + 3];
                    continue;
                }

                const neighbors = { r: [] as number[], g: [] as number[], b: [] as number[] };

                for (let ky = -radius; ky <= radius; ky++) {
                    for (let kx = -radius; kx <= radius; kx++) {
                        const nx = Math.max(0, Math.min(width - 1, x + kx));
                        const ny = Math.max(0, Math.min(height - 1, y + ky));
                        const nIdx = (ny * width + nx) * 4;

                        neighbors.r.push(data[nIdx]);
                        neighbors.g.push(data[nIdx + 1]);
                        neighbors.b.push(data[nIdx + 2]);
                    }
                }

                neighbors.r.sort((a, b) => a - b);
                neighbors.g.sort((a, b) => a - b);
                neighbors.b.sort((a, b) => a - b);

                const mid = Math.floor(neighbors.r.length / 2);
                const blend = edgeStrength * edgeProtect;

                result[idx] = Math.round(data[idx] * blend + neighbors.r[mid] * (1 - blend));
                result[idx + 1] = Math.round(data[idx + 1] * blend + neighbors.g[mid] * (1 - blend));
                result[idx + 2] = Math.round(data[idx + 2] * blend + neighbors.b[mid] * (1 - blend));
                result[idx + 3] = data[idx + 3];
            }
        }

        return new ImageData(result, width, height);
    }

    private quantizeColors(imageData: ImageData, colorCount: number, edgeMap: Float32Array, edgeProtect: number): ImageData {
        const { width, height, data } = imageData;
        const result = new Uint8ClampedArray(data.length);
        const sampleSize = Math.min(10000, width * height);
        const sampleStep = Math.max(1, Math.floor((width * height) / sampleSize));
        const samples: number[][] = [];

        for (let i = 0; i < data.length; i += sampleStep * 4) {
            samples.push([data[i], data[i + 1], data[i + 2]]);
        }

        const centroids = this.kMeans(samples, colorCount, 10);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const edgeStrength = edgeMap[y * width + x];
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];

                let minDist = Infinity;
                let nearestColor = [r, g, b];

                for (const centroid of centroids) {
                    const dist = (r - centroid[0]) ** 2 + (g - centroid[1]) ** 2 + (b - centroid[2]) ** 2;
                    if (dist < minDist) {
                        minDist = dist;
                        nearestColor = centroid;
                    }
                }

                const blend = edgeStrength * edgeProtect;
                result[idx] = Math.round(r * blend + nearestColor[0] * (1 - blend));
                result[idx + 1] = Math.round(g * blend + nearestColor[1] * (1 - blend));
                result[idx + 2] = Math.round(b * blend + nearestColor[2] * (1 - blend));
                result[idx + 3] = data[idx + 3];
            }
        }

        return new ImageData(result, width, height);
    }

    private kMeans(samples: number[][], k: number, maxIterations: number): number[][] {
        const centroids: number[][] = [];
        const usedIndices = new Set<number>();

        while (centroids.length < k && centroids.length < samples.length) {
            const idx = Math.floor(Math.random() * samples.length);
            if (!usedIndices.has(idx)) {
                usedIndices.add(idx);
                centroids.push([...samples[idx]]);
            }
        }

        for (let iter = 0; iter < maxIterations; iter++) {
            const clusters: number[][][] = Array.from({ length: k }, () => []);

            for (const sample of samples) {
                let minDist = Infinity;
                let nearestIdx = 0;

                for (let i = 0; i < centroids.length; i++) {
                    const dist =
                        (sample[0] - centroids[i][0]) ** 2 +
                        (sample[1] - centroids[i][1]) ** 2 +
                        (sample[2] - centroids[i][2]) ** 2;

                    if (dist < minDist) {
                        minDist = dist;
                        nearestIdx = i;
                    }
                }

                clusters[nearestIdx].push(sample);
            }

            let converged = true;
            for (let i = 0; i < k; i++) {
                if (clusters[i].length === 0) {
                    continue;
                }

                const newCentroid = [0, 0, 0];
                for (const sample of clusters[i]) {
                    newCentroid[0] += sample[0];
                    newCentroid[1] += sample[1];
                    newCentroid[2] += sample[2];
                }

                newCentroid[0] /= clusters[i].length;
                newCentroid[1] /= clusters[i].length;
                newCentroid[2] /= clusters[i].length;

                const diff =
                    Math.abs(centroids[i][0] - newCentroid[0]) +
                    Math.abs(centroids[i][1] - newCentroid[1]) +
                    Math.abs(centroids[i][2] - newCentroid[2]);

                if (diff > 1) {
                    converged = false;
                }

                centroids[i] = newCentroid;
            }

            if (converged) {
                break;
            }
        }

        return centroids.map((centroid) => centroid.map(Math.round));
    }

    private posterize(imageData: ImageData, levels: number): ImageData {
        const { data, width, height } = imageData;
        const result = new Uint8ClampedArray(data.length);
        const step = 255 / (levels - 1);

        for (let i = 0; i < data.length; i += 4) {
            result[i] = Math.round(Math.round(data[i] / step) * step);
            result[i + 1] = Math.round(Math.round(data[i + 1] / step) * step);
            result[i + 2] = Math.round(Math.round(data[i + 2] / step) * step);
            result[i + 3] = data[i + 3];
        }

        return new ImageData(result, width, height);
    }
}
