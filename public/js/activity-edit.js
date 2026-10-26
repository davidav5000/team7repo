/* global api */

(() => {
  const activityId = api.getActivityId();
  const form = document.querySelector('#activity-edit-form');
  const errorBox = document.querySelector('#activity-error');
  const submitButton = form.querySelector('button[type="submit"]');

  function toLocalDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function optionalNumber(value) {
    const trimmed = value.trim();
    return trimmed === '' ? null : Number(trimmed);
  }

  async function load() {
    if (!activityId) {
      errorBox.textContent = 'Invalid activity ID.';
      form.hidden = true;
      return;
    }

    try {
      const [activityData, userData] = await Promise.all([
        api.getJson(`/activities/${activityId}`),
        api.getJson('/users/me'),
      ]);

      const activity = activityData.activity;
      const user = userData.user;

      if (Number(activity.creatorId) !== Number(user.id)) {
        errorBox.textContent = 'Only the activity creator can edit this activity.';
        form.hidden = true;
        return;
      }

      form.elements.title.value = activity.title;
      form.elements.startsAt.value = toLocalDateTime(activity.startsAt);
      form.elements.location.value = activity.location;
      form.elements.description.value = activity.description;
      form.elements.latitude.value = activity.latitude ?? '';
      form.elements.longitude.value = activity.longitude ?? '';

      for (const link of document.querySelectorAll('a[href="activity.html?id=1"]')) {
        link.href = `activity.html?id=${encodeURIComponent(activityId)}`;
      }
    } catch (error) {
      if (error.status === 401) {
        globalThis.location.assign('login.html');
        return;
      }

      errorBox.textContent = error.message || 'Unable to load activity.';
      form.hidden = true;
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    errorBox.textContent = '';
    submitButton.disabled = true;
    submitButton.textContent = 'Saving…';

    const payload = {
      title: form.elements.title.value.trim(),
      startsAt: form.elements.startsAt.value,
      location: form.elements.location.value.trim(),
      description: form.elements.description.value.trim(),
      latitude: optionalNumber(form.elements.latitude.value),
      longitude: optionalNumber(form.elements.longitude.value),
    };

    try {
      await api.putJson(`/activities/${activityId}`, payload);
      globalThis.location.assign(
        `activity.html?id=${encodeURIComponent(activityId)}`,
      );
    } catch (error) {
      errorBox.textContent = error.message || 'Unable to save activity.';
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Save changes';
    }
  });

  load();
})();
