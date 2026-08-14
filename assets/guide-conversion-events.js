(() => {
  const theme = document.documentElement.dataset.guideTheme || 'unknown';
  const send = (event, params) => {
    if (typeof window.gtag === 'function') window.gtag('event', event, params);
  };

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (!link) return;
    const href = link.href || '';
    const location = link.dataset.ctaLocation || 'unknown';
    const text = link.textContent.trim().replace(/\s+/g, ' ').slice(0, 100);

    if (link.dataset.guideDownload) {
      send('guide_download_click', { theme, destination: link.dataset.guideDownload, cta_location: location, link_url: href, link_text: text });
      return;
    }

    if (location === 'theme_next_step' || location === 'guide_after_download') {
      send('guide_next_step_click', { theme, destination: link.dataset.analytics || 'unknown', cta_location: location, link_url: href, link_text: text });
      return;
    }

    if (link.dataset.analytics && /_blog_hub$/.test(link.dataset.analytics)) {
      send('guide_blog_referral_click', { theme, destination: link.dataset.analytics, cta_location: location, link_url: href, link_text: text });
    }
  });
})();
