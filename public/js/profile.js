const errorBox = document.getElementById('profile-error');
const profileName = document.getElementById('profile-name');
const profileUsername = document.getElementById('profile-username');
const profileInitial = document.getElementById('profile-initial');
const hostingList = document.getElementById('hosting-list');
const goingList = document.getElementById('going-list');
const hostingEmpty = document.getElementById('hosting-empty');
const goingEmpty = document.getElementById('going-empty');

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function renderActivities(listElement, emptyElement, activities) {
  listElement.replaceChildren();

  if (!Array.isArray(activities) || activities.length === 0) {
    emptyElement.hidden = false;
    return;
  }

  emptyElement.hidden = true;

  for (const activity of activities) {
    const item = document.createElement('li');
    const link = document.createElement('a');

    link.href = `activity.html?id=${encodeURIComponent(activity.id)}`;
    link.textContent = activity.title;

    const details = document.createTextNode(
      ` · ${formatDate(activity.startsAt)} · ${activity.goingCount ?? 0} going`,
    );

    item.append(link, details);
    listElement.append(item);
  }
}

async function getJson(url) {
  const response = await fetch(url, {
    credentials: 'same-origin',
  });
  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    window.location.assign('login.html');
    return null;
  }

  if (!response.ok) {
    throw new Error(data.error || 'Unable to load profile.');
  }

  return data;
}

async function loadProfile() {
  errorBox.textContent = '';

  try {
    const [profileData, activityData] = await Promise.all([
      getJson('/users/me'),
      getJson('/users/me/activities'),
    ]);

    if (!profileData || !activityData) return;

    const user = profileData.user;

    profileName.textContent = user.name;
    profileUsername.textContent = `@${user.username}`;
    profileInitial.textContent =
      user.name?.trim()?.charAt(0)?.toUpperCase() || '?';
    document.title = `${user.name} · Campus Activities`;

    renderActivities(hostingList, hostingEmpty, activityData.hosting);
    renderActivities(goingList, goingEmpty, activityData.going);
  } catch (error) {
    profileName.textContent = 'Profile unavailable';
    profileUsername.textContent = '';
    profileInitial.textContent = '?';
    errorBox.textContent = error.message || 'Unable to load profile.';
  }
}

loadProfile();
