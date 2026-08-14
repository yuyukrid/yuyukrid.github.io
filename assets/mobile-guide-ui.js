(() => {
  const mobileQuery = window.matchMedia('(max-width: 720px)');
  const cta = document.querySelector('[data-mobile-guide-cta]');
  const primary = document.querySelector('[data-mobile-guide-primary]');
  const stop = document.querySelector('[data-mobile-guide-stop]');
  const theme = document.documentElement.dataset.guideTheme || 'unknown';
  const closeKey = `guide-mobile-cta-closed:${theme}`;

  const sendEvent = (name, params) => {
    if (typeof window.gtag === 'function') window.gtag('event', name, params);
  };

  if (cta && primary) {
    const close = cta.querySelector('[data-mobile-guide-close]');
    const link = cta.querySelector('[data-mobile-guide-link]');
    let dismissed = sessionStorage.getItem(closeKey) === 'true';

    const update = () => {
      const isMobile = mobileQuery.matches;
      const primaryPast = primary.getBoundingClientRect().bottom < 0;
      const stopIsNear = stop ? stop.getBoundingClientRect().top < window.innerHeight - 24 : false;
      const visible = isMobile && primaryPast && !stopIsNear && !dismissed;
      cta.hidden = !visible;
      cta.classList.toggle('is-visible', visible);
      document.body.classList.toggle('has-mobile-guide-cta', visible);
    };

    close?.addEventListener('click', () => {
      dismissed = true;
      sessionStorage.setItem(closeKey, 'true');
      update();
      sendEvent('mobile_guide_cta_close', { theme, cta_location: 'mobile_sticky' });
    });

    link?.addEventListener('click', () => {
      sendEvent('mobile_guide_cta_click', {
        theme,
        destination: link.dataset.destination || 'unknown',
        cta_location: 'mobile_sticky',
        link_url: link.href,
        link_text: link.textContent.trim()
      });
    });

    mobileQuery.addEventListener('change', update);
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  document.querySelectorAll('[data-guide-faq]').forEach((item) => {
    item.addEventListener('toggle', () => {
      if (!item.open) return;
      const question = item.querySelector('summary')?.textContent.trim().slice(0, 100) || '';
      sendEvent('guide_faq_open', { theme, question, cta_location: 'guide_faq' });
    });
  });
})();
