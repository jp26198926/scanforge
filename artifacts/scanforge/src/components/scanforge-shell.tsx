import { Link, useLocation } from 'wouter';
import { Activity, ArrowUpRight, BarChart3, ChevronRight, Code2, History, Menu, Settings2, Sparkles, X } from 'lucide-react';
import { type ReactNode } from 'react';
import { useGetUsage } from '@workspace/api-client-react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { useEffect, useRef, useState } from 'react';
import { getScanforgeHeaders } from '@/lib/session';

export const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:pointer-events-none disabled:opacity-50';
export const secondaryButton = 'inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted active:bg-muted';

export function BrandMark() {
  return (
    <span className="relative grid size-8 shrink-0 place-items-center rounded-[9px] bg-primary text-primary-foreground" aria-hidden="true">
      <span className="absolute left-[7px] top-[7px] size-[8px] rounded-[2px] border-[2px] border-current" />
      <span className="absolute bottom-[7px] right-[7px] size-[8px] rounded-[2px] border-[2px] border-current" />
      <span className="absolute left-[7px] bottom-[7px] size-[4px] rounded-[1px] bg-current" />
      <span className="absolute right-[7px] top-[7px] size-[4px] rounded-[1px] bg-current" />
    </span>
  );
}

const navItems = [
  { href: '/', label: 'Generator', icon: Code2 },
  { href: '/history', label: 'History', icon: History },
  { href: '/pricing', label: 'Plans', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings2 },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="paper-noise min-h-[100dvh] bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[244px] flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 text-sidebar-foreground lg:flex">
        <ShellBrand />
        <nav className="mt-12 space-y-1" aria-label="Main navigation">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = location === href;
            return (
              <Link key={href} href={href} data-testid={`link-nav-${label.toLowerCase()}`} className={`group flex items-center gap-3 rounded-md px-3 py-3 text-[13px] font-semibold transition-colors ${active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`}>
                <Icon className={`size-[17px] ${active ? 'text-primary' : 'text-sidebar-foreground/55 group-hover:text-primary'}`} strokeWidth={1.8} />
                <span>{label}</span>
                {active && <span className="ml-auto size-1.5 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-lg border border-sidebar-border bg-sidebar-accent/45 p-4">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/55">
            <Activity className="size-3.5 text-primary" /> Scan status
          </div>
          <p className="mt-3 text-sm font-medium">All systems operational.</p>
          <p className="mt-1 font-mono text-[10px] text-sidebar-foreground/45">LAT 12ms · READY</p>
        </div>
        <p className="mt-5 px-3 font-mono text-[10px] text-sidebar-foreground/35">SCANFORGE / 01</p>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/25 lg:hidden" onClick={closeMobile}>
          <aside className="h-full w-[280px] bg-sidebar p-5 text-sidebar-foreground shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <ShellBrand />
              <button type="button" onClick={closeMobile} className="rounded-md p-2 text-sidebar-foreground/70 hover:bg-sidebar-accent" data-testid="button-close-menu" aria-label="Close menu"><X className="size-5" /></button>
            </div>
            <nav className="mt-12 space-y-1" aria-label="Mobile navigation">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} onClick={closeMobile} data-testid={`link-mobile-nav-${label.toLowerCase()}`} className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-semibold ${location === href ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/70'}`}>
                  <Icon className="size-[17px] text-primary" /> {label}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}

      <div className="lg:pl-[244px]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-border bg-background/90 px-5 backdrop-blur-md sm:px-8 lg:px-10">
          <button type="button" onClick={() => setMobileOpen(true)} className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden" data-testid="button-open-menu" aria-label="Open menu"><Menu className="size-5" /></button>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><span className="size-1.5 rounded-full bg-primary" /> Production workspace <ChevronRight className="size-3.5" /> <span className="font-mono text-[11px]">LOCAL / READY</span></div>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/pricing" data-testid="link-header-upgrade" className="hidden items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground sm:flex">Upgrade <ArrowUpRight className="size-3.5" /></Link>
            <div className="grid size-8 place-items-center rounded-full border border-border bg-card font-mono text-[11px] font-semibold text-muted-foreground" data-testid="text-user-avatar">SF</div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10">{children}</main>
      </div>
    </div>
  );
}

function ShellBrand() {
  return (
    <Link href="/" data-testid="link-brand" className="flex items-center gap-3 text-sidebar-foreground">
      <BrandMark />
      <span className="text-[15px] font-bold tracking-[-0.03em]">Scan<span className="text-primary">Forge</span></span>
    </Link>
  );
}

