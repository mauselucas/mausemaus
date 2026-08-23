/* mausemaus — Auf-/Zuklapp-Verhalten der Anleitung im Admin.
   Reine DOM-Verdrahtung an einem <details>-Element, ohne jede Netzwerk-
   Abhängigkeit -- dadurch ohne Anmeldung testbar (siehe
   tests/pruefe-anleitung.mjs), genau wie block-modell.js/blockeditor.js.

   Vertrag (Aufgabe 3): "Auf- und zuklappbar; einmal zugeklappt bleibt sie
   zu." -- der Zustand wird deshalb in localStorage gemerkt, seitenübergreifend
   und über einen Neustart des Browsers hinweg. */
export function richteAnleitungEin(details, schluessel = 'mm.anleitung.zu') {
  if (!details) return;
  /* Ohne einen bekannten "zugeklappt"-Vermerk startet sie offen -- so kann
     man sie beim allerersten Besuch überhaupt erst entdecken. */
  try { details.open = localStorage.getItem(schluessel) !== '1'; }
  catch { details.open = true; }   // z.B. privates Fenster ohne Speicherzugriff
  details.addEventListener('toggle', () => {
    try { localStorage.setItem(schluessel, details.open ? '0' : '1'); } catch {}
  });
}
