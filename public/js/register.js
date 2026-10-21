const form = document.getElementById('register-form');
const errorBox = document.getElementById('register-error');
const submitButton = document.getElementById('register-submit');

function getErrorMessage(data) {
  if (Array.isArray(data?.details) && data.details.length > 0) {
    return data.details[0].message || 'Please check your registration information.';
  }

  if (data && typeof data.error === 'string') return data.error;

  return 'Unable to create your account. Please try again.';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.textContent = '';
  submitButton.disabled = true;
  submitButton.textContent = 'Creating account…';

  const payload = {
    name: form.elements.name.value.trim(),
    username: form.elements.username.value.trim(),
    contactInfo: form.elements.contactInfo.value.trim(),
    password: form.elements.password.value,
  };

  try {
    const response = await fetch('/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      errorBox.textContent = getErrorMessage(data);
      return;
    }

    window.location.assign('index.html');
  } catch {
    errorBox.textContent = 'Unable to reach the server. Please try again.';
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Register';
  }
});
