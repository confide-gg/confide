use crossbeam_channel::{Receiver, Sender};
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};

use crate::call::h264::{rgba_to_i420, H264Encoder};

pub const TARGET_FPS: u32 = 30;
pub const TARGET_BITRATE: u32 = 6_000_000;
pub const MAX_FRAME_SIZE: usize = 1100;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenCaptureSource {
    pub id: String,
    pub name: String,
    pub source_type: ScreenSourceType,
    pub width: u32,
    pub height: u32,
    pub thumbnail: Option<Vec<u8>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ScreenSourceType {
    Screen,
    Window,
}

#[derive(Debug)]
pub enum ScreenShareCommand {
    Stop,
    #[allow(dead_code)]
    RequestKeyframe,
    #[allow(dead_code)]
    SetQuality {
        fps: u32,
        bitrate: u32,
    },
}

#[derive(Clone)]
pub struct ScreenSharePipelineHandle {
    command_tx: Sender<ScreenShareCommand>,
    #[allow(dead_code)]
    source_id: String,
}

impl ScreenSharePipelineHandle {
    pub fn stop(&self) {
        let _ = self.command_tx.send(ScreenShareCommand::Stop);
    }

    #[allow(dead_code)]
    pub fn request_keyframe(&self) {
        let _ = self.command_tx.send(ScreenShareCommand::RequestKeyframe);
    }

    #[allow(dead_code)]
    pub fn set_quality(&self, fps: u32, bitrate: u32) {
        let _ = self
            .command_tx
            .send(ScreenShareCommand::SetQuality { fps, bitrate });
    }

    #[allow(dead_code)]
    pub fn source_id(&self) -> &str {
        &self.source_id
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoFrame {
    pub frame_id: u32,
    pub fragment_index: u16,
    pub fragment_count: u16,
    pub is_keyframe: bool,
    pub width: u16,
    pub height: u16,
    pub timestamp: u64,
    pub data: Vec<u8>,
}

impl VideoFrame {
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut buf = Vec::with_capacity(21 + self.data.len());
        buf.extend_from_slice(&self.frame_id.to_be_bytes());
        buf.extend_from_slice(&self.fragment_index.to_be_bytes());
        buf.extend_from_slice(&self.fragment_count.to_be_bytes());
        buf.push(if self.is_keyframe { 1 } else { 0 });
        buf.extend_from_slice(&self.width.to_be_bytes());
        buf.extend_from_slice(&self.height.to_be_bytes());
        buf.extend_from_slice(&self.timestamp.to_be_bytes());
        buf.extend_from_slice(&self.data);
        buf
    }

    pub fn from_bytes(data: &[u8]) -> Result<Self, String> {
        if data.len() < 21 {
            return Err("Frame too short".to_string());
        }

        let frame_id = u32::from_be_bytes([data[0], data[1], data[2], data[3]]);
        let fragment_index = u16::from_be_bytes([data[4], data[5]]);
        let fragment_count = u16::from_be_bytes([data[6], data[7]]);
        let is_keyframe = data[8] != 0;
        let width = u16::from_be_bytes([data[9], data[10]]);
        let height = u16::from_be_bytes([data[11], data[12]]);
        let timestamp = u64::from_be_bytes([
            data[13], data[14], data[15], data[16], data[17], data[18], data[19], data[20],
        ]);
        let frame_data = data[21..].to_vec();

        Ok(Self {
            frame_id,
            fragment_index,
            fragment_count,
            is_keyframe,
            width,
            height,
            timestamp,
            data: frame_data,
        })
    }
}

pub fn get_screen_sources() -> Result<Vec<ScreenCaptureSource>, String> {
    let mut sources = Vec::new();

    let monitors = xcap::Monitor::all().map_err(|e| format!("Failed to list monitors: {}", e))?;
    for (idx, monitor) in monitors.iter().enumerate() {
        let name = monitor
            .name()
            .unwrap_or_else(|_| format!("Display {}", idx + 1));
        let width = monitor.width().unwrap_or(0);
        let height = monitor.height().unwrap_or(0);
        let id = monitor.id().unwrap_or(idx as u32);

        let thumbnail = match monitor.capture_image() {
            Ok(img) => {
                let thumb = resize_image_for_thumbnail(&img, 320, 180);
                Some(thumb)
            }
            Err(_) => None,
        };

        sources.push(ScreenCaptureSource {
            id: format!("display:{}", id),
            name,
            source_type: ScreenSourceType::Screen,
            width,
            height,
            thumbnail,
        });
    }

    let windows = xcap::Window::all().map_err(|e| format!("Failed to list windows: {}", e))?;
    for window in windows.iter() {
        if window.is_minimized().unwrap_or(false) {
            continue;
        }

        let name = window.title().unwrap_or_else(|_| "Unknown".to_string());
        if name.is_empty() {
            continue;
        }

        if is_system_window(&name) {
            continue;
        }

        let width = window.width().unwrap_or(0);
        let height = window.height().unwrap_or(0);
        let Ok(id) = window.id() else { continue };

        if width < 100 || height < 100 {
            continue;
        }

        let thumbnail = match window.capture_image() {
            Ok(img) => {
                let thumb = resize_image_for_thumbnail(&img, 320, 180);
                Some(thumb)
            }
            Err(_) => None,
        };

        sources.push(ScreenCaptureSource {
            id: format!("window:{}", id),
            name,
            source_type: ScreenSourceType::Window,
            width,
            height,
            thumbnail,
        });
    }

    Ok(sources)
}

fn is_system_window(name: &str) -> bool {
    let system_names = [
        "Menubar",
        "System Status Item Clone",
        "Notification Center",
        "Control Center",
        "Spotlight",
        "Item-0",
        "Window Server",
        "StatusIndicator",
    ];

    for sys_name in &system_names {
        if name.contains(sys_name) {
            return true;
        }
    }
    false
}

fn resize_image_for_thumbnail(img: &image::RgbaImage, max_width: u32, max_height: u32) -> Vec<u8> {
    use image::ImageEncoder;

    let (w, h) = img.dimensions();
    let scale = f32::min(max_width as f32 / w as f32, max_height as f32 / h as f32);
    let new_w = (w as f32 * scale) as u32;
    let new_h = (h as f32 * scale) as u32;

    let resized = image::imageops::resize(img, new_w, new_h, image::imageops::FilterType::Triangle);

    let mut png_data = Vec::new();
    let encoder = image::codecs::png::PngEncoder::new(&mut png_data);
    let _ = encoder.write_image(
        resized.as_raw(),
        new_w,
        new_h,
        image::ExtendedColorType::Rgba8,
    );

    png_data
}

pub fn start_screen_share_pipeline(
    source_id: &str,
    frame_tx: Sender<Vec<u8>>,
) -> Result<ScreenSharePipelineHandle, String> {
    let (command_tx, command_rx) = crossbeam_channel::unbounded::<ScreenShareCommand>();

    let source_id_owned = source_id.to_string();
    let source_id_clone = source_id.to_string();

    std::thread::spawn(move || {
        run_screen_capture_pipeline(&source_id_owned, frame_tx, command_rx);
    });

    Ok(ScreenSharePipelineHandle {
        command_tx,
        source_id: source_id_clone,
    })
}

fn find_scap_target(source_id: &str) -> Option<scap::Target> {
    let parts: Vec<&str> = source_id.split(':').collect();
    if parts.len() != 2 {
        return None;
    }

    let source_type = parts[0];
    let id: u32 = parts[1].parse().ok()?;

    let targets = scap::get_all_targets();

    if source_type == "display" {
        let displays: Vec<_> = targets
            .into_iter()
            .filter(|t| matches!(t, scap::Target::Display(_)))
            .collect();

        let xcap_monitors = xcap::Monitor::all().ok()?;
        let xcap_index = xcap_monitors
            .iter()
            .position(|m| m.id().unwrap_or(0) == id)?;

        return displays.into_iter().nth(xcap_index);
    }

    let targets = scap::get_all_targets();
    if source_type == "window" {
        for target in targets {
            if let scap::Target::Window(w) = &target {
                if w.id == id {
                    return Some(target);
                }
            }
        }
    }

    None
}

fn run_screen_capture_pipeline(
    source_id: &str,
    frame_tx: Sender<Vec<u8>>,
    command_rx: Receiver<ScreenShareCommand>,
) {
    let target = match find_scap_target(source_id) {
        Some(t) => t,
        None => {
            eprintln!("[Screen] Target not found: {}", source_id);
            return;
        }
    };

    let output_resolution = scap::capturer::Resolution::_1080p;

    let options = scap::capturer::Options {
        fps: TARGET_FPS,
        target: Some(target),
        show_cursor: true,
        show_highlight: false,
        excluded_targets: None,
        output_type: scap::frame::FrameType::BGRAFrame,
        output_resolution,
        ..Default::default()
    };

    let mut capturer = match scap::capturer::Capturer::build(options) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("[Screen] Failed to build capturer: {:?}", e);
            return;
        }
    };
    capturer.start_capture();

    let mut encoder: Option<H264Encoder> = None;
    let mut last_width = 0u32;
    let mut last_height = 0u32;
    let mut frame_id = 0u32;
    let mut force_keyframe = true;
    let start_time = Instant::now();
    let mut target_bitrate = TARGET_BITRATE;

    let mut perf_convert_total = Duration::ZERO;
    let mut perf_encode_total = Duration::ZERO;
    let mut perf_frame_count = 0u32;
    let perf_report_interval = 100;

    loop {
        match command_rx.try_recv() {
            Ok(ScreenShareCommand::Stop) => {
                break;
            }
            Ok(ScreenShareCommand::RequestKeyframe) => {
                force_keyframe = true;
            }
            Ok(ScreenShareCommand::SetQuality { fps: _, bitrate }) => {
                target_bitrate = bitrate;
                if let Some(ref mut enc) = encoder {
                    enc.set_bitrate(target_bitrate);
                }
            }
            Err(crossbeam_channel::TryRecvError::Disconnected) => {
                break;
            }
            Err(crossbeam_channel::TryRecvError::Empty) => {}
        }

        let frame = match capturer.get_next_frame() {
            Ok(f) => f,
            Err(e) => {
                eprintln!("[Screen] Frame error: {:?}", e);
                std::thread::sleep(Duration::from_millis(10));
                continue;
            }
        };

        let (bgra_data, width, height) = match frame {
            scap::frame::Frame::BGRA(f) => (f.data, f.width as u32, f.height as u32),
            _ => {
                eprintln!("[Screen] Unexpected frame type");
                continue;
            }
        };

        if width == 0 || height == 0 {
            continue;
        }

        let rgba_data = bgra_to_rgba(&bgra_data);

        let aligned_width = (width + 1) & !1;
        let aligned_height = (height + 1) & !1;

        if width != last_width || height != last_height || encoder.is_none() {
            match H264Encoder::new(aligned_width, aligned_height, target_bitrate, TARGET_FPS) {
                Ok(enc) => {
                    eprintln!(
                        "[Screen] Created H.264 encoder {}x{} @ {}kbps, HW: {}",
                        aligned_width,
                        aligned_height,
                        target_bitrate / 1000,
                        enc.is_hardware_accelerated()
                    );
                    encoder = Some(enc);
                }
                Err(e) => {
                    eprintln!("[Screen] Failed to create H.264 encoder: {}", e);
                    encoder = None;
                }
            }
            last_width = width;
            last_height = height;
            force_keyframe = true;
        }

        let Some(ref mut enc) = encoder else {
            continue;
        };

        let t_convert_start = Instant::now();
        let i420_data = rgba_to_i420(&rgba_data, width as usize, height as usize);
        let t_convert = t_convert_start.elapsed();

        let timestamp = start_time.elapsed().as_millis() as u64;

        let do_keyframe = force_keyframe;
        if force_keyframe {
            force_keyframe = false;
        }

        let t_encode_start = Instant::now();
        match enc.encode(&i420_data, do_keyframe) {
            Ok(packets) => {
                let t_encode = t_encode_start.elapsed();

                perf_convert_total += t_convert;
                perf_encode_total += t_encode;
                perf_frame_count += 1;

                if perf_frame_count >= perf_report_interval {
                    let _avg_convert = perf_convert_total.as_micros() / perf_frame_count as u128;
                    let _avg_encode = perf_encode_total.as_micros() / perf_frame_count as u128;

                    perf_convert_total = Duration::ZERO;
                    perf_encode_total = Duration::ZERO;
                    perf_frame_count = 0;
                }

                let frame_key_requested = do_keyframe;
                for packet in packets {
                    let is_keyframe = packet.is_keyframe || frame_key_requested;
                    let fragments = fragment_frame(
                        frame_id,
                        is_keyframe,
                        aligned_width as u16,
                        aligned_height as u16,
                        timestamp,
                        &packet.data,
                    );

                    let mut dropped = false;
                    for fragment in fragments {
                        let bytes = fragment.to_bytes();
                        match frame_tx.try_send(bytes) {
                            Ok(_) => {}
                            Err(crossbeam_channel::TrySendError::Full(_)) => {
                                dropped = true;
                                if is_keyframe {
                                    force_keyframe = true;
                                }
                                break;
                            }
                            Err(crossbeam_channel::TrySendError::Disconnected(_)) => {
                                capturer.stop_capture();
                                return;
                            }
                        }
                    }

                    if dropped {
                        break;
                    }
                }
                frame_id = frame_id.wrapping_add(1);
            }
            Err(e) => {
                eprintln!("[Screen] Encode error: {}", e);
            }
        }
    }

    capturer.stop_capture();
}

