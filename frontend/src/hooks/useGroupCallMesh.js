import { useEffect, useRef, useState, useCallback } from "react";

const ICE_SERVERS = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
];

function trackHasLiveVideo(track) {
    return track && track.readyState === "live" && track.enabled && !track.muted;
}

export function useGroupCallMesh({
    enabled,
    localStream,
    myId,
    participants,
    groupId,
    socket,
}) {
    const peersRef = useRef(new Map());
    const [remoteStreams, setRemoteStreams] = useState({});
    const [remoteVideoOn, setRemoteVideoOn] = useState({});

    const updateRemoteVideo = useCallback((userId, stream) => {
        if (!stream) {
            setRemoteVideoOn((prev) => ({ ...prev, [userId]: false }));
            return;
        }
        const vt = stream.getVideoTracks()[0];
        setRemoteVideoOn((prev) => ({ ...prev, [userId]: trackHasLiveVideo(vt) }));
    }, []);

    const cleanupPeer = useCallback((remoteId) => {
        const pc = peersRef.current.get(remoteId);
        if (pc) {
            pc.close();
            peersRef.current.delete(remoteId);
        }
        setRemoteStreams((prev) => {
            const next = { ...prev };
            delete next[remoteId];
            return next;
        });
        setRemoteVideoOn((prev) => {
            const next = { ...prev };
            delete next[remoteId];
            return next;
        });
    }, []);

    const cleanupAll = useCallback(() => {
        peersRef.current.forEach((pc) => pc.close());
        peersRef.current.clear();
        setRemoteStreams({});
        setRemoteVideoOn({});
    }, []);

    const createPeerConnection = useCallback(
        (remoteId) => {
            const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
            if (localStream) {
                localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
            }
            pc.onicecandidate = (event) => {
                if (event.candidate && socket) {
                    socket.emit("webrtcSignal", {
                        targetId: remoteId,
                        groupId,
                        signal: { type: "candidate", candidate: event.candidate },
                    });
                }
            };
            pc.ontrack = (event) => {
                const [stream] = event.streams;
                setRemoteStreams((prev) => ({ ...prev, [remoteId]: stream }));
                updateRemoteVideo(remoteId, stream);
                const vt = stream.getVideoTracks()[0];
                if (vt) {
                    const refresh = () => updateRemoteVideo(remoteId, stream);
                    vt.addEventListener("mute", refresh);
                    vt.addEventListener("unmute", refresh);
                    vt.addEventListener("ended", refresh);
                }
            };
            return pc;
        },
        [localStream, socket, groupId, updateRemoteVideo]
    );

    const connectToPeer = useCallback(
        async (remoteId) => {
            if (!socket || !myId || remoteId === myId || peersRef.current.has(remoteId)) return;
            const impolite = myId > remoteId;
            const pc = createPeerConnection(remoteId);
            peersRef.current.set(remoteId, pc);

            if (impolite) {
                try {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    socket.emit("webrtcSignal", {
                        targetId: remoteId,
                        groupId,
                        signal: { type: "offer", sdp: pc.localDescription },
                    });
                } catch (err) {
                    console.error("Group mesh offer failed:", err);
                }
            }
        },
        [socket, myId, groupId, createPeerConnection]
    );

    const handleSignal = useCallback(
        async ({ senderId, signal }) => {
            if (!senderId || senderId === myId) return;
            const remoteId = senderId.toString();
            let pc = peersRef.current.get(remoteId);

            try {
                if (signal.type === "offer") {
                    if (!pc) {
                        pc = createPeerConnection(remoteId);
                        peersRef.current.set(remoteId, pc);
                    }
                    await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    socket.emit("webrtcSignal", {
                        targetId: remoteId,
                        groupId,
                        signal: { type: "answer", sdp: pc.localDescription },
                    });
                } else if (signal.type === "answer") {
                    if (!pc) return;
                    await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                } else if (signal.type === "candidate") {
                    if (!pc) {
                        pc = createPeerConnection(remoteId);
                        peersRef.current.set(remoteId, pc);
                    }
                    if (signal.candidate) {
                        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                    }
                }
            } catch (err) {
                console.error("Group mesh signal error:", err);
            }
        },
        [myId, socket, groupId, createPeerConnection]
    );

    useEffect(() => {
        if (!enabled || !localStream || !myId || !participants?.length) return;

        const remoteIds = participants
            .map((p) => p.userId?.toString())
            .filter((id) => id && id !== myId);

        remoteIds.forEach((id) => connectToPeer(id));

        const current = new Set(remoteIds);
        peersRef.current.forEach((_, id) => {
            if (!current.has(id)) cleanupPeer(id);
        });

        return () => {};
    }, [enabled, localStream, myId, participants, connectToPeer, cleanupPeer]);

    useEffect(() => {
        if (!enabled) {
            cleanupAll();
        }
        return () => {
            if (!enabled) cleanupAll();
        };
    }, [enabled, cleanupAll]);

    useEffect(() => {
        if (!enabled || !socket) return;
        const onSignal = (payload) => {
            if (payload.groupId && payload.groupId !== groupId) return;
            handleSignal(payload);
        };
        socket.on("webrtcSignal", onSignal);
        return () => socket.off("webrtcSignal", onSignal);
    }, [enabled, socket, groupId, handleSignal]);

    useEffect(() => {
        if (!enabled || !localStream) return;
        const interval = setInterval(() => {
            setRemoteStreams((prev) => {
                Object.entries(prev).forEach(([id, stream]) => updateRemoteVideo(id, stream));
                return prev;
            });
        }, 800);
        return () => clearInterval(interval);
    }, [enabled, localStream, updateRemoteVideo]);

    useEffect(() => {
        if (!enabled || !localStream) return;
        peersRef.current.forEach((pc) => {
            const senders = pc.getSenders();
            localStream.getTracks().forEach((track) => {
                const sender = senders.find((s) => s.track?.kind === track.kind);
                if (sender) {
                    sender.replaceTrack(track);
                } else {
                    pc.addTrack(track, localStream);
                }
            });
        });
    }, [enabled, localStream]);

    return { remoteStreams, remoteVideoOn, cleanupAll };
}
