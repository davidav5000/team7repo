document.querySelectorAll('form[action="/logout"]').forEach((form) => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      const response = await fetch('/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });

      if (!response.ok) {
        throw new Error('Logout failed');
      }

      window.location.assign('login.html');
    } catch {
      if (submitButton) submitButton.disabled = false;
      window.alert('Unable to log out. Please try again.');
    }
  });
});
