/**
 * Sengefabrikken: <seo-text>
 *
 * Shows the SEO text matching the active filters (see the seo-text section). The filters only re-render the main
 * collection section and update the URL, so the visible text is chosen again from the URL once the filters are loaded.
 * A text without filter value is shown when no other text matches.
 */
/**
 * Compares the values without "cm" and dots (eg. "180x200 cm." matches "180x200"). The values must be equal, so that
 * "180x200" does not match the text for "80x200".
 */
const normalizeValue = (value) => value.toLowerCase().replace(/cm/g, '').replace(/\./g, '').trim();

class SeoText extends HTMLElement {
  #abortController;

  connectedCallback() {
    this.#abortController = new AbortController();

    document.documentElement.addEventListener('theme:loading:end', () => this.#update(), { signal: this.#abortController.signal });
    window.addEventListener('popstate', () => this.#update(), { signal: this.#abortController.signal });

    // In the theme editor, the selected text is shown
    this.addEventListener('shopify:block:select', (event) => {
      this.querySelectorAll('.seo-text__item').forEach((item) => item.hidden = item !== event.target);
    }, { signal: this.#abortController.signal });
  }

  disconnectedCallback() {
    this.#abortController.abort();
  }

  #update() {
    if (window.Shopify?.designMode) {
      return;
    }

    const activeValues = [];

    new URLSearchParams(window.location.search).forEach((value, key) => {
      if (key.startsWith('filter.')) {
        activeValues.push(normalizeValue(value));
      }
    });

    const items = Array.from(this.querySelectorAll('.seo-text__item')),
      matchingItem = items.find((item) => item.dataset.filterValue !== '' && activeValues.includes(item.dataset.filterValue)),
      itemToShow = matchingItem || items.find((item) => item.dataset.filterValue === '');

    items.forEach((item) => item.hidden = item !== itemToShow);
  }
}

if (!window.customElements.get('seo-text')) {
  window.customElements.define('seo-text', SeoText);
}
