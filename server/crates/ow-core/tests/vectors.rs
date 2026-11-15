use ow_core::{FileItem, Message, PullAnswer, PushBody, Room};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Vectors {
    room: Room,
    message: Message,
    file_item: FileItem,
    push_body: PushBody,
    pull_answer: PullAnswer,
}

#[test]
fn entity_vectors_survive_a_round_trip_byte_for_byte() {
    let text = include_str!("../../../test-vectors/entities.json");
    let vectors: Vectors = serde_json::from_str(text).expect("vectors parse");
    let again = serde_json::to_string_pretty(&vectors).expect("vectors serialise") + "\n";
    assert_eq!(again, text);
}
