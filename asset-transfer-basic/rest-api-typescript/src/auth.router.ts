import express, { Request, Response } from 'express';
import path from 'path';
import { body, validationResult } from 'express-validator';
import FabricCAServices from 'fabric-ca-client';
import { getReasonPhrase, StatusCodes } from 'http-status-codes';
import crypto from 'crypto';
import { logger } from './logger';
import { loginWithPrivateKey } from './auth.service';
import * as config from './config';

const { ACCEPTED, BAD_REQUEST, INTERNAL_SERVER_ERROR, NOT_FOUND, OK, UNAUTHORIZED } =
    StatusCodes;

const authRouter = express.Router();

const apiKeyStore = new Map<string, string>();

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
            const contract = await loginWithPrivateKey(userId, privateKey);

            if (!contract) {
                return res.status(401).json({
                    status: 'Unauthorized',
                    message: 'Login failed',
                });
            }

            req.app.locals[config.mspIdOrg1] = contract;
            // logger.info(req.app.locals[config.mspIdOrg1]);

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

export { apiKeyStore };
export default authRouter;
