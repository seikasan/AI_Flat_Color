/**
 * AI Flat Color Fixer - Main Application
 * UIインタラクションとワークフロー管理（Web Worker対応版）
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM要素
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const uploadSection = document.getElementById('upload-section');
    const editorSection = document.getElementById('editor-section');
    const canvasBefore = document.getElementById('canvas-before');
    const canvasAfter = document.getElementById('canvas-after');
    const processingOverlay = document.getElementById('processing-overlay');
    const processingText = document.querySelector('.processing-text');

    // コントロール要素
    const colorCountSlider = document.getElementById('color-count');
    const smoothingSlider = document.getElementById('smoothing');
    const posterizeSlider = document.getElementById('posterize');
    const edgeProtectSlider = document.getElementById('edge-protect');

    const colorCountValue = document.getElementById('color-count-value');
    const smoothingValue = document.getElementById('smoothing-value');
    const posterizeValue = document.getElementById('posterize-value');
    const edgeProtectValue = document.getElementById('edge-protect-value');

    const resetBtn = document.getElementById('reset-btn');
    const applyBtn = document.getElementById('apply-btn');
    const downloadBtn = document.getElementById('download-btn');
    const newImageBtn = document.getElementById('new-image-btn');

    // Canvas コンテキスト
    const ctxBefore = canvasBefore.getContext('2d');
    const ctxAfter = canvasAfter.getContext('2d');

    // Web Worker
    let worker = null;
    let isProcessing = false;

    // 現在の画像データ
    let currentImage = null;
    let currentImageData = null;

    // デフォルトパラメータ
    const defaultParams = {
        colorCount: 32,
        smoothing: 3,
        posterizeLevel: 8,
        edgeProtect: 70
    };

    // ========================================
    // Web Worker 初期化
    // ========================================

    function initWorker() {
        if (worker) {
            worker.terminate();
        }

        worker = new Worker('js/imageWorker.js');

        worker.onmessage = (e) => {
            const { type, imageData, stage, percent, message } = e.data;

            switch (type) {
                case 'progress':
                    processingText.textContent = `${stage} (${percent}%)`;
                    break;

                case 'complete':
                    // 結果を描画
                    const result = new ImageData(
                        new Uint8ClampedArray(imageData.data),
                        imageData.width,
                        imageData.height
                    );
                    ctxAfter.putImageData(result, 0, 0);

                    // 処理完了
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
            console.error('Worker error:', error);
            isProcessing = false;
            processingOverlay.classList.add('hidden');
            applyBtn.disabled = false;
        };
    }

    // 初期化
    initWorker();

    // ========================================
    // ファイルアップロード処理
    // ========================================

    // ドラッグ&ドロップイベント
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

        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            loadImage(files[0]);
        }
    });

    // ファイル選択イベント
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            loadImage(e.target.files[0]);
        }
    });

    // ドロップゾーンクリックでファイル選択
    dropZone.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'LABEL') {
            fileInput.click();
        }
    });

    /**
     * 画像を読み込んで表示
     */
    function loadImage(file) {
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();

            img.onload = () => {
                currentImage = img;

                // Canvas サイズを設定
                const maxSize = 1200;
                let { width, height } = img;

                if (width > maxSize || height > maxSize) {
                    const ratio = Math.min(maxSize / width, maxSize / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }

                canvasBefore.width = width;
                canvasBefore.height = height;
                canvasAfter.width = width;
                canvasAfter.height = height;

                // Before画像を描画
                ctxBefore.drawImage(img, 0, 0, width, height);

                // 画像データを保存
                currentImageData = ctxBefore.getImageData(0, 0, width, height);

                // UIを切り替え
                uploadSection.classList.add('hidden');
                editorSection.classList.remove('hidden');

                // パラメータをリセット
                resetParameters();

                // 初回処理を実行
                processImage();
            };

            img.src = e.target.result;
        };

        reader.readAsDataURL(file);
    }

    // ========================================
    // パラメータコントロール
    // ========================================

    // スライダー値の表示更新
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
        edgeProtectValue.textContent = edgeProtectSlider.value + '%';
    });

    /**
     * 現在のパラメータを取得
     */
    function getParams() {
        return {
            colorCount: parseInt(colorCountSlider.value),
            smoothing: parseInt(smoothingSlider.value),
            posterizeLevel: parseInt(posterizeSlider.value),
            edgeProtect: parseInt(edgeProtectSlider.value)
        };
    }

    /**
     * パラメータをデフォルトにリセット
     */
    function resetParameters() {
        colorCountSlider.value = defaultParams.colorCount;
        smoothingSlider.value = defaultParams.smoothing;
        posterizeSlider.value = defaultParams.posterizeLevel;
        edgeProtectSlider.value = defaultParams.edgeProtect;

        colorCountValue.textContent = defaultParams.colorCount;
        smoothingValue.textContent = defaultParams.smoothing;
        posterizeValue.textContent = defaultParams.posterizeLevel;
        edgeProtectValue.textContent = defaultParams.edgeProtect + '%';
    }

    // ========================================
    // 画像処理（Web Worker使用）
    // ========================================

    /**
     * 画像処理を実行（バックグラウンド）
     */
    function processImage() {
        if (!currentImageData || isProcessing) return;

        isProcessing = true;
        applyBtn.disabled = true;

        // 処理中オーバーレイを表示
        processingOverlay.classList.remove('hidden');
        processingText.textContent = '処理中...';

        const params = getParams();

        // Workerにデータを送信（Transferable Objects使用で高速化）
        const imageDataCopy = {
            data: currentImageData.data.slice(),
            width: currentImageData.width,
            height: currentImageData.height
        };

        worker.postMessage({
            type: 'process',
            imageData: imageDataCopy,
            params: params
        });
    }

    // ========================================
    // ボタンイベント
    // ========================================

    // 適用ボタン
    applyBtn.addEventListener('click', processImage);

    // リセットボタン
    resetBtn.addEventListener('click', () => {
        resetParameters();
        processImage();
    });

    // ダウンロードボタン
    downloadBtn.addEventListener('click', () => {
        if (!currentImage) return;

        const link = document.createElement('a');
        link.download = 'flat_color_fixed.png';
        link.href = canvasAfter.toDataURL('image/png');
        link.click();
    });

    // 新しい画像ボタン
    newImageBtn.addEventListener('click', () => {
        // 処理中なら中断
        if (isProcessing) {
            initWorker(); // Workerを再初期化
            isProcessing = false;
        }

        currentImage = null;
        currentImageData = null;
        fileInput.value = '';

        // Canvas をクリア
        ctxBefore.clearRect(0, 0, canvasBefore.width, canvasBefore.height);
        ctxAfter.clearRect(0, 0, canvasAfter.width, canvasAfter.height);

        // UIを切り替え
        editorSection.classList.add('hidden');
        uploadSection.classList.remove('hidden');
        processingOverlay.classList.add('hidden');
        applyBtn.disabled = false;
    });
});
