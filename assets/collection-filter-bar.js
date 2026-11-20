/**
 * Sengefabrikken: <collection-filter-bar>
 *
 * Sticky filter button of the collection page (see the collection-filter-bar snippet). Unlike the floating button of
 * the theme, which only shows up once the collection toolbar is scrolled past, it is always visible, and only hides
 * when the footer comes into view (so that it does not cover the footer).
 */
class CollectionFilterBar extends HTMLElement {
  #intersectionObserver;

  connectedCallback() {
    const footer = document.querySelector('.shopify-section--footer');

    this.classList.add('is-visible');

    if (!footer) {
      return;
    }

    this.#intersectionObserver = new IntersectionObserver(([entry]) => {
      this.classList.toggle('is-visible', !(entry.isIntersecting && entry.boundingClientRect.top < window.innerHeight));
    });

    this.#intersectionObserver.observe(footer);
  }

  disconnectedCallback() {
    this.#intersectionObserver?.disconnect();
  }
}

if (!window.customElements.get('collection-filter-bar')) {
  window.customElements.define('collection-filter-bar', CollectionFilterBar);
}
