/**
 * Sengefabrikken: <bed-comparison>
 *
 * Driver for the bed-comparison section. It shows a few of the models side by side (the "max-columns" attribute on
 * desktop, 2 on mobile), lets the customer remove a model (×) or pick the models in the drawer, and keeps the models
 * shown in the URL (?vis=1,3,4). It also marks the row of the models as stuck, to show it in a compact way.
 */
class BedComparison extends HTMLElement {
  #abortController;
  #selected = [];
  #mobileQuery = window.matchMedia('(max-width: 699px)');

  connectedCallback() {
    this.#abortController = new AbortController();
    const { signal } = this.#abortController;

    const fromUrl = (new URLSearchParams(window.location.search).get('vis') || '').split(',').filter((model) => this.#models.includes(model));
    this.#selected = fromUrl.length > 0 ? fromUrl : this.#models;

    this.addEventListener('click', this.#onClick.bind(this), { signal });
    this.addEventListener('change', this.#onPickChange.bind(this), { signal });
    this.#mobileQuery.addEventListener('change', () => this.#render(), { signal });

    this.#render();
    this.#observeStuck();
  }

  disconnectedCallback() {
    this.#abortController?.abort();
    this.#stuckObserver?.disconnect();
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
    const removeButton = event.target.closest('[data-remove-model]');

    if (removeButton) {
      this.#selected = this.#visible.filter((model) => model !== removeButton.getAttribute('data-remove-model'));
      this.#render({ updateUrl: true });
    } else if (event.target.closest('[data-apply-models]')) {
      const picked = Array.from(this.querySelectorAll('[data-pick-model]:checked'), (input) => input.value);

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
    const inputs = Array.from(this.querySelectorAll('[data-pick-model]'));
    const full = inputs.filter((input) => input.checked).length >= this.#maxColumns;

    inputs.forEach((input) => input.disabled = full && !input.checked);

    const hint = this.querySelector('[data-pick-hint]');

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
    const canAdd = visible.length < Math.min(this.#maxColumns, this.#models.length);

    if (addButton) {
      addButton.hidden = !canAdd;
    }

    this.style.setProperty('--bed-comparison-columns', visible.length + (canAdd ? 1 : 0));

    this.querySelectorAll('[data-pick-model]').forEach((input) => input.checked = visible.includes(input.value));
    this.#updatePickLimit();

    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set('vis', visible.join(','));
      history.replaceState(history.state, '', url.toString());
    }
  }

  // The row of the models is compact once it sticks below the header
  #stuckObserver;

  #observeStuck() {
    const sentinel = this.querySelector('.bed-comparison__sentinel');

    if (!sentinel) {
      return;
    }

    // The row sticks below the header (--sticky-area-height), so the sentinel leaves an area of the same height
    const stickyAreaHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sticky-area-height'), 10) || 0;

    this.#stuckObserver = new IntersectionObserver(([entry]) => {
      this.classList.toggle('is-stuck', !entry.isIntersecting && entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0));
    }, { rootMargin: `-${stickyAreaHeight + 1}px 0px 0px 0px` });

    this.#stuckObserver.observe(sentinel);
  }
}

if (!window.customElements.get('bed-comparison')) {
  window.customElements.define('bed-comparison', BedComparison);
}
