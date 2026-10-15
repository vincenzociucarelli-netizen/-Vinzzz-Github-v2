import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  children: React.ReactNode;
  /** Etichetta della sezione, mostrata nel messaggio di errore. */
  label?: string;
};

type State = {
  hasError: boolean;
  error?: Error;
};

/**
 * 🆕 ErrorBoundary generico.
 *
 * Evita la "schermata bianca" totale quando un componente figlio lancia un
 * errore di rendering (es. tag HTML non validi su native). Mostra invece un
 * messaggio di fallback e un pulsante "Riprova" che resetta lo stato.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, info?.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ScrollView contentContainerStyle={styles.container}>
          <Ionicons name="alert-circle-outline" size={56} color="#F44336" />
          <Text style={styles.title}>Si è verificato un problema</Text>
          <Text style={styles.message}>
            {this.props.label
              ? `Impossibile mostrare: ${this.props.label}.`
              : 'Impossibile mostrare questa schermata.'}
            {'\n'}Riprova; se il problema persiste riavvia l'app.
          </Text>
          {!!this.state.error?.message && (
            <Text style={styles.detail}>{this.state.error.message}</Text>
          )}
          <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
            <Ionicons name="refresh" size={18} color="#fff" />
            <Text style={styles.buttonText}>Riprova</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  detail: {
    fontSize: 12,
    color: '#999',
    marginTop: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 24,
    minHeight: 48,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});

export default ErrorBoundary;
