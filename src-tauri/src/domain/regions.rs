//! Separates the logos of a transparent PNG into regions so one can be imported on its
//! own. Works in source pixels: physical size is still requested in cm at import.
use super::assets::VISIBLE_ALPHA;
use image::{Rgba, RgbaImage};

/// Default merge distance: about 2 mm at 300 DPI, so text under an icon stays together.
pub const DEFAULT_MERGE_PX: u32 = 24;
pub const MAX_MERGE_PX: u32 = 1000;
/// Above this many raw islands the PNG is noise or a photo, not separable logos.
const MAX_COMPONENTS: usize = 4096;
const PREVIEW_MAX_SIDE: u32 = 1600;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Rect {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

impl Rect {
    fn right(&self) -> u32 {
        self.x + self.width
    }
    fn bottom(&self) -> u32 {
        self.y + self.height
    }
    fn union(&self, other: &Rect) -> Rect {
        let x = self.x.min(other.x);
        let y = self.y.min(other.y);
        Rect {
            x,
            y,
            width: self.right().max(other.right()) - x,
            height: self.bottom().max(other.bottom()) - y,
        }
    }
    /// Empty band between two boxes; negative when they overlap on both axes.
    fn gap(&self, other: &Rect) -> i64 {
        let dx = (other.x as i64 - self.right() as i64).max(self.x as i64 - other.right() as i64);
        let dy = (other.y as i64 - self.bottom() as i64).max(self.y as i64 - other.bottom() as i64);
        dx.max(dy)
    }
}

/// Regions in reading order (top to bottom, then left to right), numbered from 1.
#[derive(Debug)]
pub struct Regions {
    pub width: u32,
    pub height: u32,
    pub regions: Vec<Rect>,
    /// Island label per pixel (0 = not visible) and the region of each island.
    labels: Vec<u32>,
    island_region: Vec<usize>,
}

pub fn detect(image: &RgbaImage, merge_px: u32) -> Result<Regions, String> {
    if merge_px > MAX_MERGE_PX {
        return Err(format!(
            "La distancia de agrupación no puede superar {MAX_MERGE_PX} px."
        ));
    }
    let (width, height) = image.dimensions();
    let visible = |x: u32, y: u32| image.get_pixel(x, y)[3] >= VISIBLE_ALPHA;
    let corners = [
        (0, 0),
        (width - 1, 0),
        (0, height - 1),
        (width - 1, height - 1),
    ];
    if corners.iter().all(|&(x, y)| visible(x, y)) {
        return Err(
            "El PNG no tiene fondo transparente; solo se pueden separar logos sobre transparencia."
                .into(),
        );
    }
    let mut labels = vec![0u32; (width * height) as usize];
    let mut islands: Vec<Rect> = vec![];
    let mut stack = vec![];
    for start in 0..labels.len() {
        let (sx, sy) = (start as u32 % width, start as u32 / width);
        if labels[start] != 0 || !visible(sx, sy) {
            continue;
        }
        if islands.len() == MAX_COMPONENTS {
            return Err(format!(
                "El PNG tiene más de {MAX_COMPONENTS} islas visibles; no parece un conjunto de logos separables."
            ));
        }
        let label = islands.len() as u32 + 1;
        let (mut x0, mut y0, mut x1, mut y1) = (sx, sy, sx, sy);
        labels[start] = label;
        stack.push((sx, sy));
        while let Some((x, y)) = stack.pop() {
            (x0, y0, x1, y1) = (x0.min(x), y0.min(y), x1.max(x), y1.max(y));
            for (dx, dy) in [
                (-1i64, -1i64),
                (0, -1),
                (1, -1),
                (-1, 0),
                (1, 0),
                (-1, 1),
                (0, 1),
                (1, 1),
            ] {
                let (nx, ny) = (x as i64 + dx, y as i64 + dy);
                if nx < 0 || ny < 0 || nx >= width as i64 || ny >= height as i64 {
                    continue;
                }
                let (nx, ny) = (nx as u32, ny as u32);
                let n = (ny * width + nx) as usize;
                if labels[n] == 0 && visible(nx, ny) {
                    labels[n] = label;
                    stack.push((nx, ny));
                }
            }
        }
        islands.push(Rect {
            x: x0,
            y: y0,
            width: x1 - x0 + 1,
            height: y1 - y0 + 1,
        });
    }
    if islands.is_empty() {
        return Err(super::assets::EMPTY_ARTWORK_ERROR.into());
    }

    // Merge islands closer than merge_px (or nested) until stable; merged boxes grow.
    let mut group: Vec<usize> = (0..islands.len()).collect();
    let mut boxes: Vec<Option<Rect>> = islands.iter().copied().map(Some).collect();
    loop {
        let mut merged = false;
        for a in 0..boxes.len() {
            let Some(mut current) = boxes[a] else {
                continue;
            };
            for b in a + 1..boxes.len() {
                let Some(other) = boxes[b] else { continue };
                if current.gap(&other) < i64::from(merge_px) {
                    current = current.union(&other);
                    boxes[b] = None;
                    group.iter_mut().filter(|g| **g == b).for_each(|g| *g = a);
                    merged = true;
                }
            }
            boxes[a] = Some(current);
        }
        if !merged {
            break;
        }
    }
    let mut order: Vec<usize> = (0..boxes.len()).filter(|&i| boxes[i].is_some()).collect();
    order.sort_by_key(|&i| {
        let r = boxes[i].unwrap();
        (r.y, r.x)
    });
    let regions = order.iter().map(|&i| boxes[i].unwrap()).collect();
    let island_region = group
        .iter()
        .map(|g| order.iter().position(|o| o == g).unwrap())
        .collect();
    Ok(Regions {
        width,
        height,
        regions,
        labels,
        island_region,
    })
}

impl Regions {
    /// Copies the selected regions (1-based) into a tight image. Islands of other regions
    /// that intrude into the selection box become transparent; faint edge pixels below the
    /// visibility threshold are kept so antialiasing is not clipped.
    pub fn crop(&self, image: &RgbaImage, selected: &[usize]) -> Result<RgbaImage, String> {
        if selected.is_empty() || selected.iter().any(|&i| i == 0 || i > self.regions.len()) {
            return Err(format!(
                "Índice de región no válido; usa valores entre 1 y {}.",
                self.regions.len()
            ));
        }
        let wanted: Vec<bool> = (0..self.regions.len())
            .map(|r| selected.contains(&(r + 1)))
            .collect();
        let bbox = selected
            .iter()
            .map(|&i| self.regions[i - 1])
            .reduce(|a, b| a.union(&b))
            .unwrap();
        let mut out = RgbaImage::new(bbox.width, bbox.height);
        for y in 0..bbox.height {
            for x in 0..bbox.width {
                let (sx, sy) = (bbox.x + x, bbox.y + y);
                let label = self.labels[(sy * self.width + sx) as usize];
                if label == 0 || wanted[self.island_region[label as usize - 1]] {
                    out.put_pixel(x, y, *image.get_pixel(sx, sy));
                }
            }
        }
        Ok(out)
    }
}

/// Copies a rectangle as is, for logos the island detection cannot isolate.
pub fn crop_rect(image: &RgbaImage, rect: Rect) -> Result<RgbaImage, String> {
    if rect.width == 0
        || rect.height == 0
        || rect
            .x
            .checked_add(rect.width)
            .is_none_or(|r| r > image.width())
        || rect
            .y
            .checked_add(rect.height)
            .is_none_or(|b| b > image.height())
    {
        return Err(format!(
            "El rectángulo debe tener tamaño positivo y estar dentro de la imagen ({} × {} px).",
            image.width(),
            image.height()
        ));
    }
    Ok(image::imageops::crop_imm(image, rect.x, rect.y, rect.width, rect.height).to_image())
}

// 3×5 bitmap digits for preview labels; avoids a font dependency.
const DIGITS: [[u8; 5]; 10] = [
    [7, 5, 5, 5, 7],
    [2, 6, 2, 2, 7],
    [7, 1, 7, 4, 7],
    [7, 1, 7, 1, 7],
    [5, 5, 7, 1, 1],
    [7, 4, 7, 1, 7],
    [7, 4, 7, 5, 7],
    [7, 1, 1, 1, 1],
    [7, 5, 7, 5, 7],
    [7, 5, 7, 1, 7],
];

/// A NOT-FOR-PRINT preview: artwork over a light checkerboard with numbered boxes.
pub fn preview(image: &RgbaImage, regions: &Regions) -> RgbaImage {
    let (w, h) = image.dimensions();
    let scale = (PREVIEW_MAX_SIDE as f64 / w.max(h) as f64).min(1.0);
    let (pw, ph) = (
        ((w as f64 * scale).round() as u32).max(1),
        ((h as f64 * scale).round() as u32).max(1),
    );
    let art = image::imageops::resize(image, pw, ph, image::imageops::FilterType::Triangle);
    let mut out = RgbaImage::from_fn(pw, ph, |x, y| {
        if (x / 12 + y / 12) % 2 == 0 {
            Rgba([235, 235, 235, 255])
        } else {
            Rgba([205, 205, 205, 255])
        }
    });
    image::imageops::overlay(&mut out, &art, 0, 0);
    let magenta = Rgba([220, 0, 160, 255]);
    let fill = |out: &mut RgbaImage, x0: i64, y0: i64, x1: i64, y1: i64, c: Rgba<u8>| {
        for y in y0.max(0)..y1.min(ph as i64) {
            for x in x0.max(0)..x1.min(pw as i64) {
                out.put_pixel(x as u32, y as u32, c);
            }
        }
    };
    for (index, r) in regions.regions.iter().enumerate() {
        let x0 = (r.x as f64 * scale).floor() as i64;
        let y0 = (r.y as f64 * scale).floor() as i64;
        let x1 = (r.right() as f64 * scale).ceil() as i64;
        let y1 = (r.bottom() as f64 * scale).ceil() as i64;
        let t = 2;
        fill(&mut out, x0 - t, y0 - t, x1 + t, y0, magenta);
        fill(&mut out, x0 - t, y1, x1 + t, y1 + t, magenta);
        fill(&mut out, x0 - t, y0, x0, y1, magenta);
        fill(&mut out, x1, y0, x1 + t, y1, magenta);
        let label = (index + 1).to_string();
        let px = 4;
        let label_w = label.len() as i64 * 4 * px + px;
        fill(&mut out, x0, y0, x0 + label_w, y0 + 7 * px, magenta);
        for (n, ch) in label.bytes().enumerate() {
            let glyph = DIGITS[(ch - b'0') as usize];
            for (row, bits) in glyph.iter().enumerate() {
                for col in 0..3 {
                    if bits >> (2 - col) & 1 == 1 {
                        let gx = x0 + px + (n as i64 * 4 + col) * px;
                        let gy = y0 + px + row as i64 * px;
                        fill(
                            &mut out,
                            gx,
                            gy,
                            gx + px,
                            gy + px,
                            Rgba([255, 255, 255, 255]),
                        );
                    }
                }
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    const RED: Rgba<u8> = Rgba([200, 20, 20, 255]);

    fn canvas(w: u32, h: u32, rects: &[(u32, u32, u32, u32)]) -> RgbaImage {
        let mut img = RgbaImage::new(w, h);
        for &(x, y, rw, rh) in rects {
            for yy in y..y + rh {
                for xx in x..x + rw {
                    img.put_pixel(xx, yy, RED);
                }
            }
        }
        img
    }

    fn rect(x: u32, y: u32, width: u32, height: u32) -> Rect {
        Rect {
            x,
            y,
            width,
            height,
        }
    }

    #[test]
    fn separated_logos_are_regions_in_reading_order() {
        // Second logo is higher on the page, so it comes first.
        let img = canvas(400, 200, &[(250, 100, 50, 40), (20, 10, 60, 30)]);
        let found = detect(&img, DEFAULT_MERGE_PX).unwrap();
        assert_eq!(
            found.regions,
            vec![rect(20, 10, 60, 30), rect(250, 100, 50, 40)]
        );
    }

    #[test]
    fn nearby_parts_merge_and_merge_distance_is_configurable() {
        // Icon with a caption 10 px below it, and a separate logo far away.
        let img = canvas(
            400,
            200,
            &[(10, 10, 80, 40), (20, 60, 60, 10), (300, 10, 40, 40)],
        );
        let merged = detect(&img, DEFAULT_MERGE_PX).unwrap();
        assert_eq!(
            merged.regions,
            vec![rect(10, 10, 80, 60), rect(300, 10, 40, 40)]
        );
        let split = detect(&img, 0).unwrap();
        assert_eq!(split.regions.len(), 3);
        assert!(detect(&img, MAX_MERGE_PX + 1).is_err());
    }

    #[test]
    fn faint_halo_inside_a_hole_belongs_to_its_logo() {
        let mut img = canvas(300, 200, &[(10, 10, 120, 120)]);
        for y in 40..100 {
            for x in 40..100 {
                img.put_pixel(x, y, Rgba([0, 0, 0, 0]));
            }
        }
        // Resampling ripple inside the hole, separated from the ring by transparency.
        for x in 60..80 {
            img.put_pixel(x, 70, Rgba([200, 20, 20, 12]));
        }
        let found = detect(&img, 0).unwrap();
        assert_eq!(found.regions, vec![rect(10, 10, 120, 120)]);
    }

    #[test]
    fn crop_keeps_exact_pixels_and_masks_other_regions_inside_the_box() {
        // Diagonal logos: combining 1 and 3 spans a box that contains logo 2.
        let mut img = canvas(300, 300, &[(10, 10, 30, 30), (200, 200, 30, 30)]);
        for y in 100..130 {
            for x in 100..130 {
                img.put_pixel(x, y, Rgba([0, 0, 255, 255]));
            }
        }
        img.put_pixel(15, 15, Rgba([10, 20, 30, 77]));
        let found = detect(&img, 0).unwrap();
        assert_eq!(found.regions.len(), 3);
        let ends = found.crop(&img, &[1, 3]).unwrap();
        assert_eq!(ends.dimensions(), (220, 220));
        assert_eq!(ends.get_pixel(0, 0), &RED);
        assert_eq!(ends.get_pixel(219, 219), &RED);
        assert_eq!(
            ends.get_pixel(105, 105)[3],
            0,
            "the logo in between is masked out"
        );
        let all = found.crop(&img, &[1, 2, 3]).unwrap();
        assert_eq!(all.get_pixel(105, 105), &Rgba([0, 0, 255, 255]));
        let first = found.crop(&img, &[1]).unwrap();
        assert_eq!(first.dimensions(), (30, 30));
        assert_eq!(
            first.get_pixel(5, 5),
            &Rgba([10, 20, 30, 77]),
            "alpha is preserved"
        );
        assert!(found.crop(&img, &[4]).is_err());
        assert!(found.crop(&img, &[0]).is_err());
        assert!(found.crop(&img, &[]).is_err());
    }

    #[test]
    fn opaque_background_and_empty_images_are_rejected() {
        let opaque = RgbaImage::from_pixel(50, 50, Rgba([255, 255, 255, 255]));
        assert!(detect(&opaque, DEFAULT_MERGE_PX)
            .unwrap_err()
            .contains("fondo transparente"));
        assert!(detect(&RgbaImage::new(10, 10), DEFAULT_MERGE_PX).is_err());
    }

    #[test]
    fn rectangle_crop_is_bounded() {
        let img = canvas(100, 50, &[(10, 10, 20, 20)]);
        assert_eq!(
            crop_rect(&img, rect(5, 5, 30, 30)).unwrap().dimensions(),
            (30, 30)
        );
        assert!(crop_rect(&img, rect(90, 0, 20, 10)).is_err());
        assert!(crop_rect(&img, rect(0, 0, 0, 10)).is_err());
        assert!(crop_rect(&img, rect(u32::MAX, 0, 2, 2)).is_err());
    }

    #[test]
    fn preview_numbers_every_region_without_changing_size_of_small_sources() {
        let img = canvas(400, 200, &[(20, 10, 60, 30), (250, 100, 50, 40)]);
        let found = detect(&img, DEFAULT_MERGE_PX).unwrap();
        let p = preview(&img, &found);
        assert_eq!(p.dimensions(), (400, 200));
        assert_eq!(
            p.get_pixel(19, 20),
            &Rgba([220, 0, 160, 255]),
            "box outline"
        );
        assert_eq!(
            p.get_pixel(0, 199)[3],
            255,
            "transparency drawn as checkerboard"
        );
    }
}
