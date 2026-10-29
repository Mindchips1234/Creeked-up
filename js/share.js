// Shareable catch cards: draws a picture of a catch and opens the phone's share sheet
// (or downloads the picture where sharing files isn't supported).

const CARD_W = 1080;
const CARD_H = 1350;

async function makeCatchCard(c, photoBlob, level) {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const g = canvas.getContext("2d");

  g.fillStyle = "#0f3d3e";
  g.fillRect(0, 0, CARD_W, CARD_H);

  // Photo across the top, cropped to fill.
  const photoH = 820;
  if (photoBlob) {
    const img = await loadImage(URL.createObjectURL(photoBlob));
    const scale = Math.max(CARD_W / img.width, photoH / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    g.save();
    g.beginPath();
    g.rect(0, 0, CARD_W, photoH);
    g.clip();
    g.drawImage(img, (CARD_W - w) / 2, (photoH - h) / 2, w, h);
    g.restore();
  } else {
    g.fillStyle = "#16504f";
    g.fillRect(0, 0, CARD_W, photoH);
    g.fillStyle = "#e07a1f";
    g.font = "900 120px system-ui, sans-serif";
    g.textAlign = "center";
    g.fillText("🎣", CARD_W / 2, photoH / 2 + 40);
  }

  const sp = speciesById(c.speciesId).name;
  const pad = 64;
  g.textAlign = "left";
  g.fillStyle = "#ffffff";
  g.font = "900 84px system-ui, sans-serif";
  g.fillText(sp, pad, photoH + 120, CARD_W - pad * 2);

  g.fillStyle = "#cfe3df";
  g.font = "500 44px system-ui, sans-serif";
  const bits = [];
  if (okLength(c)) bits.push(`${c.lengthCm} cm`);
  if (okWeight(c)) bits.push(`${c.weightKg} kg`);
  bits.push(new Date(c.caughtAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }));
  g.fillText(bits.join(" · "), pad, photoH + 190, CARD_W - pad * 2);

  g.fillStyle = "#e07a1f";
  g.font = "900 72px system-ui, sans-serif";
  g.fillText(`+${c.exp} EXP`, pad, photoH + 300);

  g.fillStyle = "#cfe3df";
  g.font = "600 40px system-ui, sans-serif";
  g.fillText(`Level ${level.level} · ${level.title}`, pad, photoH + 370);

  g.textAlign = "right";
  g.fillStyle = "#ffffff";
  g.font = "900 44px system-ui, sans-serif";
  g.fillText("Creeked Up", CARD_W - pad, CARD_H - 56);
  g.textAlign = "left";
  g.fillStyle = "#7fc8c0";
  g.font = "400 30px system-ui, sans-serif";
  g.fillText("VANDERHOLST STUDIOS", pad, CARD_H - 60);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function shareCatch(c, photoBlob, level) {
  const blob = await makeCatchCard(c, photoBlob, level);
  const name = `creeked-up-${speciesById(c.speciesId).id}.png`;
  const file = new File([blob], name, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "My catch on Creeked Up" });
      return "shared";
    } catch (err) {
      if (err && err.name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded";
}
