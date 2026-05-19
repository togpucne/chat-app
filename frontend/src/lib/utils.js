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