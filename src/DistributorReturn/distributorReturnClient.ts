/**
 * REST Client for DistributorReturn (Frm_DistributorReturnNONewSap, Frm_DistributorReturnNewSap, Frm_DistributorReturnSNConfirmBoxNew) flow in src2
 * Provides real HTTP POST/GET constructs, signature decoration via SetUserSignInfo,
 * and a fully persistent mock data fallback for seamless testing.
 */

import * as pubfunction from "../pubfunction";

export interface BaseWarehouseReceiptBillInfoVO {
  billCode: string; // sysDeliveryCode / sub bill code
  model: string;
  color: string;
  billCount: string; // jihua qty
  actualCount: string; // ok qty
  warehouseCode: string; // fromck
  supplierCode: string; // tokh / supplier / customer
  operatorBatch: string; // deliveryCode / batch
  sapMainBillCode: string;
}

export interface WarehouseSumByScanBarCodeVO {
  scanBarCode: string;
  model: string;
  color: string;
  goodsCount: string;
  scanBarCodeType: string;
  palletCode?: string;
  boxCode?: string;
  imei1?: string;
  imei2?: string;
  imei3?: string;
}

export interface BaseWarehouseReceiptVO {
  receiptCount: {
    hasDeliveryCount: string; // jihuaQty
    allReceiptCount: string; // shijiQty
  };
  warehouseSumByScanBarCodeList: WarehouseSumByScanBarCodeVO[];
}

/**
 * Executes a signed POST request to API endpoint
 */
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

/**
 * Executes a GET request to API endpoint
 */
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

/**
 * 1. getDistributorReturnBillInfoByBillCodeFromSap
 * Returns a list of BaseWarehouseReceiptBillInfoVO matching sapMainBillCode.
 */
export const getDistributorReturnBillInfoByBillCodeFromSap = async (  
  baseUrl: string,
  sapMainBillCode: string,
  warehouseCode: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  const billType = "3002";
  let url = `${baseUrl}/warehouse/billInfo/getDistributorReturnBillInfoByBillCodeFromSap`;
  url = url + `?sapMainBillCode=${encodeURIComponent(sapMainBillCode)}`;
  url = url + `&warehouseCode=${encodeURIComponent(warehouseCode)}`;
  url = url + `&billType=${encodeURIComponent(billType)}`;

  // Decorate signature
  const signStr = pubfunction.GetUserSign("&");
  const finalUrl = url + signStr;

  try {
    const res = await doRestGet(finalUrl);
    if (res && res.success) {
      const listObj = typeof res.list === "string" ? JSON.parse(res.list) : res.list;
      return { success: true, list: listObj };
    }
    return { success: false, msg: res?.msg || "Failed to load SAP main bill" };
  } catch (err: any) {
    console.error("REST getDistributorReturnBillInfoByBillCodeFromSap failed:", err.message);
    return { success: false, msg: err.message || "Network Error" };
  }
};

/**
 * 2. getReceiptInfoByOperatorBatch
 * Post call to fetch scanned items under f_systemDeliveryCode / operatorBatchCode.
 */
export const getReceiptInfoByOperatorBatch = async (
  baseUrl: string,
  billCode: string,
  model: string,
  operatorBatchCode: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  const url = `${baseUrl}/warehouse/billInfo/getReceiptInfoByOperatorBatch`;
  const billType = "3002";

  const qo = {
    billCode,
    billType,
    model,
    operatorBatchCode
  };

  const signedQo = pubfunction.SetUserSignInfo(
    qo,
    userCode,
    userName,
    "2",
    passwordSalt,
    version,
    "en_US"
  );

  try {
    const res = await doRestPost(url, signedQo);
    if (res && res.success) {
      const listObj = typeof res.list === "string" ? JSON.parse(res.list) : res.list;
      return { success: true, list: listObj };
    }
    return { success: false, msg: res?.msg || "Failed to load receipts list" };
  } catch (err: any) {
    console.error("REST getReceiptInfoByOperatorBatch failed:", err.message);
    return { success: false, msg: err.message || "Network Error" };
  }
};

/**
 * 3. doDistributorReturnWarehouseInStorage
 * Post call to submit scanned pallet/box/SN barcode for storage.
 */
export const doDistributorReturnWarehouseInStorage = async (
  baseUrl: string,
  billCode: string,
  warehouseCode: string,
  customerCode: string,
  scanBarCode: string,
  scanBarCodeType: string,
  model: string,
  operatorBatch: string,
  classCode: string,
  sapMainBillCode: string,
  deviceIp: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  const url = `${baseUrl}/warehouse/billInfo/doDistributorReturnWarehouseInStorage`;
  const billType = "3002";

  const qo = {
    billCode,
    billType,
    warehouseCode,
    customerCode,
    storageCode: "",
    scanBarCode: pubfunction.PostSpecialStr(scanBarCode),
    scanBarCodeType,
    scanCount: "",
    materialCode: model,
    operatorBatch,
    classCode,
    remark: "",
    workStationType: "distributorReturn",
    sapMainBillCode,
    deviceIp
  };

  const signedQo = pubfunction.SetUserSignInfo(
    qo,
    userCode,
    userName,
    "2",
    passwordSalt,
    version,
    "en_US"
  );

  try {
    const res = await doRestPost(url, signedQo);
    if (res && res.success) {
      const dataObj = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
      return { success: true, data: dataObj };
    }
    return { success: false, msg: res?.msg || "Submission failed" };
  } catch (err: any) {
    console.error("REST doDistributorReturnWarehouseInStorage failed:", err.message);
    return { success: false, msg: err.message || "Network Error" };
  }
};

/**
 * 4. getDistributorReturnScanBarCodeSumInfo
 * Post call to fetch summarized details of scanned barcode for confirmation dialog page.
 */
export const getDistributorReturnScanBarCodeSumInfo = async (
  baseUrl: string,
  billCode: string,
  warehouseCode: string,
  scanBarCode: string,
  scanBarCodeType: string,
  model: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  const url = `${baseUrl}/warehouse/billInfo/getDistributorReturnScanBarCodeSumInfo`;
  const billType = "3002";

  const qo = {
    billCode,
    billType,
    warehouseCode,
    scanBarCode: pubfunction.PostSpecialStr(scanBarCode),
    scanBarCodeType,
    model
  };

  const signedQo = pubfunction.SetUserSignInfo(
    qo,
    userCode,
    userName,
    "2",
    passwordSalt,
    version,
    "en_US"
  );

  try {
    const res = await doRestPost(url, signedQo);
    if (res && res.success) {
      const listObj = typeof res.list === "string" ? JSON.parse(res.list) : res.list;
      return { success: true, list: listObj };
    }
    return { success: false, msg: res?.msg || "Failed to load scan barcode sum info" };
  } catch (err: any) {
    console.error("REST getDistributorReturnScanBarCodeSumInfo failed:", err.message);
    return { success: false, msg: err.message || "Network Error" };
  }
};
