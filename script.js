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

    const BASE_RADIUS = Math.min(w, h) * 0.25;

    const SHAPE_LAYERS = 3 + Math.floor(Math.random() * 3);
    const SOFTNESS = 0.85;
    const DEFORM = 0.35;
    const BLUR_NOISE_SCALE = 0.009;

    const shapeFields = [];

    for (let s = 0; s < SHAPE_LAYERS; s++) {
        const points = [];
        const pointCount = 5 + Math.floor(Math.random() * 8);

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

    function softField(px, py) {
        let fieldValue = 0;

        for (let l = 0; l < shapeFields.length; l++) {
            const pts = shapeFields[l];
            let minDist = Infinity;

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

            const n = perlin.noise(px * BLUR_NOISE_SCALE, py * BLUR_NOISE_SCALE);
            layerField *= 0.7 + n * 0.3;

            fieldValue = Math.max(fieldValue, layerField);
        }

        return fieldValue;
    }

    // === HLAVNÍ RENDER CYKLUS ===
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;

            const f = softField(x, y);

            if (f <= 0) {
                d[i + 3] = 0;
                continue;
            }

            // ——————————————
            // NOVÁ ORGANICKÁ TEXTURA
            // ——————————————

            let baseN = perlin.noise(
                x * 0.013 + T.OffsetX,
                y * 0.013 + T.OffsetY
            );
            baseN = (baseN + 1) / 2;

            let ridge = perlin.noise(
                x * 0.025 + T.FinalSeed * 0.01,
                y * 0.025 - T.FinalSeed * 0.008
            );
            ridge = 1 - Math.abs(ridge);
            ridge = ridge * ridge;

            let dir = perlin.noise(
                x * 0.04 + y * 0.002,
                y * 0.04 - x * 0.002
            );
            dir = (dir + 1) / 2;

            let hf = perlin.noise(x * 0.2, y * 0.2);
            hf = (hf + 1) / 2;

            let tex =
                baseN * 0.55 +
                ridge * 0.85 +
                dir * 0.25 +
                hf * 0.15;

            const grain =
                (Math.random() - 0.5) *
                45 *
                T.GrainIntensity;

            let gray = tex * 255 + grain;
            gray = Math.max(0, Math.min(255, gray));

            d[i] = d[i + 1] = d[i + 2] = gray;
            d[i + 3] = Math.floor(f * 255);
        }
    }

    ctx.clearRect(0, 0, w, h);
    ctx.putImageData(img, 0, 0);
}
