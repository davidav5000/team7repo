(() => {
  class ApiError extends Error {
    constructor(message, { status = 0, details = [] } = {}) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.details = details;
    }
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });

    if (response.status === 204) {
      return null;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        data.details?.[0]?.message ||
        data.error ||
        `Request failed with status ${response.status}`;

      throw new ApiError(message, {
        status: response.status,
        details: Array.isArray(data.details) ? data.details : [],
      });
    }

    return data;
  }

  function getJson(url) {
    return request(url);
  }

  function postJson(url, body) {
    return request(url, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  function putJson(url, body) {
    return request(url, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  function deleteRequest(url) {
    return request(url, {
      method: 'DELETE',
    });
  }

  function getActivityId() {
    const params = new URLSearchParams(globalThis.location.search);
    const value = params.get('id');

    if (!/^\d+$/.test(value || '')) return null;

    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  function formatDate(value, options = {}) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Date unavailable';

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      ...options,
    }).format(date);
  }

  globalThis.api = Object.freeze({
    ApiError,
    request,
    getJson,
    postJson,
    putJson,
    deleteRequest,
    getActivityId,
    formatDate,
  });
})();
