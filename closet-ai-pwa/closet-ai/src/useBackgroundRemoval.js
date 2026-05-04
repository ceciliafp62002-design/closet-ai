import { pipeline, env } from "@huggingface/transformers";

env.allowLocalModels = false;
env.useBrowserCache = true;

let segmenter = null;
let isLoading = false;
let loadProgress = 0;

export async function removeBackgroundBRIA(imageDataUrl, onProgress) {
  try {
    if (!segmenter && !isLoading) {
      isLoading = true;
      onProgress && onProgress(0, "Descargando modelo IA (176MB)…");

      segmenter = await pipeline(
        "image-segmentation",
        "briaai/RMBG-1.4",
        {
          device: "webgpu",
          progress_callback: (p) => {
            if (p.status === "downloading") {
              const pct = Math.round((p.loaded / p.total) * 100) || 0;
              loadProgress = pct;
              onProgress && onProgress(pct, `Descargando modelo IA… ${pct}%`);
            }
          },
        }
      );
      isLoading = false;
      onProgress && onProgress(100, "Modelo listo ✓");
    }

    if (isLoading) {
      await new Promise(resolve => {
        const check = setInterval(() => {
          if (!isLoading) { clearInterval(check); resolve(); }
        }, 200);
      });
    }

    onProgress && onProgress(100, "Procesando imagen…");

    const result = await segmenter(imageDataUrl);
    if (!result || !result[0]?.mask) return null;

    // Aplicar máscara sobre fondo blanco
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res; img.onerror = rej;
      img.src = imageDataUrl;
    });

    const SIZE = 600;
    const canvas = document.createElement("canvas");
    canvas.width = SIZE; canvas.height = SIZE;
    const ctx = canvas.getContext("2d");

    // Fondo blanco
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Dibujar imagen centrada
    const r = Math.min(SIZE / img.width, SIZE / img.height) * 0.88;
    const dx = (SIZE - img.width * r) / 2;
    const dy = (SIZE - img.height * r) / 2;
    ctx.drawImage(img, dx, dy, img.width * r, img.height * r);

    // Aplicar máscara — borrar fondo
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = result[0].mask.width;
    maskCanvas.height = result[0].mask.height;
    const maskCtx = maskCanvas.getContext("2d");
    const maskData = maskCtx.createImageData(
      result[0].mask.width,
      result[0].mask.height
    );
    for (let i = 0; i < result[0].mask.data.length; i++) {
      maskData.data[i * 4] = 0;
      maskData.data[i * 4 + 1] = 0;
      maskData.data[i * 4 + 2] = 0;
      maskData.data[i * 4 + 3] = result[0].mask.data[i] * 255;
    }
    maskCtx.putImageData(maskData, 0, 0);

    // Segundo canvas con transparencia
    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = SIZE; finalCanvas.height = SIZE;
    const finalCtx = finalCanvas.getContext("2d");

    finalCtx.fillStyle = "#FFFFFF";
    finalCtx.fillRect(0, 0, SIZE, SIZE);
    finalCtx.drawImage(img, dx, dy, img.width * r, img.height * r);

    finalCtx.globalCompositeOperation = "destination-in";
    finalCtx.drawImage(maskCanvas, dx, dy, img.width * r, img.height * r);

    // Volver a poner fondo blanco bajo la prenda
    const whiteCanvas = document.createElement("canvas");
    whiteCanvas.width = SIZE; whiteCanvas.height = SIZE;
    const whiteCtx = whiteCanvas.getContext("2d");
    whiteCtx.fillStyle = "#FFFFFF";
    whiteCtx.fillRect(0, 0, SIZE, SIZE);
    whiteCtx.drawImage(finalCanvas, 0, 0);

    return whiteCanvas.toDataURL("image/jpeg", 0.92);

  } catch (err) {
    console.warn("BRIA falló:", err);
    return null;
  }
}