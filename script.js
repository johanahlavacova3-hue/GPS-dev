const shapeCanvas = document.getElementById("shapeCanvas");
const grainCanvas = document.getElementById("grainCanvas");

const sCtx = shapeCanvas.getContext("2d");
const gCtx = grainCanvas.getContext("2d");

shapeCanvas.width = window.innerWidth;
shapeCanvas.height = window.innerHeight;
grainCanvas.width = window.innerWidth;
grainCanvas.height = window.innerHeight;

function random(min, max) {
    return Math.random() * (max - min) + min;
}

// ===============================================
//  GENERACE ORGANICKÉHO TVARU BEZ OSTRÝCH HRAN
//  podobný tomu, co jsi poslala na obrázku
// ===============================================

function generateOrganicShape() {
    const w = shapeCanvas.width;
    const h = shapeCanvas.height;

    sCtx.clearRect(0, 0, w, h);

    // tmavý základ – textura
    sCtx.fillStyle = "#222";
    sCtx.fillRect(0, 0, w, h);

    const layers = 7;    
    for (let i = 0; i < layers; i++) {
        drawLayer(i);
    }
}

function drawLayer(layerIndex) {
    const w = shapeCanvas.width;
    const h = shapeCanvas.height;

    let pointCount = 80 + Math.floor(Math.random() * 60);
    let points = [];

    for (let i = 0; i < pointCount; i++) {
        points.push({
            x: random(w*0.15, w*0.85),
            y: random(h*0.25, h*0.75),
            o: Math.random()
        });
    }

    sCtx.globalAlpha = 0.07 + Math.random() * 0.07;
    sCtx.fillStyle = "white";

    sCtx.beginPath();
    sCtx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
        let p = points[i];
        let cp = points[i - 1];

        sCtx.quadraticCurveTo(cp.x, cp.y, p.x, p.y);
    }

    sCtx.closePath();
    sCtx.fill();

    addTexture();
}

// ===============================================
//  TEXTURY (jemné díry a zrno)
// ===============================================

function addTexture() {
    const w = shapeCanvas.width;
    const h = shapeCanvas.height;

    sCtx.globalCompositeOperation = "destination-out";
    sCtx.globalAlpha = 0.15;

    for (let i = 0; i < 200; i++) {
        let x = random(0, w);
        let y = random(0, h);
        let r = random(5, 45);

        sCtx.beginPath();
        sCtx.arc(x, y, r, 0, Math.PI * 2);
        sCtx.fill();
    }

    sCtx.globalCompositeOperation = "source-over";
    sCtx.globalAlpha = 1;
}

// ===============================================
//  GRAIN VRSTVA (stálé zrnění přes celou scénu)
// ===============================================

function generateGrain() {
    const w = grainCanvas.width;
    const h = grainCanvas.height;

    const imageData = gCtx.createImageData(w, h);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const g = Math.random() * 255;
        data[i] = g;
        data[i + 1] = g;
        data[i + 2] = g;
        data[i + 3] = 50;   // slabá vrstva
    }

    gCtx.putImageData(imageData, 0, 0);
}

generateOrganicShape();
generateGrain();

setInterval(() => {
    generateGrain();
}, 80);
