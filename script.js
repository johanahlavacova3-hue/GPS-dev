// Function to generate a central object image based on GPS coordinates
function generateCentralObject(lat, lon) {
    const canvas = document.getElementById('myCanvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Extract numbers from lat and lon (assuming they are floats like 50.0755, 14.4378)
    const latStr = lat.toString().replace('.', '').replace('-', ''); // Remove dot and minus for positive digits
    const lonStr = lon.toString().replace('.', '').replace('-', '');
    const combinedDigits = (latStr + lonStr).split('').map(Number); // Array of digits

    // Perform 80 computations: multiplications, subtractions, additions, etc., to create "random" values
    let computations = [];
    let seed = 0;
    for (let i = 0; i < 80; i++) {
        let val = combinedDigits[i % combinedDigits.length]; // Cycle through digits
        val *= (i + 1) * (lat + lon); // Multiply by index and sum of coords
        val -= Math.sin(lat) * 100; // Subtract sine-based value
        val += Math.cos(lon) * 50; // Add cosine-based value
        val *= Math.random() * (seed + 1); // Introduce randomness scaled by seed
        val = Math.abs(val % 255); // Clamp to 0-255 for color use
        computations.push(val);
        seed += val; // Update seed for next computation
    }

    // Use computations to generate image parameters
    const w = canvas.width;
    const h = canvas.height;
    const img = ctx.createImageData(w, h);
    const d = img.data;
    const cx = w / 2;
    const cy = h / 2;

    // Base radius influenced by first 10 computations average
    const baseRadius = Math.min(w, h) * (computations.slice(0, 10).reduce((a, b) => a + b, 0) / 1000);

    // Generate a random shape using computations for points
    const pointCount = 4 + Math.floor(computations[10] / 50); // 4 to ~9 points
    const points = [];
    for (let i = 0; i < pointCount; i++) {
        const ang = (Math.PI * 2 * i) / pointCount;
        const radius = baseRadius * (0.5 + computations[i + 20] / 255);
        points.push({
            x: cx + Math.cos(ang) * radius,
            y: cy + Math.sin(ang) * radius
        });
    }

    // Function to determine if point is inside the polygon (ray-casting)
    function isInsidePolygon(px, py, pts) {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const xi = pts[i].x, yi = pts[i].y;
            const xj = pts[j].x, yj = pts[j].y;
            const intersect = ((yi > py) !== (yj > py)) &&
                (px < (xj - xi) * (py - yi) / (yj - yi + 0.00001) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    // Render the image pixel by pixel using remaining computations for colors and opacity
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const distToCenter = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
            if (distToCenter > baseRadius * 1.5) {
                d[i + 3] = 0; // Transparent outside
                continue;
            }

            // Use computations for color: cycle through them
            const compIndex = (x + y) % 80;
            const r = computations[(compIndex + 0) % 80];
            const g = computations[(compIndex + 20) % 80];
            const b = computations[(compIndex + 40) % 80];
            let alpha = computations[(compIndex + 60) % 80];

            // Adjust alpha based on inside polygon and distance
            if (isInsidePolygon(x, y, points)) {
                alpha *= (1 - distToCenter / baseRadius);
            } else {
                alpha *= 0.5; // Softer outside
            }

            d[i] = r;
            d[i + 1] = g;
            d[i + 2] = b;
            d[i + 3] = Math.floor(alpha);
        }
    }

    ctx.clearRect(0, 0, w, h);
    ctx.putImageData(img, 0, 0);
}
