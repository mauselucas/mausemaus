/* mausemaus — die geführte Anfrage (Kontaktformular unten im Brief).

   Das Formular steht vollständig in index.html. Ohne dieses Skript stehen
   alle Fragen untereinander, und der Knopf "Anfrage senden" schickt ganz
   normal an Formspree ab. Alles hier ist Zugabe:

   - immer nur EINE Frage auf einmal, mit Fortschritt im Stil der Zeitleiste
   - je nach Antwort auf "Worum geht's?" ein eigener Pfad
   - zum Schluss die Anfrage als kleiner Brief ("Passt das so?")
   - Absenden ohne Seitenwechsel, mit sprechender Betreffzeile und der Katze

   Die festen Texte kommen aus assets/texte.js (Schluessel "anf-…"); fehlt
   dort einer, steht der deutsche Text aus dem zweiten Argument von T(). */
(function () {
  var form = document.getElementById('anfragen');
  if (!form) return;

  var T = function (schluessel, deutsch) {
    return (window.mmText ? window.mmText(schluessel) : '') || deutsch;
  };
  var en = window.mmSprache === 'en';

  var $ = function (sel) { return form.querySelector(sel); };
  var gleis = $('.anf-gleis');
  var kopf = $('.anf-kopf');
  var fehler = $('.anf-fehler');
  var leiste = $('.anf-leiste');
  var weiter = $('#anf-weiter');
  var zurueck = $('.anf-zurueck:not(.anf-neu)');
  var neu = $('.anf-neu');
  var antwort = document.getElementById('anfrage-antwort');
  var katze = document.getElementById('anfrage-katze');
  var briefTeil = $('[data-schritt="brief"]');
  var papier = $('.anf-papier');
  var betreffFeld = $('[name="_subject"]');

  /* Ab hier fuehrt das Skript. noValidate, weil sonst die Pflichtfelder der
     LETZTEN Frage (Name, E-Mail) schon beim ersten "Weiter" angemeckert
     wuerden -- geprueft wird stattdessen Schritt fuer Schritt in pruefen().
     Die Sprache als default value (Attribut), damit form.reset() sie nicht
     wieder auf "de" zuruecksetzt. */
  form.classList.add('anf-js');
  form.noValidate = true;
  $('[name="sprache"]').setAttribute('value', en ? 'en' : 'de');
  briefTeil.hidden = false;
  briefTeil.classList.add('anf-schritt');
  leiste.hidden = false;

  var PFADE = {
    'Auftrag':        ['art', 'a-was', 'a-umfang', 'a-budget', 'du', 'brief'],
    'Zusammenarbeit': ['art', 'kollab', 'du', 'brief'],
    'Job-Angebot':    ['art', 'job', 'du', 'brief'],
    'Was anderes':    ['art', 'anders', 'du', 'brief']
  };
  /* Solange "Worum geht's?" offen ist, steht der kuerzeste Pfad als
     Vorschau im Gleis -- vier Stufen statt einer leeren Leiste. */
  var STANDARD = ['art', '…', 'du', 'brief'];
  var stelle = 0;

  function wert(name) { var el = $('[name="' + name + '"]:checked'); return el ? el.value : ''; }
  function werte(name) {
    return Array.prototype.map.call(form.querySelectorAll('[name="' + name + '"]:checked'),
      function (e) { return e.value; });
  }
  function feld(name) { return ((form.elements[name] && form.elements[name].value) || '').trim(); }
  function pfad() { return PFADE[wert('kategorie')] || STANDARD; }
  function teil(id) { return $('[data-schritt="' + id + '"]'); }

  function gleisBauen(n, i) {
    gleis.querySelectorAll('i').forEach(function (x) { x.remove(); });
    for (var k = 0; k < n; k++) {
      var s = document.createElement('i');
      if (k <= i) s.className = 'fertig';
      gleis.insertBefore(s, kopf);
    }
    var ziel = gleis.querySelectorAll('i')[i];
    if (ziel) kopf.style.left = Math.min(ziel.offsetLeft + ziel.offsetWidth, gleis.offsetWidth - 12) + 'px';
  }

  function zeigen(fokus) {
    var p = pfad(), id = p[stelle];
    form.querySelectorAll('.anf-schritt').forEach(function (s) {
      s.classList.toggle('aktiv', s.dataset.schritt === id);
    });
    var t = teil(id);
    var nr = t.querySelector('.anf-nummer');
    if (nr) nr.textContent = id === 'brief'
      ? T('anf-letzter', 'Letzter Blick')
      : T('anf-frage-von', 'Frage {a} von {b}').replace('{a}', stelle + 1).replace('{b}', p.length - 1);
    gleisBauen(p.length, stelle);
    zurueck.hidden = stelle === 0;
    weiter.textContent = id === 'brief' ? T('anf-senden', 'Anfrage senden') : T('anf-weiter', 'Weiter');
    if (id === 'brief') briefSchreiben();
    if (fokus) {
      var kopfzeile = t.querySelector('legend, .anf-frage');
      if (kopfzeile) kopfzeile.focus({ preventScroll: true });
      /* Wer weit unten auf "Weiter" gedrueckt hat, steht sonst mitten in
         der naechsten Frage. scrollIntoView statt window.scrollTo: auf dem
         Rechner scrollt nicht das Fenster, sondern #scroller. */
      if (gleis.getBoundingClientRect().top < 0) {
        var ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        gleis.scrollIntoView({ block: 'start', behavior: ruhig ? 'auto' : 'smooth' });
      }
    }
  }

  function pruefen(id) {
    switch (id) {
      case 'art':      return wert('kategorie') ? '' : T('anf-f-wahl', 'Wähl eine Option aus, dann geht’s weiter.');
      case 'a-was':    return werte('arten').length ? '' : T('anf-f-mehr', 'Wähl mindestens eine Option aus.');
      case 'a-umfang': return wert('umfang') && wert('frist') ? '' : T('anf-f-beide', 'Wähl einen Umfang und einen Zeitraum aus.');
      case 'a-budget': return wert('budget') ? '' : T('anf-f-wahl', 'Wähl eine Option aus, dann geht’s weiter.');
      case 'kollab':   return feld('idee') ? '' : T('anf-f-idee', 'Schreib ein, zwei Sätze zu deiner Idee.');
      case 'job':      return feld('firma') ? '' : T('anf-f-firma', 'Sag mir die Firma oder den Kanal.');
      case 'anders':   return feld('nachricht') ? '' : T('anf-f-text', 'Schreib kurz, worum es geht.');
      case 'du':
        if (!feld('name')) return T('anf-f-name', 'Sag mir deinen Namen.');
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(feld('email'))
          ? '' : T('anf-f-mail', 'Die E-Mail-Adresse sieht noch nicht richtig aus.');
    }
    return '';
  }

  /* Die Betreffzeile ist fuer Lucas' Postfach und deshalb immer deutsch --
   * die Werte (value) der Felder sind es auch. "EN" am Ende sagt ihm, dass
   * er besser englisch antwortet. */
  function betreff() {
    var k = wert('kategorie');
    var teile = ['[' + k + ']'];
    if (k === 'Auftrag') {
      teile.push(werte('arten').join(', '));
      teile.push(wert('budget'));
      teile.push(wert('frist'));
      if (wert('umfang') === 'regelmäßig') teile.push('regelmäßig');
    } else if (k === 'Job-Angebot') {
      teile.push([feld('firma'), wert('jobart')].filter(Boolean).join(', '));
    }
    teile.push(feld('name'));
    if (en) teile.push('EN');
    return teile.filter(Boolean).join(' · ');
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  /* Fuer den Brief zaehlt der SICHTBARE Text der Auswahl -- der ist schon
     in der richtigen Sprache, weil sprache.js ihn getauscht hat. */
  function sichtbar(input) { return input.parentNode.querySelector('span').textContent; }
  function label(name) { var el = $('[name="' + name + '"]:checked'); return el ? sichtbar(el) : ''; }
  function labels(name) { return Array.prototype.map.call(form.querySelectorAll('[name="' + name + '"]:checked'), sichtbar); }
  /* Deutsch: Nomen bleiben gross, nur ein Satzanfang wie "So schnell …"
     wird klein. Englisch: alles klein. */
  function klein(x) {
    if (en) return x.toLowerCase();
    return /^(So|In|Kein|Weiß|Unter|Über)\b/.test(x) ? x.charAt(0).toLowerCase() + x.slice(1) : x;
  }
  function liste(a) {
    if (en) a = a.map(function (x) { return x.toLowerCase(); });
    var und = en ? ' and ' : ' und ';
    return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + und + a[a.length - 1];
  }

  function briefSchreiben() {
    var k = wert('kategorie'), s = [];
    var name = esc(feld('name'));
    var gef = label('gefunden');
    s.push(en ? 'I’m ' + name + (gef ? ' and found you via ' + esc(gef) : '') + '.'
              : 'ich bin ' + name + (gef ? ' und bin über ' + esc(gef) + ' auf dich gestoßen' : '') + '.');
    if (k === 'Auftrag') {
      s.push((en ? 'I’d like ' : 'Ich bräuchte ') + '<strong>' + esc(liste(labels('arten'))) + '</strong>' +
        (en ? ', as ' + (wert('umfang') === 'einmalig' ? 'a one-off project' : 'ongoing work')
            : (wert('umfang') === 'einmalig' ? ', als einmaliges Projekt' : ', regelmäßig')) +
        (feld('menge') ? ' (' + esc(feld('menge')) + ')' : '') + '.');
      s.push((en ? 'Timing: ' : 'Zeitlich: ') + esc(klein(label('frist'))) + '. Budget: ' + esc(klein(label('budget'))) + '.');
      if (feld('links')) s.push('Links: ' + esc(feld('links')));
      if (feld('nachricht_auftrag')) s.push(esc(feld('nachricht_auftrag')));
    } else if (k === 'Zusammenarbeit') {
      s.push(en ? 'I’d like to make something together with you.' : 'Ich würde gern was mit dir zusammen machen.');
      if (feld('kanal')) s.push((en ? 'My channel: ' : 'Mein Kanal: ') + esc(feld('kanal')));
      s.push(esc(feld('idee')));
    } else if (k === 'Job-Angebot') {
      s.push((en ? 'I have a job offer from ' : 'Ich hab ein Job-Angebot von ') + '<strong>' + esc(feld('firma')) + '</strong>' +
        (feld('rolle') ? (en ? ' for the role ' : ' für die Rolle ') + esc(feld('rolle')) : '') +
        (wert('jobart') ? ' (' + esc(klein(label('jobart'))) + ')' : '') + '.');
    } else {
      s.push(esc(feld('nachricht')));
    }
    var h = '<p class="anf-anrede">Hi Lucas,</p>';
    s.forEach(function (x) { h += '<p>' + x.replace(/\n/g, '<br>') + '</p>'; });
    h += '<p class="anf-gruss">' + (en ? 'Best,' : 'Liebe Grüße') + '<br>' + name +
         '<br><span class="anf-leise">' + esc(feld('email')) + '</span></p>';
    papier.innerHTML = h;
  }

  /* ---------- Die Katze ----------
     Zwei Fassungen derselben Datei: bewegt, und ein Standbild fuer alle mit
     "Bewegung reduzieren". <picture> waehlt selbst und holt NUR die
     gewaehlte. Der Dateiname traegt einen Fingerabdruck des GIFs
     (tests/katze-wandeln.mjs), darum kein ?v=-Stempel. Feste Masse, damit
     beim Nachladen nichts springt. */
  function katzeZeigen() {
    if (!katze || katze.firstChild) return;
    katze.innerHTML =
      '<picture>' +
        '<source media="(prefers-reduced-motion: reduce)" ' +
                'srcset="/assets/katze-924d154c-standbild.webp">' +
        '<img src="/assets/katze-924d154c.webp" alt="" ' +
             'width="160" height="116" decoding="async">' +
      '</picture>';
  }

  function fremdePfade(aus) {
    var k = wert('kategorie');
    form.querySelectorAll('fieldset[data-pfad]').forEach(function (fs) {
      fs.disabled = aus && fs.dataset.pfad !== k;
    });
  }

  function senden() {
    /* Felder fremder Pfade abschalten -- abgeschaltete Felder nimmt
       FormData nicht mit. Wer erst "Auftrag" angefangen und dann zu
       "Job-Angebot" gewechselt hat, schickt so keine halben Auftragsdaten. */
    fremdePfade(true);
    betreffFeld.value = betreff();

    /* Ohne fetch (sehr alter Browser): ganz normal abschicken. */
    if (!window.fetch) { form.submit(); return; }

    antwort.className = 'br-formular-antwort';
    antwort.textContent = T('form-sendet', 'Wird gesendet …');
    if (katze) katze.innerHTML = '';
    weiter.disabled = true;
    var daten = new FormData(form);
    fremdePfade(false);
    fetch(form.action, {
      method: 'POST',
      body: daten,
      headers: { 'Accept': 'application/json' }
    }).then(function (r) {
      if (r.ok) return angekommen();
      return r.json().then(function (d) {
        throw new Error((d.errors || []).map(function (f) { return f.message; }).join(', ')
          || T('form-schlecht', 'Das hat nicht geklappt.'));
      });
    }).catch(function (err) {
      antwort.className = 'br-formular-antwort schlecht';
      /* Bewusst mit Ausweg: wer hier haengenbleibt, soll trotzdem
         schreiben koennen, statt einfach abzuspringen. */
      antwort.textContent = (err.message || T('form-schlecht', 'Das hat nicht geklappt.'))
        + T('form-schlecht-zusatz', ' Schreib mir sonst direkt an lucasschoenwald03@gmail.com.');
    }).then(function () { weiter.disabled = false; });
  }

  /* Nach dem Erfolg verschwinden die Fragen; stehen bleiben Satz, Katze und
     ein Weg zurueck fuer eine zweite Anfrage. */
  function angekommen() {
    form.reset();
    betreffFeld.value = betreffFeld.defaultValue;
    stelle = 0;
    form.classList.add('anf-fertig');
    neu.hidden = false;
    antwort.className = 'br-formular-antwort gut';
    antwort.textContent = T('form-gut', 'Angekommen! Ich melde mich.');
    katzeZeigen();
    antwort.focus({ preventScroll: true });
  }

  neu.addEventListener('click', function () {
    form.classList.remove('anf-fertig');
    neu.hidden = true;
    antwort.className = 'br-formular-antwort';
    antwort.textContent = '';
    if (katze) katze.innerHTML = '';
    stelle = 0;
    zeigen(true);
  });

  form.addEventListener('change', function (e) {
    fehler.textContent = '';
    if (e.target.name === 'kategorie') zeigen(false);
  });

  zurueck.addEventListener('click', function () {
    fehler.textContent = '';
    if (stelle > 0) { stelle--; zeigen(true); }
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (form.classList.contains('anf-fertig')) return;
    var id = pfad()[stelle];
    var f = pruefen(id);
    if (f) { fehler.textContent = f; return; }
    fehler.textContent = '';
    if (id !== 'brief') { stelle++; zeigen(true); return; }
    senden();
  });

  var ruhe = null;
  window.addEventListener('resize', function () {
    clearTimeout(ruhe);
    ruhe = setTimeout(function () { gleisBauen(pfad().length, stelle); }, 100);
  });
  /* anfrage.css kommt nicht blockierend nach (siehe index.html). Bis dahin
     ist das Gleis noch nicht gezeichnet und laesst sich nicht vermessen --
     nach dem Laden einmal nachrechnen, damit die Blume richtig sitzt. */
  window.addEventListener('load', function () { gleisBauen(pfad().length, stelle); });
  zeigen(false);
})();
