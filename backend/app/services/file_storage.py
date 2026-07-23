"""File storage abstraction: local disk by default, MinIO/S3-compatible when
configured. Replaces Convex's built-in `ctx.storage` blob API (see
convex/storage.ts) - callers only depend on this interface, never on the
concrete backend, so swapping `STORAGE_BACKEND` from "local" to "minio" (e.g.
for a multi-replica deployment where local disk isn't shared) requires no
router/service changes."""

import uuid
from abc import ABC, abstractmethod
from pathlib import Path

from app.core.config import get_settings

settings = get_settings()


class FileStorageBackend(ABC):
    @abstractmethod
    def save(self, filename: str, content: bytes, content_type: str | None = None) -> str:
        """Persist `content` and return an opaque storage key."""

    @abstractmethod
    def load(self, key: str) -> bytes: ...

    @abstractmethod
    def url(self, key: str) -> str:
        """Best-effort URL/path for direct access (used for download links)."""

    @abstractmethod
    def delete(self, key: str) -> None: ...


class LocalFileStorage(FileStorageBackend):
    def __init__(self, base_dir: str) -> None:
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _path_for(self, key: str) -> Path:
        return self.base_dir / key

    def save(self, filename: str, content: bytes, content_type: str | None = None) -> str:
        suffix = Path(filename).suffix
        key = f"{uuid.uuid4().hex}{suffix}"
        self._path_for(key).write_bytes(content)
        return key

    def load(self, key: str) -> bytes:
        return self._path_for(key).read_bytes()

    def url(self, key: str) -> str:
        return f"/api/v1/files/{key}"

    def delete(self, key: str) -> None:
        self._path_for(key).unlink(missing_ok=True)


class MinioFileStorage(FileStorageBackend):
    """Thin wrapper around the `minio` SDK. Kept separate from
    `LocalFileStorage` so installing `minio` stays optional for deployments
    that only ever use local disk (see MIGRATION.md "File storage")."""

    def __init__(self) -> None:
        from minio import Minio  # imported lazily - optional dependency

        self.bucket = settings.MINIO_BUCKET
        self.client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
        if not self.client.bucket_exists(self.bucket):
            self.client.make_bucket(self.bucket)

    def save(self, filename: str, content: bytes, content_type: str | None = None) -> str:
        import io

        suffix = Path(filename).suffix
        key = f"{uuid.uuid4().hex}{suffix}"
        self.client.put_object(
            self.bucket, key, io.BytesIO(content), length=len(content), content_type=content_type
        )
        return key

    def load(self, key: str) -> bytes:
        response = self.client.get_object(self.bucket, key)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()

    def url(self, key: str) -> str:
        return self.client.presigned_get_object(self.bucket, key)

    def delete(self, key: str) -> None:
        self.client.remove_object(self.bucket, key)


def get_file_storage() -> FileStorageBackend:
    if settings.STORAGE_BACKEND == "minio":
        return MinioFileStorage()
    return LocalFileStorage(settings.LOCAL_STORAGE_DIR)
