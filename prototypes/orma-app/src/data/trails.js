// Mock trail data shaped like the real ORMA catalogue.
export const DOG = { name: 'Eddie', breed: 'Podenco Andaluz' };

export const TRAILS = [
  {
    id: 'alpe-siusi',
    name: 'Alpe di Siusi Meadow Loop',
    match: 92,
    distanceKm: 7.7,
    climbM: 249,
    time: '3 h 00',
    shadePct: 65,
    waterPoints: 3,
    surface: { label: 'Low-risk forest soil', risky: false },
    source: 'verified',
  },
  {
    id: 'lago-braies',
    name: 'Lago di Braies Shore Circuit',
    match: 74,
    distanceKm: 3.9,
    climbM: 85,
    time: '1 h 20',
    shadePct: 40,
    waterPoints: 2,
    surface: { label: 'Mixed gravel & boardwalk', risky: false },
    source: 'imported',
  },
  {
    id: 'sassolungo',
    name: 'Sassolungo Scree Traverse',
    match: 48,
    distanceKm: 10.2,
    climbM: 780,
    time: '5 h 30',
    shadePct: 15,
    waterPoints: 1,
    surface: { label: 'High-risk exposed scree', risky: true },
    source: 'imported',
  },
];
