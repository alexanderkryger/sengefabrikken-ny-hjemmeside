/**
 * Sengefabrikken: <custom-size-form>
 *
 * Driver for the "custom_size" product block (Specialmål, see the product-info snippet).
 *
 * The customer types a width and a length. The element validates them against the min/max/step of the product, shows
 * the computed price (same formula as the n8n workflow, which is the source of truth) and updates the price of the price
 * block and of the title. On submit, the size is resolved to a real variant BEFORE the <product-form> of the theme adds
 * it to the cart:
 *
 *   submit (capture) → POST endpoint { product_id, width, length }
 *                    → { variant_id } → form.id = variant_id → requestSubmit()
 *
 * The submit listener sits on document in the capture phase, so that it always runs before the listener of the
 * product form, without touching theme.js.
 *
 * When each firmness is its own product (see the product-firmness snippet), the links to the other firmnesses carry the
 * typed size (?width=…&length=…), and the size is filled in again from the URL on the other product.
 */
class CustomSizeForm extends HTMLElement {
  #abortController;
  #config;
  #originalPrices = [];
  #resolved = false;

  connectedCallback() {
    if (!this.form) {
      return;
    }

    this.#abortController = new AbortController();
    this.#config = JSON.parse(this.querySelector('script[type="application/json"]').textContent);
    this.#originalPrices = this.#salePriceElements.map((element) => element.innerHTML);

    const { signal } = this.#abortController;

    this.addEventListener('input', this.#update.bind(this), { signal });
    document.addEventListener('submit', this.#onSubmit.bind(this), { capture: true, signal });

    const searchParams = new URLSearchParams(window.location.search);
    this.#widthInput.value ||= searchParams.get('width') ?? '';
    this.#lengthInput.value ||= searchParams.get('length') ?? '';

    this.#update();
  }

  disconnectedCallback() {
    this.#abortController?.abort();
  }

  get form() {
    return document.getElementById(this.getAttribute('form'));
  }

  get #widthInput() {
    return this.querySelector('[data-size-width]');
  }

  get #lengthInput() {
    return this.querySelector('[data-size-length]');
  }

  get #salePriceElements() {
    const productInfo = this.closest('.product-info');
    return Array.from(productInfo?.querySelectorAll('[data-block-type="price"] sale-price, [data-block-type="title"] sale-price') || []);
  }

  get #size() {
    return {
      width: parseInt(this.#widthInput.value, 10),
      length: parseInt(this.#lengthInput.value, 10)
    };
  }

  /**
   * Sets a custom validity message on a single input and returns whether it is valid
   */
  #validate(input) {
    const { min, step, strings } = this.#config;
    const max = parseInt(input.max, 10) || this.#config.max; // The width and the length can have their own maximum
    const value = parseInt(input.value, 10);
    let message = '';

    if (input.value === '' || Number.isNaN(value)) {
      message = strings.required;
    } else if (value < min || value > max) {
      message = strings.range.replace('@min@', min).replace('@max@', max);
    } else if (value % step !== 0) {
      message = strings.step.replace('@step@', step);
    }

    input.setCustomValidity(message);

    return message === '';
  }

  /**
   * Recomputes the price and updates the summary and the prices of the product. Returns whether both inputs are valid.
   */
  #update() {
    const widthValid = this.#validate(this.#widthInput);
    const lengthValid = this.#validate(this.#lengthInput);
    const summaryElement = this.querySelector('[data-size-summary]');
    const priceElement = this.querySelector('[data-size-price]');

    this.#updateKeepSizeLinks(widthValid && lengthValid);

    if (!widthValid || !lengthValid) {
      summaryElement.textContent = this.#config.strings.empty;
      priceElement.textContent = '';
      this.#salePriceElements.forEach((element, index) => element.innerHTML = this.#originalPrices[index] ?? element.innerHTML);

      return false;
    }

    const { width, length } = this.#size;
    const formattedPrice = formatMoney(calculatePrice(width, length, this.#config.pricing) * 100);

    summaryElement.textContent = `${width} x ${length} cm`;
    priceElement.textContent = formattedPrice;

    this.#salePriceElements.forEach((element) => {
      Array.from(element.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE).forEach((node) => node.remove());
      element.append(formattedPrice);
    });

    return true;
  }

  /**
   * Adds the typed size to the links to the other firmnesses, or removes it when the size is not valid
   */
  #updateKeepSizeLinks(valid) {
    this.querySelectorAll('a[data-keep-size]').forEach((link) => {
      const url = new URL(link.href, window.location.origin);

      if (valid) {
        url.searchParams.set('width', this.#size.width);
        url.searchParams.set('length', this.#size.length);
      } else {
        url.searchParams.delete('width');
        url.searchParams.delete('length');
      }

      link.href = url.toString();
    });
  }

  async #onSubmit(event) {
    // Read the attribute, as "form.id" returns the input named "id" of the product form
    if (event.target?.getAttribute?.('id') !== this.getAttribute('form')) {
      return;
    }

    // Second pass: the variant has been resolved, the product form does its normal add to cart
    if (this.#resolved) {
      this.#resolved = false;
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    if (!this.#update()) {
      this.form.reportValidity();
      return;
    }

    const submitButtons = Array.from(this.form.elements).filter((element) => element.type === 'submit');
    submitButtons.forEach((submitButton) => submitButton.setAttribute('aria-busy', 'true'));

    document.documentElement.dispatchEvent(new CustomEvent('theme:loading:start', { bubbles: true }));

    try {
      const { width, length } = this.#size;
      const response = await fetch(this.#config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: this.#config.productId, width, length })
      });
      const responseJson = await response.json().catch(() => ({}));

      if (!response.ok || !responseJson['variant_id']) {
        throw new Error(responseJson['error'] || this.#config.strings.error);
      }

      this.form.elements.namedItem('id').value = responseJson['variant_id'];
      this.#resolved = true;
    } catch (error) {
      this.form.dispatchEvent(new CustomEvent('cart:error', { bubbles: true, detail: { error: error.message } }));
      document.dispatchEvent(new CustomEvent('toast:show', { detail: { message: error.message, tone: 'error' } }));
    } finally {
      submitButtons.forEach((submitButton) => submitButton.removeAttribute('aria-busy'));
      document.documentElement.dispatchEvent(new CustomEvent('theme:loading:end', { bubbles: true }));
    }

    if (this.#resolved) {
      this.form.requestSubmit(event.submitter); // The product form takes over from here
    }
  }
}

/**
 * Price formula. Must stay identical to the n8n workflow. Returns whole kroner: base + m² × rate, rounded up to the
 * nearest x90, never below the minimum price.
 */
function calculatePrice(width, length, pricing) {
  const raw = pricing.base + (width * length / 10000) * pricing.perM2;
  const rounded = Math.ceil((raw + 10) / 100) * 100 - 10;
  return Math.max(rounded, pricing.min);
}

// The prices are whole kroner: like the "money_without_trailing_zeros" filter, the decimals are removed
function formatMoney(cents) {
  const settings = window.themeVariables.settings;
  const format = settings.currencyCodeEnabled ? settings.moneyWithCurrencyFormat : settings.moneyFormat;

  return format.replace(/\{\{\s*(\w+)\s*\}\}/, (match, placeholder) => {
    const amount = Math.round(cents / 100).toString();
    const thousands = /comma_separator/.test(placeholder) ? '.' : (/space_separator/.test(placeholder) ? ' ' : (/apostrophe/.test(placeholder) ? "'" : ','));

    return amount.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
  });
}

if (!window.customElements.get('custom-size-form')) {
  window.customElements.define('custom-size-form', CustomSizeForm);
}
