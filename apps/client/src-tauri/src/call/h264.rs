extern crate ffmpeg_next as ffmpeg;

use ffmpeg::codec::{decoder, encoder, Context};
use ffmpeg::format::Pixel;
use ffmpeg::frame::Video as VideoFrame;
use ffmpeg::software::scaling::{Context as ScalerContext, Flags as ScalerFlags};
use ffmpeg::{Packet, Rational};
use std::cell::RefCell;

pub struct H264Encoder {
    encoder: encoder::Video,
    #[allow(dead_code)]
    scaler: Option<ScalerContext>,
    width: u32,
    height: u32,
    pts: i64,
    using_hw: bool,
}

pub struct EncodedPacket {
    pub data: Vec<u8>,
    pub is_keyframe: bool,
}

impl H264Encoder {
    pub fn new(width: u32, height: u32, bitrate: u32, fps: u32) -> Result<Self, String> {
        ffmpeg::init().map_err(|e| format!("FFmpeg init failed: {}", e))?;

        let (encoder, using_hw) = Self::create_encoder(width, height, bitrate, fps)?;

        Ok(Self {
            encoder,
            scaler: None,
            width,
            height,
            pts: 0,
            using_hw,
        })
    }

    fn create_encoder(
        width: u32,
        height: u32,
        bitrate: u32,
        fps: u32,
    ) -> Result<(encoder::Video, bool), String> {
        let hw_encoders = if cfg!(target_os = "macos") {
            vec!["h264_videotoolbox"]
        } else if cfg!(target_os = "windows") {
            vec!["h264_nvenc", "h264_amf", "h264_qsv"]
        } else {
            vec!["h264_vaapi", "h264_nvenc", "h264_qsv"]
        };

        for hw_name in &hw_encoders {
            if let Ok(encoder) = Self::try_create_encoder(hw_name, width, height, bitrate, fps) {
                eprintln!("[H264] Using hardware encoder: {}", hw_name);
                return Ok((encoder, true));
            }
        }

        eprintln!("[H264] Falling back to software encoder (libx264)");
        let encoder = Self::try_create_encoder("libx264", width, height, bitrate, fps)
            .map_err(|e| format!("Failed to create any H.264 encoder: {}", e))?;

        Ok((encoder, false))
    }

    fn try_create_encoder(
        codec_name: &str,
        width: u32,
        height: u32,
        bitrate: u32,
        fps: u32,
    ) -> Result<encoder::Video, String> {
        let codec = encoder::find_by_name(codec_name)
            .ok_or_else(|| format!("Codec {} not found", codec_name))?;

        let mut context = Context::new_with_codec(codec)
            .encoder()
            .video()
            .map_err(|e| format!("Failed to create encoder context: {}", e))?;

        context.set_width(width);
        context.set_height(height);
        context.set_format(Pixel::YUV420P);
        context.set_time_base(Rational::new(1, fps as i32));
        context.set_frame_rate(Some(Rational::new(fps as i32, 1)));
        context.set_bit_rate(bitrate as usize);
        context.set_max_bit_rate(bitrate as usize * 2);
        context.set_gop(fps * 2);

        unsafe {
            let ctx = context.as_mut_ptr();

            (*ctx).thread_count = 0;

            if codec_name == "libx264" {
                let preset = std::ffi::CString::new("preset").unwrap();
                let ultrafast = std::ffi::CString::new("ultrafast").unwrap();
                ffmpeg::ffi::av_opt_set((*ctx).priv_data, preset.as_ptr(), ultrafast.as_ptr(), 0);

                let tune = std::ffi::CString::new("tune").unwrap();
                let zerolatency = std::ffi::CString::new("zerolatency").unwrap();
                ffmpeg::ffi::av_opt_set((*ctx).priv_data, tune.as_ptr(), zerolatency.as_ptr(), 0);
            }

            if codec_name == "h264_videotoolbox" {
                let realtime = std::ffi::CString::new("realtime").unwrap();
                let one = std::ffi::CString::new("1").unwrap();
                ffmpeg::ffi::av_opt_set((*ctx).priv_data, realtime.as_ptr(), one.as_ptr(), 0);

                let allow_sw = std::ffi::CString::new("allow_sw").unwrap();
                let zero = std::ffi::CString::new("0").unwrap();
                ffmpeg::ffi::av_opt_set((*ctx).priv_data, allow_sw.as_ptr(), zero.as_ptr(), 0);

                let prio_speed = std::ffi::CString::new("prio_speed").unwrap();
                ffmpeg::ffi::av_opt_set((*ctx).priv_data, prio_speed.as_ptr(), one.as_ptr(), 0);
            }

            if codec_name.contains("nvenc") {
                let preset = std::ffi::CString::new("preset").unwrap();
                let p1 = std::ffi::CString::new("p1").unwrap();
                ffmpeg::ffi::av_opt_set((*ctx).priv_data, preset.as_ptr(), p1.as_ptr(), 0);

                let tune = std::ffi::CString::new("tune").unwrap();
                let ull = std::ffi::CString::new("ull").unwrap();
                ffmpeg::ffi::av_opt_set((*ctx).priv_data, tune.as_ptr(), ull.as_ptr(), 0);

                let zerolatency = std::ffi::CString::new("zerolatency").unwrap();
                let one = std::ffi::CString::new("1").unwrap();
                ffmpeg::ffi::av_opt_set((*ctx).priv_data, zerolatency.as_ptr(), one.as_ptr(), 0);
            }
        }

        let encoder = context
            .open()
            .map_err(|e| format!("Failed to open encoder {}: {}", codec_name, e))?;

        Ok(encoder)
    }

