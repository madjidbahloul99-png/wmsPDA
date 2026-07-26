/**
 * REST Client for DFCInventory (EAN NO Inventory) flow in src2
 * Provides real HTTP POST constructs and signature decoration via SetUserSignInfo.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as pubfunction from "../pubfunction";

// Interfaces corresponding to model VO/QO classes
export interface InventoryeanBillVO {
  billCode: string;
  warehouseArea: string;
  inventoryStatus: string;
  warehouseCode: string;
  operatorUser?: string;
  operatorUserName?: string;
  randomNumber?: string;
  sign?: string;
  version?: string;
  languageType?: string;
}

export interface InventoryeanBillModelVO {
  ean: string;
  model: string;
  colorName: string;
  scanCount: string;
  billCode: string;
}

export interface BasedataModelVO {
  ean: string;
  model: string;
  colorName?: string;
}

export interface InventoryeanBillQtyVO {
  ean: string;
  model: string;
  colorName: string;
  goodsCount: string;
  remark: string;
  addDateFormat: string;
}

/**
 * Executes a signed POST request to API endpoint
 */
const doRestPost = async (url: string, body: any): Promise<any> => {
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
      pubfunction.ShowError(`${e.message || String(e)}`);
      return { success: false, msg: `${e.message || String(e)}` };

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
  const url = `${baseUrl}/inventoryean/bill/getLastInventoryeanBillByWarehouseCode`;
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
    return { success: false, msg: res?.msg || "Failed to load" };
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return { success: false, msg: "Network Error" };
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
  const url = `${baseUrl}/inventoryean/billModel/getInventoryeanModelList`;
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
    return { success: false, msg: res?.msg || "Failed to load list" };
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return { success: false, msg: "Network Error" };
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
    return { success: false, msg: "Network Error" };
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
    return { success: false, msg: "Network Error" };
  }
};

/**
 * 5. doAddInventoryModelAdd
 */
export const doAddInventoryModelAdd = async (
  baseUrl: string,
  billCode: string,
  model: string,
  ean: string,
  warehouseCode: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  const url = `${baseUrl}/inventoryean/billModel/doAddInventoryeanModelAdd`;
  const qo = { billCode, model, ean, warehouseCode };
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
    return { success: false, msg: "Network Error" };
  }
};

/**
 * 6. getModelScanSummaryList
 */
export const getModelScanSummaryList = async (
  baseUrl: string,
  billCode: string,
  model: string,
  ean: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  const url = `${baseUrl}/inventoryean/billQty/getInventoryeanModelQtyList`;
  const qo = { billCode, model, ean };
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
    return { success: false, msg: res?.msg || "Failed to load qty list" };
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return { success: false, msg: "Network Error" };
  }
};

/**
 * 7. doAddInventoryModelAddQty
 */
export const doAddInventoryModelAddQty = async (
  baseUrl: string,
  billCode: string,
  model: string,
  ean: string,
  warehouseCode: string,
  qty: string,
  remark: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  const url = `${baseUrl}/inventoryean/billQty/doAddInventoryeanModeQty`;
  const qo = { billCode, model, ean, warehouseCode, goodsCount: qty, remark };
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
    return { success: false, msg: res?.msg || "Failed to save qty" };
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return { success: false, msg: "Network Error" };
  }
};

/**
 * 8. doAddInventoryeanBill
 */
export const doAddInventoryeanBill = async (
  baseUrl: string,
  warehouseCode: string,
  warehouseArea: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  const url = `${baseUrl}/inventoryean/bill/doAddInventoryeanBill`;
  const qo = { warehouseCode, warehouseArea };
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
    return { success: false, msg: "Network Error" };
  }
};

/**
 * 9. doInventoryeanBillStatus
 */
export const doInventoryeanBillStatus = async (
  baseUrl: string,
  billCode: string,
  inventoryStatus: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  const url = `${baseUrl}/inventoryean/bill/doInventoryeanBillStatus`;
  const qo = { billCode, inventoryStatus };
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
    return { success: false, msg: "Network Error" };
  }
};

/**
 * 10. getAreaList (For Area Choosing)
 */
export const getAreaList = async (
  baseUrl: string,
  warehouseCode: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  const url = `${baseUrl}/basedata/warehouseArea/getListByCondition`;
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
      const listObj = typeof res.list === "string" ? JSON.parse(res.list) : res.list;
      return { success: true, list: listObj };
    }
    return { success: false, msg: res?.msg || "Failed to load warehouse areas" };
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return { success: false, msg: "Network Error" };
  }
};
