import { starteChrome, oeffne, pruefe, bericht } from './chrome.mjs';
import { starteServer } from './server.mjs';

const wurzel = new URL('../HOCHLADEN/', import.meta.url).pathname;
const server = await starteServer({ wurzel, port: 8905 });
const chrome = await starteChrome({ port: 9337 });

/* Einen echten Slug aus der Datenbank holen. */
const start = await oeffne('http://127.0.0.1:8905/', { port: 9337 });
await start.warte(2500);
const slug = await start.werte(`window.mmLoadPosts().then(l => (l[0]||{}).slug || '')`);
await start.zu();
pruefe('mindestens eine Welt vorhanden', !!slug, slug);

const s = await oeffne('http://127.0.0.1:8905/welt/' + slug, { port: 9337 });
await s.warte(2500);
/* ACHTUNG, hier steckt die Falle:
   Ein <link>-Tag zu zählen beweist NICHTS. Es steht auch dann im Dokument,
   wenn die Datei nie geladen wurde. Und weil die Umschreibungsregel früher
   mit `*` alles unter /welt/ einfing, bekam selbst ein falscher Pfad eine
   Erfolgsmeldung mit HTML zurück — der Browser legte brav vier leere
   Stylesheet-Objekte an. Gemessen werden muss die WIRKUNG:
   Regeln vorhanden, und die Farbe wirklich gesetzt.
   Ebenso wenig taugt document.fonts.check(): Es findet auch Schriften, die
   auf dem Rechner installiert sind — auf diesem Mac liegt eine namens
   "Tropi Land". Stattdessen nachsehen, ob die Schrift aus einer
   @font-face-Regel der Seite stammt. */
const d = JSON.parse(await s.werte(`JSON.stringify({
  titel: document.title,
  grund: getComputedStyle(document.getElementById('welt')).backgroundColor,
  schrift: [...document.fonts].some(f => f.family === 'TropiWeb'),
  ueberschrift: (document.querySelector('.welt-titel')||{}).textContent || '',
  regeln: [...document.styleSheets].reduce((n, b) => {
    try { return n + b.cssRules.length; } catch { return n; } }, 0),
  zurueck: !!document.querySelector('.welt-zurueck')
})`));

pruefe('Welt lädt unter /welt/' + slug, !d.titel.includes('Nicht gefunden'), d.titel);
pruefe('CSS greift unter tiefer Adresse — Regeln sind wirklich da',
  d.regeln > 50, d.regeln + ' CSS-Regeln');
pruefe('CSS wirkt unter tiefer Adresse — Untergrund ist gesetzt',
  d.grund !== 'rgba(0, 0, 0, 0)' && d.grund !== 'transparent', d.grund);
pruefe('Schrift kommt aus fonts.css, nicht vom Rechner', d.schrift);
pruefe('Überschrift vorhanden', d.ueberschrift.length > 0, d.ueberschrift);
pruefe('Rückweg in den Brief vorhanden', d.zurueck);

/* Unbekannte Welt darf nicht abstürzen. */
const f = await oeffne('http://127.0.0.1:8905/welt/gibtesnicht', { port: 9337 });
await f.warte(2000);
pruefe('unbekannte Welt zeigt eine freundliche Seite',
  (await f.werte(`document.body.innerText`)).includes('Hier ist nichts'));

/* Codeblöcke und die Werkzeug-Nachbildung — nur die Welt the-race-automatisierung
   enthält beides. */
const w = await oeffne('http://127.0.0.1:8905/welt/the-race-automatisierung', { port: 9337 });
await w.warte(3000);
const inhalt = JSON.parse(await w.werte(`(() => {
  const cb = document.querySelector('.code-block');
  const demo = document.querySelector('.mm-demo');
  return JSON.stringify({
    codeblock: !!cb,
    codeGestaltet: cb ? getComputedStyle(cb).backgroundColor !== 'rgba(0, 0, 0, 0)' : false,
    demoDa: !!demo,
    demoGefuellt: demo ? demo.children.length > 0 : false,
    kopierknopf: !!document.querySelector('.code-kopieren')
  });
})()`));
pruefe('die Welt enthält einen Codeblock', inhalt.codeblock);
pruefe('Codeblöcke sind gestaltet', inhalt.codeGestaltet);
pruefe('die Werkzeug-Nachbildung ist eingesetzt', inhalt.demoDa && inhalt.demoGefuellt,
  'da=' + inhalt.demoDa + ' gefüllt=' + inhalt.demoGefuellt);
pruefe('der Kopieren-Knopf ist da', inhalt.kopierknopf);
await w.zu();

/* Auf dem Handy darf nichts seitlich überlaufen — Codeblöcke sind der
   häufigste Grund dafür. */
