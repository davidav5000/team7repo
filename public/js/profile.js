/* global api */

const errorBox = document.getElementById('profile-error');
const profileName = document.getElementById('profile-name');
const profileUsername = document.getElementById('profile-username');
const profileInitial = document.getElementById('profile-initial');
const profileAvatar = document.getElementById('profile-avatar');
const avatarForm = document.getElementById('avatar-form');
const avatarInput = document.getElementById('avatarFile');
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
  document.getElementById('remove-photo').hidden = !user.avatarUrl;
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
    savedAvatar = user.avatarUrl || null;
    renderAvatar(user);
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

const savePhoto = avatarForm.querySelector('button[type="submit"]');
const removePhoto = document.getElementById('remove-photo');
let selectedPhoto = null;
let savedAvatar = null;
let selectionVersion = 0;

function setPhotoBusy(busy) {
  avatarInput.disabled = busy;
  removePhoto.disabled = busy;
  savePhoto.disabled = busy || !selectedPhoto;
}

avatarInput.addEventListener('change', async () => {
  const version = ++selectionVersion;
  const file = avatarInput.files[0];
  selectedPhoto = null;
  savePhoto.disabled = true;
  renderAvatar({ name: profileName.textContent, avatarUrl: savedAvatar });
  if (!file) return;
  avatarStatus.textContent = '';
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  ) {
    avatarStatus.textContent = 'Choose a JPG, PNG or WebP image under 10 MB.';
    avatarInput.value = '';
    return;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, 512, 512);
    const side = Math.min(bitmap.width, bitmap.height);
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      512,
      512,
    );
    bitmap.close();
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.88),
    );
    if (version !== selectionVersion) return;
    if (!blob) throw new Error('Unable to read photo');
    selectedPhoto = blob;
    profileAvatar.src = canvas.toDataURL('image/jpeg', 0.88);
    profileAvatar.alt = 'Preview of your new profile photo';
    profileAvatar.hidden = false;
    profileInitial.hidden = true;
    savePhoto.disabled = false;
    avatarStatus.textContent = 'Preview ready. Save to update your photo.';
  } catch {
    if (version === selectionVersion)
      avatarStatus.textContent =
        'This image could not be opened. Please choose another photo.';
  }
});

avatarForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedPhoto) return;
  setPhotoBusy(true);
  avatarStatus.textContent = 'Uploading…';
  try {
    const data = await api.request('/users/me/avatar/upload', {
      method: 'POST',
      body: selectedPhoto,
      headers: { 'Content-Type': 'image/jpeg' },
    });
    savedAvatar = data.avatarUrl;
    selectedPhoto = null;
    avatarInput.value = '';
    renderAvatar({ name: profileName.textContent, avatarUrl: savedAvatar });
    avatarStatus.textContent = 'Profile photo updated.';
  } catch (error) {
    avatarStatus.textContent =
      error.message || 'Unable to upload photo. Please try again.';
  } finally {
    setPhotoBusy(false);
  }
});

removePhoto.addEventListener('click', async () => {
  ++selectionVersion;
  setPhotoBusy(true);
  avatarStatus.textContent = 'Removing…';
  try {
    await api.putJson('/users/me/avatar', { avatarUrl: null });
    savedAvatar = null;
    selectedPhoto = null;
    avatarInput.value = '';
    renderAvatar({ name: profileName.textContent, avatarUrl: null });
    avatarStatus.textContent = 'Profile photo removed.';
  } catch (error) {
    avatarStatus.textContent = error.message || 'Unable to remove photo.';
  } finally {
    setPhotoBusy(false);
  }
});

loadProfile();
