/* Nachbereitung für Seiteninhalt: Einlagen einsetzen, Code einfärben, Kopieren.
   Kommt aus dem alten blog.js und wird jetzt von den Welt-Seiten benutzt. */
(() => {
  const HLJS = 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/highlight.min.js';

  function einfaerben(wurzel) {
    const bloecke = wurzel.querySelectorAll('.code-block code');
    if (!bloecke.length) return;                 // ohne Code kein Nachladen
    const anwenden = () => bloecke.forEach(el => window.hljs && window.hljs.highlightElement(el));
    if (window.hljs) return anwenden();
    const s = document.createElement('script');
    s.src = HLJS; s.onload = anwenden; s.onerror = () => {};   // ohne Netz eben ungefärbt
    document.head.appendChild(s);
  }

  window.mmInhalt = function (wurzel) {
    wurzel.querySelectorAll('.mm-demo').forEach(el => {
      const bauen = (window.MM_DEMOS || {})[el.dataset.demo];
      if (bauen) bauen(el);
      else el.innerHTML = '<p class="leer">Diese Einlage ist nicht hinterlegt.</p>';
    });

    wurzel.querySelectorAll('.code-kopieren').forEach(knopf => {
      if (knopf.dataset.mmBereit) return;        // nicht zweimal verdrahten
      knopf.dataset.mmBereit = '1';
      knopf.addEventListener('click', async () => {
        const code = knopf.closest('.code-block').querySelector('code').textContent;
        try {
          await navigator.clipboard.writeText(code);
          knopf.textContent = 'Kopiert!'; knopf.classList.add('fertig');
        } catch { knopf.textContent = 'Ging nicht'; }
        setTimeout(() => { knopf.textContent = 'Kopieren'; knopf.classList.remove('fertig'); }, 1800);
      });
    });

    einfaerben(wurzel);
  };
})();
