"""Create or activate the initial LIMS administrator for a Microsoft Entra identity."""

import argparse
import asyncio

from sqlalchemy import select

from app.database import SessionLocal
from app.models import LimsRole, User


async def bootstrap_admin(object_id: str, email: str, name: str) -> None:
    async with SessionLocal() as session:
        user = await session.scalar(select(User).where(User.entra_object_id == object_id))
        if user is None:
            user = User(
                entra_object_id=object_id,
                email=email,
                name=name,
                role=LimsRole.SYSTEM_ADMIN,
                is_active=True,
                is_disabled=False,
            )
            session.add(user)
        else:
            user.email = email
            user.name = name
            user.role = LimsRole.SYSTEM_ADMIN
            user.is_active = True
            user.is_disabled = False
            user.is_archived = False
        await session.commit()
    print(f"Administrator enabled for {email} ({object_id})")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--object-id",
        required=True,
        help="Microsoft Entra user's Object ID (oid claim)",
    )
    parser.add_argument("--email", required=True, help="Administrator email address")
    parser.add_argument("--name", required=True, help="Administrator display name")
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_args()
    asyncio.run(bootstrap_admin(arguments.object_id, arguments.email, arguments.name))
