/*
 * SPDX-License-Identifier: Apache-2.0
 */

import {type Contract} from 'fabric-contract-api';
import {MessageTransferContract} from './messageTransfer';

export const contracts: typeof Contract[] = [MessageTransferContract];
