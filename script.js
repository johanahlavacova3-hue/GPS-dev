// --- GENEROVÁNÍ OBRAZU – ABSTRAKTNÍ 3D GRAINY SHADE ---
function generateArt(lat, lon) {
  const seed = gpsToSeed(lat, lon);
  const rand = createSeededRandom(seed);

  const T = {
    scale: 0.0008 + (lat % 1) * 0.0012,
    octaves: 5 + Math.floor(Math.abs(lon % 1) * 3),
    height: 0.3 + (Math.abs(Math.sin(seed * 0.00001)) * 0.4),
    lightX: (lat % 1) * 2 - 1,
    lightY: (lon % 1) * 2 - 1,
    lightZ: 1.5,
    grain: 0.7 + (lon % 1) * 0.3,
    contrast: 1.2 + (lat % 1) * 0.8,
    vignette: 0.6 + (lat % 1) * 0.4,
    warp: 0.8 + Math.abs(Math.sin(seed * 0.00002)) * 1.2
  };

  const imgData = ctx.createImageData(canvas.width, canvas.height);
  const data = imgData.data;
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h / 2;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let fx = (x - cx) / w;
      let fy = (y - cy) / h;

      // Warping
      const wx = Math.sin(fy * 8 + seed * 0.0001) * T.warp * 0.1;
      const wy = Math.cos(fx * 8 + seed * 0.0001) * T.warp * 0.1;
      fx += wx; fy += wy;

      // Perlin 3D-like heightmap
      let height = 0, amp = 1, freq = 1;
      for (let o = 0; o < T.octaves; o++) {
        height += perlin.noise(fx * T.scale * freq + seed, fy * T.scale * freq + seed * 0.5) * amp;
        amp *= 0.5;
        freq *= 2;
      }
      height = (height + T.octaves) / (T.octaves * 2); // 0..1

      // 3D osvětlení (simulace světla z boku)
      const dx = perlin.noise(fx * T.scale * freq * 2 + 100, fy * T.scale * freq * 2 + 100) * 0.5 + 0.5;
      const dy = perlin.noise(fx * T.scale * freq * 2 + 200, fy * T.scale * freq * 2 + 200) * 0.5 + 0.5;
      const normalX = dx - 0.5;
      const normalY = dy - 0.5;
      const normalZ = 1.0;

      const lightDirX = T.lightX, lightDirY = T.lightY, lightDirZ = T.lightZ;
      const dot = normalX * lightDirX + normalY * lightDirY + normalZ * lightDirZ;
      const light = Math.max(0, dot) * 0.8 + 0.2; // ambient + diffuse

      // Kombinace výšky a osvětlení
      let shade = height * light * T.height + (1 - T.height) * 0.5;
      shade = Math.pow(shade, T.contrast);

      // Vinětace
      const dist = Math.hypot(x - cx, y - cy) / (Math.min(w, h) * 0.6);
      shade *= (1 - Math.pow(dist, 2) * T.vignette);

      // Posterizace (4–6 úrovní)
      const levels = 4 + Math.floor(rand() * 3);
      shade = Math.floor(shade * levels) / levels;

      // Zrnitost
      shade += (rand() - 0.5) * T.grain * 0.4;
      shade = Math.max(0, Math.min(1, shade));

      const v = Math.floor(shade * 255);
      data[i] = v; data[i+1] = v; data[i+2] = v; data[i+3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // UI
  coordsEl.textContent = `${lat.toFixed(7)}N, ${lon.toFixed(7)}E`;
  statusEl.textContent = `3D GRAIN | OCT:${T.octaves} | LIGHT:${(T.lightX).toFixed(2)},${(T.lightY).toFixed(2)}`;
}
