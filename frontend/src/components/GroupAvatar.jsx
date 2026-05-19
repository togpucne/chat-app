import React from "react";

export const GroupAvatar = ({ user, size = "size-12" }) => {
    if (!user) return null;

    if (!user.isGroup) {
        return (
            <img
                src={user.profilePic || "/avatar.png"}
                alt={user.fullName}
                className={`${size} object-cover rounded-full`}
            />
        );
    }

    if (user.profilePic) {
        return (
            <img
                src={user.profilePic}
                alt={user.fullName}
                className={`${size} object-cover rounded-full`}
            />
        );
    }

    // Default Group Avatar: Combined grid of first 4 members!
    const membersList = user.members || [];
    const displayMembers = membersList.slice(0, 4);

    return (
        <div className={`${size} grid grid-cols-2 grid-rows-2 gap-[1px] rounded-full overflow-hidden bg-slate-200/80 dark:bg-slate-700/80 p-[1px]`}>
            {displayMembers.map((m, idx) => {
                const isLastSlot = idx === 3 && membersList.length > 4;
                if (isLastSlot) {
                    const remainingCount = membersList.length - 3;
                    return (
                        <div 
                            key="more" 
                            className="bg-primary text-white text-[8px] lg:text-[9px] font-black rounded-full flex items-center justify-center size-full shadow-sm select-none"
                            title={`Và ${remainingCount} thành viên khác`}
                        >
                            +{remainingCount}
                        </div>
                    );
                }

                // Retrieve profile picture of the member object
                const mPic = typeof m === "object" ? m.profilePic : "";
                const mName = typeof m === "object" ? m.fullName : "";

                return (
                    <img
                        key={m._id || idx}
                        src={mPic || "/avatar.png"}
                        alt={mName || "thành viên"}
                        className="size-full object-cover rounded-full border-[0.5px] border-white/20"
                    />
                );
            })}
            
            {/* If there are fewer than 4 members, fill the rest with empty circular slots */}
            {Array.from({ length: Math.max(0, 4 - displayMembers.length) }).map((_, idx) => (
                <div key={`empty-${idx}`} className="bg-slate-300/40 rounded-full size-full border-[0.5px] border-white/10" />
            ))}
        </div>
    );
};

export default GroupAvatar;
