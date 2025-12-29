use bytes::Bytes;
use dashmap::DashMap;
use quinn::{
    congestion, Connection, Endpoint, RecvStream, SendStream, ServerConfig, TransportConfig, VarInt,
};
use rustls::pki_types::{CertificateDer, PrivateKeyDer, PrivatePkcs8KeyDer};
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;

const STREAM_TYPE_AUDIO: u8 = 0x01;
const STREAM_TYPE_VIDEO: u8 = 0x02;
const STREAM_TYPE_SCREENSHARE: u8 = 0x03;

const AUDIO_BUFFER_SIZE: usize = 64;
const VIDEO_BUFFER_SIZE: usize = 32;
const SCREENSHARE_BUFFER_SIZE: usize = 64;
const DATAGRAM_BUFFER_SIZE: usize = 128;

#[derive(Clone)]
#[allow(dead_code)]
pub struct MediaRelayConfig {
    pub bind_addr: SocketAddr,
    pub max_concurrent_calls: usize,
    pub token_secret: String,
    pub cert_path: Option<String>,
    pub key_path: Option<String>,
}

struct CallSession {
    participants: DashMap<Vec<u8>, ParticipantChannels>,
}

struct ParticipantChannels {
    audio_tx: mpsc::Sender<Bytes>,
    video_tx: mpsc::Sender<Bytes>,
    screenshare_tx: mpsc::Sender<Bytes>,
    datagram_tx: mpsc::Sender<Bytes>,
}

pub struct MediaRelay {
    config: MediaRelayConfig,
    endpoint: Endpoint,
    sessions: Arc<DashMap<[u8; 16], Arc<CallSession>>>,
}

impl MediaRelay {
    pub async fn new(config: MediaRelayConfig) -> anyhow::Result<Self> {
        let server_config = Self::create_server_config(&config)?;
        let endpoint = Endpoint::server(server_config, config.bind_addr)?;

        Ok(Self {
            config,
            endpoint,
            sessions: Arc::new(DashMap::new()),
        })
    }

    fn create_server_config(config: &MediaRelayConfig) -> anyhow::Result<ServerConfig> {
        let (cert_chain, key) =
            if let (Some(cert_path), Some(key_path)) = (&config.cert_path, &config.key_path) {
                let cert_pem = std::fs::read(cert_path)?;
                let key_pem = std::fs::read(key_path)?;

                let certs: Vec<CertificateDer<'static>> = rustls_pemfile::certs(&mut &cert_pem[..])
                    .filter_map(|r| r.ok())
                    .collect();

                let key = rustls_pemfile::private_key(&mut &key_pem[..])?
                    .ok_or_else(|| anyhow::anyhow!("No private key found"))?;

                (certs, key)
            } else {
                let cert = rcgen::generate_simple_self_signed(vec!["localhost".to_string()])?;
                let cert_der = CertificateDer::from(cert.cert);
                let key_der =
                    PrivateKeyDer::Pkcs8(PrivatePkcs8KeyDer::from(cert.key_pair.serialize_der()));
                (vec![cert_der], key_der)
            };

        let mut crypto = rustls::ServerConfig::builder()
            .with_no_client_auth()
            .with_single_cert(cert_chain, key)?;

        crypto.alpn_protocols = vec![b"confide-relay-v2".to_vec()];
        crypto.max_early_data_size = 0;

        let mut transport = TransportConfig::default();

        transport.max_idle_timeout(Some(VarInt::from_u32(60_000).into()));
        transport.keep_alive_interval(Some(Duration::from_secs(3)));

        transport.initial_rtt(Duration::from_millis(20));
        transport.max_concurrent_bidi_streams(VarInt::from_u32(6));
        transport.max_concurrent_uni_streams(VarInt::from_u32(6));

        transport.send_window(512 * 1024);
        transport.receive_window(VarInt::from_u32(512 * 1024));
        transport.stream_receive_window(VarInt::from_u32(256 * 1024));

        transport.datagram_receive_buffer_size(Some(2048 * 1024));
        transport.datagram_send_buffer_size(2048 * 1024);

        let bbr = congestion::BbrConfig::default();
        transport.congestion_controller_factory(Arc::new(bbr));

        let mut server_config = ServerConfig::with_crypto(Arc::new(
            quinn::crypto::rustls::QuicServerConfig::try_from(crypto)?,
        ));
        server_config.transport_config(Arc::new(transport));

        Ok(server_config)
    }

