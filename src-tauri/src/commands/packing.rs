use crate::domain::packing::{validate_packing_request, PackingRequest, PackingResult};

#[tauri::command]
pub fn run_packing(request: PackingRequest) -> Result<PackingResult, String> {
    validate_packing_request(&request).map_err(|reason| reason.as_str().to_string())?;

    Ok(PackingResult {
        sheets: vec![],
        unplaced_items: vec![],
    })
}

#[cfg(test)]
mod tests {
    use super::run_packing;
    use crate::domain::{
        design::DesignInput,
        packing::{PackingRequest, SheetConfig},
    };

    fn valid_request() -> PackingRequest {
        PackingRequest {
            sheet: SheetConfig {
                width_cm: 55.0,
                height_cm: 100.0,
            },
            designs: vec![DesignInput {
                id: "design-1".to_string(),
                name: "Logo".to_string(),
                image_path: "C:/assets/logo.png".to_string(),
                width_cm: 12.0,
                height_cm: 8.0,
                original_aspect_ratio: 1.5,
                quantity: 1,
                can_rotate: true,
            }],
        }
    }

    #[test]
    fn run_packing_returns_placeholder_packing_result_for_valid_request() {
        let result = run_packing(valid_request()).expect("valid request succeeds");

        assert_eq!(result.sheets.len(), 0);
        assert_eq!(result.unplaced_items.len(), 0);
    }

    #[test]
    fn run_packing_rejects_invalid_request_before_placeholder_packing() {
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
