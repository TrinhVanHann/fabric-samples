/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * This sample is intended to work with the basic message transfer
 * chaincode which imposes some constraints on what is possible here.
 *
 * For example,
 *  - There is no validation for message IDs
 *  - There are no error codes from the chaincode
 *
 * To avoid timeouts, long running tasks should be decoupled from HTTP request
 * processing
 *
 * Submit transactions can potentially be very long running, especially if the
 * transaction fails and needs to be retried one or more times
 *
 * To allow requests to respond quickly enough, this sample queues submit
 * requests for processing asynchronously and immediately returns 202 Accepted
 */

import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { Contract } from 'fabric-network';
import { getReasonPhrase, StatusCodes } from 'http-status-codes';
import { Queue } from 'bullmq';
import { AssetNotFoundError } from './errors';
import { evaluateTransaction } from './fabric';
import { addSubmitTransactionJob } from './jobs';
import { logger } from './logger';

const { ACCEPTED, BAD_REQUEST, INTERNAL_SERVER_ERROR, NOT_FOUND, OK } =
    StatusCodes;

export const messagesRouter = express.Router();
messagesRouter.get('/test', (req, res) =>
    res.send('✅Message endpoint is active✅.')
);

messagesRouter.get('/', async (req: Request, res: Response) => {
    logger.debug('Get all messages request received');
    try {
        const mspId = req.user as string;
        const contract = req.app.locals[mspId]?.messageContract as Contract;
        if (!contract) {
            return res.status(INTERNAL_SERVER_ERROR).json({
                status: getReasonPhrase(INTERNAL_SERVER_ERROR),
                reason: 'CONTRACT_NOT_FOUND',
                message: 'Contract not found',
                timestamp: new Date().toISOString(),
            });
        }

        const data = await evaluateTransaction(contract, 'GetAllMessages');
        let messages = [];
        if (data.length > 0) {
            messages = JSON.parse(data.toString());
        }

        return res.status(OK).json(messages);
    } catch (err) {
        logger.error({ err }, 'Error processing get all messages request');
        return res.status(INTERNAL_SERVER_ERROR).json({
            status: getReasonPhrase(INTERNAL_SERVER_ERROR),
            timestamp: new Date().toISOString(),
        });
    }
});

messagesRouter.post(
    '/',
    body().isObject().withMessage('body must contain a message object'),
    body('id', 'must be a string').notEmpty(),
    body('messageId', 'must be a number').isNumeric(),
    body('userId', 'must be a number').isNumeric(),
    body('content', 'must be a string').notEmpty(),
    body('type', 'must be a number').isNumeric(),
    body('createdAt', 'must be a string').notEmpty(),
    async (req: Request, res: Response) => {
        logger.debug(req.body, 'Create message request received');

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(BAD_REQUEST).json({
                status: getReasonPhrase(BAD_REQUEST),
                reason: 'VALIDATION_ERROR',
                message: 'Invalid request body',
                timestamp: new Date().toISOString(),
                errors: errors.array(),
            });
        }

        const mspId = req.user as string;
        const id = req.body.id;

        try {
            const submitQueue = req.app.locals.jobq as Queue;
            const jobId = await addSubmitTransactionJob(
                submitQueue,
                mspId,
                'CreateMessage',
                id,
                req.body.messageId,
                req.body.userId,
                req.body.content,
                req.body.type,
                req.body.createdAt
            );

            return res.status(ACCEPTED).json({
                status: getReasonPhrase(ACCEPTED),
                jobId: jobId,
                timestamp: new Date().toISOString(),
            });
        } catch (err) {
            logger.error(
                { err },
                'Error processing create message request for message ID %s',
                id
            );

            return res.status(INTERNAL_SERVER_ERROR).json({
                status: getReasonPhrase(INTERNAL_SERVER_ERROR),
                timestamp: new Date().toISOString(),
            });
        }
    }
);

// messagesRouter.options('/:id', async (req: Request, res: Response) => {
//     const id = req.params.id;

//     try {
//         const mspId = req.user as string;
//         const contract = req.app.locals[mspId]?.messageContract as Contract;

//         const data = await evaluateTransaction(contract, 'messageExists', id);
//         const exists = data.toString() === 'true';

//         if (exists) {
//             return res
//                 .status(OK)
//                 .set({
//                     Allow: 'DELETE,GET,OPTIONS,PATCH,PUT',
//                 })
//                 .json({
//                     status: getReasonPhrase(OK),
//                     timestamp: new Date().toISOString(),
//                 });
//         } else {
//             return res.status(NOT_FOUND).json({
//                 status: getReasonPhrase(NOT_FOUND),
//                 timestamp: new Date().toISOString(),
//             });
//         }
//     } catch (err) {
//         logger.error(
//             { err },
//             'Error processing message options request for message ID %s',
//             id
//         );
//         return res.status(INTERNAL_SERVER_ERROR).json({
//             status: getReasonPhrase(INTERNAL_SERVER_ERROR),
//             timestamp: new Date().toISOString(),
//         });
//     }
// });

messagesRouter.get('/:id', async (req: Request, res: Response) => {
    const id = req.params.id;
    logger.debug('Read message request received for message ID %s', id);

    try {
        const mspId = req.user as string;
        const contract = req.app.locals[mspId]?.messageContract as Contract;

        const data = await evaluateTransaction(contract, 'ReadMessage', id);
        const message = JSON.parse(data.toString());

        return res.status(OK).json(message);
    } catch (err) {
        logger.error(
            { err },
            'Error processing read message request for message ID %s',
            id
        );

        if (err instanceof AssetNotFoundError) {
            return res.status(NOT_FOUND).json({
                status: getReasonPhrase(NOT_FOUND),
                timestamp: new Date().toISOString(),
            });
        }

        return res.status(INTERNAL_SERVER_ERROR).json({
            status: getReasonPhrase(INTERNAL_SERVER_ERROR),
            timestamp: new Date().toISOString(),
        });
    }
});

