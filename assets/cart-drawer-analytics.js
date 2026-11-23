/**
 * Sengefabrikken: "cart_drawer_viewed" event for the DataLayer custom pixel (Settings > Customer events)
 *
 * Shopify only sends "cart_viewed" on the cart page, which redirects to the cart drawer (see cart-page-redirect). So,
 * when the cart drawer opens, the cart is published to the pixels, which send it as "view_cart". Each line of the cart
 * is its own item (the lines of a product group too).
 *
 * The "dialog:after-show" event does not bubble, so it is listened to in the capture phase.
 */
document.addEventListener('dialog:after-show', async (event) => {
  if (event.target?.id !== 'cart-drawer' || !window.Shopify?.analytics?.publish) {
    return;
  }

  try {
    const cart = await (await fetch(`${window.Shopify.routes?.root || '/'}cart.js`)).json();

    if (cart.item_count === 0) {
      return;
    }

    window.Shopify.analytics.publish('cart_drawer_viewed', {
      currency: cart.currency,
      value: cart.total_price / 100,
      items: cart.items.map((item) => ({
        item_id: item.sku || String(item.variant_id),
        item_name: item.product_title,
        price: item.final_price / 100,
        quantity: item.quantity,
        item_category: item.product_type
      }))
    });
  } catch (error) {
    // The cart could not be fetched: no event
  }
}, { capture: true });
