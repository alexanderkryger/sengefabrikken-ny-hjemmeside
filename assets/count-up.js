/**
 * Sengefabrikken: <count-up value="2995" decimals="0">
 *
 * Counts a number up from 0 the first time it scrolls into view, formatted the Danish way (2.995 / 1,44). The final
 * number is rendered by Liquid, so it is shown as is when JavaScript is off or the visitor prefers reduced motion.
 * The duration (in ms) can be set with the "duration" attribute.
 * With the "product-price" attribute, the number follows the price of the selected variant.
 */
class CountUp extends HTMLElement {
  #abortController;
  #observer;

  connectedCallback() {
    this.#abortController = new AbortController();

    if (this.hasAttribute('product-price')) {
      document.addEventListener('variant:change', (event) => {
        if (event.detail.variant) {
          this.setAttribute('value', event.detail.variant.price / 100);
          this.textContent = this.#format(event.detail.variant.price / 100);
        }
      }, { signal: this.#abortController.signal });
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    this.textContent = this.#format(0);

    this.#observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        this.#observer.disconnect();
        this.#animate();
      }
    }, { threshold: 0.5 });

    this.#observer.observe(this);
  }

  disconnectedCallback() {
    this.#abortController.abort();
    this.#observer?.disconnect();
  }

  get #value() {
    return parseFloat(this.getAttribute('value')) || 0;
  }

  get #decimals() {
    return parseInt(this.getAttribute('decimals')) || 0;
  }

  #format(number) {
    return new Intl.NumberFormat('da-DK', { minimumFractionDigits: this.#decimals, maximumFractionDigits: this.#decimals }).format(number);
  }

  #animate() {
    const duration = parseInt(this.getAttribute('duration')) || 1500,
      target = this.#value,
      start = performance.now();

    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1),
        eased = 1 - Math.pow(1 - progress, 3);

      this.textContent = this.#format(target * eased);

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  }
}

if (!window.customElements.get('count-up')) {
  window.customElements.define('count-up', CountUp);
}
