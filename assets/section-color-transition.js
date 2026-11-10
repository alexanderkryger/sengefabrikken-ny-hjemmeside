/**
 * Sengefabrikken: <section-color-transition>
 *
 * Instead of a hard edge between two sections with different background colors, the whole page fades into the
 * background color of a section once enough of it is visible (theme settings > Sengefabrikken layout).
 * The colors are read from the color scheme of each section in #main, and #main takes the color of the active section.
 * Only the sections that enable it ("Glidende farveskift" setting, data-color-transition attribute) become transparent
 * and fade; the other sections keep their own color and hard edge, but still give their color to the neighboring
 * sections that fade. Sections without a color scheme directly inside them do not change the page color, and elements
 * with manual colors (e.g. the specifications box) keep theirs.
 * Without JavaScript the page is shown as usual, and the fade is skipped when the visitor prefers reduced motion.
 * The fade duration (in ms) can be set with the "duration" attribute, and how much of a section must be visible (in %)
 * with the "threshold" attribute (80 by default).
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

    // Nothing fades unless at least one section has enabled the transition
    if (!main.querySelector(':scope > .shopify-section > .color-scheme[data-color-transition]')) {
      return;
    }

    main.style.setProperty('--section-color-transition-background', this.#colors.values().next().value);

    if (this.hasAttribute('duration')) {
      main.style.setProperty('--section-color-transition-duration', `${this.getAttribute('duration')}ms`);
    }

    main.classList.add('has-section-color-transition');

    // A section becomes active once enough of it is visible. A section taller than the screen can never be fully
    // visible, so the visible part is compared to the screen height instead of the section height.
    const threshold = (parseInt(this.getAttribute('threshold')) || 80) / 100;
    const visibility = new Map();

    this.#observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const viewportHeight = entry.rootBounds?.height || window.innerHeight;
        const visibleHeight = entry.isIntersecting ? entry.intersectionRect.height : 0;
        visibility.set(entry.target, visibleHeight / Math.min(entry.boundingClientRect.height, viewportHeight));
      });

      let activeSection = null;

      visibility.forEach((ratio, section) => {
        if (ratio >= threshold && (!activeSection || ratio > visibility.get(activeSection))) {
          activeSection = section;
        }
      });

      if (activeSection) {
        main.style.setProperty('--section-color-transition-background', this.#colors.get(activeSection));
      }
    }, { threshold: Array.from({ length: 101 }, (_, index) => index / 100) });

    this.#colors.forEach((color, section) => this.#observer.observe(section));
  }
}

if (!window.customElements.get('section-color-transition')) {
  window.customElements.define('section-color-transition', SectionColorTransition);
}
