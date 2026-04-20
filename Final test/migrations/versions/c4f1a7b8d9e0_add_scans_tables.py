"""add scans tables

Revision ID: c4f1a7b8d9e0
Revises: 7b3d2c3e4f5g
Create Date: 2026-04-17 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c4f1a7b8d9e0"
down_revision = "7b3d2c3e4f5g"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "scan_jobs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("scan_name", sa.String(length=255), nullable=False),
        sa.Column("target", sa.String(length=512), nullable=False),
        sa.Column("target_type", sa.String(length=32), nullable=True),
        sa.Column("scan_profile", sa.String(length=64), nullable=False),
        sa.Column("planner_engine", sa.String(length=16), nullable=False),
        sa.Column("orchestration_mode", sa.String(length=16), nullable=False),
        sa.Column("max_parallel", sa.Integer(), nullable=False),
        sa.Column("retries", sa.Integer(), nullable=False),
        sa.Column("backoff", sa.Integer(), nullable=False),
        sa.Column("timeout", sa.Integer(), nullable=False),
        sa.Column("max_steps", sa.Integer(), nullable=False),
        sa.Column("only_tools", sa.JSON(), nullable=True),
        sa.Column("authorization_ack", sa.Boolean(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "QUEUED",
                "RUNNING",
                "CANCELLING",
                "CANCELLED",
                "COMPLETED",
                "FAILED",
                name="scanstatus",
            ),
            nullable=False,
        ),
        sa.Column("progress", sa.Integer(), nullable=False),
        sa.Column("artifacts_dir", sa.String(length=1024), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("scan_summary", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_scan_jobs_id"), "scan_jobs", ["id"], unique=False)
    op.create_index(op.f("ix_scan_jobs_status"), "scan_jobs", ["status"], unique=False)
    op.create_index(op.f("ix_scan_jobs_user_id"), "scan_jobs", ["user_id"], unique=False)

    op.create_table(
        "scan_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("scan_job_id", sa.Integer(), nullable=False),
        sa.Column("step", sa.Integer(), nullable=False),
        sa.Column("tool", sa.String(length=128), nullable=False),
        sa.Column("command", sa.Text(), nullable=False),
        sa.Column("command_source", sa.String(length=16), nullable=False),
        sa.Column("primary_command", sa.Text(), nullable=False),
        sa.Column("fallback_used", sa.Boolean(), nullable=False),
        sa.Column("mode", sa.String(length=16), nullable=False),
        sa.Column("batch", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("output_summary", sa.Text(), nullable=True),
        sa.Column("stdout", sa.Text(), nullable=True),
        sa.Column("stderr", sa.Text(), nullable=True),
        sa.Column("errors", sa.Text(), nullable=True),
        sa.Column("return_code", sa.Integer(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["scan_job_id"], ["scan_jobs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_scan_logs_id"), "scan_logs", ["id"], unique=False)
    op.create_index(op.f("ix_scan_logs_scan_job_id"), "scan_logs", ["scan_job_id"], unique=False)

    op.create_table(
        "scan_artifacts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("scan_job_id", sa.Integer(), nullable=False),
        sa.Column("artifact_key", sa.String(length=128), nullable=False),
        sa.Column("artifact_type", sa.String(length=32), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_path", sa.String(length=1024), nullable=False),
        sa.Column("content_type", sa.String(length=128), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["scan_job_id"], ["scan_jobs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_scan_artifacts_artifact_key"), "scan_artifacts", ["artifact_key"], unique=False)
    op.create_index(op.f("ix_scan_artifacts_id"), "scan_artifacts", ["id"], unique=False)
    op.create_index(op.f("ix_scan_artifacts_scan_job_id"), "scan_artifacts", ["scan_job_id"], unique=False)

    op.create_table(
        "scan_findings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("scan_job_id", sa.Integer(), nullable=False),
        sa.Column("finding_id", sa.String(length=64), nullable=False),
        sa.Column("asset", sa.String(length=512), nullable=False),
        sa.Column("source_tool", sa.String(length=128), nullable=False),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("evidence", sa.JSON(), nullable=True),
        sa.Column("finding_timestamp", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["scan_job_id"], ["scan_jobs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_scan_findings_finding_id"), "scan_findings", ["finding_id"], unique=False)
    op.create_index(op.f("ix_scan_findings_id"), "scan_findings", ["id"], unique=False)
    op.create_index(op.f("ix_scan_findings_scan_job_id"), "scan_findings", ["scan_job_id"], unique=False)
    op.create_index(op.f("ix_scan_findings_severity"), "scan_findings", ["severity"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_scan_findings_severity"), table_name="scan_findings")
    op.drop_index(op.f("ix_scan_findings_scan_job_id"), table_name="scan_findings")
    op.drop_index(op.f("ix_scan_findings_id"), table_name="scan_findings")
    op.drop_index(op.f("ix_scan_findings_finding_id"), table_name="scan_findings")
    op.drop_table("scan_findings")

    op.drop_index(op.f("ix_scan_artifacts_scan_job_id"), table_name="scan_artifacts")
    op.drop_index(op.f("ix_scan_artifacts_id"), table_name="scan_artifacts")
    op.drop_index(op.f("ix_scan_artifacts_artifact_key"), table_name="scan_artifacts")
    op.drop_table("scan_artifacts")

    op.drop_index(op.f("ix_scan_logs_scan_job_id"), table_name="scan_logs")
    op.drop_index(op.f("ix_scan_logs_id"), table_name="scan_logs")
    op.drop_table("scan_logs")

    op.drop_index(op.f("ix_scan_jobs_user_id"), table_name="scan_jobs")
    op.drop_index(op.f("ix_scan_jobs_status"), table_name="scan_jobs")
    op.drop_index(op.f("ix_scan_jobs_id"), table_name="scan_jobs")
    op.drop_table("scan_jobs")
