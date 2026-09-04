import { useListGenerations } from '@workspace/api-client-react';
import type { Generation } from '@workspace/api-client-react';
import { Download, ExternalLink, History as HistoryIcon, RefreshCw } from 'lucide-react';
import { CodeVisual, EmptyState, PageIntro, primaryButton, secondaryButton, downloadGeneration } from '@/components/scanforge-shell';
import { getScanforgeHeaders } from '@/lib/session';

function GenerationRow({ generation }: { generation: Generation }) {
  const label = generation.format === 'qrcode' ? 'QR code' : 'Barcode';
  return <div className="group grid gap-4 border-b border-border px-4 py-4 transition-colors hover:bg-muted/35 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:px-5" data-testid={`row-generation-${generation.id}`}>
    <div className="grid size-14 place-items-center overflow-hidden rounded-md border border-border bg-background"><CodeVisual value={generation.value} format={generation.format} size="small" /></div>
    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">{label}</span><span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{generation.status}</span>{generation.entryCount > 1 && <span className="font-mono text-[10px] text-primary">{generation.entryCount} entries</span>}</div><p className="mt-1 truncate font-mono text-xs text-muted-foreground">{generation.value}</p><p className="mt-1 text-[11px] text-muted-foreground">{new Date(generation.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p></div>
    <div className="flex flex-col gap-2 sm:items-end">
      <button type="button" onClick={() => downloadGeneration(generation.value, generation.format, generation.id)} data-testid={`button-download-${generation.id}`} className={`${secondaryButton} w-full sm:w-auto`}><Download className="size-3.5" /> Download</button>
      {generation.assetUrl && <a href={generation.assetUrl} target="_blank" rel="noreferrer" data-testid={`link-open-asset-${generation.id}`} className="inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold text-primary underline underline-offset-2 hover:text-foreground"><ExternalLink className="size-3.5" /> Open saved asset</a>}
    </div>
  </div>;
}

export default function HistoryPage() {
  const { data, isLoading, isError, refetch } = useListGenerations({ request: { headers: getScanforgeHeaders() } });
  return <div><PageIntro eyebrow="Archive / 02" title="Recent generations." detail="A tidy record of every mark made in this workspace. Download a fresh SVG whenever you need it." /><div className="rounded-lg border border-border bg-card shadow-sm">
    <div className="flex items-center justify-between border-b border-border px-4 py-4 sm:px-5"><div className="flex items-center gap-2"><HistoryIcon className="size-4 text-primary" /><h2 className="text-sm font-semibold">Generation log</h2></div><span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{data?.length ?? 0} records</span></div>
    {isLoading && <div className="space-y-3 p-5">{[1, 2, 3].map((item) => <div key={item} className="flex animate-pulse gap-4"><div className="size-14 rounded-md bg-muted" /><div className="flex-1"><div className="h-3 w-40 rounded bg-muted" /><div className="mt-3 h-3 w-3/4 rounded bg-muted" /><div className="mt-2 h-2 w-24 rounded bg-muted" /></div></div>)}</div>}
    {isError && <div className="p-6 text-center"><p className="text-sm font-semibold">The archive could not be loaded.</p><p className="mt-1 text-xs text-muted-foreground">The generation service may be taking a short break.</p><button type="button" onClick={() => refetch()} data-testid="button-retry-history" className={`${primaryButton} mt-4`}><RefreshCw className="size-3.5" /> Try again</button></div>}
    {!isLoading && !isError && (!data || data.length === 0) && <div className="p-5"><EmptyState title="Your archive is quiet." detail="Generate your first code and it will land here with a downloadable, print-ready result." /></div>}
    {!isLoading && !isError && data && data.length > 0 && <div>{data.map((generation) => <GenerationRow key={generation.id} generation={generation} />)}</div>}
  </div></div>;
}