const mysql = require('mysql');
const uuidv4 = require('uuid/v4');
const connParams = require('./mysql.json');

const conn = mysql.createConnection({ ...connParams, multipleStatements: true });

console.log(connParams);

conn.connect();

const newTransfer = {
    quoteId: uuidv4(),
    hash: 'invalid-test-hash',
    transactionReferenceId: uuidv4(),
    amount: (Math.random() * 100).toFixed(2),
    transferExpirationDate: (new Date(Date.now())).toISOString().replace('T', ' ').split('.')[0],
    transferFulfilmentId: uuidv4(),
    transferCompletedDate: (new Date(Date.now())).toISOString().replace('T', ' ').split('.')[0],
    payerParticipantId: 4,
    payeeParticipantId: 5,
};

const query = createQuery({ ...newTransfer, settlementWindowId: 256 });

conn.query(query);

conn.end();

function createQuery({
    settlementWindowId,
    quoteId,
    hash,
    transactionReferenceId,
    amount,
    transferExpirationDate,
    transferFulfilmentId,
    transferCompletedDate,
    payerParticipantId,
    payeeParticipantId,
}) {
    return `
        START TRANSACTION;

        INSERT INTO
            quoteDuplicateCheck (quoteId, hash)
        VALUES
            ('${quoteId}', '${hash}');

        INSERT INTO
            transactionReference (transactionReferenceId, quoteId)
        VALUES
            ('${transactionReferenceId}', '${quoteId}');

        INSERT INTO
            quote (
                quoteId, transactionReferenceId, note, transactionInitiatorId, transactionInitiatorTypeId,
                transactionScenarioId, amountTypeId, amount, currencyId)
        VALUES
            ('${quoteId}', '${transactionReferenceId}', 'a', 1, 1, 1, 1, ${amount}, 'XOF');

        INSERT INTO
            transferDuplicateCheck (transferId, hash)
        VALUES
            ('${transactionReferenceId}', '${hash}');

        INSERT INTO
            transfer (transferId, amount, currencyId, ilpCondition, expirationDate)
        VALUES
            ('${transactionReferenceId}', ${amount}, 'XOF', '0', '${transferExpirationDate}');

        INSERT INTO
            transferFulfilment (transferFulfilmentId, transferId, ilpFulfilment, completedDate, isValid, settlementWindowId)
        VALUES
            ('${transferFulfilmentId}', '${transactionReferenceId}', '0', '${transferCompletedDate}', 1, ${settlementWindowId});

        INSERT INTO
            transferParticipant (participantCurrencyId, transferId, transferParticipantRoleTypeId, ledgerEntryTypeId, amount)
            SELECT
                pc.participantCurrencyId, '${transactionReferenceId}', 1, 1, -${amount}
            FROM
                participantCurrency pc
            INNER JOIN
                ledgerAccountType lat
            ON
                lat.ledgerAccountTypeId = pc.ledgerAccountTypeId
            WHERE
                lat.name = 'POSITION' AND pc.participantId = ${payerParticipantId};

        INSERT INTO
            transferParticipant (participantCurrencyId, transferId, transferParticipantRoleTypeId, ledgerEntryTypeId, amount)
            SELECT
                pc.participantCurrencyId, '${transactionReferenceId}', 2, 1, ${amount}
            FROM
                participantCurrency pc
            INNER JOIN
                ledgerAccountType lat
            ON
                lat.ledgerAccountTypeId = pc.ledgerAccountTypeId
            WHERE
                lat.name = 'POSITION' AND pc.participantId = ${payeeParticipantId};

        COMMIT;
    `;
}
