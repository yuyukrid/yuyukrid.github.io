(() => {
  const storageKey = 'yuyukrid:last-theme';
  const themes = {
    nisa: { label: '新NISAの確認シート', href: '/nisa-checklist.html' },
    asset_formation: { label: '資産形成の確認シート', href: '/asset-formation-checklist.html' },
    sidejob: { label: '副業の確認シート', href: '/side-job-checklist.html' },
    crowdfunding: { label: 'クラウドファンディングの確認ガイド', href: '/crowdfunding-guide.html' },
    renovation: { label: 'リノベーションの確認ガイド', href: '/renovation-guide.html' }
  };
  const send = (event, params) => {
    if (typeof window.gtag === 'function') window.gtag('event', event, params);
  };
  const saveTheme = (key) => {
    if (!themes[key]) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ key, savedAt: Date.now() })); } catch (_) {}
  };
  const readTheme = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || 'null');
      return stored && themes[stored.key] ? stored.key : null;
    } catch (_) { return null; }
  };

  const currentTheme = document.documentElement.dataset.guideTheme;
  if (currentTheme) saveTheme(currentTheme);

  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-theme-key]');
    if (link) saveTheme(link.dataset.themeKey);
  });

  const resume = document.querySelector('[data-theme-resume]');
  if (!resume) return;
  const key = readTheme();
  if (!key) return;
  const theme = themes[key];
  const label = resume.querySelector('[data-theme-resume-label]');
  const link = resume.querySelector('[data-theme-resume-link]');
  const dismiss = resume.querySelector('[data-theme-resume-dismiss]');
  if (label) label.textContent = theme.label;
  if (link) link.href = theme.href;
  resume.hidden = false;
  send('theme_resume_view', { theme: key, cta_location: 'start_hub_resume' });

  link?.addEventListener('click', () => {
    send('theme_resume_click', { theme: key, destination: `resume_${key}`, cta_location: 'start_hub_resume' });
  });
  dismiss?.addEventListener('click', () => {
    try { localStorage.removeItem(storageKey); } catch (_) {}
    resume.hidden = true;
    send('theme_resume_dismiss', { theme: key, cta_location: 'start_hub_resume' });
  });
})();
