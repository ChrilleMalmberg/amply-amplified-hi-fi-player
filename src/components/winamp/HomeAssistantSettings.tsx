import { useEffect, useState } from 'react';
import { desktopBridge, type HomeAssistantSettings as Settings } from '@/lib/desktop-bridge';

export function HomeAssistantSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [address, setAddress] = useState('');
  const [port, setPort] = useState('47824');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');
  useEffect(() => {
    let active = true;
    void desktopBridge()?.homeAssistant('status').then(value => {
      if (active) { setSettings(value); setAddress(value.allowedAddress); setPort(String(value.port)); }
    }).catch(() => { if (active) setError('Connection settings could not be loaded.'); });
    const hide = () => setToken(''); window.addEventListener('blur', hide);
    return () => { active = false; window.removeEventListener('blur', hide); };
  }, []);
  const action = async (name: 'enable' | 'disable' | 'pairing' | 'rotate') => {
    if (busy) return; setBusy(true); setError(''); setToken('');
    try {
      const bridge = desktopBridge(); if (!bridge) throw Error('Open the Windows desktop application.');
      const value = await bridge.homeAssistant(name, { allowedAddress: address.trim(), port: Number(port) });
      setSettings(value); if (name === 'pairing') setToken(value.token ?? '');
    } catch (reason) { setError(reason instanceof Error ? reason.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '') : 'The connection could not be changed.'); }
    finally { setBusy(false); }
  };
  return <section className="wa-ha-settings" aria-label="Home Assistant connection">
    <h2>Home Assistant connection</h2>
    <p>Control this running AmPly application from your Home Assistant dashboard. Music stays on this computer.</p>
    <p role="status"><strong>{settings?.enabled ? 'Enabled' : 'Disabled'}</strong> · optional local connection</p>
    {(error || settings?.error) && <p className="wa-pl-warn" role="alert">{error || settings?.error}</p>}
    <label>Home Assistant server IPv4 address<input className="wa-dialog-input" aria-label="Home Assistant server IPv4 address" placeholder="e.g. 192.168.1.10" value={address} onChange={e => setAddress(e.target.value)} disabled={busy || settings?.enabled} /></label>
    <label>Connection port<input className="wa-dialog-input" aria-label="Connection port" type="number" min="1024" max="65535" value={port} onChange={e => setPort(e.target.value)} disabled={busy || settings?.enabled} /></label>
    <p>Only that server address can connect. Traffic is encrypted; pairing checks this computer’s certificate.</p>
    <div className="wa-dialog-actions">
      <button className="wa-toggle" disabled={busy || !settings} onClick={() => void action(settings?.enabled ? 'disable' : 'enable')}>{busy ? 'PLEASE WAIT…' : settings?.enabled ? 'DISABLE CONNECTION' : 'ENABLE CONNECTION'}</button>
    </div>
    {settings?.enabled && <>
      <h3>Pair with Home Assistant</h3>
      <p>In Home Assistant, add the AmPly integration. Enter this computer’s address, port, fingerprint and pairing key.</p>
      <dl><dt>Windows computer address</dt><dd>{settings.addresses.join(' or ') || 'Check this computer’s network settings'}</dd><dt>Port</dt><dd>{settings.port}</dd>
        <dt>Certificate SHA-256 fingerprint</dt><dd><input className="wa-dialog-input" aria-label="Certificate fingerprint" readOnly value={settings.fingerprint} onFocus={e => e.currentTarget.select()} /></dd></dl>
      <button className="wa-toggle" disabled={busy} onClick={() => token ? setToken('') : void action('pairing')}>{token ? 'HIDE PAIRING KEY' : 'SHOW PAIRING KEY'}</button>
      {token && <label>Pairing key<input className="wa-dialog-input" aria-label="Pairing key" readOnly value={token} onFocus={e => e.currentTarget.select()} /><span>Paste this only into your own Home Assistant setup form.</span></label>}
      <p><button className="wa-toggle" disabled={busy} onClick={() => void action('rotate')}>REGENERATE PAIRING KEY</button></p>
      <p>Regenerating the key disconnects the old pairing. Update Home Assistant with the new key.</p>
    </>}
    <p className="wa-ha-note">AmPly must be running. This connection does not launch Windows applications or expose your music files. Windows Firewall may require a rule for this port on your private network.</p>
  </section>;
}
