use serde_json::Value;

use crate::copy;
use crate::entity::{Answer, Change};
use crate::error::CoreError;
use crate::ports::{Applied, ChangeRepository};

/// What a push gave back: one answer per change, and the storage details that were kept out of the answers.
#[derive(Debug, Default)]
pub struct PushOutcome {
    pub answers: Vec<Answer>,
    pub storage_failures: Vec<String>,
}

fn id_of(value: &Value) -> String {
    value
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

pub async fn push<R: ChangeRepository>(
    repository: &R,
    changes: Vec<Value>,
    owner: &str,
) -> PushOutcome {
    let mut outcome = PushOutcome {
        answers: Vec::with_capacity(changes.len()),
        storage_failures: Vec::new(),
    };
    for value in changes {
        let id = id_of(&value);
        let result = match Change::from_value(value) {
            Ok(change) => repository.apply(change, owner).await,
            Err(error) => Err(error),
        };
        outcome.answers.push(match result {
            Ok(Applied::Foreign) => Answer::refused(id, copy::NOT_YOURS),
            Ok(_) => Answer::accepted(id),
            Err(CoreError::Invalid(message)) => Answer::refused(id, message),
            Err(CoreError::Storage(detail)) => {
                outcome.storage_failures.push(detail);
                Answer::refused(id, copy::NOT_SAVED)
            }
        });
    }
    outcome
}
