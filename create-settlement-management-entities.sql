/*
 * (C)2019 ModusBox Inc.
 * =====================
 * Project: Casablanca
 * Original Author: Aarón Reynoza
 * Description: This script creates database entities required by the Casablanca Settlement Management
 */

CREATE TABLE IF NOT EXISTS participantSettlementBankAccountNumber (
    participantSettlementBankAccountNumberId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT 'Surrogate primary key',
    participantCurrencyId INT UNSIGNED NOT NULL COMMENT 'The settlement currency corresponding to this bank account',
    accountCountry VARCHAR(2) NOT NULL COMMENT 'The code that represents the country',
    accountNumber VARCHAR(256) NOT NULL COMMENT 'The externally encrypted account number',
    participantName VARCHAR(256) NOT NULL COMMENT 'Name of the DFSP',
    createdDate DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT 'System dateTime stamp pertaining to the inserted record',
    CONSTRAINT participantsettlementbankaccountnumber_participantcurrency_fk FOREIGN KEY (participantCurrencyId) REFERENCES participantCurrency (participantCurrencyId)
);