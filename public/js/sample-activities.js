// Static sprint preview data. Replace with API loading during integration.
(() => {
  const doc = globalThis.document;
  const samples = {
    '1': {
      title: 'Campus Game Night',
      when: 'October 16, 2026, at 6:00 PM',
      startsAt: '2026-10-16T18:00',
      location: 'The Grand',
      host: 'Student Activities Club',
      description: 'Meet other students and enjoy an evening of board games.',
      comments: ['Should we bring our own games?', 'We have games ready, but feel free to bring your favorites!'],
    },
    '2': {
      title: 'Campus Study Group',
      when: 'October 17, 2026, at 3:00 PM',
      startsAt: '2026-10-17T15:00',
      location: 'Campus Library',
      host: 'Computing Society',
      description: 'Bring your assignments and study alongside other students.',
      comments: ['Can I bring my programming assignment?', 'Absolutely. Bring your laptop and questions!'],
    },
    "3": {
  "title": "Pickleball Night",
  "when": "October 19, 2026, at 6:00 PM",
  "startsAt": "2026-10-19T18:00",
  "location": "BYU–Idaho campus courts (meet at the Hart Building)",
  "host": "Student Pickleball Group",
  "description": "Join other BYU–Idaho students for friendly doubles games. Beginners welcome—bring a paddle if you have one.",
  "comments": [
    "Can beginners join?",
    "Yes! We will pair up and explain the rules before playing."
  ]
},
    "4": {
  "title": "Campus Ultimate Frisbee",
  "when": "October 20, 2026, at 5:00 PM",
  "startsAt": "2026-10-20T17:00",
  "location": "BYU–Idaho campus (meet outside the Hart Building)",
  "host": "Campus Recreation Friends",
  "description": "Take a study break with a casual game of ultimate frisbee. All skill levels welcome. Bring water and comfortable shoes.",
  "comments": [
    "Do I need to bring a disc?",
    "We will bring a disc. Just bring water and come ready to play!"
  ]
},
  };
  const params = new globalThis.URLSearchParams(globalThis.location.search);
  const id = params.get('id') || '1';
  const sample = samples[id];
  if (!sample) {
    doc.getElementById('activity-error').textContent = 'This activity is unavailable in the sample preview. Return to the feed to choose an activity.';
    const content = doc.querySelector('.detail-grid') || doc.getElementById('activity-edit-form');
    content.hidden = true;
    return;
  }
  const detail = doc.getElementById('activity-detail');
  if (detail) {
    detail.dataset.activityId = id;
    for (const field of ['title', 'when', 'location', 'host', 'description']) {
      doc.getElementById(`activity-${field}`).textContent = sample[field];
    }
    doc.querySelector('#owner-actions a').setAttribute('href', `activity-edit.html?id=${id}`);
    doc.querySelectorAll('#comment-list .comment p').forEach((paragraph, index) => {
      paragraph.textContent = sample.comments[index];
    });
  } else {
    for (const field of ['title', 'startsAt', 'location', 'description']) {
      doc.getElementById(field).value = sample[field];
    }
    doc.getElementById('activity-edit-form').dataset.activityId = id;
    doc.querySelectorAll('a[href="activity.html?id=1"]').forEach((link) => {
      link.setAttribute('href', `activity.html?id=${id}`);
    });
  }
  doc.title = `${detail ? sample.title : 'Edit ' + sample.title} · Campus Activities`;
})();
