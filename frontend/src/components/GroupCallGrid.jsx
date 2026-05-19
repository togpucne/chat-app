import { useEffect, useRef, useState } from "react";
import { Monitor, Maximize2, Minimize2 } from "lucide-react";

function SpeakingWaves() {
    return (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-end justify-center gap-0.5 h-5 z-20 pointer-events-none">
            {[0, 1, 2, 3, 4].map((i) => (
                <span
                    key={i}
                    className="speaking-bar w-1 rounded-full bg-green-400"
                    style={{ animationDelay: `${i * 0.12}s` }}
                />
            ))}
        </div>
    );
}

function ParticipantTile({
    name,
    avatar,
    stream,
    showVideo,
    isSelf,
    isSpeaking,
    isScreenShare,
    isLarge,
    onClick,
}) {
    const [isActuallyPlaying, setIsActuallyPlaying] = useState(false);

    useEffect(() => {
        if (!showVideo || !stream) {
            setIsActuallyPlaying(false);
        }
    }, [showVideo, stream]);

    return (
        <div
            onClick={onClick}
            className={`relative bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center transition-all duration-300 cursor-pointer group/tile ${
                isLarge 
                    ? "w-full min-h-[260px] sm:min-h-[380px] md:min-h-[460px] lg:min-h-[520px]" 
                    : "aspect-video min-h-[120px]"
            } ${
                isSpeaking
                    ? "border-2 border-green-400 shadow-[0_0_20px_rgba(74,222,128,0.45)] ring-2 ring-green-400/50"
                    : "border border-slate-700/80 hover:border-slate-500"
            }`}
        >
            {isSpeaking && (
                <div className="absolute inset-0 rounded-xl pointer-events-none speaking-ring z-[5]" />
            )}

            {showVideo && stream && (
                <video
                    ref={(el) => {
                        if (el && el.srcObject !== stream) {
                            el.srcObject = stream;
                        }
                    }}
                    autoPlay
                    playsInline
                    muted={isSelf}
                    onPlaying={() => setIsActuallyPlaying(true)}
                    className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${
                        isScreenShare ? "object-contain bg-black" : "object-cover"
                    } ${isSelf && !isScreenShare ? "scale-x-[-1]" : ""} ${
                        isActuallyPlaying ? "opacity-100" : "opacity-0"
                    }`}
                />
            )}

            {(!showVideo || !stream || !isActuallyPlaying) && (
                <div className="flex flex-col items-center gap-2 p-4 z-10">
                    <img
                        src={avatar || "/avatar.png"}
                        alt={name}
                        className={`rounded-full object-cover border-2 border-slate-600 ${
                            isLarge ? "size-24 sm:size-28" : "size-16 sm:size-20"
                        }`}
                    />
                </div>
            )}

            {isScreenShare && (
                <div className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-blue-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                    <Monitor className="size-3" />
                    Chia sẻ màn hình
                </div>
            )}

            {/* Hover overlay to zoom / click-to-enlarge */}
            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                <div className="bg-slate-900/90 border border-slate-700/50 rounded-xl px-4 py-2 flex items-center gap-2 text-xs font-bold text-white shadow-xl pointer-events-none">
                    {isLarge ? (
                        <>
                            <Minimize2 className="size-4 text-rose-400" />
                            Thu nhỏ màn hình
                        </>
                    ) : (
                        <>
                            <Maximize2 className="size-4 text-emerald-400" />
                            Bấm để phóng to
                        </>
                    )}
                </div>
            </div>

            {isSpeaking && <SpeakingWaves />}

            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 z-10">
                <span className="text-xs font-bold text-white truncate block">
                    {isSelf ? `${name} (Bạn)` : name}
                </span>
            </div>
        </div>
    );
}

function RemoteAudio({ stream }) {
    const ref = useRef(null);
    useEffect(() => {
        if (ref.current && stream) ref.current.srcObject = stream;
    }, [stream]);
    return <audio ref={ref} autoPlay playsInline className="hidden" />;
}

function gridClass(count, hasFeatured) {
    if (hasFeatured) return "grid-cols-2 sm:grid-cols-3";
    if (count <= 1) return "grid-cols-1 max-w-lg mx-auto";
    if (count === 2) return "grid-cols-2";
    if (count <= 4) return "grid-cols-2";
    if (count <= 6) return "grid-cols-3";
    return "grid-cols-3 sm:grid-cols-4";
}

export default function GroupCallGrid({
    participants = [],
    myId,
    authUser,
    localStream,
    screenStream,
    isVideoOff,
    callType,
    remoteStreams = {},
    remoteVideoOn = {},
    speaking = {},
    screenShareUserIds = {}, // accepts map of user ids sharing screens
}) {
    const [featuredUserId, setFeaturedUserId] = useState(null);

    const tiles = (participants || []).map((p) => {
        const id = p.userId?.toString();
        const isSelf = id === myId;
        const isSharer = Boolean(screenShareUserIds && screenShareUserIds[id]);
        const stream = isSelf
            ? isSharer && screenStream
                ? screenStream
                : localStream
            : remoteStreams[id];
        const showVideo = isSelf
            ? (isSharer ? !!screenStream : !isVideoOff && !!localStream)
            : (isSharer ? !!stream : p?.videoOn && !!stream);
        return {
            id,
            name: isSelf ? authUser?.fullName || "Bạn" : p.fullName || "Thành viên",
            avatar: isSelf ? authUser?.profilePic : p.profilePic,
            stream,
            showVideo: Boolean(showVideo && stream),
            isSelf,
            isSpeaking: Boolean(speaking[id]),
            isScreenShare: Boolean(isSharer),
        };
    });

    // Determine the featured user (default to first active screen share if no manual zoom)
    const activeFeaturedId =
        featuredUserId && tiles.some((t) => t.id === featuredUserId)
            ? featuredUserId
            : tiles.find((t) => t.isScreenShare)?.id || null;

    const featured = tiles.find((t) => t.id === activeFeaturedId);
    const rest = featured ? tiles.filter((t) => t.id !== activeFeaturedId) : tiles;

    const handleTileClick = (id) => {
        setFeaturedUserId((prev) => (prev === id ? null : id));
    };

    return (
        <div className="flex-1 w-full p-4 pt-20 pb-32 overflow-y-auto z-10 flex flex-col gap-4 max-w-5xl mx-auto">
            {featured && (
                <ParticipantTile
                    {...featured}
                    isLarge={true}
                    onClick={() => handleTileClick(featured.id)}
                />
            )}
            <div className={`grid ${gridClass(rest.length, !!featured)} gap-2 sm:gap-3 w-full`}>
                {rest.map((t) => (
                    <ParticipantTile
                        key={t.id}
                        {...t}
                        isLarge={false}
                        onClick={() => handleTileClick(t.id)}
                    />
                ))}
            </div>
            {Object.entries(remoteStreams).map(([id, stream]) => (
                <RemoteAudio key={`audio-${id}`} stream={stream} />
            ))}
        </div>
    );
}
