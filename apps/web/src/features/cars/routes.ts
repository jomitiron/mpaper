import type { RouteRecordRaw } from 'vue-router';

// Phase 2 owns this file and everything in features/cars.
export default [
  {
    path: '/cars',
    name: 'cars',
    component: () => import('./pages/CarsPage.vue'),
    meta: { title: 'My cars' },
    children: [
      {
        // The car panel opens as a sheet over My cars, so it can be linked to.
        path: ':id(\\d+)',
        name: 'car',
        component: () => import('./pages/CarPanelPage.vue'),
        meta: { title: 'Car details' },
      },
    ],
  },
  {
    path: '/cars/new',
    name: 'add-car',
    component: () => import('./pages/AddCarPage.vue'),
    meta: { title: 'Add a car' },
  },
] satisfies RouteRecordRaw[];
