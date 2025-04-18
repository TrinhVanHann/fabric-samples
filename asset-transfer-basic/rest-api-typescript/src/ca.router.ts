import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import {
    // Contract,
    X509Identity,
} from 'fabric-network';
import {
    // getReasonPhrase,
    StatusCodes,
} from 'http-status-codes';
import { logger } from './logger';
import * as config from './config';
import { checkAdminApiKey } from './auth';

import FabricCAServices from 'fabric-ca-client';
import {
    buildCAClient,
    enrollAdmin,
    registerAndEnrollUser,
} from './utils/CAUtil';

import path from 'path';
// import fs from 'fs';
import { Wallets } from 'fabric-network';
// import {
//     createGateway,
//     evaluateTransaction,
//     getContracts,
//     getNetwork,
// } from './fabric';

const {
    // ACCEPTED,
    BAD_REQUEST,
    INTERNAL_SERVER_ERROR,
    // NOT_FOUND,
    OK,
    UNAUTHORIZED,
} = StatusCodes;

const ccp = config.connectionProfileOrg1; // Lets work with Org1 for now
const walletPath = path.join(__dirname, 'wallet');
const caHostName = 'ca.org1.example.com';
const mspOrg1 = 'Org1MSP';

export const CaRouter = express.Router();
CaRouter.get('/test', (req, res) => res.send('✅CA endpoint is active✅.'));

/**
 * GET /ca/enroll-admin
 * Enroll admin and store in wallet
 */
CaRouter.get(
    '/enroll-admin',
    checkAdminApiKey,
    async (req: Request, res: Response) => {
        try {
            const caClient = buildCAClient(FabricCAServices, ccp, caHostName);
            const wallet = await Wallets.newFileSystemWallet(walletPath);

            const adminExists = await wallet.get('admin');

            if (!adminExists) {
                logger.info('Enrolling admin...');
                await enrollAdmin(caClient, wallet, mspOrg1);
            } else {
                logger.info('Admin already enrolled.');
            }

            const adminIdentity = (await wallet.get('admin')) as X509Identity;

            if (!adminIdentity) {
                return res
                    .status(INTERNAL_SERVER_ERROR)
                    .json({ message: '❌ Cannot load admin identity' });
            }

            const { privateKey } = adminIdentity.credentials;

            res.status(OK).json({
                message: '✅ Admin enrolled or already existed',
                privateKey,
            });
        } catch (err) {
            logger.error(`Error enrolling admin: ${(err as Error).message}`);
            res.status(INTERNAL_SERVER_ERROR).send('❌ Failed to enroll admin');
        }
    }
);

/**
 * POST /ca/register
 * Body: { userId: string, affiliation: string, admin-pkey: string }
 * Register and enroll user, then import to wallet
 * Only admin can register users
 * Admin private key is required to verify the identity of the admin, by comparing it with the one in the wallet
 */
CaRouter.post(
    '/register',
    [
        body('userId').notEmpty().withMessage('userId is required'),
        body('affiliation').notEmpty().withMessage('affiliation is required'),
        body('admin-pkey').notEmpty().withMessage('admin-pkey is required'),
    ],
    async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(BAD_REQUEST).json({ errors: errors.array() });
        }

        const { userId, affiliation, 'admin-pkey': adminPrivateKey } = req.body;

        try {
            const caClient = buildCAClient(FabricCAServices, ccp, caHostName);
            const wallet = await Wallets.newFileSystemWallet(walletPath);

            const adminIdentity = (await wallet.get('admin')) as X509Identity;

            if (!adminIdentity) {
                return res
                    .status(UNAUTHORIZED)
                    .json({ message: '❌ Admin identity not found in wallet' });
            }

            // compare the private key from the request with the one in the wallet
            const realPrivateKey = adminIdentity.credentials.privateKey;
            const submittedPrivateKey = adminPrivateKey;

            const normalizeKey = (key: string) =>
                key.replace(/\r/g, '').replace(/\n/g, '').replace(/\s/g, '');

            // Normalize both keys to remove any extra spaces or newlines
            const normalizedReal = normalizeKey(realPrivateKey);
            const normalizedSubmitted = normalizeKey(submittedPrivateKey);

            if (normalizedReal !== normalizedSubmitted) {
                return res
                    .status(UNAUTHORIZED)
                    .json({ message: '❌ Invalid admin private key' });
            }

            await registerAndEnrollUser(
                caClient,
                wallet,
                mspOrg1,
                userId,
                affiliation
            );

            const userIdentity = (await wallet.get(userId)) as X509Identity;

            if (!userIdentity) {
                return res
                    .status(INTERNAL_SERVER_ERROR)
                    .send('❌ Failed to retrieve newly registered identity');
            }

            res.status(OK).json({
                message: `✅ User ${userId} registered & enrolled successfully`,
                privateKey: userIdentity.credentials.privateKey,
            });
        } catch (err) {
            logger.error(`Error registering user: ${(err as Error).message}`);
            res.status(INTERNAL_SERVER_ERROR).send(
                '❌ Failed to register user'
            );
        }
    }
);
