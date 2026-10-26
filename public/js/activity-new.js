/* global api */

(() => {
  const form = document.querySelector('#activity-form');
  const errorBox = document.querySelector('#activity-error');
  const submitButton = form.querySelector('button[type="submit"]');

  function optionalNumber(value) {
    const trimmed = value.trim();
    return trimmed === '' ? null : Number(trimmed);
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    errorBox.textContent = '';
    submitButton.disabled = true;
    submitButton.textContent = 'Posting…';

    const payload = {
      title: form.elements.title.value.trim(),
      startsAt: form.elements.startsAt.value,
      location: form.elements.location.value.trim(),
      description: form.elements.description.value.trim(),
      latitude: optionalNumber(form.elements.latitude.value),
      longitude: optionalNumber(form.elements.longitude.value),
    };

    try {
      const data = await api.postJson('/activities', payload);
      globalThis.location.assign(
        `activity.html?id=${encodeURIComponent(data.activity.id)}`,
      );
    } catch (error) {
      if (error.status === 401) {
        globalThis.location.assign('login.html');
        return;
      }

      errorBox.textContent = error.message || 'Unable to create activity.';
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Post activity';
    }
  });
})();
