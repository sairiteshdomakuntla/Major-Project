import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { API_BASE_URL, getHealth } from '../api/client';
import { useAppStore } from '../state/useAppStore';

type Status = 'connecting' | 'connected' | 'failed';

export function ConnectivityCard() {
  const connectivity = useAppStore((s) => s.connectivity);
  const setConnectivity = useAppStore((s) => s.setConnectivity);
  const lastHealthResponse = useAppStore((s) => s.lastHealthResponse);
  const setLastHealthResponse = useAppStore((s) => s.setLastHealthResponse);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const check = useCallback(async () => {
    setConnectivity('connecting');
    setError(null);
    try {
      const data = await getHealth(8000);
      // Only report success when the backend actually responds with status ok.
      if (data?.status === 'ok') {
        setConnectivity('connected');
        setLastHealthResponse(JSON.stringify(data));
      } else {
        setConnectivity('failed');
        setError(`Unexpected response: ${JSON.stringify(data)}`);
      }
    } catch (e) {
      setConnectivity('failed');
      setError(e instanceof Error ? e.message : 'Network request failed');
    }
  }, [setConnectivity, setLastHealthResponse]);

  useEffect(() => {
    void check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const status: Status =
    connectivity === 'connected'
      ? 'connected'
      : connectivity === 'failed'
        ? 'failed'
        : 'connecting';

  const statusLabel =
    status === 'connected'
      ? 'Connected'
      : status === 'failed'
        ? 'Connection Failed'
        : 'Connecting';

  const dotClass =
    status === 'connected'
      ? 'bg-green-400'
      : status === 'failed'
        ? 'bg-red-400'
        : 'bg-yellow-400';

  return (
    <View className="w-full rounded-2xl bg-slate-800 p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold text-slate-100">
          Backend connection
        </Text>
        <View className="flex-row items-center gap-2">
          <View className={`h-3 w-3 rounded-full ${dotClass}`} />
          <Text className="text-sm font-medium text-slate-100">{statusLabel}</Text>
        </View>
      </View>

      <Text className="mt-2 text-xs text-slate-400" numberOfLines={1}>
        {API_BASE_URL}/health
      </Text>

      {status === 'connected' && lastHealthResponse ? (
        <Text className="mt-2 rounded-lg bg-slate-900 p-2 text-xs text-green-300">
          {lastHealthResponse}
        </Text>
      ) : null}

      {status === 'failed' && error ? (
        <Text className="mt-2 rounded-lg bg-slate-900 p-2 text-xs text-red-300">
          {error}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retry backend connection"
        onPress={() => setAttempt((n) => n + 1)}
        className="mt-3 items-center rounded-xl bg-sky-400 px-4 py-2 active:opacity-80"
      >
        <Text className="text-sm font-semibold text-slate-900">Retry</Text>
      </Pressable>
    </View>
  );
}