    pub async fn run(&self) -> anyhow::Result<()> {
        tracing::info!("Media relay listening on {}", self.config.bind_addr);

        while let Some(incoming) = self.endpoint.accept().await {
            let sessions = self.sessions.clone();
            let token_secret = self.config.token_secret.clone();

            tokio::spawn(async move {
                if let Err(e) = Self::handle_connection(incoming, sessions, token_secret).await {
                    tracing::warn!("Connection error: {:?}", e);
                }
            });
        }

        Ok(())
    }

    async fn handle_connection(
        incoming: quinn::Incoming,
        sessions: Arc<DashMap<[u8; 16], Arc<CallSession>>>,
        token_secret: String,
    ) -> anyhow::Result<()> {
        let connection = incoming.await?;
        let remote = connection.remote_address();
        tracing::debug!("New connection from {}", remote);

        let (mut control_send, mut control_recv) = connection.accept_bi().await?;

        let mut token_len_buf = [0u8; 2];
        control_recv.read_exact(&mut token_len_buf).await?;
        let token_len = u16::from_be_bytes(token_len_buf) as usize;

        if token_len > 1024 {
            control_send.write_all(b"ER").await?;
            return Err(anyhow::anyhow!("Token too large"));
        }

        let mut token = vec![0u8; token_len];
        control_recv.read_exact(&mut token).await?;

        let (call_id, participant_id) = match verify_relay_token(&token_secret, &token) {
            Some(ids) => ids,
            None => {
                control_send.write_all(b"ER").await?;
                return Err(anyhow::anyhow!("Invalid token"));
            }
        };

        control_send.write_all(b"OK").await?;
        tracing::info!(
            "Participant {:?} joined call {:?}",
            hex::encode(participant_id),
            hex::encode(call_id)
        );

        let session = sessions
            .entry(call_id)
            .or_insert_with(|| {
                Arc::new(CallSession {
                    participants: DashMap::new(),
                })
            })
            .clone();

        let (audio_tx, audio_rx) = mpsc::channel::<Bytes>(AUDIO_BUFFER_SIZE);
        let (video_tx, video_rx) = mpsc::channel::<Bytes>(VIDEO_BUFFER_SIZE);
        let (screenshare_tx, screenshare_rx) = mpsc::channel::<Bytes>(SCREENSHARE_BUFFER_SIZE);
        let (datagram_tx, datagram_rx) = mpsc::channel::<Bytes>(DATAGRAM_BUFFER_SIZE);

        session.participants.insert(
            participant_id.to_vec(),
            ParticipantChannels {
                audio_tx,
                video_tx,
                screenshare_tx,
                datagram_tx,
            },
        );

        let conn_recv = connection.clone();
        let conn_send = connection.clone();
        let conn_datagram_recv = connection.clone();
        let conn_datagram_send = connection.clone();
        let session_recv = session.clone();
        let session_datagram = session.clone();
        let participant_id_recv = participant_id;
        let participant_id_datagram = participant_id;

        let stream_receiver = tokio::spawn(async move {
            Self::handle_incoming_streams(conn_recv, session_recv, participant_id_recv).await
        });

        let datagram_receiver = tokio::spawn(async move {
            Self::handle_incoming_datagrams(
                conn_datagram_recv,
                session_datagram,
                participant_id_datagram,
            )
            .await
        });

        let stream_sender = tokio::spawn(async move {
            Self::handle_outgoing_streams(conn_send, audio_rx, video_rx, screenshare_rx).await
        });

        let datagram_sender = tokio::spawn(async move {
            Self::handle_outgoing_datagrams(conn_datagram_send, datagram_rx).await
        });

        tokio::select! {
            r = stream_receiver => { tracing::debug!("Stream receiver ended: {:?}", r); }
            r = datagram_receiver => { tracing::debug!("Datagram receiver ended: {:?}", r); }
            r = stream_sender => { tracing::debug!("Stream sender ended: {:?}", r); }
            r = datagram_sender => { tracing::debug!("Datagram sender ended: {:?}", r); }
            _ = connection.closed() => { tracing::debug!("Connection closed"); }
        }

        session.participants.remove(&participant_id.to_vec());

        if session.participants.is_empty() {
            sessions.remove(&call_id);
            tracing::info!("Call {:?} ended - no participants", hex::encode(call_id));
        }

        Ok(())
    }

