//! Sessions: a signed token in the `openwork_session` cookie says who is calling.
//!
//! The product that signs people in sets the cookie; this server only verifies it.
//! Token: `v1.<user id, hex>.<expires, unix seconds>.<random id, hex>.<HMAC-SHA256, hex>`,
//! signed with the server secret over everything before the last dot.

use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use axum::http::{header, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use hmac::{Hmac, Mac};
use ow_core::{ChangeRepository, CoreError, FileStore, GUEST_OWNER};
use serde_json::json;
use sha2::Sha256;

use crate::config::Config;
use crate::copy;
use crate::error::ApiError;
use crate::router::AppState;

pub const COOKIE_NAME: &str = "openwork_session";
const VERSION: &str = "v1";
const MIN_SECRET: usize = 32;

type Signer = Hmac<Sha256>;

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn unhex(text: &str) -> Option<Vec<u8>> {
    if text.len() % 2 != 0 || !text.is_ascii() {
        return None;
    }
    (0..text.len())
        .step_by(2)
        .map(|at| u8::from_str_radix(&text[at..at + 2], 16).ok())
        .collect()
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or_default()
}

#[derive(Clone)]
pub struct Sessions {
    secret: Vec<u8>,
    ttl_secs: u64,
}

impl Sessions {
    pub fn new(secret: &str, ttl_secs: u64) -> Result<Sessions, CoreError> {
        if secret.len() < MIN_SECRET {
            return Err(CoreError::Invalid(copy::SECRET_SHORT.into()));
        }
        Ok(Sessions {
            secret: secret.as_bytes().to_vec(),
            ttl_secs,
        })
    }

    /// Sessions when the config turns them on (an error if the secret is missing), none otherwise.
    pub fn from_config(config: &Config) -> Result<Option<Sessions>, CoreError> {
        if !config.sessions {
            return Ok(None);
        }
        let secret = config
            .session_secret
            .as_deref()
            .ok_or_else(|| CoreError::Invalid(copy::SECRET_MISSING.into()))?;
        Sessions::new(secret, config.session_ttl_secs).map(Some)
    }

    pub fn create_session(&self, user_id: &str) -> Result<String, CoreError> {
        self.create_at(user_id, now())
    }

    pub fn verify(&self, token: &str) -> Option<String> {
        self.verify_at(token, now())
    }

    pub fn create_at(&self, user_id: &str, now: u64) -> Result<String, CoreError> {
        if user_id.is_empty() {
            return Err(CoreError::Invalid(copy::NO_USER.into()));
        }
        let mut id = [0u8; 16];
        getrandom::getrandom(&mut id).map_err(|_| CoreError::Invalid(copy::NO_RANDOM.into()))?;
        let body = format!(
            "{VERSION}.{}.{}.{}",
            hex(user_id.as_bytes()),
            now.saturating_add(self.ttl_secs),
            hex(&id)
        );
        let signature = self.signer(&body).finalize().into_bytes();
        Ok(format!("{body}.{}", hex(&signature)))
    }

    pub fn verify_at(&self, token: &str, now: u64) -> Option<String> {
        let (body, signature) = token.rsplit_once('.')?;
        // `verify_slice` compares in constant time.
        self.signer(body).verify_slice(&unhex(signature)?).ok()?;
        let mut parts = body.split('.');
        let (version, user, expires, id) =
            (parts.next()?, parts.next()?, parts.next()?, parts.next()?);
        if version != VERSION || id.is_empty() || parts.next().is_some() {
            return None;
        }
        if expires.parse::<u64>().ok()? <= now {
            return None;
        }
        String::from_utf8(unhex(user)?)
            .ok()
            .filter(|user| !user.is_empty())
    }

    fn signer(&self, body: &str) -> Signer {
        let mut signer = Signer::new_from_slice(&self.secret).expect("HMAC takes any key length");
        signer.update(body.as_bytes());
        signer
    }
}

fn cookie_token(parts: &Parts) -> Option<&str> {
    parts
        .headers
        .get_all(header::COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(|value| value.split(';'))
        .filter_map(|pair| pair.trim().split_once('='))
        .find(|(name, _)| *name == COOKIE_NAME)
        .map(|(_, token)| token)
}

/// Who is calling: a signed-in user, or a guest (no session cookie, or sessions are off).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Caller {
    Guest,
    User(String),
}

impl Caller {
    /// The owner key the store scopes data by; guests share the `GUEST_OWNER` pool.
    pub fn owner(&self) -> &str {
        match self {
            Caller::Guest => GUEST_OWNER,
            Caller::User(id) => id,
        }
    }
}

impl<R: ChangeRepository, F: FileStore> FromRequestParts<Arc<AppState<R, F>>> for Caller {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &Arc<AppState<R, F>>,
    ) -> Result<Caller, ApiError> {
        let Some(sessions) = &state.sessions else {
            return Ok(Caller::Guest);
        };
        let Some(token) = cookie_token(parts) else {
            return Ok(Caller::Guest);
        };
        // A cookie that is present but bad or expired is refused, never quietly treated as a guest.
        sessions
            .verify(token)
            .map(Caller::User)
            .ok_or_else(|| ApiError::new(StatusCode::UNAUTHORIZED, copy::SESSION_EXPIRED))
    }
}

