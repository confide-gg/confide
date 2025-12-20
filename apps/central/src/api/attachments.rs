use axum::{
    body::Bytes,
    extract::{Path, State},
    http::{header, HeaderMap},
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use redis::AsyncCommands;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::sync::Arc;
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::AppState;

use super::middleware::AuthUser;

fn sanitize_filename(filename: &str) -> String {
    filename
        .chars()
        .filter(|c| {
            !matches!(
                c,
                '/' | '\\' | '\0' | ':' | '*' | '?' | '"' | '<' | '>' | '|'
            )
        })
        .take(255)
        .collect()
}

const ALLOWED_TYPES: &[&str] = &[
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/html",
    "text/css",
    "text/javascript",
    "text/typescript",
    "text/x-python",
    "text/x-rust",
    "text/x-c",
    "text/x-cpp",
    "text/x-java",
    "text/x-go",
    "text/x-ruby",
    "text/x-php",
    "text/x-swift",
    "text/x-kotlin",
    "text/x-csharp",
    "text/x-shellscript",
    "text/markdown",
    "text/x-yaml",
    "text/xml",
    "application/json",
    "application/javascript",
    "application/x-typescript",
    "application/xml",
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/ogg",
    "audio/aac",
    "audio/m4a",
    "audio/webm",
];

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/upload", post(upload_file))
        .route("/download/{s3_key}", get(download_file))
}

#[derive(Serialize)]
pub struct UploadResponse {
    pub s3_key: String,
}

pub async fn upload_file(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<UploadResponse>> {
    let conversation_id = headers
        .get("x-conversation-id")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AppError::BadRequest("Missing x-conversation-id header".into()))?;

    let filename = headers
        .get("x-filename")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AppError::BadRequest("Missing x-filename header".into()))?;

    let mime_type = headers
        .get("x-mime-type")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AppError::BadRequest("Missing x-mime-type header".into()))?;

    let conversation_id = Uuid::parse_str(conversation_id)
        .map_err(|_| AppError::BadRequest("Invalid conversation ID".into()))?;

    let is_member = state
        .db
        .is_conversation_member(&conversation_id, &auth.user_id)
        .await?;

    if !is_member {
        return Err(AppError::NotConversationMember);
    }

    if body.len() > state.config.s3.max_file_size_bytes {
        return Err(AppError::BadRequest(format!(
            "File size {} exceeds maximum {}",
            body.len(),
            state.config.s3.max_file_size_bytes
        )));
    }

    if !ALLOWED_TYPES.contains(&mime_type) {
        return Err(AppError::BadRequest(format!(
            "MIME type {} not allowed",
            mime_type
        )));
    }

    let hour_key = format!(
        "attachment_uploads:{}:{}",
        auth.user_id,
        Utc::now().format("%Y%m%d%H")
    );
    let mut conn = state
        .redis
        .get_multiplexed_async_connection()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis error: {}", e)))?;

    let count: u32 = conn
        .incr(&hour_key, 1)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis INCR failed: {}", e)))?;

    if count == 1 {
        let _: () = conn
            .expire(&hour_key, 3600)
            .await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis EXPIRE failed: {}", e)))?;
    }

    if count > state.config.uploads.max_uploads_per_hour {
        return Err(AppError::TooManyRequests);
    }

    let sanitized_filename = sanitize_filename(filename);
    let s3_key = state
        .s3
        .upload_file(
            &conversation_id.to_string(),
            &sanitized_filename,
            body.to_vec(),
        )
        .await?;

    Ok(Json(UploadResponse { s3_key }))
}

pub async fn download_file(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(s3_key): Path<String>,
) -> Result<axum::response::Response> {
    let attachment = state
        .db
        .get_attachment_by_s3_key(&s3_key)
        .await?
        .ok_or_else(|| AppError::NotFound("Attachment not found".into()))?;

    let is_member = state
        .db
        .is_conversation_member(&attachment.conversation_id, &auth.user_id)
        .await?;

    if !is_member {
        return Err(AppError::NotConversationMember);
    }

    state
        .db
        .increment_attachment_download(attachment.id)
        .await?;

    let file_data = state.s3.download_file(&s3_key).await?;

    let mut hasher = Sha256::new();
    hasher.update(&s3_key);
    let etag = format!("\"{}\"", hex::encode(&hasher.finalize()[..16]));

    Ok(axum::response::Response::builder()
        .header(header::CONTENT_TYPE, "application/octet-stream")
        .header(header::CONTENT_LENGTH, file_data.len())
        .header(
            header::CACHE_CONTROL,
            "private, max-age=31536000, immutable",
        )
        .header(header::ETAG, etag)
        .body(axum::body::Body::from(file_data))
        .unwrap())
}
