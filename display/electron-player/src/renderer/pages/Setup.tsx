import React, { useState } from 'react';

interface SetupProps {
  onComplete: () => void;
}

export default function Setup({ onComplete }: SetupProps) {
  const [serverUrl, setServerUrl] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [mode, setMode] = useState<'manual' | 'qr'>('manual');
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);

  async function handleSave() {
    if (!serverUrl || !deviceId) {
      setError('Both fields are required.');
      return;
    }
    setTesting(true);
    setError('');

    // Test the connection before saving
    const result = await window.screenflow.player.fetchPlaylist({
      serverUrl: serverUrl.replace(/\/$/, ''),
      deviceId,
    });

    setTesting(false);

    if (!result.success) {
      setError(`Could not connect: ${result.error}. Check the server URL and Device ID.`);
      return;
    }

    await window.screenflow.config.set({ serverUrl, deviceId });
    onComplete();
  }

  // QR scanner mode — uses jsQR library loaded via CDN
  // When QR is scanned, parse JSON: { serverUrl, deviceId }
  // and auto-fill the fields
  function handleQRResult(data: string) {
    try {
      const parsed = JSON.parse(data);
      if (parsed.serverUrl && parsed.deviceId) {
        setServerUrl(parsed.serverUrl);
        setDeviceId(parsed.deviceId);
        setMode('manual'); // Switch to manual to show filled fields
      }
    } catch {
      setError('Invalid QR code. Please try manual entry.');
    }
  }

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: '#0a0a0f',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, sans-serif', color: '#fff',
    }}>
      {/* Logo */}
      <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 8, color: '#7c3aed' }}>
        ScreenFlow
      </div>
      <div style={{ fontSize: 14, color: '#666', marginBottom: 48 }}>
        Player Setup
      </div>

      {/* Mode switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        <button
          onClick={() => setMode('manual')}
          style={{
            padding: '8px 20px', borderRadius: 8, border: 'none',
            background: mode === 'manual' ? '#7c3aed' : '#1a1a2e',
            color: '#fff', cursor: 'pointer', fontSize: 14,
          }}
        >
          Manual Entry
        </button>
        <button
          onClick={() => setMode('qr')}
          style={{
            padding: '8px 20px', borderRadius: 8, border: 'none',
            background: mode === 'qr' ? '#7c3aed' : '#1a1a2e',
            color: '#fff', cursor: 'pointer', fontSize: 14,
          }}
        >
          Scan QR Code
        </button>
      </div>

      {mode === 'manual' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 380 }}>
          <div>
            <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>
              SERVER URL
            </label>
            <input
              value={serverUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServerUrl(e.target.value)}
              placeholder="https://screen-api-xxxx.onrender.com or http://192.168.1.50:8000"
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 8,
                background: '#1a1a2e', border: '1px solid #333',
                color: '#fff', fontSize: 14, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>
              DEVICE ID
            </label>
            <input
              value={deviceId}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeviceId(e.target.value)}
              placeholder="Paste the Device ID from the dashboard"
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 8,
                background: '#1a1a2e', border: '1px solid #333',
                color: '#fff', fontSize: 14, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>
          )}

          <button
            onClick={handleSave}
            disabled={testing}
            style={{
              padding: '13px', borderRadius: 8, border: 'none',
              background: testing ? '#4a2090' : '#7c3aed',
              color: '#fff', fontSize: 15, fontWeight: 600,
              cursor: testing ? 'not-allowed' : 'pointer',
              marginTop: 8,
            }}
          >
            {testing ? 'Testing connection...' : 'Save & Start'}
          </button>
        </div>
      ) : (
        <QRScanner onResult={handleQRResult} onCancel={() => setMode('manual')} />
      )}

      <div style={{ position: 'absolute', bottom: 20, fontSize: 11, color: '#333' }}>
        Press Ctrl+Shift+Q to quit
      </div>
    </div>
  );
}

function QRScanner({ onResult, onCancel }: { onResult: (data: string) => void; onCancel: () => void }) {
  // Implementation of QR scanner using jsQR
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ color: '#888', marginBottom: 16, fontSize: 14 }}>
        Point the camera at the QR code shown in the ScreenFlow dashboard
      </div>
      <video id="qr-video" autoPlay style={{ width: 320, height: 240, borderRadius: 8 }} />
      <canvas id="qr-canvas" style={{ display: 'none' }} />
      <br />
      <button
        onClick={onCancel}
        style={{
          marginTop: 16, padding: '8px 20px', borderRadius: 8,
          border: '1px solid #333', background: 'transparent',
          color: '#888', cursor: 'pointer',
        }}
      >
        Cancel
      </button>
    </div>
  );
}
