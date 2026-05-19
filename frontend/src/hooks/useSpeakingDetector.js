import { useEffect, useState, useRef } from "react";

const SPEAK_THRESHOLD = 18;
const SPEAK_HOLD_MS = 280;

function createAnalyser(ctx, stream) {
    if (!stream?.getAudioTracks?.().length) return null;
    const track = stream.getAudioTracks()[0];
    if (!track.enabled || track.muted) return null;
    try {
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.65;
        source.connect(analyser);
        return analyser;
    } catch {
        return null;
    }
}

function getLevel(analyser, dataArray) {
    analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
    return sum / dataArray.length;
}

/**
 * Detects who is speaking from local + remote MediaStreams (Web Audio level).
 */
export function useSpeakingDetector({ enabled, myId, localStream, isMuted, remoteStreams }) {
    const [speaking, setSpeaking] = useState({});
    const ctxRef = useRef(null);
    const lastSpeakRef = useRef({});
    const rafRef = useRef(null);

    useEffect(() => {
        if (!enabled) {
            setSpeaking({});
            return;
        }

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContext();
        ctxRef.current = ctx;

        const analysers = new Map();
        const dataArrays = new Map();

        const attach = (id, stream) => {
            if (!id || !stream) return;
            const a = createAnalyser(ctx, stream);
            if (a) {
                analysers.set(id, a);
                dataArrays.set(id, new Uint8Array(a.frequencyBinCount));
            }
        };

        if (myId && localStream && !isMuted) attach(myId, localStream);
        Object.entries(remoteStreams || {}).forEach(([id, stream]) => attach(id, stream));

        const tick = () => {
            const now = Date.now();
            const next = {};

            analysers.forEach((analyser, id) => {
                const arr = dataArrays.get(id);
                const level = getLevel(analyser, arr);
                if (level > SPEAK_THRESHOLD) {
                    lastSpeakRef.current[id] = now;
                }
                next[id] = now - (lastSpeakRef.current[id] || 0) < SPEAK_HOLD_MS;
            });

            setSpeaking((prev) => {
                const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
                for (const k of keys) {
                    if (prev[k] !== next[k]) return next;
                }
                return prev;
            });

            rafRef.current = requestAnimationFrame(tick);
        };

        ctx.resume().catch(() => {});
        rafRef.current = requestAnimationFrame(tick);

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            ctx.close().catch(() => {});
            ctxRef.current = null;
            analysers.clear();
        };
    }, [enabled, myId, localStream, isMuted, remoteStreams]);

    return speaking;
}
