/* mausemaus — Startseite: Kopfbereich, Laufband, Projektzeilen, Profil.
   Das Detail-Fenster kommt weiterhin aus site.js — nur der Aufbau davor ist neu. */

(() => {
  const { esc } = window.mm;
  const $ = (s) => document.querySelector(s);

  /* Fällt auf die Werte aus seed.js zurück, wenn die Datenbank schweigt. */
  async function ladeEinstellungen() {
    if (window.mmLoadSettings) {
      const e = await window.mmLoadSettings();
      if (e) return e;
    }
    return window.SEED_SETTINGS || {};
  }

  function kopfZeichnen(e) {
    $('#kicker').textContent  = e.hero_eyebrow || '';
    $('#zeile1').textContent  = e.hero_line1 || '';
    $('#zeile2').textContent  = e.hero_line2 || '';
    $('#kopftext').textContent = e.hero_intro || '';

    /* Showreel-Knopf nur zeigen, wenn eine Adresse hinterlegt ist */
    const sr = $('#showreel');
    if (e.showreel_url) { sr.href = e.showreel_url; sr.hidden = false; }
    else sr.hidden = true;

    $('#infozeile').innerHTML = (e.infos || []).map(i => `
      <div class="info">
        <div class="info-titel">${esc(i.titel || '')}</div>
        <div class="info-zeile">${i.punkt ? '<span class="info-punkt"></span>' : ''}${esc(i.zeile1 || '')}</div>
        ${i.zeile2 ? `<div class="info-zeile leise">${esc(i.zeile2)}</div>` : ''}
      </div>`).join('');

    /* Laufband: Liste doppelt ausgeben, damit der Umlauf nahtlos ist */
    const kunden = e.kunden || [];
    if (kunden.length) {
      const einmal = kunden.map(k => `<span>${esc(k)}</span>`).join('');
      $('#laufband').innerHTML = `<div class="laufband-spur">${einmal}${einmal}</div>`;
    } else $('#laufband').closest('.laufband').hidden = true;
  }

  function projekteZeichnen(liste) {
    $('#zahl').textContent = String(liste.length).padStart(2, '0') + ' Projekte';
    $('#zeilen').innerHTML = liste.map((p, i) => `
      <button class="pzeile" data-slug="${esc(p.slug)}" aria-haspopup="dialog">
        <div class="pzeile-bild">
          ${p.cover_url ? `<img src="${esc(p.cover_url)}" alt=""
            style="--pos:${esc(p.cover_pos || '50% 50%')}" loading="${i < 2 ? 'eager' : 'lazy'}">` : ''}
        </div>
        <div class="pzeile-nr" aria-hidden="true">${String(i + 1).padStart(2, '0')}</div>
        ${p.is_live ? '<span class="pzeile-live"><i></i> Läuft aktuell</span>' : ''}
        <div class="pzeile-karte">
          <div class="pzeile-rolle">${esc(p.role || '')}</div>
          <div class="pzeile-titel tropi">${esc(p.title)}</div>
          <div class="pzeile-text">${esc(p.summary || '')}</div>
          <div class="pzeile-fuss">
            <div class="pzeile-tags">${(p.tags || []).map(t => `<span class="pill">${esc(t)}</span>`).join('')}</div>
            <span class="pzeile-cta">Ansehen <span class="pfeil">→</span></span>
          </div>
        </div>
      </button>`).join('');
  }

  function profilZeichnen(e) {
    $('#profil-kicker').textContent = e.profil_kicker || '';
    $('#profil-titel').textContent  = e.profil_titel || '';
    $('#profil-text').textContent   = e.profil_text || '';

    $('#werkzeuge').innerHTML = (e.werkzeuge || []).map(w => `
      <div class="werkzeug"><span>${esc(w.name || '')}</span>
        <span class="stufe">${esc(w.stufe || '')}</span></div>`).join('');

    /* Ohne Porträt wird die ganze Bildspalte ausgeblendet — eine große leere
       Fläche sieht nach Fehler aus, gerade auf dem Handy. */
    const b = $('#portraet');
    if (e.portrait_url) {
      b.innerHTML = `<img src="${esc(e.portrait_url)}" alt="Lucas Schönwald"
        style="--pos:${esc(e.portrait_pos || '50% 50%')}">`;
      b.closest('.profil').classList.remove('ohne-bild');
    } else {
      b.innerHTML = '';
      b.closest('.profil').classList.add('ohne-bild');
    }
  }

  function kontaktZeichnen(e) {
    $('#kontakt-titel').textContent = e.kontakt_titel || '';
    const d = $('#kontakt-daten');
    d.innerHTML = [
      e.email   ? `<a href="mailto:${esc(e.email)}">${esc(e.email)}</a>` : '',
      e.telefon ? `<a href="tel:${esc(e.telefon.replace(/\s/g, ''))}">${esc(e.telefon)}</a>` : '',
      e.kontakt_zusatz ? `<span class="leise">${esc(e.kontakt_zusatz)}</span>` : '',
    ].filter(Boolean).join('');
  }

  /* Nach dem Absenden hängt Netlify ?danke=1 an — dann Dank statt Formular zeigen */
  function dankePruefen() {
    if (new URLSearchParams(location.search).get('danke') !== '1') return;
    $('#anfrage').innerHTML =
      '<p class="anfrage-danke"><strong>Danke, ist angekommen.</strong><br>'
      + 'Ich melde mich meist noch am selben Tag.</p>';
  }

  window.mmStartseite = async function (projekte) {
    const e = await ladeEinstellungen();
    kopfZeichnen(e);
    projekteZeichnen(projekte);
    profilZeichnen(e);
    kontaktZeichnen(e);
    dankePruefen();
  };
})();
