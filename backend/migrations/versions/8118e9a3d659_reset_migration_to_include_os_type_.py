"""Reset migration to include os_type override

Revision ID: 8118e9a3d659
Revises: 
Create Date: 2026-02-06 18:18:55.377465

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8118e9a3d659'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Only add the missing columns
    op.add_column('vm_manual', sa.Column('override_os_type', sa.Boolean(), nullable=True))
    op.add_column('vm_manual', sa.Column('manual_os_type', sa.String(length=100), nullable=True))


def downgrade():
    with op.batch_alter_table('vm_manual', schema=None) as batch_op:
        batch_op.drop_column('manual_os_type')
        batch_op.drop_column('override_os_type')