fn bgra_to_rgba(bgra: &[u8]) -> Vec<u8> {
    let mut rgba = vec![0u8; bgra.len()];
    for i in (0..bgra.len()).step_by(4) {
        rgba[i] = bgra[i + 2];
        rgba[i + 1] = bgra[i + 1];
        rgba[i + 2] = bgra[i];
        rgba[i + 3] = bgra[i + 3];
    }
    rgba
}

fn fragment_frame(
    frame_id: u32,
    is_keyframe: bool,
    width: u16,
    height: u16,
    timestamp: u64,
    data: &[u8],
) -> Vec<VideoFrame> {
    let max_payload = MAX_FRAME_SIZE - 21;
    let fragment_count = data.len().div_ceil(max_payload) as u16;

    let mut fragments = Vec::with_capacity(fragment_count as usize);

    for (i, chunk) in data.chunks(max_payload).enumerate() {
        fragments.push(VideoFrame {
            frame_id,
            fragment_index: i as u16,
            fragment_count,
            is_keyframe,
            width,
            height,
            timestamp,
            data: chunk.to_vec(),
        });
    }

    fragments
}

pub struct FrameReassembler {
    pending_frames: std::collections::HashMap<u32, Vec<Option<Vec<u8>>>>,
    frame_metadata: std::collections::HashMap<u32, (bool, u16, u16, u64)>,
    frame_first_seen: std::collections::HashMap<u32, Instant>,
    last_complete_frame: u32,
}