    pub fn encode(
        &mut self,
        yuv_data: &[u8],
        force_keyframe: bool,
    ) -> Result<Vec<EncodedPacket>, String> {
        let y_size = (self.width * self.height) as usize;
        let uv_size = y_size / 4;
        let expected_size = y_size + uv_size * 2;

        if yuv_data.len() < expected_size {
            return Err(format!(
                "YUV data too small: {} < {}",
                yuv_data.len(),
                expected_size
            ));
        }

        let mut frame = VideoFrame::new(Pixel::YUV420P, self.width, self.height);
        frame.set_pts(Some(self.pts));

        if force_keyframe {
            frame.set_kind(ffmpeg::picture::Type::I);
        }

        let y_stride = frame.stride(0);
        let u_stride = frame.stride(1);
        let v_stride = frame.stride(2);

        {
            let y_plane = frame.data_mut(0);
            for row in 0..self.height as usize {
                let src_start = row * self.width as usize;
                let dst_start = row * y_stride;
                y_plane[dst_start..dst_start + self.width as usize]
                    .copy_from_slice(&yuv_data[src_start..src_start + self.width as usize]);
            }
        }

        {
            let u_plane = frame.data_mut(1);
            let uv_width = (self.width / 2) as usize;
            let uv_height = (self.height / 2) as usize;
            for row in 0..uv_height {
                let src_start = y_size + row * uv_width;
                let dst_start = row * u_stride;
                u_plane[dst_start..dst_start + uv_width]
                    .copy_from_slice(&yuv_data[src_start..src_start + uv_width]);
            }
        }

        {
            let v_plane = frame.data_mut(2);
            let uv_width = (self.width / 2) as usize;
            let uv_height = (self.height / 2) as usize;
            for row in 0..uv_height {
                let src_start = y_size + uv_size + row * uv_width;
                let dst_start = row * v_stride;
                v_plane[dst_start..dst_start + uv_width]
                    .copy_from_slice(&yuv_data[src_start..src_start + uv_width]);
            }
        }

        self.pts += 1;

        self.encoder
            .send_frame(&frame)
            .map_err(|e| format!("Send frame failed: {}", e))?;

        let mut packets = Vec::new();
        let mut packet = Packet::empty();

        while self.encoder.receive_packet(&mut packet).is_ok() {
            let is_keyframe = packet.is_key();
            let data = packet.data().map(|d| d.to_vec()).unwrap_or_default();

            if !data.is_empty() {
                packets.push(EncodedPacket { data, is_keyframe });
            }
        }

        Ok(packets)
    }

