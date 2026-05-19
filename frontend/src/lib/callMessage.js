/**
 * System messages for 1:1 calls (stored in message.text).
 * Supports both legacy compact tags and underscore form from the client.
 */

export function parseCallCompleted(text) {
    if (!text || typeof text !== "string") return null;
    const t = text.trim();
    const m =
        t.match(/^\[CALL_(AUDIO|VIDEO)_COMPLETED:(\d+)\]$/) ||
        t.match(/^\[CALL(AUDIO|VIDEO)COMPLETED:(\d+)\]$/);
    if (!m) return null;
    const media = m[1].toUpperCase() === "AUDIO" ? "audio" : "video";
    const seconds = parseInt(m[2], 10);
    if (Number.isNaN(seconds)) return null;
    return { media, seconds };
}

export function formatCallDurationVi(seconds) {
    const s = Math.max(0, Number(seconds) || 0);
    if (s <= 0) return "0 giây";
    if (s < 60) return `${s} giây`;
    const m = Math.floor(s / 60);
    const r = s % 60;
    if (r === 0) return `${m} phút`;
    return `${m} phút ${r} giây`;
}

export function parseCallMissed(text) {
    if (!text || typeof text !== "string") return null;
    const t = text.trim();
    if (t === "[CALL_VIDEO_MISSED]" || t.includes("CALL_VIDEO_MISSED")) return { media: "video" };
    if (t === "[CALL_AUDIO_MISSED]" || t.includes("CALL_AUDIO_MISSED")) return { media: "audio" };
    return null;
}

/** Human-readable label for call system tags (sidebar / group preview). */
export function formatCallSystemText(text) {
    if (!text) return null;
    const missed = parseCallMissed(text);
    if (missed) {
        return missed.media === "video" ? "Cuộc gọi video nhỡ" : "Cuộc gọi thoại nhỡ";
    }
    const completed = parseCallCompleted(text);
    if (completed) {
        const label = completed.media === "video" ? "Cuộc gọi video" : "Cuộc gọi thoại";
        return `${label} · ${formatCallDurationVi(completed.seconds)}`;
    }
    return null;
}

export function formatGroupLastMessagePreview(senderName, text) {
    const callLabel = formatCallSystemText(text);
    if (callLabel) return `${senderName}: ${callLabel}`;
    return `${senderName}: ${text}`;
}
