import { useEffect, useRef } from "react";
import { Monitor } from "lucide-react";

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
}) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = showVideo && stream ? stream : null;
        }
    }, [stream, showVideo]);

    return (
        <div
            className={`relative bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center transition-all duration-300 ${
                isLarge ? "w-full min-h-[220px] sm:min-h-[280px]" : "aspect-video min-h-[120px]"
            } ${
                isSpeaking
                    ? "border-2 border-green-400 shadow-[0_0_20px_rgba(74,222,128,0.45)] ring-2 ring-green-400/50"
                    : "border border-slate-700/80"
            }`}
        >
            {isSpeaking && (
                <div className="absolute inset-0 rounded-xl pointer-events-none speaking-ring z-[5]" />
            )}

            {showVideo && stream ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={isSelf}
                    className={`absolute inset-0 w-full h-full ${
                        isScreenShare ? "object-contain bg-black" : "object-cover"
                    } ${isSelf && !isScreenShare ? "scale-x-[-1]" : ""}`}
                />
            ) : (
                <div className="flex flex-col items-center gap-2 p-4">
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
    screenShareUserId = null,
}) {
    const tiles = (participants || []).map((p) => {
        const id = p.userId?.toString();
        const isSelf = id === myId;
        const isSharer = screenShareUserId && id === screenShareUserId;
        const stream = isSelf
            ? isSharer && screenStream
                ? screenStream
                : localStream
            : remoteStreams[id];
        const showVideo =
            isSharer ||
            (callType === "video" &&
                (isSelf ? (!isVideoOff || isSharer) && !!stream : remoteVideoOn[id]));
        return {
            id,
            name: isSelf ? authUser?.fullName || "Bạn" : p.fullName || "Thành viên",
            avatar: isSelf ? authUser?.profilePic : p.profilePic,
            stream,
            showVideo: Boolean(showVideo && stream),
            isSelf,
            isSpeaking: Boolean(speaking[id]),
            isScreenShare: Boolean(isSharer),
            isLarge: Boolean(isSharer),
        };
    });

    const featured = tiles.find((t) => t.isLarge);
    const rest = featured ? tiles.filter((t) => !t.isLarge) : tiles;

    return (
        <div className="flex-1 w-full p-4 pt-20 pb-32 overflow-y-auto z-10 flex flex-col gap-3 max-w-5xl mx-auto">
            {featured && <ParticipantTile {...featured} isLarge />}
            <div className={`grid ${gridClass(rest.length, !!featured)} gap-2 sm:gap-3 w-full`}>
                {rest.map((t) => (
                    <ParticipantTile key={t.id} {...t} isLarge={false} />
                ))}
            </div>
            {Object.entries(remoteStreams).map(([id, stream]) => (
                <RemoteAudio key={`audio-${id}`} stream={stream} />
            ))}
        </div>
    );
}
