/* Beweis: Chrome fernsteuern ohne eine einzige fremde Abhängigkeit. */
const port = 9333;

async function seite(url) {
  const ziel = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`,
    { method: 'PUT' })).json();
  const ws = new WebSocket(ziel.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let n = 0; const offen = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (offen.has(m.id)) offen.get(m.id)(m); };
  const ruf = (method, params = {}) => new Promise(res => { const id = ++n;
    offen.set(id, res); ws.send(JSON.stringify({ id, method, params })); });

  await ruf('Page.enable');
  await ruf('Runtime.enable');
  return {
    async werte(ausdruck) {
      const r = await ruf('Runtime.evaluate',
        { expression: ausdruck, returnByValue: true, awaitPromise: true });
      if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text);
      return r.result.result.value;
    },
    async warte(ms) { await new Promise(r => setTimeout(r, ms)); },
    async zu() { ws.close(); await fetch(`http://127.0.0.1:${port}/json/close/${ziel.id}`); }
  };
}

const s = await seite('https://mausemaus.com');
await s.warte(2500);
const ergebnis = await s.werte(`JSON.stringify({
  titel: document.title,
  projekte: document.querySelectorAll('.pzeile').length,
  schriftGeladen: document.fonts.check('16px Tropi'),
  hoehe: document.body.scrollHeight
})`);
console.log(ergebnis);
await s.zu();
