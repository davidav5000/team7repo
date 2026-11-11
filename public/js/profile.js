/* global api */

const errorBox = document.getElementById('profile-error');
const profileName = document.getElementById('profile-name');
const profileUsername = document.getElementById('profile-username');
const profileInitial = document.getElementById('profile-initial');
const profileAvatar = document.getElementById('profile-avatar');
const avatarForm = document.getElementById('avatar-form');
const avatarInput = document.getElementById('avatar');
const avatarStatus = document.getElementById('avatar-status');
const avatarSave = document.getElementById('avatar-save');
const avatarRemove = document.getElementById('avatar-remove');
const avatarPreview = document.getElementById('avatar-preview');
const avatarPreviewWrap = document.getElementById('avatar-preview-wrap');
const avatarPreviewCaption = document.getElementById('avatar-preview-caption');
const hostingList = document.getElementById('hosting-list');
const goingList = document.getElementById('going-list');
const hostingEmpty = document.getElementById('hosting-empty');
const goingEmpty = document.getElementById('going-empty');
let savedUser = null;
let selectedFile = null;
let previewUrl = null;
let avatarBusy = false;

function updateAvatarControls() {
  avatarInput.disabled = avatarBusy || !savedUser;
  avatarSave.disabled = avatarBusy || !savedUser || !selectedFile;
  avatarRemove.disabled = avatarBusy || !savedUser?.avatarUrl;
  avatarForm.setAttribute('aria-busy', String(avatarBusy));
}

function releasePreview() {
  avatarPreview.removeAttribute('src');
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  selectedFile = null;
  avatarPreviewWrap.hidden = true;
  avatarPreviewCaption.textContent = '';
}

function clearSelection() {
  releasePreview();
  avatarInput.value = '';
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
      ` · ${api.formatDate(activity.startsAt)} · ${activity.goingCount ?? 0} going`,
    );
    item.append(link, details);
    listElement.append(item);
  }
}

function renderAvatar(user) {
  profileInitial.textContent = user.name?.trim()?.charAt(0)?.toUpperCase() || '?';
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
    savedUser = user;
    updateAvatarControls();
    document.getElementById('hosting-count').textContent =
      activityData.hosting?.length ?? 0;
    document.getElementById('going-count').textContent = activityData.going?.length ?? 0;
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
  if (avatarBusy || !savedUser || !selectedFile) return;
  avatarBusy = true;
  updateAvatarControls();
  avatarStatus.textContent = 'Saving picture…';
  try {
    const formData = new FormData();
    formData.append('avatar', selectedFile);
    const data = await api.putForm('/users/me/avatar', formData);
    savedUser.avatarUrl = data.avatarUrl;
    renderAvatar(savedUser);
    clearSelection();
    avatarStatus.textContent = 'Picture saved.';
  } catch (error) {
    clearSelection();
    renderAvatar(savedUser);
    avatarStatus.textContent = error.message || 'Unable to save picture.';
    if (error.status === 401) globalThis.location.assign('login.html');
  } finally {
    avatarBusy = false;
    updateAvatarControls();
    avatarInput.focus();
  }
});

avatarInput.addEventListener('change', () => {
  if (avatarBusy) return;
  releasePreview();
  const file = avatarInput.files?.[0];
  avatarStatus.textContent = '';
  if (file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      avatarInput.value = '';
      avatarStatus.textContent = 'Choose a JPEG, PNG, or WebP picture.';
    } else if (!file.size || file.size > 5 * 1024 * 1024) {
      avatarInput.value = '';
      avatarStatus.textContent = 'Choose a nonempty picture of 5 MB or smaller.';
    } else {
      selectedFile = file;
      previewUrl = URL.createObjectURL(file);
      avatarPreview.src = previewUrl;
      avatarPreviewWrap.hidden = false;
      avatarPreviewCaption.textContent = `${file.name} — Preview only. Click Save picture to upload.`;
      avatarStatus.textContent = 'Picture selected. Review the preview, then save.';
    }
  }
  updateAvatarControls();
});

avatarRemove.addEventListener('click', async () => {
  if (avatarBusy || !savedUser?.avatarUrl) return;
  avatarBusy = true;
  updateAvatarControls();
  avatarStatus.textContent = 'Removing picture…';
  try {
    await api.deleteRequest('/users/me/avatar');
    savedUser.avatarUrl = null;
    clearSelection();
    renderAvatar(savedUser);
    avatarStatus.textContent = 'Picture removed.';
  } catch (error) {
    avatarStatus.textContent = error.message || 'Unable to remove picture.';
    if (error.status === 401) globalThis.location.assign('login.html');
  } finally {
    avatarBusy = false;
    updateAvatarControls();
    avatarInput.focus();
  }
});

profileAvatar.addEventListener('error', () => {
  profileAvatar.hidden = true;
  profileInitial.hidden = false;
});

avatarPreview.addEventListener('error', () => {
  if (!previewUrl) return;
  clearSelection();
  avatarStatus.textContent = 'Unable to preview this picture. Choose another image.';
  updateAvatarControls();
});

globalThis.addEventListener('pagehide', () => {
  clearSelection();
  updateAvatarControls();
});

loadProfile();
