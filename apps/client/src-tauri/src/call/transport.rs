use bytes::Bytes;
use quinn::{
    congestion, ClientConfig, Connection, Endpoint, RecvStream, SendStream, TransportConfig, VarInt,
};
use rustls::pki_types::{CertificateDer, ServerName};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;

const STREAM_TYPE_AUDIO: u8 = 0x01;
const STREAM_TYPE_VIDEO: u8 = 0x02;
const STREAM_TYPE_SCREENSHARE: u8 = 0x03;
const DATAGRAM_TYPE_AUDIO: u8 = 0x01;

pub struct CallTransport {
    #[allow(dead_code)]
    endpoint: Endpoint,
    connection: Connection,
}

pub struct AudioSendStream {
    send: Mutex<SendStream>,
}

#[allow(dead_code)]
pub struct AudioRecvStream {
    recv: Mutex<RecvStream>,
}

#[allow(dead_code)]
pub struct VideoSendStream {
    send: Mutex<SendStream>,
}

#[allow(dead_code)]
pub struct VideoRecvStream {
    recv: Mutex<RecvStream>,
}

pub struct ScreenShareSendStream {
    send: Mutex<SendStream>,
}

pub struct DatagramChannel {
    connection: Connection,
}

impl CallTransport {
    pub async fn new(
        relay_endpoint: &str,
        relay_token: Vec<u8>,
    ) -> Result<(Self, MediaStreams), String> {
        let mut roots = rustls::RootCertStore::empty();
        roots.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());

        let mut crypto = rustls::ClientConfig::builder()
            .with_root_certificates(roots)
            .with_no_client_auth();

        crypto.alpn_protocols = vec![b"confide-relay-v2".to_vec()];

        crypto
            .dangerous()
            .set_certificate_verifier(Arc::new(InsecureCertVerifier));

        let mut transport = TransportConfig::default();

        transport.max_idle_timeout(Some(VarInt::from_u32(60_000).into()));
        transport.keep_alive_interval(Some(Duration::from_secs(3)));

        transport.initial_rtt(Duration::from_millis(20));
        transport.max_concurrent_bidi_streams(VarInt::from_u32(4));
        transport.max_concurrent_uni_streams(VarInt::from_u32(4));

        transport.send_window(256 * 1024);
        transport.receive_window(VarInt::from_u32(256 * 1024));
        transport.stream_receive_window(VarInt::from_u32(128 * 1024));

        transport.datagram_receive_buffer_size(Some(256 * 1024));
        transport.datagram_send_buffer_size(256 * 1024);

        let bbr = congestion::BbrConfig::default();
        transport.congestion_controller_factory(Arc::new(bbr));

        let mut client_config = ClientConfig::new(Arc::new(
            quinn::crypto::rustls::QuicClientConfig::try_from(crypto).map_err(|e| e.to_string())?,
        ));
        client_config.transport_config(Arc::new(transport));

        let addrs: Vec<_> = tokio::net::lookup_host(relay_endpoint)
            .await
            .map_err(|e| format!("Failed to resolve relay endpoint: {}", e))?
            .collect();

        let addr = addrs
            .iter()
            .find(|a| a.is_ipv4())
            .or(addrs.first())
            .copied()
            .ok_or("No addresses found for relay endpoint")?;

        let bind_addr = if addr.is_ipv4() {
            "0.0.0.0:0"
        } else {
            "[::]:0"
        };

        let mut endpoint =
            Endpoint::client(bind_addr.parse().unwrap()).map_err(|e| e.to_string())?;
        endpoint.set_default_client_config(client_config);

        let connection = endpoint
            .connect(addr, "localhost")
            .map_err(|e| e.to_string())?
            .await
            .map_err(|e| e.to_string())?;

        let (mut control_send, mut control_recv) = connection
            .open_bi()
            .await
            .map_err(|e| format!("Failed to open control stream: {}", e))?;

        let token_len = (relay_token.len() as u16).to_be_bytes();
        control_send
            .write_all(&token_len)
            .await
            .map_err(|e| e.to_string())?;
        control_send
            .write_all(&relay_token)
            .await
            .map_err(|e| e.to_string())?;

        let mut response = [0u8; 2];
        control_recv
            .read_exact(&mut response)
            .await
            .map_err(|e| e.to_string())?;

        if &response != b"OK" {
            return Err("Relay authentication failed".into());
        }

        let (audio_send, _) = connection
            .open_bi()
            .await
            .map_err(|e| format!("Failed to open audio stream: {}", e))?;

        let (video_send, _) = connection
            .open_bi()
            .await
            .map_err(|e| format!("Failed to open video stream: {}", e))?;

        let (screenshare_send, _) = connection
            .open_bi()
            .await
            .map_err(|e| format!("Failed to open screenshare stream: {}", e))?;

        let mut audio_send_wrapper = audio_send;
        audio_send_wrapper
            .write_all(&[STREAM_TYPE_AUDIO])
            .await
            .map_err(|e| format!("Failed to write audio stream type: {}", e))?;

        let mut video_send_wrapper = video_send;
        video_send_wrapper
            .write_all(&[STREAM_TYPE_VIDEO])
            .await
            .map_err(|e| format!("Failed to write video stream type: {}", e))?;

        let mut screenshare_send_wrapper = screenshare_send;
        screenshare_send_wrapper
            .write_all(&[STREAM_TYPE_SCREENSHARE])
            .await
            .map_err(|e| format!("Failed to write screenshare stream type: {}", e))?;

