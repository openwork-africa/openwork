pub const NOT_FOUND: &str = "There is nothing at this address.";
pub const STORAGE_FAILED: &str = "The server could not read or save data. Try again.";
pub const FILE_TOO_LARGE: &str =
    "This file is larger than 25 MB, which is the most the server keeps.";
pub const FILE_MISSING: &str = "This file is not on the server.";
pub const PUSH_TOO_LARGE: &str = "This push is too large. Send fewer changes at once.";
pub const PUSH_BODY: &str = "The push body must be JSON like {\"changes\": [...]}.";
pub const SINCE_NOT_NUMBER: &str = "The since value must be a whole number.";
pub const NOT_BUILT: &str = "The app is not built yet. Build the frontend, then start the server with --static pointing at its dist folder.";
pub const BAD_ORIGIN: &str = "A dev origin is not a valid address.";
pub const NOT_SIGNED_IN: &str = "You are not signed in.";
pub const SESSION_EXPIRED: &str = "Your session has ended. Sign in again.";
pub const SECRET_MISSING: &str =
    "Sessions are on, but no session secret is set. Set OPENWORK_SESSION_SECRET (at least 32 characters).";
pub const SECRET_SHORT: &str = "The session secret must be at least 32 characters.";
pub const NO_USER: &str = "A session needs a user id.";
pub const NO_RANDOM: &str = "The server could not make a random session id.";
