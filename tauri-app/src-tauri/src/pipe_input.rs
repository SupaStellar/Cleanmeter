use tokio::sync::mpsc;

pub(crate) enum PipeInput<C, E> {
    Command(C),
    Event(E),
}

/// Reader EOF ends this connection even while the app's command sender lives.
/// Matching only `Some(event)` inside select would disable that branch at EOF
/// and wait indefinitely for a user command instead of reconnecting.
pub(crate) async fn next_input<C, E>(
    commands: &mut mpsc::Receiver<C>,
    events: &mut mpsc::Receiver<E>,
) -> Option<PipeInput<C, E>> {
    tokio::select! {
        Some(command) = commands.recv() => Some(PipeInput::Command(command)),
        event = events.recv() => event.map(PipeInput::Event),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;
    use tokio::time::timeout;

    #[tokio::test]
    async fn reader_eof_ends_connection_with_command_sender_still_alive() {
        let (command_tx, mut commands) = mpsc::channel::<()>(1);
        let (event_tx, mut events) = mpsc::channel::<()>(1);
        drop(event_tx);

        let input = timeout(Duration::from_secs(1), next_input(&mut commands, &mut events))
            .await
            .expect("reader EOF must not wait for a user command");
        assert!(input.is_none());
        assert!(!command_tx.is_closed());
    }

    #[tokio::test]
    async fn queued_sensor_events_are_drained_before_eof() {
        let (_command_tx, mut commands) = mpsc::channel::<()>(1);
        let (event_tx, mut events) = mpsc::channel(1);
        event_tx.send(42).await.unwrap();
        drop(event_tx);

        assert!(matches!(
            next_input(&mut commands, &mut events).await,
            Some(PipeInput::Event(42))
        ));
        assert!(next_input(&mut commands, &mut events).await.is_none());
    }

    #[tokio::test]
    async fn commands_still_flow_while_reader_is_idle() {
        let (command_tx, mut commands) = mpsc::channel(1);
        let (_event_tx, mut events) = mpsc::channel::<()>(1);
        command_tx.send(7).await.unwrap();

        assert!(matches!(
            next_input(&mut commands, &mut events).await,
            Some(PipeInput::Command(7))
        ));
    }

    #[tokio::test]
    async fn closed_command_channel_does_not_drop_sensor_events() {
        let (command_tx, mut commands) = mpsc::channel::<()>(1);
        let (event_tx, mut events) = mpsc::channel(1);
        drop(command_tx);
        event_tx.send(42).await.unwrap();
        drop(event_tx);

        assert!(matches!(
            next_input(&mut commands, &mut events).await,
            Some(PipeInput::Event(42))
        ));
        assert!(next_input(&mut commands, &mut events).await.is_none());
    }
}
