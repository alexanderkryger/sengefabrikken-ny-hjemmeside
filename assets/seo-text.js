/**
 * Sengefabrikken: <seo-text>
 *
 * Shows the SEO text matching the active filters (see the seo-text section). The filters only re-render the main
 * collection section and update the URL, so the visible text is chosen again from the URL once the filters are loaded.
 * A text without filter value is shown when no other text matches.
 */
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
        activeValues.push(value.toLowerCase());
      }
    });

    const items = Array.from(this.querySelectorAll('.seo-text__item')),
      matchingItem = items.find((item) => item.dataset.filterValue !== '' && activeValues.some((value) => value.includes(item.dataset.filterValue))),
      itemToShow = matchingItem || items.find((item) => item.dataset.filterValue === '');

    items.forEach((item) => item.hidden = item !== itemToShow);
  }
}

if (!window.customElements.get('seo-text')) {
  window.customElements.define('seo-text', SeoText);
}
