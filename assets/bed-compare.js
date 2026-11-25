/**
 * Sengefabrikken: <bed-compare>
 *
 * Comparison of the products of a collection (see the bed-compare snippet). The comparison page (the "page-url"
 * attribute) is fetched once: its models are matched to the cards by product type, so only the cards of a model in the
 * comparison get the "Sammenlign" checkbox. When the models share their product type (eg. the topmadrasser, all
 * "Topmadras"), they are matched by handle instead, without the size and "split" (komfort-splittopmadras-180x200-cm and
 * komfort-topmadras-90x200-cm are both the "komfort-topmadras" model). The chosen models are kept in the session (across pages and filters) and
 * shown in a bar; "Sammenlign" opens the bed-comparison section of the page in a popup, with the chosen models.
 */
const STORAGE_KEY = 'sengefabrikken-bed-compare';

class BedCompare extends HTMLElement {
  #abortController;
  #selected = [];
  #models = new Map(); // product type (or handle without size) => { index, title }
  #matchByHandle = false;
  #comparison = null;
  #mobileQuery = window.matchMedia('(max-width: 699px)');
  #mutationObserver;

  connectedCallback() {
    this.#abortController = new AbortController();
    const { signal } = this.#abortController;

    this.#selected = this.#readStorage();

    document.addEventListener('change', this.#onChange.bind(this), { signal });
    this.addEventListener('click', this.#onClick.bind(this), { signal });
    this.addEventListener('bed-comparison:change', this.#onComparisonChange.bind(this), { signal });
    this.#mobileQuery.addEventListener('change', () => this.#update(), { signal });

    // The product list is rendered again when filtering or sorting
    this.#mutationObserver = new MutationObserver(() => this.#syncCards());
    this.#mutationObserver.observe(this.closest('.shopify-section') || document.body, { childList: true, subtree: true });

    this.#loadComparison().then(() => this.#update());
  }

  disconnectedCallback() {
    this.#abortController?.abort();
    this.#mutationObserver?.disconnect();
  }

  get #maxModels() {
    return this.#mobileQuery.matches ? 2 : 3;
  }

  get #storageKey() {
    return `${STORAGE_KEY}:${this.getAttribute('page-url')}`;
  }

  #readStorage() {
    try {
      return JSON.parse(sessionStorage.getItem(this.#storageKey)) || [];
    } catch (error) {
      return [];
    }
  }

  #writeStorage() {
    try {
      sessionStorage.setItem(this.#storageKey, JSON.stringify(this.#selected));
    } catch (error) {
      // The selection is then only kept on this page
    }
  }

  async #loadComparison() {
    try {
      const html = await (await fetch(this.getAttribute('page-url'))).text();
      const comparison = new DOMParser().parseFromString(html, 'text/html').querySelector('bed-comparison');

      if (!comparison) {
        return;
      }

      // The popup only shows the chosen models: no drawer to change them, no bar for a new comparison
      comparison.querySelectorAll('x-drawer, .bed-comparison__bar, .bed-comparison__add, .bed-comparison__compact-add, [aria-controls^="bed-comparison-drawer"]').forEach((element) => element.remove());
      comparison.removeAttribute('drawer');

      const models = Array.from(comparison.querySelectorAll('.bed-comparison__model'));
      const types = models.map((model) => model.getAttribute('data-model-type'));
      this.#matchByHandle = new Set(types).size < types.length;

      models.forEach((model) => {
        const type = this.#keyOf(model.getAttribute('data-model-type'), model.getAttribute('data-model-handle'));

        if (type && !this.#models.has(type)) {
          this.#models.set(type, {
            index: model.getAttribute('data-model'),
            title: model.querySelector('.bed-comparison__model-title')?.textContent.trim() || type
          });
        }
      });

      // Without the color scheme of the section: the comparison takes the colors of the popup
      this.#comparison = comparison;
      this.#selected = this.#selected.filter((type) => this.#models.has(type));
    } catch (error) {
      // Without the comparison page, the cards keep their checkbox hidden
    }
  }

  #keyOf(type, handle) {
    if (!this.#matchByHandle) {
      return type;
    }

    return (handle || '').replace(/-\d+x\d+(-cm)?$/, '').replace('-split', '-');
  }

  #inputKey(input) {
    return this.#keyOf(input.getAttribute('data-compare-type'), input.getAttribute('data-compare-handle'));
  }

  #onChange(event) {
    const input = event.target.closest?.('[data-compare-type]');

    if (!input) {
      return;
    }

    const type = this.#inputKey(input);
    this.#selected = this.#selected.filter((selectedType) => selectedType !== type);

    if (input.checked) {
      this.#selected.push(type);
    }

    this.#update();
  }

  #onClick(event) {
    const removeButton = event.target.closest('[data-compare-remove]');

    if (removeButton) {
      this.#selected = this.#selected.filter((type) => type !== removeButton.getAttribute('data-compare-remove'));
      this.#update();
    } else if (event.target.closest('[data-compare-clear]')) {
      this.#selected = [];
      this.#update();
    } else if (event.target.closest('[data-compare-open]')) {
      this.#open();
    }
  }

  // A model removed in the popup
  #onComparisonChange(event) {
    const indexes = event.detail.models;
    this.#selected = this.#selected.filter((type) => indexes.includes(this.#models.get(type)?.index));
    this.#update();
  }

  #update() {
    this.#selected = this.#selected.slice(0, 3);
    this.#writeStorage();
    this.#syncCards();
    this.#renderBar();
  }

  #syncCards() {
    const full = this.#selected.length >= this.#maxModels;

    document.querySelectorAll('[data-compare-type]').forEach((input) => {
      const type = this.#inputKey(input);
      const toggle = input.closest('[data-compare-toggle]');

      if (toggle) {
        toggle.hidden = !this.#models.has(type);
      }

      input.checked = this.#selected.includes(type);
      input.disabled = full && !input.checked;
    });
  }

  #renderBar() {
    const bar = this.querySelector('.bed-compare__bar');
    const items = this.querySelector('[data-compare-items]');
    const openButton = this.querySelector('[data-compare-open]');
    const hint = this.querySelector('[data-compare-hint]');
    const count = Math.min(this.#selected.length, this.#maxModels);

    bar.hidden = this.#selected.length === 0;

    items.replaceChildren(...this.#selected.map((type) => {
      const item = document.createElement('span');
      const button = document.createElement('button');

      item.className = 'bed-compare__item text-sm';
      item.textContent = this.#models.get(type)?.title || type;

      button.type = 'button';
      button.className = 'bed-compare__remove';
      button.setAttribute('data-compare-remove', type);
      button.setAttribute('aria-label', `Fjern ${item.textContent} fra sammenligningen`);
      button.textContent = '×';

      item.append(button);
      return item;
    }));

    openButton.disabled = count < 2;
    openButton.textContent = `Sammenlign (${count})`;
    hint.textContent = count < 2 ? 'Vælg mindst 2 modeller' : `Op til ${this.#maxModels} modeller`;
  }

  #open() {
    if (!this.#comparison) {
      return;
    }

    const content = this.#comparison.cloneNode(true);
    const indexes = this.#selected.slice(0, this.#maxModels).map((type) => this.#models.get(type)?.index).filter(Boolean);

    content.setAttribute('selected', indexes.join(','));

    this.querySelector('[data-compare-content]').replaceChildren(content);
    this.querySelector('#bed-compare-modal').show();
  }
}

if (!window.customElements.get('bed-compare')) {
  window.customElements.define('bed-compare', BedCompare);
}

