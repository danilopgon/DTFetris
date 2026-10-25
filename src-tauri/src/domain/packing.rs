use serde::{Deserialize, Serialize};

use crate::domain::design::{
    fitted_visible_size_cm, parse_color_override, DesignInput, Placement, Sheet,
};
use std::collections::BTreeSet;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SheetConfig {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gap_cm: Option<f64>,
    pub width_cm: f64,
    pub height_cm: f64,
}

/// Missing gap is the legacy zero-gap contract. Upper bound keeps fixed-point arithmetic safe.
pub fn validate_gap_cm(gap: Option<f64>) -> Result<f64, String> {
    let gap = gap.unwrap_or(0.0);
    if !gap.is_finite() || gap < 0.0 || gap > u32::MAX as f64 {
        return Err("La separación debe ser finita y estar entre 0 y 4294967295 cm.".into());
    }
    Ok(gap)
}

pub const CM_QUANTUM: f64 = 0.0001;
const UNITS_PER_CM: f64 = 10_000.0;
fn ceil_units(cm: f64) -> u64 {
    (cm * UNITS_PER_CM).ceil() as u64
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackingRequest {
    pub sheet: SheetConfig,
    pub designs: Vec<DesignInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum UnplacedReasonCode {
    DoesNotFit,
    InvalidDimensions,
    InvalidQuantity,
    SheetTooSmall,
}

impl UnplacedReasonCode {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::DoesNotFit => "does_not_fit",
            Self::InvalidDimensions => "invalid_dimensions",
            Self::InvalidQuantity => "invalid_quantity",
            Self::SheetTooSmall => "sheet_too_small",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UnplacedItem {
    pub design_id: String,
    pub item_index: u32,
    pub reason: UnplacedReasonCode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackingResult {
    pub sheets: Vec<Sheet>,
    pub unplaced_items: Vec<UnplacedItem>,
}

fn is_positive_integer_cm(value: f64) -> bool {
    value.is_finite() && value.fract() == 0.0 && value > 0.0 && value <= u32::MAX as f64
}

pub fn validate_packing_request(request: &PackingRequest) -> Result<(), UnplacedReasonCode> {
    if validate_gap_cm(request.sheet.gap_cm).is_err()
        || !is_positive_integer_cm(request.sheet.width_cm)
        || !is_positive_integer_cm(request.sheet.height_cm)
        || request.designs.iter().any(|design| {
            !is_positive_integer_cm(design.width_cm) || !is_positive_integer_cm(design.height_cm)
        })
    {
        return Err(UnplacedReasonCode::InvalidDimensions);
    }

    if request.designs.is_empty() || request.designs.iter().any(|design| design.quantity == 0) {
        return Err(UnplacedReasonCode::InvalidQuantity);
    }

    Ok(())
}

/// Limits are operational safeguards, not physical sheet defaults.
pub const MAX_PACKING_ITEMS: usize = 1_000;
const MAX_PACKING_WORK: usize = 5_000_000;
const WORKLOAD_ERROR: &str = "packing_limit_exceeded";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct Rect {
    x: u64,
    y: u64,
    width: u64,
    height: u64,
}

impl Rect {
    fn right(self) -> u64 {
        self.x + self.width
    }
    fn bottom(self) -> u64 {
        self.y + self.height
    }

    fn intersects(self, other: Self) -> bool {
        self.x < other.right()
            && other.x < self.right()
            && self.y < other.bottom()
            && other.y < self.bottom()
    }

    fn contains(self, other: Self) -> bool {
        self.x <= other.x
            && self.y <= other.y
            && self.right() >= other.right()
            && self.bottom() >= other.bottom()
    }
}

fn spend(work: &mut usize) -> Result<(), String> {
    if *work == 0 {
        return Err(WORKLOAD_ERROR.into());
    }
    *work -= 1;
    Ok(())
}

/// Split every intersecting free rectangle (MaxRects, not guillotine packing),
/// then remove contained/duplicate free rectangles. Free rectangles may overlap.
fn occupy(free: &mut Vec<Rect>, used: Rect, work: &mut usize) -> Result<(), String> {
    let mut split = Vec::new();
    for rect in free.drain(..) {
        spend(work)?;
        if !rect.intersects(used) {
            split.push(rect);
            continue;
        }
        if used.x > rect.x {
            split.push(Rect {
                width: used.x - rect.x,
                ..rect
            });
        }
        if used.right() < rect.right() {
            split.push(Rect {
                x: used.right(),
                width: rect.right() - used.right(),
                ..rect
            });
        }
        if used.y > rect.y {
            split.push(Rect {
                height: used.y - rect.y,
                ..rect
            });
        }
        if used.bottom() < rect.bottom() {
            split.push(Rect {
                y: used.bottom(),
                height: rect.bottom() - used.bottom(),
                ..rect
            });
        }
    }
    for (index, rect) in split.iter().enumerate() {
        let mut contained = false;
        for (other_index, other) in split.iter().enumerate() {
            spend(work)?;
            if index != other_index
                && other.contains(*rect)
                && (other != rect || other_index < index)
            {
                contained = true;
                break;
            }
        }
        if !contained {
            free.push(*rect);
        }
    }
    Ok(())
}

type Score = (u64, u64, usize, u64, u64, bool);

/// Pure cm-based deterministic MaxRects / Best Short Side Fit.
/// Invalid requests fail atomically; valid oversized copies are explicit unplaced items.
pub fn pack(request: &PackingRequest) -> Result<PackingResult, String> {
    validate_packing_request(request).map_err(|reason| reason.as_str().to_string())?;
    if request.designs.len() > MAX_PACKING_ITEMS {
        return Err(WORKLOAD_ERROR.into());
    }
    let mut ids = BTreeSet::new();
    let mut count = 0usize;
    for design in &request.designs {
        parse_color_override(design.color_override.as_deref())?;
        if design.id.trim().is_empty() || !ids.insert(&design.id) {
            return Err("invalid_design_id".into());
        }
        count = count
            .checked_add(design.quantity as usize)
            .ok_or(WORKLOAD_ERROR)?;
        if count > MAX_PACKING_ITEMS {
            return Err(WORKLOAD_ERROR.into());
        }
    }

    let gap = ceil_units(validate_gap_cm(request.sheet.gap_cm)?);
    // Fixed-point centimeters, rounded outward to one micrometer, never pixels.
    let mut designs = request
        .designs
        .iter()
        .map(|d| {
            let (w, h) = fitted_visible_size_cm(d)?;
            Ok((d, ceil_units(w), ceil_units(h)))
        })
        .collect::<Result<Vec<_>, String>>()?;
    designs.sort_by(|a, b| {
        let area = |d: &(&DesignInput, u64, u64)| u128::from(d.1) * u128::from(d.2);
        area(b)
            .cmp(&area(a))
            .then_with(|| b.1.max(b.2).cmp(&a.1.max(a.2)))
            .then_with(|| a.0.id.cmp(&b.0.id))
    });
    let empty = Rect {
        x: 0,
        y: 0,
        width: ceil_units(request.sheet.width_cm) + gap,
        height: ceil_units(request.sheet.height_cm) + gap,
    };
    let mut result = PackingResult {
        sheets: Vec::new(),
        unplaced_items: Vec::new(),
    };
    let mut pages: Vec<Vec<Rect>> = Vec::new();
    let mut work = MAX_PACKING_WORK;

    for (design, artwork_width, artwork_height) in designs {
        let width = artwork_width + gap;
        let height = artwork_height + gap;
        let fits = |w, h| w <= empty.width && h <= empty.height;
        if !fits(width, height) && !(design.can_rotate && fits(height, width)) {
            for item_index in 0..design.quantity {
                result.unplaced_items.push(UnplacedItem {
                    design_id: design.id.clone(),
                    item_index,
                    reason: UnplacedReasonCode::DoesNotFit,
                });
            }
            continue;
        }
        for _ in 0..design.quantity {
            let mut best: Option<(Score, Rect)> = None;
            // An empty page is considered only when all existing pages fail.
            for page_index in 0..=pages.len() {
                if page_index == pages.len() && best.is_some() {
                    break;
                }
                let free = if page_index == pages.len() {
                    std::slice::from_ref(&empty)
                } else {
                    pages[page_index].as_slice()
                };
                for rect in free {
                    for rotated in [false, true] {
                        spend(&mut work)?;
                        if rotated && (!design.can_rotate || width == height) {
                            continue;
                        }
                        let (w, h) = if rotated {
                            (height, width)
                        } else {
                            (width, height)
                        };
                        if w > rect.width || h > rect.height {
                            continue;
                        }
                        let (dw, dh) = (rect.width - w, rect.height - h);
                        let score = (dw.min(dh), dw.max(dh), page_index, rect.y, rect.x, rotated);
                        if best.as_ref().map_or(true, |(old, _)| score < *old) {
                            best = Some((
                                score,
                                Rect {
                                    x: rect.x,
                                    y: rect.y,
                                    width: w,
                                    height: h,
                                },
                            ));
                        }
                    }
                }
            }
            let (score, used) = best.expect("prechecked item fits an empty sheet");
            let page_index = score.2;
            if page_index == pages.len() {
                pages.push(vec![empty]);
                result.sheets.push(Sheet {
                    gap_cm: request.sheet.gap_cm,
                    id: format!("sheet-{}", pages.len()),
                    width_cm: request.sheet.width_cm,
                    height_cm: request.sheet.height_cm,
                    placements: Vec::new(),
                });
            }
            occupy(&mut pages[page_index], used, &mut work)?;
            result.sheets[page_index].placements.push(Placement {
                design_id: design.id.clone(),
                x_cm: used.x as f64 / UNITS_PER_CM,
                y_cm: used.y as f64 / UNITS_PER_CM,
                width_cm: (used.width - gap) as f64 / UNITS_PER_CM,
                height_cm: (used.height - gap) as f64 / UNITS_PER_CM,
                rotated: score.5,
            });
        }
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::{
        pack, validate_packing_request, PackingRequest, PackingResult, SheetConfig, UnplacedItem,
        UnplacedReasonCode,
    };
    use crate::domain::design::{DesignInput, ImageFormat, Sheet, VisibleBounds};
    use serde_json::json;

    fn sample_visible_bounds() -> VisibleBounds {
        VisibleBounds {
            x_px: 0.0,
            y_px: 0.0,
            width_px: 120.0,
            height_px: 80.0,
            source_width_px: 120.0,
            source_height_px: 80.0,
        }
    }

    fn valid_design(quantity: u32) -> DesignInput {
        DesignInput {
            id: "design-1".to_string(),
            name: "Logo".to_string(),
            image_path: "C:/assets/logo.png".to_string(),
            width_cm: 12.0,
            height_cm: 8.0,
            format: ImageFormat::Png,
            visible_bounds: sample_visible_bounds(),
            original_aspect_ratio: 1.5,
            quantity,
            can_rotate: true,
            color_override: None,
        }
    }

    fn request(width: f64, height: f64, designs: Vec<DesignInput>) -> PackingRequest {
        PackingRequest {
            sheet: SheetConfig {
                gap_cm: None,
                width_cm: width,
                height_cm: height,
            },
            designs,
        }
    }

    fn design(id: &str, width: f64, height: f64, quantity: u32, rotate: bool) -> DesignInput {
        DesignInput {
            original_aspect_ratio: width / height,
            visible_bounds: VisibleBounds {
                x_px: 0.0,
                y_px: 0.0,
                width_px: width,
                height_px: height,
                source_width_px: width,
                source_height_px: height,
            },
            id: id.into(),
            width_cm: width,
            height_cm: height,
            quantity,
            can_rotate: rotate,
            ..valid_design(quantity)
        }
    }

    #[test]
    fn color_override_rejects_invalid_values_and_never_changes_packing_geometry() {
        let mut input = request(60.0, 100.0, vec![valid_design(3)]);
        let baseline = serde_json::to_value(pack(&input).unwrap()).unwrap();
        input.designs[0].color_override = Some("#aB09fF".into());
        assert_eq!(
            serde_json::to_value(pack(&input).unwrap()).unwrap(),
            baseline
        );
        input.designs[0].color_override = Some("#bad".into());
        assert!(pack(&input).unwrap_err().contains("#RRGGBB"));
        input.designs[0].color_override = None;
        assert_eq!(
            serde_json::to_value(pack(&input).unwrap()).unwrap(),
            baseline
        );
    }

    fn narrow_design(quantity: u32) -> DesignInput {
        let mut d = design("narrow", 9.0, 8.0, quantity, false);
        d.original_aspect_ratio = 570.0 / 91.0;
        d.visible_bounds.width_px = 570.0;
        d.visible_bounds.height_px = 91.0;
        d.visible_bounds.source_width_px = 570.0;
        d.visible_bounds.source_height_px = 91.0;
        d
    }

    #[test]
    fn fitted_narrow_art_uses_actual_height_without_upscaling_or_unused_cell() {
        let r = request(9.0, 8.0, vec![narrow_design(5)]);
        let result = pack(&r).unwrap();
        assert_eq!(result.sheets.len(), 1);
        for p in &result.sheets[0].placements {
            assert_eq!(p.width_cm, 9.0);
            assert_eq!(p.height_cm, 1.4369);
            assert!(p.x_cm + p.width_cm <= 9.0);
            assert!(p.y_cm + p.height_cm <= 8.0);
        }
        let too_wide = request(8.0, 8.0, vec![narrow_design(1)]);
        assert_eq!(pack(&too_wide).unwrap().unplaced_items.len(), 1);
    }

    #[test]
    fn gap_is_between_artworks_not_a_sheet_edge_margin_and_rounds_outward() {
        let mut r = request(9.0, 8.0, vec![narrow_design(8)]);
        r.sheet.gap_cm = Some(0.3);
        let result = pack(&r).unwrap();
        assert_eq!(result.sheets.len(), 2);
        assert_eq!(result.sheets[0].gap_cm, Some(0.3));
        assert_eq!(result.sheets[0].placements[0].x_cm, 0.0);
        assert_eq!(result.sheets[0].placements[0].width_cm, 9.0);
        for sheet in &result.sheets {
            for (i, p) in sheet.placements.iter().enumerate() {
                for q in &sheet.placements[i + 1..] {
                    assert!(
                        p.x_cm + p.width_cm + 0.3 <= q.x_cm + 1e-9
                            || q.x_cm + q.width_cm + 0.3 <= p.x_cm + 1e-9
                            || p.y_cm + p.height_cm + 0.3 <= q.y_cm + 1e-9
                            || q.y_cm + q.height_cm + 0.3 <= p.y_cm + 1e-9
                    );
                }
            }
        }
        let mut edge = request(9.0, 8.0, vec![design("edge", 9.0, 8.0, 1, false)]);
        edge.sheet.gap_cm = Some(0.30001);
        let p = &pack(&edge).unwrap().sheets[0].placements[0];
        assert_eq!(
            (p.x_cm, p.y_cm, p.width_cm, p.height_cm),
            (0.0, 0.0, 9.0, 8.0)
        );
    }

    #[test]
    fn fractional_fit_rotates_deterministically_and_rejects_invalid_metadata_gap() {
        let mut d = narrow_design(4);
        d.can_rotate = true;
        let mut r = request(2.0, 9.0, vec![d]);
        r.sheet.gap_cm = Some(0.3);
        let result = pack(&r).unwrap();
        assert!(result
            .sheets
            .iter()
            .flat_map(|s| &s.placements)
            .all(|p| p.rotated && p.width_cm == 1.4369 && p.height_cm == 9.0));
        assert_eq!(
            serde_json::to_value(&result).unwrap(),
            serde_json::to_value(pack(&r).unwrap()).unwrap()
        );
        for gap in [f64::NAN, f64::INFINITY, -0.1, f64::MAX] {
            r.sheet.gap_cm = Some(gap);
            assert!(pack(&r).is_err());
        }
        r.sheet.gap_cm = None;
        r.designs[0].original_aspect_ratio = 1.0;
        assert!(pack(&r).is_err());
    }

    #[test]
    fn seeded_fractional_fits_preserve_gap_bounds_quantities_and_order_independence() {
        for seed in 1..20 {
            let mut designs = Vec::new();
            for i in 1..12 {
                let mut d = design(&format!("{i}"), 3.0 + (i % 4) as f64, 5.0, 2, true);
                let w = (seed * 31 + i * 17) as f64;
                let h = (seed * 7 + i * 13) as f64;
                d.visible_bounds.width_px = w;
                d.visible_bounds.source_width_px = w;
                d.visible_bounds.height_px = h;
                d.visible_bounds.source_height_px = h;
                d.original_aspect_ratio = w / h;
                designs.push(d);
            }
            let mut r = request(20.0, 20.0, designs);
            r.sheet.gap_cm = Some(0.30001);
            let result = pack(&r).unwrap();
            for s in &result.sheets {
                for (i, p) in s.placements.iter().enumerate() {
                    assert!(
                        p.x_cm + p.width_cm <= s.width_cm + 1e-9
                            && p.y_cm + p.height_cm <= s.height_cm + 1e-9
                    );
                    for q in &s.placements[i + 1..] {
                        let gap = 0.3001;
                        assert!(
                            p.x_cm + p.width_cm + gap <= q.x_cm + 1e-9
                                || q.x_cm + q.width_cm + gap <= p.x_cm + 1e-9
                                || p.y_cm + p.height_cm + gap <= q.y_cm + 1e-9
                                || q.y_cm + q.height_cm + gap <= p.y_cm + 1e-9
                        );
                    }
                }
            }
            assert_eq!(
                result
                    .sheets
                    .iter()
                    .map(|s| s.placements.len())
                    .sum::<usize>(),
                22
            );
            r.designs.reverse();
            assert_eq!(
                serde_json::to_value(result).unwrap(),
                serde_json::to_value(pack(&r).unwrap()).unwrap()
            );
        }
    }

    fn assert_invariants(request: &PackingRequest, result: &PackingResult) {
        for (index, sheet) in result.sheets.iter().enumerate() {
            assert_eq!(sheet.id, format!("sheet-{}", index + 1));
            assert_eq!(sheet.width_cm, request.sheet.width_cm);
            assert_eq!(sheet.height_cm, request.sheet.height_cm);
            assert!(!sheet.placements.is_empty());
            for (i, p) in sheet.placements.iter().enumerate() {
                let d = request
                    .designs
                    .iter()
                    .find(|d| d.id == p.design_id)
                    .unwrap();
                assert!(p.x_cm >= 0.0 && p.y_cm >= 0.0);
                assert!(p.x_cm + p.width_cm <= sheet.width_cm + 1e-7);
                assert!(p.y_cm + p.height_cm <= sheet.height_cm + 1e-7);
                let expected = if p.rotated {
                    assert!(d.can_rotate);
                    (d.height_cm, d.width_cm)
                } else {
                    (d.width_cm, d.height_cm)
                };
                assert_eq!((p.width_cm, p.height_cm), expected);
                for q in &sheet.placements[i + 1..] {
                    assert!(
                        p.x_cm + p.width_cm <= q.x_cm
                            || q.x_cm + q.width_cm <= p.x_cm
                            || p.y_cm + p.height_cm <= q.y_cm
                            || q.y_cm + q.height_cm <= p.y_cm,
                        "overlap: {p:?} / {q:?}"
                    );
                }
            }
        }
        for d in &request.designs {
            let placed = result
                .sheets
                .iter()
                .flat_map(|s| &s.placements)
                .filter(|p| p.design_id == d.id)
                .count();
            let unplaced: Vec<_> = result
                .unplaced_items
                .iter()
                .filter(|p| p.design_id == d.id)
                .collect();
            assert_eq!(placed + unplaced.len(), d.quantity as usize);
            for (i, item) in unplaced.iter().enumerate() {
                assert_eq!(item.item_index, i as u32);
                assert_eq!(item.reason, UnplacedReasonCode::DoesNotFit);
            }
        }
    }

    #[test]
    fn exact_fit_and_multiple_pages_preserve_quantities() {
        let r = request(60.0, 100.0, vec![design("full", 60.0, 100.0, 3, false)]);
        let result = pack(&r).unwrap();
        assert_eq!(result.sheets.len(), 3);
        assert!(result.unplaced_items.is_empty());
        assert_invariants(&r, &result);
    }

    #[test]
    fn impossible_items_are_explicit_without_empty_sheets() {
        let r = request(60.0, 100.0, vec![design("large", 101.0, 101.0, 2, true)]);
        let result = pack(&r).unwrap();
        assert!(result.sheets.is_empty());
        assert_eq!(result.unplaced_items.len(), 2);
        assert_invariants(&r, &result);
    }

    #[test]
    fn rotation_is_per_design_and_only_swaps_dimensions() {
        let r = request(
            60.0,
            100.0,
            vec![
                design("allowed", 100.0, 60.0, 1, true),
                design("blocked", 100.0, 60.0, 1, false),
            ],
        );
        let result = pack(&r).unwrap();
        assert_eq!(result.sheets.len(), 1);
        assert!(result.sheets[0].placements[0].rotated);
        assert_eq!(result.unplaced_items[0].design_id, "blocked");
        assert_invariants(&r, &result);
    }

    #[test]
    fn split_free_rectangles_fill_a_tiled_sheet() {
        let r = request(60.0, 100.0, vec![design("tile", 20.0, 25.0, 12, false)]);
        let result = pack(&r).unwrap();
        assert_eq!(result.sheets.len(), 1);
        assert_invariants(&r, &result);
    }

    #[test]
    fn rejects_empty_mixed_zero_duplicate_and_blank_ids() {
        assert_eq!(
            pack(&request(60.0, 100.0, vec![])).unwrap_err(),
            "invalid_quantity"
        );
        let zero = request(
            60.0,
            100.0,
            vec![
                design("a", 1.0, 1.0, 1, false),
                design("b", 1.0, 1.0, 0, false),
            ],
        );
        assert_eq!(pack(&zero).unwrap_err(), "invalid_quantity");
        for ids in [["a", "a"], ["a", "  "]] {
            let r = request(
                60.0,
                100.0,
                ids.iter()
                    .map(|id| design(id, 1.0, 1.0, 1, false))
                    .collect(),
            );
            assert_eq!(pack(&r).unwrap_err(), "invalid_design_id");
        }
    }

    #[test]
    fn rejects_nonfinite_fractional_and_unsafe_dimensions() {
        for value in [
            0.0,
            -1.0,
            1.5,
            f64::NAN,
            f64::INFINITY,
            f64::NEG_INFINITY,
            u32::MAX as f64 + 1.0,
        ] {
            let good = design("a", 1.0, 1.0, 1, false);
            for r in [
                request(value, 100.0, vec![good.clone()]),
                request(60.0, value, vec![good]),
                request(60.0, 100.0, vec![design("a", value, 1.0, 1, false)]),
                request(60.0, 100.0, vec![design("a", 1.0, value, 1, false)]),
            ] {
                assert_eq!(pack(&r).unwrap_err(), "invalid_dimensions");
            }
        }
    }

    #[test]
    fn workload_limits_reject_before_quantity_expansion() {
        let r = request(60.0, 100.0, vec![design("a", 1.0, 1.0, u32::MAX, false)]);
        assert_eq!(pack(&r).unwrap_err(), super::WORKLOAD_ERROR);
        let mut budget = 0;
        assert_eq!(
            super::spend(&mut budget).unwrap_err(),
            super::WORKLOAD_ERROR
        );
        let r = request(
            u32::MAX as f64,
            u32::MAX as f64,
            vec![design("max", u32::MAX as f64, u32::MAX as f64, 1, true)],
        );
        assert_invariants(&r, &pack(&r).unwrap());
    }

    #[test]
    fn seeded_fixtures_have_no_overlaps_and_are_reorder_deterministic() {
        // Fixed LCG: reproducible property-like coverage without a new dependency.
        let mut seed = 0xD7FE_7215u64;
        for case in 0..80 {
            let mut next = || {
                seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
                seed >> 32
            };
            let w = 10 + next() % 91;
            let h = 10 + next() % 121;
            let designs = (0..16)
                .map(|i| {
                    design(
                        &format!("{case}-{i}"),
                        (1 + next() % (w + 15)) as f64,
                        (1 + next() % (h + 15)) as f64,
                        (1 + next() % 4) as u32,
                        next() % 2 == 0,
                    )
                })
                .collect();
            let mut r = request(w as f64, h as f64, designs);
            let result = pack(&r).unwrap();
            assert_invariants(&r, &result);
            let json = serde_json::to_value(&result).unwrap();
            assert_eq!(json, serde_json::to_value(pack(&r).unwrap()).unwrap());
            r.designs.reverse();
            assert_eq!(json, serde_json::to_value(pack(&r).unwrap()).unwrap());
            r.designs.rotate_left(5);
            assert_eq!(json, serde_json::to_value(pack(&r).unwrap()).unwrap());
        }
    }

    #[test]
    fn packing_request_round_trips_with_camel_case_contract() {
        let request_json = json!({
            "sheet": { "widthCm": 60.0, "heightCm": 100.0 },
            "designs": [{
                "id": "design-1",
                "name": "Logo",
                "imagePath": "C:/assets/logo.png",
                "widthCm": 12.0,
                "heightCm": 8.0,
                "format": "png",
                "visibleBounds": {
                    "xPx": 0.0,
                    "yPx": 0.0,
                    "widthPx": 120.0,
                    "heightPx": 80.0,
                    "sourceWidthPx": 120.0,
                    "sourceHeightPx": 80.0
                },
                "originalAspectRatio": 1.5,
                "quantity": 2,
                "canRotate": true
            }]
        });

        let request: PackingRequest =
            serde_json::from_value(request_json.clone()).expect("request deserializes");
        let serialized = serde_json::to_value(request).expect("request serializes");

        assert_eq!(serialized, request_json);
    }

    #[test]
    fn validation_accepts_integer_cm_and_positive_quantity_designs() {
        let request = PackingRequest {
            sheet: SheetConfig {
                gap_cm: None,
                width_cm: 60.0,
                height_cm: 100.0,
            },
            designs: vec![valid_design(1)],
        };

        assert_eq!(validate_packing_request(&request), Ok(()));
    }

    #[test]
    fn validation_rejects_decimal_zero_and_negative_dimensions() {
        let invalid_requests = [
            PackingRequest {
                sheet: SheetConfig {
                    gap_cm: None,
                    width_cm: 60.5,
                    height_cm: 100.0,
                },
                designs: vec![valid_design(1)],
            },
            PackingRequest {
                sheet: SheetConfig {
                    gap_cm: None,
                    width_cm: 0.0,
                    height_cm: 100.0,
                },
                designs: vec![valid_design(1)],
            },
            PackingRequest {
                sheet: SheetConfig {
                    gap_cm: None,
                    width_cm: 60.0,
                    height_cm: 100.0,
                },
                designs: vec![DesignInput {
                    width_cm: -1.0,
                    ..valid_design(1)
                }],
            },
        ];

        for request in invalid_requests {
            assert_eq!(
                validate_packing_request(&request),
                Err(UnplacedReasonCode::InvalidDimensions)
            );
        }
    }

    #[test]
    fn validation_rejects_requests_without_positive_quantity() {
        let request = PackingRequest {
            sheet: SheetConfig {
                gap_cm: None,
                width_cm: 60.0,
                height_cm: 100.0,
            },
            designs: vec![valid_design(0)],
        };

        assert_eq!(
            validate_packing_request(&request),
            Err(UnplacedReasonCode::InvalidQuantity)
        );
    }

    #[test]
    fn packing_result_serializes_explicit_unplaced_items() {
        let result = PackingResult {
            sheets: vec![Sheet {
                gap_cm: None,
                id: "sheet-1".to_string(),
                width_cm: 60.0,
                height_cm: 100.0,
                placements: vec![],
            }],
            unplaced_items: vec![UnplacedItem {
                design_id: "design-1".to_string(),
                item_index: 0,
                reason: UnplacedReasonCode::DoesNotFit,
            }],
        };

        let value = serde_json::to_value(result).expect("result serializes");

        assert_eq!(
            value,
            json!({
                "sheets": [{ "id": "sheet-1", "widthCm": 60.0, "heightCm": 100.0, "placements": [] }],
                "unplacedItems": [{ "designId": "design-1", "itemIndex": 0, "reason": "does_not_fit" }]
            })
        );
    }
}