    #[allow(dead_code)]
    pub fn flush(&mut self) -> Result<Vec<EncodedPacket>, String> {
        self.encoder
            .send_eof()
            .map_err(|e| format!("Send EOF failed: {}", e))?;

        let mut packets = Vec::new();
        let mut packet = Packet::empty();

        while self.encoder.receive_packet(&mut packet).is_ok() {
            let is_keyframe = packet.is_key();
            let data = packet.data().map(|d| d.to_vec()).unwrap_or_default();

            if !data.is_empty() {
                packets.push(EncodedPacket { data, is_keyframe });
            }
        }

        Ok(packets)
    }

    pub fn set_bitrate(&mut self, bitrate: u32) {
        unsafe {
            let ctx = self.encoder.as_mut_ptr();
            (*ctx).bit_rate = bitrate as i64;
        }
    }

    pub fn is_hardware_accelerated(&self) -> bool {
        self.using_hw
    }

    #[allow(dead_code)]
    pub fn dimensions(&self) -> (u32, u32) {
        (self.width, self.height)
    }
}

pub struct H264Decoder {
    decoder: decoder::Video,
    scaler: Option<ScalerContext>,
}

pub struct DecodedFrame {
    pub width: u32,
    pub height: u32,
    pub rgba_data: Vec<u8>,
}

impl H264Decoder {
    pub fn new() -> Result<Self, String> {
        ffmpeg::init().map_err(|e| format!("FFmpeg init failed: {}", e))?;

        let decoder = Self::create_decoder()?;

        Ok(Self {
            decoder,
            scaler: None,
        })
    }

    fn create_decoder() -> Result<decoder::Video, String> {
        let hw_decoders = if cfg!(target_os = "macos") {
            vec!["h264_videotoolbox", "h264"]
        } else if cfg!(target_os = "windows") {
            vec!["h264_cuvid", "h264_qsv", "h264"]
        } else {
            vec!["h264_vaapi", "h264_cuvid", "h264"]
        };

        for hw_name in &hw_decoders {
            if let Ok(decoder) = Self::try_create_decoder(hw_name) {
                eprintln!("[H264] Using decoder: {}", hw_name);
                return Ok(decoder);
            }
        }

        Err("Failed to create any H.264 decoder".to_string())
    }

    fn try_create_decoder(codec_name: &str) -> Result<decoder::Video, String> {
        let codec = decoder::find_by_name(codec_name)
            .ok_or_else(|| format!("Decoder {} not found", codec_name))?;

        let mut context = Context::new_with_codec(codec)
            .decoder()
            .video()
            .map_err(|e| format!("Failed to create decoder context: {}", e))?;

        unsafe {
            let ctx = context.as_mut_ptr();
            (*ctx).thread_count = 0;
        }

        Ok(context)
    }

    pub fn decode(&mut self, data: &[u8]) -> Result<Vec<DecodedFrame>, String> {
        let packet = Packet::copy(data);

        self.decoder
            .send_packet(&packet)
            .map_err(|e| format!("Send packet failed: {}", e))?;

        let mut decoded_frames = Vec::new();

        loop {
            let mut frame = VideoFrame::empty();

            match self.decoder.receive_frame(&mut frame) {
                Ok(()) => {
                    let width = frame.width();
                    let height = frame.height();
                    let src_format = frame.format();

                    if self.scaler.is_none() {
                        self.scaler = Some(
                            ScalerContext::get(
                                src_format,
                                width,
                                height,
                                Pixel::RGBA,
                                width,
                                height,
                                ScalerFlags::BILINEAR,
                            )
                            .map_err(|e| format!("Failed to create scaler: {}", e))?,
                        );
                    }

                    let scaler = self.scaler.as_mut().unwrap();
                    let mut rgba_frame = VideoFrame::new(Pixel::RGBA, width, height);

                    scaler
                        .run(&frame, &mut rgba_frame)
                        .map_err(|e| format!("Scale failed: {}", e))?;

                    let stride = rgba_frame.stride(0);
                    let mut rgba_data = Vec::with_capacity((width * height * 4) as usize);

                    let plane = rgba_frame.data(0);
                    for row in 0..height as usize {
                        let start = row * stride;
                        let end = start + (width as usize * 4);
                        rgba_data.extend_from_slice(&plane[start..end]);
                    }

                    decoded_frames.push(DecodedFrame {
                        width,
                        height,
                        rgba_data,
                    });
                }
                Err(ffmpeg::Error::Other { errno }) if errno == ffmpeg::error::EAGAIN => {
                    break;
                }
                Err(e) => {
                    if decoded_frames.is_empty() {
                        return Err(format!("Receive frame failed: {}", e));
                    }
                    break;
                }
            }
        }

        Ok(decoded_frames)
    }

