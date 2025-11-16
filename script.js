function generateCentralObject(lat, lon) {
    if (!ctx) return;
    GENETIC_TRAITS = CoordinateGenetics(lat, lon);
    const T = GENETIC_TRAITS;

    const w = canvas.width;
    const h = canvas.height;
    const img = ctx.createImageData(w, h);
    const d = img.data;

    const cx = w / 2;
    const cy = h / 2;

    // Velikost blobu
    const BASE_RADIUS = Math.min(w, h) * 0.25;

    // Kolik náhodných tvarů kombinujeme → výsledkem je extra měkké rozptýlení
    const SHAPE_LAYERS = 3 + Math.floor(Math.random() * 3);

    // Základní rozmazání tvaru
    const SOFTNESS = 0.85;  
    const DEFORM = 0.35;    
    const BLUR_NOISE_SCALE = 0.009;

    // Generujeme několik základních náhodných polygonů, které se vzájemně prolínají
    const shapeFields = [];

    for (let s = 0; s < SHAPE_LAYERS; s++) {
        const points = [];
        const pointCount = 5 + Math.floor(Math.random() * 8); // občas čtverec, občas mnohoúhelník

        for (let i = 0; i < pointCount; i++) {
            const ang = (Math.PI * 2 * i) / pointCount;
            const radius =
                BASE_RADIUS *
                (0.6 + Math.random() * 0.8) *
                (1 + perlin.noise(i * 0.22, (T.FinalSeed + s) * 0.002) * DEFORM);

            points.push({
                x: cx + Math.cos(ang) * radius,
                y: cy + Math.sin(ang) * radius
            });
        }

        shapeFields.push(points);
    }

    // Funkce pro měkké „uvnitř-tvaru“ – vzdálenost k polygonu + noise
    function softField(px, py) {
        let fieldValue = 0;

        for (let l = 0; l < shapeFields.length; l++) {
            const pts = shapeFields[l];
            let minDist = Infinity;

            // vzdálenost ke všem hranám polygonu
            for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
                const x1 = pts[j].x, y1 = pts[j].y;
                const x2 = pts[i].x, y2 = pts[i].y;

                const A = px - x1;
                const B = py - y1;
                const C = x2 - x1;
                const D = y2 - y1;

                const dot = A * C + B * D;
                const lenSq = C * C + D * D;
                let t = dot / lenSq;
                t = Math.max(0, Math.min(1, t));

                const ex = x1 + t * C;
                const ey = y1 + t * D;
                const dx = px - ex;
                const dy = py - ey;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < minDist) minDist = dist;
            }

            let inside = false;
            for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
                const xi = pts[i].x, yi = pts[i].y;
                const xj = pts[j].x, yj = pts[j].y;
                const intersect =
                    (yi > py) !== (yj > py) &&
                    px <
                        ((xj - xi) * (py - yi)) /
                            (yj - yi + 0.00001) +
                            xi;
                if (intersect) inside = !inside;
            }

            let layerField = inside ? 1 - minDist / (BASE_RADIUS * SOFTNESS) : 0;

            // jemné rozpuštění hran přes noise
            const n = perlin.noise(px * BLUR_NOISE_SCALE, py * BLUR_NOISE_SCALE);
            layerField *= 0.7 + n * 0.3;

            // skládáme vrstvy
            fieldValue = Math.max(fieldValue, layerField);
        }

        return fieldValue;
    }

    // vykreslení
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;

            const f = softField(x, y);

            if (f <= 0) {
                d[i + 3] = 0;
                continue;
            }

            // grain
            const grain =
                (Math.random() - 0.5) *
                45 *
                T.GrainIntensity;

            // noise textura pro biomateriál
            let n = perlin.noise(
                x * 0.01 + T.OffsetX * 50,
                y * 0.01 + T.OffsetY * 50
            );
            n = (n + 1) / 2;

            const gray = Math.min(
                255,
                Math.max(0, n * 255 + grain)
            );

            d[i] = d[i + 1] = d[i + 2] = gray;
            d[i + 3] = Math.floor(f * 255);
        }
    }

    ctx.clearRect(0, 0, w, h);
    ctx.putImageData(img, 0, 0);
}