export function PageIntro({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return (
    <div className="fade-up mb-8 flex flex-col justify-between gap-5 border-b border-border pb-7 md:flex-row md:items-end">
      <div>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-foreground sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{detail}</p>
      </div>
      <div className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground md:flex"><span className="size-1.5 rounded-full bg-primary" /> Live workspace</div>
    </div>
  );
}

export function UsageMeter({ compact = false }: { compact?: boolean }) {
  const { data, isLoading, isError, refetch } = useGetUsage({ request: { headers: getScanforgeHeaders() } });
  if (isLoading) return <div className={`animate-pulse rounded-lg border border-border bg-card ${compact ? 'p-4' : 'p-5'}`}><div className="h-3 w-24 rounded bg-muted" /><div className="mt-4 h-2 w-full rounded bg-muted" /><div className="mt-3 h-3 w-32 rounded bg-muted" /></div>;
  if (isError || !data) return <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"><p className="font-semibold">Usage is unavailable.</p><button type="button" onClick={() => refetch()} className="mt-2 text-xs font-semibold text-destructive underline" data-testid="button-retry-usage">Retry connection</button></div>;
  const progress = data.dailyLimit > 0 ? Math.min(100, (data.usedToday / data.dailyLimit) * 100) : 0;
  const planLabel = data.plan === 'anonymous' ? 'Anonymous' : `${data.plan.charAt(0).toUpperCase()}${data.plan.slice(1)} plan`;
  return (
    <div className={`rounded-lg border border-border bg-card ${compact ? 'p-4' : 'p-5'}`} data-testid="card-usage-summary">
      <div className="flex items-center justify-between gap-3">
        <div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Today&apos;s capacity</p><p className="mt-1 text-sm font-semibold">{planLabel}</p></div>
        <span className="rounded-full bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground" data-testid="text-usage-count">{data.usedToday} / {data.dailyLimit}</span>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} /></div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground"><span>{data.remainingToday} generations remaining</span><span className="font-mono">RESETS {new Date(data.resetAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
    </div>
  );
}

export function CodeVisual({ value, format, size = 'normal' }: { value: string; format: 'qrcode' | 'barcode'; size?: 'normal' | 'small' }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const barcodeRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    let cancelled = false;
    if (format === 'qrcode' && value) {
      QRCode.toDataURL(value, { width: size === 'small' ? 220 : 520, margin: 2, errorCorrectionLevel: 'M' })
        .then((url) => { if (!cancelled) setQrDataUrl(url); })
        .catch(() => { if (!cancelled) setQrDataUrl(''); });
    }
    return () => { cancelled = true; };
  }, [format, size, value]);
  useEffect(() => {
    if (format === 'barcode' && barcodeRef.current && value) {
      JsBarcode(barcodeRef.current, value, { format: 'CODE128', displayValue: true, lineColor: '#10242d', background: '#f7f4ee', margin: 8, width: size === 'small' ? 1.5 : 2, height: size === 'small' ? 54 : 120, fontSize: size === 'small' ? 9 : 14 });
    }
  }, [format, size, value]);
  if (format === 'barcode') {
    return <div className={`flex items-center justify-center bg-card p-5 ${size === 'small' ? 'h-24' : 'h-44'}`} data-testid="visual-barcode"><svg ref={barcodeRef} className="max-w-full" role="img" aria-label={`Barcode for ${value}`} /></div>;
  }
  return <div className={`grid place-items-center bg-card ${size === 'small' ? 'size-28 p-3' : 'size-56 p-5 sm:size-64'}`} data-testid="visual-qrcode">{qrDataUrl ? <img src={qrDataUrl} alt={`QR code for ${value}`} className="size-full object-contain" /> : <div className="size-full animate-pulse rounded bg-muted" />}</div>;
}

export async function downloadGeneration(value: string, format: 'qrcode' | 'barcode', id = 'scanforge-code', options?: { width?: number; height?: number; foreground?: string; background?: string; errorCorrection?: 'L' | 'M' | 'Q' | 'H' }) {
  const width = options?.width ?? 2048;
  const height = options?.height ?? (format === 'barcode' ? Math.round(width / 2.5) : width);
  let svg = '';
  if (format === 'qrcode') {
    svg = await QRCode.toString(value, { type: 'svg', width, margin: 2, errorCorrectionLevel: options?.errorCorrection ?? 'M', color: { dark: options?.foreground ?? '#10242d', light: options?.background ?? '#f7f4ee' } });
  } else {
    const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(node, value, { format: 'CODE128', displayValue: true, lineColor: options?.foreground ?? '#10242d', background: options?.background ?? '#f7f4ee', margin: 32, width: Math.max(2, width / 600), height: Math.max(120, height * 0.55), fontSize: Math.max(18, width / 55) });
    node.setAttribute('width', String(width));
    node.setAttribute('height', String(height));
    svg = new XMLSerializer().serializeToString(node);
  }
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${id}.${format}.svg`; anchor.click(); URL.revokeObjectURL(url);
}

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <div className="scan-grid flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/55 p-8 text-center"><div className="grid size-12 place-items-center rounded-full border border-border bg-background text-primary"><Sparkles className="size-5" /></div><h2 className="mt-4 text-base font-semibold">{title}</h2><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{detail}</p>{action && <div className="mt-5">{action}</div>}</div>;
}