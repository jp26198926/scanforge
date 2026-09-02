import { useEffect, useState, type FormEvent } from 'react';
import { Check, CircleHelp, LogIn, LogOut, MonitorCog, RotateCcw, Save, SlidersHorizontal, UserRound } from 'lucide-react';
import { PageIntro, primaryButton, secondaryButton } from '@/components/scanforge-shell';
import { clearAuthEmail, getSavedAuthEmail, saveAuthEmail } from '@/lib/session';

const defaults = { defaultFormat: 'qrcode', defaultSize: '1024', defaultCorrection: 'M', rememberSource: true };

async function authRequest(path: string, body: Record<string, string>) {
  const response = await fetch(`/api/auth/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message ?? payload.error ?? 'Authentication failed.');
  return payload;
}

export default function SettingsPage() {
  const [preferences, setPreferences] = useState(defaults);
  const [saved, setSaved] = useState(false);
  const [email, setEmail] = useState(getSavedAuthEmail());
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [authMessage, setAuthMessage] = useState('');
  const [authPending, setAuthPending] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('scanforge-preferences');
    if (stored) {
      try { setPreferences({ ...defaults, ...JSON.parse(stored) }); } catch { setPreferences(defaults); }
    }
  }, []);

  function savePreferences(event: FormEvent) {
    event.preventDefault();
    localStorage.setItem('scanforge-preferences', JSON.stringify(preferences));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2400);
  }

  function resetPreferences() {
    setPreferences(defaults);
    localStorage.removeItem('scanforge-preferences');
    setSaved(false);
  }

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    setAuthPending(true);
    setAuthMessage('');
    try {
      await authRequest(authMode === 'sign-in' ? 'sign-in/email' : 'sign-up/email', {
        email,
        password,
        name: email.split('@')[0] || 'ScanForge user',
      });
      saveAuthEmail(email);
      setPassword('');
      setAuthMessage(authMode === 'sign-in' ? 'Signed in. Your starter allowance is now active.' : 'Account created. Your starter allowance is now active.');
      window.location.reload();
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : 'Authentication failed. Try again.');
    } finally {
      setAuthPending(false);
    }
  }

  async function signOut() {
    await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' });
    clearAuthEmail();
    window.location.reload();
  }

  const isSignedIn = Boolean(email);
  return (
    <div>
      <PageIntro eyebrow="Workspace / 04" title="Set the defaults." detail="A few quiet preferences keep the next generation moving at your pace. Nothing here changes your plan or output quality." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <form onSubmit={savePreferences} className="rounded-lg border border-border bg-card shadow-sm">
          <div className="flex items-center gap-3 border-b border-border p-5 sm:p-6"><span className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary"><SlidersHorizontal className="size-4" /></span><div><h2 className="text-sm font-semibold">Generation preferences</h2><p className="mt-1 text-xs text-muted-foreground">Applied to new jobs from this browser.</p></div></div>
          <div className="space-y-6 p-5 sm:p-6">
            <label className="block text-sm font-semibold">Default format<select value={preferences.defaultFormat} onChange={(event) => setPreferences({ ...preferences, defaultFormat: event.target.value })} data-testid="select-default-format" className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary sm:max-w-sm"><option value="qrcode">QR code</option><option value="barcode">Barcode</option></select></label>
            <label className="block text-sm font-semibold">Default output size<select value={preferences.defaultSize} onChange={(event) => setPreferences({ ...preferences, defaultSize: event.target.value })} data-testid="select-default-size" className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary sm:max-w-sm"><option value="512">512 × 512 px</option><option value="1024">1024 × 1024 px</option><option value="2048">2048 × 2048 px</option><option value="4096">4096 × 4096 px</option></select></label>
            <label className="block text-sm font-semibold">QR error correction<select value={preferences.defaultCorrection} onChange={(event) => setPreferences({ ...preferences, defaultCorrection: event.target.value })} data-testid="select-default-correction" className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary sm:max-w-sm"><option value="L">L — compact</option><option value="M">M — balanced</option><option value="Q">Q — durable</option><option value="H">H — maximum recovery</option></select></label>
            <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={preferences.rememberSource} onChange={(event) => setPreferences({ ...preferences, rememberSource: event.target.checked })} data-testid="checkbox-remember-source" className="mt-0.5 size-4 accent-[hsl(var(--primary))]" /><span><span className="block text-sm font-semibold">Keep my last source ready</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">Convenient for repeated label runs. Stored only in this browser.</span></span></label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/25 p-5 sm:px-6"><button type="button" onClick={resetPreferences} data-testid="button-reset-preferences" className={`${secondaryButton} text-xs`}><RotateCcw className="size-3.5" /> Reset</button><button type="submit" data-testid="button-save-preferences" className={primaryButton}><Save className="size-3.5" /> Save preferences</button></div>
          {saved && <div className="flex items-center gap-2 border-t border-primary/20 bg-primary/5 px-5 py-3 text-xs text-foreground" data-testid="status-preferences-saved"><Check className="size-3.5 text-primary" /> Preferences saved for this browser.</div>}
        </form>
        <div className="space-y-6">
          <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-md bg-secondary text-foreground"><UserRound className="size-4" /></span><div><h2 className="text-sm font-semibold">Account access</h2><p className="mt-1 text-xs text-muted-foreground">{isSignedIn ? 'Signed in to your ScanForge workspace.' : 'Create a free account to unlock daily starter capacity.'}</p></div></div>
            {isSignedIn ? <><div className="mt-5 rounded-md border border-border bg-muted/35 p-3"><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Signed in as</p><p className="mt-2 truncate text-xs font-semibold">{email}</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">Starter includes three transactions per day for single and bulk generation.</p></div><button type="button" onClick={signOut} data-testid="button-session-action" className={`${secondaryButton} mt-4 w-full text-xs`}><LogOut className="size-3.5" /> Sign out</button></> : <form onSubmit={submitAuth} className="mt-5 space-y-3"><label className="block text-xs font-semibold">Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" placeholder="you@company.com" /></label><label className="block text-xs font-semibold">Password<input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" placeholder="At least 8 characters" /></label><button type="submit" disabled={authPending} data-testid="button-session-action" className={`${primaryButton} w-full text-xs`}><LogIn className="size-3.5" /> {authPending ? 'Working…' : authMode === 'sign-in' ? 'Sign in' : 'Create free account'}</button><button type="button" onClick={() => { setAuthMode(authMode === 'sign-in' ? 'sign-up' : 'sign-in'); setAuthMessage(''); }} className="w-full text-xs font-semibold text-primary underline">{authMode === 'sign-in' ? 'Need an account? Create one' : 'Already have an account? Sign in'}</button></form>}
            {authMessage && <p className="mt-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs" data-testid="status-auth">{authMessage}</p>}
          </section>
          <section className="rounded-lg border border-border bg-card p-5 shadow-sm"><div className="flex items-center gap-3"><MonitorCog className="size-4 text-primary" /><h2 className="text-sm font-semibold">Environment</h2></div><dl className="mt-5 divide-y divide-border text-xs"><div className="flex justify-between py-3"><dt className="text-muted-foreground">Output engine</dt><dd className="font-mono">SCANFORGE / V1</dd></div><div className="flex justify-between py-3"><dt className="text-muted-foreground">Color profile</dt><dd className="font-mono">SRGB</dd></div><div className="flex justify-between py-3"><dt className="text-muted-foreground">Need help?</dt><dd><button type="button" onClick={() => setAuthMessage('Support requests will be available after launch.')} data-testid="button-help" className="inline-flex items-center gap-1 font-semibold text-primary"><CircleHelp className="size-3.5" /> Contact support</button></dd></div></dl></section>
        </div>
      </div>
    </div>
  );
}