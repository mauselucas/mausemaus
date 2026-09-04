/* mausemaus — die FESTEN Texte der Oberfläche in beiden Sprachen.

   Hier steht ausschliesslich, was fest in der Seite verdrahtet ist:
   Beschriftungen, Rückmeldungen, Vorlese-Namen. Der INHALT (Brief, Welten,
   Projekte) steht nicht hier -- der kommt aus der Datenbank und wird im
   Admin übersetzt (Spalte `inhalt_en`, siehe assets/sprache.js).

   Deutsch ist die Vorlage: Im HTML steht der deutsche Text ausgeschrieben da,
   und `sprache.js` tauscht ihn NUR bei Englisch aus. Faellt dieses Woerterbuch
   aus oder fehlt ein Schluessel, bleibt der deutsche Text stehen -- nie eine
   leere Stelle. */
(() => {
  window.MM_TEXTE = {
    /* --- Rahmen --- */
    'sprache-gruppe':     { de: 'Sprache', en: 'Language' },
    'sprung':             { de: 'Zum Brief springen', en: 'Skip to the letter' },

    /* --- Die Leiste --- */
    'leiste-nav':         { de: 'Abschnitte des Briefs', en: 'Sections of the letter' },
    'leiste-beruflich':   { de: 'berufliche Projekte', en: 'client work' },
    'leiste-persoenlich': { de: 'persönliches', en: 'personal' },
    'leiste-griff':       { de: 'offen halten', en: 'keep open' },

    /* --- Das Anfrageformular --- */
    'form-name':          { de: 'Dein Name', en: 'Your name' },
    'form-email':         { de: 'Deine E-Mail', en: 'Your email' },
    'form-email-lang':    { de: 'Deine E-Mail-Adresse', en: 'Your email address' },
    'form-nachricht':     { de: 'Worum geht’s?', en: 'What’s it about?' },
    'form-senden':        { de: 'Anfrage senden →', en: 'Send enquiry →' },
    'form-leer-lassen':   { de: 'Bitte leer lassen:', en: 'Please leave empty:' },
    'form-betreff':       { de: 'Neue Anfrage über mausemaus.com', en: 'New enquiry via mausemaus.com' },
    'form-sendet':        { de: 'Wird gesendet …', en: 'Sending …' },
    'form-gut':           { de: 'Angekommen! Ich melde mich.', en: 'Got it! I’ll be in touch.' },
    'form-schlecht':      { de: 'Das hat nicht geklappt.', en: 'That didn’t work.' },
    'form-schlecht-zusatz': {
      de: ' Schreib mir sonst direkt an lucasschoenwald03@gmail.com.',
      en: ' Otherwise just write to me at lucasschoenwald03@gmail.com.',
    },
    'form-danke': {
      de: 'Angekommen — ich melde mich, meistens noch am selben Tag.',
      en: 'Got it — I’ll get back to you, usually the same day.',
    },

    /* --- Blöcke und Inhalt --- */
    'tuer-mehr':          { de: 'Mehr dazu', en: 'Read more' },
    'laeuft-aktuell':     { de: 'läuft aktuell', en: 'ongoing' },
    'video':              { de: 'Video', en: 'Video' },
    'video-abspielen':    { de: 'Video abspielen', en: 'Play video' },
    'code-kopieren':      { de: 'Kopieren', en: 'Copy' },
    'code-kopiert':       { de: 'Kopiert!', en: 'Copied!' },
    'code-ging-nicht':    { de: 'Ging nicht', en: 'Didn’t work' },
    'demo-fehlt':         { de: 'Diese Einlage ist nicht hinterlegt.', en: 'This element is not available.' },

    /* --- Eine Welt --- */
    'welt-zurueck':       { de: '← zurück in den Brief', en: '← back to the letter' },
    'welt-nicht-gefunden': { de: 'Nicht gefunden', en: 'Not found' },
    'welt-nichts-titel':  { de: 'Hier ist nichts.', en: 'Nothing here.' },
    'welt-nichts-text':   { de: 'Diese Tür führt ins Leere. Zurück in den Brief?', en: 'This door leads nowhere. Back to the letter?' },

    /* --- Die Fehlerseite --- */
    '404-titel':          { de: 'Diese Seite gibt es nicht', en: 'This page doesn’t exist' },
    '404-text': {
      de: 'Vielleicht vertippt, vielleicht ist sie umgezogen. Von hier kommst du wieder rein:',
      en: 'Maybe a typo, maybe it moved. Here’s the way back in:',
    },
    '404-start':          { de: '← Zur Startseite', en: '← To the homepage' },
    '404-arbeiten':       { de: 'Arbeiten ansehen', en: 'See the work' },
    '404-schreib':        { de: 'Schreib mir', en: 'Write to me' },
    '404-ort':            { de: 'Köln · offen für Projekte', en: 'Cologne · open for projects' },
  };
})();
