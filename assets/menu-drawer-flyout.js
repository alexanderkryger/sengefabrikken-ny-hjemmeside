/**
 * Sengefabrikken: <menu-drawer-flyouts>
 *
 * On desktop, when the header uses the "drawer" layout, the menu items with a mega menu block (data-menu-flyout
 * attribute) open their panel next to the menu drawer instead of replacing the menu with their sub panel. The panel opens
 * on hover (with a mouse) and on click, and closes when another menu item is hovered or the drawer is closed. On mobile
 * the click is left to the theme, which shows the sub panel.
 */
class MenuDrawerFlyouts extends HTMLElement {
  #abortController;
  #desktopMediaQuery = window.matchMedia('screen and (min-width: 1000px)');

  connectedCallback() {
    const drawer = this.closest('header-menu-drawer');

    if (!drawer) {
      return;
    }

    this.#abortController = new AbortController();
    const signal = this.#abortController.signal;

    // The capture phase runs before the theme handles the click, so that the sub panel is not opened on desktop
    drawer.addEventListener('click', (event) => {
      const button = event.target.closest('[data-menu-flyout]');

      if (button && this.#desktopMediaQuery.matches) {
        event.stopPropagation();
        this.open(button.getAttribute('data-menu-flyout'));
      }
    }, { capture: true, signal });

    drawer.addEventListener('pointerover', (event) => {
      if (event.pointerType !== 'mouse' || !this.#desktopMediaQuery.matches) {
        return;
      }

      const item = event.target.closest('[data-main-panel] .menu-drawer__panel-body li');

      if (item) {
        const button = item.querySelector(':scope > [data-menu-flyout]');
        button ? this.open(button.getAttribute('data-menu-flyout')) : this.close();
      }
    }, { signal });

    drawer.addEventListener('dialog:after-hide', () => this.close(), { signal });
    this.#desktopMediaQuery.addEventListener('change', () => this.close(), { signal });
  }

  disconnectedCallback() {
    this.#abortController?.abort();
  }

  open(id) {
    const flyout = this.querySelector(`#${CSS.escape(id)}`);

    if (!flyout || flyout.classList.contains('is-open')) {
      return;
    }

    this.close();
    flyout.classList.add('is-open');
    flyout.scrollTop = 0;
    this.setAttribute('open', '');
    this.#buttons(id).forEach((button) => button.setAttribute('aria-expanded', 'true'));
  }

  close() {
    this.querySelectorAll('.menu-drawer-flyout.is-open').forEach((flyout) => {
      flyout.classList.remove('is-open');
      this.#buttons(flyout.id).forEach((button) => button.setAttribute('aria-expanded', 'false'));
    });

    this.removeAttribute('open');
  }

  #buttons(id) {
    return this.closest('header-menu-drawer').querySelectorAll(`[data-menu-flyout="${CSS.escape(id)}"]`);
  }
}

if (!window.customElements.get('menu-drawer-flyouts')) {
  window.customElements.define('menu-drawer-flyouts', MenuDrawerFlyouts);
}
