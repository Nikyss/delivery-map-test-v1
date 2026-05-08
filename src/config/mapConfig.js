const DEFAULT_MAPTILER_KEY = 'JQTuzz1KSBoO6671nQor';

const DEFAULT_MAPTILER_DESKTOP_3D_STYLE_URL = `https://api.maptiler.com/maps/019e06bc-77fc-7e5a-abff-5266a7bb1749/style.json?key=${DEFAULT_MAPTILER_KEY}`;
const DEFAULT_MAPTILER_MOBILE_2D_STYLE_URL = `https://api.maptiler.com/maps/019e08ec-83f4-7c7f-9473-f8e2374a6768/style.json?key=${DEFAULT_MAPTILER_KEY}`;

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY || DEFAULT_MAPTILER_KEY;
const MAPTILER_DESKTOP_3D_STYLE_URL =
  import.meta.env.VITE_MAPTILER_DESKTOP_3D_STYLE_URL ||
  import.meta.env.VITE_MAPTILER_STYLE_URL ||
  DEFAULT_MAPTILER_DESKTOP_3D_STYLE_URL;
const MAPTILER_MOBILE_2D_STYLE_URL =
  import.meta.env.VITE_MAPTILER_MOBILE_2D_STYLE_URL || DEFAULT_MAPTILER_MOBILE_2D_STYLE_URL;
const MAP_PROVIDER = import.meta.env.VITE_MAP_PROVIDER || 'maptiler-auto';
const MAP_RENDER_MODE = import.meta.env.VITE_MAP_RENDER_MODE || 'auto'; // auto | 2d | 3d

export const OSRM_BASE_URL = import.meta.env.VITE_OSRM_BASE_URL || 'https://router.project-osrm.org';
export const MAP_STYLE_NAME = 'MapTiler Custom Auto';

// MapLibre usa [longitude, latitude]
export const JOAO_PESSOA_CENTER = [-34.84, -7.148];
export const BRASIL_CENTER = [-52.5, -14.2];

// Sudoeste e nordeste do Brasil, com pequena folga.
export const BRASIL_BOUNDS = [
  [-74.2, -34.2],
  [-32.0, 5.5],
];

export const MEETING_MAX_DISTANCE_METERS = 100;

export function getMapProviderName() {
  return MAP_PROVIDER;
}

export function isMobileLikeDevice() {
  if (typeof window === 'undefined') return false;

  const prefersReducedData = Boolean(navigator?.connection?.saveData);
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
  const smallScreen = window.matchMedia?.('(max-width: 900px)').matches;
  const lowMemory = Number.isFinite(navigator?.deviceMemory) && navigator.deviceMemory <= 4;
  const lowCpu = Number.isFinite(navigator?.hardwareConcurrency) && navigator.hardwareConcurrency <= 4;

  return Boolean(prefersReducedData || smallScreen || coarsePointer || lowMemory || lowCpu);
}

export function getMapRenderMode() {
  if (MAP_RENDER_MODE === '2d' || MAP_RENDER_MODE === '3d') return MAP_RENDER_MODE;
  return isMobileLikeDevice() ? '2d' : '3d';
}

export function shouldUse2DMap() {
  return getMapRenderMode() === '2d';
}

function cartoLightStyle() {
  return {
    version: 8,
    name: 'SaaS Delivery Light Raster',
    sources: {
      carto: {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
          'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
          'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
          'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      },
    },
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': '#f6f7fb',
        },
      },
      {
        id: 'carto-base',
        type: 'raster',
        source: 'carto',
        paint: {
          'raster-opacity': 0.96,
          'raster-saturation': -0.1,
          'raster-contrast': 0.08,
          'raster-brightness-min': 0.02,
          'raster-brightness-max': 0.98,
        },
      },
    ],
  };
}

function cartoDarkStyle() {
  return {
    version: 8,
    name: 'SaaS Delivery Dark Raster',
    sources: {
      carto: {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      },
    },
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': '#0f172a',
        },
      },
      {
        id: 'carto-base',
        type: 'raster',
        source: 'carto',
        paint: {
          'raster-opacity': 0.98,
          'raster-saturation': -0.15,
          'raster-contrast': 0.05,
        },
      },
    ],
  };
}

export function getMapStyle(renderMode = getMapRenderMode()) {
  if (MAP_PROVIDER === 'maptiler-auto' || MAP_PROVIDER === 'maptiler-custom') {
    return renderMode === '2d' ? MAPTILER_MOBILE_2D_STYLE_URL : MAPTILER_DESKTOP_3D_STYLE_URL;
  }

  if (MAP_PROVIDER === 'maptiler-mobile-2d') {
    return MAPTILER_MOBILE_2D_STYLE_URL;
  }

  if (MAP_PROVIDER === 'maptiler-desktop-3d') {
    return MAPTILER_DESKTOP_3D_STYLE_URL;
  }

  if (MAP_PROVIDER === 'maptiler-streets') {
    return `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`;
  }

  if (MAP_PROVIDER === 'maptiler-basic') {
    return `https://api.maptiler.com/maps/basic-v2/style.json?key=${MAPTILER_KEY}`;
  }

  if (MAP_PROVIDER === 'maptiler-dark') {
    return `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${MAPTILER_KEY}`;
  }

  if (MAP_PROVIDER === 'openfreemap-bright') {
    return 'https://tiles.openfreemap.org/styles/bright';
  }

  if (MAP_PROVIDER === 'openfreemap-liberty') {
    return 'https://tiles.openfreemap.org/styles/liberty';
  }

  if (MAP_PROVIDER === 'openfreemap-positron') {
    return 'https://tiles.openfreemap.org/styles/positron';
  }

  if (MAP_PROVIDER === 'carto-light') return cartoLightStyle();
  if (MAP_PROVIDER === 'carto-dark') return cartoDarkStyle();

  return renderMode === '2d' ? MAPTILER_MOBILE_2D_STYLE_URL : MAPTILER_DESKTOP_3D_STYLE_URL;
}
