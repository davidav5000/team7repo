const PLACES_SEARCH_ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
const PLACES_FIELD_MASK =
  'places.displayName,places.formattedAddress,places.location';

const REXBURG_SEARCH_BIAS = Object.freeze({
  latitude: 43.826,
  longitude: -111.789,
  radius: 25000,
});

class PlaceSearchParameterError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PlaceSearchParameterError';
    this.statusCode = 400;
  }
}

class PlaceSearchConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PlaceSearchConfigurationError';
    this.statusCode = 503;
  }
}

class PlaceSearchProviderError extends Error {
  constructor(message, statusCode = 502) {
    super(message);
    this.name = 'PlaceSearchProviderError';
    this.statusCode = statusCode;
  }
}

function normalizeSearchQuery(value) {
  if (typeof value !== 'string') {
    throw new PlaceSearchParameterError('Search query is required');
  }

  const query = value.trim().replace(/\s+/g, ' ');

  if (query.length < 2 || query.length > 100) {
    throw new PlaceSearchParameterError(
      'Search query must be between 2 and 100 characters',
    );
  }

  if ([...query].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  })) {
    throw new PlaceSearchParameterError('Search query contains invalid characters');
  }

  return query;
}

function buildPlaceSearchRequest({ apiKey, query }) {
  if (!apiKey) {
    throw new PlaceSearchConfigurationError(
      'Location search is not configured on the server',
    );
  }

  const textQuery = normalizeSearchQuery(query);
  const body = {
    textQuery,
    pageSize: 5,
    locationBias: {
      circle: {
        center: {
          latitude: REXBURG_SEARCH_BIAS.latitude,
          longitude: REXBURG_SEARCH_BIAS.longitude,
        },
        radius: REXBURG_SEARCH_BIAS.radius,
      },
    },
  };

  return {
    url: PLACES_SEARCH_ENDPOINT,
    options: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': PLACES_FIELD_MASK,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    },
  };
}

function isFiniteCoordinate(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function normalizePlacesResponse(payload) {
  if (!payload || !Array.isArray(payload.places)) {
    throw new PlaceSearchProviderError('Location search returned an invalid response');
  }

  const results = payload.places
    .map((place) => {
      const name = place?.displayName?.text;
      const address = place?.formattedAddress;
      const latitude = place?.location?.latitude;
      const longitude = place?.location?.longitude;

      if (
        typeof name !== 'string' ||
        !name.trim() ||
        typeof address !== 'string' ||
        !address.trim() ||
        !isFiniteCoordinate(latitude, -90, 90) ||
        !isFiniteCoordinate(longitude, -180, 180)
      ) {
        return null;
      }

      return {
        name: name.trim(),
        address: address.trim(),
        latitude,
        longitude,
      };
    })
    .filter(Boolean);

  if (payload.places.length > 0 && results.length === 0) {
    throw new PlaceSearchProviderError('Location search returned an invalid response');
  }

  return results;
}

async function searchPlaces({ apiKey, query, fetchImpl = fetch } = {}) {
  const { url, options } = buildPlaceSearchRequest({ apiKey, query });

  let response;
  try {
    response = await fetchImpl(url, options);
  } catch (error) {
    if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
      throw new PlaceSearchProviderError('Location search timed out', 504);
    }

    throw new PlaceSearchProviderError('Location search is temporarily unavailable');
  }

  if (!response.ok) {
    throw new PlaceSearchProviderError('Location search is temporarily unavailable');
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new PlaceSearchProviderError('Location search returned an invalid response');
  }

  return normalizePlacesResponse(payload);
}

module.exports = {
  PLACES_FIELD_MASK,
  PLACES_SEARCH_ENDPOINT,
  REXBURG_SEARCH_BIAS,
  PlaceSearchConfigurationError,
  PlaceSearchParameterError,
  PlaceSearchProviderError,
  buildPlaceSearchRequest,
  normalizePlacesResponse,
  normalizeSearchQuery,
  searchPlaces,
};
