# Delta for Domain Model

## MODIFIED Requirements

### Requirement: Centimeter Domain Units

The system MUST use physical centimeters as the source of truth for sheet, design requested-cell, placement, and packing-domain dimensions. User-facing sheet dimensions and user-facing design requested-cell dimensions MUST be positive integer centimeters. Internally derived effective visible artwork dimensions MAY be fractional centimeters when produced by proportional fitting, but MUST NOT replace the user's requested-cell dimensions.
(Previously: MVP physical dimensions were required to be positive integer centimeters for sheet and design dimensions, with no distinction between requested cell and effective fitted visible artwork size.)

#### Scenario: Accept integer requested dimensions

- GIVEN a sheet dimension or design requested-cell dimension expressed as a positive integer centimeter value
- WHEN the domain input is validated for generation or packing
- THEN the dimension is accepted as a valid physical domain value

#### Scenario: Allow derived fractional visible size internally

- GIVEN a requested design cell and artwork visible bounds have different ratios
- WHEN an effective visible artwork size is derived by proportional fit
- THEN the derived visible size may be fractional centimeters
- AND the stored requested-cell dimensions remain positive integers

#### Scenario: Reject invalid user-facing dimensions

- GIVEN a user-facing sheet dimension or design requested-cell dimension is decimal, zero, or negative
- WHEN the domain input is validated for generation or packing
- THEN the input is rejected before packing begins

### Requirement: Editable Design Inputs

The system MUST model design inputs with image path, requested-cell dimensions in whole centimeters, quantity, rotation permission, and immutable artwork ratio metadata when available. Quantity MUST be at least 1 in editable work state; quantity 0 MUST NOT be used as a hide or exclude mechanism. Dimension edits MUST preserve the user's integer requested cell while fitting artwork proportionally inside that cell; the system MUST NOT automatically deform artwork.
(Previously: quantity 0 was allowed while editing, and generation or packing only required at least one design with quantity greater than 0.)

#### Scenario: Reject zero quantity while editing

- GIVEN a design edit sets quantity to 0
- WHEN the editable work state validates the design
- THEN the edit is rejected before it is saved

#### Scenario: Accept positive quantity while editing

- GIVEN a design edit sets quantity to an integer greater than or equal to 1
- WHEN the editable work state validates the design
- THEN the quantity is accepted if all other fields are valid

#### Scenario: Preserve requested cell and artwork ratio on dimension edit

- GIVEN a design has artwork ratio metadata or visible bounds
- WHEN integer requested width and height are edited
- THEN the requested-cell dimensions are saved as entered
- AND artwork is fit proportionally inside the cell without stretching

#### Scenario: Block generation with no positive quantity

- GIVEN there are no designs available for packing
- WHEN generation or packing is requested
- THEN the request is rejected before packing begins

## ADDED Requirements

### Requirement: Design Mutation Layout Invalidation

The system MUST represent design mutations in a way that can invalidate layout output without requiring packing to run. Editing, duplicating, or deleting a design MUST either clear stale sheets or mark layout recalculation as pending before any existing layout is presented as current.

#### Scenario: Invalidate current layout

- GIVEN a current layout exists
- WHEN a design edit, duplicate, or delete mutation succeeds
- THEN the previous layout is invalidated
- AND the system does not claim those sheets match the new design state

#### Scenario: Keep packing out of mutation validation

- GIVEN a design mutation is valid
- WHEN the mutation is applied
- THEN mutation success does not depend on a packing algorithm producing placements

### Requirement: Requested Cell Packing Footprint

For v0.1, packing semantics MUST treat each design's requested-cell width and height as the occupied footprint. Effective fitted visible artwork dimensions MAY inform preview/export semantics, but MUST NOT shrink or replace the occupied packing footprint unless a later packing spec explicitly changes this rule.

#### Scenario: Use requested cell as occupied footprint

- GIVEN a design has a 10 cm by 8 cm requested cell
- AND proportional fit yields 10 cm by 7.6 cm visible artwork
- WHEN packing semantics determine occupied size for v0.1
- THEN the occupied footprint is 10 cm by 8 cm
- AND the visible artwork size remains derived metadata
