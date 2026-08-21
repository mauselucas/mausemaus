/* mausemaus — Nachbildung des Eingabe-Panels aus "The Race".
   Zweck: zeigen, wie das Werkzeug bedient wurde. Es rendert nichts —
   die Umrechnung in Euro rechnet aber echt, damit die Bedienung stimmig ist. */

(() => {
  /* Farben aus dem Original-Screenshot gemessen */
  const LEUTE = [
    { name: 'JP\nEssow',     farbe: '#DE00FF' },
    { name: 'Helge\nOT',     farbe: '#0078FF' },
    { name: 'Magda\nFranz',  farbe: '#43AF35' },
    { name: 'Adrian\nFalk',  farbe: '#F99E39' },
    { name: 'Jerry\nKodiak', farbe: '#FF0000' },
  ];

  const ARTEN = ['Geld', 'Uhrzeit', 'Temperatur', 'Übersicht', 'Information'];

  /* Hinterlegte Kurse — Beispielwerte, wie sie im Werkzeug als Tabelle lagen.
     Wert = wie viele Einheiten dieser Währung auf einen Euro kommen. */
  const KURSE = {
    VND: 27000, IDR: 17200, LAK: 23500, THB: 39, MYR: 5.1, PHP: 61, EUR: 1,
  };

  const eur = (n) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  window.MM_DEMOS = window.MM_DEMOS || {};

  window.MM_DEMOS['the-race-pipeline'] = function (wurzel) {
    let person = 0, art = 'Geld', warteschlange = 0, laeuft = false;
    let vorher  = [{ betrag: '1880000', w: 'VND' }, { betrag: '50000', w: 'IDR' }];
    let dazu    = [{ betrag: '30000',   w: 'LAK' }];

    wurzel.innerHTML = `
      <div class="werkzeug">
        <div class="wz-titelleiste">
          <span class="wz-ampel"><i></i><i></i><i></i></span>
          <span class="wz-name">The Race — Grafik</span>
        </div>
        <div class="wz-koerper">
          <aside class="wz-seite">
            <div class="wz-titel">Teilnehmer</div>
            <div id="wz-leute"></div>
          </aside>
          <main class="wz-haupt">
            <div class="wz-seg" id="wz-arten" role="tablist"></div>
            <div id="wz-inhalt"></div>
            <div class="wz-fuss">
              <button class="wz-knopf" id="wz-import">Tabelle importieren</button>
              <div class="wz-fuss-rechts">
                <span class="wz-zaehler" id="wz-zaehler">0 in Warteschlange</span>
                <button class="wz-knopf" id="wz-queue">Hinzufügen</button>
                <button class="wz-knopf haupt" id="wz-render">Rendern</button>
              </div>
            </div>
            <div class="wz-fortschritt" id="wz-fortschritt" hidden>
              <div class="wz-balken"><i id="wz-balken-i"></i></div>
              <div class="wz-protokoll" id="wz-protokoll"></div>
            </div>
          </main>
        </div>
        <div class="wz-fussnote">Bedienbare Nachbildung der Oberfläche · die Euro-Summe wird echt berechnet</div>
      </div>`;

    const $ = (s) => wurzel.querySelector(s);

    /* ---------- Teilnehmer und Animationsart ---------- */
    $('#wz-leute').innerHTML = LEUTE.map((p, i) => `
      <button class="wz-person" data-i="${i}" aria-pressed="${i === person}">
        <i style="background:${p.farbe}"></i>${p.name.replace('\n', ' ')}</button>`).join('');

    $('#wz-arten').innerHTML = ARTEN.map(a => `
      <button class="wz-art" role="tab" data-art="${a}" aria-pressed="${a === art}">${a}</button>`).join('');

    $('#wz-leute').addEventListener('click', (e) => {
      const b = e.target.closest('.wz-person'); if (!b) return;
      person = +b.dataset.i;
      wurzel.querySelectorAll('.wz-person').forEach((x, i) =>
        x.setAttribute('aria-pressed', i === person));
    });

    $('#wz-arten').addEventListener('click', (e) => {
      const b = e.target.closest('.wz-art'); if (!b) return;
      art = b.dataset.art;
      wurzel.querySelectorAll('.wz-art').forEach(x =>
        x.setAttribute('aria-pressed', x.dataset.art === art));
      zeichneInhalt();
    });

    /* ---------- Eingabebereich ---------- */
    function summe() {
      const rechne = (liste) => liste.reduce((s, z) => {
        const n = parseFloat(String(z.betrag).replace(',', '.'));
        return s + (isFinite(n) ? n / (KURSE[z.w] || 1) : 0);
      }, 0);
      return rechne(vorher) + rechne(dazu);
    }

    function spalte(titel, liste, kennung) {
      return `<div>
        <div class="wz-spalte-titel">${titel}</div>
        ${liste.map((z, i) => `
          <div class="wz-zeile">
            <input class="wz-betrag" data-l="${kennung}" data-i="${i}" value="${z.betrag}"
                   inputmode="decimal" placeholder="Betrag">
            <select class="wz-waehrung" data-l="${kennung}" data-i="${i}">
              ${Object.keys(KURSE).map(w =>
                `<option ${w === z.w ? 'selected' : ''}>${w}</option>`).join('')}
            </select>
            ${liste.length > 1
              ? `<button class="wz-weg" data-weg="${kennung}" data-i="${i}" title="Zeile entfernen">×</button>`
              : ''}
          </div>`).join('')}
        <button class="wz-plus" data-plus="${kennung}">+ Währung</button>
      </div>`;
    }

    function zeichneInhalt() {
      if (art !== 'Geld') {
        $('#wz-inhalt').innerHTML =
          `<p class="wz-hinweis">Für „${art}" gab es im Werkzeug eigene Felder —
           in dieser Nachbildung ist nur „Geld" hinterlegt.</p>`;
        return;
      }
      $('#wz-inhalt').innerHTML = `
        <div class="wz-felder">
          ${spalte('Betrag vorher', vorher, 'vorher')}
          ${spalte('Kommt dazu', dazu, 'dazu')}
          <div class="wz-summe">
            <span>Zusammengerechnet in EUR</span>
            <b id="wz-summe">${eur(summe())}</b>
          </div>
        </div>
        <p class="wz-hinweis">Mehrere Währungen gleichzeitig, weil die Teilnehmenden durch
        mehrere Länder zogen — die Kurse lagen als Tabelle im Werkzeug.</p>`;
    }

    /* Eingaben verarbeiten — Delegation, damit Neuzeichnen nichts kaputt macht */
    wurzel.addEventListener('input', (e) => {
      const t = e.target;
      if (!t.dataset.l) return;
      const liste = t.dataset.l === 'vorher' ? vorher : dazu;
      if (t.classList.contains('wz-betrag')) liste[+t.dataset.i].betrag = t.value;
      if (t.classList.contains('wz-waehrung')) liste[+t.dataset.i].w = t.value;
      const s = $('#wz-summe');
      if (s) s.textContent = eur(summe());
    });

    wurzel.addEventListener('click', (e) => {
      const plus = e.target.closest('[data-plus]');
      if (plus) {
        (plus.dataset.plus === 'vorher' ? vorher : dazu).push({ betrag: '', w: 'THB' });
        return zeichneInhalt();
      }
      const weg = e.target.closest('[data-weg]');
      if (weg) {
        (weg.dataset.weg === 'vorher' ? vorher : dazu).splice(+weg.dataset.i, 1);
        return zeichneInhalt();
      }
    });

    /* ---------- Warteschlange und Rendern ---------- */
    const setzeZaehler = () => {
      $('#wz-zaehler').textContent = `${warteschlange} in Warteschlange`;
    };

    $('#wz-queue').addEventListener('click', () => {
      warteschlange++; setzeZaehler();
      protokoll(`+ ${LEUTE[person].name.replace('\n', ' ')} · ${art} · ${eur(summe())}`);
    });

    $('#wz-import').addEventListener('click', () => {
      warteschlange += 24; setzeZaehler();
      protokoll('Tabelle eingelesen — 24 Einblendungen übernommen');
    });

    function protokoll(zeile) {
      $('#wz-fortschritt').hidden = false;
      const p = $('#wz-protokoll');
      p.insertAdjacentHTML('beforeend', `<div>${zeile}</div>`);
      p.scrollTop = p.scrollHeight;
    }

    $('#wz-render').addEventListener('click', async () => {
      if (laeuft) return;
      if (!warteschlange) return protokoll('Warteschlange ist leer.');
      laeuft = true;
      const knoepfe = wurzel.querySelectorAll('.wz-knopf');
      knoepfe.forEach(b => b.disabled = true);

      const gesamt = warteschlange;
      const flott = matchMedia('(prefers-reduced-motion: reduce)').matches;
      for (let i = 1; i <= gesamt; i++) {
        await new Promise(r => setTimeout(r, flott ? 0 : 90));
        $('#wz-balken-i').style.width = (i / gesamt * 100) + '%';
        if (i % 4 === 0 || i === gesamt) protokoll(`gerendert ${i}/${gesamt}`);
      }
      protokoll(`fertig — ${gesamt} Einblendungen`);
      warteschlange = 0; setzeZaehler();
      knoepfe.forEach(b => b.disabled = false);
      laeuft = false;
    });

    setzeZaehler();
    zeichneInhalt();
  };
})();
