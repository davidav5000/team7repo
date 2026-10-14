const STATIC_MAPS_ENDPOINT = 'https://maps.googleapis.com/maps/api/staticmap';

class StaticMapParameterError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StaticMapParameterError';
  }
}

function parseNumber(value, name, { min, max, integer = false }) {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    (integer && !Number.isInteger(number)) ||
    number < min ||
    number > max
  ) {
    throw new StaticMapParameterError(`${name} must be between ${min} and ${max}`);
  }

  return number;
}

function formatCoordinate(value) {
  return value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}

function buildStaticMapUrl({
  apiKey,
  latitude,
  longitude,
  zoom = 15,
  width = 640,
  height = 400,
  scale = 2,
  mapType = 'roadmap',
  label,
}) {
  if (!apiKey) {
    throw new StaticMapParameterError('GOOGLE_MAPS_API_KEY is not configured');
  }

  const lat = parseNumber(latitude, 'latitude', { min: -90, max: 90 });
  const lng = parseNumber(longitude, 'longitude', { min: -180, max: 180 });
  const mapZoom = parseNumber(zoom, 'zoom', { min: 0, max: 21, integer: true });
  const mapWidth = parseNumber(width, 'width', { min: 1, max: 640, integer: true });
  const mapHeight = parseNumber(height, 'height', { min: 1, max: 640, integer: true });
  const mapScale = Number(scale);

  if (![1, 2].includes(mapScale)) {
    throw new StaticMapParameterError('scale must be 1 or 2');
  }

  if (!['roadmap', 'satellite', 'terrain', 'hybrid'].includes(mapType)) {
    throw new StaticMapParameterError('mapType is invalid');
  }

  const center = `${formatCoordinate(lat)},${formatCoordinate(lng)}`;
  const markerLabel = label
    ? String(label).match(/[A-Za-z0-9]/)?.[0].toUpperCase()
    : undefined;
  const marker = markerLabel
    ? `color:red|label:${markerLabel}|${center}`
    : `color:red|${center}`;

  const params = new URLSearchParams({
    center,
    zoom: String(mapZoom),
    size: `${mapWidth}x${mapHeight}`,
    scale: String(mapScale),
    maptype: mapType,
    markers: marker,
    key: apiKey,
  });

  return `${STATIC_MAPS_ENDPOINT}?${params.toString()}`;
}

module.exports = {
  STATIC_MAPS_ENDPOINT,
  StaticMapParameterError,
  buildStaticMapUrl,
};
