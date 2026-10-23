/* global api */

(() => {
  const form = document.querySelector('#search-form');
  const searchInput = form.querySelector('input[name="q"]');
  const clearButton = document.querySelector('#clear-search');
  const feed = document.querySelector('#activity-feed');
  const emptyState = document.querySelector('#feed-empty');
  const emptyMessage = emptyState.querySelector('p');
  const error = document.querySelector('#feed-error');

  function setError(message = '') {
    error.textContent = message;
  }

  function createActivityCard(activity) {
    const article = document.createElement('article');
    article.className = 'card activity-card';

    const title = document.createElement('h3');
    title.textContent = activity.title;

    const host = document.createElement('p');
    host.innerHTML = '<strong>Host:</strong> ';
    host.append(activity.creatorUsername || 'Unknown host');

    const when = document.createElement('p');
    when.innerHTML = '<strong>When:</strong> ';
    when.append(api.formatDate(activity.startsAt));

    const location = document.createElement('p');
    location.innerHTML = '<strong>Where:</strong> ';
    location.append(activity.location);

    const description = document.createElement('p');
    description.textContent = activity.description;

    const link = document.createElement('a');
    link.className = 'btn';
    link.href = `activity.html?id=${encodeURIComponent(activity.id)}`;
    link.textContent = 'View Details';

    article.append(title, host, when, location, description, link);
    return article;
  }

  function renderActivities(activities) {
    feed.replaceChildren(...activities.map(createActivityCard));
    feed.hidden = activities.length === 0;
    emptyState.hidden = activities.length !== 0;
    emptyMessage.textContent = searchInput.value.trim()
      ? 'No activities match your search.'
      : 'No activities yet.';
  }

  function getSearchUrl() {
    const params = new URLSearchParams();
    const query = searchInput.value.trim();
    if (query) params.set('q', query);

    const url = new URL(globalThis.location.href);
    url.search = params.toString();
    return url;
  }

  async function loadActivities() {
    setError();
    feed.replaceChildren();

    const url = getSearchUrl();
    try {
      const data = await api.getJson(`/activities${url.search}`);
      renderActivities(Array.isArray(data.activities) ? data.activities : []);
    } catch {
      renderActivities([]);
      setError('Unable to load activities. Please try again.');
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const url = getSearchUrl();
    globalThis.history.pushState({}, '', url);
    loadActivities();
  });

  clearButton.addEventListener('click', () => {
    searchInput.value = '';
    const url = new URL(globalThis.location.href);
    url.search = '';
    globalThis.history.pushState({}, '', url);
    loadActivities();
  });

  globalThis.addEventListener('popstate', () => {
    searchInput.value = new URLSearchParams(globalThis.location.search).get('q') || '';
    loadActivities();
  });

  searchInput.value = new URLSearchParams(globalThis.location.search).get('q') || '';
  loadActivities();
})();
