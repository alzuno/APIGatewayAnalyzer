import pytest
import sys
import os
import json

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app as flask_app


@pytest.fixture
def app():
    """Create application for testing."""
    flask_app.config['TESTING'] = True
    return flask_app


@pytest.fixture
def client(app):
    """Create test client."""
    return app.test_client()


@pytest.fixture
def sample_telemetry():
    """Load sample telemetry fixture."""
    fixture_path = os.path.join(
        os.path.dirname(__file__), 'fixtures', 'sample_telemetry.json'
    )
    with open(fixture_path, 'r') as f:
        return json.load(f)
