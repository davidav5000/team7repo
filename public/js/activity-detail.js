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
    const nodes = new Map();
    const rendered = comments.map((comment) => {
      const li = document.createElement('li');
      li.className = 'comment';

      const head = document.createElement('div');
      head.className = 'comment-head';

      if (comment.authorAvatarUrl) {
        const avatar = document.createElement('img');
        avatar.className = 'comment-avatar';
        avatar.src = comment.authorAvatarUrl;
        avatar.alt = '';
        avatar.loading = 'lazy';
        head.append(avatar);
      }

      const author = document.createElement('strong');
      author.textContent = comment.authorUsername;

      const timestamp = document.createElement('span');
      timestamp.className = 'muted small';
      timestamp.textContent = api.formatDate(comment.createdAt);

      const message = document.createElement('p');
      message.textContent = comment.message;

      head.append(author, timestamp);
      li.append(head, message);
      if (currentUser && Number(currentUser.id) === Number(comment.authorId)) {
        const actions = document.createElement('div');
        actions.className = 'comment-actions';
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'btn-link';
        edit.textContent = 'Edit';
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn-link comment-delete';
        remove.textContent = 'Delete';
        const status = document.createElement('p');
        status.className = 'small';
        status.setAttribute('role', 'status');
        const url = `/activities/${activityId}/comments/${encodeURIComponent(comment.id)}`;
        edit.addEventListener('click', () => {
          edit.disabled = true;
          const form = document.createElement('form');
          form.className = 'comment-edit-form';
          const input = document.createElement('textarea');
          input.value = comment.message;
          input.required = true;
          input.maxLength = 2000;
          input.setAttribute('aria-label', 'Edit your comment');
          const save = document.createElement('button');
          save.type = 'submit';
          save.className = 'btn';
          save.textContent = 'Save changes';
          const cancel = document.createElement('button');
          cancel.type = 'button';
          cancel.className = 'btn btn-secondary';
          cancel.textContent = 'Cancel';
          const buttons = document.createElement('div');
          buttons.className = 'comment-actions';
          buttons.append(save, cancel);
          form.append(input, buttons);
          message.hidden = true;
          actions.hidden = true;
          status.textContent = '';
          li.append(form);
          input.focus();
          function closeEditor() {
            form.remove();
            message.hidden = false;
            actions.hidden = false;
            edit.disabled = false;
          }
          cancel.addEventListener('click', () => {
            status.textContent = '';
            closeEditor();
            edit.focus();
          });
          form.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!input.value.trim()) {
              status.textContent = 'Enter a comment before saving.';
              return;
            }
            save.disabled = true;
            cancel.disabled = true;
            input.disabled = true;
            status.textContent = 'Saving…';
            try {
              const data = await api.putJson(url, { message: input.value.trim() });
              comment.message = data.comment.message;
              message.textContent = comment.message;
              closeEditor();
              status.textContent = 'Comment updated.';
              edit.focus();
            } catch (error) {
              status.textContent = error.message || 'Unable to save comment.';
            } finally {
              save.disabled = false;
              cancel.disabled = false;
              input.disabled = false;
            }
          });
        });
        remove.addEventListener('click', async () => {
          if (!globalThis.confirm('Delete this comment? This cannot be undone.')) return;
          edit.disabled = true;
          remove.disabled = true;
          status.textContent = 'Deleting…';
          try {
            await api.deleteRequest(url);
            li.remove();
            await loadComments();
            setError(commentError);
            commentForm.elements.message.focus();
          } catch (error) {
            status.textContent = error.message || 'Unable to delete comment.';
            edit.disabled = false;
            remove.disabled = false;
          }
        });
        actions.append(edit, remove);
        li.append(actions, status);
      }
      const reply = document.createElement('button');
      reply.type = 'button';
      reply.className = 'btn-link comment-reply';
      reply.textContent = 'Reply';
      reply.addEventListener('click', () => {
        if (!currentUser) {
          goToLogin();
          return;
        }
        reply.disabled = true;
        const form = document.createElement('form');
        form.className = 'comment-edit-form';
        const label = document.createElement('label');
        label.textContent = `Reply to @${comment.authorUsername}`;
        const input = document.createElement('textarea');
        input.required = true;
        input.maxLength = 2000;
        input.id = `reply-${comment.id}`;
        label.htmlFor = input.id;
        input.placeholder = 'Write a reply…';
        const buttons = document.createElement('div');
        buttons.className = 'comment-actions';
        const send = document.createElement('button');
        send.type = 'submit';
        send.className = 'btn';
        send.textContent = 'Post reply';
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'btn btn-secondary';
        cancel.textContent = 'Cancel';
        const status = document.createElement('p');
        status.className = 'small';
        status.setAttribute('role', 'status');
        buttons.append(send, cancel);
        form.append(label, input, buttons, status);
        li.append(form);
        input.focus();
        cancel.addEventListener('click', () => {
          form.remove();
          reply.disabled = false;
          reply.focus();
        });
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          if (!input.value.trim()) {
            status.textContent = 'Enter a reply before posting.';
            return;
          }
          send.disabled = true;
          cancel.disabled = true;
          input.disabled = true;
          status.textContent = 'Posting…';
          try {
            await api.postJson(
              `/activities/${activityId}/comments/${encodeURIComponent(comment.parentId || comment.id)}/replies`,
              { message: input.value.trim() },
            );
            // Clear the composer immediately after success, even if refreshing fails.
            form.remove();
            reply.disabled = false;
            await loadComments();
          } catch (error) {
            status.textContent = error.message || 'Unable to post reply.';
            setError(commentError, error.message || 'Unable to refresh comments.');
          } finally {
            send.disabled = false;
            cancel.disabled = false;
            input.disabled = false;
          }
        });
      });
      li.append(reply);
      nodes.set(Number(comment.id), li);
      return li;
    });
    const roots = [];
    comments.forEach((comment, index) => {
      const parent = comment.parentId && nodes.get(Number(comment.parentId));
      if (parent) {
        let replies = parent.querySelector('.comment-replies');
        if (!replies) {
          replies = document.createElement('ul');
          replies.className = 'comment-replies';
          replies.setAttribute('aria-label', 'Replies');
          parent.append(replies);
        }
        replies.append(rendered[index]);
      } else {
        roots.push(rendered[index]);
      }
    });
    commentList.replaceChildren(...roots);
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
