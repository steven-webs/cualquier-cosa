const gardenAudio = document.querySelector("#garden-audio");
gardenAudio.volume = 0.25;
let needsGesture = false;
async function startGardenMusic() {
  try {
    await gardenAudio.play();
    needsGesture = false;
  } catch (error) {
    needsGesture = error.name === "NotAllowedError";
  }
}
// Empieza de inmediato (antes esperaba 6 segundos).
startGardenMusic();
function retryGardenMusic() { if (needsGesture) startGardenMusic(); }
document.addEventListener("pointerup", retryGardenMusic);
document.addEventListener("keydown", retryGardenMusic);

function parseLyrics(source) {
  const offset = Number(source.match(/\[offset:([+-]?\d+)\]/i)?.[1] || 0) / 1000;
  const lines = [];
  for (const row of source.split(/\r?\n/)) {
    const stamps = [...row.matchAll(/\[(\d+):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    const text = row.replace(/\[[^\]]*\]/g, "").trim();
    for (const stamp of stamps) {
      lines.push({ time: Number(stamp[1]) * 60 + Number(stamp[2]) + Number(`0.${stamp[3] || 0}`) - offset, text });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

async function setupLyrics() {
  const panel = document.querySelector("#garden-lyrics-track");
  const player = document.querySelector("#garden-audio");
  let source = window.bouquetLyrics || "";
  if (location.protocol !== "file:") {
    try {
      const response = await fetch("./Amar-como-tu.lrc", { cache: "no-cache" });
      if (!response.ok) throw new Error("Lyrics unavailable");
      const text = await response.text();
      if (text.trim()) source = text;
    } catch {
      // si falla, se queda con la copia de lyrics-data.js
    }
  }
  const lines = parseLyrics(source);
  panel.replaceChildren();
  if (!lines.length) return;
  const LEAD = 0.15; // muestra cada frase un poquito antes de que se cante
  let active = -2;
  let characters = [];
  let thresholds = [];
  let revealed = 0;
  let frame = 0;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  function syncLyrics() {
    let next = -1;
    if (!player.ended) {
      for (let index = 0; index < lines.length && lines[index].time - LEAD <= player.currentTime; index += 1) next = index;
    }
    // En pausas largas (partes instrumentales y el final) la frase se oculta
    // para que no parezca que la letra se quedó congelada.
    if (next >= 0) {
      const hold = next === lines.length - 1 ? 8 : 7;
      if (player.currentTime > lines[next].time + hold) next = -1;
    }
    if (next !== active) {
      active = next;
      revealed = 0;
      thresholds = [];
      panel.replaceChildren();
      const text = active >= 0 ? lines[active].text : "";
      panel.setAttribute("aria-label", text || "Letra sincronizada");
      let weight = 0;
      characters = Array.from(text).map((character, index) => {
        thresholds.push(weight);
        // Pequeñas pausas entre palabras y después de signos de puntuación.
        weight += /[,.!?;:]/.test(character) ? 2.4 : /\s/.test(character) ? 1.6 : 0.85 + (index % 4) * 0.1;
        const span = document.createElement("span");
        span.className = "lyric-character";
        span.textContent = character;
        span.setAttribute("aria-hidden", "true");
        panel.appendChild(span);
        return span;
      });
      thresholds = thresholds.map(value => value / Math.max(1, weight));
    }
    if (active < 0 || !characters.length) return;
    const end = lines[active + 1]?.time ?? (Number.isFinite(player.duration) ? player.duration : lines[active].time + 5);
    // La escritura usa el reloj del audio; deja un momento para leer la frase completa.
    // Una pausa instrumental no debe alargar la escritura de la frase anterior.
    // Velocidad de escritura (lenta, como el original): hasta ~4.8 s por frase.
    // Para más lento aún, sube 0.06655 y 4.84; para más rápido, bájalos.
    const typingLimit = Math.min(4.84, Math.max(1.452, characters.length * 0.06655));
    const duration = Math.max(0.1, Math.min((end - lines[active].time) * 0.6655, typingLimit));
    const progress = Math.max(0, player.currentTime - (lines[active].time - LEAD)) / duration;
    const count = reducedMotion.matches ? characters.length : thresholds.filter(value => value <= progress).length;
    if (count === revealed) return;
    characters.forEach((span, index) => {
      span.classList.toggle("is-visible", index < count);
      span.classList.toggle("has-cursor", index === count - 1);
    });
    revealed = count;
  }
  function stopFrames() {
    cancelAnimationFrame(frame);
    frame = 0;
    syncLyrics();
  }
  function tick() {
    syncLyrics();
    if (!player.paused && !player.ended && !document.hidden) frame = requestAnimationFrame(tick);
    else frame = 0;
  }
  function startFrames() {
    cancelAnimationFrame(frame);
    tick();
  }
  player.addEventListener("play", startFrames);
  player.addEventListener("pause", stopFrames);
  player.addEventListener("ended", stopFrames);
  player.addEventListener("timeupdate", syncLyrics);
  player.addEventListener("seeked", syncLyrics);
  player.addEventListener("loadedmetadata", syncLyrics);
  reducedMotion.addEventListener("change", () => { revealed = -1; syncLyrics(); });
  document.addEventListener("visibilitychange", () => document.hidden ? stopFrames() : startFrames());
  startFrames();
}
setupLyrics();