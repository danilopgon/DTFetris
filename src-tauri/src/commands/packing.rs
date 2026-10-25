use crate::domain::packing::{pack, PackingRequest, PackingResult};

#[tauri::command(async)]
pub fn run_packing(request: PackingRequest) -> Result<PackingResult, String> {
    pack(&request)
}

#[cfg(test)]
mod tests {
    use super::run_packing;
    use crate::domain::{
        design::{DesignInput, ImageFormat, VisibleBounds},
        packing::{PackingRequest, SheetConfig},
    };

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

    fn valid_request() -> PackingRequest {
        PackingRequest {
            sheet: SheetConfig {
                width_cm: 60.0,
                height_cm: 100.0,
            },
            designs: vec![DesignInput {
                id: "design-1".to_string(),
                name: "Logo".to_string(),
                image_path: "C:/assets/logo.png".to_string(),
                width_cm: 12.0,
                height_cm: 8.0,
                format: ImageFormat::Png,
                visible_bounds: sample_visible_bounds(),
                original_aspect_ratio: 1.5,
                quantity: 1,
                can_rotate: true,
            }],
        }
    }

    #[test]
    fn run_packing_returns_real_placements_for_valid_request() {
        let result = run_packing(valid_request()).expect("valid request succeeds");

        assert_eq!(result.sheets.len(), 1);
        assert_eq!(result.sheets[0].placements.len(), 1);
        assert_eq!(result.sheets[0].placements[0].design_id, "design-1");
        assert_eq!(result.unplaced_items.len(), 0);
    }

    #[test]
    fn run_packing_rejects_invalid_request() {
        let request = PackingRequest {
            sheet: SheetConfig {
                width_cm: 0.0,
                height_cm: 100.0,
            },
            ..valid_request()
        };

        let error = run_packing(request).expect_err("invalid request fails");

        assert_eq!(error, "invalid_dimensions");
    }
}
