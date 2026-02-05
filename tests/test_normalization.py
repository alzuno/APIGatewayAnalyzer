"""Tests for event type normalization."""
import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import normalize_event_type


class TestNormalizeEventType:
    """Test cases for normalize_event_type function."""

    def test_none_input(self):
        """Should return None for None input."""
        assert normalize_event_type(None) is None

    def test_empty_string(self):
        """Should return None for empty string."""
        assert normalize_event_type('') is None

    def test_numeric_ignition_on(self):
        """Should map numeric 6 to Ignition On."""
        assert normalize_event_type(6) == 'Ignition On'

    def test_numeric_ignition_off(self):
        """Should map numeric 7 to Ignition Off."""
        assert normalize_event_type(7) == 'Ignition Off'

    def test_string_6_ignition_on(self):
        """Should map string '6' to Ignition On."""
        assert normalize_event_type('6') == 'Ignition On'

    def test_string_7_ignition_off(self):
        """Should map string '7' to Ignition Off."""
        assert normalize_event_type('7') == 'Ignition Off'

    def test_harsh_breaking_numeric(self):
        """Should map numeric 16 to Harsh Breaking."""
        assert normalize_event_type(16) == 'Harsh Breaking'

    def test_harsh_breaking_string(self):
        """Should map string '16' to Harsh Breaking."""
        assert normalize_event_type('16') == 'Harsh Breaking'

    def test_harsh_braking_variants(self):
        """Should normalize various harsh braking strings."""
        assert normalize_event_type('braking_harsh') == 'Harsh Breaking'
        assert normalize_event_type('harsh_braking') == 'Harsh Breaking'
        assert normalize_event_type('harshbraking') == 'Harsh Breaking'

    def test_harsh_acceleration_numeric(self):
        """Should map numeric 17 to Harsh Acceleration."""
        assert normalize_event_type(17) == 'Harsh Acceleration'

    def test_harsh_acceleration_variants(self):
        """Should normalize various harsh acceleration strings."""
        assert normalize_event_type('acceleration_harsh') == 'Harsh Acceleration'
        assert normalize_event_type('harsh_acceleration') == 'Harsh Acceleration'
        assert normalize_event_type('harshacceleration') == 'Harsh Acceleration'

    def test_harsh_turn_numeric(self):
        """Should map numeric 18 to Harsh Turn."""
        assert normalize_event_type(18) == 'Harsh Turn'

    def test_harsh_turn_variants(self):
        """Should normalize various harsh turn strings."""
        assert normalize_event_type('cornering_harsh') == 'Harsh Turn'
        assert normalize_event_type('harsh_turn') == 'Harsh Turn'
        assert normalize_event_type('harshturn') == 'Harsh Turn'

    def test_sos_numeric(self):
        """Should map numeric 1 to SOS."""
        assert normalize_event_type(1) == 'SOS'

    def test_sos_variants(self):
        """Should normalize various SOS strings."""
        assert normalize_event_type('sos') == 'SOS'
        assert normalize_event_type('SOS') == 'SOS'
        assert normalize_event_type('panic') == 'SOS'

    def test_case_insensitive(self):
        """Should handle case insensitive matching."""
        assert normalize_event_type('IGNITION_ON') == 'Ignition On'
        assert normalize_event_type('Ignition_Off') == 'Ignition Off'

    def test_unknown_type_passthrough(self):
        """Should return original string for unknown types."""
        assert normalize_event_type('unknown_event') == 'unknown_event'
        assert normalize_event_type(999) == '999'
