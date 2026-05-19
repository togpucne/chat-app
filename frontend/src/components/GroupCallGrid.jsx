import { useEffect, useRef } from "react";

function ParticipantTile({ name, avatar, stream, showVideo, isSelf }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = showVideo && stream ? stream : null;
        }
    }, [stream, showVideo]);

    return (
        <div className="relative bg-slate-900 rounded-xl overflow-hidden border border-slate-700/80 aspect-video flex items-center justify-center min-h-[120px]">
            {showVideo && stream ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={isSelf}
                    className={`absolute inset-0 w-full h-full object-cover ${isSelf ? "scale-x-[-1]" : ""}`}
                />
            ) : (
                <div className="flex flex-col items-center gap-2 p-4">
                    <img
                        src={avatar || "/avatar.png"}
                        alt={name}
                        className="size-16 sm:size-20 rounded-full object-cover border-2 border-slate-600"
                    />
                </div>
            )}
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

function gridClass(count) {
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
    isVideoOff,
    callType,
    remoteStreams = {},
    remoteVideoOn = {},
}) {
    const tiles = (participants || []).map((p) => {
        const id = p.userId?.toString();
        const isSelf = id === myId;
        const stream = isSelf ? localStream : remoteStreams[id];
        const showVideo =
            callType === "video" &&
            (isSelf ? !isVideoOff && !!localStream : remoteVideoOn[id]);
        return {
            id,
            name: isSelf ? authUser?.fullName || "Bạn" : p.fullName || "Thành viên",
            avatar: isSelf ? authUser?.profilePic : p.profilePic,
            stream,
            showVideo,
            isSelf,
        };
    });

    return (
        <div className="flex-1 w-full p-4 pt-20 pb-32 overflow-y-auto z-10">
            <div className={`grid ${gridClass(tiles.length)} gap-2 sm:gap-3 w-full max-w-5xl mx-auto`}>
                {tiles.map((t) => (
                    <ParticipantTile
                        key={t.id}
                        name={t.name}
                        avatar={t.avatar}
                        stream={t.stream}
                        showVideo={t.showVideo}
                        isSelf={t.isSelf}
                    />
                ))}
            </div>
            {Object.entries(remoteStreams).map(([id, stream]) => (
                <RemoteAudio key={`audio-${id}`} stream={stream} />
            ))}
        </div>
    );
}
