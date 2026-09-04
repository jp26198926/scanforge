import { useState } from 'react';
import {
  useCancelBasicSubscription,
  useCreateBasicCheckout,
  useGetBasicSubscription,
  useListPlans,
} from '@workspace/api-client-react';
import type { Plan } from '@workspace/api-client-react';
import { ArrowRight, Check, RefreshCw, ShieldCheck } from 'lucide-react';
import { PageIntro, primaryButton, secondaryButton } from '@/components/scanforge-shell';
import { getScanforgeHeaders } from '@/lib/session';

const fallbackPlans: Plan[] = [
  { id: 'anonymous', name: 'Anonymous', price: 0, interval: 'none', dailyLimit: 1, description: 'Try one single entry without an account.', highlighted: false },
  { id: 'starter', name: 'Starter', price: 0, interval: 'none', dailyLimit: 3, description: 'Three daily transactions for single or bulk generation.', highlighted: false },
  { id: 'basic', name: 'Basic', price: 5, interval: 'monthly', dailyLimit: 50, description: 'Fifty daily transactions for growing teams.', highlighted: true },
];

export default function PricingPage() {
  const { data, isLoading, isError, refetch } = useListPlans();
  const billing = useGetBasicSubscription({ request: { headers: getScanforgeHeaders() } });
  const checkout = useCreateBasicCheckout({ request: { headers: getScanforgeHeaders() } });
  const cancel = useCancelBasicSubscription({ request: { headers: getScanforgeHeaders() } });
  const [message, setMessage] = useState('');
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [checkoutState, setCheckoutState] = useState<'idle' | 'pending' | 'active' | 'error'>('idle');
  const plans = data && data.length > 0 ? data : fallbackPlans;

  function errorMessage(error: unknown) {
    if (typeof error === 'object' && error !== null && 'data' in error) {
      const data = (error as { data?: unknown }).data;
      if (typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string') {
        return data.error;
      }
    }
    return error instanceof Error ? error.message : 'PayPal checkout could not be started. Try again.';
  }

  function selectPlan(plan: Plan) {
    if (plan.price === 0) {
      setMessage('You are already set up on the anonymous tier.');
      return;
    }
    if (visibleBillingState === 'pending' && visibleCheckoutUrl) {
      setMessage('Continue the pending PayPal checkout to activate Basic.');
      window.open(visibleCheckoutUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    setMessage('');
    setCheckoutState('pending');
    checkout.mutate(undefined, {
      onSuccess: (response) => {
        setCheckoutUrl(response.approvalUrl ?? '');
        setCheckoutState(response.status);
        setMessage(response.message ?? 'Basic subscription cancelled.');
        void billing.refetch();
      },
      onError: (error) => {
        setCheckoutState('error');
        setCheckoutUrl('');
        setMessage(errorMessage(error));
      },
    });
  }

  function cancelSubscription() {
    setMessage('');
    cancel.mutate(undefined, {
      onSuccess: (response) => {
        setCheckoutUrl('');
        setCheckoutState('idle');
        setMessage(response.message ?? 'Basic subscription cancelled.');
        void billing.refetch();
      },
      onError: (error) => {
        setMessage(errorMessage(error));
      },
    });
  }

  const serverBillingState = billing.data?.status ?? 'inactive';
  const visibleBillingState = checkoutState === 'idle' ? serverBillingState : checkoutState;
  const visibleCheckoutUrl = checkoutUrl || billing.data?.approvalUrl || '';

  return (
    <div>
      <PageIntro eyebrow="Capacity / 03" title="Room to run the line." detail="Start without an account. Upgrade when your queue gets serious — no surprise limits hiding behind the button." />
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-secondary/50 bg-secondary/20 p-4 text-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-foreground" />
        <p><span className="font-semibold">All plans export the same crisp output.</span> <span className="text-muted-foreground">Plans change your daily capacity, not your code quality.</span></p>
      </div>
      {isError && <div className="mb-6 flex items-center justify-between rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-xs text-destructive"><span>Live plan details are unavailable. Showing current standard tiers.</span><button type="button" onClick={() => refetch()} data-testid="button-retry-plans" className="font-semibold underline">Retry</button></div>}
      {visibleBillingState !== 'inactive' && (
        <div className={`mb-6 rounded-md border px-4 py-3 text-xs ${visibleBillingState === 'error' ? 'border-destructive/25 bg-destructive/5 text-destructive' : 'border-primary/25 bg-primary/5'}`} data-testid={`status-billing-${visibleBillingState}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold uppercase tracking-[0.12em]">{visibleBillingState === 'active' ? 'Basic active' : visibleBillingState === 'pending' ? 'Checkout pending' : 'Checkout error'}</p>
              <p className="mt-1 text-muted-foreground">{message || billing.data?.message}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              {visibleCheckoutUrl && visibleBillingState === 'pending' && <a href={visibleCheckoutUrl} target="_blank" rel="noreferrer" className="font-semibold underline">Continue in PayPal</a>}
              {visibleBillingState === 'active' && <button type="button" onClick={cancelSubscription} disabled={cancel.isPending} data-testid="button-cancel-basic" className="font-semibold text-destructive underline disabled:opacity-50">{cancel.isPending ? 'Cancelling…' : 'Cancel Basic'}</button>}
            </div>
          </div>
        </div>
      )}
      {isLoading ? <div className="grid gap-4 md:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-80 animate-pulse rounded-lg border border-border bg-card" />)}</div> : <div className="grid gap-4 md:grid-cols-3">
        {plans.filter((plan) => plan.id !== 'admin').map((plan) => {
          const isBasicActive = plan.id === 'basic' && visibleBillingState === 'active';
          const isBasicPending = plan.id === 'basic' && visibleBillingState === 'pending';
          return <article key={plan.id} className={`relative flex min-h-[335px] flex-col rounded-lg border bg-card p-6 shadow-sm ${plan.highlighted ? 'border-primary ring-1 ring-primary' : 'border-border'}`} data-testid={`card-plan-${plan.id}`}>
            {plan.highlighted && <span className="absolute -top-3 left-5 rounded-full bg-primary px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-foreground">Most useful</span>}
            <div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold">{plan.name}</h2><p className="mt-2 max-w-[200px] text-sm leading-5 text-muted-foreground">{plan.description}</p></div><span className="rounded-full bg-muted px-2 py-1 font-mono text-[10px] uppercase text-muted-foreground">{plan.dailyLimit}/day</span></div>
            <div className="mt-8 flex items-baseline gap-1"><span className="text-4xl font-semibold tracking-[-0.05em]">{plan.price === 0 ? 'Free' : `$${plan.price}`}</span>{plan.price > 0 && <span className="text-xs text-muted-foreground">/ month</span>}</div>
            <ul className="mt-7 space-y-3 text-xs text-muted-foreground"><li className="flex gap-2"><Check className="size-3.5 text-primary" /> High-resolution QR and barcode output</li><li className="flex gap-2"><Check className="size-3.5 text-primary" /> Single and bulk entry modes</li><li className="flex gap-2"><Check className="size-3.5 text-primary" /> Downloadable generation history</li></ul>
             <button type="button" onClick={() => selectPlan(plan)} disabled={plan.id === 'basic' && (checkout.isPending || isBasicActive || cancel.isPending)} data-testid={`button-select-plan-${plan.id}`} className={`${plan.highlighted ? primaryButton : secondaryButton} mt-auto w-full disabled:cursor-not-allowed disabled:opacity-60`}>
              {plan.price === 0 ? 'Use free tier' : checkout.isPending ? 'Starting checkout…' : isBasicActive ? 'Basic is active' : isBasicPending && visibleCheckoutUrl ? 'Continue in PayPal' : visibleBillingState === 'error' ? 'Try Basic again' : 'Choose Basic'} {plan.price > 0 && !isBasicActive && <ArrowRight className="size-3.5" />}
            </button>
          </article>;
        })}
      </div>}
      {message && visibleBillingState === 'inactive' && <div className="mt-6 flex items-center justify-between gap-4 rounded-md border border-primary/25 bg-primary/5 px-4 py-3 text-xs" data-testid="status-plan-selection"><span>{message}</span><button type="button" onClick={() => setMessage('')} className="text-muted-foreground underline" data-testid="button-dismiss-plan-message">Dismiss</button></div>}
      <p className="mt-8 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"><RefreshCw className="size-3" /> Limits reset daily at the time shown in your workspace</p>
    </div>
  );
}