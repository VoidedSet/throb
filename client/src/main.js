// import Engine from './core/Engine.js';
// import { io } from 'socket.io-client';

// export const socket = io('http://localhost:3000');
// let engine = null, roomCode = null;

// window.addEventListener('DOMContentLoaded', () => {

//     window.addEventListener('keydown', (e) => {
//         if (e.code === 'KeyQ' && !roomCode) {
//             roomCode = 123;
//             console.log("Joining Multiplayer\nRoom Code:", roomCode)
//             joinRoom(roomCode);
//         }
//         if (e.code === 'KeyR' && !roomCode) {
//             console.log("Joining Singleplayer")
//             roomCode = 1;
//             joinRoom(roomCode);
//         }
//     });

//     function joinRoom(roomCode) {
//         if (!engine) {
//             engine = new Engine(roomCode);
//             engine.start();
//         }
//     }
// });

import { MenuScene } from './ui/MainMenu/index';

let menu = new MenuScene();

async function loadCustomFont(name, url) {
    const font = new FontFace(name, `url(${url})`);
    await font.load();
    document.fonts.add(font);
    console.log(`[Font] Loaded font "${name}" from ${url}`);
}

(async () => {
    await loadCustomFont('VT323', 'src/ui/VT323.ttf');
    await loadCustomFont('Miskan', 'src/ui/Miskan/Miskan.ttf');
})();