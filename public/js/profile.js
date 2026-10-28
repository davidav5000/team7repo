/* global api */

const errorBox = document.getElementById('profile-error');
const profileName = document.getElementById('profile-name');
const profileUsername = document.getElementById('profile-username');
const profileInitial = document.getElementById('profile-initial');
const profileAvatar = document.getElementById('profile-avatar');
const avatarForm = document.getElementById('avatar-form');
const avatarInput = document.getElementById('avatarUrl');
const avatarStatus = document.getElementById('avatar-status');
const hostingList = document.getElementById('hosting-list');
const goingList = document.getElementById('going-list');
const hostingEmpty = document.getElementById('hosting-empty');
const goingEmpty = document.getElementById('going-empty');

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
      ` · ${api.formatDate(activity.startsAt)} · ${activity.goingCount ?? 0} going`,
    );
    item.append(link, details);
    listElement.append(item);
  }
}

function renderAvatar(user) {
  avatarInput.value = user.avatarUrl || '';
  if (user.avatarUrl) {
    profileAvatar.src = user.avatarUrl;
    profileAvatar.alt = `${user.name} avatar`;
    profileAvatar.hidden = false;
    profileInitial.hidden = true;
  } else {
    profileAvatar.removeAttribute('src');
    profileAvatar.alt = '';
    profileAvatar.hidden = true;
    profileInitial.hidden = false;
    profileInitial.textContent = user.name?.trim()?.charAt(0)?.toUpperCase() || '?';
  }
}

async function loadProfile() {
  errorBox.textContent = '';
  try {
    const [profileData, activityData] = await Promise.all([
      api.getJson('/users/me'),
      api.getJson('/users/me/activities'),
    ]);
    const user = profileData.user;
    profileName.textContent = user.name;
    profileUsername.textContent = `@${user.username}`;
    document.title = `${user.name} · Campus Activities`;
    renderAvatar(user);
    renderActivities(hostingList, hostingEmpty, activityData.hosting);
    renderActivities(goingList, goingEmpty, activityData.going);
  } catch (error) {
    if (error.status === 401) {
      globalThis.location.assign('login.html');
      return;
    }
    profileName.textContent = 'Profile unavailable';
    profileUsername.textContent = '';
    profileInitial.textContent = '?';
    errorBox.textContent = error.message || 'Unable to load profile.';
  }
}

avatarForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = avatarForm.querySelector('button[type="submit"]');
  button.disabled = true;
  avatarStatus.textContent = '';
  try {
    const avatarUrl = avatarInput.value.trim();
    const data = await api.putJson('/users/me/avatar', { avatarUrl });
    renderAvatar({ name: profileName.textContent, avatarUrl: data.avatarUrl });
    avatarStatus.textContent = 'Saved.';
  } catch (error) {
    avatarStatus.textContent = error.message || 'Unable to save avatar.';
  } finally {
    button.disabled = false;
  }
});

loadProfile();
