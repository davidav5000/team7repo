/* global api */

(() => {
  function initLocationPicker({ form, searchForm, queryInput, results, status }) {
    const locationInput = form.elements.location;
    const latitudeInput = form.elements.latitude;
    const longitudeInput = form.elements.longitude;
    const searchButton = searchForm.querySelector('button[type="button"]');

    function setStatus(message = '') {
      status.textContent = message;
    }

    function renderResults(places) {
      results.replaceChildren();

      if (!places.length) {
        setStatus('No places found near Rexburg. Try a different search.');
        return;
      }

      setStatus(`${places.length} place${places.length === 1 ? '' : 's'} found.`);
      for (const place of places) {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'location-result';
        button.textContent = place.name;
        button.addEventListener('click', () => {
          locationInput.value = place.address || place.name;
          latitudeInput.value = place.latitude;
          longitudeInput.value = place.longitude;
          results.replaceChildren();
          setStatus(`Selected ${place.name}.`);
          locationInput.focus();
        });

        const address = document.createElement('span');
        address.className = 'location-result-address';
        address.textContent = place.address;
        button.append(address);
        item.append(button);
        results.append(item);
      }
    }

    async function search() {
      const query = queryInput.value.trim();
      results.replaceChildren();

      if (query.length < 2) {
        setStatus('Enter at least 2 characters to search.');
        queryInput.focus();
        return;
      }

      searchButton.disabled = true;
      setStatus('Searching near Rexburg...');

      try {
        const data = await api.getJson(`/api/maps/search?q=${encodeURIComponent(query)}`);
        renderResults(Array.isArray(data.places) ? data.places : []);
      } catch (error) {
        setStatus(error.message || 'Unable to search for places.');
      } finally {
        searchButton.disabled = false;
      }
    }

    searchForm.addEventListener('click', (event) => {
      if (event.target === searchButton) search();
    });
    queryInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        search();
      }
    });
  }

  globalThis.LocationPicker = Object.freeze({ init: initLocationPicker });
})();
