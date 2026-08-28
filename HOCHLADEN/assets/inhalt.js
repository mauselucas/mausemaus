/* Nachbereitung für Seiteninhalt: Einlagen einsetzen, Code einfärben, Kopieren.
   Kommt aus dem alten blog.js und wird jetzt von den Welt-Seiten benutzt. */
(() => {
  /* Feste Version statt "@11". Vorher zeigte die Adresse auf den jeweils
     neuesten Stand der 11er-Reihe: Was hier ausgefuehrt wird, konnte sich
     also jederzeit aendern, ohne dass jemand etwas anfasst -- und ohne dass
     wir es merken. Mit fester Version passt auch ein integrity-Wert, und der
     macht die Sache dicht: Stimmt die Datei nicht auf das Byte mit dem Hash
     ueberein, fuehrt der Browser sie GAR NICHT aus. Ein uebernommener oder
     manipulierter CDN-Eintrag laeuft dann ins Leere statt auf der Seite.
     Zum Aktualisieren: neue Version eintragen und den Hash neu bilden --
       curl -sL <URL> | openssl dgst -sha384 -binary | openssl base64 -A  */
  const HLJS = 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.12.0/build/highlight.min.js';
  const HLJS_HASH = 'sha384-wjfDDhOPPdjtva8vWBhWeVprSpmxisEu5aYT3q1JyACqXpdKpo3PWZTMVq24MBix';

  function einfaerben(wurzel) {
    const bloecke = wurzel.querySelectorAll('.code-block code');
    if (!bloecke.length) return;                 // ohne Code kein Nachladen
    const anwenden = () => bloecke.forEach(el => window.hljs && window.hljs.highlightElement(el));
    if (window.hljs) return anwenden();
    const s = document.createElement('script');
    s.src = HLJS;
    s.integrity = HLJS_HASH;
    /* crossorigin ist bei integrity Pflicht -- ohne das Wort kann der
       Browser die Antwort nicht pruefen und weigert sich, sie auszufuehren. */
    s.crossOrigin = 'anonymous';
    s.onload = anwenden; s.onerror = () => {};   // ohne Netz eben ungefärbt
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
