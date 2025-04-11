/*
 * SPDX-License-Identifier: Apache-2.0
 */
import { Context, Contract, Info, Returns, Transaction } from 'fabric-contract-api';
import stringify from 'json-stringify-deterministic';
import sortKeysRecursive from 'sort-keys-recursive';
import { Message } from './message';

@Info({ title: 'MessageTransfer', description: 'Smart contract for transferring messages' })
export class MessageTransferContract extends Contract {

    @Transaction()
    public async InitLedger(ctx: Context): Promise<void> {
        const messages: Message[] = [
            {
                id: '1',
                messageId: 3,
                userId: 5,
                content: 'Hello World!',
                type: 0,
                createdAt: '2025-04-04T10:00:00Z',
            },
            {
                id: '2',
                messageId: 3,
                userId: 4,
                content: 'Fabric Smart Contracts are cool!',
                type: 0,
                createdAt: '2025-04-04T10:05:00Z',
            }
        ];

        for (const message of messages) {
            // Insert data deterministically to maintain consistent order
            await ctx.stub.putState(message.id, Buffer.from(stringify(sortKeysRecursive(message))));
            console.info(`Message ${message.id} initialized`);
        }
    }

    // CreateMessage issues a new message to the world state with the given details.
    @Transaction()
    public async CreateMessage(
        ctx: Context,
        id: string,
        messageId: number,
        userId: number,
        content: string,
        type: number,
        createdAt: string
    ): Promise<void> {
        const exists = await this.MessageExists(ctx, id);
        if (exists) {
            throw new Error(`The message ${id} already exists`);
        }

        const message = {
            docType: 'message',
            id,
            messageId,
            userId,
            content,
            type,
            createdAt,
        };
        // Insert data deterministically
        await ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(message))));
    }

    // ReadMessage returns the message stored in the world state with the given id.
    @Transaction(false)
    public async ReadMessage(ctx: Context, id: string): Promise<string> {
        const messageJSON = await ctx.stub.getState(id); // Get the message from chaincode state
        if (messageJSON.length === 0) {
            throw new Error(`The message ${id} does not exist`);
        }
        return messageJSON.toString();
    }

    // UpdateMessage updates an existing message in the world state with the provided parameters.
    @Transaction()
    public async UpdateMessage(
        ctx: Context,
        id: string,
        messageId: number,
        userId: number,
        content: string,
        type: number,
        createdAt: string
    ): Promise<void> {
        const exists = await this.MessageExists(ctx, id);
        if (!exists) {
            throw new Error(`The message ${id} does not exist`);
        }

        const updatedMessage = {
            id,
            messageId,
            userId,
            content,
            type,
            createdAt,
        };
        // Insert data deterministically
        await ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(updatedMessage))));
    }

    // DeleteMessage deletes a given message from the world state.
    @Transaction()
    public async DeleteMessage(ctx: Context, id: string): Promise<void> {
        const exists = await this.MessageExists(ctx, id);
        if (!exists) {
            throw new Error(`The message ${id} does not exist`);
        }
        await ctx.stub.deleteState(id);
    }

    // MessageExists returns true when a message with the given ID exists in the world state.
    @Transaction(false)
    @Returns('boolean')
    public async MessageExists(ctx: Context, id: string): Promise<boolean> {
        const messageJSON = await ctx.stub.getState(id);
        return messageJSON.length > 0;
    }

    // TransferMessage updates the userId field of a message with the given id and returns the old userId.
    @Transaction()
    public async TransferMessage(ctx: Context, id: string, newUserId: number): Promise<number> {
        const messageString = await this.ReadMessage(ctx, id);
        const message = JSON.parse(messageString) as Message;
        const oldUserId = message.userId;
        message.userId = newUserId;
        // Insert data deterministically
        await ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(message))));
        return oldUserId;
    }

    // GetAllMessages returns all messages found in the world state.
    @Transaction(false)
    @Returns('string')
    public async GetAllMessages(ctx: Context): Promise<string> {
        const allResults = [];
        const iterator = await ctx.stub.getStateByRange('', '');
        let result = await iterator.next();
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue) as Message;
            } catch (err) {
                console.log(err);
                record = strValue;
            }
            allResults.push(record);
            result = await iterator.next();
        }
        return JSON.stringify(allResults);
    }

}
