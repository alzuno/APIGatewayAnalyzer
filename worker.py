"""Background processing worker for large file analysis."""
import os
import json
import uuid
import threading
import queue
import time
import logging
from typing import Dict, Any, Optional, Callable

logger = logging.getLogger(__name__)

# Global job queue and results store
job_queue = queue.Queue()
job_results: Dict[str, Dict[str, Any]] = {}
job_lock = threading.Lock()


class ProcessingJob:
    """Represents a background processing job."""

    def __init__(self, job_id: str, file_path: str, filename: str):
        self.job_id = job_id
        self.file_path = file_path
        self.filename = filename
        self.status = 'pending'
        self.progress = 0
        self.result = None
        self.error = None
        self.analysis_id = None


class BackgroundWorker:
    """Worker thread for processing large files in the background."""

    def __init__(self, process_func: Callable, db=None):
        """Initialize the background worker.

        Args:
            process_func: Function to process log data (process_log_data)
            db: Database instance for saving results
        """
        self.process_func = process_func
        self.db = db
        self._running = False
        self._thread = None

    def start(self):
        """Start the worker thread."""
        if self._running:
            return

        self._running = True
        self._thread = threading.Thread(target=self._worker_loop, daemon=True)
        self._thread.start()
        logger.info("Background worker started")

    def stop(self):
        """Stop the worker thread."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
        logger.info("Background worker stopped")

    def _worker_loop(self):
        """Main worker loop that processes jobs from the queue."""
        while self._running:
            try:
                # Wait for a job with timeout to allow checking _running flag
                try:
                    job = job_queue.get(timeout=1)
                except queue.Empty:
                    continue

                self._process_job(job)
                job_queue.task_done()

            except Exception as e:
                logger.error(f"Worker error: {e}")

    def _process_job(self, job: ProcessingJob):
        """Process a single job."""
        logger.info(f"Starting job {job.job_id}: {job.filename}")

        try:
            # Update job status
            self._update_job_status(job, 'processing', 10)

            # Read the file
            logs_data = []
            with open(job.file_path, 'r', encoding='utf-8') as f:
                try:
                    logs_data = json.load(f)
                except json.JSONDecodeError:
                    f.seek(0)
                    for line in f:
                        if line.strip():
                            try:
                                logs_data.append(json.loads(line))
                            except json.JSONDecodeError:
                                pass

            self._update_job_status(job, 'processing', 30)

            # Process the data
            result = self.process_func(logs_data, job.filename)

            if not result:
                raise ValueError("No valid telemetry data found")

            self._update_job_status(job, 'processing', 70)

            # Save to database
            analysis_id = str(uuid.uuid4())
            if self.db:
                self.db.save_analysis(analysis_id, result)
                logger.info(f"Saved analysis {analysis_id} to database")

            self._update_job_status(job, 'processing', 90)

            # Mark job as complete
            job.status = 'completed'
            job.progress = 100
            job.result = result
            job.analysis_id = analysis_id

            with job_lock:
                job_results[job.job_id] = {
                    'status': 'completed',
                    'progress': 100,
                    'analysis_id': analysis_id,
                    'data': result
                }

            if self.db:
                self.db.complete_job(job.job_id, analysis_id)

            logger.info(f"Completed job {job.job_id}")

        except Exception as e:
            logger.error(f"Job {job.job_id} failed: {e}")
            job.status = 'failed'
            job.error = str(e)

            with job_lock:
                job_results[job.job_id] = {
                    'status': 'failed',
                    'progress': 0,
                    'error': str(e)
                }

            if self.db:
                self.db.fail_job(job.job_id, str(e))

    def _update_job_status(self, job: ProcessingJob, status: str, progress: int):
        """Update job status in results store and database."""
        job.status = status
        job.progress = progress

        with job_lock:
            job_results[job.job_id] = {
                'status': status,
                'progress': progress
            }

        if self.db:
            self.db.update_job_progress(job.job_id, progress, status)


def submit_job(file_path: str, filename: str, db=None) -> str:
    """Submit a new processing job.

    Args:
        file_path: Path to the uploaded file
        filename: Original filename
        db: Database instance (optional)

    Returns:
        Job ID
    """
    job_id = str(uuid.uuid4())

    # Create job record in database
    if db:
        db.create_job(job_id, filename)

    # Initialize job result
    with job_lock:
        job_results[job_id] = {
            'status': 'pending',
            'progress': 0
        }

    # Create and queue the job
    job = ProcessingJob(job_id, file_path, filename)
    job_queue.put(job)

    logger.info(f"Submitted job {job_id}: {filename}")
    return job_id


def get_job_status(job_id: str, db=None) -> Optional[Dict[str, Any]]:
    """Get the status of a job.

    Args:
        job_id: The job identifier
        db: Database instance (optional)

    Returns:
        Job status dictionary or None if not found
    """
    # Check in-memory results first
    with job_lock:
        if job_id in job_results:
            return job_results[job_id].copy()

    # Check database
    if db:
        return db.get_job(job_id)

    return None


def generate_progress_events(job_id: str, db=None):
    """Generator for Server-Sent Events progress updates.

    Args:
        job_id: The job identifier
        db: Database instance (optional)

    Yields:
        SSE formatted progress events
    """
    last_progress = -1

    while True:
        status = get_job_status(job_id, db)

        if not status:
            yield f"data: {json.dumps({'error': 'Job not found'})}\n\n"
            break

        current_progress = status.get('progress', 0)

        # Only send updates when progress changes
        if current_progress != last_progress:
            yield f"data: {json.dumps(status)}\n\n"
            last_progress = current_progress

        # Check if job is complete or failed
        if status.get('status') in ('completed', 'failed'):
            break

        time.sleep(0.5)


# Threshold for background processing (10MB)
LARGE_FILE_THRESHOLD = 10 * 1024 * 1024


def should_process_async(file_size: int) -> bool:
    """Determine if a file should be processed asynchronously.

    Args:
        file_size: Size of the file in bytes

    Returns:
        True if file should be processed in background
    """
    return file_size > LARGE_FILE_THRESHOLD
