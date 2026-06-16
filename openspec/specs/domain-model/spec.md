# Domain Model Specification

## Purpose

Define the v0.1 DTFetris domain contract for configurable DTF sheets, design inputs, centimeter-based layout data, packing request/result shapes, and validation boundaries. This spec defines WHAT the domain must represent; packing algorithms, import/export behavior, persistence, and UI implementation are out of scope.

## Requirements

### Requirement: Centimeter Domain Units

The system MUST use physical centimeters as the source of truth for sheet, design, placement, and packing-domain dimensions. MVP physical dimensions MUST be positive integer centimeters.

#### Scenario: Accept integer physical dimensions

- GIVEN a sheet or design dimension expressed as a positive integer centimeter value
- WHEN the domain input is validated for generation or packing
- THEN the dimension is accepted as a valid physical domain value

#### Scenario: Reject non-integer or non-positive dimensions

- GIVEN a sheet or design dimension that is decimal, zero, or negative
- WHEN the domain input is validated for generation or packing
- THEN the input is rejected before packing begins

### Requirement: Configurable Sheet Model

The system MUST model sheet configuration with configurable width and height in centimeters. The application MAY initialize new work with a default sheet size of 55 cm width by 100 cm height, but the domain MUST NOT treat that size as a hardcoded invariant.

#### Scenario: Initialize default sheet configuration

- GIVEN a new editable work state with no user-selected sheet size
- WHEN the application creates the initial sheet configuration
- THEN the width is 55 cm and the height is 100 cm

#### Scenario: Use a custom sheet configuration

- GIVEN a valid sheet configuration different from 55 cm by 100 cm
- WHEN a packing request is prepared
- THEN the request uses the configured sheet dimensions

### Requirement: Editable Design Inputs

The system MUST model design inputs with image path, physical dimensions in centimeters, quantity, rotation permission, and immutable original aspect-ratio metadata when available. Quantity MAY be 0 while editing, but generation or packing MUST require at least one design with quantity greater than 0.

#### Scenario: Allow zero quantity while editing

- GIVEN a design with quantity 0 and otherwise valid editable fields
- WHEN the design is saved in the editable work state
- THEN the design remains valid for editing

#### Scenario: Block generation with no positive quantity

- GIVEN all designs have quantity 0 or there are no designs
- WHEN generation or packing is requested
- THEN the request is rejected before packing begins

### Requirement: Packing Request Contract

The system MUST represent a packing request as sheet configuration plus design inputs, all in centimeter-domain units. The packing-domain contract MUST NOT require or accept pixel units.

#### Scenario: Build request from valid domain data

- GIVEN valid sheet configuration and at least one design with positive quantity
- WHEN a packing request is created
- THEN it contains sheet dimensions and design dimensions in centimeters only

#### Scenario: Keep pixel conversion outside the domain

- GIVEN preview or export needs pixel measurements
- WHEN conversion from centimeters to pixels is needed
- THEN conversion occurs at the preview/export boundary, not inside the pure domain model

### Requirement: Packing Result Contract

The system MUST represent packing output with explicit placed sheets/items and explicit unplaced items. Placement coordinates and dimensions MUST remain in centimeters. Unplaced items MUST be preserved for later multipage handling.

#### Scenario: Return placed items

- GIVEN a packing operation can place one or more requested design items
- WHEN the packing result is produced
- THEN placed items include sheet identity, design identity, position, dimensions, and rotation state in centimeters

#### Scenario: Return unplaced items

- GIVEN one or more requested design items cannot be placed on the available sheet model
- WHEN the packing result is produced
- THEN those items are listed explicitly as unplaced instead of being dropped

### Requirement: Cross-Language Contract Parity

The system SHALL keep TypeScript and Rust domain contracts aligned for JSON command payloads and responses. Serialization SHOULD preserve frontend camelCase JSON keys while allowing Rust snake_case field names internally.

#### Scenario: Round-trip command payloads

- GIVEN a valid packing request JSON payload from the frontend
- WHEN the backend deserializes and serializes the domain contract
- THEN the resulting JSON matches the expected shared contract shape
