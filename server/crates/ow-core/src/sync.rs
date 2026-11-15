use serde_json::Value;

use crate::entity::{Answer, Change};
use crate::error::CoreError;
use crate::ports::ChangeRepository;

fn id_of(value: &Value) -> String {
    value
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

pub async fn push<R: ChangeRepository>(repository: &R, changes: Vec<Value>) -> Vec<Answer> {
    let mut answers = Vec::with_capacity(changes.len());
    for value in changes {
        let id = id_of(&value);
        let outcome = match Change::from_value(value) {
            Ok(change) => repository.apply(change).await,
            Err(error) => Err(error),
        };
        answers.push(match outcome {
            Ok(_) => Answer::accepted(id),
            Err(CoreError::Invalid(message)) => Answer::refused(id, message),
            Err(CoreError::Storage(_)) => {
                Answer::refused(id, "The server could not save this change. Try again.")
            }
        });
    }
    answers
}

pub fn valid_file_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 128
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}
