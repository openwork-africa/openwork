use futures_util::StreamExt;
use ow_ai::{AiError, AiEvent, AiMessage, Assistant, BoxFuture, Reply};

struct Only(Result<Reply, AiError>);

impl Assistant for Only {
    fn reply<'a>(
        &'a self,
        _: &'a str,
        _: &'a [AiMessage],
    ) -> BoxFuture<'a, Result<Reply, AiError>> {
        let answer = self.0.clone();
        Box::pin(async move { answer })
    }
}

async fn events(assistant: &Only) -> Vec<Result<AiEvent, AiError>> {
    assistant.stream("r", &[]).collect().await
}

#[tokio::test]
async fn an_assistant_with_only_reply_streams_started_one_delta_and_done() {
    let streamed = events(&Only(Ok(Reply::Text("Hi".into())))).await;
    assert_eq!(
        streamed,
        vec![
            Ok(AiEvent::Started),
            Ok(AiEvent::Delta("Hi".into())),
            Ok(AiEvent::Done)
        ]
    );
    assert_eq!(
        events(&Only(Ok(Reply::Nothing))).await,
        vec![Ok(AiEvent::Started), Ok(AiEvent::Done)]
    );
}

#[tokio::test]
async fn an_error_from_reply_is_an_error_event_not_a_loop() {
    let streamed = events(&Only(Err(AiError::Failed("x".into())))).await;
    assert_eq!(
        streamed,
        vec![Ok(AiEvent::Started), Err(AiError::Failed("x".into()))]
    );
}
