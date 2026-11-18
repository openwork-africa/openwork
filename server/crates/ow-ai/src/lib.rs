//! The AI reply contract of the Openwork server.
//!
//! The open code only knows this trait and two routes. What answers behind the trait is a plugin
//! the server is built with; with none, `POST /api/ai/reply` answers 404 and the app stays as it was.

mod assistant;
mod copy;
mod routes;

pub use assistant::{collect, AiError, AiEvent, AiMessage, Assistant, BoxFuture, BoxStream, Reply};
pub use routes::{router, router_with_timeout, REPLY_TIMEOUT};
