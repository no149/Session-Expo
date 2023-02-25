"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEST_fetchSnodePoolFromSeedNodeRetryable = exports.getMinTimeout = exports.fetchSnodePoolFromSeedNodeWithRetries = void 0;
const __1 = require("../..");
const node_fetch_1 = __importDefault(require("node-fetch"));
const https_1 = __importDefault(require("https"));
const lodash_1 = __importDefault(require("lodash"));
const tls_1 = __importDefault(require("tls"));
const crypto_1 = require("../../crypto");
const p_retry_1 = __importDefault(require("p-retry"));
const _1 = require(".");
const Promise_1 = require("../../utils/Promise");
const MIME_1 = require("../../../types/MIME");
const OS_1 = require("../../../OS");
async function fetchSnodePoolFromSeedNodeWithRetries(seedNodes) {
    try {
        window?.log?.info(`fetchSnodePoolFromSeedNode with seedNodes.length ${seedNodes.length}`);
        let snodes = await getSnodeListFromSeednodeOneAtAtime(seedNodes);
        snodes = lodash_1.default.shuffle(snodes);
        const fetchSnodePool = snodes.map(snode => ({
            ip: snode.public_ip,
            port: snode.storage_port,
            pubkey_x25519: snode.pubkey_x25519,
            pubkey_ed25519: snode.pubkey_ed25519,
        }));
        window?.log?.info('SeedNodeAPI::fetchSnodePoolFromSeedNodeWithRetries - Refreshed random snode pool with', snodes.length, 'snodes');
        return fetchSnodePool;
    }
    catch (e) {
        window?.log?.warn('SessionSnodeAPI::fetchSnodePoolFromSeedNodeWithRetries - error', e.code, e.message);
        throw new Error('Failed to contact seed node');
    }
}
exports.fetchSnodePoolFromSeedNodeWithRetries = fetchSnodePoolFromSeedNodeWithRetries;
const getSslAgentForSeedNode = async (seedNodeHost, isSsl = false) => {
    let certContent = '';
    let pubkey256 = '';
    let cert256 = '';
    if (!isSsl) {
        return undefined;
    }
    switch (seedNodeHost) {
        case 'storage.seed1.loki.network':
            certContent = (0, OS_1.isLinux)() ? storageSeed1Crt : Buffer.from(storageSeed1Crt, 'utf-8').toString();
            pubkey256 = 'JOsnIcAanVbgECNA8lHtC8f/cqN9m8EP7jKT6XCjeL8=';
            cert256 =
                '6E:2B:AC:F3:6E:C1:FF:FF:24:F3:CA:92:C6:94:81:B4:82:43:DF:C7:C6:03:98:B8:F5:6B:7D:30:7B:16:C1:CB';
            break;
        case 'storage.seed3.loki.network':
            certContent = (0, OS_1.isLinux)() ? storageSeed3Crt : Buffer.from(storageSeed3Crt, 'utf-8').toString();
            pubkey256 = 'mMmZD3lG4Fi7nTC/EWzRVaU3bbCLsH6Ds2FHSTpo0Rk=';
            cert256 =
                '24:13:4C:0A:03:D8:42:A6:09:DE:35:76:F4:BD:FB:11:60:DB:F9:88:9F:98:46:B7:60:A6:60:0C:4C:CF:60:72';
            break;
        case 'public.loki.foundation':
            certContent = (0, OS_1.isLinux)()
                ? publicLokiFoundationCtr
                : Buffer.from(publicLokiFoundationCtr, 'utf-8').toString();
            pubkey256 = 'W+Zv52qlcm1BbdpJzFwxZrE7kfmEboq7h3Dp/+Q3RPg=';
            cert256 =
                '40:E4:67:7D:18:6B:4D:08:8D:E9:D5:47:52:25:B8:28:E0:D3:63:99:9B:38:46:7D:92:19:5B:61:B9:AE:0E:EA';
            break;
        default:
            throw new Error(`Unknown seed node: ${seedNodeHost}`);
    }
    const sslOptions = {
        ca: certContent,
        rejectUnauthorized: true,
        keepAlive: true,
        checkServerIdentity: (host, cert) => {
            window.log.info(`seednode checkServerIdentity: ${host}`);
            const err = tls_1.default.checkServerIdentity(host, cert);
            if (err) {
                return err;
            }
            if ((0, crypto_1.sha256)(cert.pubkey) !== pubkey256) {
                window.log.error('checkServerIdentity: cert.pubkey issue');
                const msg = 'Certificate verification error: ' +
                    `The public key of '${cert.subject.CN}' ` +
                    'does not match our pinned fingerprint';
                return new Error(msg);
            }
            if (cert.fingerprint256 !== cert256) {
                window.log.error('checkServerIdentity: fingerprint256 issue');
                const msg = 'Certificate verification error: ' +
                    `The certificate of '${cert.subject.CN}' ` +
                    'does not match our pinned fingerprint';
                return new Error(msg);
            }
            return undefined;
        },
    };
    return new https_1.default.Agent(sslOptions);
};
const getSnodeListFromSeednodeOneAtAtime = async (seedNodes) => (0, Promise_1.allowOnlyOneAtATime)('getSnodeListFromSeednode', () => getSnodeListFromSeednode(seedNodes));
async function getSnodeListFromSeednode(seedNodes) {
    const SEED_NODE_RETRIES = 4;
    return (0, p_retry_1.default)(async () => {
        window?.log?.info('getSnodeListFromSeednode starting...');
        if (!seedNodes.length) {
            window?.log?.info('loki_snode_api::getSnodeListFromSeednode - seedNodes are empty');
            throw new Error('getSnodeListFromSeednode - seedNodes are empty');
        }
        const snodes = await _1.SeedNodeAPI.TEST_fetchSnodePoolFromSeedNodeRetryable(seedNodes);
        return snodes;
    }, {
        retries: SEED_NODE_RETRIES - 1,
        factor: 2,
        minTimeout: _1.SeedNodeAPI.getMinTimeout(),
        onFailedAttempt: e => {
            window?.log?.warn(`fetchSnodePoolFromSeedNodeRetryable attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left... Error: ${e.message}`);
        },
    });
}
function getMinTimeout() {
    return 1000;
}
exports.getMinTimeout = getMinTimeout;
async function TEST_fetchSnodePoolFromSeedNodeRetryable(seedNodes) {
    window?.log?.info('fetchSnodePoolFromSeedNodeRetryable starting...');
    if (!seedNodes.length) {
        window?.log?.info('loki_snode_api::fetchSnodePoolFromSeedNodeRetryable - seedNodes are empty');
        throw new Error('fetchSnodePoolFromSeedNodeRetryable: Seed nodes are empty');
    }
    const seedNodeUrl = lodash_1.default.sample(seedNodes);
    if (!seedNodeUrl) {
        window?.log?.warn('loki_snode_api::fetchSnodePoolFromSeedNodeRetryable - Could not select random snodes from', seedNodes);
        throw new Error('fetchSnodePoolFromSeedNodeRetryable: Seed nodes are empty #2');
    }
    const tryUrl = new URL(seedNodeUrl);
    const snodes = await getSnodesFromSeedUrl(tryUrl);
    if (snodes.length === 0) {
        window?.log?.warn(`loki_snode_api::fetchSnodePoolFromSeedNodeRetryable - ${seedNodeUrl} did not return any snodes`);
        throw new Error(`Failed to contact seed node: ${seedNodeUrl}`);
    }
    return snodes;
}
exports.TEST_fetchSnodePoolFromSeedNodeRetryable = TEST_fetchSnodePoolFromSeedNodeRetryable;
async function getSnodesFromSeedUrl(urlObj) {
    window?.log?.info(`getSnodesFromSeedUrl starting with ${urlObj.href}`);
    const params = {
        active_only: true,
        fields: {
            public_ip: true,
            storage_port: true,
            pubkey_x25519: true,
            pubkey_ed25519: true,
        },
    };
    const endpoint = 'json_rpc';
    const url = `${urlObj.href}${endpoint}`;
    const body = {
        jsonrpc: '2.0',
        method: 'get_n_service_nodes',
        params,
    };
    const sslAgent = await getSslAgentForSeedNode(urlObj.hostname, urlObj.protocol !== __1.Constants.PROTOCOLS.HTTP);
    const fetchOptions = {
        method: 'POST',
        timeout: 5000,
        body: JSON.stringify(body),
        headers: {
            'User-Agent': 'WhatsApp',
            'Accept-Language': 'en-us',
        },
        agent: sslAgent,
    };
    window?.log?.info(`insecureNodeFetch => plaintext for getSnodesFromSeedUrl  ${url}`);
    const response = await (0, node_fetch_1.default)(url, fetchOptions);
    if (response.status !== 200) {
        window?.log?.error(`loki_snode_api:::getSnodesFromSeedUrl - invalid response from seed ${urlObj.toString()}:`, response);
        throw new Error(`getSnodesFromSeedUrl: status is not 200 ${response.status} from ${urlObj.href}`);
    }
    if (response.headers.get('Content-Type') !== MIME_1.APPLICATION_JSON) {
        window?.log?.error('Response is not json');
        throw new Error(`getSnodesFromSeedUrl: response is not json Content-Type from ${urlObj.href}`);
    }
    try {
        const json = await response.json();
        const result = json.result;
        if (!result) {
            window?.log?.error(`loki_snode_api:::getSnodesFromSeedUrl - invalid result from seed ${urlObj.toString()}:`, response);
            throw new Error(`getSnodesFromSeedUrl: json.result is empty from ${urlObj.href}`);
        }
        const validNodes = result.service_node_states.filter((snode) => snode.public_ip !== '0.0.0.0');
        if (validNodes.length === 0) {
            throw new Error(`Did not get a single valid snode from ${urlObj.href}`);
        }
        return validNodes;
    }
    catch (e) {
        window?.log?.error('Invalid json response');
        throw new Error(`getSnodesFromSeedUrl: cannot parse content as JSON from ${urlObj.href}`);
    }
}
const storageSeed1Crt = `-----BEGIN CERTIFICATE-----
MIIEITCCAwmgAwIBAgIUJsox1ZQPK/6iDsCC+MUJfNAlFuYwDQYJKoZIhvcNAQEL
BQAwgYAxCzAJBgNVBAYTAkFVMREwDwYDVQQIDAhWaWN0b3JpYTESMBAGA1UEBwwJ
TWVsYm91cm5lMSUwIwYDVQQKDBxPeGVuIFByaXZhY3kgVGVjaCBGb3VuZGF0aW9u
MSMwIQYDVQQDDBpzdG9yYWdlLnNlZWQxLmxva2kubmV0d29yazAeFw0yMTA0MDcw
MTE5MjZaFw0yMzA0MDcwMTE5MjZaMIGAMQswCQYDVQQGEwJBVTERMA8GA1UECAwI
VmljdG9yaWExEjAQBgNVBAcMCU1lbGJvdXJuZTElMCMGA1UECgwcT3hlbiBQcml2
YWN5IFRlY2ggRm91bmRhdGlvbjEjMCEGA1UEAwwac3RvcmFnZS5zZWVkMS5sb2tp
Lm5ldHdvcmswggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCtWH3Rz8Dd
kEmM7tcBWHrJ/G8drr/+qidboEVYzxpyRjszaDxKXVhx4eBBsAD5RuCWuTuZmM8k
TKEDLtf8xfb5SQ7YNX+346s9NXS5Poy4CIPASiW/QWXgIHFbVdv2hC+cKOP61OLM
OGnOxfig6tQyd6EaCkedpY1DvSa2lPnQSOwC/jXCx6Vboc0zTY5R2bHtNc9hjIFP
F4VClLAQSh2F4R1V9MH5KZMW+CCP6oaJY658W9JYXYRwlLrL2EFOVxHgcxq/6+fw
+axXK9OXJrGZjuA+hiz+L/uAOtE4WuxrSeuNMHSrMtM9QqVn4bBuMJ21mAzfNoMP
OIwgMT9DwUjVAgMBAAGjgZAwgY0wHQYDVR0OBBYEFOubJp9SoXIw+ONiWgkOaW8K
zI/TMB8GA1UdIwQYMBaAFOubJp9SoXIw+ONiWgkOaW8KzI/TMA8GA1UdEwEB/wQF
MAMBAf8wJQYDVR0RBB4wHIIac3RvcmFnZS5zZWVkMS5sb2tpLm5ldHdvcmswEwYD
VR0lBAwwCgYIKwYBBQUHAwEwDQYJKoZIhvcNAQELBQADggEBAIiHNhNrjYvwXVWs
gacx8T/dpqpu9GE3L17LotgQr4R+IYHpNtcmwOTdtWWFfUTr75OCs+c3DqgRKEoj
lnULOsVcalpAGIvW15/fmZWOf66Dpa4+ljDmAc3SOQiD0gGNtqblgI5zG1HF38QP
hjYRhCZ5CVeGOLucvQ8tVVwQvArPFIkBr0jH9jHVgRWEI2MeI3FsU2H93D4TfGln
N4SmmCfYBqygaaZBWkJEt0bYhn8uGHdU9UY9L2FPtfHVKkmFgO7cASGlvXS7B/TT
/8IgbtM3O8mZc2asmdQhGwoAKz93ryyCd8X2UZJg/IwCSCayOlYZWY2fR4OPQmmV
gxJsm+g=
-----END CERTIFICATE-----
`;
const storageSeed3Crt = `-----BEGIN CERTIFICATE-----
MIIEITCCAwmgAwIBAgIUc486Dy9Y00bUFfDeYmJIgSS5xREwDQYJKoZIhvcNAQEL
BQAwgYAxCzAJBgNVBAYTAkFVMREwDwYDVQQIDAhWaWN0b3JpYTESMBAGA1UEBwwJ
TWVsYm91cm5lMSUwIwYDVQQKDBxPeGVuIFByaXZhY3kgVGVjaCBGb3VuZGF0aW9u
MSMwIQYDVQQDDBpzdG9yYWdlLnNlZWQzLmxva2kubmV0d29yazAeFw0yMTA0MDcw
MTIwNTJaFw0yMzA0MDcwMTIwNTJaMIGAMQswCQYDVQQGEwJBVTERMA8GA1UECAwI
VmljdG9yaWExEjAQBgNVBAcMCU1lbGJvdXJuZTElMCMGA1UECgwcT3hlbiBQcml2
YWN5IFRlY2ggRm91bmRhdGlvbjEjMCEGA1UEAwwac3RvcmFnZS5zZWVkMy5sb2tp
Lm5ldHdvcmswggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCtokMlsFzf
piYeD0EVNikMyvjltpF6fUEde9NOVrTtNTQT6kkDk+/0HF5LYgPaatv6v7fpUQHi
kIwd6F0LTRGeWDFdsaWMdtlR1n/GxLPrOROsE8dcLt6GLavPf9rDabgva93m/JD6
XW+Ne+MPEwqS8dAmFGhZd0gju6AtKFoSHnIf5pSQN6fSZUF/JQtHLVprAKKWKDiS
ZwmWbmrZR2aofLD/VRpetabajnZlv9EeWloQwvUsw1C1hkAmmtFeeXtg7ePwrOzo
6CnmcUJwOmi+LWqQV4A+58RZPFKaZoC5pzaKd0OYB8eZ8HB1F41UjGJgheX5Cyl4
+amfF3l8dSq1AgMBAAGjgZAwgY0wHQYDVR0OBBYEFM9VSq4pGydjtX92Beul4+ml
jBKtMB8GA1UdIwQYMBaAFM9VSq4pGydjtX92Beul4+mljBKtMA8GA1UdEwEB/wQF
MAMBAf8wJQYDVR0RBB4wHIIac3RvcmFnZS5zZWVkMy5sb2tpLm5ldHdvcmswEwYD
VR0lBAwwCgYIKwYBBQUHAwEwDQYJKoZIhvcNAQELBQADggEBAAYxmhhkcKE1n6g1
JqOa3UCBo4EfbqY5+FDZ0FVqv/cwemwVpKLbe6luRIS8poomdPCyMOS45V7wN3H9
cFpfJ1TW19ydPVKmCXrl29ngmnY1q7YDwE/4qi3VK/UiqDkTHMKWjVPkenOyi8u6
VVQANXSnKrn6GtigNFjGyD38O+j7AUSXBtXOJczaoF6r6BWgwQZ2WmgjuwvKTWSN
4r8uObERoAQYVaeXfgdr4e9X/JdskBDaLFfoW/rrSozHB4FqVNFW96k+aIUgRa5p
9kv115QcBPCSh9qOyTHij4tswS6SyOFaiKrNC4hgHQXP4QgioKmtsR/2Y+qJ6ddH
6oo+4QU=
-----END CERTIFICATE-----
`;
const publicLokiFoundationCtr = `-----BEGIN CERTIFICATE-----
MIIEEzCCAvugAwIBAgIUY9RQqbjhsQEkdeSgV9L0os9xZ7AwDQYJKoZIhvcNAQEL
BQAwfDELMAkGA1UEBhMCQVUxETAPBgNVBAgMCFZpY3RvcmlhMRIwEAYDVQQHDAlN
ZWxib3VybmUxJTAjBgNVBAoMHE94ZW4gUHJpdmFjeSBUZWNoIEZvdW5kYXRpb24x
HzAdBgNVBAMMFnB1YmxpYy5sb2tpLmZvdW5kYXRpb24wHhcNMjEwNDA3MDExMDMx
WhcNMjMwNDA3MDExMDMxWjB8MQswCQYDVQQGEwJBVTERMA8GA1UECAwIVmljdG9y
aWExEjAQBgNVBAcMCU1lbGJvdXJuZTElMCMGA1UECgwcT3hlbiBQcml2YWN5IFRl
Y2ggRm91bmRhdGlvbjEfMB0GA1UEAwwWcHVibGljLmxva2kuZm91bmRhdGlvbjCC
ASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAM5dBJSIR5+VNNUxUOo6FG0e
RmZteRqBt50KXGbOi2A23a6sa57pLFh9Yw3hmlWV+QCL7ipG1X4IC55OStgoesf+
K65VwEMP6Mtq0sSJS3R5TiuV2ZSRdSZTVjUyRXVe5T4Aw6wXVTAbc/HsyS780tDh
GclfDHhonPhZpmTAnSbfMOS+BfOnBNvDxdto0kVh6k5nrGlkT4ECloulHTQF2lwJ
0D6IOtv9AJplPdg6s2c4dY7durOdvr3NNVfvn5PTeRvbEPqzZur4WUUKIPNGu6mY
PxImqd4eUsL0Vod4aAsTIx4YMmCTi0m9W6zJI6nXcK/6a+iiA3+NTNMzEA9gQhEC
AwEAAaOBjDCBiTAdBgNVHQ4EFgQU/zahokxLvvFUpbnM6z/pwS1KsvwwHwYDVR0j
BBgwFoAU/zahokxLvvFUpbnM6z/pwS1KsvwwDwYDVR0TAQH/BAUwAwEB/zAhBgNV
HREEGjAYghZwdWJsaWMubG9raS5mb3VuZGF0aW9uMBMGA1UdJQQMMAoGCCsGAQUF
BwMBMA0GCSqGSIb3DQEBCwUAA4IBAQBql+JvoqpaYrFFTOuDn08U+pdcd3GM7tbI
zRH5LU+YnIpp9aRheek+2COW8DXsIy/kUngETCMLmX6ZaUj/WdHnTDkB0KTgxSHv
ad3ZznKPKZ26qJOklr+0ZWj4J3jHbisSzql6mqq7R2Kp4ESwzwqxvkbykM5RUnmz
Go/3Ol7bpN/ZVwwEkGfD/5rRHf57E/gZn2pBO+zotlQgr7HKRsIXQ2hIXVQqWmPQ
lvfIwrwAZlfES7BARFnHOpyVQxV8uNcV5K5eXzuVFjHBqvq+BtyGhWkP9yKJCHS9
OUXxch0rzRsH2C/kRVVhEk0pI3qlFiRC8pCJs98SNE9l69EQtG7I
-----END CERTIFICATE-----
`;
