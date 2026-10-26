(() => {
  const nav = document.querySelector('.nav');
  if (!nav) return;

  const current = globalThis.location.pathname.split('/').pop() || 'index.html';

  function link(href, label) {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = label;
    if (current === href) a.setAttribute('aria-current', 'page');
    return a;
  }

  function renderSignedOut() {
    nav.replaceChildren(
      link('index.html', 'Feed'),
      link('login.html', 'Log in'),
      link('register.html', 'Register'),
    );
  }

  function renderSignedIn(user) {
    const form = document.createElement('form');
    form.method = 'post';
    form.action = '/logout';

    const button = document.createElement('button');
    button.className = 'btn-link';
    button.type = 'submit';
    button.textContent = 'Log out';
    form.append(button);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      button.disabled = true;
      try {
        const response = await fetch('/logout', {
          method: 'POST',
          credentials: 'same-origin',
        });
        if (!response.ok) throw new Error('Logout failed');
        globalThis.location.assign('login.html');
      } catch {
        button.disabled = false;
        globalThis.alert('Unable to log out. Please try again.');
      }
    });

    nav.replaceChildren(
      link('index.html', 'Feed'),
      link('activity-new.html', 'Create'),
      link('profile.html', user?.username ? `@${user.username}` : 'Profile'),
      form,
    );
  }

  fetch('/users/me', { credentials: 'same-origin' })
    .then(async (response) => {
      if (response.status === 401) {
        renderSignedOut();
        return;
      }
      if (!response.ok) throw new Error('Unable to load session');
      const data = await response.json();
      renderSignedIn(data.user);
    })
    .catch(renderSignedOut);
})();
