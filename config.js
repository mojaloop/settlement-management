// (C)2018 ModusBox Inc.

const dotenv = require('dotenv');

dotenv.config();

const mandate = (k) => {
    if (!(k in process.env)) {
        throw new Error(`Missing environment variable ${k}`);
    }
    return process.env[k];
};

module.exports = {
    minAge: mandate('MIN_WINDOW_AGE_MS'),
    portalBackend: mandate('PORTAL_ENDPOINT').replace(/\/+$/, ''),
    opSettlementsEp: mandate('OPERATOR_SETTLEMENT_ENDPOINT').replace(/\/+$/, ''), // get rid of any trailing slashes
    settlementsEp: mandate('SETTLEMENT_ENDPOINT').replace(/\/+$/, ''), // get rid of any trailing slashes
    adminEp: mandate('ADMIN_ENDPOINT').replace(/\/+$/, ''), // get rid of any trailing slashes
};
