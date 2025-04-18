/* eslint-disable @typescript-eslint/no-explicit-any */
import FabricCAServices from 'fabric-ca-client';
import { Wallet, X509Identity } from 'fabric-network';

const adminUserId = 'admin';
const adminUserPasswd = 'adminpw';

/**
 * Build a Certificate Authority (CA) client
 * @param FabricCAServices Fabric CA client class
 * @param ccp Connection profile object
 * @param caHostName CA hostname (e.g. ca.org1.example.com)
 * @returns Instance of FabricCAServices
 */
export function buildCAClient(
    FabricCAServices: typeof import('fabric-ca-client'),
    ccp: Record<string, any>,
    caHostName: string
): FabricCAServices {
    const caInfo = ccp.certificateAuthorities[caHostName];
    const caTLSCACerts = caInfo.tlsCACerts.pem;

    const caClient = new FabricCAServices(
        'https://ca_org1:7054', // Used to be caInfo.url but localhost (::1) means itself (Node Server), not CA server
        { trustedRoots: caTLSCACerts, verify: false },
        caInfo.caName
    );

    console.log(`Built a CA Client named ${caInfo.caName}`);
    return caClient;
}

/**
 * Enroll admin and import into wallet
 */
export async function enrollAdmin(
    caClient: FabricCAServices,
    wallet: Wallet,
    orgMspId: string
): Promise<void> {
    try {
        const identity = await wallet.get(adminUserId);
        if (identity) {
            console.log(
                'An identity for the admin user already exists in the wallet'
            );
            return;
        }

        const enrollment = await caClient.enroll({
            enrollmentID: adminUserId,
            enrollmentSecret: adminUserPasswd,
        });

        const x509Identity: X509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: orgMspId,
            type: 'X.509',
        };

        await wallet.put(adminUserId, x509Identity);
        console.log(
            'Successfully enrolled admin user and imported it into the wallet'
        );
    } catch (error) {
        console.error(
            `Failed to enroll admin user : ${(error as Error).message}`
        );
    }
}

/**
 * Register and enroll user, then import to wallet
 */
export async function registerAndEnrollUser(
    caClient: FabricCAServices,
    wallet: Wallet,
    orgMspId: string,
    userId: string,
    affiliation: string
): Promise<void> {
    try {
        const userIdentity = await wallet.get(userId);
        if (userIdentity) {
            console.log(
                `An identity for the user ${userId} already exists in the wallet`
            );
            return;
        }

        const adminIdentity = await wallet.get(adminUserId);
        if (!adminIdentity) {
            console.log(
                'An identity for the admin user does not exist in the wallet'
            );
            console.log('Enroll the admin user before retrying');
            return;
        }

        const provider = wallet
            .getProviderRegistry()
            .getProvider(adminIdentity.type);
        const adminUser = await provider.getUserContext(
            adminIdentity,
            adminUserId
        );

        const secret = await caClient.register(
            {
                affiliation,
                enrollmentID: userId,
                role: 'client',
            },
            adminUser
        );

        const enrollment = await caClient.enroll({
            enrollmentID: userId,
            enrollmentSecret: secret,
        });

        const x509Identity: X509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: orgMspId,
            type: 'X.509',
        };

        await wallet.put(userId, x509Identity);
        console.log(
            `Successfully registered and enrolled user ${userId} and imported it into the wallet`
        );
    } catch (error) {
        console.error(`Failed to register user : ${(error as Error).message}`);
    }
}
