use serde::{Deserialize, Serialize};

use crate::domain::design::{DesignInput, Sheet};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SheetConfig {
    pub width_cm: f64,
    pub height_cm: f64,
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
    value.is_finite() && value.fract() == 0.0 && value > 0.0
}

pub fn validate_packing_request(request: &PackingRequest) -> Result<(), UnplacedReasonCode> {
    if !is_positive_integer_cm(request.sheet.width_cm)
        || !is_positive_integer_cm(request.sheet.height_cm)
        || request.designs.iter().any(|design| {
            !is_positive_integer_cm(design.width_cm) || !is_positive_integer_cm(design.height_cm)
        })
    {
        return Err(UnplacedReasonCode::InvalidDimensions);
    }

    if !request.designs.iter().any(|design| design.quantity > 0) {
        return Err(UnplacedReasonCode::InvalidQuantity);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        validate_packing_request, PackingRequest, PackingResult, SheetConfig, UnplacedItem,
        UnplacedReasonCode,
    };
    use crate::domain::design::{DesignInput, Sheet};
    use serde_json::json;

    fn valid_design(quantity: u32) -> DesignInput {
        DesignInput {
            id: "design-1".to_string(),
            name: "Logo".to_string(),
            image_path: "C:/assets/logo.png".to_string(),
            width_cm: 12.0,
            height_cm: 8.0,
            original_aspect_ratio: 1.5,
            quantity,
            can_rotate: true,
        }
    }

    #[test]
    fn packing_request_round_trips_with_camel_case_contract() {
        let request_json = json!({
            "sheet": { "widthCm": 55.0, "heightCm": 100.0 },
            "designs": [{
                "id": "design-1",
                "name": "Logo",
                "imagePath": "C:/assets/logo.png",
                "widthCm": 12.0,
                "heightCm": 8.0,
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
                width_cm: 55.0,
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
                    width_cm: 55.5,
                    height_cm: 100.0,
                },
                designs: vec![valid_design(1)],
            },
            PackingRequest {
                sheet: SheetConfig {
                    width_cm: 0.0,
                    height_cm: 100.0,
                },
                designs: vec![valid_design(1)],
            },
            PackingRequest {
                sheet: SheetConfig {
                    width_cm: 55.0,
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
                width_cm: 55.0,
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
                id: "sheet-1".to_string(),
                width_cm: 55.0,
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
                "sheets": [{ "id": "sheet-1", "widthCm": 55.0, "heightCm": 100.0, "placements": [] }],
                "unplacedItems": [{ "designId": "design-1", "itemIndex": 0, "reason": "does_not_fit" }]
            })
        );
    }
}
