
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
    opSettlementsEp: mandate('OPERATOR_SETTLEMENT_ENDPOINT').replace(/\/+$/, ''), // get rid of any trailing slashes
    settlementsEp: mandate('SETTLEMENT_ENDPOINT').replace(/\/+$/, ''),
    adminEp: mandate('ADMIN_ENDPOINT').replace(/\/+$/, ''),
    db: {
        host: mandate('DB_HOST'),
        user: mandate('DB_USER'),
        password: mandate('DB_PASSWORD'),
        port: mandate('DB_PORT'),
        database: 'central_ledger',
    },
};
