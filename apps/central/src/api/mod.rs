mod activities;
mod attachments;
mod audio_settings;
mod auth;
pub mod calls;
mod conversations;
mod discovery;
mod federation;
mod friends;
mod gifs;
mod group_calls;
mod keys;
mod messages;
pub mod middleware;
mod preferences;
mod profiles;
pub mod rate_limit;
mod recovery;
mod servers;
mod spotify;
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
        .nest("/activities", activities::routes())
        .nest("/attachments", attachments::routes())
        .nest("/audio-settings", audio_settings::routes())
        .nest("/auth", auth::routes())
        .nest("/calls", calls::routes())
        .nest("/calls/group", group_calls::routes())
        .nest("/conversations", conversations::routes())
        .nest("/discovery", discovery::routes())
        .nest("/federation", federation::routes())
        .nest("/friends", friends::routes())
        .nest("/gifs", gifs::routes())
        .nest("/keys", keys::routes())
        .nest("/messages", messages::routes())
        .nest("/preferences", preferences::routes())
        .nest("/profiles", profiles::routes())
        .nest("/recovery", recovery::routes())
        .nest("/servers", servers::routes())
        .nest("/spotify", spotify::routes())
        .nest("/uploads", uploads::routes())
}
