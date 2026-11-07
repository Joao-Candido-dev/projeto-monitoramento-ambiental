import { Component } from 'react';

// Evita a tela em branco: se algum componente quebrar ao renderizar, mostra um aviso no lugar da página.
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('Erro ao renderizar a interface:', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="wrap">
        <h1>Chuva Londrina</h1>
        <p className="err" role="alert">Ocorreu um erro inesperado ao exibir o painel.</p>
        <button className="link" onClick={() => window.location.reload()}>Recarregar a página</button>
      </main>
    );
  }
}
