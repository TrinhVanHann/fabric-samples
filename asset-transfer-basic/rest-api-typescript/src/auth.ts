/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from './logger';
import passport from 'passport';
import { NextFunction, Request, Response } from 'express';
import { HeaderAPIKeyStrategy } from 'passport-headerapikey';
import { StatusCodes, getReasonPhrase } from 'http-status-codes';
import { apiKeyStore } from './auth.router'; // 👈 Import store từ login router
import dotenv from 'dotenv';
dotenv.config();
export const ADMIN_API_KEY = process.env.ADMIN_API_KEY!;

const { UNAUTHORIZED } = StatusCodes;

// Purely to serve /api/ca/enroll-admin
export const checkAdminApiKey = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const apiKey = req.header('X-Admin-Key');

    if (apiKey && apiKey === ADMIN_API_KEY) {
        logger.debug('✅ Valid admin API key');
        return next();
    }

    logger.warn('❌ Invalid admin API key');
    res.status(UNAUTHORIZED).json({
        status: getReasonPhrase(UNAUTHORIZED),
        reason: 'INVALID_ADMIN_API_KEY',
        timestamp: new Date().toISOString(),
    });
};

export const fabricAPIKeyStrategy: HeaderAPIKeyStrategy =
    new HeaderAPIKeyStrategy(
        { header: 'X-API-Key', prefix: '' },
        false,
        function (apikey, done) {
            logger.debug({ apikey }, 'Checking X-API-Key from apiKeyStore');

            // Check if API key exists in memory
            const userId = apiKeyStore.get(apikey);
            if (userId) {
                logger.debug('User authenticated: %s', userId);
                return done(null, userId); // 👈 Trả về userId là "user"
            }

            logger.debug({ apikey }, 'No valid X-API-Key found');
            return done(null, false);
        }
    );

export const authenticateApiKey = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    passport.authenticate(
        'headerapikey',
        { session: false },
        (err: any, user: Express.User, _info: any) => {
            if (err) return next(err);
            if (!user)
                return res.status(UNAUTHORIZED).json({
                    status: getReasonPhrase(UNAUTHORIZED),
                    reason: 'NO_VALID_APIKEY',
                    timestamp: new Date().toISOString(),
                });

            req.logIn(user, { session: false }, async (err) => {
                if (err) {
                    return next(err);
                }
                return next();
            });
        }
    )(req, res, next);
};
