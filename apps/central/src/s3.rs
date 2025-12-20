use aws_config::BehaviorVersion;
use aws_credential_types::Credentials;
use aws_sdk_s3::presigning::PresigningConfig;
use aws_sdk_s3::Client;
use std::sync::Arc;
use std::time::Duration;

use crate::config::S3Config;
use crate::error::{AppError, Result};

pub struct S3Service {
    client: Client,
    config: Arc<S3Config>,
}

impl S3Service {
    pub async fn new(config: Arc<S3Config>) -> Result<Self> {
        tracing::info!(
            "Initializing S3 service with endpoint: {}, region: {}, bucket: {}",
            config.endpoint,
            config.region,
            config.bucket
        );

        let credentials = Credentials::new(
            &config.access_key_id,
            &config.secret_access_key,
            None,
            None,
            "static",
        );

        let sdk_config = aws_config::defaults(BehaviorVersion::latest())
            .region(aws_config::Region::new(config.region.clone()))
            .credentials_provider(credentials)
            .load()
            .await;

        let s3_config = aws_sdk_s3::config::Builder::from(&sdk_config)
            .endpoint_url(&config.endpoint)
            .force_path_style(false)
            .build();
        let client = Client::from_conf(s3_config);

        tracing::info!("S3 service initialized successfully");

        Ok(Self { client, config })
    }

    pub async fn upload_file(
        &self,
        conversation_id: &str,
        _filename: &str,
        data: Vec<u8>,
    ) -> Result<String> {
        let key = format!("attachments/{}/{}", conversation_id, uuid::Uuid::new_v4());

        tracing::debug!(
            "Uploading file to bucket: {}, key: {}, size: {} bytes",
            self.config.bucket,
            key,
            data.len()
        );

        self.client
            .put_object()
            .bucket(&self.config.bucket)
            .key(&key)
            .body(data.into())
            .content_type("application/octet-stream")
            .send()
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to upload file to bucket '{}', key '{}': {}",
                    self.config.bucket,
                    key,
                    e
                );
                AppError::Internal(anyhow::anyhow!("Failed to upload file: {}", e))
            })?;

        tracing::info!("File uploaded successfully: {}", key);
        Ok(key)
    }

    pub async fn generate_upload_url(
        &self,
        conversation_id: &str,
        _filename: &str,
    ) -> Result<(String, String)> {
        let key = format!("attachments/{}/{}", conversation_id, uuid::Uuid::new_v4());

        tracing::debug!(
            "Generating upload URL for bucket: {}, key: {}",
            self.config.bucket,
            key
        );

        let presigning_config = PresigningConfig::expires_in(Duration::from_secs(
            self.config.presigned_url_expiry_seconds,
        ))
        .map_err(|e| {
            tracing::error!("Presigning config error: {}", e);
            AppError::Internal(anyhow::anyhow!("Presigning config error: {}", e))
        })?;

        let presigned_request = self
            .client
            .put_object()
            .bucket(&self.config.bucket)
            .key(&key)
            .content_type("application/octet-stream")
            .presigned(presigning_config)
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to generate presigned URL for bucket '{}', key '{}': {}",
                    self.config.bucket,
                    key,
                    e
                );
                AppError::Internal(anyhow::anyhow!("Failed to generate presigned URL: {}", e))
            })?;

        let url = presigned_request.uri().to_string();
        tracing::debug!("Generated presigned URL: {}", url);

        Ok((url, key))
    }

    pub async fn download_file(&self, key: &str) -> Result<Vec<u8>> {
        tracing::debug!(
            "Downloading file from bucket: {}, key: {}",
            self.config.bucket,
            key
        );

        let response = self
            .client
            .get_object()
            .bucket(&self.config.bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to download file from bucket '{}', key '{}': {}",
                    self.config.bucket,
                    key,
                    e
                );
                AppError::Internal(anyhow::anyhow!("Failed to download file: {}", e))
            })?;

        let data = response
            .body
            .collect()
            .await
            .map_err(|e| {
                tracing::error!("Failed to read file body: {}", e);
                AppError::Internal(anyhow::anyhow!("Failed to read file: {}", e))
            })?
            .into_bytes()
            .to_vec();

        tracing::info!("File downloaded successfully: {} bytes", data.len());
        Ok(data)
    }

    pub async fn generate_download_url(&self, key: &str) -> Result<String> {
        let presigning_config = PresigningConfig::expires_in(Duration::from_secs(
            self.config.presigned_url_expiry_seconds,
        ))
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Presigning config error: {}", e)))?;

        let presigned_request = self
            .client
            .get_object()
            .bucket(&self.config.bucket)
            .key(key)
            .presigned(presigning_config)
            .await
            .map_err(|e| {
                AppError::Internal(anyhow::anyhow!("Failed to generate download URL: {}", e))
            })?;

        Ok(presigned_request.uri().to_string())
    }

    pub async fn delete_file(&self, key: &str) -> Result<()> {
        self.client
            .delete_object()
            .bucket(&self.config.bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to delete file: {}", e)))?;

        Ok(())
    }
}
