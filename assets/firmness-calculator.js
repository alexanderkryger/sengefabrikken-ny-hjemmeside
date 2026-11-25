/**
 * Sengefabrikken: <firmness-calculator>
 *
 * "Beregn jeres fasthed" (see the firmness-calculator snippet). The element stays hidden where it is rendered: its
 * button is copied to the top of each "Vælg Fasthed" drawer of the product (the drawers of firmness radios), and its
 * popup is moved to the body. The variant picker renders its drawers again on each change of variant, so the buttons
 * are copied again after each change.
 *
 * The drawers have a group of radios per mattress: the two sides of a double bed ("Venstre side" and "Højre side" in the
 * drawer of the product group), the two options of a box mattress for two ("Vælg Fasthed 1" and "Vælg Fasthed 2", a
 * drawer each), or the single option of a box mattress. Person 1 gets the first mattress and person 2 the second, and a
 * single person gets the same firmness on both. Two persons can only be filled in with two mattresses.
 *
 * The firmness follows the recommendation of the products (Medium under 70 kg, Fast 70-100 kg, Xtra Fast over 100 kg),
 * from a weight adjusted for the sleeping position (side sleepers sink in more, stomach sleepers need more support) and
 * the build (BMI).
 */
const FIRMNESSES = ['medium', 'fast', 'xtra fast'];
const FIRMNESS_LABELS = ['Medium', 'Fast', 'Xtra Fast'];
const POSITION_ADJUSTMENT = { back: 0, side: -8, stomach: 8, mixed: 0 };

class FirmnessCalculator extends HTMLElement {
  #abortController;
  #modal;
  #single = false;

  connectedCallback() {
    this.#abortController = new AbortController();
    const { signal } = this.#abortController;

    this.#modal ??= this.querySelector('x-modal');

    if (this.#drawers.length === 0) {
      return;
    }

    // Two persons only with two mattresses (double beds, from 160 cm). Otherwise, a single person
    this.#single = this.#groups.length < 2;

    if (this.#single) {
      this.#modal.querySelector('[name="persons"][value="1"]').checked = true;
      this.#modal.querySelector('.firmness-calculator__mode').hidden = true;
      this.querySelector('[data-calculator-label]').textContent = 'Beregn din fasthed';
      this.#modal.querySelector('[data-calculator-heading]').textContent = 'Beregn din fasthed';
      this.#modal.querySelector('[data-calculator-result-text]').textContent = 'Vi har valgt fastheden for dig under "Vælg Fasthed". Du kan altid ændre den.';
      this.#renderMode();
    }

    const form = this.#modal.querySelector('[data-calculator-form]');
    form.addEventListener('submit', this.#onSubmit.bind(this), { signal });
    form.addEventListener('change', this.#onModeChange.bind(this), { signal });
    this.#modal.querySelector('[data-calculator-back]').addEventListener('click', () => this.#showResult(false), { signal });
    this.#modal.querySelector('[data-calculator-close]').addEventListener('click', () => this.#modal.hide(), { signal });

    // The drawers are moved to the end of the body when opened: the popup goes after them, to be shown above them. In
    // a drawer, it would also be placed relatively to the drawer
    document.body.append(this.#modal);
    document.addEventListener('click', (event) => {
      if (event.target.closest?.('[data-firmness-calculator-button]')) {
        document.body.append(this.#modal);
      }
    }, { capture: true, signal });

    document.addEventListener('variant:change', () => setTimeout(() => this.#copyButtons()), { signal });
    this.#copyButtons();
  }

  disconnectedCallback() {
    this.#abortController?.abort();
    this.#modal?.remove();
  }

  // A drawer per "Vælg Fasthed" row with firmness radios. Found again each time, as the variant picker renders them again
  get #drawers() {
    const scope = this.closest('.product-info') || this.closest('.shopify-section') || document;

    return Array.from(scope.querySelectorAll('.accordion__summary[aria-controls]'))
      .filter((button) => /fasthed/i.test(button.textContent))
      .map((button) => document.getElementById(button.getAttribute('aria-controls')))
      .filter((drawer, index, drawers) => drawer && drawers.indexOf(drawer) === index && this.#groupsOf(drawer).length > 0);
  }

  #copyButtons() {
    this.#drawers.forEach((drawer) => {
      if (drawer.querySelector(':scope > .firmness-calculator')) {
        return;
      }

      const copy = document.createElement('div');
      copy.className = 'firmness-calculator';
      copy.append(this.querySelector('.firmness-calculator__button').cloneNode(true));
      drawer.prepend(copy);
    });
  }

  // The radios of the drawer, grouped by name (one group per mattress)
  #groupsOf(drawer) {
    const groups = new Map();

    drawer?.querySelectorAll('input[type="radio"]').forEach((input) => {
      if (this.#levelOf(input) === -1) {
        return;
      }

      if (!groups.has(input.name)) {
        groups.set(input.name, []);
      }

      groups.get(input.name).push(input);
    });

    return Array.from(groups.values());
  }

  get #groups() {
    return this.#drawers.flatMap((drawer) => this.#groupsOf(drawer));
  }

  // "Fast", "Fast - Anbefales mellem 70-100 kg." => 1
  #levelOf(input) {
    const label = input.getAttribute('data-label') || document.querySelector(`label[for="${CSS.escape(input.id)}"] .v-stack > span:not(.product-group-option__badge)`)?.textContent || '';
    return FIRMNESSES.indexOf(label.split(' - ')[0].trim().toLowerCase());
  }

