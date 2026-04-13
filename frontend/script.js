const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const loader = document.getElementById("loader");

let isAnimating = false;
let animationId = null;

let viewScale, viewOffsetX, viewOffsetY;
let pixelToCm = 1;


function V(p) {
    return [
        p[0] * viewScale + viewOffsetX,
        p[1] * viewScale + viewOffsetY
    ];
}

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

resizeCanvas();

window.addEventListener("resize", resizeCanvas);


let points = [];
let selectedPoints = [];
let frames = [];
let frameIndex = 0;
let trail = [];
let O2_global = null;
let O4_global = null;
let speed = 3;


// ===================== DRAW HELPERS =====================

function drawLink(p1, p2, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.stroke();

    ctx.lineWidth = 3;
}

function drawGround(p) {

    let y = p[1] + 20;

    ctx.strokeStyle = "#fbf9f9ff";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(p[0] - 30, y);
    ctx.lineTo(p[0] + 30, y);
    ctx.stroke();

    for (let i = -30; i <= 30; i += 8) {
        ctx.beginPath();
        ctx.moveTo(p[0] + i, y);
        ctx.lineTo(p[0] + i + 6, y + 8);
        ctx.stroke();
    }
}


// ===================== MOUSE =====================

function getMouse(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function dist(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
}


// ===================== GENERATE CURVE =====================

window.generateCandidatePoints = function () {

    points = [];
    selectedPoints = [];

    const rect = canvas.getBoundingClientRect();
    let width = rect.width;
    let height = rect.height;

    let cols = 20;
    let rows = 13;

    let marginX = width * 0.1;
    let marginY = height * 0.1;

    let usableWidth = width - 2 * marginX;
    let usableHeight = height - 2 * marginY;

    let dx = usableWidth / (cols - 1);
    let dy = usableHeight / (rows - 1);

    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            let x = marginX + i * dx;
            let y = marginY + j * dy;
            points.push([x, y]);
        }
    }

    drawCandidatePoints();
};


// ===================== DRAW =====================

function drawCandidatePoints() {

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p[0], p[1], 10, 0, Math.PI * 2);

        let isSelected = selectedPoints.some(
            sp => sp[0] === p[0] && sp[1] === p[1]
        );

        if (isSelected) {
            ctx.fillStyle = "red";
        } else if (hoverPoint && p === hoverPoint) {
            ctx.fillStyle = "#3b82f6";
        } else {
            ctx.fillStyle = "gray";
        }

        ctx.fill();
    });
}

function redrawSelection() {

    drawCandidatePoints();

    selectedPoints.forEach(p => {
        ctx.fillStyle = "red";
        ctx.beginPath();
        ctx.arc(p[0], p[1], 11, 0, 2 * Math.PI);
        ctx.fill();
    });

    document.getElementById("count").innerText = selectedPoints.length;
}


// ===================== CLICK =====================

let hoverPoint = null;

canvas.addEventListener("mousemove", (e) => {
    if (isAnimating) return;

    const { x, y } = getMouse(e);
    hoverPoint = null;
    let closestDist = Infinity;

    for (const p of points) {
        const d = dist(p, [x, y]);
        if (d < 12 && d < closestDist) {
            closestDist = d;
            hoverPoint = p;
        }
    }

    redrawSelection();
});

canvas.addEventListener("click", (e) => {
    if (isAnimating) return;

    const { x, y } = getMouse(e);

    let closestPoint = null;
    let closestDist = Infinity;

    for (const p of points) {
        const d = dist(p, [x, y]);
        if (d < 15 && d < closestDist) {
            closestDist = d;
            closestPoint = p;
        }
    }

    if (closestPoint) {
        let index = selectedPoints.findIndex(
            sp => sp[0] === closestPoint[0] && sp[1] === closestPoint[1]
        );

        if (index !== -1) {
            selectedPoints.splice(index, 1);    // deselect
        } else {
            if (selectedPoints.length < 4) {
                selectedPoints.push(closestPoint);
            }
        }
    }

    redrawSelection();
});


// ===================== BACKEND =====================

