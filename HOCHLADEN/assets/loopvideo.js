/* mausemaus — Loop-Video statt GIF (nur im Admin geladen).

   Macht aus einer Videodatei (MP4, MOV, WebM …) oder einem GIF ein kleines,
   stummes MP4, das auf der Seite wie ein GIF endlos läuft:
     - höchstens 1280 px breit, höchstens 30 Bilder pro Sekunde
     - Ton komplett raus
     - H.264, damit es wirklich JEDER Browser abspielt
     - "Faststart": Die Inhaltsangabe steht am Anfang der Datei, das Video
       spielt also schon, während der Rest noch lädt
     - dazu ein Standbild (Poster), das sofort dasteht

   Gerechnet wird im Browser selbst (WebCodecs, über die Bibliothek
   Mediabunny) -- es gibt keinen Server, der das tun könnte. Die Bibliothek
   ist 690 kB groß und wird deshalb erst geladen, wenn wirklich ein Video
   gewählt wurde. Besucher der Seite bekommen sie nie.

   Klappt es nicht (zu alter Browser, unbekanntes Format), WIRFT die
   Funktion. admin.js lädt dann das Original hoch und sagt das dazu. */

const BIBLIOTHEK = '/assets/vendor/mediabunny-1.61.3.min.mjs';
const MAX_BREITE = 1280;
const MAX_BILDRATE = 30;

const gerade = (n) => Math.max(2, Math.round(n / 2) * 2);

/* Bitrate aus Fläche und Bildrate. 0,035 Bit pro Pixel und Bild ergibt bei
   1280×720 und 30 fps knapp 1 Mbit/s -- gemessen an den echten GIFs dieser
   Seite sieht das sauber aus und bleibt bei 10 s Länge um 1,2 MB. */
function bitrateFuer(breite, hoehe, fps) {
  const b = breite * hoehe * Math.min(fps || 25, MAX_BILDRATE) * 0.035;
  return Math.round(Math.min(2_500_000, Math.max(250_000, b)));
}

function zielMasse(b, h) {
  const breite = gerade(Math.min(MAX_BREITE, b));
  return { breite, hoehe: gerade(h * breite / b) };
}

export function istVideoDatei(datei) {
  return !!datei && (/^video\//.test(datei.type || '')
    || /\.(mp4|m4v|mov|webm|mkv)$/i.test(datei.name || ''));
}

/* Ein Bild aus dem fertigen MP4 als Poster. Ist das allererste Bild
   einfarbig (Schwarzblende, Weißblitz), nimmt es eins nach einer halben
   Sekunde -- sonst stünde bei "Bewegung reduzieren" nur eine leere Fläche
   da. */
async function posterAus(MB, mp4Puffer) {
  const input = new MB.Input({ source: new MB.BufferSource(mp4Puffer), formats: MB.ALL_FORMATS });
  const spur = await input.getPrimaryVideoTrack();
  const sink = new MB.CanvasSink(spur);
  const start = await spur.getFirstTimestamp();
  const dauer = await spur.computeDuration();
  let bild = await sink.getCanvas(start);
  if (bild && einfarbig(bild.canvas) && dauer > 0.8) {
    bild = (await sink.getCanvas(start + 0.5)) || bild;
  }
  if (!bild) throw new Error('Kein Standbild gefunden');
  return leinwandZuBild(bild.canvas);
}

function einfarbig(leinwand) {
  const c = document.createElement('canvas'); c.width = 32; c.height = 18;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(leinwand, 0, 0, 32, 18);
  const d = ctx.getImageData(0, 0, 32, 18).data;
  let summe = 0, quadrate = 0; const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) {
    const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    summe += y; quadrate += y * y;
  }
  const mittel = summe / n;
  return Math.sqrt(Math.max(0, quadrate / n - mittel * mittel)) < 6;
}

/* Safari kann aus einer Leinwand kein WebP schreiben und liefert still ein
   PNG. Dann lieber JPEG -- deutlich kleiner. Der Dateiname bleibt .webp
   (shared.js leitet das Poster daraus ab); Browser erkennen ein Bild am
   Inhalt, nicht an der Endung. */
async function leinwandZuBild(leinwand) {
  const alsBlob = (typ, guete) => leinwand.convertToBlob
    ? leinwand.convertToBlob({ type: typ, quality: guete })
    : new Promise(r => leinwand.toBlob(r, typ, guete));
  const webp = await alsBlob('image/webp', 0.8);
  if (webp && webp.type === 'image/webp') return webp;
  return alsBlob('image/jpeg', 0.82);
}