async fn current(caller: Caller) -> Result<Json<serde_json::Value>, ApiError> {
    match caller {
        Caller::User(id) => Ok(Json(json!({ "userId": id }))),
        Caller::Guest => Err(ApiError::new(StatusCode::UNAUTHORIZED, copy::NOT_SIGNED_IN)),
    }
}

async fn logout() -> Response {
    let cleared = format!("{COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
    let mut response = StatusCode::NO_CONTENT.into_response();
    response.headers_mut().insert(
        header::SET_COOKIE,
        HeaderValue::from_str(&cleared).expect("static cookie"),
    );
    response
}

pub fn routes<R: ChangeRepository, F: FileStore>() -> Router<Arc<AppState<R, F>>> {
    Router::new()
        .route("/api/session", get(current))
        .route("/api/session/logout", post(logout))
}

#[cfg(test)]
mod tests {
    use super::*;

    const SECRET: &str = "0123456789abcdef0123456789abcdef";

    fn sessions() -> Sessions {
        Sessions::new(SECRET, 100).unwrap()
    }

    #[test]
    fn a_token_verifies_to_its_user() {
        let token = sessions().create_at("user-é1", 1000).unwrap();
        assert_eq!(
            sessions().verify_at(&token, 1050).as_deref(),
            Some("user-é1")
        );
    }

    #[test]
    fn two_tokens_for_one_user_differ() {
        let one = sessions().create_at("u", 1000).unwrap();
        assert_ne!(one, sessions().create_at("u", 1000).unwrap());
    }

    #[test]
    fn a_tampered_token_is_rejected() {
        let token = sessions().create_at("alice", 1000).unwrap();
        let forged = token.replacen(&hex(b"alice"), &hex(b"bob"), 1);
        assert_eq!(sessions().verify_at(&forged, 1001), None);
        let mut cut = token.clone();
        cut.pop();
        assert_eq!(sessions().verify_at(&cut, 1001), None);
        let later = token.replacen(".1100.", ".9999.", 1);
        assert_eq!(sessions().verify_at(&later, 1001), None);
        assert_eq!(sessions().verify_at("", 1001), None);
        assert_eq!(sessions().verify_at("garbage.x.y", 1001), None);
    }

    #[test]
    fn a_token_from_another_secret_is_rejected() {
        let other = Sessions::new("ffffffffffffffffffffffffffffffff", 100).unwrap();
        let token = other.create_at("alice", 1000).unwrap();
        assert_eq!(sessions().verify_at(&token, 1001), None);
    }

    #[test]
    fn an_expired_token_is_rejected() {
        let token = sessions().create_at("alice", 1000).unwrap();
        assert!(sessions().verify_at(&token, 1099).is_some());
        assert_eq!(sessions().verify_at(&token, 1100), None);
    }

    #[test]
    fn a_missing_or_short_secret_is_an_error() {
        assert!(Sessions::new("", 100).is_err());
        assert!(Sessions::new("too short", 100).is_err());
        assert!(sessions().create_at("", 1).is_err());
    }
}
