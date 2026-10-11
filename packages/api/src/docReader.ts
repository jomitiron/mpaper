import { z } from 'zod';
import { getApiConfig, isAbortError, isRecord } from './client';
import { formatPlate } from './plates';

/**
 * The document reader reads a vehicle licence photo. It's a separate service, not in the API docs,
 * and takes no token:
 *
 *   POST https://motorpapers-doc-parser-api.azurewebsites.net/api/vehicleDocument
 *   { "DOCUMENT_TYPE": "VEHICLE_LICENSE", "DOCUMENT": "<base64>" }
 *   → { "Registration Number": { "content": "KTU 604 XR" }, "Vehicle Make": { … }, … }
 *
 * Send images only (convert a PDF to an image in the browser first), 4 MB at most.
 */

export const DOC_READER_MAX_BYTES = 4 * 1024 * 1024;

export type LicenceField =
  | 'plate_number'
  | 'brand'
  | 'model'
  | 'color'
  | 'engine_number'
  | 'chassis_number'
  | 'engine_capacity'
  | 'expiry_date'
  | 'license_pin';

/** Licence label → API field. */
export const DOC_READER_LABELS: Readonly<Record<string, LicenceField>> = {
  'Registration Number': 'plate_number',
  'Vehicle Make': 'brand',
  'Vehicle Model': 'model',
  'Vehicle Color': 'color',
  'Engine Number': 'engine_number',
  'Chassis Number': 'chassis_number',
  'Engine Capacity': 'engine_capacity',
  'Expiry Date': 'expiry_date',
  PIN: 'license_pin',
};

export interface LicenceReading {
  /** Fields for `POST /vehicles`. */
  vehicle: Partial<
    Record<
      | 'plate_number'
      | 'brand'
      | 'model'
      | 'color'
      | 'engine_number'
      | 'chassis_number'
      | 'engine_capacity',
      string
    >
  >;
  /** Fields for `POST /vehicle/:id/vehicle-licenses`. `expiry_date` is `YYYY-MM-DD`. */
  licence: { expiry_date?: string; license_pin?: string };
  /** Every field filled from the licence: show the "Read from licence" tag on these. */
  read: LicenceField[];
  /** Text we read but couldn't convert, e.g. an expiry date in an unknown format. */
  unparsed: Partial<Record<LicenceField, string>>;
  /** The reader's full response, including labels we don't map (such as "Date Issued"). */
  raw: Record<string, unknown>;
}

export type DocReaderErrorReason = 'too_large' | 'not_an_image' | 'unreadable' | 'network' | 'http';

const REASON_MESSAGES: Record<DocReaderErrorReason, string> = {
  too_large: 'That file is over 4 MB. Choose a smaller photo or PDF.',
  not_an_image: 'Choose a JPG or PNG photo, or a PDF, of your vehicle licence.',
  unreadable: "We couldn't read this licence. Try a clearer photo, or enter the details by hand.",
  network: "We can't reach the licence reader right now. Try again, or enter the details by hand.",
  http: "The licence reader didn't respond. Try again, or enter the details by hand.",
};

export class DocReaderError extends Error {
  readonly reason: DocReaderErrorReason;

  constructor(reason: DocReaderErrorReason, options?: { cause?: unknown }) {
    super(REASON_MESSAGES[reason], options);
    this.name = 'DocReaderError';
    this.reason = reason;
  }
}

/** Checks a file before reading it. Throws a `DocReaderError` with a plain-language message. */
export function assertReadableImage(file: Blob): void {
  if (file.size > DOC_READER_MAX_BYTES) throw new DocReaderError('too_large');
  if (file.type && !file.type.startsWith('image/')) throw new DocReaderError('not_an_image');
}

/** Base64 of a file, without the `data:…;base64,` prefix. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

const readerResponseSchema = z.record(z.string(), z.unknown());

/**
 * Sends a licence image to the reader and maps its labels to API fields.
 * Pass a Blob (checked for size and type) or base64 you've already prepared.
 */
export async function readVehicleLicence(
  image: Blob | { base64: string },
  options: { signal?: AbortSignal } = {},
): Promise<LicenceReading> {
  let base64: string;
  if ('base64' in image) {
    base64 = image.base64;
  } else {
    assertReadableImage(image);
    base64 = await blobToBase64(image);
  }

  const { docReaderUrl, fetch } = getApiConfig();
  let response: Response;
  try {
    response = await fetch(docReaderUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ DOCUMENT_TYPE: 'VEHICLE_LICENSE', DOCUMENT: base64 }),
      signal: options.signal,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new DocReaderError('network', { cause: error });
  }
  if (!response.ok) throw new DocReaderError('http', { cause: response.status });

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    throw new DocReaderError('unreadable', { cause: error });
  }
  const parsed = readerResponseSchema.safeParse(body);
  if (!parsed.success) throw new DocReaderError('unreadable', { cause: parsed.error });

  const reading = mapLicenceReading(parsed.data);
  if (reading.read.length === 0) throw new DocReaderError('unreadable');
  return reading;
}

/** Maps the reader's labels to API fields. Empty values are skipped. */
export function mapLicenceReading(raw: Record<string, unknown>): LicenceReading {
  const reading: LicenceReading = { vehicle: {}, licence: {}, read: [], unparsed: {}, raw };

  for (const [label, value] of Object.entries(raw)) {
    const field = DOC_READER_LABELS[label.trim()];
    const content = contentOf(value);
    if (!field || !content) continue;

    switch (field) {
      case 'expiry_date': {
        const date = parseLicenceDate(content);
        if (date) {
          reading.licence.expiry_date = date;
          reading.read.push(field);
        } else {
          reading.unparsed.expiry_date = content;
        }
        break;
      }
      case 'license_pin':
        reading.licence.license_pin = content;
        reading.read.push(field);
        break;
      case 'plate_number':
        reading.vehicle.plate_number = formatPlate(content);
        reading.read.push(field);
        break;
      default:
        reading.vehicle[field] = content;
        reading.read.push(field);
    }
  }
  return reading;
}

function contentOf(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (isRecord(value) && (typeof value.content === 'string' || typeof value.content === 'number')) {
    return String(value.content).trim();
  }
  return '';
}

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

/**
 * Turns a date printed on a licence into `YYYY-MM-DD`. Nigerian licences print day first, so
 * `02/03/2027` is 2 March 2027. Returns undefined when the text isn't a date we recognise.
 */
export function parseLicenceDate(text: string): string | undefined {
  const value = text.trim().replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
  let y: number | undefined;
  let m: number | undefined;
  let d: number | undefined;

  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(value);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(value))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = /^(\d{1,2})[\s-]+([a-z]{3,})\.?,?[\s-]+(\d{2}|\d{4})$/i.exec(value))) {
    [d, m, y] = [Number(match[1]), MONTHS[match[2]!.slice(0, 3).toLowerCase()], Number(match[3])];
  } else if ((match = /^([a-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})$/i.exec(value))) {
    [m, d, y] = [MONTHS[match[1]!.slice(0, 3).toLowerCase()], Number(match[2]), Number(match[3])];
  }

  if (!y || !m || !d) return undefined;
  if (y < 100) y += 2000;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return undefined;
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
