export function formatKm(meters) {
  if (!Number.isFinite(meters)) return '--';
  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatMinutes(seconds) {
  if (!Number.isFinite(seconds)) return '--';
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

export function formatLngLat(coordinates) {
  if (!coordinates) return '--';
  const [lng, lat] = coordinates;
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

export function haversineDistanceMeters(from, to) {
  if (!from || !to) return 0;

  const earthRadius = 6371000;
  const [lng1, lat1] = from.map(Number);
  const [lng2, lat2] = to.map(Number);
  const toRad = (value) => (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