function sendPoints() {

    loader.classList.remove("hidden");

    if (selectedPoints.length !== 4) {
        alert("Select exactly 4 points");
        document.getElementById("loader").classList.remove("hidden");
        document.getElementById("loader").classList.add("hidden");
        return;
    }

    fetch("http://127.0.0.1:8000/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points: selectedPoints })
    })
        .then(res => res.json())
        .then(async data => {

            O2_global = data.O2;
            O4_global = data.O4;

            pixelToCm = getPixelToCmRatio();

            if (!data.frames || data.frames.length === 0) {
                document.getElementById("error").innerText =
                    "No valid mechanism. Try better points.";
                loader.classList.add("hidden");
                return;
            }

            let links = data.real_links;
            let ground = links.ground * pixelToCm;
            let crank = links.crank * pixelToCm;
            let coupler = links.coupler * pixelToCm;
            let rocker = links.rocker * pixelToCm;

            let groundDist = Math.hypot(
                O2_global[0] - O4_global[0],
                O2_global[1] - O4_global[1]
            ) * pixelToCm;

            let sampleDist = 0;
            if (selectedPoints.length >= 2) {
                sampleDist = Math.hypot(
                    selectedPoints[0][0] - selectedPoints[1][0],
                    selectedPoints[0][1] - selectedPoints[1][1]
                ) * pixelToCm;
            }

            document.getElementById("scaleInfo").innerHTML = `
            <span style="font-size:24px; font-weight:600;">📏 Measurements</span><br><br>

            <b>Unit:</b> 1 grid = 1 cm<br>
            <b>Pixel → cm:</b> ${pixelToCm.toFixed(4)}<br><br>

            <span style="font-size:24x;">🔩 Link Lengths</span><br>
            Ground (Hc–Hr): ${ground.toFixed(2)} cm<br>
            Crank (Hc–A): ${crank.toFixed(2)} cm<br>
            Coupler (A–B): ${coupler.toFixed(2)} cm<br>
            Rocker (Hr–B): ${rocker.toFixed(2)} cm<br><br>
        `;

            loader.classList.add("hidden");

            frames = data.frames;
            frameIndex = 0;
            trail = [];
            isAnimating = true;

            computeViewTransform();

            document.getElementById("error").innerText = "";

            if (animationId) cancelAnimationFrame(animationId);

            document.getElementById("speedSlider").oninput = function () {
                fps = this.value;
                interval = 1000 / fps;
            };

            animate();
        });
}

function distance(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

function getPixelToCmRatio() {
    let p1 = points[0];
    let p2 = points[1];
    let pixelDist = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]);
    return 1 / pixelDist;
}


// ===================== ANIMATION =====================

function drawJoint(p, type = "normal", label = "") {

    if (type === "fixed") {
        ctx.beginPath();
        ctx.arc(p[0], p[1], 10, 0, 2 * Math.PI);
        ctx.fillStyle = "#ffffffff";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p[0], p[1], 16, 0, 2 * Math.PI);
        ctx.strokeStyle = "#ffffffff";
        ctx.lineWidth = 3;
        ctx.stroke();

    } else {
        ctx.beginPath();
        ctx.arc(p[0], p[1], 8, 0, 2 * Math.PI);
        ctx.fillStyle = "white";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p[0], p[1], 8, 0, 2 * Math.PI);
        ctx.strokeStyle = "#fcfcfcff";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(p[0], p[1], 2.5, 0, 2 * Math.PI);
        ctx.fillStyle = "#ffffffff";
        ctx.fill();
    }

    if (label) {
        ctx.fillStyle = "#fcfcfcff";
        ctx.font = "bold 25px Arial";
        ctx.fillText(label, p[0] + 10, p[1] - 10);
    }
}

function computeViewTransform() {

    let allPoints = [];

    frames.forEach(f => {
        allPoints.push(f.A, f.B, f.C);
    });

    if (O2_global && O4_global) {
        allPoints.push(O2_global, O4_global);
    }

    let xs = allPoints.map(p => p[0]);
    let ys = allPoints.map(p => p[1]);

    let minX = Math.min(...xs);
    let maxX = Math.max(...xs);
    let minY = Math.min(...ys);
    let maxY = Math.max(...ys);

    let mechWidth = maxX - minX;
    let mechHeight = maxY - minY;

    const rect = canvas.getBoundingClientRect();
    let cw = rect.width;
    let ch = rect.height;

    let margin = 0.85;
    viewScale = margin * Math.min(cw / mechWidth, ch / mechHeight);

    viewOffsetX = (cw - mechWidth * viewScale) / 2 - minX * viewScale;
    viewOffsetY = (ch - mechHeight * viewScale) / 2 - minY * viewScale;
}