        let media_streams = MediaStreams {
            audio_send: AudioSendStream {
                send: Mutex::new(audio_send_wrapper),
            },
            video_send: VideoSendStream {
                send: Mutex::new(video_send_wrapper),
            },
            screenshare_send: ScreenShareSendStream {
                send: Mutex::new(screenshare_send_wrapper),
            },
            datagram: DatagramChannel {
                connection: connection.clone(),
            },
            connection: connection.clone(),
        };

        Ok((
            Self {
                endpoint,
                connection,
            },
            media_streams,
        ))
    }

    pub async fn close(&mut self) {
        self.connection.close(VarInt::from_u32(0), b"bye");
    }

    #[allow(dead_code)]
    pub fn connection(&self) -> &Connection {
        &self.connection
    }
}

pub struct MediaStreams {
    pub audio_send: AudioSendStream,
    pub video_send: VideoSendStream,
    pub screenshare_send: ScreenShareSendStream,
    pub datagram: DatagramChannel,
    pub connection: Connection,
}

impl MediaStreams {
    #[allow(dead_code)]
    pub async fn accept_incoming_stream(&self) -> Result<IncomingStream, String> {
        let (_, recv) = self
            .connection
            .accept_bi()
            .await
            .map_err(|e| format!("Failed to accept stream: {}", e))?;

        Ok(IncomingStream { recv })
    }
}

#[allow(dead_code)]
pub struct IncomingStream {
    recv: RecvStream,
}

impl IncomingStream {
    #[allow(dead_code)]
    pub async fn read_packet(&mut self) -> Result<Vec<u8>, String> {
        let mut len_buf = [0u8; 2];
        self.recv
            .read_exact(&mut len_buf)
            .await
            .map_err(|e| format!("Failed to read length: {}", e))?;

        let len = u16::from_be_bytes(len_buf) as usize;
        if len == 0 || len > 65000 {
            return Err("Invalid packet length".to_string());
        }

        let mut data = vec![0u8; len];
        self.recv
            .read_exact(&mut data)
            .await
            .map_err(|e| format!("Failed to read {} bytes: {}", len, e))?;

        Ok(data)
    }
}

impl AudioSendStream {
    pub async fn send(&self, data: &[u8]) -> Result<(), String> {
        let mut send = self.send.lock().await;
        let len = (data.len() as u16).to_be_bytes();
        send.write_all(&len)
            .await
            .map_err(|e| format!("Failed to write audio length: {}", e))?;
        send.write_all(data)
            .await
            .map_err(|e| format!("Failed to write audio data: {}", e))?;
        Ok(())
    }

    #[allow(dead_code)]
    pub async fn send_priority(&self, data: &[u8]) -> Result<(), String> {
        self.send(data).await
    }
}

#[allow(dead_code)]
impl VideoSendStream {
    pub async fn send(&self, data: &[u8]) -> Result<(), String> {
        let mut send = self.send.lock().await;
        let len = (data.len() as u16).to_be_bytes();
        send.write_all(&len)
            .await
            .map_err(|e| format!("Failed to write video length: {}", e))?;
        send.write_all(data)
            .await
            .map_err(|e| format!("Failed to write video data: {}", e))?;
        Ok(())
    }
}

impl ScreenShareSendStream {
    pub async fn send(&self, data: &[u8]) -> Result<(), String> {
        let mut send = self.send.lock().await;
        let len = (data.len() as u32).to_be_bytes();
        send.write_all(&len)
            .await
            .map_err(|e| format!("Failed to write screenshare length: {}", e))?;
        send.write_all(data)
            .await
            .map_err(|e| format!("Failed to write screenshare data: {}", e))?;
        Ok(())
    }
}

impl DatagramChannel {
    pub fn send(&self, data: &[u8]) -> Result<(), String> {
        self.connection
            .send_datagram(Bytes::copy_from_slice(data))
            .map_err(|e| format!("Failed to send datagram: {}", e))
    }

    #[allow(dead_code)]
    pub async fn recv(&self) -> Result<Bytes, String> {
        self.connection
            .read_datagram()
            .await
            .map_err(|e| format!("Failed to read datagram: {}", e))
    }

    pub fn send_audio_lossy(&self, data: &[u8]) -> Result<(), String> {
        let mut buf = Vec::with_capacity(1 + data.len());
        buf.push(DATAGRAM_TYPE_AUDIO);
        buf.extend_from_slice(data);
        self.send(&buf)
    }
}

#[derive(Debug)]
struct InsecureCertVerifier;

impl rustls::client::danger::ServerCertVerifier for InsecureCertVerifier {
    fn verify_server_cert(
        &self,
        _end_entity: &CertificateDer<'_>,
        _intermediates: &[CertificateDer<'_>],
        _server_name: &ServerName<'_>,
        _ocsp_response: &[u8],
        _now: rustls::pki_types::UnixTime,
    ) -> Result<rustls::client::danger::ServerCertVerified, rustls::Error> {
        Ok(rustls::client::danger::ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<rustls::SignatureScheme> {
        vec![
            rustls::SignatureScheme::RSA_PKCS1_SHA256,
            rustls::SignatureScheme::RSA_PKCS1_SHA384,
            rustls::SignatureScheme::RSA_PKCS1_SHA512,
            rustls::SignatureScheme::ECDSA_NISTP256_SHA256,
            rustls::SignatureScheme::ECDSA_NISTP384_SHA384,
            rustls::SignatureScheme::ECDSA_NISTP521_SHA512,
            rustls::SignatureScheme::RSA_PSS_SHA256,
            rustls::SignatureScheme::RSA_PSS_SHA384,
            rustls::SignatureScheme::RSA_PSS_SHA512,
            rustls::SignatureScheme::ED25519,
        ]
    }
}
