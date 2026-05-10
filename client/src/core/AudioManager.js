export default class AudioManager {
    constructor() {
        this.context = new (window.AudioContext || window.webkitAudioContext)();
        this.buffers = new Map(); // name → AudioBuffer
    }

    async load(name, url, volume = 1.0) {
        const res = await fetch(url);
        const arrayBuffer = await res.arrayBuffer();
        const audioBuffer = await this.context.decodeAudioData(arrayBuffer);

        this.buffers.set(name, { buffer: audioBuffer, defaultVolume: volume });
    }

    play(name, { loop = false, volume = 1.0, rate = 1.0, pan = 0.0 } = {}) {
        const entry = this.buffers.get(name);
        if (!entry) {
            return;
        }

        const { buffer, defaultVolume } = entry;

        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.loop = loop;
        source.playbackRate.value = rate;

        const gainNode = this.context.createGain();
        gainNode.gain.value = volume * defaultVolume;

        const panner = this.context.createStereoPanner();
        panner.pan.value = pan; // -1 (left) to 1 (right)

        // Connect chain: source → gain → panner → output
        source.connect(gainNode).connect(panner).connect(this.context.destination);
        source.start();

        return source; // So caller can stop() it later
    }

    setVolume(name, volume) {
        const entry = this.buffers.get(name);
        if (entry) {
            entry.defaultVolume = volume;
        }
    }

    stop(source) {
        if (source) {
            try {
                source.stop();
            } catch (e) {
                console.warn('Audio source already stopped or invalid:', e);
            }
        }
    }

    unlock() {
        if (this.context.state === "suspended") {
            this.context.resume();
        }
    }
}
