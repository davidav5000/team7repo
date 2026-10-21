// Temporary UI preview data.
//
// TODO: Replace this file with real API loading.
// Feed:        GET /activities
// Detail:      GET /activities/:id
// Attendance:  GET /activities/:id/attendance
// Comments:    GET /activities/:id/comments
//
// These sample objects intentionally use the same field names returned
// by the real activity API so the UI can be migrated with minimal changes.

(() => {
  const doc = globalThis.document;

  const samples = {
    '1': {
      id: 1,
      creatorId: 1,
      creatorUsername: 'studentactivities',
      title: 'Campus Game Night',
      startsAt: '2026-10-23T18:00:00-06:00',
      location: 'The Grand',
      description: 'Meet other students and enjoy an evening of board games.',
      latitude: null,
      longitude: null,
      goingCount: 8,
    },

    '2': {
      id: 2,
      creatorId: 2,
      creatorUsername: 'computingsociety',
      title: 'Campus Study Group',
      startsAt: '2026-10-24T15:00:00-06:00',
      location: 'Campus Library',
      description: 'Bring your assignments and study alongside other students.',
      latitude: null,
      longitude: null,
      goingCount: 4,
    },

    '3': {
      id: 3,
      creatorId: 3,
      creatorUsername: 'pickleballgroup',
      title: 'Pickleball Night',
      startsAt: '2026-10-26T18:00:00-06:00',
      location: 'BYU–Idaho campus courts',
      description:
        'Friendly doubles games for BYU–Idaho students. Beginners are welcome.',
      latitude: null,
      longitude: null,
      goingCount: 10,
    },

    '4': {
      id: 4,
      creatorId: 4,
      creatorUsername: 'campusrecreation',
      title: 'Campus Ultimate Frisbee',
      startsAt: '2026-10-27T17:00:00-06:00',
      location: 'BYU–Idaho campus',
      description:
        'Take a study break with a casual game of ultimate frisbee. All skill levels welcome.',
      latitude: null,
      longitude: null,
      goingCount: 6,
    },
  };

  function formatWhen(value) {
    const date = new Date(value);

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(date);
  }

  const params = new globalThis.URLSearchParams(globalThis.location.search);
  const id = params.get('id') || '1';
  const activity = samples[id];

  if (!activity) {
    const errorBox = doc.getElementById('activity-error');

    if (errorBox) {
      errorBox.textContent =
        'This sample activity does not exist. Return to the feed and choose another activity.';
    }

    const content =
      doc.querySelector('.detail-grid') ||
      doc.getElementById('activity-edit-form');

    if (content) {
      content.hidden = true;
    }

    return;
  }

  const detail = doc.getElementById('activity-detail');

  if (detail) {
    detail.dataset.activityId = activity.id;

    doc.getElementById('activity-title').textContent = activity.title;
    doc.getElementById('activity-when').textContent = formatWhen(
      activity.startsAt,
    );
    doc.getElementById('activity-location').textContent = activity.location;
    doc.getElementById('activity-host').textContent =
      activity.creatorUsername;
    doc.getElementById('activity-description').textContent =
      activity.description;

    const editLink = doc.querySelector('#owner-actions a');

    if (editLink) {
      editLink.href = `activity-edit.html?id=${activity.id}`;
    }

    const count = doc.getElementById('attendee-count');

    if (count) {
      count.textContent = `${activity.goingCount} going`;
    }

    doc.title = `${activity.title} · Campus Activities`;
    return;
  }

  const editForm = doc.getElementById('activity-edit-form');

  if (editForm) {
    editForm.dataset.activityId = activity.id;

    doc.getElementById('title').value = activity.title;
    doc.getElementById('startsAt').value =
      activity.startsAt.slice(0, 16);
    doc.getElementById('location').value = activity.location;
    doc.getElementById('description').value = activity.description;

    doc
      .querySelectorAll('a[href="activity.html?id=1"]')
      .forEach((link) => {
        link.href = `activity.html?id=${activity.id}`;
      });

    doc.title = `Edit ${activity.title} · Campus Activities`;
  }
})();
