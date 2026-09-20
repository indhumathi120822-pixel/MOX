import unittest
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scanner.main import run_scan

class TestECDATScanner(unittest.TestCase):
    def test_sample_targets_scan(self):
        target_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sample_targets")
        db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend", "ecdat.db")
        
        result = run_scan(target_dir, db_path=db_path, project_name="Test Enterprise Project")
        
        self.assertEqual(result["status"], "completed")
        self.assertGreater(result["total_findings"], 0)
        self.assertIn("cbom", result)
        self.assertIn("nodes", result["cbom"])
        self.assertIn("edges", result["cbom"])
        
        # Verify 7-category coverage in findings
        categories = set(f["category"] for f in result["findings"])
        self.assertTrue(len(categories) >= 3, f"Expected multi-category findings, got {categories}")

if __name__ == "__main__":
    unittest.main()
