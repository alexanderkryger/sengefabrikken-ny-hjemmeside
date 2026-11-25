/**
 * Sengefabrikken: <bed-comparison>
 *
 * Driver for the bed-comparison section. It shows a few of the models side by side (the "max-columns" attribute on
 * desktop, 2 on mobile), lets the customer remove a model (×) or pick the models in the drawer, and keeps the models
 * shown in the URL (?vis=1,3,4). Once the models are scrolled past, it shows a compact bar with their names.
 *
 * The theme moves the drawer to the end of the body, so the drawer is found by its ID (the "drawer" attribute).
 *
 * In the comparison popup of the collection page (bed-compare.js), the models come from the "selected" attribute instead
 * of the URL, the URL is left untouched, and removing a model fires "bed-comparison:change".
 */
class BedComparison extends HTMLElement {
  #abortController;
  #selected = [];
  #mobileQuery = window.matchMedia('(max-width: 699px)');

  connectedCallback() {
    this.#abortController = new AbortController();
    const { signal } = this.#abortController;

    const fromUrl = (this.getAttribute('selected') ?? new URLSearchParams(window.location.search).get('vis') ?? '').split(',').filter((model) => this.#models.includes(model));
    this.#selected = fromUrl.length > 0 ? fromUrl : this.#models;

    // Capture phase: the button of the drawer also closes it (<dialog-close-button>), which stops the click
    this.addEventListener('click', this.#onClick.bind(this), { signal });
    this.#drawer?.addEventListener('click', this.#onClick.bind(this), { capture: true, signal });
    this.#drawer?.addEventListener('change', this.#onPickChange.bind(this), { signal });
    this.#mobileQuery.addEventListener('change', () => this.#render(), { signal });

    this.#render();
    this.#observeStuck();
  }

  disconnectedCallback() {
    this.#abortController?.abort();
    this.#stuckObserver?.disconnect();
  }

  get #drawer() {
    return document.getElementById(this.getAttribute('drawer'));
  }

  get #pickInputs() {
    return Array.from(this.#drawer?.querySelectorAll('[data-pick-model]') || []);
  }

  get #models() {
    return Array.from(this.querySelectorAll('.bed-comparison__model'), (model) => model.getAttribute('data-model'));
  }

  get #maxColumns() {
    return this.#mobileQuery.matches ? 2 : parseInt(this.getAttribute('max-columns'), 10) || 3;
  }

  get #visible() {
    return this.#selected.slice(0, this.#maxColumns);
  }

  #onClick(event) {
    // Before the drawer is moved to the body, its clicks reach both listeners
    if (event.currentTarget === this && this.#drawer?.contains(event.target)) {
      return;
    }

    const removeButton = event.target.closest('[data-remove-model]');

    if (removeButton) {
      this.#selected = this.#visible.filter((model) => model !== removeButton.getAttribute('data-remove-model'));
      this.#render({ updateUrl: true });
      this.dispatchEvent(new CustomEvent('bed-comparison:change', { bubbles: true, detail: { models: this.#visible } }));
    } else if (event.target.closest('[data-apply-models]')) {
      const picked = this.#pickInputs.filter((input) => input.checked).map((input) => input.value);

      if (picked.length > 0) {
        this.#selected = picked;
        this.#render({ updateUrl: true });
        this.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  // Not more models than columns can be picked
  #onPickChange(event) {
    if (!event.target.matches('[data-pick-model]')) {
      return;
    }

    this.#updatePickLimit();
  }

  #updatePickLimit() {
    const inputs = this.#pickInputs;
    const full = inputs.filter((input) => input.checked).length >= this.#maxColumns;

    inputs.forEach((input) => input.disabled = full && !input.checked);

    const hint = this.#drawer?.querySelector('[data-pick-hint]');

    if (hint) {
      hint.textContent = `Vælg op til ${this.#maxColumns} modeller.`;
    }
  }

  #render({ updateUrl = false } = {}) {
    const visible = this.#visible;

    this.querySelectorAll('[data-model]').forEach((element) => {
      const index = visible.indexOf(element.getAttribute('data-model'));
      element.hidden = index === -1;
      element.style.order = index;
    });

    // Only one model left: it cannot be removed
    this.querySelectorAll('[data-remove-model]').forEach((button) => button.hidden = visible.length <= 1);

    // An empty column to add a model, when there are fewer models than columns
    const addButton = this.querySelector('.bed-comparison__add');
    const canAdd = Boolean(addButton) && visible.length < Math.min(this.#maxColumns, this.#models.length);

    if (addButton) {
      addButton.hidden = !canAdd;
    }

    const compactAdd = this.querySelector('.bed-comparison__compact-add');

    if (compactAdd) {
      compactAdd.hidden = !canAdd;
    }

    this.style.setProperty('--bed-comparison-columns', visible.length + (canAdd ? 1 : 0));

    this.#pickInputs.forEach((input) => input.checked = visible.includes(input.value));
    this.#updatePickLimit();

    if (updateUrl && !this.hasAttribute('selected')) {
      const url = new URL(window.location.href);
      url.searchParams.set('vis', visible.join(','));
      history.replaceState(history.state, '', url.toString());
    }
  }

  // The compact bar is shown once the models are scrolled past (behind the header)
  #stuckObserver;

  #observeStuck() {
    const models = this.querySelector('.bed-comparison__models');

    if (!models) {
      return;
    }

    // The header (--sticky-area-height) hides the top of the page. In a modal, the body of the modal scrolls
    const modalBody = this.closest('x-modal')?.shadowRoot?.querySelector('[part="body"]');
    const stickyAreaHeight = modalBody ? 0 : parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sticky-area-height'), 10) || 0;

    this.#stuckObserver = new IntersectionObserver(([entry]) => {
      this.classList.toggle('is-stuck', !entry.isIntersecting && entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0));
    }, { root: modalBody || null, rootMargin: `-${stickyAreaHeight + 1}px 0px 0px 0px` });

    this.#stuckObserver.observe(models);
  }
}

if (!window.customElements.get('bed-comparison')) {
  window.customElements.define('bed-comparison', BedComparison);
}

