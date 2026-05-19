export function formatMessageTime(date) {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Normalize Mongo / socket ids to string keys for maps & comparisons. */
export function normId(id) {
  if (id == null || id === "") return "";
  if (typeof id === "object") return String(id._id ?? id);
  return String(id);
}

/** Pin key — My document dùng id riêng, tránh trùng với user id. */
export function getConvPinKey(authUserId, user) {
  const me = normId(authUserId);
  if (user?.isDocuments) return `pin_my_document_${me}`;
  return `pin_conv_${me}_${normId(user?._id)}`;
}

export function isConvPinned(authUserId, user) {
  if (!authUserId || !user) return false;
  const key = getConvPinKey(authUserId, user);
  if (localStorage.getItem(key) === "true") return true;
  if (user.isDocuments) {
    const legacy = `pin_conv_${normId(authUserId)}_${normId(authUserId)}`;
    return localStorage.getItem(legacy) === "true";
  }
  return false;
}

export function setConvPinned(authUserId, user, pinned) {
  const key = getConvPinKey(authUserId, user);
  if (user?.isDocuments) {
    localStorage.removeItem(`pin_conv_${normId(authUserId)}_${normId(authUserId)}`);
  }
  if (pinned) localStorage.setItem(key, "true");
  else localStorage.removeItem(key);
}