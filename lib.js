const fetch = require('node-fetch');
const util = require('util');

module.exports = {
    closeOpenSettlementWindow,
    createSettlement,
    putSettlement,
};

const throwOrJson = async (res, msg = 'Error calling API') => {
    const resp = await res.json();
    if (res.ok) {
        return resp;
    }
    throw new Error(util.format(msg, res.status, res.statusText, resp));
};

const headers = () => ({
    // judging by the ml settlements source code, none of this stuff is actually necessary
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Date: (new Date()).toISOString(),
    'FSPIOP-Source': 'switch',
});

async function closeOpenSettlementWindow({ logger, endpoint, minAge }) {
    // Get the open settlement window
    const findOpts = {
        method: 'GET',
        headers: headers(),
    };

    const findUrl = `${endpoint}/settlementWindows?state=OPEN`;
    logger('Getting open settlement windows from', findUrl, 'options', findOpts);
    const findRes = await fetch(findUrl, findOpts)
        .then(res => res.json())
        .catch(() => { throw new Error(util.format('Connection error attempting to get open settlement window. Could not connect to', findUrl, 'with options', findOpts)); });

    logger('Find result', findRes);

    if (findRes.statusCode && findRes.statusCode > 299) {
        throw new Error(util.format('Failed to close settlement window', findRes));
    }

    if (findRes.length != 1) {
        throw new Error(util.format('Wrong number of settlement windows', findRes));
    }

    const closeWindow = findRes[0];
    logger('Open windows found', findRes, 'closing', closeWindow);

    const age = (new Date()) - (new Date(closeWindow.createdDate));
    if (age < minAge) {
        logger(`Settlement window younger than minimum age (${minAge}ms); assume this is a concurrently scheduled job`);
        process.exit(0);
    }

    const id = closeWindow.settlementWindowId;

    const closeOpts = {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
            state: 'CLOSED',
            reason: 'automatically scheduled closure',
        }),
    };
    const closeUrl = `${endpoint}/settlementWindows/${id}`;
    logger('Closing settlement window at URL', closeUrl, 'options', closeOpts);
    const closeRes = await fetch(closeUrl, closeOpts)
        .then(res => res.json())
        .catch(() => { throw new Error('Failed to close settlement window'); });

    logger('Close result', closeRes);

    if (closeRes.statusCode && closeRes.statusCode > 299) {
        throw new Error(util.format('Failed to close settlement window', closeRes));
    }

    logger('Successfully closed settlement window. New settlement window:', closeRes);

    return id;
}

async function createSettlement({ endpoint, settlementWindowId, logger = () => {} }) {
    const opts = {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
            reason: 'automatically scheduled settlement',
            settlementWindows: [{ id: settlementWindowId }],
        }),
    };
    const url = `${endpoint}/settlements`;
    logger('createSettlement endpoint', endpoint, 'settlementWindowId', settlementWindowId, 'url', url, 'opts', opts);
    return await fetch(url, opts).then(throwOrJson);
}

async function putSettlement({
    settlementId, endpoint, participants, logger = () => {},
}) {
    const opts = {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({
            participants,
        }),
    };
    logger('putSettlement endpoint', endpoint, 'settlementId', settlementId, 'opts', opts);
    return await fetch(`${endpoint}/settlements/${settlementId}`, opts).then(throwOrJson);
}
