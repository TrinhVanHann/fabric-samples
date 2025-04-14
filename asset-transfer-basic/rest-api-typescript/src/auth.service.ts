import fs from 'fs';
import path from 'path';
import * as config from './config';
import {
    Contract,
    DefaultEventHandlerStrategies,
    DefaultQueryHandlerStrategies,
    Gateway,
    Wallets,
    X509Identity,
} from 'fabric-network';
import {
    createGateway,
    createWallet,
    getContracts,
    getNetwork,
    evaluateTransaction,
} from './fabric';
import { logger } from './logger';


const ccpPath = '/test-network/organizations/peerOrganizations/org1.example.com/connection-org1.json';
const walletPath = path.join(__dirname, 'wallet');

export const loginWithPrivateKey = async (userId: string, privateKey: string): Promise<boolean> => {
    // Load connection profile
    const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

    const wallet = await Wallets.newFileSystemWallet(walletPath);
    const storedIdentity = await wallet.get(userId);

    if (!storedIdentity) {
        throw new Error(`No identity found in wallet for user ${userId}`);
    }

    const x509 = storedIdentity as X509Identity;

    // Compose new identity using user's private key
    const tempIdentity: X509Identity = {
        credentials: {
            certificate: x509.credentials.certificate,
            privateKey,
        },
        mspId: x509.mspId,
        type: 'X.509',
    };

    // Use InMemoryWallet to test auth without touching real wallet
    const tempWallet = await Wallets.newInMemoryWallet();
    await tempWallet.put(userId, tempIdentity);

    // Try connecting to Fabric with this temporal identity
    const gateway = new Gateway();
    try {
        await gateway.connect(ccp, {
            wallet: tempWallet,
            identity: userId,
            discovery: { enabled: true, asLocalhost: true },
            eventHandlerOptions: {
                commitTimeout: config.commitTimeout,
                endorseTimeout: config.endorseTimeout,
                strategy: DefaultEventHandlerStrategies.PREFER_MSPID_SCOPE_ANYFORTX,
            },
            queryHandlerOptions: {
                timeout: config.queryTimeout,
                strategy:
                    DefaultQueryHandlerStrategies.PREFER_MSPID_SCOPE_ROUND_ROBIN,
            },
        });
        return true;
    } catch (err) {
        throw new Error('Invalid private key or failed to connect to network');
    } finally {
        gateway.disconnect();
    }
};
