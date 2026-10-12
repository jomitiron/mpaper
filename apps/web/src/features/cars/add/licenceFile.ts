import { DOC_READER_MAX_BYTES, DocReaderError } from '@motopapers/api';

/**
 * Gets a licence file ready for the document reader, which takes images up to 4 MB.
 * A PDF's first page is drawn to a JPEG in the browser with pdf.js, loaded only when needed.
 */

export const ACCEPTED_FILES = 'image/jpeg,image/png,image/webp,application/pdf,.pdf';

export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

/** Throws a DocReaderError with a message for the driver when the file can't be used. */
export function checkLicenceFile(file: File): void {
  if (file.size > DOC_READER_MAX_BYTES) throw new DocReaderError('too_large');
  if (!isPdf(file) && !file.type.startsWith('image/')) throw new DocReaderError('not_an_image');
}

export async function prepareLicenceImage(file: File): Promise<Blob> {
  checkLicenceFile(file);
  if (!isPdf(file)) return file;
  try {
    return await pdfToImage(file);
  } catch (error) {
    if (error instanceof DocReaderError) throw error;
    throw new DocReaderError('unreadable', { cause: error });
  }
}

/** Longest side of the rendered page: sharp enough to read, small enough to send. */
const TARGET_PX = 2000;

async function pdfToImage(file: File): Promise<Blob> {
  // The legacy build supports older phone browsers; both files load only for PDFs.
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    // No `new Function`: the App Service Content-Security-Policy doesn't allow it.
    isEvalSupported: false,
  }).promise;
  try {
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    let scale = TARGET_PX / Math.max(base.width, base.height);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport }).promise;
      const blob = await canvasToJpeg(canvas);
      if (blob.size <= DOC_READER_MAX_BYTES) return blob;
      scale *= 0.7;
    }
    throw new DocReaderError('too_large');
  } finally {
    void pdf.destroy();
  }
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not draw the PDF'))),
      'image/jpeg',
      0.88,
    );
  });
}
