interface ProcessParams {
    colorCount: number;
    smoothing: number;
    posterizeLevel: number;
    edgeProtect: number;
}

interface WorkerResponse {
    type: 'progress' | 'complete' | 'error';
    imageData?: {
        data: Uint8ClampedArray | number[];
        width: number;
        height: number;
    };
    stage?: string;
    percent?: number;
    message?: string;
}

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone') as HTMLElement;
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const uploadSection = document.getElementById('upload-section') as HTMLElement;
    const editorSection = document.getElementById('editor-section') as HTMLElement;
    const canvasBefore = document.getElementById('canvas-before') as HTMLCanvasElement;
    const canvasAfter = document.getElementById('canvas-after') as HTMLCanvasElement;
    const processingOverlay = document.getElementById('processing-overlay') as HTMLElement;
    const processingText = document.querySelector('.processing-text') as HTMLElement;

    const colorCountSlider = document.getElementById('color-count') as HTMLInputElement;
    const smoothingSlider = document.getElementById('smoothing') as HTMLInputElement;
    const posterizeSlider = document.getElementById('posterize') as HTMLInputElement;
    const edgeProtectSlider = document.getElementById('edge-protect') as HTMLInputElement;

    const colorCountValue = document.getElementById('color-count-value') as HTMLElement;
    const smoothingValue = document.getElementById('smoothing-value') as HTMLElement;
    const posterizeValue = document.getElementById('posterize-value') as HTMLElement;
    const edgeProtectValue = document.getElementById('edge-protect-value') as HTMLElement;

    const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;
    const applyBtn = document.getElementById('apply-btn') as HTMLButtonElement;
    const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement;
    const newImageBtn = document.getElementById('new-image-btn') as HTMLButtonElement;

    const ctxBefore = canvasBefore.getContext('2d');
    const ctxAfter = canvasAfter.getContext('2d');

    if (!ctxBefore || !ctxAfter) {
        throw new Error('Canvas 2D context is not supported.');
    }

    let worker: Worker | null = null;
    let isProcessing = false;
    let currentImage: HTMLImageElement | null = null;
    let currentImageData: ImageData | null = null;

    const defaultParams: ProcessParams = {
        colorCount: 32,
        smoothing: 3,
        posterizeLevel: 8,
        edgeProtect: 70,
    };

    function initWorker() {
        if (worker) {
            worker.terminate();
        }

        worker = new Worker('js/imageWorker.js');

        worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
            const { type, imageData, stage, percent, message } = event.data;

            switch (type) {
                case 'progress':
                    processingText.textContent = `${stage} (${percent ?? 0}%)`;
                    break;
                case 'complete':
                    if (imageData) {
                        const result = new ImageData(
                            new Uint8ClampedArray(imageData.data),
                            imageData.width,
                            imageData.height
                        );
                        ctxAfter!.putImageData(result, 0, 0);
                    }
                    isProcessing = false;
                    processingOverlay.classList.add('hidden');
                    applyBtn.disabled = false;
                    break;
                case 'error':
                    console.error('Worker error:', message);
                    alert('画像処理中にエラーが発生しました: ' + message);
                    isProcessing = false;
                    processingOverlay.classList.add('hidden');
                    applyBtn.disabled = false;
                    break;
            }
        };

        worker.onerror = (error) => {
            console.error('Worker error:', error.message);
            isProcessing = false;
            processingOverlay.classList.add('hidden');
            applyBtn.disabled = false;
        };
    }

    initWorker();

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');

        const files = e.dataTransfer?.files;
        if (files && files.length > 0 && files[0].type.startsWith('image/')) {
            loadImage(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement | null;
        const files = target?.files;
        if (files && files.length > 0) {
            loadImage(files[0]);
        }
    });

    dropZone.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'LABEL') {
            fileInput.click();
        }
    });

    function loadImage(file: File) {
        const reader = new FileReader();

        reader.onload = (event: ProgressEvent<FileReader>) => {
            const result = event.target?.result;
            if (typeof result !== 'string') {
                return;
            }

            const img = new Image();

            img.onload = () => {
                currentImage = img;
                let { width, height } = img;
                const maxSize = 1200;
                if (width > maxSize || height > maxSize) {
                    const ratio = Math.min(maxSize / width, maxSize / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }

                canvasBefore.width = width;
                canvasBefore.height = height;
                canvasAfter.width = width;
                canvasAfter.height = height;

                ctxBefore!.drawImage(img, 0, 0, width, height);
                currentImageData = ctxBefore!.getImageData(0, 0, width, height);

                uploadSection.classList.add('hidden');
                editorSection.classList.remove('hidden');
                resetParameters();
                processImage();
            };

            img.src = result;
        };

        reader.readAsDataURL(file);
    }

    colorCountSlider.addEventListener('input', () => {
        colorCountValue.textContent = colorCountSlider.value;
    });

    smoothingSlider.addEventListener('input', () => {
        smoothingValue.textContent = smoothingSlider.value;
    });

    posterizeSlider.addEventListener('input', () => {
        posterizeValue.textContent = posterizeSlider.value;
    });

    edgeProtectSlider.addEventListener('input', () => {
        edgeProtectValue.textContent = `${edgeProtectSlider.value}%`;
    });

    function getParams(): ProcessParams {
        return {
            colorCount: parseInt(colorCountSlider.value, 10),
            smoothing: parseInt(smoothingSlider.value, 10),
            posterizeLevel: parseInt(posterizeSlider.value, 10),
            edgeProtect: parseInt(edgeProtectSlider.value, 10),
        };
    }

    function resetParameters() {
        colorCountSlider.value = String(defaultParams.colorCount);
        smoothingSlider.value = String(defaultParams.smoothing);
        posterizeSlider.value = String(defaultParams.posterizeLevel);
        edgeProtectSlider.value = String(defaultParams.edgeProtect);

        colorCountValue.textContent = String(defaultParams.colorCount);
        smoothingValue.textContent = String(defaultParams.smoothing);
        posterizeValue.textContent = String(defaultParams.posterizeLevel);
        edgeProtectValue.textContent = `${defaultParams.edgeProtect}%`;
    }

    function processImage() {
        if (!currentImageData || isProcessing || worker === null) {
            return;
        }

        isProcessing = true;
        applyBtn.disabled = true;

        processingOverlay.classList.remove('hidden');
        processingText.textContent = '処理中...';

        const params = getParams();
        const imageDataCopy = {
            data: currentImageData.data.slice(),
            width: currentImageData.width,
            height: currentImageData.height,
        };

        worker.postMessage(
            {
                type: 'process',
                imageData: imageDataCopy,
                params,
            },
            [imageDataCopy.data.buffer]
        );
    }

    applyBtn.addEventListener('click', processImage);

    resetBtn.addEventListener('click', () => {
        resetParameters();
        processImage();
    });

    downloadBtn.addEventListener('click', () => {
        if (!currentImage) {
            return;
        }

        const link = document.createElement('a');
        link.download = 'flat_color_fixed.png';
        link.href = canvasAfter.toDataURL('image/png');
        link.click();
    });

    newImageBtn.addEventListener('click', () => {
        if (isProcessing) {
            initWorker();
            isProcessing = false;
        }

        currentImage = null;
        currentImageData = null;
        fileInput.value = '';

        ctxBefore.clearRect(0, 0, canvasBefore.width, canvasBefore.height);
        ctxAfter.clearRect(0, 0, canvasAfter.width, canvasAfter.height);

        editorSection.classList.add('hidden');
        uploadSection.classList.remove('hidden');
        processingOverlay.classList.add('hidden');
        applyBtn.disabled = false;
    });
});
