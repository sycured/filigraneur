"use client";

export async function applyWatermark(
  canvas: HTMLCanvasElement,
  file: File,
  watermarkText: string
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  try {
    if (file.type === "application/pdf") {
      await applyWatermarkToPDF(canvas, ctx, file, watermarkText);
    } else if (file.type.startsWith("image/")) {
      await applyWatermarkToImage(canvas, ctx, file, watermarkText);
    } else {
      alert("Type de fichier non pris en charge");
    }
  } catch (error) {
    console.error("Erreur lors de l'application du filigrane:", error);
    alert("Erreur lors du traitement du fichier. Veuillez réessayer avec un autre fichier.");
  }
}

async function applyWatermarkToPDF(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  file: File,
  watermarkText: string
) {
  const scale = 1.5;
  /* eslint-disable  @typescript-eslint/no-explicit-any */
  const pdfjs = (window as any)
    .pdfjsLib as typeof import("pdfjs-dist/types/src/pdf");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.mjs";
  
  // Configure PDF.js to handle errors more gracefully
  pdfjs.GlobalWorkerOptions.verbosity = 0; // Reduce verbosity
  
  const fileUrl = URL.createObjectURL(file);

  const loadingTask = pdfjs.getDocument({
    url: fileUrl,
    standardFontDataUrl: "/pdfjs/",
    cMapUrl: "/pdfjs/",
    cMapPacked: true,
    enableXfa: false,
    disableAutoFetch: true,
    disableStream: true,
    disableRange: true,
    stopAtErrors: false,
  });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  // Create a temporary canvas to hold all pages
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");

  let totalHeight = 0;
  const pageCanvases = [];

  // Render each page
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const pageCanvas = document.createElement("canvas");
      const pageCtx = pageCanvas.getContext("2d");
      if (!pageCtx) {
        console.warn(`Impossible de créer le contexte pour la page ${pageNum}`);
        continue;
      }
      pageCanvas.width = viewport.width;
      pageCanvas.height = viewport.height;

      // Render with error handling
      try {
        await page.render({ 
          canvasContext: pageCtx, 
          viewport,
          background: 'white',
          intent: 'display'
        }).promise;
      } catch (renderError) {
        console.warn(`Erreur lors du rendu de la page ${pageNum}:`, renderError);
        // Fill with white background if rendering fails
        pageCtx.fillStyle = 'white';
        pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      }

      // Add watermark to the page
      addWatermark(
        pageCtx,
        pageCanvas.width,
        pageCanvas.height,
        0,
        watermarkText
      );

      pageCanvases.push(pageCanvas);
      totalHeight += pageCanvas.height;
    } catch (pageError) {
      console.warn(`Erreur lors du traitement de la page ${pageNum}:`, pageError);
      // Continue with next page
    }
  }

  // Set the dimensions of the temporary canvas
  if (pageCanvases.length === 0) {
    throw new Error("Aucune page n'a pu être rendue");
  }
  tempCanvas.width = pageCanvases[0].width;
  tempCanvas.height = totalHeight;

  // Draw all pages on the temporary canvas
  if (!tempCtx) {
    throw new Error("Impossible de créer le contexte du canvas temporaire");
  }
  let yOffset = 0;
  for (const pageCanvas of pageCanvases) {
    tempCtx.drawImage(pageCanvas, 0, yOffset);
    yOffset += pageCanvas.height;
  }

  // Set the dimensions of the main canvas
  canvas.width = tempCanvas.width;
  canvas.height = tempCanvas.height;

  // Draw the temporary canvas on the main canvas
  ctx.drawImage(tempCanvas, 0, 0);

  URL.revokeObjectURL(fileUrl);
}

async function applyWatermarkToImage(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  file: File,
  watermarkText: string
) {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      addWatermark(ctx, canvas.width, canvas.height, 0, watermarkText);
      resolve();
    };
    img.src = URL.createObjectURL(file);
  });
}

function addWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  yOffset: number,
  watermarkText: string
) {
  if (watermarkText === "") return;
  ctx.save();

  ctx.font = "28px 'JetBrains Mono', monospace";
  ctx.fillStyle = "rgba(200, 0, 0, 0.7)";

  ctx.translate(width / 2, height / 2 + yOffset);
  ctx.rotate(-Math.PI / 4);
  ctx.translate(-width / 2, -height / 2 - yOffset);

  const textWidth = ctx.measureText(watermarkText).width;
  const spacingX = textWidth * 1.25;
  const spacingY = 100;

  for (let x = -width; x < width * 2; x += spacingX) {
    for (let y = -height + yOffset; y < height * 2 + yOffset; y += spacingY) {
      ctx.fillText(watermarkText, x, y);
    }
  }

  ctx.restore();
}

export { applyWatermarkToPDF, applyWatermarkToImage, addWatermark };
