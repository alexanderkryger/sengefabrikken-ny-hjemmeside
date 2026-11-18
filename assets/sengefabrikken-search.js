/**
 * Sengefabrikken: <sengefabrikken-search>
 *
 * Drives the full screen search (see the sengefabrikken-search snippet):
 * - while typing, the results are fetched from the sengefabrikken-search-results section through the search page, so
 *   that the filters of the Search & Discovery app are available (the predictive search API does not return them)
 * - when a filter is changed or a chip removed, the results are fetched again with the selected filters
 * - when the input is cleared, the idle state rendered with the page is shown again
 * - the form is not submitted, as the results are shown live
 */
class SengefabrikkenSearch extends HTMLElement {
  #abortController;
  #fetchAbortController;
  #idleHtml;
  #debounceTimer;

  connectedCallback() {
    this.#abortController = new AbortController();
    this.#idleHtml = this.results.innerHTML;

    const { signal } = this.#abortController;

    this.form.addEventListener('submit', (event) => event.preventDefault(), { signal });
    this.form.addEventListener('reset', () => setTimeout(() => this.#onInput()), { signal });
    this.input.addEventListener('input', () => {
      clearTimeout(this.#debounceTimer);
      this.#debounceTimer = setTimeout(() => this.#onInput(), 280);
    }, { signal });

    this.results.addEventListener('change', this.#onFilterChange.bind(this), { signal });
    this.addEventListener('click', this.#onClick.bind(this), { signal });
  }

  disconnectedCallback() {
    this.#abortController.abort();
    this.#fetchAbortController?.abort();
  }

  get form() {
    return this.querySelector('form[role="search"]');
  }

  get input() {
    return this.form.elements['q'];
  }

  get results() {
    return this.querySelector('[data-search-results]');
  }

  get #filtersForm() {
    return this.results.querySelector('[data-search-filters]');
  }

  #onInput() {
    const hasQuery = this.input.value.trim() !== '';
    this.form.querySelector('[type="reset"]').hidden = !hasQuery;

    if (!hasQuery) {
      this.#fetchAbortController?.abort();
      this.results.innerHTML = this.#idleHtml;
      return;
    }

    this.#search();
  }

  #onFilterChange(event) {
    if (!event.target.closest('[data-search-filters]')) {
      return;
    }

    event.target.closest('details')?.removeAttribute('open');
    this.#search(new FormData(this.#filtersForm));
  }

  #onClick(event) {
    const removeButton = event.target.closest('[data-remove-filter]');
    const clearButton = event.target.closest('[data-clear-filters]');

    // A click outside an open filter closes it
    this.results.querySelectorAll('details[open]').forEach((details) => {
      if (!details.contains(event.target)) {
        details.removeAttribute('open');
      }
    });

    if (removeButton) {
      const name = removeButton.getAttribute('data-remove-filter');
      const value = removeButton.getAttribute('data-filter-value');
      const input = Array.from(this.#filtersForm.elements).find((element) => element.name === name && element.value === value);

      if (input) {
        input.checked = false;
      }

      this.#search(new FormData(this.#filtersForm));
    } else if (clearButton) {
      this.#search();
    }
  }

  async #search(filters = null) {
    const params = new URLSearchParams({
      q: this.input.value.trim(),
      type: 'product',
      'options[prefix]': 'last',
      section_id: 'sengefabrikken-search-results'
    });

    filters?.forEach((value, name) => params.append(name, value));

    this.#fetchAbortController?.abort();
    this.#fetchAbortController = new AbortController();

    document.documentElement.dispatchEvent(new CustomEvent('theme:loading:start', { bubbles: true }));

    try {
      const response = await fetch(`${window.Shopify.routes.root}search?${params.toString()}`, { signal: this.#fetchAbortController.signal });
      const html = new DOMParser().parseFromString(await response.text(), 'text/html');
      const section = html.querySelector('.shopify-section');

      if (section && this.input.value.trim() !== '') {
        this.results.replaceChildren(...Array.from(section.childNodes).map((node) => document.importNode(node, true)));
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        throw error;
      }
    } finally {
      document.documentElement.dispatchEvent(new CustomEvent('theme:loading:end', { bubbles: true }));
    }
  }
}

if (!window.customElements.get('sengefabrikken-search')) {
  window.customElements.define('sengefabrikken-search', SengefabrikkenSearch);
}
