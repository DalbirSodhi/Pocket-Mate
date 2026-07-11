import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Pocket-Mate</Text>
        <Text style={styles.title}>Know what you can safely spend today.</Text>
        <Text style={styles.body}>
          The first build will focus on income, expenses, budget caps, savings,
          and a clear daily safe-to-spend dashboard.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7F2',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: 24,
    shadowColor: '#172018',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  eyebrow: {
    color: '#256B45',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  title: {
    color: '#172018',
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
    marginBottom: 16,
  },
  body: {
    color: '#516057',
    fontSize: 16,
    lineHeight: 24,
  },
});
