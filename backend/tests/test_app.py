import unittest
from app.main import create_app

class EmptyRepository:
    def rows_at(self, timestamp):
        return []

class AppTests(unittest.TestCase):
    def setUp(self):
        self.client = create_app(repository=EmptyRepository()).test_client()

    def test_health_reports_component_states(self):
        response = self.client.get('/health')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json['integration_ready'])
        self.assertFalse(response.json['model_loaded'])
        self.assertTrue(response.json['database_configured'])

    def test_missing_reference_time_is_422(self):
        response = self.client.get('/weather-inputs')
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json['error']['code'], 'INVALID_REFERENCE_TIME')

    def test_missing_t_record_is_404(self):
        response = self.client.get('/weather-inputs?reference_time=2026-09-01T14:00:00-03:00')
        self.assertEqual(response.status_code, 404)

    def test_predict_requires_idempotency_key(self):
        response = self.client.post('/predict', json={})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json['error']['code'], 'INVALID_IDEMPOTENCY_KEY')

    def test_history_requires_valid_interval(self):
        response = self.client.get('/predictions')
        self.assertEqual(response.status_code, 422)