const h = await oeffne('http://127.0.0.1:8905/welt/the-race-automatisierung',
  { port: 9337, breite: 520, hoehe: 900 });
await h.warte(3000);
const ueber = JSON.parse(await h.werte(`JSON.stringify({
  waagerecht: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  breite: document.documentElement.scrollWidth
})`));
pruefe('kein waagerechtes Scrollen auf dem Handy',
  !ueber.waagerecht, ueber.breite + ' px breit');
await h.zu();

/* Die Farbstimmung, ohne die Datenbank anzufassen: die Farbe wird direkt
   am fertigen Dokument angewendet, so wie das Startskript es täte. */
const fp = await oeffne('http://127.0.0.1:8905/welt/the-race-automatisierung', { port: 9337 });
await fp.warte(2500);
const farben = JSON.parse(await fp.werte(`(() => {
  const welt = document.getElementById('welt');
  const messe = (hex) => {
    welt.classList.remove('dunkel');
    welt.style.setProperty('--welt', hex);
    const h = hex.replace('#', '');
    const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
    if (0.2126 * r + 0.7152 * g + 0.0722 * b < 110) welt.classList.add('dunkel');
    const st = getComputedStyle(welt);
    return { dunkel: welt.classList.contains('dunkel'),
             grund: st.backgroundColor, schrift: st.color };
  };
  return JSON.stringify({ hell: messe('#E8863B'), dunkel: messe('#1B1B20') });
})()`));
pruefe('eine helle Farbe lässt die Welt hell', !farben.hell.dunkel, farben.hell.grund);
pruefe('eine dunkle Farbe schaltet die Welt dunkel', farben.dunkel.dunkel, farben.dunkel.grund);
pruefe('bei dunkler Stimmung ändert sich wirklich der Untergrund',
  farben.dunkel.grund !== farben.hell.grund,
  farben.hell.grund + ' -> ' + farben.dunkel.grund);
pruefe('bei dunkler Stimmung ändert sich auch die Schriftfarbe',
  farben.dunkel.schrift !== farben.hell.schrift,
  farben.hell.schrift + ' -> ' + farben.dunkel.schrift);
await fp.zu();

/* ---------- Die Werkzeug-Nachbildung: nur "Geld" ist bedienbar ----------
   Die uebrigen Reiter zeigen, was das echte Werkzeug konnte, sind aber
   nicht hinterlegt. Frueher liessen sie sich anklicken und man landete auf
   einer Flaeche, die nur erklaerte, dass hier nichts ist -- ein Knopf, der
   ins Leere fuehrt. Jetzt sind sie sichtbar, aber gesperrt. */
{
  const d = await oeffne('http://127.0.0.1:8905/welt/the-race-automatisierung',
    { port: 9337, breite: 1100, hoehe: 900 });
  await d.warte(3000);
  const reiter = JSON.parse(await d.werte(`(() => {
    const r = [...document.querySelectorAll('.wz-art')];
    return JSON.stringify({
      anzahl: r.length,
      gesperrt: r.filter(x => x.disabled).map(x => x.textContent),
      offen: r.filter(x => !x.disabled).map(x => x.textContent),
    });
  })()`));
  pruefe('in der Nachbildung ist genau ein Reiter bedienbar — "Geld"',
    reiter.offen.length === 1 && reiter.offen[0] === 'Geld',
    'offen: ' + reiter.offen.join(', ') + ' · gesperrt: ' + reiter.gesperrt.join(', '));
  pruefe('…und es gibt überhaupt mehrere Reiter zu sperren (sonst wäre die Prüfung hohl)',
    reiter.anzahl >= 3, reiter.anzahl + ' Reiter');

  /* Der eigentliche Wunsch: klicken darf NICHTS bewirken. */
  const nachKlick = await d.werte(`(() => {
    const andere = [...document.querySelectorAll('.wz-art')].find(x => x.dataset.art !== 'Geld');
    andere.click();
    const aktiv = [...document.querySelectorAll('.wz-art')]
      .find(x => x.getAttribute('aria-pressed') === 'true');
    return aktiv ? aktiv.textContent : '—';
  })()`);
  pruefe('ein Klick auf einen gesperrten Reiter lässt die Ansicht auf "Geld"',
    nachKlick === 'Geld', 'aktiv danach: ' + nachKlick);

  const jsF = d.fehlerAufSeite();
  pruefe('keine JavaScript-Fehler auf der Werkzeug-Seite', jsF.length === 0, jsF.join(' | '));
  await d.zu();
}

await s.zu(); await f.zu(); chrome.beenden(); server.beenden();
bericht();
