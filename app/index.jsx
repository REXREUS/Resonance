import { Redirect } from 'expo-router';

export default function Index() {
  // Redirect to splash screen for initialization
  return <Redirect href="/splash" />;
}