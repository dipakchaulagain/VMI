"""add_os_family

Revision ID: d53f4e00a564
Revises: 8118e9a3d659
Create Date: 2026-02-06 18:40:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd53f4e00a564'
down_revision = '8118e9a3d659'
branch_labels = None
depends_on = None


def upgrade():
    # Only add the missing columns for OS Family
    op.add_column('vm_manual', sa.Column('override_os_family', sa.Boolean(), nullable=True))
    op.add_column('vm_manual', sa.Column('manual_os_family', sa.String(length=50), nullable=True))


def downgrade():
    with op.batch_alter_table('vm_manual', schema=None) as batch_op:
        batch_op.drop_column('manual_os_family')
        batch_op.drop_column('override_os_family')
