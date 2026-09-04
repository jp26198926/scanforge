import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useGenerateCode, useSaveGenerationAsset, getGetUsageQueryKey, getListGenerationsQueryKey } from '@workspace/api-client-react';
import type { GenerateInput, Generation } from '@workspace/api-client-react';
import { ArrowRight, Check, ClipboardPaste, CloudUpload, Download, ExternalLink, FileText, Info, LoaderCircle, SlidersHorizontal, Sparkles, Upload, Zap } from 'lucide-react';
import { buildGenerationAsset, CodeVisual, EmptyState, PageIntro, primaryButton, UsageMeter, downloadGeneration, downloadGenerationAsset, type GenerationExportOptions } from '@/components/scanforge-shell';
import { getScanforgeHeaders } from '@/lib/session';

type Format = GenerateInput['format'];

export default function Home() {
  const queryClient = useQueryClient();
  const generateCode = useGenerateCode({ request: { headers: getScanforgeHeaders() } });
  const saveGenerationAsset = useSaveGenerationAsset({ request: { headers: getScanforgeHeaders() } });
  const [format, setFormat] = useState<Format>('qrcode');
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [value, setValue] = useState('');
  const [bulkValue, setBulkValue] = useState('');
  const [width, setWidth] = useState('1024');
  const [height, setHeight] = useState('1024');
  const [foreground, setForeground] = useState('#10242d');
  const [background, setBackground] = useState('#f7f4ee');
  const [errorCorrection, setErrorCorrection] = useState<'L' | 'M' | 'Q' | 'H'>('M');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [result, setResult] = useState<Generation | null>(null);
  const [notice, setNotice] = useState('');
  const [assetNotice, setAssetNotice] = useState('');
  const [savingFormat, setSavingFormat] = useState<'svg' | 'png' | null>(null);

  const entries = bulkValue.split('\n').map((entry) => entry.trim()).filter(Boolean);
  const activeValue = mode === 'single' ? value.trim() : entries[0] || '';
  const exportOptions: GenerationExportOptions = { width: Number(width), height: Number(height), foreground, background, errorCorrection };

  async function saveAsset(outputFormat: 'svg' | 'png') {
    if (!result) return;
    setSavingFormat(outputFormat);
    setAssetNotice('');
    try {
      const asset = await buildGenerationAsset(result.value || activeValue, result.format, outputFormat, exportOptions);
      const savedGeneration = await saveGenerationAsset.mutateAsync({
        id: result.id,
        data: { asset, format: outputFormat },
      });
      setResult(savedGeneration);
      setAssetNotice(`${outputFormat.toUpperCase()} saved to Cloudinary.`);
      queryClient.invalidateQueries({ queryKey: getListGenerationsQueryKey() });
    } catch (error) {
      setAssetNotice(error instanceof Error ? error.message : 'The asset could not be saved. Local downloads are still available.');
    } finally {
      setSavingFormat(null);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setNotice('');
    if (!activeValue) { setNotice(mode === 'single' ? 'Add a URL, text, or product reference to continue.' : 'Add at least one line to create a batch.'); return; }
    const payload: GenerateInput = {
      format,
      ...(mode === 'single' ? { value: activeValue } : { entries }),
      options: { width: Number(width), height: Number(height), foreground, background, errorCorrection: format === 'qrcode' ? errorCorrection : undefined },
    };
    generateCode.mutate({ data: payload }, {
      onSuccess: (generation) => {
        setResult(generation);
        setNotice(mode === 'bulk' ? `${generation.entryCount || entries.length} codes queued for export.` : 'Your code is ready to download.');
        queryClient.invalidateQueries({ queryKey: getGetUsageQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListGenerationsQueryKey() });
      },
      onError: (error) => setNotice(error instanceof Error ? error.message : 'Generation could not be completed. Try again.'),
    });
  }

  return (
    <div>
      <PageIntro eyebrow="Code station / 01" title="Make something scannable." detail="Production-ready QR codes and barcodes, without the busywork. Set your output once, then let ScanForge handle the sharp edges." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="fade-up-delay rounded-lg border border-border bg-card p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div><div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-md bg-primary/10 text-primary"><Zap className="size-4" /></span><h2 className="text-base font-semibold">New generation</h2></div><p className="mt-2 text-sm text-muted-foreground">Choose a format, add your source, and export at print quality.</p></div>
            <div className="flex rounded-md border border-border bg-muted/60 p-1" role="tablist" aria-label="Code format">
              {(['qrcode', 'barcode'] as Format[]).map((item) => <button key={item} type="button" role="tab" aria-selected={format === item} onClick={() => { setFormat(item); setResult(null); }} data-testid={`button-format-${item}`} className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${format === item ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{item === 'qrcode' ? 'QR code' : 'Barcode'}</button>)}
            </div>
          </div>

          <form onSubmit={submit} className="mt-6">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">Source data</label>
              <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
                <button type="button" onClick={() => setMode('single')} data-testid="button-mode-single" className={`rounded px-2.5 py-1 text-[11px] font-semibold ${mode === 'single' ? 'bg-foreground text-background' : 'text-muted-foreground'}`}>Single</button>
                <button type="button" onClick={() => setMode('bulk')} data-testid="button-mode-bulk" className={`rounded px-2.5 py-1 text-[11px] font-semibold ${mode === 'bulk' ? 'bg-foreground text-background' : 'text-muted-foreground'}`}>Bulk entry</button>
              </div>
            </div>
            {mode === 'single' ? (
              <div className="relative mt-3">
                <textarea value={value} onChange={(event) => setValue(event.target.value)} placeholder={format === 'qrcode' ? 'https://scanforge.tools/your-destination' : 'Product code or SKU'} rows={5} data-testid="input-source-single" className="w-full resize-none rounded-md border border-input bg-background px-4 py-3 text-sm leading-6 outline-none transition-colors placeholder:text-muted-foreground/55 focus:border-primary focus:ring-2 focus:ring-primary/15" />
                <span className="absolute bottom-3 right-3 font-mono text-[10px] text-muted-foreground/60">{value.length} chars</span>
              </div>
            ) : (
              <div className="mt-3">
                <textarea value={bulkValue} onChange={(event) => setBulkValue(event.target.value)} placeholder={'SKU-1001\nSKU-1002\nSKU-1003'} rows={7} data-testid="input-source-bulk" className="w-full resize-none rounded-md border border-input bg-background px-4 py-3 font-mono text-sm leading-6 outline-none transition-colors placeholder:font-sans placeholder:text-muted-foreground/55 focus:border-primary focus:ring-2 focus:ring-primary/15" />
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground"><span className="flex items-center gap-1.5"><ClipboardPaste className="size-3.5" /> One entry per line</span><span className="font-mono" data-testid="text-bulk-count">{entries.length} entries</span></div>
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={() => setShowAdvanced((current) => !current)} data-testid="button-toggle-advanced" className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"><SlidersHorizontal className="size-3.5" /> {showAdvanced ? 'Hide' : 'Show'} output settings</button>
              <button type="submit" disabled={generateCode.isPending} data-testid="button-generate" className={primaryButton}>{generateCode.isPending ? <><LoaderCircle className="size-4 animate-spin" /> Building output</> : <><Sparkles className="size-4" /> Generate {format === 'qrcode' ? 'QR code' : 'barcode'} <ArrowRight className="size-4" /></>}</button>
            </div>
            {showAdvanced && <div className="mt-5 grid gap-4 rounded-md border border-border bg-muted/35 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs font-semibold">Width <input type="number" min="256" max="4096" value={width} onChange={(event) => setWidth(event.target.value)} data-testid="input-width" className="mt-2 w-full rounded border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus:border-primary" /></label>
              <label className="text-xs font-semibold">Height <input type="number" min="256" max="4096" value={height} onChange={(event) => setHeight(event.target.value)} data-testid="input-height" className="mt-2 w-full rounded border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus:border-primary" /></label>
              <label className="text-xs font-semibold">Ink <span className="mt-2 flex items-center gap-2 rounded border border-input bg-background px-2 py-1.5"><input type="color" value={foreground} onChange={(event) => setForeground(event.target.value)} data-testid="input-foreground" className="size-5 cursor-pointer border-0 bg-transparent" /><span className="font-mono text-[10px] text-muted-foreground">{foreground}</span></span></label>
              <label className="text-xs font-semibold">Paper <span className="mt-2 flex items-center gap-2 rounded border border-input bg-background px-2 py-1.5"><input type="color" value={background} onChange={(event) => setBackground(event.target.value)} data-testid="input-background" className="size-5 cursor-pointer border-0 bg-transparent" /><span className="font-mono text-[10px] text-muted-foreground">{background}</span></span></label>
              {format === 'qrcode' && <label className="text-xs font-semibold sm:col-span-2">Error correction <select value={errorCorrection} onChange={(event) => setErrorCorrection(event.target.value as 'L' | 'M' | 'Q' | 'H')} data-testid="select-error-correction" className="mt-2 w-full rounded border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"><option value="L">L — 7% recovery</option><option value="M">M — 15% recovery</option><option value="Q">Q — 25% recovery</option><option value="H">H — 30% recovery</option></select></label>}
              <p className="flex items-start gap-2 text-[11px] leading-5 text-muted-foreground sm:col-span-2"><Info className="mt-0.5 size-3.5 shrink-0 text-primary" /> Higher dimensions keep edges crisp on labels, packaging, and large-format print.</p>
            </div>}
            {notice && <div className={`mt-4 flex items-center gap-2 rounded-md border px-3 py-2.5 text-xs ${notice.includes('could not') || notice.includes('Add ') ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-primary/25 bg-primary/5 text-foreground'}`} data-testid="status-generation"><Check className="size-3.5 text-primary" /> {notice}</div>}
          </form>
        </section>

        <aside className="space-y-6">
          <UsageMeter />
          <div className="rounded-lg border border-border bg-foreground p-5 text-background">
            <div className="flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-background/55">Output preview</p><span className="rounded bg-background/10 px-2 py-1 font-mono text-[10px] uppercase text-background/60">{result ? 'Ready' : 'Standby'}</span></div>
            <div className="mt-5 grid min-h-[260px] place-items-center rounded-md bg-background p-6">
              {result ? <div className="flex flex-col items-center gap-4"><CodeVisual value={result.value || activeValue} format={result.format} size="small" /><p className="max-w-[210px] truncate font-mono text-[10px] text-muted-foreground">{result.value || activeValue}</p></div> : <EmptyState title="Nothing on the platen" detail="Your generated mark will appear here, ready for a clean export." />}
            </div>
            {result && <div className="mt-4 space-y-2">
              <button type="button" onClick={() => downloadGeneration(result.value || activeValue, result.format, result.id, exportOptions)} data-testid="button-download-preview" className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"><Download className="size-3.5" /> Download SVG</button>
              <button type="button" onClick={() => downloadGenerationAsset(result.value || activeValue, result.format, 'png', result.id, exportOptions)} data-testid="button-download-png-preview" className="flex w-full items-center justify-center gap-2 rounded-md border border-background/20 bg-background/10 px-3 py-2.5 text-xs font-semibold text-background transition-colors hover:bg-background/20"><Download className="size-3.5" /> Download PNG</button>
              <button type="button" onClick={() => saveAsset('svg')} disabled={savingFormat !== null} data-testid="button-save-svg" className="flex w-full items-center justify-center gap-2 rounded-md border border-background/20 bg-background/10 px-3 py-2.5 text-xs font-semibold text-background transition-colors hover:bg-background/20 disabled:pointer-events-none disabled:opacity-50"><CloudUpload className="size-3.5" /> {savingFormat === 'svg' ? 'Saving SVG…' : 'Save SVG to Cloudinary'}</button>
              <button type="button" onClick={() => saveAsset('png')} disabled={savingFormat !== null} data-testid="button-save-png" className="flex w-full items-center justify-center gap-2 rounded-md border border-background/20 bg-background/10 px-3 py-2.5 text-xs font-semibold text-background transition-colors hover:bg-background/20 disabled:pointer-events-none disabled:opacity-50"><CloudUpload className="size-3.5" /> {savingFormat === 'png' ? 'Saving PNG…' : 'Save PNG to Cloudinary'}</button>
              {result.assetUrl && <a href={result.assetUrl} target="_blank" rel="noreferrer" data-testid="link-open-saved-asset" className="flex items-center justify-center gap-2 px-3 py-2 text-[11px] font-semibold text-background/75 underline underline-offset-2 hover:text-background"><ExternalLink className="size-3.5" /> Open saved asset</a>}
              {assetNotice && <p className="rounded-md border border-background/15 bg-background/10 px-3 py-2 text-[11px] leading-5 text-background/80" data-testid="status-asset-save">{assetNotice}</p>}
            </div>}
          </div>
        </aside>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[{ icon: FileText, title: 'Print-ready by default', copy: '256–4096px output with deliberate error correction.' }, { icon: Upload, title: 'Batch when it matters', copy: 'Paste a list and keep every entry in one generation.' }, { icon: Sparkles, title: 'No design degree needed', copy: 'A focused surface for the task in front of you.' }].map(({ icon: Icon, title, copy }) => <div key={title} className="flex gap-3 border-t border-border pt-4"><Icon className="mt-0.5 size-4 shrink-0 text-primary" /><div><h3 className="text-xs font-semibold">{title}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{copy}</p></div></div>)}
      </div>
    </div>
  );
}