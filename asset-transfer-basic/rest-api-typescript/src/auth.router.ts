import express, { Request, Response } from 'express';
import { Gateway, Wallets, X509Identity } from 'fabric-network';
import path from 'path';
import fs from 'fs';
import { body, validationResult } from 'express-validator';
import FabricCAServices from 'fabric-ca-client';
import { getReasonPhrase, StatusCodes } from 'http-status-codes';
import crypto from 'crypto';
import { logger } from './logger';
import {
    createGateway,
    createWallet,
    getContracts,
    getNetwork,
} from './fabric';
import * as config from './config';
import { loginWithPrivateKey } from './auth.service';

const { ACCEPTED, BAD_REQUEST, INTERNAL_SERVER_ERROR, NOT_FOUND, OK, UNAUTHORIZED } =
    StatusCodes;

const authRouter = express.Router();

const apiKeyStore = new Map<string, string>();

const ccpPath = '/test-network/organizations/peerOrganizations/org1.example.com/connection-org1.json';
const walletPath = path.join(__dirname, 'wallet');

authRouter.post(
    '/login',
    [
        body('userId').notEmpty().withMessage('userId is required'),
        body('privateKey').notEmpty().withMessage('privateKey is required'),
    ],
    async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { userId, privateKey } = req.body;

        try {
            const success = await loginWithPrivateKey(userId, privateKey);

            if (!success) {
                return res.status(401).json({
                    status: 'Unauthorized',
                    message: 'Login failed',
                });
            }

            // Generate apiKey or JWT here
            const apiKey = crypto.randomBytes(32).toString('hex');
            apiKeyStore.set(apiKey, userId);

            res.status(200).json({
                status: 'OK',
                message: 'Login successful',
                userId,
                apiKey,
            });
        } catch (error: any) {
            res.status(401).json({
                status: 'Unauthorized',
                message: error.message,
            });
        }
    }
);


// Export store để dùng trong middleware xác thực
export { apiKeyStore };
export default authRouter;
