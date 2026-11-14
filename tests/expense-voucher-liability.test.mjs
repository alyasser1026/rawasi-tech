import test from 'node:test';
import assert from 'node:assert/strict';

function resolveExpenseVoucherAccounts(expenseRow, accountsList, selectedPaymentMethod = 'نقدي') {
    // 1. Resolve credit account based on payment method
    let resolvedCreditId = null;
    let resolvedCreditName = '';
    let resolvedCreditCode = '';

    const isBankOrCheque = ['شيك', 'تحويل بنكي'].includes(selectedPaymentMethod);
    const treasury = accountsList.find(a => String(a.code) === '122' || (a.name || '').includes('خزينة') || (a.name || '').includes('صندوق'));
    const bank = accountsList.find(a => (a.name || '').includes('بنك') || String(a.code).startsWith('121') || String(a.code).startsWith('129'));

    if (isBankOrCheque && bank) {
        resolvedCreditId = bank.id;
        resolvedCreditName = bank.name;
        resolvedCreditCode = bank.code;
    } else if (treasury) {
        resolvedCreditId = treasury.id;
        resolvedCreditName = treasury.name;
        resolvedCreditCode = treasury.code;
    }

    // 2. Resolve debit account: MUST BE THE LIABILITY ACCOUNT (payment_account), NOT THE COST ACCOUNT (creditor_account)
    let resolvedDebitId = null;
    let resolvedDebitName = '';
    let resolvedDebitCode = '';

    if (expenseRow.payment_account) {
        const foundLiability = accountsList.find(a =>
            String(a.code) === expenseRow.payment_account ||
            a.name === expenseRow.payment_account ||
            `${a.code} - ${a.name}` === expenseRow.payment_account ||
            (expenseRow.payment_account.includes(' - ') && a.name === expenseRow.payment_account.split(' - ')[1]?.trim()) ||
            (expenseRow.payment_account.includes(' - ') && String(a.code) === expenseRow.payment_account.split(' - ')[0]?.trim())
        );
        if (foundLiability) {
            resolvedDebitId = foundLiability.id;
            resolvedDebitName = foundLiability.name;
            resolvedDebitCode = foundLiability.code;
        }
    }

    if (!resolvedDebitId && (expenseRow.partner_id || expenseRow.payee_id)) {
        const foundPartner = accountsList.find(a => ['211', '212', '219'].includes(String(a.code)));
        if (foundPartner) {
            resolvedDebitId = foundPartner.id;
            resolvedDebitName = foundPartner.name;
            resolvedDebitCode = foundPartner.code;
        }
    }

    if (!resolvedDebitId && expenseRow.creditor_account) {
        const fallback = accountsList.find(a =>
            String(a.code) === expenseRow.creditor_account ||
            a.name === expenseRow.creditor_account ||
            `${a.code} - ${a.name}` === expenseRow.creditor_account
        );
        if (fallback) {
            resolvedDebitId = fallback.id;
            resolvedDebitName = fallback.name;
            resolvedDebitCode = fallback.code;
        }
    }

    return {
        debit_account_id: resolvedDebitId,
        debit_account_name: resolvedDebitName,
        debit_account_code: resolvedDebitCode,
        credit_account_id: resolvedCreditId,
        credit_account_name: resolvedCreditName,
        credit_account_code: resolvedCreditCode,
    };
}

const mockAccounts = [
    { id: 'acc-122', code: '122', name: 'الخزينة الرئيسية' },
    { id: 'acc-1291', code: '1291', name: 'بنك الراجحي ( حساب طفله )' },
    { id: 'acc-219', code: '219', name: 'التزامات اخرى' },
    { id: 'acc-211', code: '211', name: 'الموردين (مواد بناء)' },
    { id: 'acc-212', code: '212', name: 'التزام مقاولي الباطن' },
    { id: 'acc-518', code: '518', name: 'أدوات ومهمات صغيرة' },
    { id: 'acc-517', code: '517', name: 'انتقالات ومشالات' },
    { id: 'acc-522', code: '522', name: 'إيجار مقر الشركة الرئيسي' }
];

test('Expense payment voucher: debit MUST be liability account (219) and not cost account (518)', () => {
    const expense = {
        description: 'اكرامية نجارين',
        creditor_account: 'أدوات ومهمات صغيرة', // Cost (518)
        payment_account: 'التزامات اخرى',       // Liability (219)
    };

    const voucher = resolveExpenseVoucherAccounts(expense, mockAccounts, 'نقدي');

    assert.equal(voucher.debit_account_code, '219', 'Debit account must be the liability account (219)');
    assert.equal(voucher.debit_account_name, 'التزامات اخرى');
    assert.notEqual(voucher.debit_account_code, '518', 'Debit account must NOT be the expense/cost account (518)');
    assert.equal(voucher.credit_account_code, '122', 'Cash payment must credit treasury 122');
});

test('Expense payment voucher: cheque/bank payment credits bank account and debits liability', () => {
    const expense = {
        description: 'دفعة مقاول رخام',
        creditor_account: '511 - تكاليف مقاولين',
        payment_account: '212 - التزام مقاولي الباطن',
    };

    const voucherCheque = resolveExpenseVoucherAccounts(expense, mockAccounts, 'شيك');

    assert.equal(voucherCheque.debit_account_code, '212', 'Debit must be subcontractor liability (212)');
    assert.equal(voucherCheque.credit_account_code, '1291', 'Cheque payment must credit bank account (1291)');

    const voucherTransfer = resolveExpenseVoucherAccounts(expense, mockAccounts, 'تحويل بنكي');
    assert.equal(voucherTransfer.credit_account_code, '1291', 'Bank transfer must credit bank account (1291)');
});

test('General ledger balance: verifies that expense is recorded once and liability is closed', () => {
    // 1. Expense posted entry:
    // Dr. Cost 518: 100
    // Cr. Liability 219: 100
    const expenseLines = [
        { account: '518', debit: 100, credit: 0 },
        { account: '219', debit: 0, credit: 100 }
    ];

    // 2. Correct payment voucher entry:
    // Dr. Liability 219: 100
    // Cr. Cash 122: 100
    const paymentLines = [
        { account: '219', debit: 100, credit: 0 },
        { account: '122', debit: 0, credit: 100 }
    ];

    const allLines = [...expenseLines, ...paymentLines];

    const balances = allLines.reduce((acc, l) => {
        acc[l.account] = (acc[l.account] || 0) + (l.debit - l.credit);
        return acc;
    }, {});

    assert.equal(balances['518'], 100, 'Cost account must have net debit of 100 (recorded exactly once)');
    assert.equal(balances['219'], 0, 'Liability account must be fully closed to 0');
    assert.equal(balances['122'], -100, 'Treasury account must have net credit of 100 (cash outflow)');
});
