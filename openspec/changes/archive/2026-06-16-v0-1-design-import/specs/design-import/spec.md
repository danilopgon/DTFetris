# Design Import Specification

## Purpose

Define how DTFetris imports one PNG/SVG design at a time into app-owned storage, records visible-artwork geometry, and requires user-confirmed physical dimensions in centimeters.

## Requirements

### Requirement: One-at-a-time cumulative import

The system MUST import exactly one selected design per operation and MUST append a successful import to the current design list without replacing existing imports.

#### Scenario: Import appends one design

- GIVEN an existing job with imported designs
- WHEN the user completes one import operation
- THEN exactly one new design is added
- AND previously imported designs remain unchanged

#### Scenario: Batch selection is not accepted

- GIVEN the user attempts to import multiple files in one operation
- WHEN the import is submitted
- THEN the system MUST reject or prevent that operation

### Requirement: Persisted asset copy per import

The system MUST copy each accepted source file into app-owned storage and persist the copied path, not a browser `File` object or transient source reference.

#### Scenario: Accepted source is copied

- GIVEN a valid source file and confirmed dimensions
- WHEN import succeeds
- THEN the design references a path inside app-owned storage
- AND that path is suitable for later job persistence

#### Scenario: Duplicate source creates distinct copy

- GIVEN a source file was imported before
- WHEN the same source file is imported again
- THEN the system MUST create a second persisted copy with a distinct path or name
- AND MUST NOT deduplicate or reuse the prior copy

### Requirement: Visible artwork bounds

The system MUST store imported geometry from visible artwork bounds, ignoring transparent padding. Pixels MAY be used only to detect source quality, format geometry, and visible bounds.

#### Scenario: Transparent padding is ignored

- GIVEN a valid image with transparent padding around the artwork
- WHEN import succeeds
- THEN stored visible bounds describe the visible artwork area
- AND transparent padding does not determine occupied geometry

#### Scenario: No visible artwork is invalid

- GIVEN a supported file whose detected visible bounds are empty
- WHEN import is attempted
- THEN the system MUST reject the import as invalid
- AND MUST NOT add a design entry

### Requirement: User-confirmed centimeter dimensions

The system MUST require the user to confirm physical width and height in centimeters for every imported design. Pixel dimensions MUST NOT determine final physical output size.

#### Scenario: Confirmed centimeters define physical size

- GIVEN a valid source file and user-confirmed positive width and height in cm
- WHEN import succeeds
- THEN the design stores those centimeter dimensions as its physical size

#### Scenario: SVG viewBox does not invent centimeters

- GIVEN an SVG without explicit physical dimensions
- WHEN the user imports it
- THEN the system MUST keep or require user-confirmed cm dimensions
- AND MUST NOT derive cm dimensions from `viewBox` alone

### Requirement: Aspect-ratio validation remains deferred

The system MAY store source aspect metadata from visible bounds, but MUST NOT require the full deformation warning/confirmation flow in this change.

#### Scenario: Non-proportional confirmed size is accepted for now

- GIVEN a valid source file and confirmed cm dimensions that differ from source aspect ratio
- WHEN import succeeds
- THEN the design is added without deformation confirmation
- AND later validation remains scoped to `v0-2-aspect-ratio-validation`

### Requirement: Invalid file handling

The system MUST reject missing, unreadable, unsupported, malformed, or non-visible PNG/SVG imports with recoverable errors and no design-list mutation. Product UI messages for these errors MUST be Spanish.

#### Scenario: Unsupported format is rejected

- GIVEN a source file that is not PNG or SVG
- WHEN import is attempted
- THEN the system MUST reject the import
- AND MUST NOT add or persist a design entry

#### Scenario: Malformed supported file is rejected

- GIVEN a malformed PNG or SVG
- WHEN import is attempted
- THEN the system MUST return a recoverable import error
- AND any partial app-owned copy SHOULD be removed or ignored

### Requirement: Roadmap status housekeeping

Before implementation, the system documentation MUST verify and normalize `docs/sdd-roadmap-tasks.md` status for `v0-1-domain-model` using available SDD evidence, without marking it completed unless verification/archive readiness is proven or an explicit exception is documented.

#### Scenario: Ambiguous dependency status is normalized

- GIVEN `v0-1-domain-model` has artifacts but ambiguous native SDD status
- WHEN this change updates roadmap status
- THEN the roadmap reflects verified-blocked or in-progress evidence
- AND MUST NOT overclaim completion
