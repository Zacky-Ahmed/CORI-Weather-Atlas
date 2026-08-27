(() => {
  const nightTheme = 'night';

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme === nightTheme ? nightTheme : '';
    const button = document.querySelector('#theme-toggle');
    const enabled = theme === nightTheme;
    if (button) {
      button.setAttribute('aria-pressed', String(enabled));
      button.setAttribute('aria-label', enabled ? 'Switch to daylight observatory mode' : 'Switch to after-hours observatory mode');
      button.innerHTML = `<span aria-hidden="true">${enabled ? '☼' : '◑'}</span> ${enabled ? 'Daylight' : 'After hours'}`;
    }
    try { localStorage.setItem('atlas-theme', enabled ? nightTheme : 'day'); } catch (_) {}
  }

  function applyFieldConsole(panel) {
    const cards = panel.querySelector('[data-cards]');
    const controls = panel.querySelector('[data-field-console]');
    if (!cards || !controls) return;
    const filter = controls.dataset.filter || 'all';
    const sort = controls.querySelector('[data-sort]')?.value || 'score';
    const allCards = [...cards.querySelectorAll('.city-card')];
    const accepts = {
      all: () => true,
      stroll: (card) => Number(card.dataset.score) >= 70,
      dry: (card) => Number(card.dataset.humidity) <= 60,
      clear: (card) => Number(card.dataset.visibility) >= 8000
    };
    const comparison = {
      score: (a, b) => Number(b.dataset.score) - Number(a.dataset.score),
      temperature: (a, b) => Number(b.dataset.temperature) - Number(a.dataset.temperature),
      visibility: (a, b) => Number(b.dataset.visibility) - Number(a.dataset.visibility),
      wind: (a, b) => Number(a.dataset.wind) - Number(b.dataset.wind)
    };
    const visible = allCards.filter(accepts[filter] || accepts.all).sort(comparison[sort] || comparison.score);
    const hidden = allCards.filter((card) => !visible.includes(card));
    [...visible, ...hidden].forEach((card) => cards.append(card));
    visible.forEach((card, index) => {
      card.hidden = false;
      card.classList.toggle('leader', index === 0);
      const isDefaultView = filter === 'all' && sort === 'score';
      card.querySelector('.rank span').textContent = isDefaultView ? 'CORI RANK' : 'VIEW ORDER';
      card.querySelector('.rank b').textContent = String(isDefaultView ? Number(card.dataset.rank) : index + 1).padStart(2, '0');
    });
    hidden.forEach((card) => { card.hidden = true; card.classList.remove('leader'); });
    let empty = cards.querySelector('.no-results');
    if (!visible.length) {
      empty ??= Object.assign(document.createElement('p'), { className: 'no-results', textContent: 'No city matches this field lens right now.' });
      cards.append(empty);
    } else if (empty) empty.remove();
    const status = panel.querySelector('[data-console-status]');
    if (status) status.textContent = `${visible.length} of ${allCards.length} cities · ${sort === 'score' ? 'CORI score' : sort === 'temperature' ? 'warmest first' : sort === 'visibility' ? 'clearest first' : 'calmest wind first'}${filter === 'all' ? '' : ` · ${filter} lens`}`;
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('#theme-toggle')) {
      setTheme(document.documentElement.dataset.theme === nightTheme ? 'day' : nightTheme);
      return;
    }
    const lens = event.target.closest('[data-filter]');
    if (!lens) return;
    const panel = lens.closest('.ranking-panel');
    const controls = lens.closest('[data-field-console]');
    if (!panel || !controls) return;
    controls.dataset.filter = lens.dataset.filter;
    controls.querySelectorAll('.lens').forEach((button) => button.classList.toggle('active', button === lens));
    applyFieldConsole(panel);
  });

  document.addEventListener('change', (event) => {
    if (!event.target.matches('[data-sort]')) return;
    const panel = event.target.closest('.ranking-panel');
    if (panel) applyFieldConsole(panel);
  });

  document.addEventListener('htmx:afterSwap', (event) => {
    if (event.target.id === 'rankings') applyFieldConsole(event.target);
  });
  document.addEventListener('DOMContentLoaded', () => {
    setTheme(document.documentElement.dataset.theme === nightTheme ? nightTheme : 'day');
    document.querySelectorAll('.ranking-panel').forEach(applyFieldConsole);
  });
})();
