/** Plate numbers, compared with spaces and dashes removed and case ignored. */

export function normalisePlate(plate: string): string {
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function samePlate(a: string, b: string): boolean {
  const left = normalisePlate(a);
  return left !== '' && left === normalisePlate(b);
}

/** `kja731ae` → `KJA 731 AE` for the standard Nigerian format; anything else is upper-cased. */
export function formatPlate(plate: string): string {
  const match = normalisePlate(plate).match(/^([A-Z]{3})(\d{3})([A-Z]{2})$/);
  return match ? `${match[1]} ${match[2]} ${match[3]}` : plate.trim().toUpperCase();
}

/** The car already on the account with this plate, if any (client-side duplicate check). */
export function findDuplicatePlate<T extends { plate_number: string }>(
  plate: string,
  vehicles: readonly T[],
): T | undefined {
  return vehicles.find((vehicle) => samePlate(vehicle.plate_number, plate));
}
