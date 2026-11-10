/**
 * Sengefabrikken: <section-video-controls hidden>
 *
 * Controls the videos (<video-media>) of the section it is placed in:
 * - a click on a playing video pauses it, and a click on a paused video plays it again (instead of the small native
 *   controls, which are removed),
 * - only one video plays at a time,
 * - a video is paused when it is scrolled (or swiped) out of view.
 * The first click is still handled by <video-media> itself, which loads and starts the video.
 */
class SectionVideoControls extends HTMLElement {
  #abortController;
  #observer;

  connectedCallback() {
    const section = this.closest('.shopify-section');

    if (!section) {
      return;
    }

    this.#abortController = new AbortController();
    const signal = this.#abortController.signal;
    const videos = Array.from(section.querySelectorAll('video-media:not([autoplay])'));

    videos.forEach((media) => media.querySelector('video')?.removeAttribute('controls'));

    // Capture phase, so that the click is handled before <video-media> starts a video that is not loaded yet
    section.addEventListener('click', (event) => {
      const media = event.target.closest('video-media:not([autoplay])');

      if (!media || !media.hasAttribute('loaded')) {
        return;
      }

      media.playing ? media.pause() : media.play();
    }, { capture: true, signal });

    section.addEventListener('media:play', (event) => {
      videos.filter((media) => media !== event.target).forEach((media) => media.pause());
    }, { signal });

    this.#observer = new IntersectionObserver((entries) => {
      entries.filter((entry) => !entry.isIntersecting).forEach((entry) => entry.target.pause());
    }, { threshold: 0.25 });

    videos.forEach((media) => this.#observer.observe(media));
  }

  disconnectedCallback() {
    this.#abortController?.abort();
    this.#observer?.disconnect();
  }
}

if (!window.customElements.get('section-video-controls')) {
  window.customElements.define('section-video-controls', SectionVideoControls);
}
