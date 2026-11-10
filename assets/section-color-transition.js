/**
 * Sengefabrikken: <section-color-transition>
 *
 * Instead of a hard edge between two sections with different background colors, the whole page fades into the
 * background color of the section that reaches the middle of the screen (theme settings > Sengefabrikken layout).
 * The colors are read from the color scheme of each section in #main, then those sections become transparent and
 * #main takes the color of the active section. Sections without a color scheme directly inside them keep their own
 * colors and do not change the page color, and elements with manual colors (e.g. the specifications box) keep theirs.
 * Without JavaScript the page is shown as usual, and the fade is skipped when the visitor prefers reduced motion.
 * The fade duration (in ms) can be set with the "duration" attribute.
 */
class SectionColorTransition extends HTMLElement {
  #abortController;
  #observer;
  #colors = new Map();

  connectedCallback() {
    this.#abortController = new AbortController();
    const signal = this.#abortController.signal;

    // Sections are re-rendered in the theme editor, so their colors must be read again
    document.addEventListener('shopify:section:load', () => this.#setup(), { signal });
    document.addEventListener('shopify:section:unload', () => setTimeout(() => this.#setup()), { signal });
    document.addEventListener('shopify:section:reorder', () => this.#setup(), { signal });

    this.#setup();
  }

  disconnectedCallback() {
    this.#abortController.abort();
    this.#observer?.disconnect();
    this.#main?.classList.remove('has-section-color-transition');
  }

  get #main() {
    return document.getElementById('main');
  }

  #setup() {
    const main = this.#main;

    if (!main) {
      return;
    }

    this.#observer?.disconnect();
    this.#colors.clear();

    // The sections must show their real background to read it
    main.classList.remove('has-section-color-transition');

    for (const section of main.querySelectorAll(':scope > .shopify-section')) {
      const surface = section.querySelector(':scope > .color-scheme');

      if (surface) {
        this.#colors.set(section, getComputedStyle(surface).backgroundColor);
      }
    }

    if (this.#colors.size === 0) {
      return;
    }

    main.style.setProperty('--section-color-transition-background', this.#colors.values().next().value);

    if (this.hasAttribute('duration')) {
      main.style.setProperty('--section-color-transition-duration', `${this.getAttribute('duration')}ms`);
    }

    main.classList.add('has-section-color-transition');

    // The active section is the one crossing the horizontal line in the middle of the screen
    this.#observer = new IntersectionObserver((entries) => {
      const entry = entries.find((entry) => entry.isIntersecting);

      if (entry) {
        main.style.setProperty('--section-color-transition-background', this.#colors.get(entry.target));
      }
    }, { rootMargin: '-50% 0px -50% 0px' });

    this.#colors.forEach((color, section) => this.#observer.observe(section));
  }
}

if (!window.customElements.get('section-color-transition')) {
  window.customElements.define('section-color-transition', SectionColorTransition);
}
