/* global api */

(() => {
  const form = document.querySelector('#activity-form');
  const errorBox = document.querySelector('#activity-error');
  const submitButton = form.querySelector('button[type="submit"]');
  const loginHint = document.querySelector('#activity-login-hint');
  let posting = false;

  function optionalNumber(value) {
    const trimmed = value.trim();
    return trimmed === '' ? null : Number(trimmed);
  }

  function validate() {
    for (const name of ['title', 'location', 'description']) {
      const input = form.elements[name];
      input.setCustomValidity(input.value.trim() ? '' : 'Please enter a ' + name + '.');
    }

    const dateInput = form.elements.startsAt;
    const date = new Date(dateInput.value);
    dateInput.setCustomValidity(
      Number.isFinite(date.getTime()) ? '' : 'Please enter a valid date and time.',
    );

    const latitude = form.elements.latitude;
    const longitude = form.elements.longitude;
    const missingPair =
      Boolean(latitude.value.trim()) !== Boolean(longitude.value.trim());
    latitude.setCustomValidity(
      missingPair && !latitude.value.trim() ? 'Enter latitude as well as longitude.' : '',
    );
    longitude.setCustomValidity(
      missingPair && !longitude.value.trim()
        ? 'Enter longitude as well as latitude.'
        : '',
    );
    return form.reportValidity();
  }

  form.addEventListener('input', () => {
    for (const input of form.elements) {
      if (typeof input.setCustomValidity === 'function') input.setCustomValidity('');
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (posting) return;
    errorBox.textContent = '';
    loginHint.hidden = true;
    if (!validate()) return;

    posting = true;
    submitButton.disabled = true;
    submitButton.textContent = 'Posting…';
    form.setAttribute('aria-busy', 'true');

    const payload = {
      title: form.elements.title.value.trim(),
      startsAt: new Date(form.elements.startsAt.value).toISOString(),
      location: form.elements.location.value.trim(),
      description: form.elements.description.value.trim(),
      latitude: optionalNumber(form.elements.latitude.value),
      longitude: optionalNumber(form.elements.longitude.value),
    };

    try {
      const data = await api.postJson('/activities', payload);
      if (!data?.activity?.id) {
        throw new Error(
          'The server did not return an activity ID. Check the feed before retrying.',
        );
      }
      globalThis.location.assign(
        `activity.html?id=${encodeURIComponent(data.activity.id)}`,
      );
    } catch (error) {
      if (error.status === 401) {
        errorBox.textContent =
          'Please sign in before posting. Your entries are still here; sign in using the link below, then try again.';
        loginHint.hidden = false;
      } else if (error.status >= 500) {
        errorBox.textContent =
          'The server could not create your activity. Your entries are still here. Please try again later.';
      } else if (error instanceof TypeError) {
        errorBox.textContent =
          'Unable to reach the server. Check your connection and open this page through the app server.';
      } else {
        errorBox.textContent = error.message || 'Unable to create activity.';
      }
      errorBox.focus();
    } finally {
      posting = false;
      submitButton.disabled = false;
      submitButton.textContent = 'Post activity';
      form.removeAttribute('aria-busy');
    }
  });
})();
