/*
  SPDX-License-Identifier: Apache-2.0
*/

import { Object, Property } from 'fabric-contract-api';

@Object()
export class Message {
    @Property()
    public docType?: string = 'message';

    @Property()
    public id: string = '';

    @Property()
    public messageId: number = 0;

    @Property()
    public userId: number = 0;

    @Property()
    public content: string = '';

    @Property()
    public type: number = 0;

    @Property()
    public createdAt: string = '';
}
