import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureApi, DEFAULT_DOC_READER_URL } from '../src/client';
import {
  DOC_READER_MAX_BYTES,
  DocReaderError,
  blobToBase64,
  mapLicenceReading,
  parseLicenceDate,
  readVehicleLicence,
} from '../src/docReader';
import { SAMPLE_LICENCE_READING } from '../src/mocks/fixtures';

afterEach(() =>
  configureApi({ docReaderUrl: DEFAULT_DOC_READER_URL, fetch: (i, n) => globalThis.fetch(i, n) }),
);

describe('mapLicenceReading', () => {
  it('maps every licence label to its API field', () => {
    const reading = mapLicenceReading(SAMPLE_LICENCE_READING);
    expect(reading.vehicle).toEqual({
      plate_number: 'KTU 604 XR',
      brand: 'Toyota',
      model: 'Corolla',
      color: 'Grey',
      engine_number: '2ZR-6618023',
      chassis_number: '2T1BURHE0KC184362',
      engine_capacity: '1,798 cc',
    });
    expect(reading.licence).toEqual({ expiry_date: '2027-03-02', license_pin: 'K7Q2M9XR4D' });
    expect(reading.read).toHaveLength(9);
  });

  it('skips empty values and unknown labels, and keeps dates it cannot read', () => {
    const reading = mapLicenceReading({
      'Registration Number': { content: 'ktu604xr' },
      'Vehicle Make': { content: '  ' },
      'Expiry Date': { content: 'next March' },
      'Date Issued': { content: '03/03/2026' },
      Something: 'else',
    });
    expect(reading.vehicle).toEqual({ plate_number: 'KTU 604 XR' });
    expect(reading.read).toEqual(['plate_number']);
    expect(reading.unparsed).toEqual({ expiry_date: 'next March' });
  });
});

describe('parseLicenceDate', () => {
  it.each([
    ['2027-03-02', '2027-03-02'],
    ['02/03/2027', '2027-03-02'],
    ['2-3-2027', '2027-03-02'],
    ['02.03.27', '2027-03-02'],
    ['2 Mar 2027', '2027-03-02'],
    ['02-MAR-2027', '2027-03-02'],
    ['2nd March, 2027', '2027-03-02'],
    ['March 2, 2027', '2027-03-02'],
  ])('reads %s', (input, expected) => {
    expect(parseLicenceDate(input)).toBe(expected);
  });

  it('rejects impossible dates and other text', () => {
    expect(parseLicenceDate('31/02/2027')).toBeUndefined();
    expect(parseLicenceDate('soon')).toBeUndefined();
  });
});

describe('readVehicleLicence', () => {
  const image = (size = 10, type = 'image/jpeg') => new Blob([new Uint8Array(size)], { type });

  it('posts base64 to the reader without a token and maps the answer', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json(SAMPLE_LICENCE_READING));
    configureApi({
      docReaderUrl: 'https://reader.test/api/vehicleDocument',
      fetch: fetchMock,
      getToken: () => 'tok',
    });
    const reading = await readVehicleLicence(new Blob(['hello'], { type: 'image/png' }));
    expect(reading.vehicle.plate_number).toBe('KTU 604 XR');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://reader.test/api/vehicleDocument');
    expect(JSON.parse(String(init?.body))).toEqual({
      DOCUMENT_TYPE: 'VEHICLE_LICENSE',
      DOCUMENT: 'aGVsbG8=',
    });
    expect(init?.headers).not.toHaveProperty('Authorization');
  });

  it('refuses files over 4 MB before sending', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    configureApi({ fetch: fetchMock });
    await expect(readVehicleLicence(image(DOC_READER_MAX_BYTES + 1))).rejects.toMatchObject({
      reason: 'too_large',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses files that are not images (convert PDFs first)', async () => {
    await expect(readVehicleLicence(image(10, 'application/pdf'))).rejects.toBeInstanceOf(
      DocReaderError,
    );
  });

  it('says it could not read a licence when nothing maps', async () => {
    configureApi({ fetch: vi.fn<typeof fetch>(async () => Response.json({})) });
    await expect(readVehicleLicence(image())).rejects.toMatchObject({ reason: 'unreadable' });
  });

  it('reports reader and network failures', async () => {
    configureApi({ fetch: vi.fn<typeof fetch>(async () => new Response('', { status: 500 })) });
    await expect(readVehicleLicence(image())).rejects.toMatchObject({ reason: 'http' });
    configureApi({
      fetch: vi.fn<typeof fetch>(async () => Promise.reject(new TypeError('offline'))),
    });
    await expect(readVehicleLicence(image())).rejects.toMatchObject({ reason: 'network' });
  });

  it('encodes large files in chunks', async () => {
    const bytes = new Uint8Array(100_000).map((_, i) => i % 256);
    const base64 = await blobToBase64(new Blob([bytes]));
    expect(Buffer.from(base64, 'base64').equals(Buffer.from(bytes))).toBe(true);
  });
});
