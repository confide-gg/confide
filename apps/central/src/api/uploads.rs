use axum::{
    body::Body,
    extract::{Multipart, Path, State},
    http::{header, StatusCode},
    response::Response,
    routing::{delete, get, post},
    Json, Router,
};
use chrono::Utc;
use redis::AsyncCommands;
use std::sync::Arc;
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::models::UploadResponse;
use crate::AppState;

use super::middleware::AuthUser;

const MAX_FILE_SIZE: usize = 5 * 1024 * 1024;
const ALLOWED_TYPES: &[&str] = &["image/jpeg", "image/png", "image/gif", "image/webp"];

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", post(upload_file))
        .route("/file/{upload_id}", get(get_file))
        .route("/type/{file_type}", delete(delete_file))
}

pub async fn upload_file(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    mut multipart: Multipart,
) -> Result<Json<UploadResponse>> {
    let _permit = state
        .upload_semaphore
        .acquire()
        .await
        .map_err(|_| AppError::TooManyRequests)?;

    let hour_key = format!("uploads:{}:{}", auth.user_id, Utc::now().format("%Y%m%d%H"));
    let mut conn = state
        .redis
        .get_multiplexed_async_connection()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis connection failed: {}", e)))?;

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

    let mut file_type: Option<String> = None;
    let mut content_type: Option<String> = None;
    let mut data: Option<Vec<u8>> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| AppError::BadRequest("Invalid multipart data".into()))?
    {
        let name = field.name().unwrap_or("").to_string();

        match name.as_str() {
            "type" => {
                let value = field
                    .text()
                    .await
                    .map_err(|_| AppError::BadRequest("Invalid type field".into()))?;
                if value != "avatar" && value != "banner" {
                    return Err(AppError::BadRequest(
                        "Type must be 'avatar' or 'banner'".into(),
                    ));
                }
                file_type = Some(value);
            }
            "file" => {
                let ct = field
                    .content_type()
                    .unwrap_or("application/octet-stream")
                    .to_string();
                if !ALLOWED_TYPES.contains(&ct.as_str()) {
                    return Err(AppError::BadRequest(format!(
                        "File type {} not allowed. Use JPEG, PNG, GIF, or WebP",
                        ct
                    )));
                }
                content_type = Some(ct);

                let bytes = field
                    .bytes()
                    .await
                    .map_err(|_| AppError::BadRequest("Failed to read file".into()))?;
                if bytes.len() > MAX_FILE_SIZE {
                    return Err(AppError::BadRequest(format!(
                        "File too large. Maximum size is {} MB",
                        MAX_FILE_SIZE / 1024 / 1024
                    )));
                }
                data = Some(bytes.to_vec());
            }
            _ => {}
        }
    }

    let file_type = file_type.ok_or_else(|| AppError::BadRequest("Missing 'type' field".into()))?;
    let content_type =
        content_type.ok_or_else(|| AppError::BadRequest("Missing 'file' field".into()))?;
    let data = data.ok_or_else(|| AppError::BadRequest("Missing 'file' field".into()))?;

    let upload = state
        .db
        .save_upload(auth.user_id, &file_type, &content_type, &data)
        .await?;

    let url = format!("/api/uploads/file/{}", upload.id);
    state
        .db
        .update_profile_image(auth.user_id, &file_type, &url)
        .await?;

    Ok(Json(UploadResponse { id: upload.id, url }))
}

pub async fn get_file(
    State(state): State<Arc<AppState>>,
    Path(upload_id): Path<Uuid>,
) -> Result<Response> {
    let upload = state
        .db
        .get_upload(upload_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Upload not found".into()))?;

    let response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, upload.content_type)
        .header(header::CACHE_CONTROL, "public, max-age=31536000, immutable")
        .body(Body::from(upload.data))
        .unwrap();

    Ok(response)
}

pub async fn delete_file(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(file_type): Path<String>,
) -> Result<StatusCode> {
    if file_type != "avatar" && file_type != "banner" {
        return Err(AppError::BadRequest(
            "Type must be 'avatar' or 'banner'".into(),
        ));
    }

    state.db.delete_upload(auth.user_id, &file_type).await?;
    state
        .db
        .clear_profile_image(auth.user_id, &file_type)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}
