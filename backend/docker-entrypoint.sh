#!/bin/sh
set -e

echo "Waiting for database..."
python -c "
import time
from sqlalchemy import create_engine
from app.core.config import get_settings

for attempt in range(30):
    try:
        create_engine(get_settings().DATABASE_URL).connect().close()
        break
    except Exception as exc:
        print(f'  ({attempt + 1}/30) database not ready yet: {exc}')
        time.sleep(2)
else:
    raise SystemExit('Database never became available')
"

echo "Applying migrations..."
alembic upgrade head

echo "Starting API server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
