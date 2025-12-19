/**
 * AI Flat Color Fixer - Main Application
 * UIインタラクションとワークフロー管理
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

    // 画像処理エンジン
    const processor = new ImageProcessor();

    // 現在の画像
    let currentImage = null;

    // デフォルトパラメータ
    const defaultParams = {
        colorCount: 16,
        smoothing: 3,
        posterizeLevel: 8,
        edgeProtect: 70
    };

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

                // 画像データを処理エンジンに設定
                const imageData = ctxBefore.getImageData(0, 0, width, height);
                processor.setImage(imageData);

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
    // 画像処理
    // ========================================

    /**
     * 画像処理を実行
     */
    function processImage() {
        if (!currentImage) return;

        // 処理中オーバーレイを表示
        processingOverlay.classList.remove('hidden');

        // 非同期で処理（UIブロックを避ける）
        setTimeout(() => {
            try {
                const params = getParams();
                const result = processor.process(params);

                // 結果を描画
                ctxAfter.putImageData(result, 0, 0);
            } catch (error) {
                console.error('画像処理エラー:', error);
                alert('画像処理中にエラーが発生しました。');
            } finally {
                processingOverlay.classList.add('hidden');
            }
        }, 50);
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
        currentImage = null;
        fileInput.value = '';

        // Canvas をクリア
        ctxBefore.clearRect(0, 0, canvasBefore.width, canvasBefore.height);
        ctxAfter.clearRect(0, 0, canvasAfter.width, canvasAfter.height);

        // UIを切り替え
        editorSection.classList.add('hidden');
        uploadSection.classList.remove('hidden');
    });
});
