import os
import shutil
from app.core.config import settings


def clear_uploads():
    upload_dir = settings.UPLOAD_DIR

    if not os.path.exists(upload_dir):
        return

    for item in os.listdir(upload_dir):
        path = os.path.join(upload_dir, item)

        try:
            if os.path.isfile(path):
                os.remove(path)
            elif os.path.isdir(path):
                shutil.rmtree(path)
        except Exception as e:
            print(f"Failed removing {path}: {e}")



from app.db.base import (
    SessionLocal,
    DrugResult,
    PathwayResult,
    DEGResult,
    Analysis,
    Project,
    User,
    APICache
)

def reset_database():
    """
    Clear all data while preserving database schema.
    Useful for free-tier deployments with limited storage.
    """
    db = SessionLocal()

    try:
        # Delete child tables first
        db.query(DrugResult).delete(synchronize_session=False)
        db.query(PathwayResult).delete(synchronize_session=False)
        db.query(DEGResult).delete(synchronize_session=False)

        # Delete parent tables
        db.query(Analysis).delete(synchronize_session=False)
        db.query(APICache).delete(synchronize_session=False)
        db.query(Project).delete(synchronize_session=False)
        db.query(User).delete(synchronize_session=False)

        db.commit()

        print("✅ Database data cleared successfully")

    except Exception as e:
        db.rollback()
        print(f"❌ Database cleanup failed: {e}")

    finally:
        db.close()


def daily_cleanup():
    clear_uploads()
    reset_database()
