/**
 * REST Client for GDSInventory (Frm_InventoryNONew, Frm_InventoryNew, Frm_InventorySNConfirmBoxNew) flow in src2
 * Provides real HTTP POST constructs, signature decoration via SetUserSignInfo.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as pubfunction from "../pubfunction";

// Interfaces corresponding to model VO/QO classes
export interface InventoryBillVO {
  billCode: string;
  inventoryStatus: string;
  warehouseCode: string;
  warehouseArea?: string;
  operatorUser?: string;
  operatorUserName?: string;
  randomNumber?: string;
  sign?: string;
  version?: string;
  languageType?: string;
}

export interface InventoryBillModelVO {
  billCode: string;
  model: string;
  colorName: string;
  scanCount: string;
}

export interface BasedataModelVO {
  ean: string;
  model: string;
  colorName?: string;
}

export interface InventoryBillSnVO {
  scanBarCode: string;
  palletCode: string;
  boxCode: string;
  goodsCount: string;
  model: string;
  colorName: string;
  scanBarCodeType: string;
  addDateFormat: string;
}

export interface WarehouseSumByScanBarCodeVO {
  scanBarCode: string;
  palletCode: string;
  model: string;
  color: string;
  imei1: string;
  imei2: string;
  imei3: string;
  scanBarCodeType: string;
  goodsCount: string;
  boxCode: string;
}

/**
 * Executes a signed POST request to API endpoint
 */
const doRestPost = async (url: string, body: any): Promise<any> => {
  const token = await AsyncStorage.getItem("userToken");
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: pubfunction.classToUrlStr(body),
    });

    if (!response.ok) {
      pubfunction.ShowError(`REST request failed: HTTP ${response.status}`);
      return { success: false, msg: `REST request failed: HTTP ${response.status}` };
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (e: any) {
      return { success: false, msg: `JSON Parse error: ${e.message || String(e)}` };
    }
  } catch (err: any) {
    return { success: false, msg: err.message || "Network Error" };
  }
};

/**
 * 1. getLastInventoryBillByWarehouseCode
 */
export const getLastInventoryBillByWarehouseCode = async (
  baseUrl: string,
  warehouseCode: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  const url = `${baseUrl}/inventory/bill/getLastInventoryBillByWarehouseCode`;
  const qo = { warehouseCode };
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
    return { success: false, msg: res?.msg || "Failed to load active bill" };
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return { success: false, msg: err.message };
  }
};

/**
 * 2. getInventoryModelList
 */
export const getInventoryModelList = async (
  baseUrl: string,
  billCode: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  const url = `${baseUrl}/inventory/billModel/getInventoryModelList`;
  const qo = { billCode };
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
    return { success: false, msg: res?.msg || "Failed to load inventory model list" };
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return { success: false, msg: err.message };
  }
};

/**
 * 3. getModelListByEan
 */
export const getModelListByEan = async (
  baseUrl: string,
  ean: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  const url = `${baseUrl}/basedata/model/getListByCondition`;
  const qo = { ean };
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
    return { success: false, msg: res?.msg || "Failed to query by EAN" };
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return { success: false, msg: err.message };
  }
};

/**
 * 4. getModelListBymodel
 */
export const getModelListBymodel = async (
  baseUrl: string,
  model: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  const url = `${baseUrl}/basedata/model/getListByCondition`;
  const qo = { model };
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
    return { success: false, msg: res?.msg || "Failed to query by model" };
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return { success: false, msg: err.message };
  }
};

/**
 * 5. doAddInventoryModelAdd
 */
export const doAddInventoryModelAdd = async (
  baseUrl: string,
  billCode: string,
  model: string,
  warehouseCode: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  const url = `${baseUrl}/inventory/billModel/doAddInventoryModelAdd`;
  const qo = { billCode, model, warehouseCode };
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
    return { success: false, msg: res?.msg || "Failed to add model" };
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return { success: false, msg: err.message };
  }
};

/**
 * 6. getModelScanSummaryList (called inside Frm_InventoryNew)
 */
export const getModelScanSummaryList = async (
  baseUrl: string,
  billCode: string,
  model: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  const url = `${baseUrl}/inventory/billSn/getModelScanSummaryList`;
  const qo = { billCode, model };
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
    return { success: false, msg: res?.msg || "Failed to load scan summary list" };
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return { success: false, msg: err.message };
  }
};

/**
 * 7. doAddInventorySNEanAdd (corresponds to `/inventory/billSn/doAddInventorySNEanPalletAdd`)
 */
export const doAddInventorySNEanAdd = async (
  baseUrl: string,
  billCode: string,
  SN: string,
  ean: string,
  palletCode: string,
  boxCode: string,
  model: string,
  warehouseCode: string,
  classCode: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  const url = `${baseUrl}/inventory/billSn/doAddInventorySNEanPalletAdd`;
  const qo = { billCode, SN, ean, palletCode, boxCode, model, warehouseCode, classCode };
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
    return { success: false, msg: res?.msg || "Failed to add SN with EAN verification" };
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return { success: false, msg: err.message };
  }
};

/**
 * 8. doAddInventorySNAdd (corresponds to `/inventory/billSn/doAddInventorySNAddNew`)
 */
export const doAddInventorySNAdd = async (
  baseUrl: string,
  billCode: string,
  scanBarCode: string,
  scanBarCodeType: string,
  palletCode: string,
  boxCode: string,
  model: string,
  warehouseCode: string,
  classCode: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  const url = `${baseUrl}/inventory/billSn/doAddInventorySNAddNew`;
  const qo = { billCode, scanBarCode, scanBarCodeType, palletCode, boxCode, model, warehouseCode, classCode };
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
    return { success: false, msg: res?.msg || "Failed to add scanned barCode" };
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return { success: false, msg: err.message };
  }
};

/**
 * 9. doUpdateDeleteFlagByInventoryBillSnQO
 */
export const doUpdateDeleteFlagByInventoryBillSnQO = async (
  baseUrl: string,
  billCode: string,
  scanBarCode: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  const url = `${baseUrl}/inventory/billSn/doUpdateDeleteFlagByInventoryBillSnQO`;
  const qo = { billCode, scanBarCode };
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
    return { success: res?.success || false };
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return { success: false };
  }
};

/**
 * 10. getScanBarCodeSumInfo (called inside Frm_InventorySNConfirmBoxNew)
 */
export const getScanBarCodeSumInfo = async (
  baseUrl: string,
  warehouseCode: string,
  scanBarCode: string,
  scanBarCodeType: string,
  model: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  const url = `${baseUrl}/warehouse/billInfo/getScanBarCodeSumInfo`;
  const qo = { billCode: "", billType: "", warehouseCode, scanBarCode, scanBarCodeType, model };
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
    return { success: false, msg: res?.msg || "Failed to load stock/summary info" };
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return { success: false, msg: err.message };
  }
};
