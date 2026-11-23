/**
 * Sengefabrikken: "Del kurv" in the cart drawer
 *
 * The button copies (or shares, on mobile) a link to the store with the cart in the "del-kurv" parameter: the variant,
 * the quantity and the properties of each line (the properties keep the lines of a product group together). Opening
 * the link replaces the cart by the shared one, and opens the cart drawer (#cart, see cart-page-redirect).
 */
const PARAMETER = 'del-kurv';

const encode = (value) => {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const decode = (value) => {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0))));
};

const root = window.Shopify?.routes?.root || '/';

const postJson = (url, body) => fetch(`${root}${url}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

const showToast = (message, tone) => {
  document.dispatchEvent(new CustomEvent('toast:show', { detail: { message, tone } }));
};

// The drawer is rendered again on each change of the cart, so the click is delegated
document.addEventListener('click', async (event) => {
  if (!event.target.closest?.('[data-share-cart]')) {
    return;
  }

  try {
    const cart = await (await fetch(`${root}cart.js`)).json();
    const lines = cart.items.map((item) => {
      const properties = Object.fromEntries(Object.entries(item.properties || {}).filter(([, value]) => value !== null && value !== ''));
      return Object.keys(properties).length > 0 ? [item.variant_id, item.quantity, properties] : [item.variant_id, item.quantity];
    });

    const url = new URL(root, window.location.origin);
    url.searchParams.set(PARAMETER, encode(lines));

    // The native share sheet on touch devices, the clipboard elsewhere
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ title: 'Min kurv hos Sengefabrikken', url: url.toString() }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url.toString());
      showToast('Linket til kurven er kopieret');
    }
  } catch (error) {
    showToast('Linket kunne ikke laves. Prøv igen.', 'error');
  }
});

// Opening a shared link: the cart is replaced by the shared one
const shared = new URLSearchParams(window.location.search).get(PARAMETER);

if (shared) {
  (async () => {
    const url = new URL(window.location.href);
    url.searchParams.delete(PARAMETER);
    url.hash = 'cart';

    try {
      // The cart lists the last added line first, so the lines are added in reverse to keep their order
      const items = decode(shared).map(([id, quantity, properties]) => ({ id, quantity, ...(properties ? { properties } : {}) })).reverse();

      await postJson('cart/clear.js', {});

      // All the lines at once; if one is no longer available, the others one by one
      const response = await postJson('cart/add.js', { items });

      if (!response.ok) {
        for (const item of items) {
          await postJson('cart/add.js', { items: [item] });
        }
      }
    } catch (error) {
      // An invalid link: the page opens without it
    }

    window.location.replace(url.toString());
  })();
}
