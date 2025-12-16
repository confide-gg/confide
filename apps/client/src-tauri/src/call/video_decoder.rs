use crossbeam_channel::{Receiver, Sender};
use serde::{Deserialize, Serialize};
use base64::{engine::general_purpose, Engine as _};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::call::h264::H264Decoder;
use crate::call::screen::{FrameReassembler, VideoFrame};

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

    let mut reassembler = FrameReassembler::new();
    let mut waiting_for_keyframe = true;
    let mut _frames_received = 0u64;

    loop {
        crossbeam_channel::select! {
            recv(stop_rx) -> _ => {
                break;
            }
            recv(encrypted_rx) -> result => {
                match result {
                    Ok(data) => {
                        _frames_received += 1;

                        let frame = match VideoFrame::from_bytes(&data) {
                            Ok(f) => f,
                            Err(_) => continue,
                        };

                        let reassembled = reassembler.add_fragment(frame);
                        if let Some((h264_data, is_keyframe, width, height, timestamp, frame_id, reasm_ms)) = reassembled {
                            if waiting_for_keyframe && !is_keyframe {
                                continue;
                            }

                            if is_keyframe {
                                waiting_for_keyframe = false;
                            }

                            let queued_at_ms = SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_millis() as u64;

                            let _ = h264_tx.try_send(H264Chunk {
                                width: width as u32,
                                height: height as u32,
                                timestamp,
                                frame_id,
                                is_keyframe,
                                data_b64: general_purpose::STANDARD.encode(&h264_data),
                                queued_at_ms,
                                age_ms: 0,
                                drained: 0,
                                reasm_ms,
                            });

                            match decoder.decode(&h264_data) {
                                Ok(decoded_frames) => {
                                    for frame in decoded_frames {
                                        let decoded_frame = DecodedFrame {
                                            width: frame.width,
                                            height: frame.height,
                                            timestamp,
                                            rgba_data: frame.rgba_data,
                                        };

                                        let _ = decoded_tx.try_send(decoded_frame);
                                    }
                                }
                                Err(_) => {
                                    if is_keyframe {
                                        waiting_for_keyframe = true;
                                    }
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
