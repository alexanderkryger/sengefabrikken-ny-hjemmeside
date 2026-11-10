/**
 * Sengefabrikken: <yotpo-reviews>
 *
 * Wraps the Yotpo reviews widget in the reviews drawer (see the yotpo-reviews-drawer snippet). The Yotpo script is heavy,
 * so it is only loaded the first time the drawer opens. If it is already on the page (e.g. loaded by the Yotpo app
 * embed), the widgets are refreshed instead so that the widget of the drawer is rendered.
 */
class YotpoReviews extends HTMLElement {
  #abortController;

  connectedCallback() {
    this.#abortController = new AbortController();
    this.closest('x-drawer')?.addEventListener('dialog:before-show', () => this.#load(), { signal: this.#abortController.signal });
  }

  disconnectedCallback() {
    this.#abortController.abort();
  }

  #load() {
    if (this.hasAttribute('loaded')) {
      return;
    }

    this.setAttribute('loaded', '');

    if (window.Yotpo?.API && window.yotpo) {
      new window.Yotpo.API(window.yotpo).refreshWidgets();
      return;
    }

    if (document.querySelector('script[src*="yotpo.com/"][src*="/widget.js"]')) {
      return; // The script is still loading and renders the widget itself
    }

    const script = document.createElement('script');
    script.src = `https://staticw2.yotpo.com/${this.getAttribute('app-key')}/widget.js`;
    script.async = true;
    document.head.append(script);
  }
}

if (!window.customElements.get('yotpo-reviews')) {
  window.customElements.define('yotpo-reviews', YotpoReviews);
}
