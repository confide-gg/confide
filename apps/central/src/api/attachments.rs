use axum::{
    body::Bytes,
    extract::{Path, State},
    http::{header, HeaderMap},
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::AppState;

use super::middleware::AuthUser;

fn sanitize_upload_id(upload_id: &str) -> Result<String> {
    if upload_id.contains("..") || upload_id.contains('/') || upload_id.contains('\\') {
        return Err(AppError::BadRequest("Invalid upload ID".into()));
    }
    if upload_id.len() > 64 {
        return Err(AppError::BadRequest("Upload ID too long".into()));
    }
    if !upload_id
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
    {
        return Err(AppError::BadRequest("Invalid upload ID characters".into()));
    }
    Ok(upload_id.to_string())
}

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
        .route("/upload-chunk", post(upload_chunk))
        .route("/finalize-upload", post(finalize_upload))
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

    let s3_key = state
        .s3
        .upload_file(&conversation_id.to_string(), filename, body.to_vec())
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

pub async fn upload_chunk(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<serde_json::Value>> {
    let upload_id = headers
        .get("x-upload-id")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AppError::BadRequest("Missing x-upload-id header".into()))?;
    let upload_id = sanitize_upload_id(upload_id)?;

    let chunk_index: usize = headers
        .get("x-chunk-index")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse().ok())
        .ok_or_else(|| AppError::BadRequest("Missing or invalid x-chunk-index header".into()))?;

    let _total_chunks: usize = headers
        .get("x-total-chunks")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse().ok())
        .ok_or_else(|| AppError::BadRequest("Missing or invalid x-total-chunks header".into()))?;

    let conversation_id = headers
        .get("x-conversation-id")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AppError::BadRequest("Missing x-conversation-id header".into()))?;

    let conversation_id = Uuid::parse_str(conversation_id)
        .map_err(|_| AppError::BadRequest("Invalid conversation ID".into()))?;

    let is_member = state
        .db
        .is_conversation_member(&conversation_id, &auth.user_id)
        .await?;

    if !is_member {
        return Err(AppError::NotConversationMember);
    }

    let upload_dir = std::path::PathBuf::from(format!("/tmp/uploads/{}", upload_id));
    fs::create_dir_all(&upload_dir).await.map_err(|e| {
        AppError::Internal(anyhow::anyhow!("Failed to create upload directory: {}", e))
    })?;

    let chunk_path = upload_dir.join(format!("chunk_{}", chunk_index));
    let mut file = fs::File::create(&chunk_path)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to create chunk file: {}", e)))?;

    file.write_all(&body)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to write chunk: {}", e)))?;

    let redis_key = format!("upload_chunks:{}:{}", upload_id, auth.user_id);
    let mut conn = state
        .redis
        .get_multiplexed_async_connection()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis error: {}", e)))?;

    let _chunks_received: usize = conn
        .sadd(&redis_key, chunk_index)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis SADD failed: {}", e)))?;

    let _: () = conn
        .expire(&redis_key, 3600)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis EXPIRE failed: {}", e)))?;

    Ok(Json(serde_json::json!({
        "chunk_index": chunk_index,
        "received": true
    })))
}

#[derive(Deserialize)]
pub struct FinalizeUploadRequest {
    pub upload_id: String,
    pub conversation_id: String,
    pub filename: String,
    pub mime_type: String,
    #[allow(dead_code)]
    pub total_size: usize,
}

pub async fn finalize_upload(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(req): Json<FinalizeUploadRequest>,
) -> Result<Json<UploadResponse>> {
    let upload_id = sanitize_upload_id(&req.upload_id)?;
    let filename = sanitize_filename(&req.filename);

    let conversation_id = Uuid::parse_str(&req.conversation_id)
        .map_err(|_| AppError::BadRequest("Invalid conversation ID".into()))?;

    let is_member = state
        .db
        .is_conversation_member(&conversation_id, &auth.user_id)
        .await?;

    if !is_member {
        return Err(AppError::NotConversationMember);
    }

    if !ALLOWED_TYPES.contains(&req.mime_type.as_str()) {
        return Err(AppError::BadRequest(format!(
            "MIME type {} not allowed",
            req.mime_type
        )));
    }

    let upload_dir = std::path::PathBuf::from(format!("/tmp/uploads/{}", upload_id));

    if !upload_dir.exists() {
        return Err(AppError::BadRequest("Upload not found".into()));
    }

    let mut entries = fs::read_dir(&upload_dir).await.map_err(|e| {
        AppError::Internal(anyhow::anyhow!("Failed to read upload directory: {}", e))
    })?;

    let mut chunks = Vec::new();
    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to read directory entry: {}", e)))?
    {
        let path = entry.path();
        if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
            if filename.starts_with("chunk_") {
                if let Some(index_str) = filename.strip_prefix("chunk_") {
                    if let Ok(index) = index_str.parse::<usize>() {
                        chunks.push((index, path));
                    }
                }
            }
        }
    }

    chunks.sort_by_key(|(index, _)| *index);

    let mut complete_file = Vec::new();
    for (_, chunk_path) in chunks {
        let chunk_data = fs::read(&chunk_path)
            .await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to read chunk: {}", e)))?;
        complete_file.extend_from_slice(&chunk_data);
    }

    if complete_file.len() > state.config.s3.max_file_size_bytes {
        fs::remove_dir_all(&upload_dir).await.ok();
        return Err(AppError::BadRequest(format!(
            "File size {} exceeds maximum {}",
            complete_file.len(),
            state.config.s3.max_file_size_bytes
        )));
    }

    let s3_key = state
        .s3
        .upload_file(&conversation_id.to_string(), &filename, complete_file)
        .await?;

    fs::remove_dir_all(&upload_dir).await.ok();

    let mut conn = state
        .redis
        .get_multiplexed_async_connection()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis error: {}", e)))?;

    let redis_key = format!("upload_chunks:{}:{}", upload_id, auth.user_id);
    let _: () = conn
        .del(&redis_key)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis DEL failed: {}", e)))?;

    Ok(Json(UploadResponse { s3_key }))
}
