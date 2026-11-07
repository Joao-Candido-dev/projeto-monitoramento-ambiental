import unittest
from app.main import create_app

class AppTests(unittest.TestCase):
    def setUp(self):
        self.client = create_app().test_client()

    def test_health_is_not_integration_readiness(self):
        response = self.client.get('/health')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json['integration_ready'])
        self.assertFalse(response.json['model_loaded'])

    def test_no_fake_prediction(self):
        response = self.client.post('/predict', json={})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json['error']['code'], 'NOT_FOUND')
