/** Tiny focus helper so Inbox can refresh without react-navigation. */
import { useEffect } from 'react';

export function useFocusEffect(fn: () => void) {
  useEffect(() => {
    fn();
  }, [fn]);
}
