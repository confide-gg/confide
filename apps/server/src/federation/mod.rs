mod heartbeat;
mod identity;

pub use heartbeat::HeartbeatService;
pub use identity::verify_federation_token;

pub const CENTRAL_API_URL: &str = "https://central.confide.gg/api";
