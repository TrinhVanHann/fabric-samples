/* eslint-disable @typescript-eslint/no-explicit-any */
const contractStore: Record<string, any> = {};

export const setContract = (key: string, contract: any) => {
    contractStore[key] = contract;
};

export const getContract = (key: string): any => {
    return contractStore[key];
};
