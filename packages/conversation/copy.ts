export const SAVED_LABEL = "Saved";
export const RECEIVED_LABEL = "Received";
/** An AI request is taken once the assistant has started on it. */
export const ACCEPTED_LABEL = "Taken";

export const copy = {
  unsupportedKind: "This message type is not supported yet",
  messageActions: "Message actions",
  sendAgain: "Send again",
  notDelivered: "Not delivered",
  notDeliveredTryAgain: "Your message could not be delivered. Please try again.",
  signInAgain: "Please sign in again to send this message.",
  unreachable: "Your workspace could not be reached. Check your connection and try again.",
  errorDetails: "Error details",
  retry: "Retry",
  saved: SAVED_LABEL,
  received: RECEIVED_LABEL,
  accepted: ACCEPTED_LABEL,
  typing: "Typing…",
  today: "Today",
  yesterday: "Yesterday",
  emptyScroller: "Ways to start a conversation",
  emptyTitle: "Notes to self",
  emptyDescription: "Nothing has been said here yet. Write the first message below.",
  placeholder: "Write something…",
  addToConversation: "Add to this conversation",
  addTooltip: "Add an emoji, files, links and more",
  close: "Close",
  sendFailed: "Could not send your message. Please try again.",
  editAddress: "Edit who is in this conversation",
  back: "Back",
  searchAddressee: "Search your contacts or invite someone",
  addSomeone: "Add someone…",
} as const;
