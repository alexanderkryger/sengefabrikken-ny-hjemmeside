/**
 * Sengefabrikken: <product-group>
 *
 * Connects the products from the "custom.group" metafield to the main product form:
 * - when the form is submitted, every group item needing a choice must have a variant selected
 * - the main product and the group items are added to the cart in a single request, linked through the "main" and
 *   "_ref" line item properties ("_group_main" marks the main product line, see the line-item-group snippet)
 * - the price block shows the total of the main variant and the selected group items
 *
 * The theme's <product-form> builds its request with `new FormData(form)`, so the items are added by listening to the
 * "formdata" event. Listeners are set on the document (capture phase) as the form is re-rendered on variant change.
 */
class ProductGroup extends HTMLElement {
  #abortController;
  #mainVariant;

  connectedCallback() {
    this.#abortController = new AbortController();
    this.#mainVariant = {
      price: parseInt(this.getAttribute('main-price')),
      compare_at_price: parseInt(this.getAttribute('main-compare-at-price'))
    };

    const { signal } = this.#abortController;

    // The theme's drawers are moved to the body while open, so the inputs are not always inside this element
    document.addEventListener('change', this.#onItemChange.bind(this), { signal });
    document.addEventListener('submit', this.#onSubmit.bind(this), { capture: true, signal });
    document.addEventListener('formdata', this.#onFormData.bind(this), { capture: true, signal });
    document.addEventListener('variant:change', this.#onVariantChange.bind(this), { signal });

    this.#updatePrice();
  }

  disconnectedCallback() {
    this.#abortController.abort();
  }

  get formId() {
    return this.getAttribute('form-id');
  }

  get items() {
    return Array.from(this.querySelectorAll('[data-group-item]'));
  }

  #isProductForm(form) {
    // Read the attribute, as "form.id" returns the input named "id" of the product form
    return form?.getAttribute?.('id') === this.formId;
  }

  #getSelectedInput(item) {
    return document.querySelector(`input[name="${item.getAttribute('data-input-name')}"]:checked`);
  }

  #onItemChange(event) {
    const inputName = event.target.getAttribute('name');
    const item = inputName ? this.querySelector(`[data-group-item][data-input-name="${inputName}"]`) : null;

    if (!item) {
      return;
    }

    item.querySelector('[data-group-item-value]').textContent = event.target.getAttribute('data-label');
    item.querySelector('[data-group-item-check]').hidden = false;
    item.querySelector('[data-group-item-error]').hidden = true;

    this.#updatePrice();
  }

  #onVariantChange(event) {
    if (!this.#isProductForm(event.target) || !event.detail.variant) {
      return;
    }

    this.#mainVariant = event.detail.variant;
    this.#updatePrice();
  }

  #onSubmit(event) {
    if (!this.#isProductForm(event.target)) {
      return;
    }

    const missingItems = this.items.filter((item) => item.hasAttribute('data-required') && !this.#getSelectedInput(item));

    if (missingItems.length === 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    missingItems.forEach((item) => item.querySelector('[data-group-item-error]').hidden = false);
    missingItems[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  #onFormData(event) {
    if (!this.#isProductForm(event.target)) {
      return;
    }

    const formData = event.formData;
    const quantity = formData.get('quantity') || '1';
    const properties = { main: this.getAttribute('main-title'), _ref: Date.now().toString() };
    const mainItem = { id: formData.get('id'), quantity, properties: { ...properties, _group_main: 'true' } };

    for (const [key, value] of Array.from(formData.entries())) {
      const propertyName = key.match(/^properties\[(.+)\]$/)?.[1];

      if (propertyName) {
        mainItem.properties[propertyName] = value;
        formData.delete(key);
      }
    }

    if (formData.has('selling_plan')) {
      mainItem.selling_plan = formData.get('selling_plan');
      formData.delete('selling_plan');
    }

    const items = [mainItem];

    this.items.forEach((item) => {
      const id = this.#getSelectedInput(item)?.value || item.getAttribute('data-variant-id');

      if (id) {
        items.push({ id, quantity, properties });
      }
    });

    formData.delete('id');
    formData.delete('quantity');

    items.forEach((item, index) => {
      Object.entries(item).forEach(([key, value]) => {
        if (key === 'properties') {
          Object.entries(value).forEach(([propertyName, propertyValue]) => formData.append(`items[${index}][properties][${propertyName}]`, propertyValue));
        } else {
          formData.append(`items[${index}][${key}]`, value);
        }
      });
    });
  }

  #updatePrice() {
    let price = this.#mainVariant.price;
    let compareAtPrice = this.#mainVariant.compare_at_price || this.#mainVariant.price;

    // Items needing a choice are only added to the total once a variant is selected
    this.items.forEach((item) => {
      const source = item.hasAttribute('data-required') ? this.#getSelectedInput(item) : item;

      if (!source) {
        return;
      }

      price += parseInt(source.getAttribute('data-price'));
      compareAtPrice += parseInt(source.getAttribute('data-compare-at-price'));
    });

    const priceList = this.closest('.product-info')?.querySelector('[data-block-type="price"] price-list');

    if (!priceList) {
      return;
    }

    this.#setAmount(priceList.querySelector('sale-price'), price);

    if (compareAtPrice > price) {
      this.#setAmount(priceList.querySelector('compare-at-price'), compareAtPrice);
    }
  }

  #setAmount(element, cents) {
    if (!element) {
      return;
    }

    Array.from(element.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE).forEach((node) => node.remove());
    element.append(formatMoney(cents));
  }
}

function formatMoney(cents) {
  const settings = window.themeVariables.settings;
  const format = settings.currencyCodeEnabled ? settings.moneyWithCurrencyFormat : settings.moneyFormat;

  const formatWithDelimiters = (precision, thousands = ',', decimal = '.') => {
    const [integer, fraction] = (cents / 100).toFixed(precision).split('.');
    return integer.replace(/\B(?=(\d{3})+(?!\d))/g, thousands) + (fraction ? decimal + fraction : '');
  };

  return format.replace(/\{\{\s*(\w+)\s*\}\}/, (match, placeholder) => {
    switch (placeholder) {
      case 'amount_no_decimals':
        return formatWithDelimiters(0);
      case 'amount_with_comma_separator':
        return formatWithDelimiters(2, '.', ',');
      case 'amount_no_decimals_with_comma_separator':
        return formatWithDelimiters(0, '.', ',');
      case 'amount_with_space_separator':
        return formatWithDelimiters(2, ' ', ',');
      case 'amount_no_decimals_with_space_separator':
        return formatWithDelimiters(0, ' ');
      case 'amount_with_apostrophe_separator':
        return formatWithDelimiters(2, "'", '.');
      default:
        return formatWithDelimiters(2);
    }
  });
}

if (!window.customElements.get('product-group')) {
  window.customElements.define('product-group', ProductGroup);
}
