// Porto Azul — shared constants: world geometry, palette, place names.
// Everything here is original: the city of Porto Azul in the fictional state of Marisol.

export const VIEW_W = 1280;
export const VIEW_H = 800;

export const WORLD_W = 3840;
export const WORLD_H = 2560;

// The sea and the beach occupy the west edge; the city grid starts after the boardwalk.
export const SEA_W = 300;          // open water, x < SEA_W
export const SAND_END = 470;        // sand runs SEA_W..SAND_END
export const BOARDWALK_END = 560;   // wooden boardwalk SAND_END..BOARDWALK_END

// Road centrelines. Avenues run north-south, streets run east-west; each road is 128 px wide.
export const AVENUES_X = [880, 1520, 2160, 2800, 3440];
export const STREETS_Y = [420, 1060, 1700, 2240];
export const ROAD_HALF = 64;

// Districts, west to east / north to south, with the flavour text the HUD shows.
export const DISTRICTS = [
  { name: 'Playa Serena', test: (x, y) => x < 1200 && y < 1380 },
  { name: 'Altos del Faro', test: (x, y) => x >= 2480 && y < 1380 },
  { name: 'Centro Azul', test: (x, y) => x >= 1200 && x < 2480 && y < 1560 },
  { name: 'Barrio Mercado', test: (x, y) => y >= 1380 && y < 2050 },
  { name: 'Puerto Sur', test: (x, y) => y >= 2050 },
  { name: 'Mar de Marisol', test: (x, y) => x < SEA_W },
];

export const DAY_LENGTH = 260; // real seconds per full in-game day

export const PALETTE = {
  water: '#1b6f9e', waterDeep: '#155a85', foam: '#bfefff',
  sand: '#f2d492', sandWet: '#e3c07c',
  boardwalk: '#a9713d', boardwalkDark: '#8a5a2e',
  grass: '#58b368', grassDark: '#489856',
  sidewalk: '#cfd4d9', curb: '#9aa1a8',
  asphalt: '#3c414b', asphaltLine: '#f7d154', asphaltEdge: '#e8e8e8',
  plaza: '#d9c8a9',
};

// Building sign names — original Porto Azul businesses, cycled over the generated blocks.
export const SHOP_NAMES = [
  'Club Nébula', 'Hotel Corallo', 'Café Brisa', 'Tacos El Faro', 'Banco Marisol',
  'Farmacia Sol', 'Gimnasio Ola', 'Librería Coral', 'Bar La Sirena', 'Pizzería Alba',
  'Hotel Palma Real', 'Mercado Azul', 'Joyas Perla', 'Cine Riviera', 'Taller Coco',
  'Dulces Marisol', 'Floristería Lía', 'Óptica Prisma', 'Barbería Rafa', 'Sushi Kaiyo',
  'Discoteca Bruma', 'Hotel Dunas', 'Cafetería Niebla', 'Banco del Puerto', 'Clínica Mar',
];

export const CAR_COLORS = [
  '#ff5964', '#ffb347', '#ffe95e', '#7dffb0', '#38b6ff', '#c77dff',
  '#ff8fa3', '#f1fa8c', '#e8e8e8', '#9aa1a8', '#ff7b3e', '#4ee0c3',
];
export const CAR_KINDS = [
  { kind: 'compact', w: 34, l: 62, top: 330, accel: 240 },
  { kind: 'sedan', w: 36, l: 72, top: 380, accel: 260 },
  { kind: 'taxi', w: 36, l: 72, top: 370, accel: 255 },
  { kind: 'sport', w: 36, l: 70, top: 520, accel: 360 },
  { kind: 'pickup', w: 38, l: 78, top: 340, accel: 230 },
  { kind: 'van', w: 40, l: 84, top: 300, accel: 210 },
];

export const PED_SHIRTS = ['#ff8fa3', '#ffe95e', '#7dffb0', '#38b6ff', '#ffffff', '#ffb347', '#c77dff', '#ff5964'];
export const PED_PANTS = ['#274156', '#5b3a29', '#e8e8e8', '#31572c', '#704214', '#22304a'];

export const SAVE_KEY = 'porto-azul-save-v1';