    async fn handle_incoming_streams(
        connection: Connection,
        session: Arc<CallSession>,
        sender_id: [u8; 16],
    ) -> anyhow::Result<()> {
        loop {
            let (send, mut recv) = connection.accept_bi().await?;
            drop(send);

            let mut stream_type = [0u8; 1];
            recv.read_exact(&mut stream_type).await?;

            let session_clone = session.clone();
            let sender_id_clone = sender_id;

            tokio::spawn(async move {
                match stream_type[0] {
                    STREAM_TYPE_AUDIO => {
                        Self::relay_stream_data(recv, session_clone, sender_id_clone, true).await;
                    }
                    STREAM_TYPE_VIDEO => {
                        Self::relay_stream_data(recv, session_clone, sender_id_clone, false).await;
                    }
                    STREAM_TYPE_SCREENSHARE => {
                        Self::relay_screenshare_data(recv, session_clone, sender_id_clone).await;
                    }
                    _ => {
                        tracing::warn!("Unknown stream type: {}", stream_type[0]);
                    }
                }
            });
        }
    }

    async fn relay_stream_data(
        mut recv: RecvStream,
        session: Arc<CallSession>,
        sender_id: [u8; 16],
        is_audio: bool,
    ) {
        let mut len_buf = [0u8; 2];

        loop {
            if recv.read_exact(&mut len_buf).await.is_err() {
                break;
            }

            let len = u16::from_be_bytes(len_buf) as usize;
            if len == 0 || len > 65000 {
                break;
            }

            let mut data = vec![0u8; len];
            if recv.read_exact(&mut data).await.is_err() {
                break;
            }

            let bytes = Bytes::from(data);

            for entry in session.participants.iter() {
                if entry.key() != &sender_id.to_vec() {
                    let tx = if is_audio {
                        &entry.value().audio_tx
                    } else {
                        &entry.value().video_tx
                    };

                    let _ = tx.try_send(bytes.clone());
                }
            }
        }
    }

    async fn relay_screenshare_data(
        mut recv: RecvStream,
        session: Arc<CallSession>,
        sender_id: [u8; 16],
    ) {
        let mut len_buf = [0u8; 4];

        loop {
            if recv.read_exact(&mut len_buf).await.is_err() {
                break;
            }

            let len = u32::from_be_bytes(len_buf) as usize;
            if len == 0 || len > 10_000_000 {
                break;
            }

            let mut data = vec![0u8; len];
            if recv.read_exact(&mut data).await.is_err() {
                break;
            }

            let bytes = Bytes::from(data);

            for entry in session.participants.iter() {
                if entry.key() != &sender_id.to_vec() {
                    let _ = entry.value().screenshare_tx.try_send(bytes.clone());
                }
            }
        }
    }

    async fn handle_incoming_datagrams(
        connection: Connection,
        session: Arc<CallSession>,
        sender_id: [u8; 16],
    ) -> anyhow::Result<()> {
        loop {
            let datagram = connection.read_datagram().await?;

            if datagram.is_empty() {
                continue;
            }

            for entry in session.participants.iter() {
                if entry.key() != &sender_id.to_vec() {
                    let _ = entry.value().datagram_tx.try_send(datagram.clone());
                }
            }
        }
    }

