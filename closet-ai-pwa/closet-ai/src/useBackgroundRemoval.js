import { AutoModel, AutoProcessor, env, RawImage } from "@huggingface/transformers";

env.allowLocalModels = false;
env.useBrowserCache = true;

let model = null;
let processor = null;
let isLoading = false;

export async function removeBackgroundBRIA(imageDataUrl, onProgress) {
  try {
    if (!model && !isLoading) {
      isLoading = true;
      onProgress && onProgress(0, "Descargando modelo IA (176MB)…");

      model = await AutoModel.from_pretrained("briaai/RMBG-1.4", {
        config: { model_type: "custom" },
        progress_callback: (p) => {
          if (p.status === "downloading") {
            const pct = Math.round((p.loaded / p.total) * 100) || 0;
            onProgress && onProgress(pct, `Descargando modelo IA… ${pct}%`);
          }
        },
      });

      processor = await AutoProcessor.from_pretrained("briaai/RMBG-1.4", {
        config: {
          do_normalize: true,
          do_pad: false,
          do_rescale: true,
          do_resize: true,
          image_mean: [0.5, 0.5, 0.5],
          image_std: [1, 1, 1],
          resample: 2,
          rescale_factor: 0.00392156862745098,
          size: { width: 1024, height: 1024 },
        },
      });

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

    const image = await RawImage.fromURL(imageDataUrl);
    const { pixel_values } = await processor(image);
    const { output } = await model({ input: pixel_values });

    const maskData = await RawImage.fromTensor(output[0].mul(255).to("uint8")).resize(image.width, image.height);

    const SIZE = 600;
    const canvas = document.createElement("canvas");
    canvas.width = SIZE; canvas.height = SIZE;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, SIZE, SIZE);

    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = imageDataUrl; });

    const r = Math.min(SIZE / img.width, SIZE / img.height) * 0.88;
    const dx = (SIZE - img.width * r) / 2;
    const dy = (SIZE - img.height * r) / 2;
    const dw = img.width * r;
    const dh = img.height * r;

    const offscreen = document.createElement("canvas");
    offscreen.width = img.width; offscreen.height = img.height;
    const offCtx = offscreen.getContext("2d");
    offCtx.drawImage(img, 0, 0);

    const imgData = offCtx.getImageData(0, 0, img.width, img.height);
    for (let i = 0; i < maskData.data.length; i++) {
      imgData.data[i * 4 + 3] = maskData.data[i];
    }
    offCtx.putImageData(imgData, 0, 0);

    ctx.drawImage(offscreen, dx, dy, dw, dh);

    return canvas.toDataURL("image/png");

  } catch (err) {
    console.warn("BRIA falló:", err);
    return null;
  }
}