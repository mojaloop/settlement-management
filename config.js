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
    dfspConf: {
        11: { name: 'payerfsp', country: 'CI', accountId: '12347' },
        15: { name: 'payeefsp', country: 'CI', accountId: '12348' },
        17: { name: 'testfsp1', country: 'CI', accountId: '12345' },
        18: { name: 'testfsp2', country: 'CI', accountId: '12346' },
        19: { name: 'testfsp3', country: 'CI', accountId: '12345' },
        20: { name: 'testfsp4', country: 'CI', accountId: '12346' },
    },
    opSettlementsEp: mandate('OPERATOR_SETTLEMENT_ENDPOINT').replace(/\/+$/, ''), // get rid of any trailing slashes
    settlementsEp: mandate('SETTLEMENT_ENDPOINT').replace(/\/+$/, ''), // get rid of any trailing slashes
    adminEp: mandate('ADMIN_ENDPOINT').replace(/\/+$/, ''), // get rid of any trailing slashes
};
