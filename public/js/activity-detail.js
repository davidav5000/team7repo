/* global api */

(() => {
  const activityId = api.getActivityId();

  const activityError = document.querySelector('#activity-error');
  const title = document.querySelector('#activity-title');
  const when = document.querySelector('#activity-when');
  const location = document.querySelector('#activity-location');
  const host = document.querySelector('#activity-host');
  const description = document.querySelector('#activity-description');
  const ownerActions = document.querySelector('#owner-actions');
  const editLink = ownerActions.querySelector('a');
  const deleteButton = document.querySelector('#delete-activity');

  const attendeeCount = document.querySelector('#attendee-count');
  const attendeeList = document.querySelector('#attendee-list');
  const attendToggle = document.querySelector('#attend-toggle');

  const commentList = document.querySelector('#comment-list');
  const commentForm = document.querySelector('#comment-form');
  const commentError = document.querySelector('#comment-error');

  const map = document.querySelector('#activity-map');

  let currentUser = null;
  let currentUserGoing = false;

  ownerActions.hidden = true;

  function setError(element, message = '') {
    element.textContent = message;
  }

  function goToLogin() {
    globalThis.location.assign('login.html');
  }

  async function loadCurrentUser() {
    try {
      const data = await api.getJson('/users/me');
      currentUser = data.user || null;
    } catch {
      currentUser = null;
    }
  }

  function renderActivity(activity) {
    title.textContent = activity.title;
    when.textContent = api.formatDate(activity.startsAt);
    location.textContent = activity.location;
    host.textContent = activity.creatorUsername || 'Unknown host';
    description.textContent = activity.description;

    editLink.href = `activity-edit.html?id=${encodeURIComponent(activity.id)}`;

    ownerActions.hidden =
      !currentUser || Number(currentUser.id) !== Number(activity.creatorId);

    if (activity.latitude != null && activity.longitude != null) {
      const img = document.createElement('img');
      img.src = `/api/maps/static?lat=${encodeURIComponent(activity.latitude)}&lng=${encodeURIComponent(activity.longitude)}`;
      img.alt = `Map showing ${activity.location}`;
      img.loading = 'lazy';
      img.style.width = '100%';
      img.style.height = 'auto';
      map.replaceChildren(img);
      map.classList.remove('map-placeholder');
    } else {
      map.textContent = 'No map location provided.';
    }
  }

  function renderAttendance(attendance) {
    currentUserGoing = Boolean(attendance.currentUserGoing);
    attendeeCount.textContent = `${attendance.goingCount} going`;

    attendeeList.replaceChildren(
      ...(attendance.attendees || []).map((attendee) => {
        const li = document.createElement('li');
        li.textContent = attendee.username;
        return li;
      }),
    );

    attendToggle.textContent = currentUserGoing ? "Can't make it" : "I'm Going";
  }

  function renderComments(comments) {
    commentList.replaceChildren(
      ...comments.map((comment) => {
        const li = document.createElement('li');
        li.className = 'comment';

        const head = document.createElement('div');
        head.className = 'comment-head';

        const author = document.createElement('strong');
        author.textContent = comment.authorUsername;

        const timestamp = document.createElement('span');
        timestamp.className = 'muted small';
        timestamp.textContent = api.formatDate(comment.createdAt);

        const message = document.createElement('p');
        message.textContent = comment.message;

        head.append(author, timestamp);
        li.append(head, message);
        return li;
      }),
    );
  }

  async function loadActivity() {
    const data = await api.getJson(`/activities/${activityId}`);
    renderActivity(data.activity);
  }

  async function loadAttendance() {
    const data = await api.getJson(`/activities/${activityId}/attendance`);
    renderAttendance(data.attendance);
  }

  async function loadComments() {
    const data = await api.getJson(`/activities/${activityId}/comments`);
    renderComments(Array.isArray(data.comments) ? data.comments : []);
  }

  attendToggle.addEventListener('click', async () => {
    if (!currentUser) {
      goToLogin();
      return;
    }

    attendToggle.disabled = true;
    setError(activityError);

    try {
      const data = currentUserGoing
        ? await api.deleteRequest(`/activities/${activityId}/attendance`)
        : await api.postJson(`/activities/${activityId}/attendance`, {});

      renderAttendance(data.attendance);
    } catch (error) {
      setError(activityError, error.message || 'Unable to update attendance.');
    } finally {
      attendToggle.disabled = false;
    }
  });

  commentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setError(commentError);

    if (!currentUser) {
      goToLogin();
      return;
    }

    const textarea = commentForm.elements.message;
    const message = textarea.value.trim();
    if (!message) return;

    const submit = commentForm.querySelector('button[type="submit"]');
    submit.disabled = true;

    try {
      await api.postJson(`/activities/${activityId}/comments`, { message });
      textarea.value = '';
      await loadComments();
    } catch (error) {
      setError(commentError, error.message || 'Unable to post comment.');
    } finally {
      submit.disabled = false;
    }
  });

  deleteButton.addEventListener('click', async () => {
    if (!globalThis.confirm('Delete this activity? This cannot be undone.')) return;

    deleteButton.disabled = true;
    setError(activityError);

    try {
      await api.deleteRequest(`/activities/${activityId}`);
      globalThis.location.assign('index.html');
    } catch (error) {
      setError(activityError, error.message || 'Unable to delete activity.');
      deleteButton.disabled = false;
    }
  });

  async function init() {
    if (!activityId) {
      setError(activityError, 'Invalid activity ID.');
      title.textContent = 'Activity not found';
      return;
    }

    try {
      await loadCurrentUser();
      await Promise.all([loadActivity(), loadAttendance(), loadComments()]);
    } catch (error) {
      setError(activityError, error.message || 'Unable to load this activity.');
      title.textContent = 'Unable to load activity';
    }
  }

  init();
})();
