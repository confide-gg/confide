use anyhow::Result;
use async_trait::async_trait;
use std::sync::Arc;
use std::time::Duration;

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct CleanupStats {
    pub task_name: String,
    pub items_cleaned: usize,
    pub duration_ms: u64,
}

#[async_trait]
#[allow(dead_code)]
pub trait CleanupTask: Send + Sync {
    async fn run(&self) -> Result<CleanupStats>;
    fn interval(&self) -> Duration;
    fn name(&self) -> &'static str;
}

#[allow(dead_code)]
pub struct CleanupScheduler {
    tasks: Vec<Arc<dyn CleanupTask>>,
}

#[allow(dead_code)]
impl CleanupScheduler {
    pub fn new(tasks: Vec<Arc<dyn CleanupTask>>) -> Self {
        Self { tasks }
    }

    pub async fn run(self) {
        let task_handles: Vec<_> = self
            .tasks
            .into_iter()
            .map(|task| {
                tokio::spawn(async move {
                    let task_name = task.name();
                    let interval = task.interval();

                    tracing::info!(
                        "Starting cleanup task: {} (interval: {:?})",
                        task_name,
                        interval
                    );

                    let mut tick_interval = tokio::time::interval(interval);

                    loop {
                        tick_interval.tick().await;

                        match task.run().await {
                            Ok(stats) => {
                                tracing::info!(
                                    "Cleanup task {} completed: cleaned {} items in {}ms",
                                    stats.task_name,
                                    stats.items_cleaned,
                                    stats.duration_ms
                                );
                            }
                            Err(e) => {
                                tracing::error!("Cleanup task {} failed: {}", task_name, e);
                            }
                        }
                    }
                })
            })
            .collect();

        for handle in task_handles {
            if let Err(e) = handle.await {
                tracing::error!("Cleanup task panicked: {}", e);
            }
        }
    }
}
