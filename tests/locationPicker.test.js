const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, '../public/js/location-picker.js'),
  'utf8',
);

function element(tagName = 'div') {
  return {
    tagName,
    children: [],
    handlers: {},
    value: '',
    textContent: '',
    disabled: false,
    append(...children) {
      this.children.push(...children);
    },
    replaceChildren(...children) {
      this.children = children;
    },
    querySelector(selector) {
      return selector === 'button[type="button"]' ? this.button : null;
    },
    addEventListener(name, handler) {
      this.handlers[name] = handler;
    },
    focus() {},
  };
}

function setup(api) {
  const form = element('form');
  form.elements = {
    location: element('input'),
    latitude: element('input'),
    longitude: element('input'),
  };
  const searchForm = element('div');
  searchForm.button = element('button');
  const queryInput = element('input');
  const results = element('ul');
  const status = element('p');
  const context = vm.createContext({
    api,
    document: { createElement: element },
  });
  vm.runInContext(source, context);
  context.LocationPicker.init({
    form,
    searchForm,
    queryInput,
    results,
    status,
  });
  return { form, searchForm, queryInput, results, status };
}

test('searches through the server proxy and saves a selected place', async () => {
  const api = {
    getJson: jest.fn().mockResolvedValue({
      places: [
        {
          name: 'BYU-Idaho Library',
          address: '525 S Center St, Rexburg, ID',
          latitude: 43.826,
          longitude: -111.789,
        },
      ],
    }),
  };
  const { form, searchForm, queryInput, results, status } = setup(api);
  queryInput.value = 'library';

  searchForm.handlers.click({ target: searchForm.button });
  await new Promise((resolve) => setImmediate(resolve));

  expect(api.getJson).toHaveBeenCalledWith('/api/maps/search?q=library');
  expect(results.children).toHaveLength(1);
  expect(results.children[0].children[0].textContent).toBe('BYU-Idaho Library');

  results.children[0].children[0].handlers.click();

  expect(form.elements.location.value).toBe('525 S Center St, Rexburg, ID');
  expect(form.elements.latitude.value).toBe(43.826);
  expect(form.elements.longitude.value).toBe(-111.789);
  expect(status.textContent).toBe('Selected BYU-Idaho Library.');
});

test('does not call the server for a too-short query', async () => {
  const api = { getJson: jest.fn() };
  const { searchForm, queryInput, status } = setup(api);
  queryInput.value = 'a';

  await searchForm.handlers.click({ target: searchForm.button });

  expect(api.getJson).not.toHaveBeenCalled();
  expect(status.textContent).toBe('Enter at least 2 characters to search.');
});