  get #twoPersons() {
    return this.#modal.querySelector('[name="persons"]:checked')?.value === '2';
  }

  #onModeChange(event) {
    if (event.target.name === 'persons') {
      this.#renderMode();
    }
  }

  #renderMode() {
    const person = this.#modal.querySelector('[data-person="2"]');
    person.hidden = !this.#twoPersons;
    person.disabled = !this.#twoPersons;
    this.#modal.querySelector('[data-person="1"] [data-person-title]').textContent = this.#twoPersons ? 'Person 1' : 'Dig';
    this.#modal.querySelector('[data-calculator-intro]').textContent = this.#twoPersons
      ? 'Udfyld for hver af jer, og få en anbefaling til madras 1 og madras 2.'
      : 'Udfyld for dig selv, og få en anbefaling til din madras.';
  }

  async #onSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const valid = form.checkValidity();
    form.querySelector('[data-calculator-error]').hidden = valid;

    if (!valid) {
      form.querySelector(':invalid')?.focus();
      return;
    }

    const persons = (this.#twoPersons ? [1, 2] : [1]).map((i) => this.#score({
      position: form.elements[`position-${i}`].value,
      height: parseFloat(form.elements[`height-${i}`].value),
      weight: parseFloat(form.elements[`weight-${i}`].value)
    }));

    const count = this.#groups.length;
    const recommendations = [];

    for (let index = 0; index < count; index++) {
      // Two persons: one mattress each. One person: the same firmness on both
      const score = persons[Math.min(index, persons.length - 1)];

      // Found again each time: a variant option re-renders the variant picker once picked
      const input = this.#pick(this.#groups[index] || [], this.#levelFor(score));

      // Not a click: the popup would take it for a click outside of it, and close
      if (input && !input.checked) {
        input.checked = true;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));

        // A variant option: the next one is picked in the variant picker rendered again
        if (index < count - 1 && input.hasAttribute('data-option-position')) {
          await new Promise((resolve) => {
            document.addEventListener('variant:change', () => setTimeout(resolve), { once: true });
            setTimeout(resolve, 3000);
          });
        }
      }

      recommendations.push({ index, level: input ? this.#levelOf(input) : -1 });
    }

    this.#renderRecommendations(recommendations, count);
    this.#showResult(true);
  }

  // The weight, adjusted for the sleeping position and the build
  #score({ position, height, weight }) {
    const bmi = weight / ((height / 100) ** 2);
    return weight + (POSITION_ADJUSTMENT[position] || 0) + (bmi < 20 ? -5 : bmi >= 30 ? 5 : 0);
  }

  #levelFor(score) {
    return score < 70 ? 0 : score <= 100 ? 1 : 2;
  }

  // The firmness of the level, or the closest available one
  #pick(group, level) {
    return group.reduce((best, input) => {
      const distance = Math.abs(this.#levelOf(input) - level);
      return !best || distance < Math.abs(this.#levelOf(best) - level) ? input : best;
    }, null);
  }

  #renderRecommendations(recommendations, mattresses) {
    const list = this.#modal.querySelector('[data-calculator-recommendations]');

    list.replaceChildren(...recommendations.map(({ index, level }) => {
      const item = document.createElement('li');
      const name = document.createElement('span');
      const value = document.createElement('span');

      item.className = 'firmness-calculator__recommendation';
      name.textContent = mattresses === 1 ? 'Din madras' : (this.#twoPersons ? `Person ${index + 1}: ${index === 0 ? 'venstre side' : 'højre side'}` : (index === 0 ? 'Venstre side' : 'Højre side'));
      value.className = 'h5';
      value.textContent = FIRMNESS_LABELS[level] || '-';

      if (mattresses === 1 && !this.#twoPersons) {
        name.textContent = 'Din madras';
      }

      item.append(name, value);
      return item;
    }));
  }

  #showResult(show) {
    this.#modal.querySelector('[data-calculator-form]').hidden = show;
    this.#modal.querySelector('[data-calculator-result]').hidden = !show;
  }
}

if (!window.customElements.get('firmness-calculator')) {
  window.customElements.define('firmness-calculator', FirmnessCalculator);
}

