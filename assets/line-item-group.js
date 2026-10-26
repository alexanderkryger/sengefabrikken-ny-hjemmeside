/**
 * Sengefabrikken: <line-item-group>
 *
 * Wraps the main line of a product group in the cart (see the line-item-group snippet). Quantity changes and removal
 * done on the main line are applied to every line of the group in a single request, instead of only the line handled
 * by the theme's <line-item>. The listeners use the capture phase so that the <line-item> inside never receives them,
 * and the same events as <line-item> are dispatched afterwards so that the cart drawer and cart count update as usual.
 */
class LineItemGroup extends HTMLElement {
  #abortController;

  connectedCallback() {
    this.#abortController = new AbortController();

    const { signal } = this.#abortController;

    this.addEventListener('change', this.#onQuantityChange.bind(this), { capture: true, signal });
    this.addEventListener('click', this.#onChangeLinkClick.bind(this), { capture: true, signal });
  }

  disconnectedCallback() {
    this.#abortController.abort();
  }

  get lineKeys() {
    return this.getAttribute('line-keys').split(',');
  }

  #onQuantityChange(event) {
    if (!event.target.matches('[data-line-key]')) {
      return;
    }

    event.stopPropagation();
    this.#changeQuantity(parseInt(event.target.value));
  }

  #onChangeLinkClick(event) {
    const link = event.target.closest(`a[href*="${Shopify.routes.root}cart/change"]`);

    if (!link) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.#changeQuantity(parseInt(new URL(link.href).searchParams.get('quantity')));
  }

  async #changeQuantity(quantity) {
    document.documentElement.dispatchEvent(new CustomEvent('theme:loading:start', { bubbles: true }));

    const lineItem = this.querySelector('line-item');
    lineItem?.dispatchEvent(new CustomEvent('line-item:will-change', { bubbles: true, detail: { targetQuantity: quantity } }));

    const sectionsToBundle = new Set();
    document.documentElement.dispatchEvent(new CustomEvent('cart:prepare-bundled-sections', { bubbles: true, detail: { sections: sectionsToBundle } }));

    const response = await fetch(`${Shopify.routes.root}cart/update.js`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        updates: Object.fromEntries(this.lineKeys.map((lineKey) => [lineKey, quantity])),
        sections: [...sectionsToBundle].join(',')
      })
    });

    document.documentElement.dispatchEvent(new CustomEvent('theme:loading:end', { bubbles: true }));

    const responseContent = await response.json();

    if (!response.ok) {
      const errorContainer = this.querySelector('.line-item__error-container');

      if (errorContainer) {
        errorContainer.innerHTML = `<p class="h-stack gap-1.5 text-sm text-error" role="alert">${responseContent['description']}</p>`;
      }

      this.querySelector('quantity-selector')?.restoreDefaultValue();
      return;
    }

    if (window.themeVariables.settings.pageType === 'cart') {
      return window.location.reload();
    }

    lineItem?.dispatchEvent(new CustomEvent('line-item:change', {
      bubbles: true,
      detail: {
        quantity,
        cart: responseContent
      }
    }));

    document.documentElement.dispatchEvent(new CustomEvent('cart:change', {
      bubbles: true,
      detail: {
        baseEvent: 'line-item:change',
        cart: responseContent
      }
    }));
  }
}

if (!window.customElements.get('line-item-group')) {
  window.customElements.define('line-item-group', LineItemGroup);
}
