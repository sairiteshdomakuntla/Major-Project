# AgentBridge — API URL configuration

The mobile app reads the backend address from `EXPO_PUBLIC_API_URL`
(see `mobile/src/api/client.ts`). Do not hardcode URLs in screens.

## Android emulator

The emulator's `localhost` is the emulator itself, not your PC.
Use the special alias `10.0.2.2`:

```ini
EXPO_PUBLIC_API_URL=http://10.0.2.2:4000
```

## Physical Android device

Use your development PC's LAN IP (phone + PC on the same Wi-Fi).
Find it with `ipconfig` (look for IPv4 Address), then e.g.:

```ini
EXPO_PUBLIC_API_URL=http://192.168.1.50:4000
```

Make sure Windows Firewall allows inbound TCP on the backend port (default 4000),
and the backend is listening on `0.0.0.0` or the LAN interface (our `app.listen`
without a host binds to all interfaces by default).

## iOS simulator / Web

```ini
EXPO_PUBLIC_API_URL=http://localhost:4000
```

## Production (future)

```ini
EXPO_PUBLIC_API_URL=https://api.agentbridge.example.com
```

Restart `expo start` after changing `.env`.
