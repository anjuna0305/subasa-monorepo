import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect


def table_exists(table_name: str) -> bool:
    conn = op.get_bind()
    inspector = inspect(conn)
    return table_name in inspector.get_table_names()


def column_exists(table_name: str, column_name: str) -> bool:
    if not table_exists(table_name):
        return False
    conn = op.get_bind()
    inspector = inspect(conn)
    return column_name in [c["name"] for c in inspector.get_columns(table_name)]


def column_is_nullable(table_name: str, column_name: str) -> bool | None:
    if not column_exists(table_name, column_name):
        return None
    conn = op.get_bind()
    inspector = inspect(conn)
    for c in inspector.get_columns(table_name):
        if c["name"] == column_name:
            return c["nullable"]
    return None


def foreign_key_exists(table_name: str, fk_name: str) -> bool:
    if not table_exists(table_name):
        return False
    conn = op.get_bind()
    inspector = inspect(conn)
    return fk_name in [fk["name"] for fk in inspector.get_foreign_keys(table_name)]


def get_foreign_keys(table_name: str) -> list[dict]:
    if not table_exists(table_name):
        return []
    conn = op.get_bind()
    inspector = inspect(conn)
    return inspector.get_foreign_keys(table_name)


def unique_constraint_exists(table_name: str, column_names: list[str]) -> bool:
    if not table_exists(table_name):
        return False
    conn = op.get_bind()
    inspector = inspect(conn)
    for uc in inspector.get_unique_constraints(table_name):
        if set(uc["column_names"]) == set(column_names):
            return True
    return False


def constraint_exists(table_name: str, constraint_name: str) -> bool:
    if not table_exists(table_name):
        return False
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT COUNT(*) FROM information_schema.table_constraints "
            "WHERE table_schema = DATABASE() "
            "AND table_name = :table AND constraint_name = :name"
        ),
        {"table": table_name, "name": constraint_name},
    )
    return result.scalar() > 0


def enum_values(table_name: str, column_name: str) -> list[str]:
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT COLUMN_TYPE FROM information_schema.columns "
            "WHERE table_schema = DATABASE() "
            "AND table_name = :table AND column_name = :col"
        ),
        {"table": table_name, "col": column_name},
    )
    col_type = result.scalar()
    if col_type and isinstance(col_type, str) and col_type.startswith("enum("):
        return [
            v.strip().strip("'")
            for v in col_type[5:-1].split(",")
        ]
    return []


def safe_add_column(table_name: str, column: sa.Column) -> None:
    if not column_exists(table_name, column.name):
        op.add_column(table_name, column)


def safe_drop_column(table_name: str, column_name: str) -> None:
    if column_exists(table_name, column_name):
        op.drop_column(table_name, column_name)


def safe_create_table(table_name: str, *columns: sa.Column, **kw) -> None:
    if not table_exists(table_name):
        op.create_table(table_name, *columns, **kw)


def safe_drop_table(table_name: str) -> None:
    if table_exists(table_name):
        op.drop_table(table_name)


def safe_create_foreign_key(
    constraint_name: str | None,
    source_table: str,
    referent_table: str,
    local_cols: list[str],
    remote_cols: list[str],
) -> None:
    if constraint_name and foreign_key_exists(source_table, constraint_name):
        return
    conn = op.get_bind()
    inspector = inspect(conn)
    for fk in inspector.get_foreign_keys(source_table):
        if (
            set(fk["constrained_columns"]) == set(local_cols)
            and fk["referred_table"] == referent_table
            and set(fk["referred_columns"]) == set(remote_cols)
        ):
            return
    op.create_foreign_key(
        constraint_name, source_table, referent_table, local_cols, remote_cols
    )


def safe_drop_foreign_key(table_name: str, fk_name: str) -> None:
    if foreign_key_exists(table_name, fk_name):
        op.drop_constraint(fk_name, table_name, type_="foreignkey")


def safe_drop_foreign_keys_on_columns(table_name: str, column_names: list[str]) -> None:
    fks = get_foreign_keys(table_name)
    for fk in fks:
        if set(fk["constrained_columns"]) & set(column_names):
            op.drop_constraint(fk["name"], table_name, type_="foreignkey")


def safe_create_unique_constraint(
    constraint_name: str | None,
    table_name: str,
    column_names: list[str],
) -> None:
    if unique_constraint_exists(table_name, column_names):
        return
    op.create_unique_constraint(constraint_name, table_name, column_names)


def safe_drop_unique_constraint(table_name: str, column_names: list[str]) -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    for uc in inspector.get_unique_constraints(table_name):
        if set(uc["column_names"]) == set(column_names):
            op.drop_constraint(uc["name"], table_name, type_="unique")
            return


def safe_alter_column_nullable(
    table_name: str,
    column_name: str,
    nullable: bool,
    existing_type=None,
    server_default=None,
) -> None:
    if not column_exists(table_name, column_name):
        return
    current = column_is_nullable(table_name, column_name)
    if current == nullable:
        return
    kwargs: dict = {
        "existing_type": existing_type,
        "nullable": nullable,
    }
    if server_default is not None:
        kwargs["server_default"] = server_default
    op.alter_column(table_name, column_name, **kwargs)


def safe_alter_enum(
    table_name: str,
    column_name: str,
    new_values: list[str],
    existing_values: list[str],
) -> None:
    current = enum_values(table_name, column_name)
    if not current:
        return
    if set(new_values).issubset(set(current)):
        return
    all_values = list(dict.fromkeys(existing_values + new_values))
    op.execute(
        f"ALTER TABLE {table_name} MODIFY COLUMN {column_name} "
        f"ENUM({','.join(repr(v) for v in all_values)}) NOT NULL"
    )
