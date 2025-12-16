mod auth;
mod channels;
mod members;
pub mod messages;
pub mod middleware;
pub mod rate_limit;
mod roles;
pub mod server;
mod setup;

use axum::Router;
use std::sync::Arc;

use crate::AppState;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .nest("/setup", setup::routes())
        .nest("/auth", auth::routes())
        .nest("/channels", channels::routes())
        .nest("/messages", messages::routes())
        .nest("/members", members::routes())
        .nest("/roles", roles::routes())
        .nest("/server", server::routes())
}
