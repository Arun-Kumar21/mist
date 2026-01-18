from celery import Celery
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# Add server directory to path
sys.path.insert(0, str(Path(__file__).parent))

if sys.version_info >= (3, 13):
    import threading
    if not hasattr(threading, '_register_atexit'):
        threading._register_atexit = lambda func: None

REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')

celery_app = Celery(
    'mist_audio_processor',
    broker=REDIS_URL,
    backend=REDIS_URL
)

# Config
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=50,
    broker_connection_retry_on_startup=True,
    task_always_eager=False,
)

#from tasks.audio_processing import process_audio_task
