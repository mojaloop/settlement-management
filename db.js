const mysql = require('mysql2');

const MYSQL_MIN_DATETIME = '1000-01-01';
const MYSQL_MAX_DATETIME = '9999-12-31';

const dfspBankAccountWithCurrency = `
  SELECT pc.participantCurrencyId, p.name
  FROM participantCurrency pc
  INNER JOIN 
    ledgerAccountType ON pc.ledgerAccountTypeId = ledgerAccountType.ledgerAccountTypeId
  INNER JOIN 
    currency c ON c.currencyId = pc.currencyId
  INNER JOIN 
  participant p ON p.participantId = pc.participantId
  WHERE
    ledgerAccountType.name = 'SETTLEMENT'
    AND
    pc.participantId = ?
    AND
    c.currencyId = ?;`;

const dfspBankAccountWithNoCurrency = `
  SELECT pc.participantCurrencyId
  FROM participantCurrency pc
  INNER JOIN 
    ledgerAccountType ON pc.ledgerAccountTypeId = ledgerAccountType.ledgerAccountTypeId
  INNER JOIN 
    currency c ON c.currencyId = pc.currencyId
  WHERE
    ledgerAccountType.name = 'SETTLEMENT'
    AND
    pc.participantId = ?`;

const dfspsBankAccounts = `
SELECT p.name, psban.participantCurrencyId, psban.accountCountry, psban.accountNumber, pcu.participantId 
FROM participantSettlementBankAccountNumber psban
INNER JOIN (
  SELECT max(sq_psban.participantSettlementBankAccountNumberId) as participantSettlementBankAccountNumberId
  FROM participantSettlementBankAccountNumber sq_psban
  GROUP BY sq_psban.participantCurrencyId
) sq ON sq.participantSettlementBankAccountNumberId = psban.participantSettlementBankAccountNumberId
INNER JOIN participantCurrency pc ON pc.participantCurrencyId = psban.participantCurrencyId
INNER JOIN participant p ON p.participantId = pc.participantId
INNER JOIN participantCurrency pcu ON pcu.participantCurrencyId = psban.participantCurrencyId;`;

module.exports = class Database {
    constructor(config) {
        this.connection = mysql.createPool({
            ...config,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
        }).promise();

        this.MYSQL_MAX_DATETIME = MYSQL_MAX_DATETIME;
        this.MYSQL_MIN_DATETIME = MYSQL_MIN_DATETIME;
    }

    async getDfspsAccounts() {
        const [dfspsAccounts] = await this.connection.query(dfspsBankAccounts);
        return dfspsAccounts;
    }

    async createDfspAccount(participantId, accountCountry, accountNumber, currencyId) {
        const [participantCurrencies] = currencyId
            ? await this.connection.query(dfspBankAccountWithCurrency,
                [participantId, currencyId])
            : await this.connection.query(dfspBankAccountWithNoCurrency, participantId);

        if (participantCurrencies.length > 1) {
            throw new Error('currencyId must be specified when multiple Account currencies are present');
        } else if (participantCurrencies.length === 0) {
            throw new Error('Could not find participantCurrencyId with present participantId and currencyId');
        }
        const { participantCurrencyId } = participantCurrencies[0];
        const [newDfspAccount] = await this.connection.query('INSERT INTO participantSettlementBankAccountNumber (participantCurrencyId, accountCountry, accountNumber) VALUES (?, ?, ?)', [participantCurrencyId, accountCountry, accountNumber]);
        return newDfspAccount;
    }
};