    async fn handle_outgoing_streams(
        connection: Connection,
        mut audio_rx: mpsc::Receiver<Bytes>,
        mut video_rx: mpsc::Receiver<Bytes>,
        mut screenshare_rx: mpsc::Receiver<Bytes>,
    ) -> anyhow::Result<()> {
        let conn_audio = connection.clone();
        let conn_video = connection.clone();
        let conn_screenshare = connection.clone();

        let audio_task = tokio::spawn(async move {
            let mut stream: Option<SendStream> = None;

            while let Some(data) = audio_rx.recv().await {
                let send = match &mut stream {
                    Some(s) => s,
                    None => {
                        let (s, _) = conn_audio.open_bi().await?;
                        stream = Some(s);
                        stream.as_mut().unwrap()
                    }
                };

                let len = (data.len() as u16).to_be_bytes();
                if send.write_all(&len).await.is_err() {
                    stream = None;
                    continue;
                }
                if send.write_all(&data).await.is_err() {
                    stream = None;
                    continue;
                }
            }

            Ok::<_, anyhow::Error>(())
        });

        let video_task = tokio::spawn(async move {
            let mut stream: Option<SendStream> = None;

            while let Some(data) = video_rx.recv().await {
                let send = match &mut stream {
                    Some(s) => s,
                    None => {
                        let (s, _) = conn_video.open_bi().await?;
                        stream = Some(s);
                        stream.as_mut().unwrap()
                    }
                };

                let len = (data.len() as u16).to_be_bytes();
                if send.write_all(&len).await.is_err() {
                    stream = None;
                    continue;
                }
                if send.write_all(&data).await.is_err() {
                    stream = None;
                    continue;
                }
            }

            Ok::<_, anyhow::Error>(())
        });

        let screenshare_task = tokio::spawn(async move {
            let mut stream: Option<SendStream> = None;
            let mut wrote_type = false;

            while let Some(data) = screenshare_rx.recv().await {
                let send = match &mut stream {
                    Some(s) => s,
                    None => {
                        let (s, _) = conn_screenshare.open_bi().await?;
                        stream = Some(s);
                        wrote_type = false;
                        stream.as_mut().unwrap()
                    }
                };

                if !wrote_type {
                    if send.write_all(&[STREAM_TYPE_SCREENSHARE]).await.is_err() {
                        stream = None;
                        continue;
                    }
                    wrote_type = true;
                }

                let len = (data.len() as u32).to_be_bytes();
                if send.write_all(&len).await.is_err() {
                    stream = None;
                    continue;
                }
                if send.write_all(&data).await.is_err() {
                    stream = None;
                    continue;
                }
            }

            Ok::<_, anyhow::Error>(())
        });

        tokio::select! {
            r = audio_task => r??,
            r = video_task => r??,
            r = screenshare_task => r??,
        }

        Ok(())
    }

    async fn handle_outgoing_datagrams(
        connection: Connection,
        mut datagram_rx: mpsc::Receiver<Bytes>,
    ) -> anyhow::Result<()> {
        while let Some(data) = datagram_rx.recv().await {
            let _ = connection.send_datagram(data);
        }
        Ok(())
    }
}

fn verify_relay_token(secret: &str, token: &[u8]) -> Option<([u8; 16], [u8; 16])> {
    use hmac::{Hmac, Mac};
    use sha2::Sha256;

    if token.len() != 16 + 16 + 1 + 8 + 32 {
        return None;
    }

    let call_id_bytes = &token[0..16];
    let participant_id_bytes = &token[16..32];
    let _is_caller = token[32];
    let timestamp_bytes: [u8; 8] = token[33..41].try_into().ok()?;
    let expires_at = i64::from_le_bytes(timestamp_bytes);
    let signature = &token[41..];

    let now = chrono::Utc::now().timestamp();
    if now > expires_at {
        return None;
    }

    let secret_bytes = if secret.is_empty() {
        vec![0u8; 32]
    } else {
        secret.as_bytes().to_vec()
    };

    let mut mac = Hmac::<Sha256>::new_from_slice(&secret_bytes).ok()?;
    mac.update(call_id_bytes);
    mac.update(participant_id_bytes);
    mac.update(&[token[32]]);
    mac.update(&timestamp_bytes);

    if mac.verify_slice(signature).is_err() {
        return None;
    }

    let mut call_id = [0u8; 16];
    let mut participant_id = [0u8; 16];
    call_id.copy_from_slice(call_id_bytes);
    participant_id.copy_from_slice(participant_id_bytes);

    Some((call_id, participant_id))
}
