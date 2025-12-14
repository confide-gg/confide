mod audio_settings;
mod auth;
pub mod calls;
mod conversations;
mod discovery;
mod federation;
mod friends;
mod gifs;
mod keys;
mod messages;
pub mod middleware;
mod profiles;
pub mod rate_limit;
mod recovery;
mod servers;
mod uploads;

use axum::{routing::get, Json, Router};
use serde::Serialize;
use std::sync::Arc;

use crate::AppState;

#[derive(Serialize)]
struct VersionResponse {
    version: &'static str,
}

async fn get_version() -> Json<VersionResponse> {
    Json(VersionResponse {
        version: env!("CARGO_PKG_VERSION"),
    })
}

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/version", get(get_version))
        .nest("/auth", auth::routes())
        .nest("/friends", friends::routes())
        .nest("/conversations", conversations::routes())
        .nest("/messages", messages::routes())
        .nest("/keys", keys::routes())
        .nest("/gifs", gifs::routes())
        .nest("/profiles", profiles::routes())
        .nest("/uploads", uploads::routes())
        .nest("/recovery", recovery::routes())
        .nest("/federation", federation::routes())
        .nest("/discovery", discovery::routes())
        .nest("/servers", servers::routes())
        .nest("/calls", calls::routes())
        .nest("/audio-settings", audio_settings::routes())
}
