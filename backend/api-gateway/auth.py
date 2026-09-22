from dataclasses import dataclass
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from config import JWT_SECRET
from models import UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/users/login", auto_error=False)


@dataclass
class CurrentUser:
    uuid: str
    email: str
    role: UserRole
    organization_uuid: str | None


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
) -> CurrentUser:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=[
            {"field": "token", "message": "Invalid or expired authentication token."}
        ],
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_uuid: str | None = payload.get("sub")
        email: str | None = payload.get("email")
        role_str: str | None = payload.get("role")
        organization_uuid: str | None = payload.get("organization_uuid")
        if user_uuid is None or email is None or role_str is None:
            raise exc
        role = UserRole(role_str)
    except (jwt.InvalidTokenError, ValueError):
        raise exc
    return CurrentUser(
        uuid=user_uuid, email=email, role=role, organization_uuid=organization_uuid
    )


def require_role(*allowed_roles: UserRole):
    async def _guard(
        current_user: Annotated[CurrentUser, Depends(get_current_user)],
    ) -> CurrentUser:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=[
                    {
                        "field": "role",
                        "message": "Insufficient permissions for this action.",
                    }
                ],
            )
        return current_user

    return _guard


AdminUser = Annotated[CurrentUser, Depends(require_role(UserRole.admin))]
OrgAdminUser = Annotated[CurrentUser, Depends(require_role(UserRole.organization_admin))]
AdminOrOrgAdminUser = Annotated[CurrentUser, Depends(require_role(UserRole.admin, UserRole.organization_admin))]
GeneralUser = Annotated[CurrentUser, Depends(require_role(UserRole.general_user))]
AnyUser = Annotated[CurrentUser, Depends(get_current_user)]