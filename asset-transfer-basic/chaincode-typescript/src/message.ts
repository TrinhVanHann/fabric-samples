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
    public messageId: string = '';

    @Property()
    public userId: string = '';

    @Property()
    public content: string = '';

    @Property()
    public type: string = 'text';

    @Property()
    public createdAt: string = '';
}
