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
    children: [],
    handlers: {},
    hidden: false,
    textContent: '',
    append(...children) {
      for (const child of children) {
        child.parent = this;
        this.children.push(child);
      }
    },
    replaceChildren(...children) {
      this.children = [];
      this.append(...children);
    },
    remove() {
      this.parent.children = this.parent.children.filter((child) => child !== this);
    },
    querySelector(selector) {
      return (
        this.children.find((child) =>
          selector.startsWith('.')
            ? child.className?.split(' ').includes(selector.slice(1))
            : child.tagName === selector,
        ) || null
      );
    },
    setAttribute(name, value) {
      this[name] = value;
    },
    addEventListener(name, handler) {
      this.handlers[name] = handler;
    },
    focus: jest.fn(),
  };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
const submit = (form) => form.handlers.submit({ preventDefault() {} });
async function setup() {
  const elements = {};
  const rows = [
    { id: 1, authorId: 7, authorUsername: 'friend', message: 'Original' },
    { id: 2, parentId: 1, authorId: 42, authorUsername: 'me', message: 'My reply' },
  ];
  const api = {
    getActivityId: () => 9,
    formatDate: () => 'Today',
    getJson: jest.fn(async (url) => {
      if (url === '/users/me') return { user: { id: 42 } };
      if (url.endsWith('/comments')) return { comments: rows };
      if (url.endsWith('/attendance')) return { attendance: { attendees: [] } };
      return { activity: { id: 9, creatorId: 7 } };
    }),
    postJson: jest.fn().mockResolvedValue({ comment: { id: 3 } }),
    putJson: jest.fn().mockResolvedValue({ comment: { id: 2, message: 'Edited' } }),
    deleteRequest: jest.fn().mockResolvedValue(null),
  };
  const ownerActions = element();
  ownerActions.append(element('a'));
  elements['#owner-actions'] = ownerActions;
  const form = element('form');
  form.elements = { message: element('textarea') };
  form.append(element('button'));
  // Initialization only registers listeners; selector for submit is used when posting a top-level comment.
  elements['#comment-form'] = form;
  vm.runInNewContext(source, {
    document: {
      querySelector: (selector) => (elements[selector] ||= element()),
      createElement: element,
    },
    api,
    confirm: () => true,
  });
  await tick();
  return { elements, api, root: elements['#comment-list'].children[0] };
}
test('groups replies beneath their parent and only exposes own edit/delete controls', async () => {
  const { root, elements } = await setup();
  expect(elements['#comment-list'].children).toHaveLength(1);
  expect(root.querySelector('.comment-actions')).toBeNull();
  const replies = root.querySelector('.comment-replies');
  expect(replies.children).toHaveLength(1);
  expect(
    replies.children[0]
      .querySelector('.comment-actions')
      .children.map((b) => b.textContent),
  ).toEqual(['Edit', 'Delete']);
});
test('reply composer posts to the root comment and supports cancellation', async () => {
  const { root, api } = await setup();
  const reply = root.querySelector('.comment-reply');
  reply.handlers.click();
  let composer = root.querySelector('form');
  composer.querySelector('textarea').value = ' Hello friend ';
  await submit(composer);
  expect(api.postJson).toHaveBeenCalledWith('/activities/9/comments/1/replies', {
    message: 'Hello friend',
  });
  expect(composer.parent.children).not.toContain(composer);
  const child = root.querySelector('.comment-replies').children[0];
  child.querySelector('.comment-reply').handlers.click();
  composer = child.querySelector('form');
  composer.querySelector('textarea').value = 'Nested reply';
  await submit(composer);
  expect(api.postJson).toHaveBeenLastCalledWith('/activities/9/comments/1/replies', {
    message: 'Nested reply',
  });
});
test('edits own replies through the owned-comment endpoint', async () => {
  const { root, api } = await setup();
  const child = root.querySelector('.comment-replies').children[0];
  child.querySelector('.comment-actions').children[0].handlers.click();
  const form = child.querySelector('form');
  form.querySelector('textarea').value = 'Edited';
  await submit(form);
  expect(api.putJson).toHaveBeenCalledWith('/activities/9/comments/2', {
    message: 'Edited',
  });
  expect(child.querySelector('p').textContent).toBe('Edited');
});
test('deletes own replies and refreshes the thread', async () => {
  const { root, api } = await setup();
  const child = root.querySelector('.comment-replies').children[0];
  await child.querySelector('.comment-actions').children[1].handlers.click();
  expect(api.deleteRequest).toHaveBeenCalledWith('/activities/9/comments/2');
  expect(api.getJson).toHaveBeenCalledWith('/activities/9/comments');
});
