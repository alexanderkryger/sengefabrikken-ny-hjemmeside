/**
 * Sengefabrikken: <menu-drawer-cards-group>
 *
 * Holds the cards shown next to a sub panel of the menu drawer on desktop (see the menu-drawer-cards-group snippet).
 * Hovering or focusing a sub link with its own cards (data-menu-cards attribute) shows them, and they stay visible while
 * the cards are browsed. Hovering a sub link without cards shows the cards of the menu item again, and so does opening
 * the sub panel again.
 */
class MenuDrawerCardsGroup extends HTMLElement {
  #abortController;

  connectedCallback() {
    const panel = this.closest('header-menu-drawer-panel');

    if (!panel) {
      return;
    }

    this.#abortController = new AbortController();
    const signal = this.#abortController.signal;

    panel.addEventListener('pointerover', (event) => {
      if (event.pointerType === 'mouse') {
        this.#onLinkActivated(event.target);
      }
    }, { signal });

    panel.addEventListener('focusin', (event) => this.#onLinkActivated(event.target), { signal });
    this.closest('header-menu-drawer')?.addEventListener('dialog:after-hide', () => this.show(null), { signal });
    panel.querySelector('.back-button')?.addEventListener('click', () => this.show(null), { signal });
  }

  disconnectedCallback() {
    this.#abortController?.abort();
  }

  /**
   * Show the cards with the given ID, or the default cards (of the menu item) if no ID is given
   */
  show(id) {
    const target = (id && this.querySelector(`#${CSS.escape(id)}`)) || this.querySelector('[data-default]');

    this.querySelectorAll('.menu-drawer-cards').forEach((cards) => {
      cards.hidden = cards !== target;
    });

    if (target) {
      target.scrollTop = 0;
    }

    this.closest('header-menu-drawer-panel').querySelectorAll('[data-menu-cards]').forEach((link) => {
      link.classList.toggle('is-active', link.getAttribute('data-menu-cards') === id);
    });
  }

  #onLinkActivated(target) {
    const link = target.closest('.menu-drawer__panel-body li a, .menu-drawer__panel-body .v-stack > a.subheading');

    if (!link) {
      return;
    }

    const id = link.getAttribute('data-menu-cards');

    if (link.classList.contains('is-active') || (!id && !this.querySelector('.menu-drawer-cards:not([hidden]):not([data-default])'))) {
      return;
    }

    this.show(id);
  }
}

if (!window.customElements.get('menu-drawer-cards-group')) {
  window.customElements.define('menu-drawer-cards-group', MenuDrawerCardsGroup);
}