messagesRouter.get(
    '/by-message-id/:messageId',
    async (req: Request, res: Response) => {
        const messageId = req.params.messageId;
        logger.debug(
            'Get messages request received for messageId %s',
            messageId
        );

        try {
            const mspId = req.user as string;
            const contract = req.app.locals[mspId]?.messageContract as Contract;

            const data = await evaluateTransaction(
                contract,
                'GetMessagesByMessageId',
                messageId
            );
            const messages = JSON.parse(data.toString());

            return res.status(OK).json(messages);
        } catch (err) {
            logger.error(
                { err },
                'Error processing get messages request for messageId %s',
                messageId
            );

            return res.status(INTERNAL_SERVER_ERROR).json({
                status: getReasonPhrase(INTERNAL_SERVER_ERROR),
                timestamp: new Date().toISOString(),
            });
        }
    }
);

messagesRouter.put(
    '/:id',
    body().isObject().withMessage('body must contain a message object'),
    body('id', 'must be a string').notEmpty(),
    body('messageId', 'must be a number').isNumeric(),
    body('userId', 'must be a number').isNumeric(),
    body('content', 'must be a string').notEmpty(),
    body('type', 'must be a number').isNumeric(),
    body('createdAt', 'must be a string').notEmpty(),
    async (req: Request, res: Response) => {
        logger.debug(req.body, 'Update message request received');

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(BAD_REQUEST).json({
                status: getReasonPhrase(BAD_REQUEST),
                reason: 'VALIDATION_ERROR',
                message: 'Invalid request body',
                timestamp: new Date().toISOString(),
                errors: errors.array(),
            });
        }

        if (req.params.id != req.body.id) {
            return res.status(BAD_REQUEST).json({
                status: getReasonPhrase(BAD_REQUEST),
                reason: 'ID_MISMATCH',
                message: 'ID must match',
                timestamp: new Date().toISOString(),
            });
        }

        const mspId = req.user as string;
        const id = req.params.id;

        try {
            const submitQueue = req.app.locals.jobq as Queue;
            const jobId = await addSubmitTransactionJob(
                submitQueue,
                mspId,
                'UpdateMessage',
                id,
                req.body.messageId,
                req.body.userId,
                req.body.content,
                req.body.type,
                req.body.createdAt
            );

            return res.status(ACCEPTED).json({
                status: getReasonPhrase(ACCEPTED),
                jobId: jobId,
                timestamp: new Date().toISOString(),
            });
        } catch (err) {
            logger.error(
                { err },
                'Error processing update message request for message ID %s',
                id
            );

            return res.status(INTERNAL_SERVER_ERROR).json({
                status: getReasonPhrase(INTERNAL_SERVER_ERROR),
                timestamp: new Date().toISOString(),
            });
        }
    }
);

// messagesRouter.patch(
//     '/:messageId',
//     body()
//         .isArray({
//             min: 1,
//             max: 1,
//         })
//         .withMessage(
//             'body must contain an array with a single patch operation'
//         ),
//     body('*.op', "operation must be 'replace'").equals('replace'),
//     body('*.path', "path must be '/Owner'").equals('/Owner'),
//     body('*.value', 'must be a string').isString(),
//     async (req: Request, res: Response) => {
//         logger.debug(req.body, 'Transfer message request received');

//         const errors = validationResult(req);
//         if (!errors.isEmpty()) {
//             return res.status(BAD_REQUEST).json({
//                 status: getReasonPhrase(BAD_REQUEST),
//                 reason: 'VALIDATION_ERROR',
//                 message: 'Invalid request body',
//                 timestamp: new Date().toISOString(),
//                 errors: errors.array(),
//             });
//         }

//         const mspId = req.user as string;
//         const messageId = req.params.messageId;
//         const newOwner = req.body[0].value;

//         try {
//             const submitQueue = req.app.locals.jobq as Queue;
//             const jobId = await addSubmitTransactionJob(
//                 submitQueue,
//                 mspId,
//                 'Transfermessage',
//                 messageId,
//                 newOwner
//             );

//             return res.status(ACCEPTED).json({
//                 status: getReasonPhrase(ACCEPTED),
//                 jobId: jobId,
//                 timestamp: new Date().toISOString(),
//             });
//         } catch (err) {
//             logger.error(
//                 { err },
//                 'Error processing update message request for message ID %s',
//                 req.params.messageId
//             );

//             return res.status(INTERNAL_SERVER_ERROR).json({
//                 status: getReasonPhrase(INTERNAL_SERVER_ERROR),
//                 timestamp: new Date().toISOString(),
//             });
//         }
//     }
// );

messagesRouter.delete('/:id', async (req: Request, res: Response) => {
    logger.debug(req.body, 'Delete message request received');

    const mspId = req.user as string;
    const id = req.params.id;

    try {
        const submitQueue = req.app.locals.jobq as Queue;
        const jobId = await addSubmitTransactionJob(
            submitQueue,
            mspId,
            'DeleteMessage',
            id
        );

        return res.status(ACCEPTED).json({
            status: getReasonPhrase(ACCEPTED),
            jobId: jobId,
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        logger.error(
            { err },
            'Error processing delete message request for message ID %s',
            id
        );

        return res.status(INTERNAL_SERVER_ERROR).json({
            status: getReasonPhrase(INTERNAL_SERVER_ERROR),
            timestamp: new Date().toISOString(),
        });
    }
});
