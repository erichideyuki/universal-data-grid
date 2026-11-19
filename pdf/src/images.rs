//! Imagens das células (`customizeCell`): JPEG vai como está (DCTDecode); PNG é decodificado e
//! regravado com deflate (alfa vira `/SMask`).

use crate::writer::Writer;

pub struct Image {
    pub obj: u32,
    pub name: String,
    pub width: f64,
    pub height: f64,
}

pub fn add(w: &mut Writer, index: usize, data: &[u8], format: u8, width: f64, height: f64) -> Result<Image, String> {
    let obj = w.alloc();
    if format == 1 {
        let (pw, ph, comps) = jpeg_info(data).ok_or_else(|| "invalid JPEG".to_owned())?;
        let cs = match comps {
            1 => "/DeviceGray",
            4 => "/DeviceCMYK",
            _ => "/DeviceRGB",
        };
        let decode = if comps == 4 { " /Decode [1 0 1 0 1 0 1 0]" } else { "" };
        w.stream(obj, &format!(" /Type /XObject /Subtype /Image /Width {pw} /Height {ph} /ColorSpace {cs} /BitsPerComponent 8 /Filter /DCTDecode{decode}"), data, false);
    } else {
        let mut dec = png::Decoder::new(std::io::Cursor::new(data));
        dec.set_transformations(png::Transformations::EXPAND | png::Transformations::STRIP_16);
        let mut reader = dec.read_info().map_err(|_| "invalid PNG".to_owned())?;
        let mut buf = vec![0; reader.output_buffer_size()];
        let info = reader.next_frame(&mut buf).map_err(|_| "invalid PNG".to_owned())?;
        let (pw, ph) = (info.width, info.height);
        let px = &buf[..info.buffer_size()];
        let (color, alpha, cs): (Vec<u8>, Option<Vec<u8>>, &str) = match info.color_type {
            png::ColorType::Grayscale => (px.to_vec(), None, "/DeviceGray"),
            png::ColorType::GrayscaleAlpha => (px.chunks(2).map(|c| c[0]).collect(), Some(px.chunks(2).map(|c| c[1]).collect()), "/DeviceGray"),
            png::ColorType::Rgb => (px.to_vec(), None, "/DeviceRGB"),
            png::ColorType::Rgba => (px.chunks(4).flat_map(|c| [c[0], c[1], c[2]]).collect(), Some(px.chunks(4).map(|c| c[3]).collect()), "/DeviceRGB"),
            png::ColorType::Indexed => return Err("unexpected indexed PNG".to_owned()),
        };
        let smask = alpha.map(|a| {
            let m = w.alloc();
            w.stream(m, &format!(" /Type /XObject /Subtype /Image /Width {pw} /Height {ph} /ColorSpace /DeviceGray /BitsPerComponent 8"), &a, true);
            format!(" /SMask {m} 0 R")
        });
        w.stream(obj, &format!(" /Type /XObject /Subtype /Image /Width {pw} /Height {ph} /ColorSpace {cs} /BitsPerComponent 8{}", smask.unwrap_or_default()), &color, true);
    }
    Ok(Image { obj, name: format!("Im{index}"), width, height })
}

/// (largura, altura, componentes) do JPEG pelo marcador SOF.
fn jpeg_info(d: &[u8]) -> Option<(u32, u32, u8)> {
    if d.get(0..2)? != [0xFF, 0xD8] {
        return None;
    }
    let mut i = 2;
    while i + 4 <= d.len() {
        if d[i] != 0xFF {
            i += 1;
            continue;
        }
        let m = d[i + 1];
        let len = usize::from(u16::from_be_bytes([d[i + 2], d[i + 3]]));
        if matches!(m, 0xC0..=0xC3 | 0xC5..=0xC7 | 0xC9..=0xCB | 0xCD..=0xCF) {
            let h = u32::from(u16::from_be_bytes([*d.get(i + 5)?, *d.get(i + 6)?]));
            let w = u32::from(u16::from_be_bytes([*d.get(i + 7)?, *d.get(i + 8)?]));
            return Some((w, h, *d.get(i + 9)?));
        }
        i += 2 + len;
    }
    None
}
