const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, '../public/js/activity-detail.js'),
  'utf8',
);

function element(tagName = 'div') {
  return {
    tagName,
    hidden: false,
    children: [],
    handlers: {},
    textContent: '',
    append(...children) {
      this.children.push(...children);
    },
    replaceChildren(...children) {
      this.children = children;
    },
    querySelector() {
      return element();
    },
    setAttribute(name, value) {
      this[name] = value;
    },
    addEventListener(name, handler) {
      this.handlers[name] = handler;
    },
  };
}

describe('comment picture fallbacks', () => {
  async function render(avatarUrl, username = 'student') {
    const elements = {};
    vm.runInNewContext(source, {
      document: {
        querySelector: (selector) => (elements[selector] ||= element()),
        createElement: element,
      },
      api: {
        getActivityId: () => 1,
        formatDate: () => 'Today',
        getJson: async (url) => {
          if (url === '/users/me') return { user: { id: 42 } };
          if (url.endsWith('/comments'))
            return {
              comments: [
                {
                  authorAvatarUrl: avatarUrl,
                  authorUsername: username,
                  message: 'Hello',
                },
              ],
            };
          if (url.endsWith('/attendance')) return { attendance: { attendees: [] } };
          return { activity: { id: 1, title: 'Games', creatorId: 42 } };
        },
      },
    });
    await new Promise((resolve) => setImmediate(resolve));
    return elements['#comment-list'].children[0].children[0].children;
  }

  test('shows a decorative initial when the author has no picture', async () => {
    const children = await render(null);
    const initial = children[0];
    expect(initial.tagName).toBe('span');
    expect(initial.textContent).toBe('S');
    expect(initial.hidden).toBe(false);
    expect(initial['aria-hidden']).toBe('true');
    expect(children.some((child) => child.tagName === 'img')).toBe(false);
  });

  test.each([
    '/users/42/avatar?v=old-revision',
    'https://example.com/broken-legacy-picture.jpg',
  ])('replaces a failed picture with the author initial: %s', async (url) => {
    const [image, initial, author] = await render(url);
    expect(image.src).toBe(url);
    expect(initial.hidden).toBe(true);
    image.handlers.error();
    expect(image.hidden).toBe(true);
    expect(initial.hidden).toBe(false);
    expect(initial.textContent).toBe('S');
    expect(author.textContent).toBe('student');
  });

  test('uses a placeholder when the author name is unavailable', async () => {
    const [initial] = await render(null, '');
    expect(initial.textContent).toBe('?');
  });
});