    #[allow(dead_code)]
    pub fn flush(&mut self) -> Result<Vec<DecodedFrame>, String> {
        self.decoder.send_eof().ok();

        let mut frames = Vec::new();
        let mut frame = VideoFrame::empty();

        while self.decoder.receive_frame(&mut frame).is_ok() {
            let width = frame.width();
            let height = frame.height();

            if self.scaler.is_none() {
                self.scaler = Some(
                    ScalerContext::get(
                        frame.format(),
                        width,
                        height,
                        Pixel::RGBA,
                        width,
                        height,
                        ScalerFlags::BILINEAR,
                    )
                    .map_err(|e| format!("Failed to create scaler: {}", e))?,
                );
            }

            let scaler = self.scaler.as_mut().unwrap();
            let mut rgba_frame = VideoFrame::new(Pixel::RGBA, width, height);
            scaler.run(&frame, &mut rgba_frame).ok();

            let stride = rgba_frame.stride(0);
            let mut rgba_data = Vec::with_capacity((width * height * 4) as usize);

            let plane = rgba_frame.data(0);
            for row in 0..height as usize {
                let start = row * stride;
                let end = start + (width as usize * 4);
                rgba_data.extend_from_slice(&plane[start..end]);
            }

            frames.push(DecodedFrame {
                width,
                height,
                rgba_data,
            });
        }

        Ok(frames)
    }
}

thread_local! {
    static RGBA_TO_YUV_SCALER: RefCell<Option<(ScalerContext, u32, u32)>> = const { RefCell::new(None) };
}

pub fn rgba_to_i420(rgba: &[u8], width: usize, height: usize) -> Vec<u8> {
    let width = width as u32;
    let height = height as u32;

    RGBA_TO_YUV_SCALER.with(|cell| {
        let mut cached = cell.borrow_mut();

        let needs_new = match &*cached {
            Some((_, w, h)) => *w != width || *h != height,
            None => true,
        };

        if needs_new {
            match ScalerContext::get(
                Pixel::RGBA,
                width,
                height,
                Pixel::YUV420P,
                width,
                height,
                ScalerFlags::FAST_BILINEAR,
            ) {
                Ok(scaler) => {
                    *cached = Some((scaler, width, height));
                }
                Err(e) => {
                    eprintln!("[H264] Failed to create RGBA->YUV scaler: {}", e);
                    return rgba_to_i420_fallback(rgba, width as usize, height as usize);
                }
            }
        }

        let (scaler, _, _) = cached.as_mut().unwrap();

        let mut src_frame = VideoFrame::new(Pixel::RGBA, width, height);
        let src_stride = src_frame.stride(0);
        {
            let plane = src_frame.data_mut(0);
            for row in 0..height as usize {
                let src_start = row * width as usize * 4;
                let dst_start = row * src_stride;
                plane[dst_start..dst_start + width as usize * 4]
                    .copy_from_slice(&rgba[src_start..src_start + width as usize * 4]);
            }
        }

        let mut dst_frame = VideoFrame::new(Pixel::YUV420P, width, height);

        if let Err(e) = scaler.run(&src_frame, &mut dst_frame) {
            eprintln!("[H264] Scaler run failed: {}", e);
            return rgba_to_i420_fallback(rgba, width as usize, height as usize);
        }

        let y_size = (width * height) as usize;
        let uv_size = y_size / 4;
        let mut yuv = vec![0u8; y_size + uv_size * 2];

        let y_stride = dst_frame.stride(0);
        let u_stride = dst_frame.stride(1);
        let v_stride = dst_frame.stride(2);

        {
            let y_plane = dst_frame.data(0);
            for row in 0..height as usize {
                let src_start = row * y_stride;
                let dst_start = row * width as usize;
                yuv[dst_start..dst_start + width as usize]
                    .copy_from_slice(&y_plane[src_start..src_start + width as usize]);
            }
        }

        {
            let u_plane = dst_frame.data(1);
            let uv_width = (width / 2) as usize;
            let uv_height = (height / 2) as usize;
            for row in 0..uv_height {
                let src_start = row * u_stride;
                let dst_start = y_size + row * uv_width;
                yuv[dst_start..dst_start + uv_width]
                    .copy_from_slice(&u_plane[src_start..src_start + uv_width]);
            }
        }

        {
            let v_plane = dst_frame.data(2);
            let uv_width = (width / 2) as usize;
            let uv_height = (height / 2) as usize;
            for row in 0..uv_height {
                let src_start = row * v_stride;
                let dst_start = y_size + uv_size + row * uv_width;
                yuv[dst_start..dst_start + uv_width]
                    .copy_from_slice(&v_plane[src_start..src_start + uv_width]);
            }
        }

        yuv
    })
}

