const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../public/js/profile.js'), 'utf8');

// Minimal DOM boundary: exercise the real page script and async API behavior.
function element() {
  return {
    hidden: true,
    disabled: true,
    value: '',
    textContent: '',
    files: [],
    handlers: {},
    addEventListener(event, handler) {
      this.handlers[event] = handler;
    },
    setAttribute(name, value) {
      this[name] = value;
    },
    removeAttribute(name) {
      delete this[name];
    },
    replaceChildren: jest.fn(),
    focus: jest.fn(),
  };
}

describe('profile picture browser behavior', () => {
  let elements;
  let api;
  let urls;
  let pageEvents;
  let location;
  const el = (id) => elements[id];
  const savedUrl = '/users/42/avatar?v=saved';
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  const select = (file) => {
    el('avatar').files = file ? [file] : [];
    el('avatar').handlers.change();
  };
  const file = (name = 'picture.png') =>
    new File(['picture'], name, { type: 'image/png' });
  const submit = () => el('avatar-form').handlers.submit({ preventDefault() {} });

  beforeEach(async () => {
    elements = {};
    pageEvents = {};
    location = { assign: jest.fn() };
    urls = {
      createObjectURL: jest.fn().mockReturnValue('blob:preview'),
      revokeObjectURL: jest.fn(),
    };
    api = {
      getJson: jest
        .fn()
        .mockImplementation(async (url) =>
          url === '/users/me'
            ? {
                user: {
                  id: 42,
                  name: 'Student',
                  username: 'student',
                  avatarUrl: savedUrl,
                },
              }
            : { hosting: [], going: [] },
        ),
      putForm: jest.fn().mockResolvedValue({ avatarUrl: '/users/42/avatar?v=new' }),
      deleteRequest: jest.fn().mockResolvedValue({ avatarUrl: null }),
    };
    vm.runInNewContext(source, {
      api,
      FormData,
      URL: urls,
      location,
      addEventListener: (name, handler) => {
        pageEvents[name] = handler;
      },
      document: { getElementById: (id) => (elements[id] ||= element()) },
    });
    await tick();
  });

  test('shows the saved picture; selecting a file previews without uploading', () => {
    expect(el('profile-avatar').src).toBe(savedUrl);
    expect(el('avatar-save').disabled).toBe(true);
    select(file());
    expect(el('avatar-preview').src).toBe('blob:preview');
    expect(el('avatar-preview-wrap').hidden).toBe(false);
    expect(el('profile-avatar').src).toBe(savedUrl);
    expect(el('avatar-save').disabled).toBe(false);
    expect(api.putForm).not.toHaveBeenCalled();
  });

  test('locks controls during saving and updates the saved picture only on success', async () => {
    let resolve;
    api.putForm.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const picture = file();
    select(picture);
    const pending = submit();
    for (const id of ['avatar', 'avatar-save', 'avatar-remove'])
      expect(el(id).disabled).toBe(true);
    expect(el('avatar-status').textContent).toBe('Saving picture…');
    expect(el('profile-avatar').src).toBe(savedUrl);
    expect(api.putForm.mock.calls[0][1].get('avatar').name).toBe(picture.name);
    await submit();
    expect(api.putForm).toHaveBeenCalledTimes(1);
    resolve({ avatarUrl: '/users/42/avatar?v=new' });
    await pending;
    expect(el('profile-avatar').src).toBe('/users/42/avatar?v=new');
    expect(el('avatar-preview-wrap').hidden).toBe(true);
    expect(urls.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
    expect(el('avatar').disabled).toBe(false);
    expect(el('avatar-save').disabled).toBe(true);
  });

  test('preserves the saved picture and clears the preview after an upload error', async () => {
    api.putForm.mockRejectedValue(new Error('Animated pictures are not supported.'));
    select(file());
    await submit();
    expect(el('profile-avatar').src).toBe(savedUrl);
    expect(el('avatar-status').textContent).toBe('Animated pictures are not supported.');
    expect(el('avatar-preview-wrap').hidden).toBe(true);
    expect(el('avatar').disabled).toBe(false);
    expect(urls.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });

  test('removes the saved picture and any pending preview', async () => {
    select(file());
    await el('avatar-remove').handlers.click();
    expect(api.deleteRequest).toHaveBeenCalledWith('/users/me/avatar');
    expect(el('profile-avatar').hidden).toBe(true);
    expect(el('profile-initial').textContent).toBe('S');
    expect(el('avatar-remove').disabled).toBe(true);
    expect(el('avatar-preview-wrap').hidden).toBe(true);
  });

  test('preserves the saved picture when removal fails', async () => {
    api.deleteRequest.mockRejectedValue(new Error('Server error'));
    await el('avatar-remove').handlers.click();
    expect(el('profile-avatar').src).toBe(savedUrl);
    expect(el('avatar-status').textContent).toBe('Server error');
    expect(el('avatar-remove').disabled).toBe(false);
  });

  test.each([
    { type: 'image/gif', size: 10 },
    { type: 'image/png', size: 5 * 1024 * 1024 + 1 },
    { type: 'image/png', size: 0 },
  ])('rejects invalid client selections before creating previews: %j', (input) => {
    select(input);
    expect(urls.createObjectURL).not.toHaveBeenCalled();
    expect(el('avatar-save').disabled).toBe(true);
    expect(el('profile-avatar').src).toBe(savedUrl);
    expect(el('avatar-status').textContent).not.toBe('');
  });

  test('releases previews on replacement, cancellation, and page exit', () => {
    select(file('first.png'));
    select(file('second.png'));
    expect(urls.revokeObjectURL).toHaveBeenCalledTimes(1);
    select(null);
    expect(urls.revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(el('avatar-save').disabled).toBe(true);
    select(file());
    pageEvents.pagehide();
    expect(urls.revokeObjectURL).toHaveBeenCalledTimes(3);
  });

  test('falls back to the initial when a saved picture cannot load', () => {
    el('profile-avatar').handlers.error();
    expect(el('profile-avatar').hidden).toBe(true);
    expect(el('profile-initial').hidden).toBe(false);
    expect(el('profile-initial').textContent).toBe('S');
  });

  test('clears an unreadable preview and prevents saving it', () => {
    select(file());
    el('avatar-preview').handlers.error();
    expect(el('avatar-save').disabled).toBe(true);
    expect(el('avatar-preview-wrap').hidden).toBe(true);
    expect(el('profile-avatar').src).toBe(savedUrl);
  });

  test('redirects expired sessions to login', async () => {
    api.putForm.mockRejectedValue(
      Object.assign(new Error('Authentication required'), { status: 401 }),
    );
    select(file());
    await submit();
    expect(location.assign).toHaveBeenCalledWith('login.html');
  });
});
