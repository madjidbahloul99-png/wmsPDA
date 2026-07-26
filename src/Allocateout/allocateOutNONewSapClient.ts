/**
 * REST Client for AllocateOutNONewSap flow in src2
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as pubfunction from "../pubfunction";

const doRestPost = async (url: string, body: any): Promise<any> => {

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };


  const response = await fetch(url, {
    method: "POST",
    headers,
    body: pubfunction.classToUrlStr(body),
  });

  if (!response.ok) {
    pubfunction.ShowError(`REST request failed: HTTP ${response.status}`);
  }
  return await response.json();
};

const doRestGet = async (url: string): Promise<any> => {

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    pubfunction.ShowError(`REST request failed: HTTP ${response.status}`);
  }
  return await response.json();
};

export const updateBillDA = async (soapUrl: string, sapMainBillCode: string): Promise<boolean> => {
  const cleanCode = (sapMainBillCode || "").toUpperCase().trim();
  if (!cleanCode) return false;

  try {
    const reqUrl = soapUrl.endsWith(".asmx") ? soapUrl : `${soapUrl}/WINCEWeb.asmx`;
    const xmlBody = `<UpdateBillDA xmlns="http://tempuri.org/">
      <sapBillCode>${cleanCode}</sapBillCode>
    </UpdateBillDA>`;

    const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    ${xmlBody}
  </soap:Body>
</soap:Envelope>`;

    const response = await fetch(reqUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": `http://tempuri.org/UpdateBillDA`
      },
      body: envelope
    });

    if (!response.ok) {
      pubfunction.ShowError(`SOAP Request failed: HTTP ${response.status}`);
    }
    return true;
  } catch (err) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return true; // Fail gracefully to allow operation to continue
  }
};

export const getWarehouseAllocateBillInfoByBillCodeFromSap = async (
  baseUrl: string,
  sapMainBillCode: string,
  warehouseCode: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  let url = `${baseUrl}/warehouse/billInfo/getWarehouseAllocateBillInfoByBillCodeFromSap`;
  url = pubfunction.AddUrlQuery(url, "?", "sapMainBillCode", sapMainBillCode);
  url = pubfunction.AddUrlQuery(url, "&", "warehouseCode", warehouseCode);
  url = pubfunction.AddUrlQuery(url, "&", "billType", "5001");

  const signedUrl = url + pubfunction.GetUserSign("&");

  try {
    const res = await doRestGet(signedUrl);
    return res;
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return { success: false, msg: err.message || "Network Error" };
  }
};

export const getDeliveryInfoByOperatorBatch = async (
  baseUrl: string,
  systemDeliveryCode: string,
  model: string,
  deliveryCode: string,
  guid: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  const url = `${baseUrl}/warehouse/billInfo/getDeliveryInfoByOperatorBatch`;
  const qo = {
    billCode: systemDeliveryCode,
    billType: "5001",
    model: model,
    operatorBatchCode: deliveryCode,
    guid: guid
  };
  const signedQo = pubfunction.SetUserSignInfo(qo, userCode, userName, "2", passwordSalt, version, "en_US");

  try {
    return await doRestPost(url, signedQo);
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return { success: false, msg: err.message || "Network Error" };
  }
};

export const getListByCondition = async (
  baseUrl: string,
  model: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  const url = `${baseUrl}/basedata/model/getListByCondition`;
  const qo = {
    model: model
  };
  const signedQo = pubfunction.SetUserSignInfo(qo, userCode, userName, "2", passwordSalt, version, "en_US");

  try {
    return await doRestPost(url, signedQo);
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return { success: false, msg: err.message || "Network Error" };
  }
};

export const doAllocateWarehouseOutStorage = async (
  baseUrl: string,
  systemDeliveryCode: string,
  warehouseCode: string,
  tock: string,
  barCode: string,
  scanType: string,
  model: string,
  deliveryCode: string,
  classCode: string,
  ipAddress: string,
  sapMainBillCode: string,
  guid: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  const url = `${baseUrl}/warehouse/billInfo/doAllocateWarehouseOutStorage`;
  const qo = {
    billCode: systemDeliveryCode,
    billType: "5001",
    warehouseCode: warehouseCode,
    toWarehouseCode: tock,
    storageCode: "",
    scanBarCode: pubfunction.PostSpecialStr(barCode),
    scanBarCodeType: scanType,
    scanCount: "",
    materialCode: model,
    operatorBatch: deliveryCode,
    classCode: classCode,
    remark: "",
    workStationType: "AllocateOut",
    deviceIp: ipAddress,
    sapMainBillCode: sapMainBillCode,
    guid: guid
  };
  const signedQo = pubfunction.SetUserSignInfo(qo, userCode, userName, "2", passwordSalt, version, "en_US");

  try {
    return await doRestPost(url, signedQo);
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return { success: false, msg: err.message || "Network Error" };
  }
};

export const getScanBarCodeSumInfo = async (
  baseUrl: string,
  barCode: string,
  scanType: string,
  model: string,
  warehouseCode: string,
  guid: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  const url = `${baseUrl}/warehouse/billInfo/getScanBarCodeSumInfo`;
  const qo = {
    billCode: "",
    billType: "",
    warehouseCode: warehouseCode,
    scanBarCode: pubfunction.PostSpecialStr(barCode),
    scanBarCodeType: scanType,
    model: model,
    guid: guid
  };
  const signedQo = pubfunction.SetUserSignInfo(qo, userCode, userName, "2", passwordSalt, version, "en_US");

  try {
    return await doRestPost(url, signedQo);
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return { success: false, msg: err.message || "Network Error" };
  }
};

export const doAddInventoryOldSNAdd = async (
  baseUrl: string,
  barCode: string,
  ean: string,
  model: string,
  warehouseCode: string,
  classCode: string,
  brand: string,
  guid: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  const url = `${baseUrl}/inventory/billSn/doAddInventoryOldSNAdd`;
  const qo = {
    SN: pubfunction.PostSpecialStr(barCode),
    ean: ean,
    model: model,
    warehouseCode: warehouseCode,
    classCode: classCode,
    brand: brand,
    guid: guid
  };
  const signedQo = pubfunction.SetUserSignInfo(qo, userCode, userName, "2", passwordSalt, version, "en_US");

  try {
    return await doRestPost(url, signedQo);
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return { success: false, msg: err.message || "Network Error" };
  }
};
