"""Mirrors convex/schema.ts instrument-related tables
(see convex/instruments.ts, convex/instrumentIntegration.ts)."""

import uuid

from sqlalchemy import Boolean, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import LimsBase


class Instrument(LimsBase):
    __tablename__ = "instruments"

    instrument_code: Mapped[str] = mapped_column(String(64), index=True)
    name: Mapped[str] = mapped_column(String(255))
    type: Mapped[str | None] = mapped_column(String(64))
    manufacturer: Mapped[str | None] = mapped_column(String(255))
    model: Mapped[str | None] = mapped_column(String(255))
    serial_number: Mapped[str | None] = mapped_column(String(128))
    asset_number: Mapped[str | None] = mapped_column(String(128))
    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    department_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("departments.id"))
    location: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(32), default="active")
    purchase_date: Mapped[str | None] = mapped_column(String(32))
    warranty_expiry: Mapped[str | None] = mapped_column(String(32))
    calibration_interval_days: Mapped[int | None] = mapped_column(Integer)
    last_calibration_date: Mapped[str | None] = mapped_column(String(32))
    next_calibration_due: Mapped[str | None] = mapped_column(String(32))
    linked_method_ids: Mapped[list | None] = mapped_column(JSON)
    notes: Mapped[str | None] = mapped_column(String(2000))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class InstrumentCalibration(LimsBase):
    __tablename__ = "instrument_calibrations"

    instrument_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("instruments.id"), index=True)
    calibration_type: Mapped[str | None] = mapped_column(String(32))
    scheduled_date: Mapped[str] = mapped_column(String(32), index=True)
    completed_date: Mapped[str | None] = mapped_column(String(32))
    result: Mapped[str | None] = mapped_column(String(16))
    certificate_number: Mapped[str | None] = mapped_column(String(128))
    performed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    external_provider: Mapped[str | None] = mapped_column(String(255))
    next_due_date: Mapped[str | None] = mapped_column(String(32))
    notes: Mapped[str | None] = mapped_column(String(2000))
    attachment_url: Mapped[str | None] = mapped_column(String(1024))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class InstrumentMaintenance(LimsBase):
    __tablename__ = "instrument_maintenance"

    instrument_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("instruments.id"), index=True)
    maintenance_type: Mapped[str] = mapped_column(String(16))
    description: Mapped[str] = mapped_column(String(2000))
    performed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    external_provider: Mapped[str | None] = mapped_column(String(255))
    maintenance_date: Mapped[str] = mapped_column(String(32))
    completed_date: Mapped[str | None] = mapped_column(String(32))
    outcome: Mapped[str | None] = mapped_column(String(16))
    cost: Mapped[float | None] = mapped_column(Float)
    notes: Mapped[str | None] = mapped_column(String(2000))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class InstrumentInterface(LimsBase):
    __tablename__ = "instrument_interfaces"

    instrument_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("instruments.id"), index=True)
    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    interface_name: Mapped[str] = mapped_column(String(255))
    file_format: Mapped[str] = mapped_column(String(8))  # csv | tsv | txt
    delimiter: Mapped[str | None] = mapped_column(String(8))
    has_header_row: Mapped[bool] = mapped_column(Boolean, default=True)
    header_row_index: Mapped[int | None] = mapped_column(Integer)
    data_start_row: Mapped[int | None] = mapped_column(Integer)
    use_named_columns: Mapped[bool | None] = mapped_column(Boolean)
    col_lims_number: Mapped[int | None] = mapped_column(Integer)
    col_test_code: Mapped[int | None] = mapped_column(Integer)
    col_result: Mapped[int | None] = mapped_column(Integer)
    col_unit: Mapped[int | None] = mapped_column(Integer)
    col_flags: Mapped[int | None] = mapped_column(Integer)
    col_analysis_date: Mapped[int | None] = mapped_column(Integer)
    col_operator: Mapped[int | None] = mapped_column(Integer)
    col_name_lims_number: Mapped[str | None] = mapped_column(String(128))
    col_name_test_code: Mapped[str | None] = mapped_column(String(128))
    col_name_result: Mapped[str | None] = mapped_column(String(128))
    col_name_unit: Mapped[str | None] = mapped_column(String(128))
    col_name_flags: Mapped[str | None] = mapped_column(String(128))
    notes: Mapped[str | None] = mapped_column(String(2000))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class InstrumentResultBatch(LimsBase):
    __tablename__ = "instrument_result_batches"

    instrument_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("instruments.id"), index=True)
    interface_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("instrument_interfaces.id"))
    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    file_name: Mapped[str] = mapped_column(String(255))
    uploaded_at: Mapped[str] = mapped_column(String(32))
    uploaded_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(16), default="pending")
    total_rows: Mapped[int] = mapped_column(Integer, default=0)
    matched_rows: Mapped[int] = mapped_column(Integer, default=0)
    unmatched_rows: Mapped[int] = mapped_column(Integer, default=0)
    imported_rows: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str | None] = mapped_column(String(2000))


class InstrumentResultRow(LimsBase):
    __tablename__ = "instrument_result_rows"

    batch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("instrument_result_batches.id"), index=True)
    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"), index=True)
    raw_data: Mapped[str] = mapped_column(String(4000))
    lims_number: Mapped[str | None] = mapped_column(String(64))
    test_code: Mapped[str | None] = mapped_column(String(64))
    result: Mapped[str | None] = mapped_column(String(255))
    unit: Mapped[str | None] = mapped_column(String(32))
    flags: Mapped[str | None] = mapped_column(String(255))
    analysis_date: Mapped[str | None] = mapped_column(String(32))
    operator: Mapped[str | None] = mapped_column(String(255))
    match_status: Mapped[str] = mapped_column(String(16), default="unmatched")
    sample_test_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("sample_tests.id"))
    imported_at: Mapped[str | None] = mapped_column(String(32))


class InstrumentQcResult(LimsBase):
    __tablename__ = "instrument_qc_results"

    instrument_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("instruments.id"), index=True)
    laboratory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("laboratories.id"))
    analyte: Mapped[str] = mapped_column(String(128), index=True)
    control_level: Mapped[str] = mapped_column(String(32))
    control_lot_number: Mapped[str | None] = mapped_column(String(128))
    target_mean: Mapped[float] = mapped_column(Float)
    target_sd: Mapped[float] = mapped_column(Float)
    measured_value: Mapped[float] = mapped_column(Float)
    run_date: Mapped[str] = mapped_column(String(32))
    run_number: Mapped[int | None] = mapped_column(Integer)
    operator_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    westgard_violations: Mapped[list | None] = mapped_column(JSON)
    accepted: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(String(2000))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
