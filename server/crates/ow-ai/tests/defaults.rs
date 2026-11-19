use futures_util::StreamExt;
use ow_ai::{collect, AiError, AiEvent, AiMessage, Answer, Assistant, BoxFuture, Reply};

struct Only(Result<Answer, AiError>);

impl Assistant for Only {
    fn reply<'a>(
        &'a self,
        _: &'a str,
        _: &'a [AiMessage],
        _: Option<&'a str>,
    ) -> BoxFuture<'a, Result<Answer, AiError>> {
        let answer = self.0.clone();
        Box::pin(async move { answer })
    }
}

async fn events(assistant: &Only) -> Vec<Result<AiEvent, AiError>> {
    assistant.stream("r", &[], None).collect().await
}

#[tokio::test]
async fn an_assistant_with_only_reply_streams_started_one_delta_and_done() {
    let streamed = events(&Only(Ok(Reply::Text("Hi".into()).into()))).await;
    assert_eq!(
        streamed,
        vec![
            Ok(AiEvent::Started),
            Ok(AiEvent::Delta("Hi".into())),
            Ok(AiEvent::Done)
        ]
    );
    assert_eq!(
        events(&Only(Ok(Reply::Nothing.into()))).await,
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

#[tokio::test]
async fn a_session_in_the_answer_streams_before_the_text_and_collects_back() {
    let answer = Answer {
        reply: Reply::Text("Hi".into()),
        session: Some("s2".into()),
    };
    let streamed = events(&Only(Ok(answer.clone()))).await;
    assert_eq!(
        streamed,
        vec![
            Ok(AiEvent::Started),
            Ok(AiEvent::Session("s2".into())),
            Ok(AiEvent::Delta("Hi".into())),
            Ok(AiEvent::Done)
        ]
    );
    let assistant = Only(Ok(answer.clone()));
    assert_eq!(collect(assistant.stream("r", &[], None)).await, Ok(answer));
}
