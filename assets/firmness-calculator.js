/**
 * Sengefabrikken: <firmness-calculator>
 *
 * "Beregn jeres fasthed" (see the firmness-calculator snippet). The element moves itself to the top of the "Vælg Fasthed"
 * drawer of the product (the drawer of firmness radios), and stays hidden when there is none.
 *
 * The drawer has a group of radios per mattress: the two sides of a double bed ("Venstre side" and "Højre side" of the
 * product group), or the single option of a box mattress. Person 1 gets the first mattress and person 2 the second; with
 * a single mattress for two persons, their average is used, and a single person gets the same firmness on both sides.
 *
 * The firmness follows the recommendation of the products (Medium under 70 kg, Fast 70-100 kg, Xtra Fast over 100 kg),
 * from a weight adjusted for the sleeping position (side sleepers sink in more, stomach sleepers need more support) and
 * the build (BMI).
 */
const FIRMNESSES = ['medium', 'fast', 'xtra fast'];
const FIRMNESS_LABELS = ['Medium', 'Fast', 'Xtra Fast'];
const POSITION_ADJUSTMENT = { back: 0, side: -8, stomach: 8, mixed: 0 };

class FirmnessCalculator extends HTMLElement {
  #initialized = false;
  #modal;
  #drawer;

  connectedCallback() {
    // Moving the element into the row connects it again
    if (this.#initialized) {
      return;
    }

    this.#initialized = true;
    this.#modal = this.querySelector('x-modal');

    const summary = Array.from(this.closest('.product-info, .shopify-section')?.querySelectorAll('.accordion__summary[aria-controls]') || [])
      .find((button) => /fasthed/i.test(button.textContent) && this.#groupsOf(document.getElementById(button.getAttribute('aria-controls'))).length > 0);

    if (!summary) {
      return;
    }

    this.#drawer = document.getElementById(summary.getAttribute('aria-controls'));

    // With a single mattress, the texts are about one mattress
    if (this.#groups.length < 2) {
      this.#modal.querySelector('[data-calculator-intro]').textContent = 'Udfyld for hver af jer, og få en anbefaling til jeres madras.';
    }

    this.#modal.querySelector('[data-calculator-form]').addEventListener('submit', this.#onSubmit.bind(this));
    this.#modal.querySelector('[data-calculator-form]').addEventListener('change', this.#onModeChange.bind(this));
    this.#modal.querySelector('[data-calculator-back]').addEventListener('click', () => this.#showResult(false));
    this.#modal.querySelector('[data-calculator-close]').addEventListener('click', () => this.#modal.hide());

    // At the top of the drawer, before the firmnesses
    this.#drawer.prepend(this);
    this.hidden = false;
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
    return this.#groupsOf(this.#drawer);
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
    if (event.target.name !== 'persons') {
      return;
    }

    const person = this.#modal.querySelector('[data-person="2"]');
    person.hidden = !this.#twoPersons;
    person.disabled = !this.#twoPersons;
    this.#modal.querySelector('[data-person="1"] [data-person-title]').textContent = this.#twoPersons ? 'Person 1' : 'Dig';
    this.#modal.querySelector('[data-calculator-intro]').textContent = this.#twoPersons
      ? (this.#groups.length < 2 ? 'Udfyld for hver af jer, og få en anbefaling til jeres madras.' : 'Udfyld for hver af jer, og få en anbefaling til madras 1 og madras 2.')
      : 'Udfyld for dig selv, og få en anbefaling til din madras.';
  }

  #onSubmit(event) {
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

    const groups = this.#groups;
    const recommendations = [];

    groups.forEach((group, index) => {
      // One mattress for two persons: their average. Two mattresses for one person: the same firmness on both
      const score = groups.length === 1 ? persons.reduce((sum, value) => sum + value, 0) / persons.length : persons[Math.min(index, persons.length - 1)];
      const input = this.#pick(group, this.#levelFor(score));

      // Not a click: the popup would take it for a click outside of it, and close
      if (input && !input.checked) {
        input.checked = true;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }

      recommendations.push({ index, level: input ? this.#levelOf(input) : -1 });
    });

    this.#renderRecommendations(recommendations, groups.length);
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
      name.textContent = mattresses === 1 ? 'Jeres madras' : (this.#twoPersons ? `Person ${index + 1}: ${index === 0 ? 'venstre side' : 'højre side'}` : (index === 0 ? 'Venstre side' : 'Højre side'));
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