pub type ReassembledFrame = (Vec<u8>, bool, u16, u16, u64, u32, u64);

impl FrameReassembler {
    pub fn new() -> Self {
        Self {
            pending_frames: std::collections::HashMap::new(),
            frame_metadata: std::collections::HashMap::new(),
            frame_first_seen: std::collections::HashMap::new(),
            last_complete_frame: 0,
        }
    }

    pub fn add_fragment(&mut self, frame: VideoFrame) -> Option<ReassembledFrame> {
        let now = Instant::now();
        self.evict_expired(now);

        if frame.frame_id < self.last_complete_frame
            && self.last_complete_frame - frame.frame_id < 1000
        {
            return None;
        }

        if frame.is_keyframe {
            self.evict_before(frame.frame_id);
        }

        let fragments = self
            .pending_frames
            .entry(frame.frame_id)
            .or_insert_with(|| vec![None; frame.fragment_count as usize]);

        self.frame_first_seen.entry(frame.frame_id).or_insert(now);

        if (frame.fragment_index as usize) < fragments.len() {
            fragments[frame.fragment_index as usize] = Some(frame.data.clone());
        }

        self.frame_metadata.entry(frame.frame_id).or_insert((
            frame.is_keyframe,
            frame.width,
            frame.height,
            frame.timestamp,
        ));

        if fragments.iter().all(|f| f.is_some()) {
            let complete_data: Vec<u8> = fragments
                .iter()
                .filter_map(|f| f.clone())
                .flatten()
                .collect();

            let metadata = self.frame_metadata.remove(&frame.frame_id)?;
            self.pending_frames.remove(&frame.frame_id);
            let first_seen = self.frame_first_seen.remove(&frame.frame_id);
            self.last_complete_frame = frame.frame_id;

            self.pending_frames
                .retain(|&id, _| id >= frame.frame_id.saturating_sub(5));
            self.frame_metadata
                .retain(|&id, _| id >= frame.frame_id.saturating_sub(5));
            self.frame_first_seen
                .retain(|&id, _| id >= frame.frame_id.saturating_sub(5));

            return Some((
                complete_data,
                metadata.0,
                metadata.1,
                metadata.2,
                metadata.3,
                frame.frame_id,
                first_seen
                    .map(|t| now.duration_since(t).as_millis() as u64)
                    .unwrap_or(0),
            ));
        }

        if self.pending_frames.len() > 16 {
            self.evict_oldest_until(12);
        }

        None
    }

