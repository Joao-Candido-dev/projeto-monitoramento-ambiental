import unittest
from app.model_service import load_model
from app.prediction_service import predict
from app.errors import ServiceError

class ModelTests(unittest.TestCase):
    def test_loads_verified_v6_and_predicts(self):
        from pathlib import Path
        base=Path(r'C:\Users\CANAL\Downloads\experiments\experiments\weather_v6_integration_candidate_20261105T190315Z')
        model=load_model(base/'weather_ensemble.joblib',base/'manifest.json')
        inputs={'location':'Londrina-PR','mode':'historical','reference_time':'2025-01-01T15:00:00-03:00',
                'weather':{'temperature_2m':20,'relative_humidity_2m':80,'pressure_msl':1005,'cloud_cover':70,'pressure_msl_previous_hour':1007}}
        result=predict(model,inputs)
        self.assertEqual(result['model_version'],'weather-v6-simple-mean-isotonic-v1')
        self.assertEqual(result['rain_predicted'],result['rain_probability']>=result['decision_threshold'])

    def test_model_missing_is_503(self):
        with self.assertRaisesRegex(ServiceError,'MODEL_UNAVAILABLE'):
            predict(None,{})
