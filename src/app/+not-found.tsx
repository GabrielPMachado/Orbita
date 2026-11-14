import { Redirect } from 'expo-router';

/** Endereço desconhecido (link antigo, prévia web) → volta para o início. */
export default function NotFound() {
  return <Redirect href="/" />;
}
