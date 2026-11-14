// src/lib/resizeImage.ts — shrink a worksheet photo in the browser before upload (docs/plan/03 §2).
// Typically 300–600 KB out; the server caps uploads at 1.5 MB and only accepts JPEG.
export class UnsupportedImageError extends Error {}

const HEIC_HELP =
  "iPhone photos (HEIC) don't open in Chrome. Please send a JPG or PNG (iPhone: Settings → Camera → Formats → Most Compatible), or use the webcam snapshot.";

export async function resizeImage(file: Blob, maxSide = 1600, quality = 0.85): Promise<Blob> {
  const name = "name" in file ? String((file as File).name) : "";
  if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(name)) throw new UnsupportedImageError(HEIC_HELP);
  if (file.type === "application/pdf" || /\.pdf$/i.test(name))
    throw new UnsupportedImageError("PDFs aren't supported yet. Please send a screenshot of the page.");

  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new UnsupportedImageError(file.type ? `This file (${file.type}) isn't an image we can read. ${HEIC_HELP}` : HEIC_HELP);
  }
  const s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = new OffscreenCanvas(Math.round(bmp.width * s), Math.round(bmp.height * s));
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c.convertToBlob({ type: "image/jpeg", quality });
}
