import { FontLoader } from "three/examples/jsm/Addons.js";

export function initRoomUI(scene) {
    const loader = new FontLoader();

    loader.load('src/ui/VT323.json', font => {
        const geo = new TextGeometry('use arrow keys to navigate.', {
            font: font,
            size: 25,
            height: 40,
            curveSegments: 1,
            bevelEnabled: false
        });
        geo.computeBoundingBox();

        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.scale.set(0.02, 0.02, 0.02);
        mesh.position.set(-1, -7.5, -1); // adjust positions as needed
        this.scene.add(mesh);
    })
}

export function createUITextCanvas({
    width = 512,
    height = 256,
    text = '',
    font = 'VT323',
    fontSize = 60,
    textColor = '#ff0122',
    drawCorners = true,
    borderColor = null,
    borderWidth = 2,
    background = false,
}) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Optional clear or fill
    if (background) {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, width, height);
    } else {
        ctx.clearRect(0, 0, width, height);
    }

    // Optional border
    if (borderColor) {
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = borderWidth;
        ctx.strokeRect(0, 0, width, height);
    }

    // Draw corners like helicopter HUD
    if (drawCorners) {
        const len = 20;
        ctx.strokeStyle = textColor;
        ctx.lineWidth = 2;
        ctx.beginPath();

        // Top left
        ctx.moveTo(0, len); ctx.lineTo(0, 0); ctx.lineTo(len, 0);
        // Top right
        ctx.moveTo(width - len, 0); ctx.lineTo(width, 0); ctx.lineTo(width, len);
        // Bottom left
        ctx.moveTo(0, height - len); ctx.lineTo(0, height); ctx.lineTo(len, height);
        // Bottom right
        ctx.moveTo(width - len, height); ctx.lineTo(width, height); ctx.lineTo(width, height - len);

        ctx.stroke();
    }

    // Draw centered text
    ctx.font = `${fontSize}px ${font}`;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);

    return canvas;
}
