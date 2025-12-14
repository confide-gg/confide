use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

pub type Result<T> = std::result::Result<T, AppError>;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Redis error: {0}")]
    Redis(#[from] redis::RedisError),

    #[error("Crypto error: {0}")]
    Crypto(String),

    #[error("Unauthorized")]
    Unauthorized,

    #[error("Forbidden")]
    Forbidden,

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Server not setup")]
    ServerNotSetup,

    #[error("Invalid setup token")]
    InvalidSetupToken,

    #[error("Federation error: {0}")]
    Federation(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl From<confide_sdk::SdkError> for AppError {
    fn from(err: confide_sdk::SdkError) -> Self {
        AppError::Crypto(err.to_string())
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            AppError::Database(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error"),
            AppError::Redis(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Cache error"),
            AppError::Crypto(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Crypto error"),
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, "Unauthorized"),
            AppError::Forbidden => (StatusCode::FORBIDDEN, "Forbidden"),
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg.as_str()),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.as_str()),
            AppError::ServerNotSetup => (StatusCode::SERVICE_UNAVAILABLE, "Server not setup"),
            AppError::InvalidSetupToken => (StatusCode::UNAUTHORIZED, "Invalid setup token"),
            AppError::Federation(msg) => (StatusCode::BAD_GATEWAY, msg.as_str()),
            AppError::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg.as_str()),
        };

        let body = Json(json!({ "error": message }));
        (status, body).into_response()
    }
}
