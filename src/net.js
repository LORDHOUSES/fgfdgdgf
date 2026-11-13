import { useNetInfo } from '@react-native-community/netinfo';

export function useOnline() {
  const n = useNetInfo();
  return !(n.isConnected === false || n.isInternetReachable === false);
}
