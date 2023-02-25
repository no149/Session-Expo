"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.networkDeleteMessages = exports.TEST_getMinTimeout = exports.forceNetworkDeletion = exports.getNetworkTime = exports.retrieveNextMessages = exports.storeOnNode = exports.TEST_getSnodePoolFromSnode = exports.getSnodePoolFromSnodes = exports.getSessionIDForOnsName = exports.requestSnodesForPubkey = exports.getNowWithNetworkOffset = exports.getLatestTimestampOffset = exports.ERROR_CODE_NO_CONNECT = exports.onsNameRegex = void 0;
const sessionRpc_1 = require("./sessionRpc");
const snodePool_1 = require("./snodePool");
const crypto_1 = require("../../crypto");
const lodash_1 = __importStar(require("lodash"));
const p_retry_1 = __importDefault(require("p-retry"));
const String_1 = require("../../utils/String");
const onion_1 = require("../../../state/ducks/onion");
const onionPath_1 = require("../../onions/onionPath");
const utils_1 = require("../../utils");
const _1 = require(".");
const hfHandling_1 = require("./hfHandling");
exports.onsNameRegex = '^\\w([\\w-]*[\\w])?$';
exports.ERROR_CODE_NO_CONNECT = 'ENETUNREACH: No network connection.';
let latestTimestampOffset = Number.MAX_SAFE_INTEGER;
function handleTimestampOffset(_request, snodeTimestamp) {
    if (snodeTimestamp && lodash_1.default.isNumber(snodeTimestamp) && snodeTimestamp > 1609419600 * 1000) {
        const now = Date.now();
        if (latestTimestampOffset === Number.MAX_SAFE_INTEGER) {
            window?.log?.info(`first timestamp offset received:  ${now - snodeTimestamp}ms`);
        }
        latestTimestampOffset = now - snodeTimestamp;
    }
}
function getLatestTimestampOffset() {
    if (latestTimestampOffset === Number.MAX_SAFE_INTEGER) {
        window.log.warn('latestTimestampOffset is not set yet');
        return 0;
    }
    return latestTimestampOffset;
}
exports.getLatestTimestampOffset = getLatestTimestampOffset;
function getNowWithNetworkOffset() {
    return Date.now() - exports.getLatestTimestampOffset();
}
exports.getNowWithNetworkOffset = getNowWithNetworkOffset;
async function requestSnodesForPubkeyWithTargetNodeRetryable(pubKey, targetNode) {
    const params = {
        pubKey,
    };
    const result = await (0, sessionRpc_1.snodeRpc)({
        method: 'get_snodes_for_pubkey',
        params,
        targetNode,
        associatedWith: pubKey,
    });
    if (!result) {
        window?.log?.warn(`SessionSnodeAPI::requestSnodesForPubkeyWithTargetNodeRetryable - sessionRpc on ${targetNode.ip}:${targetNode.port} returned falsish value`, result);
        throw new Error('requestSnodesForPubkeyWithTargetNodeRetryable: Invalid result');
    }
    if (result.status !== 200) {
        window?.log?.warn('Status is not 200 for get_snodes_for_pubkey');
        throw new Error('requestSnodesForPubkeyWithTargetNodeRetryable: Invalid status code');
    }
    try {
        const json = JSON.parse(result.body);
        if (!json.snodes) {
            window?.log?.warn(`SessionSnodeAPI::requestSnodesForPubkeyRetryable - sessionRpc on ${targetNode.ip}:${targetNode.port} returned falsish value for snodes`, result);
            throw new Error('Invalid json (empty)');
        }
        const snodes = json.snodes.filter((tSnode) => tSnode.ip !== '0.0.0.0');
        handleTimestampOffset('get_snodes_for_pubkey', json.t);
        return snodes;
    }
    catch (e) {
        throw new Error('Invalid json');
    }
}
async function requestSnodesForPubkeyWithTargetNode(pubKey, targetNode) {
    return (0, p_retry_1.default)(async () => {
        return requestSnodesForPubkeyWithTargetNodeRetryable(pubKey, targetNode);
    }, {
        retries: 3,
        factor: 2,
        minTimeout: 100,
        maxTimeout: 2000,
        onFailedAttempt: e => {
            window?.log?.warn(`requestSnodesForPubkeyWithTargetNode attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left...`);
        },
    });
}
async function requestSnodesForPubkeyRetryable(pubKey) {
    return (0, p_retry_1.default)(async () => {
        const targetNode = await (0, snodePool_1.getRandomSnode)();
        return requestSnodesForPubkeyWithTargetNode(pubKey, targetNode);
    }, {
        retries: 3,
        factor: 2,
        minTimeout: 100,
        maxTimeout: 4000,
        onFailedAttempt: e => {
            window?.log?.warn(`requestSnodesForPubkeyRetryable attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left...`);
        },
    });
}
async function requestSnodesForPubkey(pubKey) {
    try {
        return await requestSnodesForPubkeyRetryable(pubKey);
    }
    catch (e) {
        window?.log?.error('SessionSnodeAPI::requestSnodesForPubkey - error', e);
        return [];
    }
}
exports.requestSnodesForPubkey = requestSnodesForPubkey;
async function getSessionIDForOnsName(onsNameCase) {
    const validationCount = 3;
    const onsNameLowerCase = onsNameCase.toLowerCase();
    const sodium = await (0, crypto_1.getSodiumRenderer)();
    const nameAsData = (0, String_1.stringToUint8Array)(onsNameLowerCase);
    const nameHash = sodium.crypto_generichash(sodium.crypto_generichash_BYTES, nameAsData);
    const base64EncodedNameHash = (0, String_1.fromUInt8ArrayToBase64)(nameHash);
    const params = {
        endpoint: 'ons_resolve',
        params: {
            type: 0,
            name_hash: base64EncodedNameHash,
        },
    };
    const promises = (0, lodash_1.range)(0, validationCount).map(async () => {
        const targetNode = await (0, snodePool_1.getRandomSnode)();
        const result = await (0, sessionRpc_1.snodeRpc)({ method: 'oxend_request', params, targetNode });
        if (!result || result.status !== 200 || !result.body) {
            throw new Error('ONSresolve:Failed to resolve ONS');
        }
        let parsedBody;
        try {
            parsedBody = JSON.parse(result.body);
            handleTimestampOffset('ons_resolve', parsedBody.t);
        }
        catch (e) {
            window?.log?.warn('ONSresolve: failed to parse ons result body', result.body);
            throw new Error('ONSresolve: json ONS resovle');
        }
        const intermediate = parsedBody?.result;
        if (!intermediate || !intermediate?.encrypted_value) {
            throw new Error('ONSresolve: no encrypted_value');
        }
        const hexEncodedCipherText = intermediate?.encrypted_value;
        const isArgon2Based = !Boolean(intermediate?.nonce);
        const ciphertext = (0, String_1.fromHexToArray)(hexEncodedCipherText);
        let sessionIDAsData;
        let nonce;
        let key;
        if (isArgon2Based) {
            const salt = new Uint8Array(sodium.crypto_pwhash_SALTBYTES);
            nonce = new Uint8Array(sodium.crypto_secretbox_NONCEBYTES);
            try {
                const keyHex = sodium.crypto_pwhash(sodium.crypto_secretbox_KEYBYTES, onsNameLowerCase, salt, sodium.crypto_pwhash_OPSLIMIT_MODERATE, sodium.crypto_pwhash_MEMLIMIT_MODERATE, sodium.crypto_pwhash_ALG_ARGON2ID13, 'hex');
                if (!keyHex) {
                    throw new Error('ONSresolve: key invalid argon2');
                }
                key = (0, String_1.fromHexToArray)(keyHex);
            }
            catch (e) {
                throw new Error('ONSresolve: Hashing failed');
            }
            sessionIDAsData = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
            if (!sessionIDAsData) {
                throw new Error('ONSresolve: Decryption failed');
            }
            return (0, String_1.toHex)(sessionIDAsData);
        }
        const hexEncodedNonce = intermediate.nonce;
        if (!hexEncodedNonce) {
            throw new Error('ONSresolve: No hexEncodedNonce');
        }
        nonce = (0, String_1.fromHexToArray)(hexEncodedNonce);
        try {
            key = sodium.crypto_generichash(sodium.crypto_generichash_BYTES, nameAsData, nameHash);
            if (!key) {
                throw new Error('ONSresolve: Hashing failed');
            }
        }
        catch (e) {
            window?.log?.warn('ONSresolve: hashing failed', e);
            throw new Error('ONSresolve: Hashing failed');
        }
        sessionIDAsData = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, ciphertext, null, nonce, key);
        if (!sessionIDAsData) {
            throw new Error('ONSresolve: Decryption failed');
        }
        return (0, String_1.toHex)(sessionIDAsData);
    });
    try {
        const allResolvedSessionIds = await Promise.all(promises);
        if (allResolvedSessionIds?.length !== validationCount) {
            throw new Error('ONSresolve: Validation failed');
        }
        if (lodash_1.default.uniq(allResolvedSessionIds).length !== 1) {
            throw new Error('ONSresolve: Validation failed');
        }
        return allResolvedSessionIds[0];
    }
    catch (e) {
        window.log.warn('ONSresolve: error', e);
        throw e;
    }
}
exports.getSessionIDForOnsName = getSessionIDForOnsName;
async function getSnodePoolFromSnodes() {
    const existingSnodePool = await _1.SnodePool.getSnodePoolFromDBOrFetchFromSeed();
    if (existingSnodePool.length <= snodePool_1.minSnodePoolCount) {
        window?.log?.warn('getSnodePoolFromSnodes: Cannot get snodes list from snodes; not enough snodes', existingSnodePool.length);
        throw new Error(`Cannot get snodes list from snodes; not enough snodes even after refetching from seed', ${existingSnodePool.length}`);
    }
    const nodesToRequest = lodash_1.default.sampleSize(existingSnodePool, 3);
    const results = await Promise.all(nodesToRequest.map(async (node) => {
        return TEST_getSnodePoolFromSnode(node);
    }));
    const commonSnodes = lodash_1.default.intersectionWith(results[0], results[1], results[2], (s1, s2) => {
        return s1.ip === s2.ip && s1.port === s2.port;
    });
    if (commonSnodes.length < snodePool_1.requiredSnodesForAgreement) {
        throw new Error(`Inconsistent snode pools. We did not get at least ${snodePool_1.requiredSnodesForAgreement} in common`);
    }
    return commonSnodes;
}
exports.getSnodePoolFromSnodes = getSnodePoolFromSnodes;
async function TEST_getSnodePoolFromSnode(targetNode) {
    const params = {
        endpoint: 'get_service_nodes',
        params: {
            active_only: true,
            fields: {
                public_ip: true,
                storage_port: true,
                pubkey_x25519: true,
                pubkey_ed25519: true,
            },
        },
    };
    const result = await (0, sessionRpc_1.snodeRpc)({
        method: 'oxend_request',
        params,
        targetNode,
    });
    if (!result || result.status !== 200) {
        throw new Error('Invalid result');
    }
    try {
        const json = JSON.parse(result.body);
        if (!json || !json.result || !json.result.service_node_states?.length) {
            window?.log?.error('getSnodePoolFromSnode - invalid result from snode', result.body);
            return [];
        }
        const snodes = json.result.service_node_states
            .filter((snode) => snode.public_ip !== '0.0.0.0')
            .map((snode) => ({
            ip: snode.public_ip,
            port: snode.storage_port,
            pubkey_x25519: snode.pubkey_x25519,
            pubkey_ed25519: snode.pubkey_ed25519,
        }));
        handleTimestampOffset('get_service_nodes', json.t);
        return lodash_1.default.compact(snodes);
    }
    catch (e) {
        window?.log?.error('Invalid json response');
        return [];
    }
}
exports.TEST_getSnodePoolFromSnode = TEST_getSnodePoolFromSnode;
async function storeOnNode(targetNode, params) {
    try {
        const result = await (0, sessionRpc_1.snodeRpc)({
            method: 'store',
            params,
            targetNode,
            associatedWith: params.pubKey,
        });
        if (!result || result.status !== 200 || !result.body) {
            return false;
        }
        try {
            const parsed = JSON.parse(result.body);
            handleTimestampOffset('store', parsed.t);
            await (0, hfHandling_1.handleHardforkResult)(parsed);
            const messageHash = parsed.hash;
            if (messageHash) {
                return messageHash;
            }
            return true;
        }
        catch (e) {
            window?.log?.warn('Failed to parse "store" result: ', e.msg);
        }
        return false;
    }
    catch (e) {
        window?.log?.warn('store - send error:', e, `destination ${targetNode.ip}:${targetNode.port}`);
        throw e;
    }
}
exports.storeOnNode = storeOnNode;
async function getRetrieveSignatureParams(params) {
    const ourPubkey = utils_1.UserUtils.getOurPubKeyFromCache();
    const ourEd25519Key = await utils_1.UserUtils.getUserED25519KeyPair();
    if ((0, lodash_1.isEmpty)(params?.pubKey) || ourPubkey.key !== params.pubKey || !ourEd25519Key) {
        return null;
    }
    const hasNamespace = params.namespace && params.namespace !== 0;
    const namespace = params.namespace || 0;
    const edKeyPrivBytes = (0, String_1.fromHexToArray)(ourEd25519Key?.privKey);
    const signatureTimestamp = getNowWithNetworkOffset();
    const verificationData = hasNamespace
        ? utils_1.StringUtils.encode(`retrieve${namespace}${signatureTimestamp}`, 'utf8')
        : utils_1.StringUtils.encode(`retrieve${signatureTimestamp}`, 'utf8');
    const message = new Uint8Array(verificationData);
    const sodium = await (0, crypto_1.getSodiumRenderer)();
    try {
        const signature = sodium.crypto_sign_detached(message, edKeyPrivBytes);
        const signatureBase64 = (0, String_1.fromUInt8ArrayToBase64)(signature);
        const namespaceObject = hasNamespace ? { namespace } : {};
        return {
            timestamp: signatureTimestamp,
            signature: signatureBase64,
            pubkey_ed25519: ourEd25519Key.pubKey,
            ...namespaceObject,
        };
    }
    catch (e) {
        window.log.warn('getSignatureParams failed with: ', e.message);
        return null;
    }
}
async function retrieveNextMessages(targetNode, lastHash, associatedWith, namespace) {
    const params = {
        pubKey: associatedWith,
        lastHash: lastHash || '',
        namespace,
    };
    const signatureParams = (await getRetrieveSignatureParams(params)) || {};
    const result = await (0, sessionRpc_1.snodeRpc)({
        method: 'retrieve',
        params: { ...signatureParams, ...params },
        targetNode,
        associatedWith,
        timeout: 4000,
    });
    if (!result) {
        window?.log?.warn(`_retrieveNextMessages - sessionRpc could not talk to ${targetNode.ip}:${targetNode.port}`);
        throw new Error(`_retrieveNextMessages - sessionRpc could not talk to ${targetNode.ip}:${targetNode.port}`);
    }
    if (result.status !== 200) {
        window?.log?.warn('retrieveNextMessages result is not 200');
        throw new Error(`_retrieveNextMessages - retrieve result is not 200 with ${targetNode.ip}:${targetNode.port}`);
    }
    try {
        const json = JSON.parse(result.body);
        if (!window.inboxStore?.getState().onionPaths.isOnline) {
            window.inboxStore?.dispatch((0, onion_1.updateIsOnline)(true));
        }
        handleTimestampOffset('retrieve', json.t);
        await (0, hfHandling_1.handleHardforkResult)(json);
        return json.messages || [];
    }
    catch (e) {
        window?.log?.warn('exception while parsing json of nextMessage:', e);
        if (!window.inboxStore?.getState().onionPaths.isOnline) {
            window.inboxStore?.dispatch((0, onion_1.updateIsOnline)(true));
        }
        throw new Error(`_retrieveNextMessages - exception while parsing json of nextMessage ${targetNode.ip}:${targetNode.port}: ${e?.message}`);
    }
}
exports.retrieveNextMessages = retrieveNextMessages;
const getNetworkTime = async (snode) => {
    const response = await (0, sessionRpc_1.snodeRpc)({ method: 'info', params: {}, targetNode: snode });
    if (!response || !response.body) {
        throw new Error('getNetworkTime returned empty response or body');
    }
    const body = JSON.parse(response.body);
    const timestamp = body?.timestamp;
    if (!timestamp) {
        throw new Error(`getNetworkTime returned invalid timestamp: ${timestamp}`);
    }
    handleTimestampOffset('getNetworkTime', timestamp);
    return timestamp;
};
exports.getNetworkTime = getNetworkTime;
const forceNetworkDeletion = async () => {
    const sodium = await (0, crypto_1.getSodiumRenderer)();
    const userX25519PublicKey = utils_1.UserUtils.getOurPubKeyStrFromCache();
    const userED25519KeyPair = await utils_1.UserUtils.getUserED25519KeyPair();
    if (!userED25519KeyPair) {
        window?.log?.warn('Cannot forceNetworkDeletion, did not find user ed25519 key.');
        return null;
    }
    const edKeyPriv = userED25519KeyPair.privKey;
    try {
        const maliciousSnodes = await (0, p_retry_1.default)(async () => {
            const userSwarm = await (0, snodePool_1.getSwarmFor)(userX25519PublicKey);
            const snodeToMakeRequestTo = lodash_1.default.sample(userSwarm);
            const edKeyPrivBytes = (0, String_1.fromHexToArray)(edKeyPriv);
            if (!snodeToMakeRequestTo) {
                window?.log?.warn('Cannot forceNetworkDeletion, without a valid swarm node.');
                return null;
            }
            return (0, p_retry_1.default)(async () => {
                const timestamp = await exports.getNetworkTime(snodeToMakeRequestTo);
                const verificationData = utils_1.StringUtils.encode(`delete_all${timestamp}`, 'utf8');
                const message = new Uint8Array(verificationData);
                const signature = sodium.crypto_sign_detached(message, edKeyPrivBytes);
                const signatureBase64 = (0, String_1.fromUInt8ArrayToBase64)(signature);
                const deleteMessageParams = {
                    pubkey: userX25519PublicKey,
                    pubkey_ed25519: userED25519KeyPair.pubKey.toUpperCase(),
                    timestamp,
                    signature: signatureBase64,
                };
                const ret = await (0, sessionRpc_1.snodeRpc)({
                    method: 'delete_all',
                    params: deleteMessageParams,
                    targetNode: snodeToMakeRequestTo,
                    associatedWith: userX25519PublicKey,
                });
                if (!ret) {
                    throw new Error(`Empty response got for delete_all on snode ${(0, onionPath_1.ed25519Str)(snodeToMakeRequestTo.pubkey_ed25519)}`);
                }
                try {
                    const parsedResponse = JSON.parse(ret.body);
                    const { swarm } = parsedResponse;
                    if (!swarm) {
                        throw new Error(`Invalid JSON swarm response got for delete_all on snode ${(0, onionPath_1.ed25519Str)(snodeToMakeRequestTo.pubkey_ed25519)}, ${ret?.body}`);
                    }
                    const swarmAsArray = Object.entries(swarm);
                    if (!swarmAsArray.length) {
                        throw new Error(`Invalid JSON swarmAsArray response got for delete_all on snode ${(0, onionPath_1.ed25519Str)(snodeToMakeRequestTo.pubkey_ed25519)}, ${ret?.body}`);
                    }
                    const results = lodash_1.default.compact(swarmAsArray.map(snode => {
                        const snodePubkey = snode[0];
                        const snodeJson = snode[1];
                        const isFailed = snodeJson.failed || false;
                        if (isFailed) {
                            const reason = snodeJson.reason;
                            const statusCode = snodeJson.code;
                            if (reason && statusCode) {
                                window?.log?.warn(`Could not delete data from ${(0, onionPath_1.ed25519Str)(snodeToMakeRequestTo.pubkey_ed25519)} due to error: ${reason}: ${statusCode}`);
                                if (statusCode === 421) {
                                    throw new p_retry_1.default.AbortError('421 error on network delete_all. Retrying with a new snode');
                                }
                            }
                            else {
                                window?.log?.warn(`Could not delete data from ${(0, onionPath_1.ed25519Str)(snodeToMakeRequestTo.pubkey_ed25519)}`);
                            }
                            return snodePubkey;
                        }
                        const hashes = snodeJson.deleted;
                        const signatureSnode = snodeJson.signature;
                        const dataToVerify = `${userX25519PublicKey}${timestamp}${hashes.join('')}`;
                        const dataToVerifyUtf8 = utils_1.StringUtils.encode(dataToVerify, 'utf8');
                        const isValid = sodium.crypto_sign_verify_detached((0, String_1.fromBase64ToArray)(signatureSnode), new Uint8Array(dataToVerifyUtf8), (0, String_1.fromHexToArray)(snodePubkey));
                        if (!isValid) {
                            return snodePubkey;
                        }
                        return null;
                    }));
                    return results;
                }
                catch (e) {
                    throw new Error(`Invalid JSON response got for delete_all on snode ${(0, onionPath_1.ed25519Str)(snodeToMakeRequestTo.pubkey_ed25519)}, ${ret?.body}`);
                }
            }, {
                retries: 3,
                minTimeout: exports.TEST_getMinTimeout(),
                onFailedAttempt: e => {
                    window?.log?.warn(`delete_all INNER request attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left...`);
                },
            });
        }, {
            retries: 3,
            minTimeout: exports.TEST_getMinTimeout(),
            onFailedAttempt: e => {
                window?.log?.warn(`delete_all OUTER request attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left... ${e.message}`);
            },
        });
        return maliciousSnodes;
    }
    catch (e) {
        window?.log?.warn('failed to delete everything on network:', e);
        return null;
    }
};
exports.forceNetworkDeletion = forceNetworkDeletion;
const TEST_getMinTimeout = () => 500;
exports.TEST_getMinTimeout = TEST_getMinTimeout;
const networkDeleteMessages = async (hashes) => {
    const sodium = await (0, crypto_1.getSodiumRenderer)();
    const userX25519PublicKey = utils_1.UserUtils.getOurPubKeyStrFromCache();
    const userED25519KeyPair = await utils_1.UserUtils.getUserED25519KeyPair();
    if (!userED25519KeyPair) {
        window?.log?.warn('Cannot networkDeleteMessages, did not find user ed25519 key.');
        return null;
    }
    const edKeyPriv = userED25519KeyPair.privKey;
    try {
        const maliciousSnodes = await (0, p_retry_1.default)(async () => {
            const userSwarm = await (0, snodePool_1.getSwarmFor)(userX25519PublicKey);
            const snodeToMakeRequestTo = lodash_1.default.sample(userSwarm);
            const edKeyPrivBytes = (0, String_1.fromHexToArray)(edKeyPriv);
            if (!snodeToMakeRequestTo) {
                window?.log?.warn('Cannot networkDeleteMessages, without a valid swarm node.');
                return null;
            }
            return (0, p_retry_1.default)(async () => {
                const verificationData = utils_1.StringUtils.encode(`delete${hashes.join('')}`, 'utf8');
                const message = new Uint8Array(verificationData);
                const signature = sodium.crypto_sign_detached(message, edKeyPrivBytes);
                const signatureBase64 = (0, String_1.fromUInt8ArrayToBase64)(signature);
                const deleteMessageParams = {
                    pubkey: userX25519PublicKey,
                    pubkey_ed25519: userED25519KeyPair.pubKey.toUpperCase(),
                    messages: hashes,
                    signature: signatureBase64,
                };
                const ret = await (0, sessionRpc_1.snodeRpc)({
                    method: 'delete',
                    params: deleteMessageParams,
                    targetNode: snodeToMakeRequestTo,
                    associatedWith: userX25519PublicKey,
                });
                if (!ret) {
                    throw new Error(`Empty response got for delete on snode ${(0, onionPath_1.ed25519Str)(snodeToMakeRequestTo.pubkey_ed25519)}`);
                }
                try {
                    const parsedResponse = JSON.parse(ret.body);
                    const { swarm } = parsedResponse;
                    if (!swarm) {
                        throw new Error(`Invalid JSON swarm response got for delete on snode ${(0, onionPath_1.ed25519Str)(snodeToMakeRequestTo.pubkey_ed25519)}, ${ret?.body}`);
                    }
                    const swarmAsArray = Object.entries(swarm);
                    if (!swarmAsArray.length) {
                        throw new Error(`Invalid JSON swarmAsArray response got for delete on snode ${(0, onionPath_1.ed25519Str)(snodeToMakeRequestTo.pubkey_ed25519)}, ${ret?.body}`);
                    }
                    const results = lodash_1.default.compact(swarmAsArray.map(snode => {
                        const snodePubkey = snode[0];
                        const snodeJson = snode[1];
                        const isFailed = snodeJson.failed || false;
                        if (isFailed) {
                            const reason = snodeJson.reason;
                            const statusCode = snodeJson.code;
                            if (reason && statusCode) {
                                window?.log?.warn(`Could not delete msgs from ${(0, onionPath_1.ed25519Str)(snodeToMakeRequestTo.pubkey_ed25519)} due to error: ${reason}: ${statusCode}`);
                                if (statusCode === 421) {
                                    throw new p_retry_1.default.AbortError('421 error on network delete_all. Retrying with a new snode');
                                }
                            }
                            else {
                                window?.log?.info(`Could not delete msgs from ${(0, onionPath_1.ed25519Str)(snodeToMakeRequestTo.pubkey_ed25519)}`);
                            }
                            return snodePubkey;
                        }
                        const responseHashes = snodeJson.deleted;
                        const signatureSnode = snodeJson.signature;
                        const dataToVerify = `${userX25519PublicKey}${hashes.join('')}${responseHashes.join('')}`;
                        const dataToVerifyUtf8 = utils_1.StringUtils.encode(dataToVerify, 'utf8');
                        const isValid = sodium.crypto_sign_verify_detached((0, String_1.fromBase64ToArray)(signatureSnode), new Uint8Array(dataToVerifyUtf8), (0, String_1.fromHexToArray)(snodePubkey));
                        if (!isValid) {
                            return snodePubkey;
                        }
                        return null;
                    }));
                    return results;
                }
                catch (e) {
                    throw new Error(`Invalid JSON response got for delete on snode ${(0, onionPath_1.ed25519Str)(snodeToMakeRequestTo.pubkey_ed25519)}, ${ret?.body}`);
                }
            }, {
                retries: 3,
                minTimeout: exports.TEST_getMinTimeout(),
                onFailedAttempt: e => {
                    window?.log?.warn(`delete INNER request attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left...`);
                },
            });
        }, {
            retries: 3,
            minTimeout: exports.TEST_getMinTimeout(),
            onFailedAttempt: e => {
                window?.log?.warn(`delete OUTER request attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left...`);
            },
        });
        return maliciousSnodes;
    }
    catch (e) {
        window?.log?.warn('failed to delete message on network:', e);
        return null;
    }
};
exports.networkDeleteMessages = networkDeleteMessages;
