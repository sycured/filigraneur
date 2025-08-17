"use client";

// Basic PDF validation function
async function validatePDF(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      if (!arrayBuffer) {
        resolve(false);
        return;
      }
      
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Check PDF header
      const header = uint8Array.slice(0, 5);
      const headerString = String.fromCharCode(...header);
      
      // Check if it starts with %PDF-
      if (!headerString.startsWith('%PDF-')) {
        resolve(false);
        return;
      }
      
      // Check for basic PDF structure
      const fileString = String.fromCharCode(...uint8Array.slice(0, Math.min(1024, uint8Array.length)));
      
      // Look for some basic PDF elements
      const hasBasicStructure = 
        fileString.includes('%PDF-') &&
        (fileString.includes('obj') || fileString.includes('xref') || fileString.includes('trailer'));
      
      resolve(hasBasicStructure);
    };
    
    reader.onerror = () => resolve(false);
    reader.readAsArrayBuffer(file.slice(0, 1024)); // Read first 1KB
  });
}

export async function applyWatermark(
  canvas: HTMLCanvasElement,
  file: File,
  watermarkText: string
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  try {
    if (file.type === "application/pdf") {
      // Validate PDF before processing
      const isValidPDF = await validatePDF(file);
      if (!isValidPDF) {
        alert("Le fichier PDF semble être corrompu ou invalide. Veuillez essayer avec un autre fichier.");
        return;
      }
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
  
  // Completely suppress PDF.js console output
  const originalWarn = console.warn;
  const originalError = console.error;
  console.warn = (...args: any[]) => {
    const message = args.join(' ');
    if (!message.includes('PDF') && !message.includes('pdf') && 
        !message.includes('getHexString') && !message.includes('Unknown command') &&
        !message.includes('FormatError') && !message.includes('beginImageData') &&
        !message.includes('getOperatorList') && !message.includes('ensureStateFont')) {
      originalWarn.apply(console, args);
    }
  };
  console.error = (...args: any[]) => {
    const message = args.join(' ');
    if (!message.includes('PDF') && !message.includes('pdf') && 
        !message.includes('Should not call beginImageData') &&
        !message.includes('unreachable') && !message.includes('FormatError')) {
      originalError.apply(console, args);
    }
  };
  
  // Configure PDF.js to handle errors more gracefully
  pdfjs.GlobalWorkerOptions.verbosity = 0; // Reduce verbosity
  
  const fileUrl = URL.createObjectURL(file);

  let pdf;
  let shouldUseFallback = false;
  
  try {
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
      ignoreErrors: true,
      fontExtraProperties: true,
      useSystemFonts: false,
      isEvalSupported: false,
      maxImageSize: 16777216, // 16MB max image size
      password: "",
      docBaseUrl: null,
      cMapPacked: true,
      withCredentials: false,
    });
    
    // Set a timeout for PDF loading
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("PDF loading timeout")), 5000); // Reduced timeout
    });
    
    pdf = await Promise.race([loadingTask.promise, timeoutPromise]);
    
    // Test if we can get basic info without errors
    if (pdf.numPages <= 0) {
      shouldUseFallback = true;
    }
  } catch (loadError) {
    console.log("PDF loading failed, using fallback method");
    shouldUseFallback = true;
  }
  
  // Restore console functions
  console.warn = originalWarn;
  console.error = originalError;
  
  if (shouldUseFallback) {
    URL.revokeObjectURL(fileUrl);
    return createFallbackPDF(canvas, ctx, file, watermarkText);
  }
  const numPages = pdf.numPages;

  // Create a temporary canvas to hold all pages
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");

  let totalHeight = 0;
  const pageCanvases = [];

  // Suppress console output during page rendering
  const originalWarn = console.warn;
  const originalError = console.error;
  console.warn = () => {}; // Completely suppress warnings during rendering
  console.error = (...args: any[]) => {
    const message = args.join(' ');
    if (!message.includes('beginImageData') && !message.includes('unreachable') && 
        !message.includes('PDF') && !message.includes('FormatError')) {
      originalError.apply(console, args);
    }
  };

  // Render each page with enhanced error handling
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    try {
      // Add timeout for page loading
      const pageLoadPromise = pdf.getPage(pageNum);
      const pageTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Page ${pageNum} timeout`)), 2000); // Reduced timeout
      });
      
      const page = await Promise.race([pageLoadPromise, pageTimeoutPromise]);
      const viewport = page.getViewport({ scale });

      const pageCanvas = document.createElement("canvas");
      const pageCtx = pageCanvas.getContext("2d");
      if (!pageCtx) {
        console.warn(`Impossible de créer le contexte pour la page ${pageNum}`);
        continue;
      }
      
      // Use standard A4 dimensions as fallback if viewport is invalid
      const width = viewport.width > 0 ? viewport.width : 595;
      const height = viewport.height > 0 ? viewport.height : 842;
      
      pageCanvas.width = width;
      pageCanvas.height = height;

      // Fill with white background first
      pageCtx.fillStyle = 'white';
      pageCtx.fillRect(0, 0, width, height);

      // Attempt to render page with multiple fallback strategies
      let renderSucceeded = false;
      
      // Strategy 1: Try normal rendering with immediate timeout
      try {
        const renderTask = page.render({ 
          canvasContext: pageCtx, 
          viewport,
          background: 'white',
          intent: 'display',
          enableWebGL: false,
          renderInteractiveForms: false,
          optionalContentConfigPromise: null,
        });
        
        const renderTimeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Render timeout for page ${pageNum}`)), 1000); // Very short timeout
        });
        
        await Promise.race([renderTask.promise, renderTimeoutPromise]);
        renderSucceeded = true;
      } catch (renderError) {
        // Silent fail, try next strategy
      }
      
      // Strategy 2: Try with minimal options if first strategy failed
      if (!renderSucceeded) {
        try {
          pageCtx.fillStyle = 'white';
          pageCtx.fillRect(0, 0, width, height);
          
          const simpleRenderTask = page.render({ 
            canvasContext: pageCtx, 
            viewport: page.getViewport({ scale: 0.5 }), // Smaller scale
          });
          
          const simpleTimeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Simple render timeout for page ${pageNum}`)), 500); // Very short timeout
          });
          
          await Promise.race([simpleRenderTask.promise, simpleTimeoutPromise]);
          renderSucceeded = true;
        } catch (simpleRenderError) {
          // Silent fail, go to fallback
        }
      }
      
      // Strategy 3: Create placeholder if all rendering failed
      if (!renderSucceeded) {
        pageCtx.fillStyle = '#f5f5f5';
        pageCtx.fillRect(0, 0, width, height);
        pageCtx.fillStyle = '#666';
        pageCtx.font = '24px sans-serif';
        pageCtx.textAlign = 'center';
        pageCtx.fillText(`Page ${pageNum}`, width / 2, height / 2);
        pageCtx.fillText('(Contenu non lisible)', width / 2, height / 2 + 30);
      }

      // Add watermark to the page
      addWatermark(
        pageCtx,
        width,
        height,
        0,
        watermarkText
      );

      pageCanvases.push(pageCanvas);
      totalHeight += height;
    } catch (pageError) {
      // Create a fallback page silently
      const fallbackCanvas = document.createElement("canvas");
      const fallbackCtx = fallbackCanvas.getContext("2d");
      if (fallbackCtx) {
        fallbackCanvas.width = 595; // A4 width
        fallbackCanvas.height = 842; // A4 height
        
        fallbackCtx.fillStyle = '#f5f5f5';
        fallbackCtx.fillRect(0, 0, 595, 842);
        fallbackCtx.fillStyle = '#666';
        fallbackCtx.font = '24px sans-serif';
        fallbackCtx.textAlign = 'center';
        fallbackCtx.fillText(`Page ${pageNum}`, 297, 421);
        fallbackCtx.fillText('(Erreur de lecture)', 297, 451);
        
        addWatermark(fallbackCtx, 595, 842, 0, watermarkText);
        
        pageCanvases.push(fallbackCanvas);
        totalHeight += 842;
      }
    }
  }

  // Restore console functions
  console.warn = originalWarn;
  console.error = originalError;

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

// Fallback function for completely corrupted PDFs
function createFallbackPDF(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  file: File,
  watermarkText: string
) {
  // Create a single page representing the corrupted PDF
  const width = 595; // A4 width at 72 DPI
  const height = 842; // A4 height at 72 DPI
  
  canvas.width = width;
  canvas.height = height;
  
  // White background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, height);
  
  // Draw file info
  ctx.fillStyle = '#333';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  
  const fileName = file.name;
  const fileSize = (file.size / 1024 / 1024).toFixed(2);
  
  ctx.fillText('Document PDF', width / 2, 100);
  ctx.fillText(`Fichier: ${fileName}`, width / 2, 130);
  ctx.fillText(`Taille: ${fileSize} MB`, width / 2, 160);
  
  ctx.fillStyle = '#666';
  ctx.font = '14px sans-serif';
  ctx.fillText('Le contenu du PDF ne peut pas être affiché', width / 2, 200);
  ctx.fillText('en raison de problèmes de format ou de corruption.', width / 2, 220);
  
  ctx.fillStyle = '#999';
  ctx.font = '12px sans-serif';
  ctx.fillText('Ce document a été traité pour ajouter un filigrane.', width / 2, 260);
  
  // Add watermark
  addWatermark(ctx, width, height, 0, watermarkText);
}

export { applyWatermarkToPDF, applyWatermarkToImage, addWatermark };
