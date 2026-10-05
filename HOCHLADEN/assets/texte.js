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
    'sprache-waehlen':    { de: 'Sprache wählen', en: 'Choose language' },
    /* Bewusst in BEIDEN Sprachen niederlaendisch: der Satz ist die
       Antwort auf einen Klick auf "Nederlands". */
    'sprache-bald':       { de: 'nog niet mogelijk :(', en: 'nog niet mogelijk :(' },
    'sprung':             { de: 'Zum Brief springen', en: 'Skip to the letter' },

    /* --- Die Leiste --- */
    'leiste-nav':         { de: 'Abschnitte des Briefs', en: 'Sections of the letter' },
    'leiste-beruflich':   { de: 'berufliche Projekte', en: 'client work' },
    'leiste-persoenlich': { de: 'persönliches', en: 'personal' },
    'leiste-griff':       { de: 'offen halten', en: 'keep open' },

    /* --- Die gefuehrte Anfrage (assets/anfrage.js) --- */
    'anf-einleitung':      { de: 'Ein paar kurze Fragen, damit ich gleich weiß, worum es geht. Dauert keine zwei Minuten.', en: 'A few quick questions so I know what it’s about right away. Takes less than two minutes.' },
    'anf-art-frage':       { de: 'Worum geht’s?', en: 'What’s it about?' },
    'anf-art-auftrag':     { de: 'Ich hab einen Auftrag für dich', en: 'I have a project for you' },
    'anf-art-kollab':      { de: 'Lass uns was zusammen machen', en: 'Let’s make something together' },
    'anf-art-job':         { de: 'Ich hab ein Job-Angebot', en: 'I have a job offer' },
    'anf-art-anders':      { de: 'Was anderes', en: 'Something else' },
    'anf-was-frage':       { de: 'Was soll entstehen?', en: 'What should we make?' },
    'anf-was-hinweis':     { de: 'Mehrere gehen.', en: 'Pick as many as you like.' },
    'anf-was-schnitt':     { de: 'Videoschnitt', en: 'Video editing' },
    'anf-was-motion':      { de: 'Motion Graphics & Animation', en: 'Motion graphics & animation' },
    'anf-was-intro':       { de: 'Intro & Branding', en: 'Intro & branding' },
    'anf-was-doku':        { de: 'Doku & Longform', en: 'Documentary & longform' },
    'anf-was-shorts':      { de: 'Shorts & Reels', en: 'Shorts & reels' },
    'anf-umfang-frage':    { de: 'Wie viel und bis wann?', en: 'How much and by when?' },
    'anf-umfang-art':      { de: 'Umfang', en: 'Scope' },
    'anf-umfang-einmal':   { de: 'Einmaliges Projekt', en: 'One-off project' },
    'anf-umfang-regel':    { de: 'Regelmäßig', en: 'Ongoing' },
    'anf-menge':           { de: 'Ungefähr wie viel? (optional)', en: 'Roughly how much? (optional)' },
    'anf-menge-ph':        { de: 'z. B. 3 Videos à 10 Minuten', en: 'e.g. 3 videos, 10 minutes each' },
    'anf-frist':           { de: 'Bis wann', en: 'By when' },
    'anf-frist-asap':      { de: 'So schnell wie möglich', en: 'As soon as possible' },
    'anf-frist-wochen':    { de: 'In 2–4 Wochen', en: 'In 2–4 weeks' },
    'anf-frist-monate':    { de: 'In 1–3 Monaten', en: 'In 1–3 months' },
    'anf-frist-offen':     { de: 'Kein fester Termin', en: 'No fixed date' },
    'anf-budget-frage':    { de: 'Welches Budget hast du im Kopf?', en: 'What budget do you have in mind?' },
    'anf-budget-hinweis':  { de: 'Eine grobe Richtung reicht. So kann ich dir direkt etwas Passendes vorschlagen.', en: 'A rough range is enough. It helps me suggest something that fits.' },
    'anf-b1':              { de: 'Unter 300 €', en: 'Under €300' },
    'anf-b2':              { de: '300–1.000 €', en: '€300–1,000' },
    'anf-b3':              { de: '1.000–3.000 €', en: '€1,000–3,000' },
    'anf-b4':              { de: 'Über 3.000 €', en: 'Over €3,000' },
    'anf-b5':              { de: 'Weiß ich noch nicht', en: 'Not sure yet' },
    'anf-links':           { de: 'Link zu deinem Kanal oder Beispielen (optional)', en: 'Link to your channel or examples (optional)' },
    'anf-noch':            { de: 'Sonst noch was, das ich wissen sollte? (optional)', en: 'Anything else I should know? (optional)' },
    'anf-kollab-frage':    { de: 'Erzähl mir von deiner Idee.', en: 'Tell me about your idea.' },
    'anf-kollab-kanal':    { de: 'Link zu deinem Kanal oder Profil (optional)', en: 'Link to your channel or profile (optional)' },
    'anf-kollab-idee':     { de: 'Was schwebt dir vor?', en: 'What do you have in mind?' },
    'anf-job-frage':       { de: 'Erzähl mir vom Job.', en: 'Tell me about the job.' },
    'anf-job-firma':       { de: 'Firma oder Kanal', en: 'Company or channel' },
    'anf-job-rolle':       { de: 'Um welche Rolle geht’s? (optional)', en: 'Which role? (optional)' },
    'anf-job-rolle-ph':    { de: 'z. B. Video Editor', en: 'e.g. video editor' },
    'anf-job-art':         { de: 'Art', en: 'Type' },
    'anf-job-free':        { de: 'Freelance', en: 'Freelance' },
    'anf-job-teil':        { de: 'Teilzeit', en: 'Part-time' },
    'anf-job-voll':        { de: 'Vollzeit', en: 'Full-time' },
    'anf-anders-frage':    { de: 'Was liegt dir auf dem Herzen?', en: 'What’s on your mind?' },
    'anf-anders-feld':     { de: 'Deine Nachricht', en: 'Your message' },
    'anf-du-frage':        { de: 'Und wer bist du?', en: 'And who are you?' },
    'anf-du-name':         { de: 'Dein Name', en: 'Your name' },
    'anf-du-mail':         { de: 'Deine E-Mail', en: 'Your email' },
    'anf-du-gefunden':     { de: 'Wie bist du auf mich gestoßen? (optional)', en: 'How did you find me? (optional)' },
    'anf-g-empf':          { de: 'Empfehlung', en: 'Recommendation' },
    'anf-g-anders':        { de: 'Anders', en: 'Other' },
    'anf-brief-frage':     { de: 'Passt das so?', en: 'Does this look right?' },
    'anf-brief-hinweis':   { de: 'So kommt deine Anfrage bei mir an.', en: 'This is how your enquiry will reach me.' },
    'anf-weiter':          { de: 'Weiter', en: 'Next' },
    'anf-zurueck':         { de: 'Zurück', en: 'Back' },
    'anf-senden':          { de: 'Anfrage senden', en: 'Send enquiry' },
    'anf-neu':             { de: 'Noch eine Anfrage schreiben', en: 'Write another enquiry' },
    'anf-frage-von':       { de: 'Frage {a} von {b}', en: 'Question {a} of {b}' },
    'anf-letzter':         { de: 'Letzter Blick', en: 'Last look' },
    'anf-f-wahl':          { de: 'Wähl eine Option aus, dann geht’s weiter.', en: 'Pick an option to continue.' },
    'anf-f-mehr':          { de: 'Wähl mindestens eine Option aus.', en: 'Pick at least one option.' },
    'anf-f-beide':         { de: 'Wähl einen Umfang und einen Zeitraum aus.', en: 'Pick a scope and a timeframe.' },
    'anf-f-idee':          { de: 'Schreib ein, zwei Sätze zu deiner Idee.', en: 'Write a sentence or two about your idea.' },
    'anf-f-firma':         { de: 'Sag mir die Firma oder den Kanal.', en: 'Tell me the company or channel.' },
    'anf-f-text':          { de: 'Schreib kurz, worum es geht.', en: 'Write a few words so I know what it’s about.' },
    'anf-f-name':          { de: 'Sag mir deinen Namen.', en: 'Tell me your name.' },
    'anf-f-mail':          { de: 'Die E-Mail-Adresse sieht noch nicht richtig aus.', en: 'That email address doesn’t look right yet.' },

    /* --- Das Anfrageformular --- */
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
