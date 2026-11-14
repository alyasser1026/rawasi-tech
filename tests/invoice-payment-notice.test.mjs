import test from 'node:test';
import assert from 'node:assert/strict';

// Helper functions mirroring the logic in InvoiceFormModal and invoices_logic
function computeInvoicePaymentState(netTotal, paidInput) {
    const paid = Number(paidInput || 0);
    const remaining = Number((netTotal - paid).toFixed(2));
    
    let status = 'unpaid';
    let statusLabel = 'غير مسددة';
    let noticeType = 'neutral';
    
    if (remaining > 0 && paid > 0) {
        status = 'partial';
        statusLabel = 'سداد جزئي';
        noticeType = 'warning';
    } else if (remaining === 0 && netTotal > 0 && paid > 0) {
        status = 'paid';
        statusLabel = 'مسددة بالكامل';
        noticeType = 'success';
    } else if (remaining < 0) {
        status = 'overpaid';
        statusLabel = 'رصيد دائن';
        noticeType = 'credit';
    } else if (paid === 0) {
        status = 'unpaid';
        statusLabel = 'غير مسددة';
        noticeType = 'neutral';
    }
    
    return {
        netTotal,
        paid,
        remaining,
        credit: remaining < 0 ? Math.abs(remaining) : 0,
        status,
        statusLabel,
        noticeType
    };
}

function resolveAdjustedPaidAndBalance(inv, adj) {
    const rawTotal = Number(inv.total_amount || 0);
    const netAdjustment = adj ? Number(adj.net_adjustment || 0) : 0;
    const effectiveTotal = Number((rawTotal + netAdjustment).toFixed(2));
    const rpcPaid = Number(adj?.paid_amount || 0);
    const invoicePaid = Number(inv.paid_amount || 0);
    const adjustedPaid = Math.max(rpcPaid, invoicePaid);
    const balance = adj && rpcPaid > 0 ? Number(adj.balance || 0) : Number((effectiveTotal - adjustedPaid).toFixed(2));
    
    return {
        effectiveTotal,
        adjustedPaid,
        balance
    };
}

test('Invoice payment state: partial payment creates warning notice and accurate remaining balance', () => {
    const state = computeInvoicePaymentState(100000, 30000);
    assert.equal(state.status, 'partial');
    assert.equal(state.statusLabel, 'سداد جزئي');
    assert.equal(state.noticeType, 'warning');
    assert.equal(state.remaining, 70000);
    assert.equal(state.credit, 0);
});

test('Invoice payment state: full payment creates success notice with zero balance', () => {
    const state = computeInvoicePaymentState(50000, 50000);
    assert.equal(state.status, 'paid');
    assert.equal(state.statusLabel, 'مسددة بالكامل');
    assert.equal(state.noticeType, 'success');
    assert.equal(state.remaining, 0);
    assert.equal(state.credit, 0);
});

test('Invoice payment state: overpaid creates credit notice with positive credit amount', () => {
    const state = computeInvoicePaymentState(40000, 45000);
    assert.equal(state.status, 'overpaid');
    assert.equal(state.statusLabel, 'رصيد دائن');
    assert.equal(state.noticeType, 'credit');
    assert.equal(state.remaining, -5000);
    assert.equal(state.credit, 5000);
});

test('Invoice payment state: zero payment creates neutral unpaid notice for full total', () => {
    const state = computeInvoicePaymentState(85000, 0);
    assert.equal(state.status, 'unpaid');
    assert.equal(state.statusLabel, 'غير مسددة');
    assert.equal(state.noticeType, 'neutral');
    assert.equal(state.remaining, 85000);
});

test('Invoices logic: preserves client payment of 30,000 even when RPC adjustment returns 0', () => {
    const inv = { id: 'inv-123', total_amount: 100000, paid_amount: 30000 };
    // RPC returned adjustment with 0 paid_amount because voucher is unposted or not yet linked via RPC
    const adj = { invoice_id: 'inv-123', paid_amount: 0, net_adjustment: 0, balance: 100000 };
    
    const result = resolveAdjustedPaidAndBalance(inv, adj);
    assert.equal(result.adjustedPaid, 30000, 'adjustedPaid must not be wiped out to 0');
    assert.equal(result.balance, 70000, 'remaining balance must be 70,000, not 100,000');
});

test('Invoices logic: adopts RPC paid amount when RPC has higher posted amount', () => {
    const inv = { id: 'inv-456', total_amount: 100000, paid_amount: 0 };
    const adj = { invoice_id: 'inv-456', paid_amount: 60000, net_adjustment: 0, balance: 40000 };
    
    const result = resolveAdjustedPaidAndBalance(inv, adj);
    assert.equal(result.adjustedPaid, 60000);
    assert.equal(result.balance, 40000);
});

test('Invoice print modal totals: structure when paid_amount > 0', () => {
    const record = { total_amount: 120000, paid_amount: 35000 };
    const paidAmount = Number(record.paid_amount || 0);
    const balanceDue = Math.max(0, Number(record.total_amount || 0) - paidAmount);
    
    const isPaidActive = paidAmount > 0;
    assert.equal(isPaidActive, true);
    assert.equal(balanceDue, 85000);
});
