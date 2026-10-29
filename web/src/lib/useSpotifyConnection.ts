import { useCallback, useEffect, useState } from "react";
import { getSpotifyConnection, type SpotifyConnection } from "./api";

export function useSpotifyConnection() {
  const [connection, setConnection] = useState<SpotifyConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    getSpotifyConnection()
      .then((value) => {
        if (!active) return;
        setConnection(value);
        setError(null);
      })
      .catch((e) => active && setError((e as Error).message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { connection, loading, error, reload };
}
