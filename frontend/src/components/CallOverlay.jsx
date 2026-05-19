import { useState, useEffect, useRef, useMemo } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, X, Monitor, MonitorOff } from "lucide-react";
import GroupCallGrid from "./GroupCallGrid";
import { useGroupCallMesh } from "../hooks/useGroupCallMesh";
import { useSpeakingDetector } from "../hooks/useSpeakingDetector";
import toast from "react-hot-toast";

export default function CallOverlay() {
    const { activeCall, acceptCall, rejectCall, endCall, closeCallOverlay, initiateCall } = useChatStore();
    const { authUser } = useAuthStore();
    
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(activeCall?.type !== "video");
    const [seconds, setSeconds] = useState(0);
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [remoteHasVideo, setRemoteHasVideo] = useState(false);
    const [remoteCameraEnabled, setRemoteCameraEnabled] = useState(true);
    const [screenStream, setScreenStream] = useState(null);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [groupScreenShareUsers, setGroupScreenShareUsers] = useState(() => {
        if (!activeCall?.isGroup) return {};
        const room = useChatStore.getState().groupCalls[activeCall.receiverId];
        return room?.screenSharers || {};
    });
    
    const videoRef = useRef(null);
    const screenStreamRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const ringtoneIntervalRef = useRef(null);
    const audioCtxRef = useRef(null);
    const oscillatorRef = useRef(null);
    const gainNodeRef = useRef(null);
    const secondsRef = useRef(0);

    const socket = useAuthStore.getState().socket;

    // Helper to get correct display info (group vs 1-on-1, caller vs receiver)
    const getCallDisplayInfo = () => {
        if (!activeCall) return { name: "", avatar: "/avatar.png" };
        
        if (activeCall.isGroup) {
            // Group call: always show group/receiver info
            return {
                name: activeCall.receiverName || "Cuộc gọi nhóm",
                avatar: activeCall.receiverAvatar || "/avatar.png"
            };
        } else {
            // 1-on-1 call
            if (activeCall.isIncoming) {
                // Receiver shows Caller info
                return {
                    name: activeCall.callerName || "Người dùng",
                    avatar: activeCall.callerAvatar || "/avatar.png"
                };
            } else {
                // Caller shows Receiver info
                return {
                    name: activeCall.receiverName || "Người dùng",
                    avatar: activeCall.receiverAvatar || "/avatar.png"
                };
            }
        }
    };

    const { name: displayName, avatar: displayAvatar } = getCallDisplayInfo();

    const myId = authUser?._id?.toString();
    const callerIdStr =
        typeof activeCall?.callerId === "object"
            ? activeCall?.callerId?._id?.toString()
            : activeCall?.callerId?.toString();
    const isMeCaller = Boolean(myId && callerIdStr && myId === callerIdStr);
    const remoteName = activeCall?.isGroup
        ? displayName
        : (isMeCaller ? activeCall?.receiverName : activeCall?.callerName) || displayName;
    const remoteAvatar = activeCall?.isGroup
        ? displayAvatar
        : (isMeCaller ? activeCall?.receiverAvatar : activeCall?.callerAvatar) || displayAvatar;
    const localAvatar = authUser?.profilePic || "/avatar.png";
    const isGroupConnected =
        activeCall?.isGroup && activeCall?.status === "connected";

    const gridParticipants = useMemo(() => {
        if (!activeCall?.isGroup || !authUser) return [];
        const list = [...(activeCall.participants || [])];
        if (!list.some((p) => p.userId?.toString() === myId)) {
            list.push({
                userId: authUser._id,
                fullName: authUser.fullName,
                profilePic: authUser.profilePic || "",
            });
        }
        return list;
    }, [activeCall?.participants, activeCall?.isGroup, authUser, myId]);

    const {
        remoteStreams,
        remoteVideoOn,
        cleanupAll: cleanupMesh,
        replaceOutgoingVideoTrack,
        saveCameraTrack,
        getSavedCameraTrack,
    } = useGroupCallMesh({
        enabled: isGroupConnected,
        localStream,
        myId,
        participants: gridParticipants,
        groupId: activeCall?.receiverId,
        socket,
    });

    const speaking = useSpeakingDetector({
        enabled: isGroupConnected,
        myId,
        localStream,
        isMuted,
        remoteStreams,
    });

    const stopScreenShare = async () => {
        const stream = screenStreamRef.current;
        if (stream) {
            stream.getTracks().forEach((t) => t.stop());
            screenStreamRef.current = null;
        }
        setScreenStream(null);
        setIsScreenSharing(false);
        if (myId) {
            setGroupScreenShareUsers((prev) => ({
                ...prev,
                [myId]: false,
            }));
        }

        if (isGroupConnected && socket && activeCall?.receiverId) {
            socket.emit("groupScreenShare", {
                groupId: activeCall.receiverId,
                userId: authUser?._id,
                active: false,
                userName: authUser?.fullName,
            });
            const cam = getSavedCameraTrack?.();
            const videoTrack =
                cam && cam.readyState === "live"
                    ? cam
                    : localStream?.getVideoTracks?.()[0] || null;
            await replaceOutgoingVideoTrack?.(videoTrack);
        }
    };

    const startScreenShare = async () => {
        if (!isGroupConnected) {
            toast.error("Chia sẻ màn hình chỉ hỗ trợ cuộc gọi nhóm");
            return;
        }
        try {
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true,
            });
            const screenTrack = displayStream.getVideoTracks()[0];
            if (!screenTrack) {
                displayStream.getTracks().forEach((t) => t.stop());
                return;
            }

            const camTrack = localStream?.getVideoTracks?.()[0];
            if (camTrack) saveCameraTrack?.(camTrack);

            screenStreamRef.current = displayStream;
            setScreenStream(displayStream);
            setIsScreenSharing(true);
            setIsMuted(true); // default to muted as requested!
            
            if (myId) {
                setGroupScreenShareUsers((prev) => ({
                    ...prev,
                    [myId]: true,
                }));
            }

            screenTrack.onended = () => stopScreenShare();

            await replaceOutgoingVideoTrack?.(screenTrack);

            socket?.emit("groupScreenShare", {
                groupId: activeCall.receiverId,
                userId: authUser?._id,
                active: true,
                userName: authUser?.fullName,
            });
            toast.success("Đang chia sẻ màn hình! Chú ý: Để chia sẻ Zalo hay Thư mục, hãy chắc chắn ứng dụng đang MỞ (không thu nhỏ) và chọn tab 'Cửa sổ' (Window) hoặc 'Toàn màn hình' trong hộp thoại chia sẻ của trình duyệt!", {
                duration: 8000,
                icon: '🖥️'
            });
        } catch (err) {
            if (err?.name !== "NotAllowedError") {
                toast.error("Không thể chia sẻ màn hình");
            }
        }
    };

    useEffect(() => {
        if (!socket || !isGroupConnected) return;
        
        const onShare = ({ groupId, userId, active }) => {
            if (groupId !== activeCall?.receiverId) return;
            const uid = userId?.toString();
            setGroupScreenShareUsers((prev) => ({
                ...prev,
                [uid]: Boolean(active),
            }));
        };

        const onGroupUpdated = (state) => {
            if (state?.groupId === activeCall?.receiverId && state?.screenSharers) {
                setGroupScreenShareUsers(state.screenSharers);
            }
        };

        socket.on("groupScreenShare", onShare);
        socket.on("groupCallUpdated", onGroupUpdated);
        socket.on("groupCallState", onGroupUpdated);
        
        return () => {
            socket.off("groupScreenShare", onShare);
            socket.off("groupCallUpdated", onGroupUpdated);
            socket.off("groupCallState", onGroupUpdated);
        };
    }, [socket, isGroupConnected, activeCall?.receiverId]);

    useEffect(() => {
        if (activeCall?.status === "connected") return;
        if (screenStreamRef.current) stopScreenShare();
    }, [activeCall?.status]);

    // Play synthetic ringtone using Web Audio API
    const startRingtone = (incoming = false) => {
        try {
            stopRingtone();
            
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioContext();
            audioCtxRef.current = ctx;
            
            const osc = ctx.createOscillator();
            oscillatorRef.current = osc;
            
            const gain = ctx.createGain();
            gainNodeRef.current = gain;
            
            osc.type = "sine";
            // Different tones for incoming vs outgoing
            osc.frequency.setValueAtTime(incoming ? 400 : 440, ctx.currentTime);
            
            gain.gain.setValueAtTime(0, ctx.currentTime);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            
            let isRing = true;
            ringtoneIntervalRef.current = setInterval(() => {
                if (ctx.state === "closed") return;
                if (isRing) {
                    gain.gain.setTargetAtTime(incoming ? 0.4 : 0.25, ctx.currentTime, 0.1);
                } else {
                    gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
                }
                isRing = !isRing;
            }, incoming ? 800 : 1500);
        } catch (e) {
            console.error("Audio Context failed to start:", e);
        }
    };

    const stopRingtone = () => {
        if (ringtoneIntervalRef.current) {
            clearInterval(ringtoneIntervalRef.current);
            ringtoneIntervalRef.current = null;
        }
        try {
            if (oscillatorRef.current) {
                oscillatorRef.current.stop();
                oscillatorRef.current.disconnect();
                oscillatorRef.current = null;
            }
            if (gainNodeRef.current) {
                gainNodeRef.current.disconnect();
                gainNodeRef.current = null;
            }
            if (audioCtxRef.current) {
                audioCtxRef.current.close();
                audioCtxRef.current = null;
            }
        } catch (e) {}
    };

    // Access local media stream
    const startCamera = async () => {
        try {
            if (localStream) {
                localStream.getTracks().forEach(t => t.stop());
            }
            const constraints = {
                video: activeCall?.type === "video" ? {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: "user"
                } : false,
                audio: true
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            setLocalStream(stream);
            const vt = stream.getVideoTracks()[0];
            if (vt && activeCall?.isGroup) saveCameraTrack?.(vt);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            return stream;
        } catch (err) {
            console.warn("Media devices access denied or unavailable:", err);
            // Fallback to audio only if video fails or is unavailable
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                setLocalStream(stream);
                return stream;
            } catch (e) {
                console.error("Audio access also denied:", e);
                return null;
            }
        }
    };

    const stopCamera = () => {
        if (localStream) {
            localStream.getTracks().forEach(t => t.stop());
            setLocalStream(null);
        }
    };

    const cleanupWebRTC = () => {
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach((t) => t.stop());
            screenStreamRef.current = null;
        }
        setScreenStream(null);
        setIsScreenSharing(false);
        setGroupScreenShareUsers({});
        stopCamera();
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        setRemoteStream(null);
        setRemoteCameraEnabled(true);
        cleanupMesh?.();
    };

    // Ringtone Control Effect
    useEffect(() => {
        if (!activeCall) return;
        
        if (activeCall.status === "ringing") {
            startRingtone(activeCall.isIncoming);
        } else {
            stopRingtone();
        }

        return () => stopRingtone();
    }, [activeCall?.status, activeCall?.isIncoming]);

    // Camera for group + 1:1 when connected
    useEffect(() => {
        let isCurrent = true;
        if (activeCall?.status === "connected") {
            const connect = async () => {
                const stream = await startCamera();
                if (!isCurrent) return;
                if (activeCall?.isGroup) return;
                if (!isCurrent || !stream) return;
                
                try {
                    const pc = new RTCPeerConnection({
                        iceServers: [
                            { urls: "stun:stun.l.google.com:19302" },
                            { urls: "stun:stun1.l.google.com:19302" },
                            { urls: "stun:stun2.l.google.com:19302" }
                        ]
                    });
                    peerConnectionRef.current = pc;

                    // Add local tracks to peer connection
                    stream.getTracks().forEach(track => {
                        pc.addTrack(track, stream);
                    });

                    // Handle ICE candidates
                    pc.onicecandidate = (event) => {
                        if (event.candidate && socket) {
                            const targetId = activeCall.isIncoming ? activeCall.callerId : activeCall.receiverId;
                            socket.emit("webrtcSignal", {
                                targetId,
                                signal: { type: "candidate", candidate: event.candidate }
                            });
                        }
                    };

                    // Handle remote tracks
                    pc.ontrack = (event) => {
                        const [remoteStreamInstance] = event.streams;
                        setRemoteStream(remoteStreamInstance);
                        if (remoteVideoRef.current) {
                            remoteVideoRef.current.srcObject = remoteStreamInstance;
                        }
                    };

                    // Caller initiates the offer
                    if (!activeCall.isIncoming) {
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        const targetId = activeCall.receiverId;
                        socket.emit("webrtcSignal", {
                            targetId,
                            signal: { type: "offer", sdp: pc.localDescription }
                        });
                    }
                } catch (err) {
                    console.error("Failed to initialize WebRTC connection:", err);
                }
            };
            if (activeCall?.isGroup) {
                startCamera().then(() => {});
            } else {
                connect();
            }
        } else {
            cleanupWebRTC();
        }

        return () => {
            isCurrent = false;
            cleanupWebRTC();
        };
    }, [activeCall?.status, activeCall?.isGroup]);

    // WebRTC Signaling Socket Listener Effect (1:1 only; group uses useGroupCallMesh)
    useEffect(() => {
        if (!socket || !activeCall || activeCall.status !== "connected" || activeCall.isGroup) return;

        const handleSignal = async ({ senderId, signal }) => {
            const pc = peerConnectionRef.current;
            if (!pc) return;

            try {
                if (signal.type === "offer") {
                    await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    socket.emit("webrtcSignal", {
                        targetId: senderId,
                        signal: { type: "answer", sdp: pc.localDescription }
                    });
                } else if (signal.type === "answer") {
                    await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                } else if (signal.type === "candidate") {
                    await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                } else if (signal.type === "videoToggle") {
                    setRemoteCameraEnabled(signal.enabled);
                }
            } catch (err) {
                console.error("Error processing WebRTC signal:", err);
            }
        };

        socket.on("webrtcSignal", handleSignal);
        return () => {
            socket.off("webrtcSignal", handleSignal);
        };
    }, [socket, activeCall?.status]);

    // Toggle track states dynamically when mute or camera toggles
    useEffect(() => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => {
                track.enabled = !isMuted;
            });
        }
    }, [isMuted, localStream]);

    useEffect(() => {
        if (localStream) {
            localStream.getVideoTracks().forEach(track => {
                track.enabled = !isVideoOff;
            });
        }
    }, [isVideoOff, localStream]);

    // Keep secondsRef in sync with seconds state
    useEffect(() => {
        secondsRef.current = seconds;
    }, [seconds]);

    // Reactive binding for local camera element
    useEffect(() => {
        if (videoRef.current && localStream && !isVideoOff) {
            videoRef.current.srcObject = localStream;
        }
    }, [localStream, isVideoOff]);

    // Remote peer video track: show main video only when they send a live picture; keep <video> mounted for audio
    useEffect(() => {
        if (!remoteStream) {
            setRemoteHasVideo(false);
            return;
        }
        const check = () => {
            const tracks = remoteStream.getVideoTracks();
            if (!tracks.length) {
                setRemoteHasVideo(false);
                return;
            }
            const t = tracks[0];
            setRemoteHasVideo(t.readyState === "live" && t.enabled && remoteCameraEnabled);
        };
        check();
        const interval = setInterval(check, 500); // 500ms reactive interval is blazing fast and extremely robust
        return () => clearInterval(interval);
    }, [remoteStream, remoteCameraEnabled]);

    // Reactive binding for remote video element
    useEffect(() => {
        if (remoteVideoRef.current && remoteStream && activeCall?.type === "video") {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream, remoteHasVideo, activeCall?.type]);

    // Log completed call when call disconnected
    useEffect(() => {
        if (!activeCall) return;
        if (activeCall.status === "disconnected") {
            if (secondsRef.current > 0) {
                useChatStore.getState().logCompletedCall(secondsRef.current);
                secondsRef.current = 0; // reset
            }
        }
    }, [activeCall?.status]);

    // Duration Timer Effect
    useEffect(() => {
        if (activeCall?.status !== "connected") {
            setSeconds(0);
            return;
        }
        const timer = setInterval(() => {
            setSeconds(prev => prev + 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [activeCall?.status]);

    if (!activeCall) return null;

    const formatTime = (totalSeconds) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    // RENDER: DISCONNECTED STATE
    if (activeCall.status === "disconnected") {
        return (
            <div className="fixed inset-0 bg-[#0b0c10] text-white flex flex-col items-center justify-center z-[9999] animate-fade-in">
                <div className="flex flex-col items-center space-y-6">
                    <div className="relative">
                        <img 
                            src={displayAvatar} 
                            alt="Avatar" 
                            className="size-28 rounded-full object-cover border-4 border-slate-700 shadow-2xl"
                        />
                    </div>
                    
                    <div className="text-center">
                        <h2 className="text-2xl font-bold tracking-wide">
                            {displayName}
                        </h2>
                        <p className="text-slate-400 mt-2 text-sm font-semibold tracking-wider">
                            {activeCall.endedReason || "Cuộc gọi đã kết thúc"}
                        </p>
                    </div>
                </div>

                <div className="absolute bottom-16 flex items-center gap-12">
                    <button 
                        onClick={() => {
                            if (activeCall.isGroup) {
                                const { selectedUser, setSelectedUser, users } = useChatStore.getState();
                                const group = users.find((u) => u._id === activeCall.receiverId);
                                if (group && selectedUser?._id !== group._id) setSelectedUser(group);
                                initiateCall(activeCall.type, true, activeCall.invitedUsers || []);
                            } else {
                                initiateCall(activeCall.type, false);
                            }
                        }}
                        className="flex flex-col items-center gap-2 group"
                    >
                        <div className="size-14 bg-green-500 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 active:scale-95 transition-all">
                            {activeCall.type === "video" ? <Video className="size-6 text-white" /> : <Phone className="size-6 text-white" />}
                        </div>
                        <span className="text-xs font-semibold text-slate-300">Gọi lại</span>
                    </button>

                    <button 
                        onClick={closeCallOverlay}
                        className="flex flex-col items-center gap-2 group"
                    >
                        <div className="size-14 bg-slate-700 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 active:scale-95 transition-all">
                            <X className="size-6 text-white" />
                        </div>
                        <span className="text-xs font-semibold text-slate-300">Đóng</span>
                    </button>
                </div>
            </div>
        );
    }

    // RENDER: RINGING STATE
    if (activeCall.status === "ringing") {
        return (
            <div className="fixed inset-0 bg-[#0d0f14] text-white flex flex-col items-center justify-between py-20 px-6 z-[9999] animate-fade-in select-none">
                <div className="flex flex-col items-center space-y-6 mt-10">
                    <div className="relative">
                        <div className="absolute inset-0 size-28 bg-primary/20 rounded-full animate-ping"></div>
                        <img 
                            src={displayAvatar} 
                            alt="Avatar" 
                            className="size-28 rounded-full object-cover border-4 border-slate-700/80 shadow-2xl relative z-10"
                        />
                    </div>

                    <div className="text-center">
                        <h2 className="text-2xl font-bold tracking-wide">
                            {displayName}
                        </h2>
                        <p className="text-slate-400 mt-2 text-sm font-semibold tracking-widest animate-pulse">
                            {activeCall.isIncoming 
                                ? `Đang gọi ${activeCall.type === "video" ? "video" : "thoại"} đến...` 
                                : "Đang kết nối cuộc gọi..."
                            }
                        </p>
                    </div>
                </div>

                {/* Call Control Actions */}
                <div className="flex items-center gap-16">
                    {activeCall.isIncoming ? (
                        <>
                            <button 
                                onClick={rejectCall}
                                className="flex flex-col items-center gap-2 group"
                            >
                                <div className="size-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 active:scale-95 transition-all animate-bounce" style={{ animationDuration: '2s' }}>
                                    <PhoneOff className="size-7 text-white" />
                                </div>
                                <span className="text-xs font-bold text-slate-300">Từ chối</span>
                            </button>

                            <button 
                                onClick={acceptCall}
                                className="flex flex-col items-center gap-2 group"
                            >
                                <div className="size-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 active:scale-95 transition-all relative">
                                    <div className="absolute inset-0 size-16 bg-green-400/40 rounded-full animate-ping"></div>
                                    {activeCall.type === "video" ? <Video className="size-7 text-white relative z-10" /> : <Phone className="size-7 text-white relative z-10" />}
                                </div>
                                <span className="text-xs font-bold text-slate-300">Trả lời</span>
                            </button>
                        </>
                    ) : (
                        <button 
                            onClick={endCall}
                            className="flex flex-col items-center gap-2 group"
                        >
                            <div className="size-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 active:scale-95 transition-all">
                                <PhoneOff className="size-7 text-white" />
                            </div>
                            <span className="text-xs font-bold text-slate-300">Hủy gọi</span>
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // RENDER: CONNECTED STATE (ACTIVE CALL)
    return (
        <div className="fixed inset-0 bg-[#07090e] text-white flex flex-col justify-between z-[9999] animate-fade-in select-none">
            {/* Header info bar */}
            <div className="p-6 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 z-20">
                <div className="flex items-center gap-2">
                    <span className="inline-block size-2 bg-green-500 rounded-full animate-ping"></span>
                    <span className="text-xs font-bold text-slate-300 tracking-wider">ĐƯỢC MÃ HÓA ĐẦU CUỐI</span>
                </div>

                {/* Simulated active devices logs exactly like screenshot */}
                <div className="flex flex-col items-end space-y-1 text-[10px] text-slate-400 max-w-[250px]">
                    <div className="bg-black/40 px-2 py-0.5 rounded border border-slate-800 flex items-center gap-1.5">
                        <Mic className="size-3 text-green-400" /> Mic: External Microphone (Realtek)
                    </div>
                    <div className="bg-black/40 px-2 py-0.5 rounded border border-slate-800 flex items-center gap-1.5">
                        <Phone className="size-3 text-sky-400" /> Loa: Headphones (Realtek Audio)
                    </div>
                </div>
            </div>

            {/* Main call stream / avatar screen */}
            <div className="flex-1 flex flex-col relative w-full">
                {isGroupConnected ? (
                    <>
                        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 text-center pointer-events-none">
                            <h2 className="text-lg font-bold">{displayName}</h2>
                            <p className="text-green-400 text-sm font-semibold mt-1">
                                {gridParticipants.length} người · {formatTime(seconds)}
                            </p>
                        </div>
                        <GroupCallGrid
                            participants={gridParticipants}
                            myId={myId}
                            authUser={authUser}
                            localStream={localStream}
                            screenStream={screenStream}
                            isVideoOff={isVideoOff}
                            callType={activeCall.type}
                            remoteStreams={remoteStreams}
                            remoteVideoOn={remoteVideoOn}
                            speaking={speaking}
                            screenShareUserIds={groupScreenShareUsers}
                        />
                    </>
                ) : (
                <>
                {activeCall.type === "video" && remoteStream && (
                    <video 
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-200 ${remoteHasVideo ? "opacity-100" : "opacity-0"}`}
                    />
                )}

                {(!remoteStream || activeCall.type === "audio" || (activeCall.type === "video" && remoteStream && !remoteHasVideo)) && (
                    <div className="flex flex-col items-center justify-center flex-1 space-y-6 z-10 animate-fade-in">
                        <div className="relative">
                            <div className="absolute inset-0 size-32 bg-primary/10 rounded-full animate-pulse ring-4 ring-primary/5"></div>
                            <img 
                                src={remoteAvatar} 
                                alt="Avatar" 
                                className="size-32 rounded-full object-cover border-4 border-slate-700/60 shadow-2xl relative z-10"
                            />
                        </div>
                        
                        <div className="text-center z-10">
                            <h2 className="text-2xl font-bold tracking-wide font-sans">
                                {remoteName}
                            </h2>
                            <p className="text-green-400 text-sm font-semibold tracking-wider mt-2.5 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20 inline-block">
                                {formatTime(seconds)}
                            </p>
                        </div>
                    </div>
                )}

                {activeCall.type === "video" && remoteStream && remoteHasVideo && (
                    <div className="absolute top-24 left-6 z-10 bg-black/50 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-800 shadow-xl flex flex-col items-start gap-0.5">
                        <h4 className="font-bold text-sm text-white tracking-wide">{remoteName}</h4>
                        <span className="text-[10px] font-bold text-green-400 flex items-center gap-1.5">
                            <span className="size-1.5 bg-green-500 rounded-full animate-ping"></span>
                            {formatTime(seconds)}
                        </span>
                    </div>
                )}

                {activeCall.type === "video" && !isGroupConnected && (
                    <div className="absolute bottom-28 right-6 w-36 sm:w-48 aspect-[3/4] bg-slate-950 border-2 border-slate-700 rounded-xl overflow-hidden shadow-2xl z-20 animate-fade-in group">
                        {!isVideoOff && localStream ? (
                            <video 
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover scale-x-[-1]"
                            />
                        ) : (
                            <img 
                                src={localAvatar} 
                                alt="Bạn" 
                                className="w-full h-full object-cover"
                            />
                        )}
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 px-2 py-0.5 rounded text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                            Bạn
                        </div>
                    </div>
                )}

                {activeCall.type === "audio" && remoteStream && (
                    <audio
                        ref={(el) => {
                            if (el && remoteStream) {
                                el.srcObject = remoteStream;
                            }
                        }}
                        autoPlay
                    />
                )}
                </>
                )}
            </div>

            {/* Bottom active controls dock bar */}
            <div className="bg-gradient-to-t from-black/95 to-transparent py-10 flex items-center justify-center gap-6 absolute bottom-0 left-0 right-0 z-20">
                {/* Mute Mic control */}
                <button 
                    onClick={() => setIsMuted(prev => !prev)}
                    className={`size-12 rounded-full flex items-center justify-center transition-all ${isMuted ? "bg-red-500 text-white" : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700/50"}`}
                    title={isMuted ? "Mở mic" : "Tắt mic"}
                >
                    {isMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                </button>

                {/* Toggle camera control (Video calls only) */}
                {activeCall.type === "video" && (
                    <button 
                        onClick={() => {
                            const nextVal = !isVideoOff;
                            setIsVideoOff(nextVal);
                            if (isGroupConnected && socket && activeCall?.receiverId) {
                                socket.emit("groupVideoToggle", {
                                    groupId: activeCall.receiverId,
                                    userId: authUser?._id,
                                    enabled: !nextVal,
                                });
                            } else if (!isGroupConnected && socket) {
                                const targetId = activeCall.isIncoming ? activeCall.callerId : activeCall.receiverId;
                                socket.emit("webrtcSignal", {
                                    targetId,
                                    signal: { type: "videoToggle", enabled: !nextVal }
                                });
                            }
                        }}
                        className={`size-12 rounded-full flex items-center justify-center transition-all ${isVideoOff ? "bg-red-500 text-white" : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700/50"}`}
                        title={isVideoOff ? "Bật camera" : "Tắt camera"}
                    >
                        {isVideoOff ? <VideoOff className="size-5" /> : <Video className="size-5" />}
                    </button>
                )}

                {isGroupConnected && (
                    <button
                        type="button"
                        onClick={() => (isScreenSharing ? stopScreenShare() : startScreenShare())}
                        className={`size-12 rounded-full flex items-center justify-center transition-all ${
                            isScreenSharing
                                ? "bg-blue-600 text-white ring-2 ring-blue-400"
                                : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700/50"
                        }`}
                        title={isScreenSharing ? "Dừng chia sẻ màn hình" : "Chia sẻ màn hình"}
                    >
                        {isScreenSharing ? (
                            <MonitorOff className="size-5" />
                        ) : (
                            <Monitor className="size-5" />
                        )}
                    </button>
                )}

                {/* End call action */}
                <button 
                    onClick={endCall}
                    className="size-12 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700 hover:scale-105 active:scale-95 transition-all text-white shadow-xl"
                    title="Kết thúc cuộc gọi"
                >
                    <PhoneOff className="size-5" />
                </button>
            </div>
        </div>
    );
}
