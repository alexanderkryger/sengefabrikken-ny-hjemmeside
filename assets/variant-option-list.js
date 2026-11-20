/**
 * Sengefabrikken: <variant-option-list>
 *
 * The values of a variant picker option shown in a drawer (variant-picker snippet, "drawer" selector style).
 *
 * Choosing a value closes the drawer. The theme renders the variant picker again on each change, with new drawers,
 * while the drawer that is open has been moved to the body: that old drawer is removed once closed, so that it neither
 * stays open with no value selected nor shadows the new drawer (same ID).
 */
class VariantOptionList extends HTMLElement {
  #abortController;

  connectedCallback() {
    this.#abortController = new AbortController();
    this.addEventListener('change', this.#onChange.bind(this), { signal: this.#abortController.signal });

    this.#removeOldDrawers();
  }

  disconnectedCallback() {
    this.#abortController?.abort();
  }

  get #drawer() {
    return this.closest('x-drawer');
  }

  #onChange() {
    this.#drawer?.hide();
  }

  #removeOldDrawers() {
    const drawer = this.#drawer;

    if (!drawer?.id) {
      return;
    }

    document.querySelectorAll(`x-drawer[id="${CSS.escape(drawer.id)}"]`).forEach((oldDrawer) => {
      if (oldDrawer === drawer) {
        return;
      }

      if (oldDrawer.hasAttribute('open')) {
        oldDrawer.addEventListener('dialog:after-hide', () => oldDrawer.remove(), { once: true });
      } else {
        oldDrawer.remove();
      }
    });
  }
}

if (!window.customElements.get('variant-option-list')) {
  window.customElements.define('variant-option-list', VariantOptionList);
}
