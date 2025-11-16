// Function to generate a central object image based on GPS coordinates
function generateCentralObject(coords) {
    const canvas = document.getElementById('myCanvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Parse coordinates from format like "49.5674321N, 16.0009999E"
    const parts = coords.split(',').map(part => part.trim());
    if (parts.length !== 2) {
        alert('Invalid coordinates format. Use like: 49.5674321N, 16.0009999E');
        return;
    }
    let lat = parseFloat(parts[0].slice(0, -1));
    const latDir = parts[0].slice(-1).toUpperCase();
    let lon = parseFloat(parts[1].slice(0, -1));
    const lonDir = parts[1].slice(-1).toUpperCase();

    if (latDir === 'S') lat = -lat;
    if (lonDir === 'W') lon = -lon;

    if (isNaN(lat) || isNaN(lon)) {
        alert('Invalid latitude or longitude values.');
        return;
    }

    // Extract numbers from lat and lon (assuming they are floats like 50.0755, 14.4378)
    const latStr = Math.abs(lat).toString().replace('.', '');
    const lonStr = Math.abs(lon).toString().replace('.', '');
    const combinedDigits = (latStr + lonStr).split('').map(Number); // Array of digits

    // Perform 80 computations: multiplications, subtractions, additions, etc., to create "random" values
    let computations = [];
    let seed = lat + lon;
    for (let i = 0; i < 80; i++) {
        let val = combinedDigits[i % combinedDigits.length]; // Cycle through digits
        val *= (i + 1) * Math.abs(seed); // Multiply by index and sum of coords
        val -= Math.sin(lat * Math.PI / 180) * 100; // Subtract sine-based value (in degrees to radians)
        val += Math.cos(lon * Math.PI / 180) * 50; // Add cosine-based value
        val *= (Math.random() + 0.5) * (seed % 100 + 1); // Introduce randomness scaled by seed
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

    // Base radius influenced by first 10 computations average, scaled reasonably
    const avgFirst10 = computations.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
    const baseRadius = Math.min(w, h) * (0.1 + (avgFirst10 / 255) * 0.3); // Between 0.1 and 0.4 of min dimension

    // Generate a random shape using computations for points
    const pointCount = 5 + Math.floor(computations[10] / 50); // 5 to ~10 points
    const points = [];
    for (let i = 0; i < pointCount; i++) {
        const ang = (Math.PI * 2 * i) / pointCount + (computations[i] / 255) * Math.PI / 4; // Slight rotation variation
        const radiusVariation = 0.7 + (computations[i + 20] / 255) * 0.6;
        const radius = baseRadius * radiusVariation;
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

    // Function to get soft field value (distance-based opacity)
    function softField(px, py) {
        let minDist = Infinity;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const x1 = points[j].x, y1 = points[j].y;
            const x2 = points[i].x, y2 = points[i].y;
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
        const inside = isInsidePolygon(px, py, points);
        let field = inside ? 1 - minDist / baseRadius : 0;
        field = Math.max(0, field);
        // Add some noise for texture
        const noise = (Math.sin(px * 0.05) + Math.cos(py * 0.05)) * 0.1;
        field += noise;
        field = Math.min(1, Math.max(0, field));
        return field;
    }

    // Render the image pixel by pixel using computations for colors and opacity
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const f = softField(x, y);
            if (f <= 0) {
                d[i + 3] = 0; // Transparent
                continue;
            }

            // Use computations for color: cycle through them
            const compIndex = (x * 3 + y * 7) % 80; // Better mixing
            const r = computations[(compIndex + 0) % 80];
            const g = computations[(compIndex + 20) % 80];
            const b = computations[(compIndex + 40) % 80];

            // Grain and variation
            const grain = (Math.random() - 0.5) * 20;
            d[i] = Math.min(255, Math.max(0, r + grain));
            d[i + 1] = Math.min(255, Math.max(0, g + grain));
            d[i + 2] = Math.min(255, Math.max(0, b + grain));
            d[i + 3] = Math.floor(f * 255);
        }
    }

    ctx.clearRect(0, 0, w, h);
    ctx.putImageData(img, 0, 0);
}
