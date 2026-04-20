from __future__ import annotations

import unittest

from src.input.validator import classify_target, validate_target


class TestValidator(unittest.TestCase):
    def test_domain_validation(self) -> None:
        result = validate_target("example.com")
        self.assertTrue(result.valid)
        self.assertEqual(result.target_type, "domain")

    def test_ip_validation(self) -> None:
        result = validate_target("192.168.1.1")
        self.assertTrue(result.valid)
        self.assertEqual(result.target_type, "ip")

    def test_url_validation(self) -> None:
        result = validate_target("https://example.com/app")
        self.assertTrue(result.valid)
        self.assertEqual(result.target_type, "application")

    def test_invalid_target(self) -> None:
        result = validate_target("not a target")
        self.assertFalse(result.valid)

    def test_classifier(self) -> None:
        self.assertEqual(classify_target("10.0.0.0/24"), "ip")


if __name__ == "__main__":
    unittest.main()
