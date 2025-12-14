use crossbeam_channel::{Receiver, Sender};
use serde::{Deserialize, Serialize};

use crate::call::h264::H264Decoder;
use crate::call::screen::{FrameReassembler, VideoFrame};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecodedFrame {
    pub width: u32,
    pub height: u32,
    pub timestamp: u64,
    pub rgba_data: Vec<u8>,
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
) -> Result<VideoDecoderHandle, String> {
    let (stop_tx, stop_rx) = crossbeam_channel::bounded::<()>(1);

    std::thread::spawn(move || {
        run_video_decoder(encrypted_rx, decoded_tx, stop_rx);
    });

    Ok(VideoDecoderHandle { stop_tx })
}

fn run_video_decoder(
    encrypted_rx: Receiver<Vec<u8>>,
    decoded_tx: Sender<DecodedFrame>,
    stop_rx: Receiver<()>,
) {
    let mut decoder = match H264Decoder::new() {
        Ok(d) => {
            eprintln!("[VideoDecoder] Created H.264 decoder");
            d
        }
        Err(e) => {
            eprintln!("[VideoDecoder] Failed to create H.264 decoder: {}", e);
            return;
        }
    };

    let mut reassembler = FrameReassembler::new();
    let mut waiting_for_keyframe = true;
    let mut frames_decoded = 0u64;
    let mut _frames_received = 0u64;

    loop {
        crossbeam_channel::select! {
            recv(stop_rx) -> _ => {
                eprintln!("[VideoDecoder] Stop signal received, decoded {} frames", frames_decoded);
                break;
            }
            recv(encrypted_rx) -> result => {
                match result {
                    Ok(data) => {
                        _frames_received += 1;

                        let frame = match VideoFrame::from_bytes(&data) {
                            Ok(f) => f,
                            Err(e) => {
                                eprintln!("[VideoDecoder] Failed to parse video frame: {}", e);
                                continue;
                            }
                        };

                        let reassembled = reassembler.add_fragment(frame);
                        if let Some((h264_data, is_keyframe, _width, _height, timestamp)) = reassembled {
                            if waiting_for_keyframe && !is_keyframe {
                                eprintln!("[VideoDecoder] Waiting for keyframe, skipping P-frame");
                                continue;
                            }

                            if is_keyframe {
                                waiting_for_keyframe = false;
                                eprintln!("[VideoDecoder] Got keyframe, size={} bytes", h264_data.len());
                            }

                            match decoder.decode(&h264_data) {
                                Ok(decoded_frames) => {
                                    for frame in decoded_frames {
                                        frames_decoded += 1;
                                        let decoded_frame = DecodedFrame {
                                            width: frame.width,
                                            height: frame.height,
                                            timestamp,
                                            rgba_data: frame.rgba_data,
                                        };

                                        if decoded_tx.send(decoded_frame).is_err() {
                                            eprintln!("[VideoDecoder] Output channel closed");
                                            return;
                                        }
                                    }
                                }
                                Err(e) => {
                                    eprintln!("[VideoDecoder] Decode error: {}", e);
                                    if is_keyframe {
                                        waiting_for_keyframe = true;
                                    }
                                }
                            }
                        }
                    }
                    Err(_) => {
                        eprintln!("[VideoDecoder] Input channel closed");
                        break;
                    }
                }
            }
        }
    }
}
