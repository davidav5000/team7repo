const form = document.getElementById('login-form');
const errorBox = document.getElementById('login-error');
const submitButton = document.getElementById('login-submit');

function getErrorMessage(data) {
  if (data && typeof data.error === 'string') return data.error;

  if (Array.isArray(data?.details) && data.details.length > 0) {
    return data.details[0].message || 'Please check your login information.';
  }

  return 'Unable to log in. Please try again.';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.textContent = '';
  submitButton.disabled = true;
  submitButton.textContent = 'Logging in…';

  const username = form.elements.username.value.trim();
  const password = form.elements.password.value;

  try {
    const response = await fetch('/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify({ username, password }),
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
    submitButton.textContent = 'Log in';
  }
});
