import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { Contract } from 'fabric-network';
import { getReasonPhrase, StatusCodes } from 'http-status-codes';
import { Queue } from 'bullmq';
import { AssetNotFoundError } from './errors';
import { evaluateTransaction } from './fabric';
import { addSubmitTransactionJob } from './jobs';
import { logger } from './logger';

import FabricCAServices from 'fabric-ca-client';
import { buildCAClient, enrollAdmin, registerAndEnrollUser } from './utils/CAUtil';

import path from 'path';
import fs from 'fs';
import { Wallets } from 'fabric-network';

const { ACCEPTED, BAD_REQUEST, INTERNAL_SERVER_ERROR, NOT_FOUND, OK } =
    StatusCodes;

// Constants for Org1 — bạn có thể trích xuất ra file config nếu cần
const ccpPath = '/test-network/organizations/peerOrganizations/org1.example.com/connection-org1.json';
const walletPath = path.join(__dirname, 'wallet');
const caHostName = 'ca.org1.example.com';
const mspOrg1 = 'Org1MSP';

export const CaRouter = express.Router();
CaRouter.get('/test', (req, res) =>
    res.send('✅CA endpoint is active✅.')
);

/**
 * GET /ca/enroll-admin
 * Enroll admin and store in wallet
 */
CaRouter.get('/enroll-admin', async (req: Request, res: Response) => {
    try {
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
        const caClient = buildCAClient(FabricCAServices, ccp, caHostName);
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        await enrollAdmin(caClient, wallet, mspOrg1);
        res.status(OK).send('✅ Admin enrolled successfully');
    } catch (err) {
        logger.error(`Error enrolling admin: ${(err as Error).message}`);
        res.status(INTERNAL_SERVER_ERROR).send('❌ Failed to enroll admin');
    }
});

/**
 * POST /ca/register
 * Body: { userId: string, affiliation: string }
 */
CaRouter.post(
    '/register',
    [
        body('userId').notEmpty().withMessage('userId is required'),
        body('affiliation').notEmpty().withMessage('affiliation is required'),
    ],
    async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(BAD_REQUEST).json({ errors: errors.array() });
        }

        const { userId, affiliation } = req.body;

        try {
            const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
            const caClient = buildCAClient(FabricCAServices, ccp, caHostName);
            const wallet = await Wallets.newFileSystemWallet(walletPath);

            await registerAndEnrollUser(caClient, wallet, mspOrg1, userId, affiliation);
            res.status(OK).send(`✅ User ${userId} registered & enrolled successfully`);
        } catch (err) {
            logger.error(`Error registering user: ${(err as Error).message}`);
            res.status(INTERNAL_SERVER_ERROR).send('❌ Failed to register user');
        }
    }
);
