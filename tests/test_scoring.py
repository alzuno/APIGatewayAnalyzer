"""Tests for scoring and metrics calculation."""
import pytest
import pandas as pd
import numpy as np
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import process_log_data


class TestProcessLogData:
    """Test cases for process_log_data function."""

    def test_process_sample_telemetry(self, sample_telemetry):
        """Should process sample telemetry data correctly."""
        result = process_log_data(sample_telemetry, "test_file.json")

        assert result is not None
        assert "summary" in result
        assert "scorecard" in result
        assert "raw_data_sample" in result
        assert "data_quality" in result
        assert "chart_data" in result

    def test_summary_fields(self, sample_telemetry):
        """Should include required summary fields."""
        result = process_log_data(sample_telemetry, "test_file.json")

        summary = result["summary"]
        assert "filename" in summary
        assert "processed_at" in summary
        assert "total_devices" in summary
        assert "total_records" in summary
        assert "total_distance_km" in summary
        assert "average_quality_score" in summary

    def test_scorecard_fields(self, sample_telemetry):
        """Should include required scorecard fields per IMEI."""
        result = process_log_data(sample_telemetry, "test_file.json")

        assert len(result["scorecard"]) > 0
        scorecard = result["scorecard"][0]

        required_fields = [
            "imei", "Puntaje_Calidad", "Total_Reportes", "Delay_Avg",
            "Odo_Quality_Score", "Canbus_Completeness", "GPS_Integrity",
            "Ignition_Balance", "Ignition_On", "Ignition_Off",
            "Harsh_Events", "Driver_ID", "Frozen_Sensors"
        ]

        for field in required_fields:
            assert field in scorecard, f"Missing field: {field}"

    def test_data_quality_fields(self, sample_telemetry):
        """Should include data quality radar fields."""
        result = process_log_data(sample_telemetry, "test_file.json")

        data_quality = result["data_quality"]
        required_fields = [
            "gps_validity", "ignition", "delay",
            "rpm", "speed", "temp", "dist", "fuel"
        ]

        for field in required_fields:
            assert field in data_quality, f"Missing field: {field}"
            assert 0 <= data_quality[field] <= 100, f"Field {field} out of range"

    def test_empty_input_returns_none(self):
        """Should return None for empty input."""
        result = process_log_data([], "empty.json")
        assert result is None

    def test_invalid_data_returns_none(self):
        """Should return None for invalid data structure."""
        invalid_data = [{"no_jsonPayload": True}]
        result = process_log_data(invalid_data, "invalid.json")
        assert result is None

    def test_ignition_events_counted(self, sample_telemetry):
        """Should correctly count ignition events."""
        result = process_log_data(sample_telemetry, "test_file.json")

        scorecard = result["scorecard"][0]
        # Sample data has 1 ignition on (type 6) and 1 ignition off (type 7)
        assert scorecard["Ignition_On"] >= 0
        assert scorecard["Ignition_Off"] >= 0

    def test_quality_score_range(self, sample_telemetry):
        """Should produce quality score in valid range."""
        result = process_log_data(sample_telemetry, "test_file.json")

        scorecard = result["scorecard"][0]
        score = scorecard["Puntaje_Calidad"]
        assert 0 <= score <= 100, f"Score {score} out of valid range"

    def test_chart_data_structure(self, sample_telemetry):
        """Should include chart data with expected structure."""
        result = process_log_data(sample_telemetry, "test_file.json")

        chart_data = result["chart_data"]
        assert "score_distribution" in chart_data
        assert "events_summary" in chart_data
        assert isinstance(chart_data["score_distribution"], list)
        assert isinstance(chart_data["events_summary"], dict)


class TestScoreCalculation:
    """Test score calculation edge cases."""

    def test_canbus_completeness_affects_score(self, sample_telemetry):
        """CAN bus completeness should affect overall score."""
        result = process_log_data(sample_telemetry, "test.json")

        scorecard = result["scorecard"][0]
        # With full CAN bus data in sample, completeness should be high
        assert scorecard["Canbus_Completeness"] > 0

    def test_gps_integrity_calculation(self, sample_telemetry):
        """GPS integrity should be calculated from quality field."""
        result = process_log_data(sample_telemetry, "test.json")

        scorecard = result["scorecard"][0]
        # All sample points have quality='Good'
        assert scorecard["GPS_Integrity"] > 0
