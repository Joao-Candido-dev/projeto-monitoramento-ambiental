"""Servidor inicial. /health verifica o processo, não a integração futura."""
from flask import Flask, jsonify
from src.models.weather_ensemble import MODEL_VERSION


def create_app():
    app = Flask(__name__)

    @app.get('/health')
    def health():
        # Não carregamos o modelo nem declaramos o banco conectado nesta etapa.
        return jsonify(status='ok', service='backend-londrina',
                       integration_ready=False, model_version=MODEL_VERSION,
                       model_loaded=False, database_connected=False)

    @app.errorhandler(404)
    def not_found(_error):
        return jsonify(error={'code': 'NOT_FOUND',
                              'message': 'Rota inexistente. Nesta etapa somente /health está implementada.'}), 404

    return app


app = create_app()
