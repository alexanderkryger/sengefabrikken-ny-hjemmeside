/**
 * Sengefabrikken: <yotpo-rating>
 *
 * Fallback used when a product has no rating in the Shopify review metafields (Yotpo does not sync every product). The
 * rating is fetched from the public Yotpo API, and the markup of the inner template (rendered by the yotpo-stars
 * snippet) is filled with it. Products without reviews stay hidden. Requests are shared between elements showing the
 * same product.
 */
const bottomlineRequests = new Map();

function fetchBottomline(appKey, productId) {
  const url = `https://api.yotpo.com/products/${appKey}/${productId}/bottomline`;

  if (!bottomlineRequests.has(url)) {
    bottomlineRequests.set(url, fetch(url).then((response) => response.json()).then((json) => json.response?.bottomline));
  }

  return bottomlineRequests.get(url);
}

class YotpoRating extends HTMLElement {
  async connectedCallback() {
    if (this.hasAttribute('rendered')) {
      return;
    }

    try {
      const bottomline = await fetchBottomline(this.getAttribute('app-key'), this.getAttribute('product-id'));

      if (!bottomline || !bottomline.total_reviews) {
        return;
      }

      this.#render(bottomline.average_score, bottomline.total_reviews);
    } catch (error) {
      // The rating is not essential, so the element simply stays hidden
    }
  }

  #render(score, count) {
    const content = this.querySelector('template').content.cloneNode(true),
      roundedScore = Math.round(score * 10) / 10;

    content.querySelectorAll('.yotpo-stars').forEach((stars) => {
      const starList = stars.querySelectorAll('.yotpo-stars__star');
      const scoreOnScale = starList.length === 1 ? 1 : score * starList.length / 5;

      stars.setAttribute('aria-label', `${roundedScore} / 5`);
      starList.forEach((star, index) => {
        star.style.setProperty('--yotpo-star-fill', `${Math.round(Math.min(Math.max(scoreOnScale - index, 0), 1) * 100)}%`);
      });
    });

    content.querySelectorAll('[data-yotpo-count]').forEach((element) => element.textContent = count);
    content.querySelectorAll('[data-yotpo-score]').forEach((element) => element.textContent = roundedScore.toFixed(1));

    this.append(content);
    this.setAttribute('rendered', '');
    this.hidden = false;
  }
}

if (!window.customElements.get('yotpo-rating')) {
  window.customElements.define('yotpo-rating', YotpoRating);
}
