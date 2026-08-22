/* mausemaus — Hintertürchen. Zeigen vorher, wohin sie führen, aber nicht alles.
   Besuchte Türen sehen anders aus. Eine Tür ist unmarkiert. */
(() => {
  const MERK = 'mm.tueren.besucht.v1';

  const gelesen = () => { try { return new Set(JSON.parse(localStorage.getItem(MERK) || '[]')); }
                          catch { return new Set(); } };
  const merken = slug => { const m = gelesen(); m.add(slug);
    try { localStorage.setItem(MERK, JSON.stringify([...m])); } catch {} };

  window.mmTueren = function (wurzel) {
    const besucht = gelesen();
    const kasten = document.createElement('div');
    kasten.className = 'mm-vorschau';
    kasten.hidden = true;
    document.body.appendChild(kasten);

    wurzel.querySelectorAll('a.mm-tuer').forEach(a => {
      const slug = (a.getAttribute('href') || '').split('/').pop();
      if (besucht.has(slug)) a.classList.add('mm-tuer-besucht');
      a.addEventListener('click', () => merken(slug));

      a.addEventListener('mouseenter', () => {
        const t = a.dataset.titel, x = a.dataset.text;
        if (!t && !x) return;
        kasten.innerHTML =
          '<i>Hintertürchen</i>' +
          (t ? '<b></b>' : '') + (x ? '<span></span>' : '');
        if (t) kasten.querySelector('b').textContent = t;
        if (x) kasten.querySelector('span').textContent = x;
        kasten.hidden = false;
        kasten.classList.remove('mm-vorschau-unten');
        const r = a.getBoundingClientRect();
        const breite = 214;
        kasten.style.left = Math.max(10,
          Math.min(window.innerWidth - breite - 10, r.left + r.width / 2 - breite / 2)) + 'px';
        /* Oben zu wenig Platz? Dann klappt die Vorschau unter das Wort,
           statt am Bildschirmrand abgeschnitten zu werden. */
        const oben = r.top - kasten.offsetHeight - 11;
        if (oben < 8) {
          kasten.style.top = (r.bottom + 11) + 'px';
          kasten.classList.add('mm-vorschau-unten');
        } else {
          kasten.style.top = oben + 'px';
        }
      });
      a.addEventListener('mouseleave', () => { kasten.hidden = true; });
    });
  };
})();
