/**
 * Test EKG Image Generator
 * Creates synthetic EKG images for testing the real analysis engine
 */

export function createTestEKGImage(rhythm: 'normal' | 'afib' | 'vtach' = 'normal'): HTMLCanvasElement {
  if (typeof document === 'undefined') {
    // Server-side fallback
    return {} as HTMLCanvasElement;
  }
  
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  
  const ctx = canvas.getContext('2d')!;
  
  // Fill with white background (typical EKG paper)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw grid lines (EKG paper pattern)
  drawGrid(ctx, canvas.width, canvas.height);
  
  // Draw EKG waveform based on rhythm type
  switch (rhythm) {
    case 'normal':
      drawNormalSinusRhythm(ctx, canvas.width, canvas.height);
      break;
    case 'afib':
      drawAtrialFibrillation(ctx, canvas.width, canvas.height);
      break;
    case 'vtach':
      drawVentricularTachycardia(ctx, canvas.width, canvas.height);
      break;
  }
  
  return canvas;
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.strokeStyle = '#ffcccc';
  ctx.lineWidth = 0.5;
  
  // Small grid lines (1mm)
  const smallGrid = 10;
  for (let x = 0; x <= width; x += smallGrid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  
  for (let y = 0; y <= height; y += smallGrid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  
  // Large grid lines (5mm)
  ctx.strokeStyle = '#ff9999';
  ctx.lineWidth = 1;
  const largeGrid = 50;
  for (let x = 0; x <= width; x += largeGrid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  
  for (let y = 0; y <= height; y += largeGrid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawNormalSinusRhythm(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const centerY = height / 2;
  const heartRate = 72; // BPM
  const rrInterval = (60 / heartRate) * 100; // pixels per beat (approximate)
  
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  
  let x = 50;
  while (x < width - 100) {
    // Draw one cardiac cycle
    x = drawNormalBeat(ctx, x, centerY);
    x += rrInterval;
  }
  
  ctx.stroke();
}

function drawNormalBeat(ctx: CanvasRenderingContext2D, startX: number, centerY: number): number {
  let x = startX;
  
  // P wave
  x = drawPWave(ctx, x, centerY);
  x += 20; // PR segment
  
  // QRS complex
  x = drawQRSComplex(ctx, x, centerY);
  x += 15; // ST segment
  
  // T wave
  x = drawTWave(ctx, x, centerY);
  
  return x;
}

function drawPWave(ctx: CanvasRenderingContext2D, startX: number, centerY: number): number {
  const amplitude = 10;
  const width = 25;
  
  for (let i = 0; i < width; i++) {
    const progress = i / width;
    const y = centerY - amplitude * Math.sin(progress * Math.PI);
    
    if (i === 0) {
      ctx.moveTo(startX + i, y);
    } else {
      ctx.lineTo(startX + i, y);
    }
  }
  
  return startX + width;
}

function drawQRSComplex(ctx: CanvasRenderingContext2D, startX: number, centerY: number): number {
  const qDepth = 15;
  const rHeight = 80;
  const sDepth = 25;
  
  // Q wave
  ctx.lineTo(startX + 8, centerY + qDepth);
  
  // R wave
  ctx.lineTo(startX + 20, centerY - rHeight);
  
  // S wave
  ctx.lineTo(startX + 32, centerY + sDepth);
  
  // Return to baseline
  ctx.lineTo(startX + 40, centerY);
  
  return startX + 40;
}

function drawTWave(ctx: CanvasRenderingContext2D, startX: number, centerY: number): number {
  const amplitude = 25;
  const width = 40;
  
  for (let i = 0; i < width; i++) {
    const progress = i / width;
    const y = centerY - amplitude * Math.sin(progress * Math.PI) * 0.6;
    ctx.lineTo(startX + i, y);
  }
  
  return startX + width;
}

function drawAtrialFibrillation(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const centerY = height / 2;
  
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  
  let x = 50;
  ctx.moveTo(x, centerY);
  
  while (x < width - 100) {
    // Irregular R-R intervals
    const rrInterval = 80 + Math.random() * 60; // Variable intervals
    
    // Chaotic baseline (no P waves)
    for (let i = 0; i < rrInterval - 40; i += 2) {
      const noise = (Math.random() - 0.5) * 8;
      ctx.lineTo(x + i, centerY + noise);
    }
    
    // QRS complex (similar to normal but irregular timing)
    x = drawQRSComplex(ctx, x + rrInterval - 40, centerY);
    
    // Irregular T wave
    const tWidth = 20 + Math.random() * 20;
    for (let i = 0; i < tWidth; i += 2) {
      const tAmplitude = 15 + Math.random() * 10;
      const progress = i / tWidth;
      const y = centerY - tAmplitude * Math.sin(progress * Math.PI) * 0.5;
      ctx.lineTo(x + i, y);
    }
    
    x += tWidth + 20;
  }
  
  ctx.stroke();
}

function drawVentricularTachycardia(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const centerY = height / 2;
  const heartRate = 180; // Fast rate
  const rrInterval = (60 / heartRate) * 100; // Much shorter intervals
  
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  
  let x = 50;
  ctx.moveTo(x, centerY);
  
  while (x < width - 100) {
    // Wide QRS complexes (no P waves)
    x = drawWideQRS(ctx, x, centerY);
    x += rrInterval;
  }
  
  ctx.stroke();
}

function drawWideQRS(ctx: CanvasRenderingContext2D, startX: number, centerY: number): number {
  const amplitude = 60;
  const width = 60; // Much wider than normal QRS
  
  // Wide, bizarre QRS morphology
  ctx.lineTo(startX + 5, centerY - 10);
  ctx.lineTo(startX + 15, centerY - amplitude);
  ctx.lineTo(startX + 25, centerY + 20);
  ctx.lineTo(startX + 35, centerY - amplitude * 0.7);
  ctx.lineTo(startX + 45, centerY + 30);
  ctx.lineTo(startX + width, centerY);
  
  return startX + width;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        // Fallback for older browsers
        const imageData = canvas.toDataURL('image/png');
        const byteString = atob(imageData.split(',')[1]);
        const mimeString = imageData.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        
        resolve(new Blob([ab], { type: mimeString }));
      }
    }, 'image/png');
  });
}

export async function createTestEKGFile(rhythm: 'normal' | 'afib' | 'vtach' = 'normal'): Promise<File> {
  if (typeof document === 'undefined') {
    // Server-side fallback - create a mock file
    const mockData = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG header
    const blob = new Blob([mockData], { type: 'image/png' });
    return new File([blob], `mock_ekg_${rhythm}_${Date.now()}.png`, { type: 'image/png' });
  }
  
  const canvas = createTestEKGImage(rhythm);
  const blob = await canvasToBlob(canvas);
  const filename = `test_ekg_${rhythm}_${Date.now()}.png`;
  
  return new File([blob], filename, { type: 'image/png' });
}