async function videoZuMp4(MB, datei, fortschritt) {
  const input = new MB.Input({ source: new MB.BlobSource(datei), formats: MB.ALL_FORMATS });
  const spur = await input.getPrimaryVideoTrack();
  if (!spur) throw new Error('In der Datei ist keine Bildspur');
  const { breite, hoehe } = zielMasse(spur.displayWidth, spur.displayHeight);
  const fps = (await spur.computePacketStats(60)).averagePacketRate || 25;
  const bitrate = bitrateFuer(breite, hoehe, fps);
  if (!(await MB.canEncodeVideo('avc', { width: breite, height: hoehe, bitrate }))) {
    throw new Error('Dieser Browser kann kein H.264 schreiben');
  }
  const output = new MB.Output({
    format: new MB.Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new MB.BufferTarget(),
  });
  const umwandlung = await MB.Conversion.init({
    input, output,
    video: {
      width: breite, height: hoehe, fit: 'fill', codec: 'avc', bitrate,
      forceTranscode: true, allowTransformationMetadata: false,
      ...(fps > MAX_BILDRATE + 0.5 ? { frameRate: MAX_BILDRATE } : {}),
    },
    audio: { discard: true },
  });
  if (!umwandlung.isValid) throw new Error('Das Video lässt sich nicht umwandeln');
  umwandlung.onProgress = (p) => fortschritt?.(p);
  await umwandlung.execute();
  return { puffer: output.target.buffer, breite, hoehe, sekunden: await spur.computeDuration() };
}

/* GIF -> MP4. ImageDecoder liefert jedes Einzelbild fertig zusammengesetzt
   samt seiner Anzeigedauer; die Bilder werden auf eine Leinwand gemalt und
   von dort kodiert. Fehlt ImageDecoder (ältere Safaris), wirft es. */
async function gifZuMp4(MB, datei, fortschritt) {
  if (typeof ImageDecoder === 'undefined') throw new Error('Dieser Browser kann GIFs nicht zerlegen');
  const dekoder = new ImageDecoder({ data: await datei.arrayBuffer(), type: datei.type || 'image/gif' });
  await dekoder.tracks.ready;
  await dekoder.completed;
  const anzahl = dekoder.tracks.selectedTrack.frameCount;
  const erstes = (await dekoder.decode({ frameIndex: 0 })).image;
  const { breite, hoehe } = zielMasse(erstes.displayWidth, erstes.displayHeight);
  /* MP4 kennt keine Durchsichtigkeit: Aus einem freigestellten GIF (Katze
     ohne Hintergrund) würde ein Kasten mit schwarzem Grund. Solche GIFs
     bleiben GIFs -- admin.js lädt sie dann unverändert hoch. */
  const probe = new OffscreenCanvas(64, 36).getContext('2d', { willReadFrequently: true });
  probe.drawImage(erstes, 0, 0, 64, 36);
  const alpha = probe.getImageData(0, 0, 64, 36).data;
  erstes.close();
  for (let i = 3; i < alpha.length; i += 4) {
    if (alpha[i] < 250) { dekoder.close(); throw new Error('Das GIF ist durchsichtig, das kann MP4 nicht'); }
  }

  const leinwand = new OffscreenCanvas(breite, hoehe);
  const ctx = leinwand.getContext('2d');
  /* Bildrate fürs Bitbudget: GIFs laufen meist mit 10–25 Bildern/s. */
  const bitrate = bitrateFuer(breite, hoehe, 20);
  if (!(await MB.canEncodeVideo('avc', { width: breite, height: hoehe, bitrate }))) {
    throw new Error('Dieser Browser kann kein H.264 schreiben');
  }
  const quelle = new MB.CanvasSource(leinwand, { codec: 'avc', bitrate });
  const output = new MB.Output({
    format: new MB.Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new MB.BufferTarget(),
  });
  output.addVideoTrack(quelle);
  await output.start();
  let zeit = 0;
  for (let i = 0; i < anzahl; i++) {
    const bild = (await dekoder.decode({ frameIndex: i })).image;
    /* Dauer 0 heißt in GIFs "so schnell wie möglich"; Browser zeigen das
       mit 0,1 s an -- genauso hier, sonst rast das Video. */
    const dauer = bild.duration > 10_000 ? bild.duration / 1e6 : 0.1;
    ctx.clearRect(0, 0, breite, hoehe);
    ctx.drawImage(bild, 0, 0, breite, hoehe);
    bild.close();
    await quelle.add(zeit, dauer);
    zeit += dauer;
    fortschritt?.((i + 1) / anzahl);
  }
  dekoder.close();
  await output.finalize();
  return { puffer: output.target.buffer, breite, hoehe, sekunden: zeit };
}

/* Liefert { mp4, poster, breite, hoehe, sekunden } -- beides als Blob. */
export async function zuLoopVideo(datei, fortschritt) {
  if (typeof VideoEncoder === 'undefined') throw new Error('Dieser Browser kann keine Videos umwandeln');
  const MB = await import(BIBLIOTHEK);
  const istGif = /^image\//.test(datei.type || '');
  const r = istGif ? await gifZuMp4(MB, datei, fortschritt) : await videoZuMp4(MB, datei, fortschritt);
  const poster = await posterAus(MB, r.puffer);
  return { ...r, mp4: new Blob([r.puffer], { type: 'video/mp4' }), poster };
}
