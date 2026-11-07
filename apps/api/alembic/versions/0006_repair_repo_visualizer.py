"""repair repo visualizer tables

Revision ID: 0006
Revises: 0005

An earlier version of 0005 (commit-history visualizer) reached some databases.
This migration brings any database to the current shape, whichever 0005 it ran:
it drops the old commit-history tables, adds the missing column, creates the
analysis table, and marks repos without an analysis for re-sync. On a database
that already has the current shape it changes nothing.
"""

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP TABLE IF EXISTS repo_commits, repo_tags, repo_branches CASCADE")
    op.execute("ALTER TABLE repos ADD COLUMN IF NOT EXISTS commit_sha VARCHAR(40)")
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS repo_analyses (
            repo_id UUID PRIMARY KEY REFERENCES repos(id) ON DELETE CASCADE,
            commit_sha VARCHAR(40) NOT NULL,
            data JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        """
        UPDATE repos SET sync_status = 'failed', sync_error = 'Please analyze again.'
        WHERE sync_status = 'ok' AND id NOT IN (SELECT repo_id FROM repo_analyses)
        """
    )


def downgrade() -> None:
    pass  # repair only; 0005's downgrade removes the tables
