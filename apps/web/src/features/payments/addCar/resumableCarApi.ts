import {
  createInsurance,
  createRoadworthiness,
  createVehicle,
  createVehicleLicense,
} from '@motopapers/api';
import type { CarApi } from '../../cars/add/saveCar';
import type { IntentStore, SavedCar } from '../lib/intent';

/**
 * The car API for a car paid for by card, saved on the payment return page. Everything it saves is
 * written to the payment intent as it goes, and anything already there is returned instead of
 * being sent again. So reloading the return page, or coming back to it later, never creates the
 * car (or a paper) twice: `saveCar()` just picks up where it stopped.
 */
export function resumableCarApi(
  reference: string,
  store: IntentStore,
  api: CarApi = { createVehicle, createVehicleLicense, createInsurance, createRoadworthiness },
): CarApi {
  const saved = (): SavedCar | undefined => {
    const intent = store.recall(reference);
    return intent?.kind === 'add-car' ? intent.saved : undefined;
  };
  const keep = (change: (saved: SavedCar) => SavedCar) =>
    store.update(reference, (intent) =>
      intent.saved ? { ...intent, saved: change(intent.saved) } : intent,
    );

  return {
    async createVehicle(body, options) {
      const existing = saved()?.vehicle;
      if (existing) return existing;
      const vehicle = await api.createVehicle(body, options);
      store.update(reference, (intent) => ({ ...intent, saved: { vehicle, papers: {} } }));
      return vehicle;
    },
    async createVehicleLicense(vehicleId, body, options) {
      const existing = saved()?.papers.vehicle_license;
      if (existing) return existing;
      const paper = await api.createVehicleLicense(vehicleId, body, options);
      keep((s) => ({ ...s, papers: { ...s.papers, vehicle_license: paper } }));
      return paper;
    },
    async createInsurance(vehicleId, body, options) {
      const existing = saved()?.papers.insurance;
      if (existing) return existing;
      const paper = await api.createInsurance(vehicleId, body, options);
      keep((s) => ({ ...s, papers: { ...s.papers, insurance: paper } }));
      return paper;
    },
    async createRoadworthiness(vehicleId, body, options) {
      const existing = saved()?.papers.roadworthiness;
      if (existing) return existing;
      const paper = await api.createRoadworthiness(vehicleId, body, options);
      keep((s) => ({ ...s, papers: { ...s.papers, roadworthiness: paper } }));
      return paper;
    },
  };
}
