import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

/**
 * Pull to refresh for a screen: refetches every query the screen is showing (its data, the live
 * values, the metadata) and says when that's done. Data also refreshes on its own when it goes
 * stale or the app returns to the foreground, so this is a shortcut, not the only way.
 */
export function usePullToRefresh() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.refetchQueries({ type: 'active' });
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  return { refreshing, onRefresh };
}
