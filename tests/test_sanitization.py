"""Tests for JSON sanitization functions."""
import pytest
import numpy as np
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import sanitize_for_json


class TestSanitizeForJson:
    """Test cases for sanitize_for_json function."""

    def test_nan_to_none(self):
        """Should convert NaN to None."""
        result = sanitize_for_json(float('nan'))
        assert result is None

    def test_inf_to_none(self):
        """Should convert Inf to None."""
        result = sanitize_for_json(float('inf'))
        assert result is None

    def test_negative_inf_to_none(self):
        """Should convert -Inf to None."""
        result = sanitize_for_json(float('-inf'))
        assert result is None

    def test_numpy_nan_to_none(self):
        """Should convert numpy NaN to None."""
        result = sanitize_for_json(np.nan)
        assert result is None

    def test_numpy_inf_to_none(self):
        """Should convert numpy Inf to None."""
        result = sanitize_for_json(np.inf)
        assert result is None

    def test_valid_float_unchanged(self):
        """Should keep valid floats unchanged."""
        assert sanitize_for_json(3.14) == 3.14
        assert sanitize_for_json(0.0) == 0.0
        assert sanitize_for_json(-42.5) == -42.5

    def test_integer_unchanged(self):
        """Should keep integers unchanged."""
        assert sanitize_for_json(42) == 42
        assert sanitize_for_json(0) == 0
        assert sanitize_for_json(-100) == -100

    def test_string_unchanged(self):
        """Should keep strings unchanged."""
        assert sanitize_for_json("hello") == "hello"
        assert sanitize_for_json("") == ""

    def test_none_unchanged(self):
        """Should keep None unchanged."""
        assert sanitize_for_json(None) is None

    def test_dict_recursive(self):
        """Should recursively sanitize dictionaries."""
        data = {
            "valid": 1.5,
            "nan": float('nan'),
            "inf": float('inf'),
            "nested": {
                "inner_nan": float('nan'),
                "inner_valid": "text"
            }
        }
        result = sanitize_for_json(data)

        assert result["valid"] == 1.5
        assert result["nan"] is None
        assert result["inf"] is None
        assert result["nested"]["inner_nan"] is None
        assert result["nested"]["inner_valid"] == "text"

    def test_list_recursive(self):
        """Should recursively sanitize lists."""
        data = [1.0, float('nan'), float('inf'), "text", None]
        result = sanitize_for_json(data)

        assert result[0] == 1.0
        assert result[1] is None
        assert result[2] is None
        assert result[3] == "text"
        assert result[4] is None

    def test_nested_structure(self):
        """Should handle deeply nested structures."""
        data = {
            "level1": [
                {"level2": {"level3": float('nan')}},
                [float('inf'), -42.0]
            ]
        }
        result = sanitize_for_json(data)

        assert result["level1"][0]["level2"]["level3"] is None
        assert result["level1"][1][0] is None
        assert result["level1"][1][1] == -42.0

    def test_empty_dict(self):
        """Should handle empty dict."""
        assert sanitize_for_json({}) == {}

    def test_empty_list(self):
        """Should handle empty list."""
        assert sanitize_for_json([]) == []
