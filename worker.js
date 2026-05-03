self.onmessage = async (e) => {
  const { file, settings } = e.data;
  console.log("🔧 Worker: Processing image");
  if (settings.stripExif) {
    console.log("🔒 EXIF data will be removed");
  }

  try {
    const bitmap = await createImageBitmap(file);
    console.log("✓ Worker: Bitmap created", bitmap.width, "x", bitmap.height);

    const baseScale = settings.resize / 100;

    // Size variation: randomly vary the output size to defeat duplicate detection
    const sizeVariationPct = (settings.sizevar / 100) * (Math.random() * 2 - 1);
    const sizeVariedScale = baseScale * (1 + sizeVariationPct);

    // Zoom jitter: random additional zoom within ±zoomJitter%
    const zoomJitter = (settings.zoom / 100) * (Math.random() * 2 - 1);
    const totalScale = sizeVariedScale + zoomJitter;

    // Crop jitter: randomly shrink draw area by up to cropJitter% on each side
    const cropPct = settings.crop / 100;
    const cropLeft   = Math.random() * cropPct;
    const cropTop    = Math.random() * cropPct;
    const cropRight  = Math.random() * cropPct;
    const cropBottom = Math.random() * cropPct;

    // Source region on original bitmap after crop
    const srcX = Math.floor(bitmap.width  * cropLeft);
    const srcY = Math.floor(bitmap.height * cropTop);
    const srcW = Math.floor(bitmap.width  * (1 - cropLeft - cropRight));
    const srcH = Math.floor(bitmap.height * (1 - cropTop - cropBottom));

    // Output canvas = cropped region scaled
    const outW = Math.max(1, Math.round(srcW * totalScale));
    const outH = Math.max(1, Math.round(srcH * totalScale));

    // Padded canvas for rotation/transform (extra space so nothing clips)
    const padW = Math.ceil(Math.sqrt(outW * outW + outH * outH));
    const padH = padW;
    const padCanvas = new OffscreenCanvas(padW, padH);
    const padCtx = padCanvas.getContext("2d");

    // NO white fill - use transparent background for accurate content detection
    // padCtx is already transparent by default

    // Rotation in radians from degree setting
    const maxRad = (settings.rotation * Math.PI) / 180;
    const rotate = (Math.random() * 2 - 1) * maxRad;

    // Position shift capped so image stays inside canvas
    const maxShiftX = outW * (settings.shift / 100);
    const maxShiftY = outH * (settings.shift / 100);
    const shiftX = (Math.random() * 2 - 1) * maxShiftX;
    const shiftY = (Math.random() * 2 - 1) * maxShiftY;

    // Brightness/contrast/saturation variation
    const bJitter = settings.brightness / 100;
    const sJitter = settings.saturation / 100;
    let filter = `brightness(${(1 + Math.random() * bJitter).toFixed(3)})
      contrast(${(1 + Math.random() * 0.15).toFixed(3)})
      saturate(${(1 + Math.random() * sJitter).toFixed(3)})`;

    if (settings.pro) {
      filter += ` hue-rotate(${Math.floor(Math.random() * 20)}deg)`;
    }

    padCtx.filter = filter;

    // Apply transform: shift + rotate around center of padded canvas
    padCtx.save();
    padCtx.translate(padW / 2 + shiftX, padH / 2 + shiftY);
    padCtx.rotate(rotate);

    // Random horizontal flip
    if (settings.flipH && Math.random() > 0.5) {
      padCtx.scale(-1, 1);
    }

    // Draw cropped source region onto padded canvas
    padCtx.drawImage(bitmap, srcX, srcY, srcW, srcH, -outW / 2, -outH / 2, outW, outH);
    padCtx.restore();

    // Find bounding box of ANY visible content (alpha > 10)
    const imgDataFull = padCtx.getImageData(0, 0, padW, padH);
    const pixels = imgDataFull.data;
    let minX = padW, maxX = -1, minY = padH, maxY = -1;

    // Scan for ANY pixel with any opacity
    for (let i = 0; i < pixels.length; i += 4) {
      const a = pixels[i+3]; // Alpha channel
      
      if (a > 10) {  // Any visible pixel
        const pixelIdx = i / 4;
        const x = pixelIdx % padW;
        const y = Math.floor(pixelIdx / padW);
        
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

    // Crop to exact content bounds - NO PADDING
    let finalX, finalY, finalW, finalH;
    
    if (maxX > minX && maxY > minY) {
      finalX = Math.floor(minX);
      finalY = Math.floor(minY);
      finalW = Math.ceil(maxX - minX) + 1;
      finalH = Math.ceil(maxY - minY) + 1;
    } else {
      // Fallback - this shouldn't happen
      finalX = 0;
      finalY = 0;
      finalW = padW;
      finalH = padH;
    }

    // Ensure valid dimensions
    if (finalW < 1) finalW = 1;
    if (finalH < 1) finalH = 1;
    if (finalX + finalW > padW) finalW = padW - finalX;
    if (finalY + finalH > padH) finalH = padH - finalY;

    // Extract exact content region
    const croppedCanvas = new OffscreenCanvas(finalW, finalH);
    const croppedCtx = croppedCanvas.getContext("2d");
    croppedCtx.drawImage(padCanvas, finalX, finalY, finalW, finalH, 0, 0, finalW, finalH);

    // Convert only semi-transparent pixels to white (from rotation edges)
    // Skip fully transparent and fully opaque pixels
    const cropData = croppedCtx.getImageData(0, 0, finalW, finalH);
    const d = cropData.data;
    for (let i = 0; i < d.length; i += 4) {
      const alpha = d[i + 3];
      // Only handle semi-transparent pixels (like rotation artifacts)
      if (alpha > 0 && alpha < 255) {
        // Blend with white
        const a = alpha / 255;
        d[i]     = Math.round(d[i] * a + 255 * (1 - a));      // R
        d[i + 1] = Math.round(d[i + 1] * a + 255 * (1 - a));  // G
        d[i + 2] = Math.round(d[i + 2] * a + 255 * (1 - a));  // B
        d[i + 3] = 255; // Full opacity
      } else if (alpha === 0) {
        // Fully transparent - fill with white
        d[i] = 255;
        d[i + 1] = 255;
        d[i + 2] = 255;
        d[i + 3] = 255;
      }
    }
    croppedCtx.putImageData(cropData, 0, 0);

    // ASPECT RATIO VARIATION: Randomly crop left/right by 0-15%
    const aspectRatioCropPct = 0.15; // 0-15% horizontal crop
    const horizCropAmount = Math.random() * aspectRatioCropPct;
    const cropFromLeft = Math.random() > 0.5; // 50/50 chance to crop left or right
    
    let finalCanvas = croppedCanvas;
    let finalCtx = croppedCtx;
    
    if (horizCropAmount > 0.02) { // Only if noticeable crop (>2%)
      const cropW = Math.floor(finalW * horizCropAmount);
      const cropH = finalH;
      const aspectCanvasW = finalW - cropW;
      const aspectCanvasH = finalH;
      
      const aspectCanvas = new OffscreenCanvas(aspectCanvasW, aspectCanvasH);
      const aspectCtx = aspectCanvas.getContext("2d");
      
      // Crop from left or right
      const srcX = cropFromLeft ? cropW : 0;
      aspectCtx.drawImage(croppedCanvas, srcX, 0, aspectCanvasW, aspectCanvasH, 0, 0, aspectCanvasW, aspectCanvasH);
      
      finalCanvas = aspectCanvas;
      finalCtx = aspectCtx;
    }

    // Converting canvas to blob automatically removes all EXIF metadata
    const blob = await finalCanvas.convertToBlob({
      type: "image/jpeg",
      quality: settings.quality / 100
    });

    console.log("✓ Worker: Image processed, blob size:", blob.size, "bytes");
    self.postMessage({ ok: true, blob });

  } catch (err) {
    console.error("✗ Worker error:", err.message, err.stack);
    self.postMessage({ ok: false, error: err.message });
  }
};