use serde::{Deserialize, Serialize};
use serde_json::Value;

use std::fmt;
use std::str::FromStr;

use crate::copy;
use crate::error::CoreError;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Room {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub picture: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub background: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub accent: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub activity_at: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub deleted: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    pub id: String,
    pub room_id: String,
    pub author_id: String,
    pub content: String,
    /// What kind of message this is, as an open string any plugin may define; the server keeps it as given.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub deleted: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileItem {
    pub id: String,
    pub parent_id: String,
    pub name: String,
    pub mime_type: String,
    pub size: u64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Room,
    Message,
    File,
}

impl fmt::Display for Kind {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Kind::Room => "room",
            Kind::Message => "message",
            Kind::File => "file",
        })
    }
}

impl FromStr for Kind {
    type Err = CoreError;

    fn from_str(text: &str) -> Result<Kind, CoreError> {
        match text {
            "room" => Ok(Kind::Room),
            "message" => Ok(Kind::Message),
            "file" => Ok(Kind::File),
            _ => Err(CoreError::Invalid(copy::UNKNOWN_KIND.into())),
        }
    }
}

/// What every stored record has in common.
pub trait Record {
    fn id(&self) -> &str;
    fn updated_at(&self) -> i64;
}

macro_rules! record {
    ($type:ty) => {
        impl Record for $type {
            fn id(&self) -> &str {
                &self.id
            }

            fn updated_at(&self) -> i64 {
                self.updated_at
            }
        }
    };
}

record!(Room);
record!(Message);
record!(FileItem);

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(untagged)]
pub enum Entity {
    Room(Room),
    Message(Message),
    File(FileItem),
}

impl Entity {
    pub fn from_value(kind: Kind, value: Value) -> Result<Entity, serde_json::Error> {
        Ok(match kind {
            Kind::Room => Entity::Room(serde_json::from_value(value)?),
            Kind::Message => Entity::Message(serde_json::from_value(value)?),
            Kind::File => Entity::File(serde_json::from_value(value)?),
        })
    }

    pub fn kind(&self) -> Kind {
        match self {
            Entity::Room(_) => Kind::Room,
            Entity::Message(_) => Kind::Message,
            Entity::File(_) => Kind::File,
        }
    }

    fn record(&self) -> &dyn Record {
        match self {
            Entity::Room(item) => item,
            Entity::Message(item) => item,
            Entity::File(item) => item,
        }
    }

    pub fn id(&self) -> &str {
        self.record().id()
    }

    pub fn updated_at(&self) -> i64 {
        self.record().updated_at()
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Change {
    pub kind: Kind,
    pub id: String,
    pub updated_at: i64,
    pub data: Entity,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawChange {
    kind: Kind,
    id: String,
    updated_at: i64,
    data: Value,
}

impl<'de> Deserialize<'de> for Change {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let raw = RawChange::deserialize(deserializer)?;
        let data = Entity::from_value(raw.kind, raw.data).map_err(serde::de::Error::custom)?;
        Ok(Change {
            kind: raw.kind,
            id: raw.id,
            updated_at: raw.updated_at,
            data,
        })
    }
}

impl Change {
    pub fn from_value(value: Value) -> Result<Change, CoreError> {
        let change: Change = serde_json::from_value(value)
            .map_err(|error| CoreError::Invalid(format!("{}: {error}", copy::NOT_READABLE)))?;
        change.validate()?;
        Ok(change)
    }

    fn validate(&self) -> Result<(), CoreError> {
        if self.id.is_empty() {
            return Err(CoreError::Invalid(copy::NO_ID.into()));
        }
        if self.data.id() != self.id {
            return Err(CoreError::Invalid(copy::IDS_DIFFER.into()));
        }
        if self.data.updated_at() != self.updated_at {
            return Err(CoreError::Invalid(copy::TIMES_DIFFER.into()));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PushBody {
    pub changes: Vec<Change>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Answer {
    pub id: String,
    pub ok: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

impl Answer {
    pub fn accepted(id: impl Into<String>) -> Answer {
        Answer {
            id: id.into(),
            ok: true,
            message: None,
        }
    }

    pub fn refused(id: impl Into<String>, message: impl Into<String>) -> Answer {
        Answer {
            id: id.into(),
            ok: false,
            message: Some(message.into()),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PushAnswers {
    pub answers: Vec<Answer>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PullAnswer {
    pub changes: Vec<Change>,
    pub cursor: u64,
}