    fn evict_expired(&mut self, now: Instant) {
        let timeout = Duration::from_millis(150);
        let mut expired = Vec::new();
        for (id, first_seen) in self.frame_first_seen.iter() {
            if now.duration_since(*first_seen) > timeout {
                expired.push(*id);
            }
        }

        for id in expired {
            self.pending_frames.remove(&id);
            self.frame_metadata.remove(&id);
            self.frame_first_seen.remove(&id);
        }
    }

    fn evict_before(&mut self, frame_id: u32) {
        let mut to_remove = Vec::new();
        for id in self.pending_frames.keys() {
            if *id < frame_id {
                to_remove.push(*id);
            }
        }
        for id in to_remove {
            self.pending_frames.remove(&id);
            self.frame_metadata.remove(&id);
            self.frame_first_seen.remove(&id);
        }
    }

    fn evict_oldest_until(&mut self, target_len: usize) {
        if self.pending_frames.len() <= target_len {
            return;
        }
        let mut ids: Vec<(u32, Instant)> = self
            .frame_first_seen
            .iter()
            .map(|(id, t)| (*id, *t))
            .collect();
        ids.sort_by_key(|(_, t)| *t);

        for (id, _) in ids {
            if self.pending_frames.len() <= target_len {
                break;
            }
            self.pending_frames.remove(&id);
            self.frame_metadata.remove(&id);
            self.frame_first_seen.remove(&id);
        }
    }
}

pub fn check_screen_recording_permission() -> bool {
    scap::has_permission()
}

pub fn request_screen_recording_permission() -> bool {
    scap::request_permission()
}
