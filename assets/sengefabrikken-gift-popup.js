/**
 * Sengefabrikken: <gift-popup-value>
 *
 * The value of the gift in the gift popup (see the gift-popup snippet). When a button opening the popup is clicked
 * (eg. "Se gaver" on a product card), "[værdi]" in the template is replaced by the value of the gift of that product
 * ("data-gift-value" attribute). The element is hidden when the clicked button has no value.
 */
class GiftPopupValue extends HTMLElement {
  #abortController;

  connectedCallback() {
    this.#abortController = new AbortController();

    document.addEventListener('click', (event) => {
      const button = event.target.closest('[aria-controls="gift-popup"]');

      if (!button) {
        return;
      }

      const value = button.getAttribute('data-gift-value');
      this.hidden = !value;
      this.textContent = value ? this.getAttribute('template').replace('[værdi]', value) : '';
    }, { capture: true, signal: this.#abortController.signal });
  }

  disconnectedCallback() {
    this.#abortController.abort();
  }
}

if (!window.customElements.get('gift-popup-value')) {
  window.customElements.define('gift-popup-value', GiftPopupValue);
}
