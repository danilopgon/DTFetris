# Basic Editing Specification

## Purpose

Define user-visible editing for imported designs before real packing exists. This capability covers safe mutations, Spanish-only UI behavior, integer requested cell dimensions, and stale-layout semantics without implementing packing.

## Requirements

### Requirement: Editable Design Fields

The system MUST allow users to edit an imported design's display name, intended cell dimensions, quantity, and rotation permission. Intended cell dimensions MUST be entered and shown as whole centimeters. Product UI strings for these controls, validation messages, confirmations, and accessibility labels MUST be Spanish only.

#### Scenario: Update editable metadata

- GIVEN an imported design is shown in the design list
- WHEN the user saves a new name, quantity, or rotation permission
- THEN the design state reflects the saved values
- AND no image file is copied or re-imported

#### Scenario: Reject invalid quantity

- GIVEN the user edits a design quantity to 0 or a negative value
- WHEN the edit is validated
- THEN the edit is rejected with Spanish validation feedback
- AND the previous valid quantity remains unchanged

### Requirement: Non-Distorting Cell Dimension Editing

The system MUST treat edited width and height as the user's intended whole-centimeter bounding/grid cell. The system MUST NOT distort or stretch artwork to fill both cell dimensions. If the requested cell ratio differs from the artwork visible-bounds ratio, the artwork SHALL be fit proportionally inside the requested cell and MAY occupy less than the requested width or height.

#### Scenario: Save integer requested cell

- GIVEN an imported design is edited
- WHEN the user saves valid integer width and height values in centimeters
- THEN those values remain the design's requested cell dimensions
- AND they are not replaced by a fitted visible artwork size

#### Scenario: Fit visible artwork proportionally

- GIVEN the requested cell ratio differs from the artwork visible-bounds ratio
- WHEN preview, packing semantics, or export semantics need the visible artwork size
- THEN the effective visible size is derived by proportional fit inside the requested cell
- AND no deformation confirmation workflow is shown

#### Scenario: Reject fractional requested dimensions

- GIVEN the user enters a fractional requested width or height
- WHEN the edit is validated
- THEN the edit is rejected with Spanish validation feedback
- AND the previous requested cell dimensions remain unchanged

### Requirement: Duplicate Design

The system MUST allow users to duplicate an imported design. The duplicate MUST receive a new design id and MUST share the same `imagePath` rather than copying the asset file.

#### Scenario: Duplicate existing design

- GIVEN a design exists in the editable work state
- WHEN the user duplicates it
- THEN a second design is added with copied editable values
- AND the duplicate has a distinct id and the same image path

### Requirement: Confirmed Delete Design

The system MUST require confirmation before deleting a design. Cancelling confirmation MUST leave the design list unchanged.

#### Scenario: Confirm deletion

- GIVEN a design exists in the editable work state
- WHEN the user confirms deletion
- THEN the design is removed from the list

#### Scenario: Cancel deletion

- GIVEN a delete confirmation is shown
- WHEN the user cancels
- THEN no design is removed

### Requirement: Pending Layout Recalculation

Successful edit, duplicate, or delete mutations that can affect layout MUST invalidate existing layout output or mark it pending recalculation. This capability MUST NOT invoke a fake packing placeholder or create placements.

#### Scenario: Mark stale layout after mutation

- GIVEN layout output exists for the current designs
- WHEN a design is edited, duplicated, or deleted
- THEN the layout is no longer treated as current
- AND the state indicates recalculation is pending or stale sheets are cleared

#### Scenario: Avoid placeholder packing

- GIVEN real packing is not implemented in this change
- WHEN a design mutation succeeds
- THEN no placeholder `run_packing` call is required by this capability
- AND no generated placement is fabricated

### Requirement: Documentation Freshness

The implementation of this capability SHOULD update focused project docs that describe editing behavior, integer requested cells, visible-bounds proportional fitting, domain invariants, user flows, testing, packing footprint semantics, and roadmap status.

#### Scenario: Identify affected documents

- GIVEN this capability is implemented
- WHEN documentation is refreshed
- THEN `functional-requirements`, `domain-and-data-model`, `packing-and-export`, `user-flows`, `testing-strategy`, and roadmap status are checked for alignment
