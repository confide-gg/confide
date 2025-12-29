use base64::{engine::general_purpose, Engine as _};
use crossbeam_channel::{Receiver, Sender};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::call::h264::H264Decoder;
use crate::call::screen::EncodedFrame;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecodedFrame {
    pub width: u32,
    pub height: u32,
    pub timestamp: u64,
    pub rgba_data: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct H264Chunk {
    pub width: u32,
    pub height: u32,
    pub timestamp: u64,
    pub frame_id: u32,
    pub is_keyframe: bool,
    pub data_b64: String,
    pub queued_at_ms: u64,
    pub age_ms: u64,
    pub drained: u32,
    pub reasm_ms: u64,
}

pub struct VideoDecoderHandle {
    stop_tx: Sender<()>,
}

impl VideoDecoderHandle {
    pub fn stop(&self) {
        let _ = self.stop_tx.send(());
    }
}

pub fn start_video_decoder(
    encrypted_rx: Receiver<Vec<u8>>,
    decoded_tx: Sender<DecodedFrame>,
    h264_tx: Sender<H264Chunk>,
) -> Result<VideoDecoderHandle, String> {
    let (stop_tx, stop_rx) = crossbeam_channel::bounded::<()>(1);

    std::thread::spawn(move || {
        run_video_decoder(encrypted_rx, decoded_tx, h264_tx, stop_rx);
    });

    Ok(VideoDecoderHandle { stop_tx })
}

fn run_video_decoder(
    encrypted_rx: Receiver<Vec<u8>>,
    decoded_tx: Sender<DecodedFrame>,
    h264_tx: Sender<H264Chunk>,
    stop_rx: Receiver<()>,
) {
    let mut decoder = match H264Decoder::new() {
        Ok(d) => d,
        Err(_) => return,
    };

    let mut waiting_for_keyframe = true;

    loop {
        crossbeam_channel::select! {
            recv(stop_rx) -> _ => {
                break;
            }
            recv(encrypted_rx) -> result => {
                match result {
                    Ok(data) => {
                        let frame = match EncodedFrame::from_bytes(&data) {
                            Ok(f) => f,
                            Err(_) => continue,
                        };

                        if waiting_for_keyframe && !frame.is_keyframe {
                            continue;
                        }

                        if frame.is_keyframe {
                            waiting_for_keyframe = false;
                        }

                        let queued_at_ms = SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis() as u64;

                        let _ = h264_tx.try_send(H264Chunk {
                            width: frame.width as u32,
                            height: frame.height as u32,
                            timestamp: frame.timestamp,
                            frame_id: frame.frame_id,
                            is_keyframe: frame.is_keyframe,
                            data_b64: general_purpose::STANDARD.encode(&frame.data),
                            queued_at_ms,
                            age_ms: 0,
                            drained: 0,
                            reasm_ms: 0,
                        });

                        match decoder.decode(&frame.data) {
                            Ok(decoded_frames) => {
                                for decoded in decoded_frames {
                                    let decoded_frame = DecodedFrame {
                                        width: decoded.width,
                                        height: decoded.height,
                                        timestamp: frame.timestamp,
                                        rgba_data: decoded.rgba_data,
                                    };

                                    let _ = decoded_tx.try_send(decoded_frame);
                                }
                            }
                            Err(_) => {
                                if frame.is_keyframe {
                                    waiting_for_keyframe = true;
                                }
                            }
                        }
                    }
                    Err(_) => {
                        break;
                    }
                }
            }
        }
    }
}
