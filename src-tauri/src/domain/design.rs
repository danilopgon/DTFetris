use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesignInput {
    pub id: String,
    pub name: String,
    pub image_path: String,
    pub width_cm: f64,
    pub height_cm: f64,
    pub original_aspect_ratio: f64,
    pub quantity: u32,
    pub can_rotate: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Placement {
    pub design_id: String,
    pub x_cm: f64,
    pub y_cm: f64,
    pub width_cm: f64,
    pub height_cm: f64,
    pub rotated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Sheet {
    pub id: String,
    pub width_cm: f64,
    pub height_cm: f64,
    pub placements: Vec<Placement>,
}