fn rgba_to_i420_fallback(rgba: &[u8], width: usize, height: usize) -> Vec<u8> {
    use rayon::prelude::*;

    let y_size = width * height;
    let uv_size = (width / 2) * (height / 2);
    let mut yuv = vec![0u8; y_size + uv_size * 2];

    let (y_plane, uv_planes) = yuv.split_at_mut(y_size);

    y_plane
        .par_chunks_mut(width)
        .enumerate()
        .for_each(|(y, row)| {
            #[allow(clippy::needless_range_loop)]
            for x in 0..width {
                let idx = (y * width + x) * 4;
                let r = rgba.get(idx).copied().unwrap_or(0) as i32;
                let g = rgba.get(idx + 1).copied().unwrap_or(0) as i32;
                let b = rgba.get(idx + 2).copied().unwrap_or(0) as i32;

                let y_val = ((66 * r + 129 * g + 25 * b + 128) >> 8) + 16;
                row[x] = y_val.clamp(0, 255) as u8;
            }
        });

    let (u_plane, v_plane) = uv_planes.split_at_mut(uv_size);
    let uv_width = width / 2;

    u_plane
        .par_chunks_mut(uv_width)
        .enumerate()
        .for_each(|(uv_y, u_row)| {
            let y = uv_y * 2;
            #[allow(clippy::needless_range_loop)]
            for uv_x in 0..uv_width {
                let x = uv_x * 2;
                let idx = (y * width + x) * 4;
                let r = rgba.get(idx).copied().unwrap_or(0) as i32;
                let g = rgba.get(idx + 1).copied().unwrap_or(0) as i32;
                let b = rgba.get(idx + 2).copied().unwrap_or(0) as i32;

                let u_val = ((-38 * r - 74 * g + 112 * b + 128) >> 8) + 128;
                u_row[uv_x] = u_val.clamp(0, 255) as u8;
            }
        });

    v_plane
        .par_chunks_mut(uv_width)
        .enumerate()
        .for_each(|(uv_y, v_row)| {
            let y = uv_y * 2;
            #[allow(clippy::needless_range_loop)]
            for uv_x in 0..uv_width {
                let x = uv_x * 2;
                let idx = (y * width + x) * 4;
                let r = rgba.get(idx).copied().unwrap_or(0) as i32;
                let g = rgba.get(idx + 1).copied().unwrap_or(0) as i32;
                let b = rgba.get(idx + 2).copied().unwrap_or(0) as i32;

                let v_val = ((112 * r - 94 * g - 18 * b + 128) >> 8) + 128;
                v_row[uv_x] = v_val.clamp(0, 255) as u8;
            }
        });

    yuv
}
