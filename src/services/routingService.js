import { OSRM_BASE_URL } from '../config/mapConfig.js';
import { haversineDistanceMeters } from '../utils/formatters.js';

export async function fetchRoute({ from, to, overview = 'full', radiuses = '1000;1000' }) {
  if (!from || !to) {
    throw new Error('Informe origem e destino para calcular a rota.');
  }

  const [fromLng, fromLat] = from;
  const [toLng, toLat] = to;

  // radiuses ajuda quando o GPS ou o ponto A+ está um pouco fora da rua.
  const params = new URLSearchParams({
    overview,
    geometries: 'geojson',
    steps: 'true',
    radiuses,
  });

  const url = `${OSRM_BASE_URL}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Não foi possível consultar a rota agora.');
  }

  const data = await response.json();

  if (!data.routes || !data.routes.length) {
    throw new Error('Nenhuma rota encontrada entre esses pontos.');
  }

  const route = data.routes[0];
  const coordinates = normalizeRouteEndpoints(route.geometry.coordinates, from, to);

  return {
    distance: route.distance,
    duration: route.duration,
    geometry: {
      ...route.geometry,
      coordinates,
    },
    coordinates,
  };
}

export async function fetchMeetingRoute({ from, to }) {
  try {
    return await fetchRoute({ from, to, overview: 'full', radiuses: '350;120' });
  } catch (error) {
    console.warn('Falha ao calcular rota pontilhada. Usando fallback direto temporário.', error);

    return {
      distance: haversineDistanceMeters(from, to),
      duration: 0,
      geometry: {
        type: 'LineString',
        coordinates: [from, to],
      },
      coordinates: [from, to],
      fallback: true,
    };
  }
}

function normalizeRouteEndpoints(coordinates, from, to) {
  const result = Array.isArray(coordinates) ? [...coordinates] : [];

  if (!result.length) {
    return [from, to];
  }

  const first = result[0];
  const last = result[result.length - 1];

  // Garante que a simulação começa exatamente no marcador B.
  if (haversineDistanceMeters(first, from) > 2) {
    result.unshift(from);
  }

  // Garante que a moto chega exatamente no A+/destino final, mesmo se o OSRM snapar antes.
  if (haversineDistanceMeters(last, to) > 2) {
    result.push(to);
  }

  return result;
}
