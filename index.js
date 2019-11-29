const financePortalLib = require('@mojaloop/finance-portal-lib');
const Big = require('big.js');

const { util: settlementLib, api: Model } = financePortalLib.settlement;
const { api: adminApi } = financePortalLib.admin;
const util = require('util');
const express = require('express');
const lib = require('./lib');
const config = require('./config');
const Database = require('./db');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const db = new Database(config.db);
// TODO: Use closeWindow below
// const closeWindow = './closeWindow.js';
const port = 5000;

const VERBOSE = true;
// eslint-disable-next-line no-console
const logger = (...args) => console.log(`[${(new Date()).toISOString()}]`, ...args);
const verbose = (...args) => {
    if (VERBOSE) {
        logger(...(args.map(a => util.inspect(a, { depth: Infinity }))));
    }
};

app.get('/', (req, res) => res.send('Index page'));

// req.query.minAgeMs specifies the minimum age for the window
app.post('/close-window', async (req, res) => {
    const todo = [
        'Close open settlement window',
        'Create settlement containing closed settlement window',
        'Check all net sender DFSPs have sufficient funds for the settlement; if not, reduce their NDC',
        'Record transfers in system: set payer accounts to PS_TRANSFERS_RECORDED',
        'Record transfers in system: set payee accounts to PS_TRANSFERS_RECORDED',
        'Reserve transfers in system: set accounts to PS_TRANSFERS_RESERVED',
        'Commit transfers in system: set accounts to PS_TRANSFERS_COMMITTED',
        'Set settlement to SETTLING for payers',
        'Set settlement to SETTLING for payees',
        'Commit transfers- set transfers to COMMITTED',
        'Create payment matrix',
        'Settle transfers with settlement bank',
        'Settle transfers in system: set payer and payee accounts to SETTLED',
    ];
    const done = [];

    const completeStep = () => {
        const step = todo.shift();
        logger('Completed step:', step);
        done.push(step);
    };

    const newParticipantsAccountState = (ps, reason, state) => ps.map(p => ({
        ...p,
        accounts: p.accounts.map(a => ({ id: a.id, reason, state })),
    }));

    const filterParticipants = (ps, f) => ps
        .filter(p => p.accounts.findIndex(a => f(a.netSettlementAmount.amount)) !== -1)
        .map(p => ({ ...p, accounts: p.accounts.filter(a => f(a.netSettlementAmount.amount)) }));

    // payers settlement amount will be positive and payees will be negative
    const getPayers = ps => filterParticipants(ps, x => x > 0);
    const getPayees = ps => filterParticipants(ps, x => x < 0);

    try {
        // ALL our logic is inside the try/catch block

        if (req.query.minAgeMs !== undefined && !/\d+/.test(req.query.minAgeMs)) {
            return res.status(400).json('Invalid minimum window age. Non-negative integer expected.');
        }

        const opts = {
            endpoint: config.settlementsEp,
            minAge: req.query.minAgeMs === undefined ? config.minAge : req.query.minAgeMs,
            logger,
        };

        // close the currently open settlement window
        const settlementWindowId = await lib.closeOpenSettlementWindow(opts);
        completeStep();
        verbose('settlementWindowId', settlementWindowId);

        // Create a settlement for the just-closed settlement window
        // Looks like: { id: int, state: str, settlementWindows: [sws], participants: [ps] }
        const settlement = await lib.createSettlement({ ...opts, settlementWindowId });
        completeStep();
        verbose('settlement', settlement);
        // Result will look something like this:
        // settlement = { id: 1,
        //     state: 'SETTLED',
        //     settlementWindows:
        //     [ { id: 1,
        //         state: 'SETTLED',
        //         reason: 'All settlement accounts are settled',
        //         createdDate: '2018-11-22T23:30:03.000Z',
        //         changedDate: '2018-11-23T00:31:36.000Z' } ],
        //     participants:
        //     [ { id: 1,
        //         accounts: [ {
        //             id: 1,
        //             state: 'SETTLED',
        //             reason: 'test',
        //             netSettlementAmount: { amount: 273, currency: 'XOF' } } ] },
        //       { id: 2,
        //         accounts: [ {
        //             id: 3,
        //             state: 'SETTLED',
        //             reason: 'test',
        //             netSettlementAmount: { amount: -273, currency: 'XOF' } } ] } ] };

        // For each payer, check the account balance(difference between settlement account balance
        // and net settlement amount). If the payer does not have sufficient funds,
        // set their net debit cap equal to their difference. This reduces exposure to
        // unfunded transactions.
        const payers = getPayers(settlement.participants);
        if (payers.length > 0) {
            verbose('Checking net senders have sufficient balance to settle, otherwise reducing their net debit cap');
            await Promise.all(payers.map(async (p) => {
                const dfsp = await adminApi
                    .getParticipantByAccountId(config.adminEp, p.accounts[0].id);
                // balance on account is negative, so conversion to positive is necessary for
                // comparatives
                const payerSettlementAcccountBalance = -1 * (await adminApi
                    .getAccountByType(
                        config.adminEp,
                        dfsp.name,
                        p.accounts[0].netSettlementAmount.currency,
                        'SETTLEMENT',
                    ))
                    .value;
                const payerNetSettlementAmount = p.accounts[0].netSettlementAmount.amount;
                const payerNDC = (await adminApi
                    .getNDC(
                        config.adminEp,
                        dfsp.name,
                        p.accounts[0].netSettlementAmount.currency,
                    ))
                    .limit.value;
                if (payerNDC > (payerSettlementAcccountBalance - payerNetSettlementAmount)) {
                    const result = await adminApi
                        .setNDC(
                            config.adminEp,
                            dfsp.name,
                            p.accounts[0].netSettlementAmount.currency,
                            payerSettlementAcccountBalance - payerNetSettlementAmount,
                        );
                    logger(`Settlement amount greater than available balance. Set new NDC for ${dfsp.name}: ${result}.`);
                }
            }));
        } else verbose('No payers to process');
        completeStep();

        // Set each of the payers accounts states to PS_TRANSFERS_RECORDED (pending settlement,
        // transfers recorded). Payers first, to ensure payers have sufficient funds.
        let result = await lib.putSettlement({
            logger: verbose,
            settlementId: settlement.id,
            endpoint: config.settlementsEp,
            participants: newParticipantsAccountState(payers, 'Transfers recorded for payer', 'PS_TRANSFERS_RECORDED'),
        });
        completeStep();
        verbose('result', result);

        // Set each of the payees accounts states to PS_TRANSFERS_RECORDED (pending settlement,
        // transfers recorded).
        const payees = getPayees(settlement.participants);
        verbose('payees', payees);
        result = await lib.putSettlement({
            logger: verbose,
            settlementId: settlement.id,
            endpoint: config.settlementsEp,
            participants: newParticipantsAccountState(payees, 'Transfers recorded for payee', 'PS_TRANSFERS_RECORDED'),
        });
        completeStep();
        verbose('result', result);

        // Set each of the participants accounts states to PS_TRANSFERS_RESERVED (pending
        // settlement, transfers )
        result = await lib.putSettlement({
            logger: verbose,
            settlementId: settlement.id,
            endpoint: config.settlementsEp,
            participants: newParticipantsAccountState(settlement.participants, 'Transfers recorded for payer & payee', 'PS_TRANSFERS_RESERVED'),
        });
        completeStep();
        verbose('result', result);

        // Commit transfers for all participants
        result = await lib.putSettlement({
            logger: verbose,
            settlementId: settlement.id,
            endpoint: config.settlementsEp,
            participants: newParticipantsAccountState(settlement.participants, 'Transfers committed for payer & payee', 'PS_TRANSFERS_COMMITTED'),
        });
        completeStep();
        verbose('result', result);

        // TODO: when we automate the real-money transaction, we should store this matrix in the db
        // and explicitly store the "send date" or some sort of Citi transaction ID
        // Create the payment matrix, store it in the db
        const accounts = await db.getDfspsAccounts();
        const dfspAccounts = accounts.reduce((acc, current) => (
            {
                ...acc,
                [current.participantId]: {
                    name: current.name,
                    country: current.accountCountry,
                    accountId: current.accountNumber,
                },
            }), {}); // Probably not a good indentation. Too much LISP can change you
        const matrix = (settlement.participants.length > 0)
            ? settlementLib.generatePaymentFile(settlementWindowId, settlement, dfspAccounts)
            : 'No participants in this settlement. No file generated.';

        // Get the simplified version of the payment matrix
        const simpleMatrix = (settlement.participants.length > 0)
            ? settlementLib.minPaymentsAlgorithm(settlement)
            : null;

        let simpleFundsTransfer = [];
        if (simpleMatrix !== null) {
            const credits = [];
            // Get the debit transfers
            const debits = Object.entries(simpleMatrix.matrix)
                .map(([payer, payments]) => [simpleMatrix.currency, payer,
                    Object.values(payments).reduce((a, b) => a.plus(b), Big(0)).times(-1),
                ]);

            // Get the credit transfers
            Object.values(simpleMatrix.matrix).forEach(payments => Object.entries(payments)
                .forEach((x) => {
                    credits.push([simpleMatrix.currency, ...x]);
                }));

            // An Array containing credits and debits, this will make processing of funds easier
            simpleFundsTransfer = [...debits, ...credits];
        }

        simpleFundsTransfer = simpleFundsTransfer.length === 0 ? ''
            : JSON.stringify(simpleFundsTransfer);

        verbose('simpleFundsTransfer', simpleFundsTransfer);
        verbose('opSettlementsEp', config.opSettlementsEp);
        const sharedLib = new Model({ endpoint: config.opSettlementsEp });
        await sharedLib.postSettlementFile(settlement.id, matrix,
            simpleFundsTransfer);
        completeStep();
        verbose('matrix', matrix);

        // Reserve funds out
        payers.forEach((p) => {
            adminApi.fundsOutPrepareReserve(config.adminEp, p.accounts[0].id,
                -p.accounts[0].netSettlementAmount.amount, 'automatically scheduled settlement');
        });

        // Reserve funds in
        payees.forEach((p) => {
            adminApi.fundsInReserve(config.adminEp, p.accounts[0].id,
                p.accounts[0].netSettlementAmount.amount, 'automatically scheduled settlement');
        });

        // 'Set settlement to SETTLING for payers',
        // result = await lib.putSettlement({
        //    logger: verbose,
        //    settlementId: settlement.id,
        //    endpoint: config.settlementsEp,
        //    participants: newParticipantsAccountState(
        //      payers,
        //      'Payee: SETTLED,
        //      settlement: SETTLED',
        //      'SETTLED',
        //    )
        // });
        // completeStep();
        // verbose('result', result);

        // 'Set settlement to SETTLING for payees',
        // result = await lib.putSettlement({
        //    logger: verbose,
        //    settlementId: settlement.id,
        //    endpoint: config.settlementsEp,
        //    participants: newParticipantsAccountState(
        //      payees,
        //      'Payee: SETTLED,
        //      settlement: SETTLED',
        //      'SETTLED',
        //    )
        // });
        // completeStep();
        // verbose('result', result);

        // 'Commit transfers- set transfers to COMMITTED',
        // result = await lib.putSettlement({
        //    logger: verbose,
        //    settlementId: settlement.id,
        //    endpoint: config.settlementsEp,
        //    participants: newParticipantsAccountState(
        //      settlement.participants,
        //      'Transfers committed for payer & payee',
        //      'COMMITTED',
        //    )
        // });
        // completeStep();
        // verbose('result', result);

        try {
            // send the payment matrix to the bank
            // commit the transaction in the switch
        } catch (err) {
            // abort the settlement? what happens then?
        }

        logger('Process completed successfully', '');
        return res.status(200).json('success');

        // Send status to hub operator
    } catch (err) {
        logger('FATAL', err);
        logger('Steps completed:', done);
        logger('Steps remaining:', todo);
        return res.status(500).send(err);
    }
});

app.get('/dfsps-accounts', async (req, res) => {
    const dfspsAccounts = await db.getDfspsAccounts();
    return res.status(200).json(dfspsAccounts);
});

app.post('/dfsps-accounts', async (req, res) => {
    const {
        participantId,
        accountCountry,
        accountNumber,
        currencyId,
    } = req.body;
    try {
        const dfspsAccount = await
        db.createDfspAccount(participantId, accountCountry, accountNumber, currencyId);
        return res.status(200).json(dfspsAccount);
    } catch (error) {
        return res.status(500).json({ error });
    }
});

console.log('Running with config: ', config); // eslint-disable-line no-console
const server = app.listen(port,
    () => logger(`Server listening on port ${port}.`));
module.exports = server;
