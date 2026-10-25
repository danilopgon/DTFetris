use serde::{Deserialize, Serialize};

/// Image format of the imported design source file.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ImageFormat {
    Png,
    Svg,
}

/// Bounding box of the visible artwork within the source image.
/// All coordinates are in pixels relative to the source image top-left corner.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VisibleBounds {
    /// X coordinate of the top-left corner of the visible area (px).
    pub x_px: f64,
    /// Y coordinate of the top-left corner of the visible area (px).
    pub y_px: f64,
    /// Width of the visible area (px).
    pub width_px: f64,
    /// Height of the visible area (px).
    pub height_px: f64,
    /// Full source image width (px).
    pub source_width_px: f64,
    /// Full source image height (px).
    pub source_height_px: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesignInput {
    pub id: String,
    pub name: String,
    pub image_path: String,
    pub width_cm: f64,
    pub height_cm: f64,
    /// Source image format.
    pub format: ImageFormat,
    /// Bounding box of the visible artwork, ignoring transparent padding.
    pub visible_bounds: VisibleBounds,
    pub original_aspect_ratio: f64,
    pub quantity: u32,
    pub can_rotate: bool,
    /// Optional solid RGB replacement; source artwork and alpha remain unchanged.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color_override: Option<String>,
}

/// Parse the shared optional color contract without trimming or accepting shorthand.
pub fn parse_color_override(value: Option<&str>) -> Result<Option<[u8; 3]>, String> {
    let Some(value) = value else {
        return Ok(None);
    };
    let bytes = value.as_bytes();
    if bytes.len() != 7 || bytes[0] != b'#' || !bytes[1..].iter().all(u8::is_ascii_hexdigit) {
        return Err("El color debe tener el formato hexadecimal #RRGGBB.".into());
    }
    let mut rgb = [0; 3];
    for (index, channel) in rgb.iter_mut().enumerate() {
        *channel = u8::from_str_radix(&value[1 + index * 2..3 + index * 2], 16)
            .map_err(|_| "El color debe tener el formato hexadecimal #RRGGBB.".to_string())?;
    }
    Ok(Some(rgb))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Placement {
    pub design_id: String,
    pub x_cm: f64,
    pub y_cm: f64,
    pub width_cm: f64,
    pub height_cm: f64,
    pub rotated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Sheet {
    pub id: String,
    pub width_cm: f64,
    pub height_cm: f64,
    pub placements: Vec<Placement>,
}

#[cfg(test)]
mod tests {
    use super::{parse_color_override, DesignInput, ImageFormat, Placement, Sheet, VisibleBounds};
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

    #[test]
    fn color_override_accepts_only_exact_six_digit_hex_and_none() {
        assert_eq!(parse_color_override(None).unwrap(), None);
        assert_eq!(
            parse_color_override(Some("#aB09fF")).unwrap(),
            Some([171, 9, 255])
        );
        assert_eq!(parse_color_override(Some("#000000")).unwrap(), Some([0; 3]));
        assert_eq!(
            parse_color_override(Some("#FFFFFF")).unwrap(),
            Some([255; 3])
        );
        for invalid in [
            "",
            "red",
            "#abc",
            "123456",
            "#12345678",
            " #123456",
            "#123456\n",
            "#gg0000",
            "#１２３",
            "#é0000",
        ] {
            assert!(parse_color_override(Some(invalid)).is_err(), "{invalid:?}");
        }
    }

    #[test]
    fn old_design_json_defaults_to_none_and_clear_omits_override() {
        let old = json!({
            "id": "d", "name": "Logo", "imagePath": "logo.png",
            "widthCm": 12, "heightCm": 8, "format": "png",
            "visibleBounds": sample_visible_bounds(), "originalAspectRatio": 1.5,
            "quantity": 1, "canRotate": true
        });
        let mut design: DesignInput = serde_json::from_value(old.clone()).unwrap();
        assert!(design.color_override.is_none());
        design.color_override = Some("#12abEF".into());
        assert_eq!(
            serde_json::to_value(&design).unwrap()["colorOverride"],
            "#12abEF"
        );
        design.color_override = None;
        assert!(serde_json::to_value(&design)
            .unwrap()
            .get("colorOverride")
            .is_none());
    }

    #[test]
    fn design_input_serializes_with_camel_case_json_keys() {
        let design = DesignInput {
            id: "design-1".to_string(),
            name: "Logo".to_string(),
            image_path: "C:/assets/logo.png".to_string(),
            width_cm: 12.0,
            height_cm: 8.0,
            format: ImageFormat::Png,
            visible_bounds: sample_visible_bounds(),
            original_aspect_ratio: 1.5,
            quantity: 2,
            can_rotate: true,
            color_override: None,
        };

        let value = serde_json::to_value(design).expect("design serializes");

        assert_eq!(
            value,
            json!({
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
            })
        );
    }

    #[test]
    fn sheet_deserializes_from_camel_case_json_keys() {
        let value = json!({
            "id": "sheet-1",
            "widthCm": 55.0,
            "heightCm": 100.0,
            "placements": [{
                "designId": "design-1",
                "xCm": 1.0,
                "yCm": 2.0,
                "widthCm": 12.0,
                "heightCm": 8.0,
                "rotated": false
            }]
        });

        let sheet: Sheet = serde_json::from_value(value).expect("sheet deserializes");

        assert_eq!(sheet.id, "sheet-1");
        assert_eq!(sheet.width_cm, 55.0);
        assert_eq!(sheet.height_cm, 100.0);
        assert_eq!(sheet.placements.len(), 1);

        let placement: &Placement = &sheet.placements[0];
        assert_eq!(placement.design_id, "design-1");
        assert_eq!(placement.x_cm, 1.0);
        assert_eq!(placement.y_cm, 2.0);
        assert_eq!(placement.width_cm, 12.0);
        assert_eq!(placement.height_cm, 8.0);
        assert!(!placement.rotated);
    }
}
