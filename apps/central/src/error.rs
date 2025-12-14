use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("authentication required")]
    Unauthorized,

    #[error("invalid credentials")]
    InvalidCredentials,

    #[error("not found: {0}")]
    NotFound(String),

    #[error("user not found")]
    UserNotFound,

    #[error("user already exists")]
    UserAlreadyExists,

    #[error("friend request not found")]
    FriendRequestNotFound,

    #[error("conversation not found")]
    ConversationNotFound,

    #[error("not a member of this conversation")]
    NotConversationMember,

    #[error("forbidden")]
    Forbidden,

    #[error("too many requests")]
    TooManyRequests,

    #[error("recovery not set up")]
    RecoveryNotSetup,

    #[error("invalid request: {0}")]
    BadRequest(String),

    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("crypto error: {0}")]
    Crypto(String),

    #[error("internal error: {0}")]
    Internal(#[from] anyhow::Error),

    #[error("users are not friends")]
    NotFriends,
}

impl From<confide_sdk::SdkError> for AppError {
    fn from(err: confide_sdk::SdkError) -> Self {
        AppError::Crypto(err.to_string())
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, self.to_string()),
            AppError::InvalidCredentials => (StatusCode::UNAUTHORIZED, self.to_string()),
            AppError::NotFound(_) => (StatusCode::NOT_FOUND, self.to_string()),
            AppError::UserNotFound => (StatusCode::NOT_FOUND, self.to_string()),
            AppError::UserAlreadyExists => (StatusCode::CONFLICT, self.to_string()),
            AppError::FriendRequestNotFound => (StatusCode::NOT_FOUND, self.to_string()),
            AppError::ConversationNotFound => (StatusCode::NOT_FOUND, self.to_string()),
            AppError::NotConversationMember => (StatusCode::FORBIDDEN, self.to_string()),
            AppError::Forbidden => (StatusCode::FORBIDDEN, self.to_string()),
            AppError::TooManyRequests => (StatusCode::TOO_MANY_REQUESTS, self.to_string()),
            AppError::RecoveryNotSetup => (StatusCode::BAD_REQUEST, self.to_string()),
            AppError::BadRequest(_) => (StatusCode::BAD_REQUEST, self.to_string()),
            AppError::Database(e) => {
                tracing::error!("database error: {:?}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "internal error".to_string(),
                )
            }
            AppError::Crypto(_) => (StatusCode::INTERNAL_SERVER_ERROR, self.to_string()),
            AppError::Internal(e) => {
                tracing::error!("internal error: {:?}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "internal error".to_string(),
                )
            }
            AppError::NotFriends => (StatusCode::FORBIDDEN, self.to_string()),
        };

        let body = Json(json!({ "error": message }));
        (status, body).into_response()
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
