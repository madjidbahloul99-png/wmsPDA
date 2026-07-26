
/**
 * REST Client for InWareHouseChina flow in src2
 */

import * as pubfunction from "../pubfunction";

const doRestPost = async (url: string, body: any): Promise<any> => {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`REST Post failed: HTTP ${response.status}`);
    }

    return await response.json();
};

const doRestGet = async (url: string): Promise<any> => {
    const response = await fetch(url, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        }
    });

    if (!response.ok) {
        throw new Error(`REST Get failed: HTTP ${response.status}`);
    }

    return await response.json();
};

export const helloWorld = async (baseUrl: string): Promise<boolean> => {
    try {
        const res = await doRestGet(`${baseUrl}/HelloWorld`);
        return !!res;
    } catch (err) {
        console.error("HelloWorld REST error:", err);
        return false;
    }
};

export const inBarcodeGetOrderChina = async (baseUrl: string): Promise<any> => {
    try {
        const res = await doRestGet(`${baseUrl}/InBarcodeGetOrderChina`);
        return res;
    } catch (err: any) {
        console.error("inBarcodeGetOrderChina error:", err);
        return { success: false, msg: err.message || "Network Error" };
    }
};

export const inBarcodeCheckChina = async (
    baseUrl: string,
    factoryCodeMES: string,
    SN: string,
    orderCode: string
): Promise<any> => {
    try {
        const res = await doRestPost(`${baseUrl}/InBarcodeCheckChina`, { factoryCodeMES, SN, orderCode });
        return res;
    } catch (err: any) {
        console.error("inBarcodeCheckChina error:", err);
        return { success: false, msg: err.message || "Network Error" };
    }
};

export const inPalletInsertChina = async (
    baseUrl: string,
    factoryCodeMES: string,
    wareCode: string,
    scanType: string,
    palletCode: string,
    SN: string,
    classCode: string,
    groupCode: string,
    workdate: string,
    userCode: string,
    orderCode: string
): Promise<any> => {
    try {
        const res = await doRestPost(`${baseUrl}/InPalletInsertChina`, {
            factoryCodeMES, wareCode, scanType, palletCode, SN, classCode, groupCode, workdate, userCode, orderCode
        });
        return res;
    } catch (err: any) {
        console.error("inPalletInsertChina error:", err);
        return { success: false, msg: err.message || "Network Error" };
    }
};

export const inBarcodeGetOrderQtyChina = async (
    baseUrl: string,
    orderCode: string
): Promise<any> => {
    try {
        const res = await doRestGet(`${baseUrl}/InBarcodeGetOrderQtyChina?orderCode=${orderCode}`);
        return res;
    } catch (err: any) {
        console.error("inBarcodeGetOrderQtyChina error:", err);
        return { success: false, msg: err.message || "Network Error" };
    }
};

export const inPalletSNBoxChina = async (
    baseUrl: string,
    factoryCodeMES: string,
    wareCode: string,
    palletCode: string
): Promise<any> => {
    try {
        const res = await doRestPost(`${baseUrl}/InPalletSNBoxChina`, { factoryCodeMES, wareCode, palletCode });
        return res;
    } catch (err: any) {
        console.error("inPalletSNBoxChina error:", err);
        return { success: false, msg: err.message || "Network Error" };
    }
};

export const inPalletSNConfirmBoxChina = async (
    baseUrl: string,
    factoryCodeMES: string,
    palletCode: string
): Promise<any> => {
    try {
        const res = await doRestPost(`${baseUrl}/InPalletSNConfirmBoxChina`, { factoryCodeMES, palletCode });
        return res;
    } catch (err: any) {
        console.error("inPalletSNConfirmBoxChina error:", err);
        return { success: false, msg: err.message || "Network Error" };
    }
};