function drawMechanism(frame) {

    let A = V(frame.A);
    let B = V(frame.B);
    let C = V(frame.C);
    let O2 = V(O2_global);
    let O4 = V(O4_global);

    if (!O2 || !O4) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // trail
    if (trail.length > 1) {
        ctx.beginPath();
        trail.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p[0], p[1]);
            else ctx.lineTo(p[0], p[1]);
        });
        ctx.strokeStyle = "rgba(255,100,0,0.6)";
        ctx.lineWidth = 5;
        ctx.stroke();
    }

    ctx.lineWidth = 3;

    // crank
    ctx.strokeStyle = "red";
    ctx.beginPath();
    drawLink(O2, A, "#989797ff", 12);
    ctx.stroke();

    // coupler plate
    ctx.beginPath();
    ctx.moveTo(A[0], A[1]);
    ctx.lineTo(B[0], B[1]);
    ctx.lineTo(C[0], C[1]);
    ctx.closePath();
    ctx.fillStyle = "rgba(120, 200, 120, 0.5)";
    ctx.fill();
    ctx.strokeStyle = "green";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.lineWidth = 3;

    ctx.strokeStyle = "#2e7d32";
    ctx.beginPath();
    ctx.moveTo(A[0], A[1]);
    ctx.lineTo(B[0], B[1]);
    ctx.stroke();

    // rocker
    ctx.strokeStyle = "#555";
    ctx.beginPath();
    drawLink(O4, B, "#777", 12);
    ctx.stroke();

    // coupler point C
    ctx.fillStyle = "orange";
    ctx.beginPath();
    ctx.arc(C[0], C[1], 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = "darkorange";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.lineWidth = 3;

    drawGround(O2);
    drawGround(O4);

    drawJoint(O2, "fixed", "Hc");
    drawJoint(O4, "fixed", "Hr");
    drawJoint(A, "normal", "A");
    drawJoint(B, "normal", "B");
    drawJoint(C, "normal", "C");

    if (selectedPoints.length === 4) {
        selectedPoints.forEach((sp, idx) => {
            const colors = ["#e63946", "#2196F3", "#ff9800", "#9c27b0"];
            const labels = ["P1", "P2", "P3", "P4"];

            let spT = V(sp);

            ctx.beginPath();
            ctx.arc(spT[0], spT[1], 12, 0, 2 * Math.PI);
            ctx.strokeStyle = colors[idx];
            ctx.lineWidth = 3;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(spT[0], spT[1], 8, 0, 2 * Math.PI);
            ctx.fillStyle = colors[idx];
            ctx.fill();

            ctx.fillStyle = colors[idx];
            ctx.fillText(labels[idx], spT[0] + 10, spT[1] - 10);
        });
    }
}

let lastTime = 0;
let fps = 15;
let interval = 1000 / fps;

function animate(time) {

    if (!isAnimating) return;
    if (!frames || frames.length === 0) return;

    if (time - lastTime > interval) {

        lastTime = time;

        let frame = frames[Math.floor(frameIndex) % frames.length];

        document.getElementById("triangleInfo").innerHTML = `
        <span style="font-size:24px;">🔺 Triangle</span><br><br>

        AC: ${(frame.AC * pixelToCm).toFixed(2)} cm<br>
        BC: ${(frame.BC * pixelToCm).toFixed(2)} cm<br>
        ∠A: ${frame.angle_A.toFixed(1)}°<br>
        ∠B: ${frame.angle_B.toFixed(1)}°
        `;

        if (!frame) return;

        drawMechanism(frame);

        trail.push(V(frame.C));
        if (trail.length > 300) trail.shift();

        frameIndex = (frameIndex + 1) % frames.length;
    }

    animationId = requestAnimationFrame(animate);
}


// ===================== UI =====================

function reset() {

    isAnimating = false;
    if (animationId) cancelAnimationFrame(animationId);

    points = [];
    selectedPoints = [];
    frames = [];
    trail = [];
    O2_global = null;
    O4_global = null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    document.getElementById("error").innerText = "";
    document.getElementById("loader").classList.add("hidden");
    document.getElementById("scaleInfo").innerHTML = "";
    document.getElementById("triangleInfo").innerHTML = "";
}

function changePoints() {

    isAnimating = false;
    if (animationId) cancelAnimationFrame(animationId);

    frames = [];
    trail = [];
    O2_global = null;
    O4_global = null;

    drawCandidatePoints();
    redrawSelection();

    document.getElementById("error").innerText = "";
}

function showInfo(data) {

    if (!data || !data.params) {
        document.getElementById("info").innerHTML = "❌ Failed to generate mechanism.";
        return;
    }

    let p = data.params;

    document.getElementById("info").innerHTML = `
        Link Lengths: ${p.slice(2, 6).map(x => x.toFixed(2)).join(", ")} <br>
        Grashof: ${data.grashof}
    `;
}